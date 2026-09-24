"""
周末定向赛核心业务：团队报名 / CP 打卡 / 赛后排名 / 裁判补记。

所有时间均以服务端为准（USE_TZ=True，数据库存 UTC，接口返回 ISO8601）。
"""
from datetime import datetime

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from .errors import AppError, REASON
from .models import Adjustment, CheckIn, CheckPoint, Event, Member, Team

PHASE_LABEL = {"upcoming": "未开始", "live": "进行中", "finished": "已截止"}


# ---------------------------------------------------------------------------
# 工具函数
# ---------------------------------------------------------------------------

def now():
    return timezone.localtime()


def parse_time(value):
    """解析前端提交的 ISO8601 时间；无时区信息时按本地时区处理。"""
    if not value:
        return None
    parsed = parse_datetime(value) if isinstance(value, str) else None
    if parsed is None:
        raise AppError("invalid_time", REASON["invalid_time"])
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


def _iso(value):
    if value is None:
        return None
    return timezone.localtime(value).isoformat(timespec="seconds")


def _event_data(event, current):
    return {
        "id": event.id,
        "code": event.code,
        "name": event.name,
        "difficulty": event.get_difficulty_display(),
        "description": event.description,
        "startAt": _iso(event.start_at),
        "endAt": _iso(event.end_at),
        "phase": event.phase(current),
        "phaseLabel": PHASE_LABEL[event.phase(current)],
        "requiredCount": event.checkpoints.filter(required=True).count(),
        "teamCount": event.teams.count(),
    }


def _checkpoint_data(cp, checkin=None):
    data = {
        "id": cp.id,
        "code": cp.code,
        "name": cp.name,
        "seq": cp.seq,
        "clue": cp.clue,
        "required": cp.required,
    }
    if checkin is not None:
        data["checkedAt"] = _iso(checkin.time)
        data["source"] = checkin.get_source_display()
        data["memberName"] = checkin.member.name if checkin.member else "—"
    return data


def _get_event(event_id):
    try:
        return Event.objects.get(pk=event_id)
    except (Event.DoesNotExist, ValueError, TypeError):
        raise AppError("event_not_found", REASON["event_not_found"], status=404)


def _get_team(team_id):
    try:
        return Team.objects.select_related("event").get(pk=team_id)
    except (Team.DoesNotExist, ValueError, TypeError):
        raise AppError("team_not_found", REASON["team_not_found"], status=404)


# ---------------------------------------------------------------------------
# 总览与赛事
# ---------------------------------------------------------------------------

def get_overview():
    current = now()
    events = Event.objects.prefetch_related("checkpoints", "teams").all()
    items = [_event_data(event, current) for event in events]
    return {
        "serverTime": _iso(current),
        "events": items,
    }


def get_event_detail(event_id):
    current = now()
    event = _get_event(event_id)
    teams = list(event.teams.prefetch_related("members", "checkins__checkpoint", "checkins__member"))
    checkpoints = list(event.checkpoints.all())
    required = [cp for cp in checkpoints if cp.required]

    team_rows = []
    finished_count = 0
    for team in teams:
        cp_map = {c.checkpoint_id: c for c in team.checkins.all()}
        hit_required = [cp for cp in required if cp.id in cp_map]
        missing = [cp for cp in required if cp.id not in cp_map]
        last_time = max((cp_map[cp.id].time for cp in hit_required), default=None)
        finished = not missing and bool(hit_required)
        if finished:
            finished_count += 1
        team_rows.append(
            {
                "id": team.id,
                "number": team.number,
                "name": team.name,
                "leaderName": team.leader_name,
                "memberCount": team.members.count(),
                "checkedCount": len(hit_required),
                "requiredCount": len(required),
                "missingCount": len(missing),
                "finished": finished,
                "finishTime": _iso(last_time),
                "registeredAt": _iso(team.registered_at),
            }
        )

    return {
        "event": _event_data(event, current),
        "checkpoints": [_checkpoint_data(cp) for cp in checkpoints],
        "teams": team_rows,
        "stats": {
            "teamCount": len(teams),
            "finishedCount": finished_count,
            "requiredCount": len(required),
        },
    }


