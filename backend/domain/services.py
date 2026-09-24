"""定向赛核心业务：报名、打卡校验、排名、裁判补记。

所有被拒绝的现场打卡也会落库（result=rejected），方便页面追溯每次提交。
同一队同一 CP 的有效记录由模型上的条件唯一索引兜底。
"""
from django.db import transaction
from django.utils import timezone

from .errors import AppError, ERROR_MESSAGES as MSG
from .models import AdjustmentLog, Checkpoint, Event, Member, Punch, Team


def _err(code, http_status=400):
    return AppError(code, MSG[code], http_status=http_status)


def get_active_event(event_id=None):
    """当前操作的赛事：显式指定优先；否则进行中的赛事优先，再取最新一场。"""
    if event_id is not None:
        event = Event.objects.filter(id=event_id).first()
        if event is None:
            raise _err("event_not_found", http_status=404)
        return event

    now = timezone.now()
    ongoing = (
        Event.objects.filter(start_time__lte=now, cutoff_time__gte=now)
        .order_by("id")
        .first()
    )
    if ongoing is not None:
        return ongoing
    event = Event.objects.order_by("-id").first()
    if event is None:
        raise _err("no_active_event", http_status=404)
    return event


def serialize_event(event, now):
    return {
        "id": event.id,
        "name": event.name,
        "description": event.description,
        "startTime": event.start_time.isoformat(),
        "cutoffTime": event.cutoff_time.isoformat(),
        "status": event.status_at(now),
        "statusLabel": event.status_label(now),
    }


# ---------------------------------------------------------------------------
# 领队报名
# ---------------------------------------------------------------------------

def register_team(*, team_name, leader_name, contact="", members=None, now=None, event_id=None):
    """领队创建队伍并一次性录入成员；比赛开始后拒绝报名。"""
    now = now or timezone.now()
    event = get_active_event(event_id)

    if now > event.start_time:
        raise _err("registration_closed")

    name = (team_name or "").strip()
    leader = (leader_name or "").strip()
    if not name or not leader:
        raise AppError("invalid_payload", "队名和领队姓名不能为空")

    if Team.objects.filter(event=event, name=name).exists():
        raise _err("team_name_used")

    raw_members = members or []
    member_rows = []
    for row in raw_members:
        mname = (row.get("name") or "").strip()
        if mname:
            member_rows.append(
                {"name": mname, "number": (row.get("number") or "").strip()}
            )

    # 领队必在成员名单中，重复则只保留一条并标记为领队
    if not any(row["name"] == leader for row in member_rows):
        member_rows.insert(0, {"name": leader, "number": ""})

    if not member_rows:
        raise _err("members_required")

    with transaction.atomic():
        team = Team.objects.create(
            event=event, name=name, leader_name=leader, contact=(contact or "").strip()
        )
        seen = set()
        for row in member_rows:
            if row["name"] in seen:
                continue
            seen.add(row["name"])
            Member.objects.create(
                team=team,
                name=row["name"],
                number=row["number"],
                is_leader=row["name"] == leader,
            )

    return serialize_team(team, now=now)


# ---------------------------------------------------------------------------
# CP 打卡
# ---------------------------------------------------------------------------

def _record_rejected(team, checkpoint, member_name, reason, punch_time):
    return Punch.objects.create(
        team=team,
        checkpoint=checkpoint,
        member_name=member_name or "",
        source=Punch.Source.MEMBER,
        result=Punch.Result.REJECTED,
        reject_reason=reason,
        punch_time=punch_time,
    )


