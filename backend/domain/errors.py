class AppError(Exception):
    """业务拒绝：携带机器可读 code 与面向用户的中文原因。"""

    def __init__(self, code, message, http_status=400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.http_status = http_status


class NotFoundError(AppError):
    def __init__(self, code, message):
        super().__init__(code, message, http_status=404)


# 打卡 / 报名被拒绝时返回给前端的具体原因
ERROR_MESSAGES = {
    "event_not_found": "赛事不存在",
    "no_active_event": "当前没有可操作的赛事",
    "registration_closed": "报名已截止：比赛开始后不再接受新队伍报名",
    "team_name_used": "本赛事已存在同名队伍，请更换队名",
    "members_required": "请至少录入一名成员（含领队）",
    "team_not_found": "队伍不存在，请核对队名或编号",
    "checkpoint_not_found": "点位编号不存在，请核对 CP 编号",
    "checkpoint_not_on_route": "该点位不在本赛事线路上，不能打卡",
    "before_start": "比赛尚未开始，暂不能打卡",
    "after_cutoff": "打卡已截止，现场打卡通道已关闭",
    "duplicate_punch": "本队已在该 CP 打卡，只保留最早的一条有效记录",
    "member_not_in_team": "该成员不属于本队，请由队内成员提交",
    "judge_reason_required": "裁判补记必须填写原因和凭证说明",
    "judge_target_invalid": "该队该 CP 已有有效打卡，无需补记",
    "judge_time_out_of_window": "补记的到达时间必须在开赛与截止时间之间",
    "punch_not_revocable": "只能撤销有效的现场/补记打卡",
    "window_invalid": "截止时间必须晚于开赛时间",
    "overview_unavailable": "Overview data is unavailable",
}