# ---------------------------------------------------------------------------
# 领队报名
# ---------------------------------------------------------------------------

def register_team(event_id, payload):
    event = _get_event(event_id)
    current = now()

    # 赛前开放报名；开始后或截止后拒绝
    if current >= event.start_at:
        raise AppError("registration_closed", REASON["registration_closed"])

    number = str(payload.get("number", "")).strip()
    name = str(payload.get("name", "")).strip()
    leader_name = str(payload.get("leaderName", "")).strip()
    contact = str(payload.get("contact", "")).strip()
    members = payload.get("members") or []

    if not number or not name or not leader_name:
        raise AppError("invalid_payload", "队伍编号、队名和领队姓名均为必填项")
    if not isinstance(members, list) or not members:
        raise AppError("no_members", REASON["no_members"])

    # 去空白成员名并去重，同时保留报名顺序
    cleaned, seen = [], set()
    for item in members:
        member_name = str(item.get("name", "")).strip() if isinstance(item, dict) else str(item).strip()
        if member_name and member_name not in seen:
            cleaned.append((member_name, str(item.get("number", "")).strip() if isinstance(item, dict) else ""))
            seen.add(member_name)
    if not cleaned:
        raise AppError("no_members", REASON["no_members"])

    if Team.objects.filter(event=event, number=number).exists():
        raise AppError("duplicate_team_number", REASON["duplicate_team_number"], status=409)

    with transaction.atomic():
        team = Team.objects.create(
            event=event, number=number, name=name, leader_name=leader_name, contact=contact
        )
        Member.objects.bulk_create(
            [Member(team=team, name=member_name, number=member_no) for member_name, member_no in cleaned]
        )

    return _team_detail(team.id)


def _team_detail(team_id):
    team = Team.objects.select_related("event").prefetch_related(
        "members", "checkins__checkpoint", "checkins__member"
    ).get(pk=team_id)
    current = now()
    required = list(team.event.checkpoints.filter(required=True))
    cp_map = {c.checkpoint_id: c for c in team.checkins.all()}
    missing = [cp for cp in required if cp.id not in cp_map]
    last_time = max((cp_map[cp.id].time for cp in required if cp.id in cp_map), default=None)

    return {
        "id": team.id,
        "number": team.number,
        "name": team.name,
        "leaderName": team.leader_name,
        "contact": team.contact,
        "registeredAt": _iso(team.registered_at),
        "event": _event_data(team.event, current),
        "members": [
            {"id": m.id, "name": m.name, "number": m.number} for m in team.members.all()
        ],
        "checkpoints": [
            _checkpoint_data(cp, cp_map.get(cp.id)) for cp in team.event.checkpoints.all()
        ],
        "missing": [{"code": cp.code, "name": cp.name, "seq": cp.seq} for cp in missing],
        "finished": not missing and bool(required),
        "finishTime": _iso(last_time),
    }


def get_team(team_id):
    return _team_detail(_get_team(team_id).id)


# ---------------------------------------------------------------------------
# CP 打卡（选手）
# ---------------------------------------------------------------------------

def submit_checkin(team_id, payload):
    team = _get_team(team_id)
    event = team.event
    current = now()

    cp_code = str(payload.get("cpCode", "")).strip().upper()
    member_name = str(payload.get("memberName", "")).strip()
    if not cp_code or not member_name:
        raise AppError("invalid_payload", "请填写 CP 编号和打卡成员姓名")

    # 时间窗口校验：赛前 / 截止后拒绝，并给出具体原因
    if current < event.start_at:
        raise AppError("event_not_started", REASON["event_not_started"])
    if current > event.end_at:
        raise AppError("event_ended", REASON["event_ended"])

    # 点位必须属于本队线路
    checkpoint = event.checkpoints.filter(code__iexact=cp_code).first()
    if checkpoint is None:
        raise AppError("cp_not_on_route", REASON["cp_not_on_route"], status=404)

    # 成员必须在本队名单
    member = team.members.filter(name=member_name).first()
    if member is None:
        raise AppError("member_not_found", REASON["member_not_found"], status=404)

    # 同一队同一 CP 只保留最早的有效记录：重复提交拒绝（409）
    existing = CheckIn.objects.filter(team=team, checkpoint=checkpoint).first()
    if existing is not None:
        raise AppError("already_checked", REASON["already_checked"], status=409)

    checkin = CheckIn.objects.create(
        team=team, checkpoint=checkpoint, member=member, time=current, source="member"
    )
    return {
        "accepted": True,
        "reason": "打卡成功",
        "code": "ok",
        "checkin": _checkin_data(checkin),
    }