def submit_punch(*, team_identifier, member_identifier, cp_code, now=None, event_id=None):
    """比赛开始后，队内任一成员到点提交 CP 编号。

    返回 (punch_dict, accepted: bool, message)。被拒绝的提交同样落库。
    """
    now = now or timezone.now()
    event = get_active_event(event_id)

    team = (
        Team.objects.filter(event=event)
        .filter(id=team_identifier if str(team_identifier).isdigit() else -1)
        .first()
    )
    if team is None:
        team = Team.objects.filter(event=event, name=str(team_identifier).strip()).first()
    if team is None:
        raise _err("team_not_found")

    code = str(cp_code or "").strip().upper()

    # 先在本赛事线路内查找；不同赛事可能使用相同编号，不能全局取第一条
    checkpoint = Checkpoint.objects.filter(event=event, code=code).first()
    if checkpoint is None:
        other_event_cp = Checkpoint.objects.filter(code=code).first()
        if other_event_cp is not None:
            _record_rejected(team, other_event_cp, str(member_identifier or ""),
                             MSG["checkpoint_not_on_route"], now)
            raise _err("checkpoint_not_on_route")
        # 点位编号根本不存在，无法挂 FK，直接拒绝
        raise _err("checkpoint_not_found", http_status=404)

    # 时间窗：赛前、截止后都拒绝（说明原因）
    if now < event.start_time:
        _record_rejected(team, checkpoint, str(member_identifier or ""),
                         MSG["before_start"], now)
        raise _err("before_start")
    if now > event.cutoff_time:
        _record_rejected(team, checkpoint, str(member_identifier or ""),
                         MSG["after_cutoff"], now)
        raise _err("after_cutoff")

    # 提交人必须是本队成员（按姓名或号码布匹配）
    ident = str(member_identifier or "").strip()
    member = (
        Member.objects.filter(team=team)
        .filter(name=ident)
        .first()
    )
    if member is None:
        member = Member.objects.filter(team=team, number=ident).first()
    if member is None:
        _record_rejected(team, checkpoint, ident, MSG["member_not_in_team"], now)
        raise _err("member_not_in_team")

    with transaction.atomic():
        # 行锁防并发：同一队同一 CP 只保留最早一条有效记录
        existing = (
            Punch.objects.select_for_update()
            .filter(team=team, checkpoint=checkpoint, result=Punch.Result.VALID)
            .first()
        )
        if existing is not None:
            dup = Punch.objects.create(
                team=team,
                checkpoint=checkpoint,
                member_name=member.name,
                source=Punch.Source.MEMBER,
                result=Punch.Result.REJECTED,
                reject_reason=MSG["duplicate_punch"],
                punch_time=now,
            )
            return (
                serialize_punch(dup),
                False,
                MSG["duplicate_punch"],
            )

        punch = Punch.objects.create(
            team=team,
            checkpoint=checkpoint,
            member_name=member.name,
            source=Punch.Source.MEMBER,
            result=Punch.Result.VALID,
            punch_time=now,
        )

    return serialize_punch(punch), True, "打卡成功"


# ---------------------------------------------------------------------------
# 裁判补记 / 撤销 / 时间窗
# ---------------------------------------------------------------------------

def judge_punch(*, team_id, cp_code, arrival_time, reason, evidence, operator="裁判", event_id=None):
    """裁判为漏打且有凭证的队伍补记，补记后排名与缺失清单立即重算。"""
    event = get_active_event(event_id)
    team = Team.objects.filter(event=event, id=team_id).first()
    if team is None:
        raise _err("team_not_found")

    checkpoint = Checkpoint.objects.filter(
        event=event, code=str(cp_code or "").strip().upper()
    ).first()
    if checkpoint is None:
        raise _err("checkpoint_not_found")

    reason = (reason or "").strip()
    evidence = (evidence or "").strip()
    if not reason or not evidence:
        raise _err("judge_reason_required")

    if arrival_time is None:
        raise AppError("invalid_payload", "请填写凭证上的到达时间")
    if arrival_time < event.start_time or arrival_time > event.cutoff_time:
        raise _err("judge_time_out_of_window")

    if Punch.objects.filter(
        team=team, checkpoint=checkpoint, result=Punch.Result.VALID
    ).exists():
        raise _err("judge_target_invalid")

    with transaction.atomic():
        punch = Punch.objects.create(
            team=team,
            checkpoint=checkpoint,
            member_name="",
            source=Punch.Source.JUDGE,
            result=Punch.Result.VALID,
            punch_time=arrival_time,
            judge_reason=reason,
            evidence=evidence,
        )
        AdjustmentLog.objects.create(
            event=event,
            team=team,
            checkpoint=checkpoint,
            kind=AdjustmentLog.Kind.JUDGE_PUNCH,
            detail=(
                f"为「{team.name}」补记 {checkpoint.code}（{checkpoint.name}），"
                f"到达时间 {timezone.localtime(arrival_time).strftime('%H:%M:%S')}；"
                f"原因：{reason}；凭证：{evidence}"
            ),
            operator=operator,
        )

    return serialize_punch(punch)


