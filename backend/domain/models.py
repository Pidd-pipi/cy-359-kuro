from django.db import models
from django.db.models import Q


class Event(models.Model):
    """一场周末定向赛。一期只发布一场，线路直接挂在赛事上。"""

    class Status(models.TextChoices):
        UPCOMING = "upcoming", "未开始"
        ONGOING = "ongoing", "进行中"
        CLOSED = "closed", "已截止"

    name = models.CharField("赛事名称", max_length=120)
    description = models.CharField("说明", max_length=400, blank=True, default="")
    start_time = models.DateTimeField("开赛时间")
    cutoff_time = models.DateTimeField("打卡截止时间")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "event"
        ordering = ["-id"]

    def __str__(self):
        return self.name

    def status_at(self, now):
        if now < self.start_time:
            return self.Status.UPCOMING
        if now > self.cutoff_time:
            return self.Status.CLOSED
        return self.Status.ONGOING

    def status_label(self, now):
        return self.Status(self.status_at(now)).label


class Checkpoint(models.Model):
    """线路上的打卡点（CP）。required=True 为必达点。"""

    event = models.ForeignKey(Event, related_name="checkpoints", on_delete=models.CASCADE)
    code = models.CharField("点位编号", max_length=24)
    name = models.CharField("点位名称", max_length=80)
    clue = models.CharField("线索/任务", max_length=255, blank=True, default="")
    required = models.BooleanField("是否必达", default=True)
    order = models.PositiveIntegerField("建议顺序", default=0)

    class Meta:
        db_table = "checkpoint"
        unique_together = ("event", "code")
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.code} {self.name}"


class Team(models.Model):
    """领队报名时创建的队伍。"""

    event = models.ForeignKey(Event, related_name="teams", on_delete=models.CASCADE)
    name = models.CharField("队名", max_length=80)
    leader_name = models.CharField("领队姓名", max_length=40)
    contact = models.CharField("联系方式", max_length=60, blank=True, default="")
    created_at = models.DateTimeField("报名时间", auto_now_add=True)

    class Meta:
        db_table = "team"
        unique_together = ("event", "name")
        ordering = ["created_at", "id"]

    def __str__(self):
        return self.name


class Member(models.Model):
    """队伍成员，由领队报名时一次性录入。"""

    team = models.ForeignKey(Team, related_name="members", on_delete=models.CASCADE)
    name = models.CharField("姓名", max_length=40)
    number = models.CharField("号码布/编号", max_length=24, blank=True, default="")
    is_leader = models.BooleanField("是否领队", default=False)

    class Meta:
        db_table = "member"
        ordering = ["-is_leader", "id"]

    def __str__(self):
        return self.name


class Punch(models.Model):
    """
    一次打卡提交（含被拒绝的提交，便于页面追溯每次尝试）。
    同一队同一 CP 只允许有一条 valid 记录，由条件唯一索引在数据库层兜底。
    """

    class Source(models.TextChoices):
        MEMBER = "member", "成员打卡"
        JUDGE = "judge", "裁判补记"

    class Result(models.TextChoices):
        VALID = "valid", "有效"
        REJECTED = "rejected", "已拒绝"

    team = models.ForeignKey(Team, related_name="punches", on_delete=models.CASCADE)
    checkpoint = models.ForeignKey(
        Checkpoint, related_name="punches", on_delete=models.CASCADE
    )
    member_name = models.CharField("提交成员", max_length=40, blank=True, default="")
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.MEMBER)
    result = models.CharField(max_length=10, choices=Result.choices, default=Result.VALID)
    reject_reason = models.CharField("拒绝原因", max_length=255, blank=True, default="")
    punch_time = models.DateTimeField("到达时间")
    created_at = models.DateTimeField("提交时间", auto_now_add=True)
    judge_reason = models.CharField("裁判补记原因", max_length=255, blank=True, default="")
    evidence = models.CharField("凭证说明", max_length=255, blank=True, default="")

    class Meta:
        db_table = "punch"
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["team", "checkpoint"],
                condition=Q(result="valid"),
                name="uniq_valid_punch_per_team_cp",
            )
        ]

    @property
    def is_valid(self):
        return self.result == self.Result.VALID


class AdjustmentLog(models.Model):
    """裁判的每一次调整（补记、撤销、改时间窗），页面可逐条查询。"""

    class Kind(models.TextChoices):
        JUDGE_PUNCH = "judge_punch", "裁判补记"
        REVOKE = "revoke", "撤销有效打卡"
        WINDOW = "window", "调整赛事时间"

    event = models.ForeignKey(
        Event, related_name="adjustment_logs", on_delete=models.CASCADE
    )
    team = models.ForeignKey(
        Team, related_name="adjustment_logs", null=True, blank=True,
        on_delete=models.SET_NULL,
    )
    checkpoint = models.ForeignKey(
        Checkpoint, related_name="adjustment_logs", null=True, blank=True,
        on_delete=models.SET_NULL,
    )
    kind = models.CharField(max_length=16, choices=Kind.choices)
    detail = models.CharField("调整内容", max_length=500)
    operator = models.CharField("操作裁判", max_length=40, blank=True, default="裁判")
    created_at = models.DateTimeField("操作时间", auto_now_add=True)

    class Meta:
        db_table = "adjustment_log"
        ordering = ["-created_at", "-id"]
