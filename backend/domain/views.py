import json
from datetime import datetime

from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .errors import AppError
from .logger import logger
from . import services
from .overview_data import OVERVIEW


def health(_request):
    return JsonResponse({"status": "ok"})


def overview(_request):
    return JsonResponse(OVERVIEW)


def _read_json(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise AppError("invalid_payload", "请求体不是合法的 JSON")


def _parse_dt(value, field):
    if not value:
        return None
    text = str(value).strip()
    try:
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        dt = datetime.fromisoformat(text)
    except ValueError:
        raise AppError("invalid_payload", f"{field} 时间格式不正确，请使用 ISO 8601")
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt)
    return dt


def _error_response(exc):
    if isinstance(exc, AppError):
        return JsonResponse(
            {"ok": False, "code": exc.code, "message": exc.message},
            status=exc.http_status,
        )
    logger.exception("Unhandled domain error")
    return JsonResponse(
        {"ok": False, "code": "internal_error", "message": "服务内部错误"},
        status=500,
    )


def _safe(view):
    def wrapper(request, *args, **kwargs):
        try:
            return view(request, *args, **kwargs)
        except AppError as exc:
            return _error_response(exc)
        except Exception as exc:  # noqa: BLE001
            return _error_response(exc)

    wrapper.__name__ = view.__name__
    return wrapper


# --- 查询接口 ---------------------------------------------------------------

def _event_id(request):
    raw = request.GET.get("eventId")
    return int(raw) if raw and raw.isdigit() else None


@require_http_methods(["GET"])
@_safe
def teams_view(request):
    return JsonResponse(services.list_teams(event_id=_event_id(request)))


@require_http_methods(["GET"])
@_safe
def checkpoints_view(request):
    return JsonResponse(services.list_checkpoints(event_id=_event_id(request)))


@require_http_methods(["GET"])
@_safe
def punches_view(request):
    return JsonResponse(services.list_punches(event_id=_event_id(request)))


@require_http_methods(["GET"])
@_safe
def results_view(request):
    return JsonResponse(services.get_results(event_id=_event_id(request)))


@require_http_methods(["GET"])
@_safe
def adjustments_view(request):
    return JsonResponse(services.list_adjustments(event_id=_event_id(request)))


# --- 领队报名 ---------------------------------------------------------------

@csrf_exempt
@require_http_methods(["POST"])
@_safe
def register_view(request):
    data = _read_json(request)
    team = services.register_team(
        team_name=data.get("teamName"),
        leader_name=data.get("leaderName"),
        contact=data.get("contact", ""),
        members=data.get("members", []),
    )
    return JsonResponse({"ok": True, "message": "报名成功", "team": team}, status=201)


# --- 现场打卡 ---------------------------------------------------------------

@csrf_exempt
@require_http_methods(["POST"])
@_safe
def punch_view(request):
    data = _read_json(request)
    punch, accepted, message = services.submit_punch(
        team_identifier=data.get("teamId") or data.get("teamName"),
        member_identifier=data.get("member") or data.get("memberName"),
        cp_code=data.get("cpCode"),
    )
    return JsonResponse(
        {"ok": accepted, "accepted": accepted, "message": message, "punch": punch},
        status=200 if accepted else 409,
    )


# --- 裁判操作 ---------------------------------------------------------------

@csrf_exempt
@require_http_methods(["POST"])
@_safe
def judge_punch_view(request):
    data = _read_json(request)
    arrival = _parse_dt(data.get("arrivalTime"), "arrivalTime")
    punch = services.judge_punch(
        team_id=data.get("teamId"),
        cp_code=data.get("cpCode"),
        arrival_time=arrival,
        reason=data.get("reason"),
        evidence=data.get("evidence"),
        operator=(data.get("operator") or "裁判"),
    )
    return JsonResponse(
        {"ok": True, "message": "补记成功，排名与缺失清单已重算", "punch": punch},
        status=201,
    )


@csrf_exempt
@require_http_methods(["POST"])
@_safe
def judge_revoke_view(request):
    data = _read_json(request)
    services.revoke_punch(
        punch_id=data.get("punchId"),
        operator=(data.get("operator") or "裁判"),
    )
    return JsonResponse({"ok": True, "message": "已撤销，排名与缺失清单已重算"})


@csrf_exempt
@require_http_methods(["POST"])
@_safe
def event_window_view(request):
    data = _read_json(request)
    event = services.update_event_window(
        start_time=_parse_dt(data.get("startTime"), "startTime"),
        cutoff_time=_parse_dt(data.get("cutoffTime"), "cutoffTime"),
        operator=(data.get("operator") or "裁判"),
    )
    return JsonResponse({"ok": True, "message": "赛事时间已更新", "event": event})