def revoke_punch(*, punch_id, operator="裁判", event_id=None):
    """撤销一条有效打卡（裁判纠错），同样写入调整日志。"""
    event = get_active_event(event_id)
    punch = Punch.objects.select_related("team", "checkpoint").filter(id=punch_id).first()
    if punch is None or punch.team.event_id != event.id or not punch.is_valid:
        raise _err("punch_not_revocable")

    with transaction.atomic():
        detail = (
            f"撤销「{punch.team.name}」在 {punch.checkpoint.code}"
            f"（{punch.checkpoint.name}）的有效打卡"
        )
        punch.delete()
        AdjustmentLog.objects.create(
            event=event,
            team=punch.team,
            checkpoint=punch.checkpoint,
            kind=AdjustmentLog.Kind.REVOKE,
            detail=detail,
            operator=operator,
        )
    return {"ok": True}


def update_event_window(*, start_time=None, cutoff_time=None, operator="裁判"):
    event = get_active_event()
    new_start = start_time or event.start_time
    new_cutoff = cutoff_time or event.cutoff_time
    if new_cutoff <= new_start:
        raise _err("window_invalid")

    changes = []
    if start_time and start_time != event.start_time:
        changes.append(
            f"开赛 {timezone.localtime(event.start_time).strftime('%Y-%m-%d %H:%M')}"
            f" → {timezone.localtime(start_time).strftime('%Y-%m-%d %H:%M')}"
        )
    if cutoff_time and cutoff_time != event.cutoff_time:
        changes.append(
            f"截止 {timezone.localtime(event.cutoff_time).strftime('%Y-%m-%d %H:%M')}"
            f" → {timezone.localtime(cutoff_time).strftime('%Y-%m-%d %H:%M')}"
        )

    event.start_time = new_start
    event.cutoff_time = new_cutoff
    event.save(update_fields=["start_time", "cutoff_time", "updated_at"])

    if changes:
        AdjustmentLog.objects.create(
            event=event,
            kind=AdjustmentLog.Kind.WINDOW,
            detail="调整赛事时间窗：" + "；".join(changes),
            operator=operator,
        )
    return serialize_event(event, timezone.now())


# ---------------------------------------------------------------------------
# 查询：队伍、打卡记录、排名、调整日志
# ---------------------------------------------------------------------------

def _team_progress(team, required_ids):
    valid = list(
        Punch.objects.filter(team=team, result=Punch.Result.VALID)
        .select_related("checkpoint")
        .order_by("punch_time")
    )
    punched_required = {p.checkpoint_id for p in valid if p.checkpoint_id in required_ids}
    return {
        "punchedCount": len(punched_required),
        "requiredTotal": len(required_ids),
        "punches": [serialize_punch(p) for p in valid],
        "punchedRequiredIds": sorted(punched_required),
    }


def serialize_member(member):
    return {
        "id": member.id,
        "name": member.name,
        "number": member.number,
        "isLeader": member.is_leader,
    }


def serialize_team(team, now=None):
    required_ids = set(
        team.event.checkpoints.filter(required=True).values_list("id", flat=True)
    )
    progress = _team_progress(team, required_ids)
    return {
        "id": team.id,
        "name": team.name,
        "leaderName": team.leader_name,
        "contact": team.contact,
        "createdAt": team.created_at.isoformat(),
        "members": [serialize_member(m) for m in team.members.all()],
        "punchedCount": progress["punchedCount"],
        "requiredTotal": progress["requiredTotal"],
        "punches": progress["punches"],
        "finished": progress["punchedCount"] == progress["requiredTotal"]
        and progress["requiredTotal"] > 0,
    }


def serialize_punch(punch):
    return {
        "id": punch.id,
        "teamId": punch.team_id,
        "teamName": punch.team.name,
        "checkpointId": punch.checkpoint_id,
        "cpCode": punch.checkpoint.code,
        "cpName": punch.checkpoint.name,
        "required": punch.checkpoint.required,
        "memberName": punch.member_name,
        "source": punch.source,
        "sourceLabel": punch.get_source_display(),
        "result": punch.result,
        "resultLabel": punch.get_result_display(),
        "accepted": punch.is_valid,
        "rejectReason": punch.reject_reason,
        "judgeReason": punch.judge_reason,
        "evidence": punch.evidence,
        "punchTime": punch.punch_time.isoformat(),
        "createdAt": punch.created_at.isoformat(),
    }


def serialize_checkpoint(cp):
    return {
        "id": cp.id,
        "code": cp.code,
        "name": cp.name,
        "clue": cp.clue,
        "required": cp.required,
        "order": cp.order,
    }


def list_teams(event_id=None):
    now = timezone.now()
    event = get_active_event(event_id)
    teams = Team.objects.filter(event=event).prefetch_related("members")
    return {
        "event": serialize_event(event, now),
        "teams": [serialize_team(t, now=now) for t in teams],
    }


