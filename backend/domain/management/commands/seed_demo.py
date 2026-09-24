"""
初始化演示数据：一场进行中的周末定向赛（可立刻打卡/排名/补记），
另含未开始（可报名）与已截止（可看赛后名次）两场赛事。

幂等：默认仅在没有赛事时写入；--reset 会清空赛事相关数据后重建。
时间均相对“现在”生成，保证打开页面就能跑通一整轮。
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from domain.models import Adjustment, CheckIn, CheckPoint, Event, Member, Team


def _at(offset):
    return timezone.now() + timedelta(minutes=offset)


def _make_event(code, name, difficulty, description, start_offset, end_offset, cps):
    event = Event.objects.create(
        code=code,
        name=name,
        difficulty=difficulty,
        description=description,
        start_at=_at(start_offset),
        end_at=_at(end_offset),
    )
    points = []
    for seq, (cp_code, cp_name, clue, required) in enumerate(cps, start=1):
        points.append(
            CheckPoint.objects.create(
                event=event,
                code=cp_code,
                name=cp_name,
                seq=seq,
                clue=clue,
                required=required,
            )
        )
    return event, points


def _make_team(event, number, name, leader, members):
    team = Team.objects.create(event=event, number=number, name=name, leader_name=leader)
    Member.objects.bulk_create([Member(team=team, name=m) for m in members])
    return team


class Command(BaseCommand):
    help = "初始化周末定向赛演示数据"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset", action="store_true", help="清空赛事相关数据后重新初始化"
        )

    def handle(self, *args, **options):
        if options["reset"]:
            Adjustment.objects.all().delete()
            CheckIn.objects.all().delete()
            Member.objects.all().delete()
            Team.objects.all().delete()
            CheckPoint.objects.all().delete()
            Event.objects.all().delete()
            self.stdout.write("已清空旧的赛事数据")

        if Event.objects.exists():
            self.stdout.write("赛事数据已存在，跳过初始化（如需重建请使用 --reset）")
            return

        # 1) 进行中：用于打卡 / 排名 / 裁判补记的主线路
        live_cps = [
            ("CP01", "湖滨公园正门", "起点雕塑旁，找到红色路牌", True),
            ("CP02", "月桥", "桥身第三盏路灯下", True),
            ("CP03", "老钟楼", "钟楼背面的青砖标记", True),
            ("CP04", "市民书房", "前台旁的书架暗格", True),
            ("CP05", "望江台", "栏杆上贴有赛事贴纸", False),
        ]
        live, live_points = _make_event(
            "WK-LIVE",
            "周末定向赛·城市探索线（进行中）",
            "adult",
            "5 个点位（4 必达 + 1 选打 CP05），任一成员到点提交编号即可打卡。",
            -30,
            240,
            live_cps,
        )

        # 风行者：已打 CP01/CP03/CP04，缺 CP02 —— 裁判补记后立刻有名次
        t1 = _make_team(live, "T01", "风行者", "陈领队", ["陈领队", "小鹿", "阿哲"])
        CheckIn.objects.create(team=t1, checkpoint=live_points[0], member=t1.members.get(name="小鹿"),
                               time=_at(-25), source="member")
        CheckIn.objects.create(team=t1, checkpoint=live_points[2], member=t1.members.get(name="阿哲"),
                               time=_at(-12), source="member")
        CheckIn.objects.create(team=t1, checkpoint=live_points[3], member=t1.members.get(name="陈领队"),
                               time=_at(-4), source="member")

        # 指南针：已完成全部必达点
        t2 = _make_team(live, "T02", "指南针", "林领队", ["林领队", "阿May"])
        CheckIn.objects.create(team=t2, checkpoint=live_points[0], member=t2.members.get(name="阿May"),
                               time=_at(-28), source="member")
        CheckIn.objects.create(team=t2, checkpoint=live_points[1], member=t2.members.get(name="林领队"),
                               time=_at(-18), source="member")
        CheckIn.objects.create(team=t2, checkpoint=live_points[2], member=t2.members.get(name="阿May"),
                               time=_at(-9), source="member")
        CheckIn.objects.create(team=t2, checkpoint=live_points[3], member=t2.members.get(name="林领队"),
                               time=_at(-2), source="member")

        # 绿野：空打卡，便于现场演示提交
        _make_team(live, "T03", "绿野", "赵领队", ["赵领队", "小柯", "豆豆"])

        # 2) 未开始：领队可报名
        _make_event(
            "WK-NEXT",
            "周末定向赛·亲子体验线（待开赛）",
            "family",
            "4 个必达点，赛前开放团队报名，比赛开始后打卡通道才会开放。",
            120,
            300,
            [
                ("CP01", "儿童乐园", "旋转木马对面", True),
                ("CP02", "樱花步道", "第 2 号休息椅", True),
                ("CP03", "自然博物馆", "入口恐龙骨架旁", True),
                ("CP04", "大草坪", "白色帐篷处冲线", True),
            ],
        )

        # 3) 已截止：用于查看赛后排名
        done_cps = [
            ("CP01", "古城门", "门洞里的石碑", True),
            ("CP02", "南锣鼓巷口", "铜制路牌", True),
            ("CP03", "钟鼓楼广场", "台阶第七级", True),
        ]
        done, done_points = _make_event(
            "WK-DONE",
            "周末定向赛·专业竞速线（已截止）",
            "pro",
            "3 个必达点，全部队伍已完赛，可直接查看最终名次。",
            -300,
            -60,
            done_cps,
        )
        d1 = _make_team(done, "P01", "闪电队", "周领队", ["周领队", "老K"])
        CheckIn.objects.create(team=d1, checkpoint=done_points[0], member=d1.members.first(),
                               time=_at(-260), source="member")
        CheckIn.objects.create(team=d1, checkpoint=done_points[1], member=d1.members.first(),
                               time=_at(-180), source="member")
        CheckIn.objects.create(team=d1, checkpoint=done_points[2], member=d1.members.first(),
                               time=_at(-90), source="member")

        d2 = _make_team(done, "P02", "北极星", "吴领队", ["吴领队", "小满", "阿灿"])
        CheckIn.objects.create(team=d2, checkpoint=done_points[0], member=d2.members.get(name="小满"),
                               time=_at(-270), source="member")
        CheckIn.objects.create(team=d2, checkpoint=done_points[1], member=d2.members.get(name="吴领队"),
                               time=_at(-220), source="member")
        CheckIn.objects.create(team=d2, checkpoint=done_points[2], member=d2.members.get(name="阿灿"),
                               time=_at(-150), source="member")

        self.stdout.write(self.style.SUCCESS("演示数据初始化完成：3 场赛事、6 支队伍"))
