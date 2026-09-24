import functools
import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .errors import AppError
from . import services


def health(_request):
    return JsonResponse({"status": "ok"})


def endpoint(created=False):
    """统一异常处理：AppError -> 带拒绝原因的 JSON；POST 成功默认 201。"""

    def decorator(func):
        @functools.wraps(func)
        def wrapper(request, *args, **kwargs):
            try:
                payload = func(request, *args, **kwargs)
            except AppError as exc:
                return JsonResponse(
                    {
                        "accepted": False,
                        "code": exc.code,
                        "reason": exc.message,
                        "message": exc.message,
                    },
                    status=exc.status,
                    json_dumps_params={"ensure_ascii": False},
                )
            status = 201 if created and request.method == "POST" else 200
            return JsonResponse(payload, status=status, json_dumps_params={"ensure_ascii": False})

        return wrapper

    return decorator


def _read_body(request):
    if not request.body:
        return {}
    try:
        data = json.loads(request.body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        raise AppError("invalid_payload", "请求体不是合法的 JSON")
    if not isinstance(data, dict):
        raise AppError("invalid_payload", "请求体必须是 JSON 对象")
    return data


@require_http_methods(["GET"])
@endpoint()
def overview(_request):
    return services.get_overview()


@require_http_methods(["GET"])
@endpoint()
def event_detail(_request, event_id):
    return services.get_event_detail(event_id)


@csrf_exempt
@require_http_methods(["POST"])
@endpoint(created=True)
def register(request, event_id):
    return services.register_team(event_id, _read_body(request))


@require_http_methods(["GET"])
@endpoint()
def team_detail(_request, team_id):
    return services.get_team(team_id)


@csrf_exempt
@require_http_methods(["POST"])
@endpoint(created=True)
def checkin(request, team_id):
    return services.submit_checkin(team_id, _read_body(request))


@require_http_methods(["GET"])
@endpoint()
def leaderboard(_request, event_id):
    return services.get_leaderboard(event_id)


@csrf_exempt
@require_http_methods(["POST"])
@endpoint(created=True)
def backfill(request):
    return services.backfill_checkin(_read_body(request))


@csrf_exempt
@require_http_methods(["POST"])
@endpoint()
def revoke(request, adjustment_id):
    return services.revoke_checkin(adjustment_id, _read_body(request))


@require_http_methods(["GET"])
@endpoint()
def adjustments(request):
    return services.list_adjustments(
        event_id=request.GET.get("eventId"), team_id=request.GET.get("teamId")
    )
