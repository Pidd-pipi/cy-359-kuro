from django.urls import path
from domain import views

urlpatterns = [
    path("health", views.health),
    path("api/health", views.health),

    # 总览与赛事
    path("api/overview", views.overview),
    path("api/events/<int:event_id>", views.event_detail),
    path("api/events/<int:event_id>/leaderboard", views.leaderboard),

    # 领队报名 / 队伍进度
    path("api/events/<int:event_id>/teams", views.register),
    path("api/teams/<int:team_id>", views.team_detail),

    # 选手 CP 打卡
    path("api/teams/<int:team_id>/checkins", views.checkin),

    # 裁判补记、撤销与调整流水
    path("api/adjustments", views.adjustments),
    path("api/adjustments/backfill", views.backfill),
    path("api/adjustments/<int:adjustment_id>/revoke", views.revoke),
]
