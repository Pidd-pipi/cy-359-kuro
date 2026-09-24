# 城市定向越野活动平台

面向户外运动爱好者，提供线路发布、团队报名、CP 打卡校验与赛后排名的周末定向赛平台。领队、选手、裁判三类角色可以在同一个页面跑通「报名 → 打卡 → 排名 → 补记重算」完整一轮。

## Docker Compose 快速启动

首次启动前复制环境变量文件：

```bash
cp .env.example .env
docker compose up -d
```

启动后后端会自动执行数据库迁移并写入演示数据（一场进行中、一场未开始、一场已截止的赛事）。

访问地址：

- 前端：http://localhost:28519
- 后端健康检查：http://localhost:29519/health
- 赛事总览 API：http://localhost:28519/api/overview

演示数据速览：

| 赛事 | 状态 | 可做什么 |
| --- | --- | --- |
| 周末定向赛·城市探索线（4 必达 + 1 选打） | 进行中 | 选手打卡、看实时排名、裁判为 T01 补记漏掉的 CP02 |
| 周末定向赛·亲子体验线 | 未开始 | 领队报名、录入成员（开赛后报名通道关闭） |
| 周末定向赛·专业竞速线 | 已截止 | 查看赛后排名；选手打卡会被拒绝，需走裁判补记 |

## 一轮完整体验流程

1. **领队报名**：「领队报名」页选择未开始赛事，填写队号、队名、领队与成员名单后提交。
2. **选手打卡**：开赛之后，在「选手打卡」页选择本队、本人，到点提交 CP 编号；任一成员均可打卡。
   - 同一队同一 CP 只保留**最早**的有效记录，重复提交被拒绝（409）；
   - 赛前打卡 → 拒绝：比赛尚未开始；
   - 截止后打卡 → 拒绝：选手通道关闭，提示联系裁判补记；
   - CP 不在本队报名赛事的线路上 / 提交人不在本队名单 → 拒绝并说明原因。
3. **实时排名**：完成全部必达点的队伍按**最后一点打卡时间**排名（打卡顺序可以不同）；未完成队伍展示缺失必达点清单，每 10 秒自动刷新。
4. **裁判补记**：在「裁判台」对漏打但有凭证的队伍，录入 CP、实际到点时间、原因和凭证后补记；提交后缺失清单与名次**立即重算**。
5. **调整留痕**：每一次补记/撤销都进入调整记录表，可按赛事逐条查询；裁判也可在复核后撤销补记，撤销同样留痕并再次重算名次。

## 主要 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/overview` | 赛事总览（含各赛事当前阶段） |
| GET | `/api/events/{id}` | 赛事线路与队伍进度 |
| POST | `/api/events/{id}/teams` | 领队报名（仅赛前开放） |
| GET | `/api/teams/{id}` | 队伍成员与点位打卡明细 |
| POST | `/api/teams/{id}/checkins` | 选手提交 CP 打卡 |
| GET | `/api/events/{id}/leaderboard` | 实时名次 + 缺失清单 |
| POST | `/api/adjustments/backfill` | 裁判凭证补记漏打 |
| POST | `/api/adjustments/{id}/revoke` | 裁判撤销补记 |
| GET | `/api/adjustments?eventId=` | 调整流水查询 |

业务拒绝统一返回 `{"accepted": false, "code": "...", "reason": "具体原因"}`，HTTP 状态码 400/404/409。

## 项目主要功能

- 活动线路设计与发布：标记起点、终点与 CP 点，标注难度（亲子/成人/专业）与必达/选打点位。
- CP 打卡：任一成员到点提交编号即记录服务端时间；时间窗口、线路归属、成员身份、重复提交四类校验都会给出拒绝原因。
- 团队报名与排名：赛前领队统一录入成员；完赛队伍按最后必达点时间排名，实时 leaderboard 与缺失清单。
- 裁判补记：凭证 + 原因 + 实际到点时间三要素齐全方可补记，调整全程留痕、名次即时重算。

## 本地开发方式

前端：

```bash
cd frontend
npm install
npm run dev
```

后端（无 DB_HOST 环境变量时自动使用 SQLite，便于本地快速启动）：

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo          # 写入演示数据，加 --reset 可重建
python manage.py runserver 0.0.0.0:29519
```

## 技术栈

| 分层 | 技术 |
| --- | --- |
| 前端 | React 18 + TypeScript、Ant Design 5、Vite |
| 后端 | Django 5 + Django REST Framework、Python |
| 数据库 | PostgreSQL 15（本地开发可使用 SQLite） |
| 认证 | JWT（预留 djangorestframework-simplejwt） |
| 部署 | Docker Compose、Nginx 反向代理、Gunicorn |

## 项目目录结构

```text
.
├── backend/
│   ├── config/               # Django 项目配置与路由
│   ├── domain/
│   │   ├── models.py         # 赛事/CP/队伍/成员/打卡/调整流水
│   │   ├── services.py       # 报名、打卡、排名、补记核心规则
│   │   ├── views.py          # JSON 接口与统一错误响应
│   │   ├── migrations/       # 数据库迁移
│   │   └── management/       # seed_demo 演示数据命令
│   ├── entrypoint.sh         # migrate + seed + gunicorn
│   └── Dockerfile
├── database/
│   └── init.sql              # 表结构参考（实际由 migrations 创建）
├── frontend/
│   ├── src/
│   │   ├── pages/            # 总览/报名/打卡/排名/裁判台
│   │   ├── api/              # 接口请求封装
│   │   ├── types/            # TypeScript 类型
│   │   └── state/            # 跨页签赛事上下文
│   ├── nginx.conf
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

## 环境变量说明

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| COMPOSE_PROJECT_NAME | Compose 项目名，避免中文目录名导致项目名为空 | lporienteering |
| DB_NAME | 数据库名称 | app |
| DB_USER | 数据库用户 | app |
| DB_PASSWORD | 数据库密码 | app_pwd |
| DB_ROOT_PASSWORD | 数据库 root 密码 | root_pwd |
| JWT_SECRET | Django/JWT 签名密钥 | change_me_to_a_long_random_string |
| FRONTEND_PORT | 前端宿主机端口 | 28519 |
| BACKEND_PORT | 后端宿主机端口 | 29519 |
| DB_PORT | 数据库宿主机端口 | 5432 |

## Docker 部署说明

- 使用 `docker compose up -d` 启动，不需要额外传入 `-p`。
- `docker-compose.yml` 顶层已声明 `name: lporienteering`，`.env` 包含 `COMPOSE_PROJECT_NAME=lporienteering`，可在中文目录名下启动。
- 数据库数据保存在命名卷 `db_data` 中，不依赖当前目录名。
- 前端容器由 Nginx 托管静态资源，并把 `/api/` 反向代理到 `backend:29519`；WebSocket 头已一并配置。
- 后端容器启动时自动执行 `migrate` 与 `seed_demo`（幂等，已有数据时跳过；需要重建可在容器内执行 `python manage.py seed_demo --reset`）。
- 若本地端口冲突，可修改 `.env` 中的 `FRONTEND_PORT`、`BACKEND_PORT`、`DB_PORT`。

常用命令：

```bash
docker compose config --quiet
docker compose ps
docker compose logs -f backend
docker compose down
```

## License

MIT