def _checkin_data(checkin):
    return {
        "id": checkin.id,
        "teamId": checkin.team_id,
        "teamNumber": checkin.team.number,
        "cpCode": checkin.checkpoint.code,
        "cpName": checkin.checkpoint.name,
        "memberName": checkin.member.name if checkin.member else "—",
        "time": _iso(checkin.time),
        "source": checkin.source,
        "sourceLabel": checkin.get_source_display(),
    }


# ---------------------------------------------------------------------------
# 缺失清单 + 实时排名
# ---------------------------------------------------------------------------

def _ranking_rows(event_id):
    """
    完成全部必达点的队伍按最后一点打卡时间排名；
    打卡顺序不影响成绩。未完成队伍不进入名次，附缺失清单。
    """
    event = _get_event(event_id)
    teams = list(event.teams.prefetch_related("checkins__checkpoint", "checkins__member"))
    required = list(event.checkpoints.filter(required=True))

    finished_rows, unfinished_rows = [], []
    for team in teams:
        cp_map = {c.checkpoint_id: c for c in team.checkins.all()}
        hit = [cp_map[cp.id] for cp in required if cp.id in cp_map]
        missing = [cp for cp in required if cp.id not in cp_map]
        if missing or not hit:
            unfinished_rows.append((team, missing, len(hit)))
            continue
        last_time = max(c.time for c in hit)
        finished_rows.append((team, hit, last_time))

    finished_rows.sort(key=lambda row: (row[2], row[0].number))

    ranking, rank = [], 1
    for team, hit, last_time in finished_rows:
        ranking.append(
            {
                "rank": rank,
                "teamId": team.id,
                "teamNumber": team.number,
                "teamName": team.name,
                "finishTime": _iso(last_time),
                "elapsedSeconds": int((last_time - event.start_at).total_seconds()),
                "requiredCount": len(required),
                "checkins": [_checkin_data(c) for c in sorted(hit, key=lambda c: c.time)],
            }
        )
        rank += 1

    missing_list = []
    for team, missing, hit_count in unfinished_rows:
        missing_list.append(
            {
                "teamId": team.id,
                "teamNumber": team.number,
                "teamName": team.name,
                "checkedCount": hit_count,
                "requiredCount": len(required),
                "missing": [
                    {"code": cp.code, "name": cp.name, "seq": cp.seq} for cp in missing
                ],
            }
        )
    return event, ranking, missing_list, len(required)


def get_leaderboard(event_id):
    current = now()
    event, ranking, missing_list, required_count = _ranking_rows(event_id)
    return {
        "event": _event_data(event, current),
        "serverTime": _iso(current),
        "requiredCount": required_count,
        "ranking": ranking,
        "missingList": missing_list,
    }


# ---------------------------------------------------------------------------
# 裁判补记 / 撤销 / 调整流水
# ---------------------------------------------------------------------------

