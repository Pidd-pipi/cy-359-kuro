import json
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from domain.models import Checkpoint, Event


class RaceApiTests(TestCase):
    def setUp(self):
        now = timezone.now()
        self.event = Event.objects.create(
            name="接口测试赛",
            start_time=now - timedelta(minutes=10),
            cutoff_time=now + timedelta(hours=3),
        )
        for i in range(1, 4):
            Checkpoint.objects.create(
                event=self.event, code=f"CP0{i}", name=f"点{i}", required=True, order=i
            )

    def post(self, path, body):
        return self.client.post(
            path, data=json.dumps(body), content_type="application/json"
        )

    def test_full_round_over_http(self):
        # 开赛后报名被拒
        resp = self.post("/api/race/register", {"teamName": "晚队", "leaderName": "晚"})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["code"], "registration_closed")

        # 赛前报名成功
        Event.objects.update(start_time=timezone.now() + timedelta(hours=1))
        resp = self.post("/api/race/register", {
            "teamName": "疾风",
            "leaderName": "队长",
            "members": [{"name": "阿强", "number": "A1"}],
        })
        self.assertEqual(resp.status_code, 201)
        team = resp.json()["team"]
        # 领队自动入队
        self.assertEqual({m["name"] for m in team["members"]}, {"队长", "阿强"})
        leader = next(m for m in team["members"] if m["isLeader"])
        self.assertEqual(leader["name"], "队长")

        # 赛前打卡被拒
        resp = self.post("/api/race/punch", {"teamId": team["id"], "member": "阿强", "cpCode": "CP01"})
        self.assertEqual(resp.status_code, 400)
        body = resp.json()
        self.assertFalse(body["ok"])
        self.assertIn("尚未开始", body["message"])

        # 开赛后打卡，乱序打齐
        Event.objects.update(start_time=timezone.now() - timedelta(minutes=10))
        for cp in ["CP03", "CP01"]:
            resp = self.post("/api/race/punch", {"teamId": team["id"], "member": "A1", "cpCode": cp})
            self.assertEqual(resp.status_code, 200, resp.content)
            self.assertTrue(resp.json()["accepted"])

        # 重复打卡 -> 409 + 拒绝记录
        resp = self.post("/api/race/punch", {"teamId": team["id"], "member": "队长", "cpCode": "CP01"})
        self.assertEqual(resp.status_code, 409)
        self.assertEqual(resp.json()["punch"]["result"], "rejected")
        self.assertIn("最早", resp.json()["message"])

        # 未知 CP -> 404
        resp = self.post("/api/race/punch", {"teamId": team["id"], "member": "阿强", "cpCode": "CPXX"})
        self.assertEqual(resp.status_code, 404)
        self.assertEqual(resp.json()["code"], "checkpoint_not_found")

        # 非本队成员 -> 400
        resp = self.post("/api/race/punch", {"teamId": team["id"], "member": "外人", "cpCode": "CP02"})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["code"], "member_not_in_team")

        # 缺一个必达点：榜单为空、缺失含 CP02
        resp = self.client.get("/api/race/results")
        data = resp.json()
        self.assertEqual(data["leaderboard"], [])
        self.assertEqual(data["missing"][0]["missingCps"][0]["code"], "CP02")

        # 裁判补记缺凭证 -> 400
        resp = self.post("/api/race/judge/punch", {
            "teamId": team["id"], "cpCode": "CP02",
            "arrivalTime": timezone.now().isoformat(),
            "reason": "", "evidence": "",
        })
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["code"], "judge_reason_required")

        # 凭证补记成功 -> 立刻上榜、缺失清空、日志可查
        resp = self.post("/api/race/judge/punch", {
            "teamId": team["id"], "cpCode": "CP02",
            "arrivalTime": (timezone.now() - timedelta(minutes=2)).isoformat(),
            "reason": "设备没电", "evidence": "IMG_001.jpg", "operator": "陈裁判",
        })
        self.assertEqual(resp.status_code, 201, resp.content)

        data = self.client.get("/api/race/results").json()
        self.assertEqual(len(data["leaderboard"]), 1)
        self.assertEqual(data["leaderboard"][0]["rank"], 1)
        self.assertEqual(data["missing"], [])

        adjustments = self.client.get("/api/race/adjustments").json()["adjustments"]
        self.assertEqual(len(adjustments), 1)
        self.assertEqual(adjustments[0]["operator"], "陈裁判")
        self.assertIn("设备没电", adjustments[0]["detail"])

        # 被拒绝的提交在 /punches 可逐条查到原因
        punches = self.client.get("/api/race/punches").json()["punches"]
        rejected_reasons = {p["rejectReason"] for p in punches if p["result"] == "rejected"}
        self.assertTrue(any("尚未开始" in r for r in rejected_reasons))
        self.assertTrue(any("不属于本队" in r for r in rejected_reasons))
        self.assertTrue(any("最早" in r for r in rejected_reasons))