def list_checkpoints(event_id=None):
    now = timezone.now()
    event = get_active_event(event_id)
    return {
        "event": serialize_event(event, now),
        "checkpoints": [serialize_checkpoint(cp) for cp in event.checkpoints.all()],
    }


def list_punches(limit=100, event_id=None):
    now = timezone.now()
    event = get_active_event(event_id)
    qs = (
        Punch.objects.filter(team__event=event)
        .select_related("team", "checkpoint")
        .order_by("-created_at", "-id")[:limit]
    )
    return {
        "event": serialize_event(event, now),
        "punches": [serialize_punch(p) for p in qs],
    }


def get_results(event_id=None):
    """按必达点最后一点时间排名；顺序不限，未完赛队伍列入缺失清单。"""
    now = timezone.now()
    event = get_active_event(event_id)
    required_cps = list(event.checkpoints.filter(required=True))
    required_ids = {cp.id for cp in required_cps}
    cp_by_id = {cp.id: cp for cp in required_cps}

    teams = list(Team.objects.filter(event=event))
    valid_punches = (
        Punch.objects.filter(team__event=event, result=Punch.Result.VALID)
        .select_related("checkpoint")
    )

    by_team: dict[int, list[Punch]] = {t.id: [] for t in teams}
    for p in valid_punches:
        by_team.setdefault(p.team_id, []).append(p)

    finished_rows = []
    missing_rows = []

    for team in teams:
        punches = by_team.get(team.id, [])
        required_hits = {p.checkpoint_id: p for p in punches if p.checkpoint_id in required_ids}
        hit_details = [
            {
                "cpCode": cp_by_id[cid].code,
                "cpName": cp_by_id[cid].name,
                "punchTime": required_hits[cid].punch_time.isoformat(),
                "source": required_hits[cid].source,
                "sourceLabel": required_hits[cid].get_source_display(),
            }
            for cid in sorted(required_hits, key=lambda c: required_hits[c].punch_time)
        ]

        if len(required_hits) == len(required_ids):
            finish_punch = max(required_hits.values(), key=lambda p: p.punch_time)
            elapsed = (finish_punch.punch_time - event.start_time).total_seconds()
            finished_rows.append(
                {
                    "teamId": team.id,
                    "teamName": team.name,
                    "leaderName": team.leader_name,
                    "finishTime": finish_punch.punch_time.isoformat(),
                    "elapsedSeconds": max(int(elapsed), 0),
                    "punchedCount": len(required_hits),
                    "requiredTotal": len(required_ids),
                    "hits": hit_details,
                    "_sort": (finish_punch.punch_time, team.created_at, team.id),
                }
            )
        else:
            missing_ids = required_ids - set(required_hits)
            last_time = max(
                (p.punch_time for p in punches), default=None
            )
            missing_rows.append(
                {
                    "teamId": team.id,
                    "teamName": team.name,
                    "leaderName": team.leader_name,
                    "punchedCount": len(required_hits),
                    "requiredTotal": len(required_ids),
                    "missingCps": [
                        {"code": cp_by_id[cid].code, "name": cp_by_id[cid].name}
                        for cid in sorted(missing_ids, key=lambda x: cp_by_id[x].order)
                    ],
                    "lastPunchTime": last_time.isoformat() if last_time else None,
                }
            )

    finished_rows.sort(key=lambda row: row["_sort"])
    for index, row in enumerate(finished_rows, start=1):
        row["rank"] = index
        row.pop("_sort", None)

    missing_rows.sort(key=lambda row: (-row["punchedCount"], row["teamName"]))

    return {
        "event": serialize_event(event, now),
        "requiredTotal": len(required_ids),
        "leaderboard": finished_rows,
        "missing": missing_rows,
        "generatedAt": now.isoformat(),
    }


def serialize_log(log):
    return {
        "id": log.id,
        "kind": log.kind,
        "kindLabel": log.get_kind_display(),
        "detail": log.detail,
        "operator": log.operator,
        "teamId": log.team_id,
        "teamName": log.team.name if log.team else None,
        "cpCode": log.checkpoint.code if log.checkpoint else None,
        "createdAt": log.created_at.isoformat(),
    }


def list_adjustments(limit=100, event_id=None):
    now = timezone.now()
    event = get_active_event(event_id)
    logs = event.adjustment_logs.select_related("team", "checkpoint")[:limit]
    return {
        "event": serialize_event(event, now),
        "adjustments": [serialize_log(log) for log in logs],
    }
