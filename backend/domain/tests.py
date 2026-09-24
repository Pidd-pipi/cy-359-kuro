from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from domain.errors import AppError
from domain.models import Checkpoint, Event, Member, Punch, Team
from domain import services


class RaceFlowTests(TestCase):
    def setUp(self):
        now = timezone.now()
        # 先按“赛前”创建主赛事并报名（此时只有一场，自动选中它）
        self.event = Event.objects.create(
            name="测试赛",
            start_time=now + timedelta(hours=1),
            cutoff_time=now + timedelta(hours=4),
        )
        for i in range(1, 4):
            Checkpoint.objects.create(
                event=self.event, code=f"CP0{i}", name=f"点{i}", required=True, order=i
            )
        Checkpoint.objects.create(
            event=self.event, code="CP-X", name="选达点", required=False, order=9
        )

        self.team = services.register_team(
            team_name="疾风",
            leader_name="队长",
            members=[{"name": "队员A", "number": "A1"}, {"name": "队员B"}],
            event_id=self.event.id,
        )

        # 再建另一场赛事（同名编号 + 本赛没有的编号），用于校验“非本线路”拒绝
        self.other_event = Event.objects.create(
            name="其他赛事",
            start_time=now + timedelta(hours=1),
            cutoff_time=now + timedelta(hours=4),
        )
        Checkpoint.objects.create(event=self.other_event, code="CP01", name="别的线 CP01", required=True)
        Checkpoint.objects.create(event=self.other_event, code="CP99", name="别的线专属点", required=True)

        self.open_event()

    def open_event(self):
        now = timezone.now()
        # 两场都在时间窗内时，服务优先取 id 最小的进行中赛事，即主赛事
        Event.objects.update(start_time=now - timedelta(hours=1), cutoff_time=now + timedelta(hours=3))

    def punch(self, team, member, cp):
        return services.submit_punch(
            team_identifier=team["id"],
            member_identifier=member,
            cp_code=cp,
            event_id=self.event.id,
        )

    # -- 报名 ----------------------------------------------------------------

    def test_register_allowed_before_start_rejected_after(self):
        # 赛前可以报名
        Event.objects.filter(pk=self.event.pk).update(
            start_time=timezone.now() + timedelta(days=1)
        )
        team = services.register_team(
            team_name="早鸟队", leader_name="早领队", event_id=self.event.id
        )
        self.assertEqual(team["name"], "早鸟队")

        # 开赛后拒绝报名
        Event.objects.filter(pk=self.event.pk).update(
            start_time=timezone.now() - timedelta(minutes=1)
        )
        with self.assertRaises(AppError) as ctx:
            services.register_team(
                team_name="迟到队", leader_name="晚领队", event_id=self.event.id
            )
        self.assertEqual(ctx.exception.code, "registration_closed")

    def test_register_duplicate_team_name(self):
        Event.objects.filter(pk=self.event.pk).update(
            start_time=timezone.now() + timedelta(days=1)
        )
        with self.assertRaises(AppError) as ctx:
            services.register_team(
                team_name="疾风", leader_name="另一个", event_id=self.event.id
            )
        self.assertEqual(ctx.exception.code, "team_name_used")

    def test_register_leader_auto_added_to_members(self):
        self.assertTrue(
            Member.objects.filter(team_id=self.team["id"], name="队长", is_leader=True).exists()
        )

    # -- 打卡拒绝 -------------------------------------------------------------

    def test_before_start_rejected(self):
        Event.objects.filter(pk=self.event.pk).update(
            start_time=timezone.now() + timedelta(hours=1)
        )
        with self.assertRaises(AppError) as ctx:
            self.punch(self.team, "队员A", "CP01")
        self.assertEqual(ctx.exception.code, "before_start")
        self.assertTrue(
            Punch.objects.filter(result="rejected", reject_reason__contains="尚未开始").exists()
        )

    def test_after_cutoff_rejected(self):
        Event.objects.filter(pk=self.event.pk).update(
            cutoff_time=timezone.now() - timedelta(minutes=1)
        )
        with self.assertRaises(AppError) as ctx:
            self.punch(self.team, "队员A", "CP01")
        self.assertEqual(ctx.exception.code, "after_cutoff")
        self.assertTrue(
            Punch.objects.filter(result="rejected", reject_reason__contains="截止").exists()
        )

    def test_unknown_checkpoint(self):
        with self.assertRaises(AppError) as ctx:
            self.punch(self.team, "队员A", "NOPE")
        self.assertEqual(ctx.exception.code, "checkpoint_not_found")
        self.assertEqual(ctx.exception.http_status, 404)

    def test_checkpoint_on_other_route_rejected(self):
        # CP99 真实存在但属于另一条线路 -> 拒绝并留痕
        with self.assertRaises(AppError) as ctx:
            self.punch(self.team, "队员A", "CP99")
        self.assertEqual(ctx.exception.code, "checkpoint_not_on_route")
        rejected = Punch.objects.filter(result="rejected", reject_reason__contains="不在本赛事线路")
        self.assertTrue(rejected.exists())

        # CP01 在两条线都有，应命中本赛事的点1，而不是误判
        punch, accepted, _ = self.punch(self.team, "队员A", "cp01")
        self.assertTrue(accepted)
        self.assertEqual(punch["cpName"], "点1")

    def test_member_not_in_team_rejected(self):
        with self.assertRaises(AppError) as ctx:
            self.punch(self.team, "路人", "CP02")
        self.assertEqual(ctx.exception.code, "member_not_in_team")

    def test_member_can_punch_by_number(self):
        _, accepted, _ = self.punch(self.team, "A1", "CP02")
        self.assertTrue(accepted)

    # -- 最早有效 + 排名 ------------------------------------------------------

    def test_only_earliest_valid_kept(self):
        self.punch(self.team, "队员A", "CP02")
        _, accepted, message = self.punch(self.team, "队员B", "CP02")
        self.assertFalse(accepted)
        self.assertIn("最早", message)
        valids = Punch.objects.filter(
            team_id=self.team["id"], checkpoint__code="CP02", result="valid"
        )
        self.assertEqual(valids.count(), 1)
        self.assertEqual(
            Punch.objects.filter(
                team_id=self.team["id"], checkpoint__code="CP02", result="rejected"
            ).count(),
            1,
        )

    def test_ranking_by_last_required_punch_order_free(self):
        # 乱序打卡，必达全齐后上榜，选达点 CP-X 不影响完赛
        for cp in ["CP03", "CP01", "CP-X", "CP02"]:
            self.punch(self.team, "队员A", cp)
        results = services.get_results(event_id=self.event.id)
        self.assertEqual(len(results["leaderboard"]), 1)
        row = results["leaderboard"][0]
        self.assertEqual(row["rank"], 1)
        self.assertEqual(row["requiredTotal"], 3)
        # 最后一条必达是最后提交的 CP02（排名按它的时间，与打卡顺序无关）
        self.assertEqual(row["hits"][-1]["cpCode"], "CP02")
        self.assertEqual(results["missing"], [])

    def test_missing_list_until_all_required(self):
        self.punch(self.team, "队员A", "CP01")
        results = services.get_results(event_id=self.event.id)
        self.assertEqual(results["leaderboard"], [])
        self.assertEqual(len(results["missing"]), 1)
        self.assertEqual(
            [c["code"] for c in results["missing"][0]["missingCps"]],
            ["CP02", "CP03"],
        )

    def test_second_team_rank_order(self):
        # 疾风先打完；闪电后由裁判补记更早的凭证时间 -> 闪电排第一
        for cp in ["CP01", "CP02", "CP03"]:
            self.punch(self.team, "队员A", cp)

        t2 = Team.objects.create(event=self.event, name="闪电", leader_name="领")
        earlier = timezone.now() - timedelta(minutes=20)
        for i, cp in enumerate(["CP01", "CP02", "CP03"]):
            services.judge_punch(
                team_id=t2.id,
                cp_code=cp,
                arrival_time=earlier + timedelta(minutes=i),
                reason="设备故障",
                evidence="照片",
                event_id=self.event.id,
            )
        results = services.get_results(event_id=self.event.id)
        self.assertEqual(
            [r["teamName"] for r in results["leaderboard"]], ["闪电", "疾风"]
        )

    # -- 裁判补记 -------------------------------------------------------------

    def test_judge_punch_requires_reason_and_evidence(self):
        with self.assertRaises(AppError) as ctx:
            services.judge_punch(
                team_id=self.team["id"],
                cp_code="CP02",
                arrival_time=timezone.now(),
                reason="",
                evidence="",
                event_id=self.event.id,
            )
        self.assertEqual(ctx.exception.code, "judge_reason_required")

    def test_judge_punch_out_of_window(self):
        with self.assertRaises(AppError) as ctx:
            services.judge_punch(
                team_id=self.team["id"],
                cp_code="CP02",
                arrival_time=timezone.now() + timedelta(days=9),
                reason="r",
                evidence="e",
                event_id=self.event.id,
            )
        self.assertEqual(ctx.exception.code, "judge_time_out_of_window")

    def test_judge_punch_recalculates_and_logs(self):
        self.punch(self.team, "队员A", "CP01")
        results = services.get_results(event_id=self.event.id)
        self.assertEqual(len(results["missing"]), 1)

        arrival = timezone.now() - timedelta(minutes=30)
        for cp in ["CP02", "CP03"]:
            services.judge_punch(
                team_id=self.team["id"],
                cp_code=cp,
                arrival_time=arrival,
                reason="设备故障",
                evidence="照片 001.jpg",
                operator="陈裁判",
                event_id=self.event.id,
            )

        results = services.get_results(event_id=self.event.id)
        self.assertEqual(results["missing"], [])
        self.assertEqual(len(results["leaderboard"]), 1)
        adjustments = services.list_adjustments(event_id=self.event.id)["adjustments"]
        self.assertEqual(len(adjustments), 2)
        self.assertTrue(all(a["operator"] == "陈裁判" for a in adjustments))
        self.assertEqual(adjustments[0]["teamName"], "疾风")
        self.assertTrue(all(a["cpCode"] in {"CP02", "CP03"} for a in adjustments))

    def test_judge_punch_existing_valid_rejected(self):
        self.punch(self.team, "队员A", "CP01")
        with self.assertRaises(AppError) as ctx:
            services.judge_punch(
                team_id=self.team["id"],
                cp_code="CP01",
                arrival_time=timezone.now(),
                reason="r",
                evidence="e",
                event_id=self.event.id,
            )
        self.assertEqual(ctx.exception.code, "judge_target_invalid")

    def test_revoke_returns_team_to_missing(self):
        for cp in ["CP01", "CP02", "CP03"]:
            self.punch(self.team, "队员A", cp)
        punch = Team.objects.get(id=self.team["id"]).punches.get(
            checkpoint__code="CP03", result="valid"
        )
        services.revoke_punch(punch_id=punch.id, event_id=self.event.id)
        results = services.get_results(event_id=self.event.id)
        self.assertEqual(results["leaderboard"], [])
        self.assertEqual(
            [c["code"] for c in results["missing"][0]["missingCps"]], ["CP03"]
        )
        self.assertEqual(
            services.list_adjustments(event_id=self.event.id)["adjustments"][0]["kind"],
            "revoke",
        )
