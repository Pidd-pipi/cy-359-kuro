"""总览页静态数据（沿用平台介绍，赛事实时数据走 /api/race/*）。"""

OVERVIEW = {
    "appName": "城市定向越野活动平台",
    "appCode": "lporienteering",
    "description": "面向户外运动爱好者，提供定向越野线路设计、团队报名和积分排名的活动平台。",
    "features": [
        {
            "id": 1,
            "title": "活动线路设计与发布",
            "description": "管理员在地图上标记起点、终点和打卡点（CP点），设置各点线索和任务，发布活动时注明难度（亲子/成人/专业）、时长和装备要求。",
            "status": "已上线",
            "metric": "88%",
        },
        {
            "id": 2,
            "title": "线索打卡点（GPS/二维码）",
            "description": "参赛者到点提交 CP 编号即可打卡，赛前/截止后/非本线路点位一律拒绝，同一队同一 CP 只保留最早有效记录。",
            "status": "已上线",
            "metric": "实时",
        },
        {
            "id": 3,
            "title": "团队报名与排名",
            "description": "领队报名录入成员，完成全部必达点的队伍按最后一点时间排名，裁判补记后排名与缺失清单立即重算。",
            "status": "已上线",
            "metric": "实时",
        },
        {
            "id": 4,
            "title": "积分兑换商城",
            "description": "参与活动获得积分，积分可在商城兑换户外装备、活动优惠券或虚拟勋章，激励用户持续参与。",
            "status": "优化中",
            "metric": "4 级",
        },
        {
            "id": 5,
            "title": "历史线路收藏",
            "description": "用户可收藏感兴趣的已结束活动线路，查看其他参与者的成绩和路线轨迹，为下次报名提供参考。",
            "status": "可导出",
            "metric": "28 条",
        },
    ],
    "kpis": [
        {"label": "已报名队伍", "value": "实时", "trend": "领队端", "tone": "primary"},
        {"label": "现场打卡", "value": "实时", "trend": "选手端", "tone": "warm"},
        {"label": "完赛排名", "value": "实时", "trend": "按最后一点", "tone": "cool"},
        {"label": "裁判补记", "value": "留痕", "trend": "可追溯", "tone": "neutral"},
    ],
    "records": [
        {
            "key": "lporienteering-1",
            "name": "团队报名",
            "owner": "领队",
            "status": "已上线",
            "metric": "录入成员",
            "priority": "高",
        },
        {
            "key": "lporienteering-2",
            "name": "CP 打卡",
            "owner": "选手",
            "status": "已上线",
            "metric": "最早有效",
            "priority": "高",
        },
        {
            "key": "lporienteering-3",
            "name": "赛后排名",
            "owner": "系统",
            "status": "已上线",
            "metric": "完赛时间",
            "priority": "高",
        },
        {
            "key": "lporienteering-4",
            "name": "裁判补记",
            "owner": "裁判",
            "status": "已上线",
            "metric": "凭证留痕",
            "priority": "高",
        },
    ],
}