def backfill_checkin(payload):
    team = _get_team(payload.get("teamId"))
    event = team.event
    cp_code = str(payload.get("cpCode", "")).strip().upper()
    reason = str(payload.get("reason", "")).strip()
    evidence = str(payload.get("evidence", "")).strip()
    member_name = str(payload.get("memberName", "")).strip()
    operator = str(payload.get("operator", "裁判")).strip() or "裁判"
    checkin_time = parse_time(payload.get("checkinTime"))

    # 凭证 + 原因 + 实际到点时间缺一不可
    if not reason or not evidence or checkin_time is None:
        raise AppError("missing_backfill_fields", REASON["missing_backfill_fields"])

    checkpoint = event.checkpoints.filter(code__iexact=cp_code).first()
    if checkpoint is None:
        # 裁判补记同样限定在本线路点位
        raise AppError("cp_not_on_route", REASON["cp_not_on_route"], status=404)

    existing = CheckIn.objects.filter(team=team, checkpoint=checkpoint).first()
    if existing is not None:
        raise AppError("checkin_exists", REASON["checkin_exists"], status=409)

    member = team.members.filter(name=member_name).first() if member_name else None

    with transaction.atomic():
        adjustment = Adjustment.objects.create(
            event=event,
            team=team,
            checkpoint=checkpoint,
            member_name=member_name or (member.name if member else "未指定成员"),
            action="backfill",
            reason=reason,
            evidence=evidence,
            checkin_time=checkin_time,
            operator=operator,
        )
        checkin = CheckIn.objects.create(
            team=team,
            checkpoint=checkpoint,
            member=member,
            time=checkin_time,
            source="referee",
            adjustment=adjustment,
        )

    # 缺失清单与名次即时重算
    leaderboard = get_leaderboard(event.id)
    return {
        "accepted": True,
        "message": f"已为 {team.number} 队补记 {checkpoint.code}，缺失清单与名次已重算",
        "adjustment": _adjustment_data(adjustment),
        "checkin": _checkin_data(checkin),
        "ranking": leaderboard["ranking"],
        "missingList": leaderboard["missingList"],
    }


def revoke_checkin(adjustment_id, payload=None):
    payload = payload or {}
    reason = str(payload.get("reason", "")).strip() or "裁判撤销补记"
    operator = str(payload.get("operator", "裁判")).strip() or "裁判"

    try:
        adjustment = Adjustment.objects.select_related("event", "team", "checkpoint").get(pk=adjustment_id)
    except (Adjustment.DoesNotExist, ValueError, TypeError):
        raise AppError("adjustment_not_found", REASON["adjustment_not_found"], status=404)

    if adjustment.action != "backfill" or adjustment.checkin is None:
        raise AppError("not_backfill", REASON["not_backfill"])

    with transaction.atomic():
        checkin = adjustment.checkin
        checkin_data = _checkin_data(checkin)
        # 先解除一对一关联（正向 FK 在 CheckIn 上），再删除打卡，保留补记流水可查
        checkin.adjustment = None
        checkin.save(update_fields=["adjustment"])
        checkin.delete()
        revoke_log = Adjustment.objects.create(
            event=adjustment.event,
            team=adjustment.team,
            checkpoint=adjustment.checkpoint,
            member_name=adjustment.member_name,
            action="revoke",
            reason=reason,
            evidence=adjustment.evidence,
            checkin_time=adjustment.checkin_time,
            operator=operator,
        )

    leaderboard = get_leaderboard(adjustment.event_id)
    return {
        "accepted": True,
        "message": "已撤销该补记记录，缺失清单与名次已重算",
        "revoked": checkin_data,
        "adjustment": _adjustment_data(revoke_log),
        "ranking": leaderboard["ranking"],
        "missingList": leaderboard["missingList"],
    }


def _adjustment_data(item):
    return {
        "id": item.id,
        "action": item.action,
        "actionLabel": item.get_action_display(),
        "eventId": item.event_id,
        "teamId": item.team_id,
        "teamNumber": item.team.number,
        "teamName": item.team.name,
        "cpCode": item.checkpoint.code,
        "cpName": item.checkpoint.name,
        "memberName": item.member_name,
        "reason": item.reason,
        "evidence": item.evidence,
        "checkinTime": _iso(item.checkin_time),
        "operator": item.operator,
        "createdAt": _iso(item.created_at),
    }


def list_adjustments(event_id=None, team_id=None):
    qs = Adjustment.objects.select_related("event", "team", "checkpoint").all()
    if event_id:
        qs = qs.filter(event_id=event_id)
    if team_id:
        qs = qs.filter(team_id=team_id)
    return {"adjustments": [_adjustment_data(item) for item in qs], "count": qs.count()}
