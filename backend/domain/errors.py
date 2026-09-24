class AppError(Exception):
    """业务规则异常：code 供前端分支判断，message 直接展示给用户。"""

    def __init__(self, code, message, status=400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


# 拒绝原因常量（services 中引用，保证前后端看到的文案一致）
REASON = {
    "event_not_found": "赛事不存在",
    "team_not_found": "队伍不存在，请先由领队完成报名",
    "cp_not_found": "CP 编号不存在，请核对点位编号",
    "event_not_started": "比赛尚未开始，暂不接受打卡",
    "event_ended": "比赛已截止，选手通道关闭；如有凭证请联系裁判补记",
    "cp_not_on_route": "该 CP 不在本队报名赛事的线路上，打卡拒绝",
    "member_not_found": "成员不在本队名单中，请由领队核实后再提交",
    "already_checked": "本队该 CP 已有更早的有效打卡记录，重复提交不再覆盖",
    "registration_closed": "比赛已开始或已截止，报名通道已关闭",
    "duplicate_team_number": "该赛事下队伍编号已被占用",
    "no_members": "报名至少需要录入 1 名成员",
    "missing_backfill_fields": "裁判补记必须填写实际到点时间、补记原因和凭证说明",
    "invalid_time": "时间格式无法解析，请使用 ISO 8601 格式（如 2026-09-26T10:20:00）",
    "checkin_exists": "该队该 CP 已有有效记录，不能重复补记",
    "not_backfill": "仅可撤销裁判补记产生的记录",
    "adjustment_not_found": "调整记录不存在",
}
