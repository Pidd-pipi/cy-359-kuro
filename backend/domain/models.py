from django.db import models


class Event(models.Model):
    """一场周末定向赛（含必达点线路与时间窗口）。"""

    DIFFICULTY_CHOICES = [
        ("family", "亲子"),
        ("adult", "成人"),
        ("pro", "专业"),
    ]

    code = models.CharField(max_length=40, unique=True)
    name = models.CharField(max_length=120)
    difficulty = models.CharField(max_length=16, choices=DIFFICULTY_CHOICES, default="adult")
    description = models.CharField(max_length=500, blank=True, default="")
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "or_event"
        ordering = ["start_at"]

    def __str__(self):
        return f"{self.code} {self.name}"

    def phase(self, now):
        """根据时间窗口返回 upcoming / live / finished。"""
        if now < self.start_at:
            return "upcoming"
        if now > self.end_at:
            return "finished"
        return "live"


class CheckPoint(models.Model):
    """线路上的 CP 打卡点；required=True 即必达点。"""

    event = models.ForeignKey(Event, related_name="checkpoints", on_delete=models.CASCADE)
    code = models.CharField(max_length=20)
    name = models.CharField(max_length=80)
    seq = models.PositiveIntegerField(default=1)
    clue = models.CharField(max_length=300, blank=True, default="")
    required = models.BooleanField(default=True)

    class Meta:
        db_table = "or_checkpoint"
        ordering = ["seq", "id"]
        unique_together = ("event", "code")

    def __str__(self):
        return f"{self.code} {self.name}"


class Team(models.Model):
    """领队报名产生的队伍。"""

    event = models.ForeignKey(Event, related_name="teams", on_delete=models.CASCADE)
    number = models.CharField(max_length=20)
    name = models.CharField(max_length=100)
    leader_name = models.CharField(max_length=60)
    contact = models.CharField(max_length=60, blank=True, default="")
    registered_at = models.DateTimeField(auto_now_add=True)
    finish_time = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "or_team"
        ordering = ["number"]
        unique_together = ("event", "number")

    def __str__(self):
        return f"{self.number} {self.name}"


class Member(models.Model):
    """队伍成员；比赛中任一成员都可提交打卡。"""

    team = models.ForeignKey(Team, related_name="members", on_delete=models.CASCADE)
    name = models.CharField(max_length=60)
    number = models.CharField(max_length=20, blank=True, default="")

    class Meta:
        db_table = "or_member"
        ordering = ["id"]

    def __str__(self):
        return self.name


class CheckIn(models.Model):
    """
    有效打卡记录。同一队同一 CP 至多一条有效记录：
    选手打卡保留最早时间；裁判补记后同样只占一条。
    """

    SOURCE_CHOICES = [
        ("member", "选手打卡"),
        ("referee", "裁判补记"),
    ]

    team = models.ForeignKey(Team, related_name="checkins", on_delete=models.CASCADE)
    checkpoint = models.ForeignKey(CheckPoint, related_name="checkins", on_delete=models.CASCADE)
    member = models.ForeignKey(Member, related_name="checkins", on_delete=models.SET_NULL, null=True, blank=True)
    time = models.DateTimeField()
    source = models.CharField(max_length=16, choices=SOURCE_CHOICES, default="member")
    created_at = models.DateTimeField(auto_now_add=True)
    adjustment = models.OneToOneField(
        "Adjustment", related_name="checkin", on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        db_table = "or_checkin"
        ordering = ["time"]
        unique_together = ("team", "checkpoint")

    def __str__(self):
        return f"{self.team_id}-{self.checkpoint_id} @ {self.time:%Y-%m-%d %H:%M:%S}"


class Adjustment(models.Model):
    """裁判对漏打记录的补记审计流水，页面可查到每一次调整。"""

    ACTION_CHOICES = [
        ("backfill", "补记漏打"),
        ("revoke", "撤销补记"),
    ]

    event = models.ForeignKey(Event, related_name="adjustments", on_delete=models.CASCADE)
    team = models.ForeignKey(Team, related_name="adjustments", on_delete=models.CASCADE)
    checkpoint = models.ForeignKey(CheckPoint, related_name="adjustments", on_delete=models.CASCADE)
    member_name = models.CharField(max_length=60, blank=True, default="")
    action = models.CharField(max_length=16, choices=ACTION_CHOICES, default="backfill")
    reason = models.CharField(max_length=500)
    evidence = models.CharField(max_length=500, blank=True, default="")
    checkin_time = models.DateTimeField(null=True, blank=True)
    operator = models.CharField(max_length=60, default="裁判")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "or_adjustment"
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.get_action_display()} {self.team_id}/{self.checkpoint_id}"
