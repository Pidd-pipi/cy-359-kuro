from django.urls import include, path
from domain import views

# 直接访问后端时带 /api 前缀；经 Nginx / Vite 代理时 /api 前缀会被剥掉
race_patterns = [
    path("event", views.checkpoints_view),          # 赛事时间窗 + 线路 CP
    path("teams", views.teams_view),                # 队伍与成员、进度
    path("punches", views.punches_view),            # 最近提交记录
    path("results", views.results_view),            # 名次 + 缺失清单
    path("adjustments", views.adjustments_view),    # 裁判调整日志
    path("register", views.register_view),          # 领队报名
    path("punch", views.punch_view),                # 选手到点打卡
    path("judge/punch", views.judge_punch_view),    # 裁判补记
    path("judge/revoke", views.judge_revoke_view),  # 裁判撤销
    path("judge/window", views.event_window_view),  # 调整赛事时间
]

urlpatterns = [
    path("health", views.health),
    path("api/health", views.health),
    path("overview", views.overview),
    path("api/overview", views.overview),
    path("race/", include(race_patterns)),
    path("api/race/", include(race_patterns)),
]
