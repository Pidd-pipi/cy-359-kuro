from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from domain.models import Checkpoint, Event, Member, Team


class Command(BaseCommand):
    help = "初始化一场可直接开跑的周末定向赛（赛事、CP 线路、示例队伍）"

    def handle(self, *args, **options):
        if Event.objects.exists():
            self.stdout.write("赛事数据已存在，跳过初始化。")
            return

        now = timezone.now()
        event = Event.objects.create(
            name="2026 秋季城市定向赛 · 周末场",
            description="城市公园环线，共 6 个必达 CP、1 个隐藏加分点，打卡顺序不限，按最后一点时间排名。",
            start_time=now - timedelta(minutes=15),
            cutoff_time=now + timedelta(hours=4),
        )

        checkpoints = [
            ("CP01", "起点广场", "在起跑线雕塑旁集合出发", True, 1),
            ("CP02", "湖心亭", "找到亭内二维码牌，或由 GPS 定位确认", True, 2),
            ("CP03", "老码头", "与复古路标合影完成任务", True, 3),
            ("CP04", "梧桐大道", "回答线索题：梧桐是落叶还是常绿树？", True, 4),
            ("CP05", "钟楼", "记录钟面显示的时间", True, 5),
            ("CP06", "终点营地", "凭全部必达点记录领取奖牌", True, 6),
            ("CP-X", "隐藏观景台", "非必达加分点，找到有惊喜", False, 7),
        ]
        for code, name, clue, required, order in checkpoints:
            Checkpoint.objects.create(
                event=event,
                code=code,
                name=name,
                clue=clue,
                required=required,
                order=order,
            )

        team = Team.objects.create(
            event=event,
            name="疾风小队",
            leader_name="张领队",
            contact="13800000001",
        )
        for name, number, is_leader in [
            ("张领队", "A001", True),
            ("李小跑", "A002", False),
            ("王冲冲", "A003", False),
        ]:
            Member.objects.create(
                team=team, name=name, number=number, is_leader=is_leader
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"已创建赛事「{event.name}」，{Checkpoint.objects.count()} 个点位，示例队「{team.name}」。"
            )
        )
