# 城市定向越野活动平台

面向户外运动爱好者，提供定向越野线路设计、团队报名和积分排名的活动平台。

## Docker Compose 快速启动

首次启动前复制环境变量文件：

```bash
cp .env.example .env
docker compose up -d
```

访问地址：

- 前端：http://localhost:28519
- 后端健康检查：http://localhost:29519/health
- API 示例：http://localhost:28519/api/overview

## 项目主要功能

- **周末定向赛工作台（本轮已跑通）**：领队、选手、裁判共用一个页面，四个标签覆盖完整一轮。
  - 领队报名：领队录入队名、联系方式和全部成员（领队自动计入名单），比赛开始后拒绝报名。
  - CP 打卡：开赛后队内任一成员凭姓名或号码布到点提交 CP 编号；赛前、截止后、点位不在本线路、非本队成员一律拒绝并给出原因；同一队同一 CP 只保留最早一条有效记录，重复提交记为 rejected。
  - 排名与缺失：完成全部必达点的队伍按「最后一点时间」排名（打卡顺序不限），未完赛队伍实时列出缺失 CP；页面每 8 秒自动刷新。
  - 裁判台：裁判为漏打且有凭证的队伍补记（须填原因 + 凭证 + 到达时间），补记或撤销后缺失清单与名次立即重算；每一次调整（补记/撤销/时间窗变更）都写入调整日志，可逐条追溯。
- 活动线路设计与发布：管理员在地图上标记起点、终点和打卡点（CP点），设置各点线索和任务，发布活动时注明难度（亲子/成人/专业）、时长和装备要求。
- 线索打卡点（GPS/二维码）：参与者到达打卡点附近（GPS定位）或扫描二维码完成打卡，系统记录到达时间，打卡点可设置答题或拍照任务增加趣味性。
- 团队报名与排名：用户以个人或团队形式报名，活动开始后系统记录各团队完成所有打卡点的总用时，按用时排名生成实时 leaderboard。
- 积分兑换商城：参与活动获得积分，积分可在商城兑换户外装备、活动优惠券或虚拟勋章，激励用户持续参与。
- 历史线路收藏：用户可收藏感兴趣的已结束活动线路，查看其他参与者的成绩和路线轨迹，为下次报名提供参考。

## 赛事 API 一览

所有接口前缀 `/api`（经前端 Nginx/Vite 代理后转发到后端，前缀会被剥离）。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/race/event` | 当前赛事时间窗、状态与本线路 CP 列表 |
| GET | `/api/race/teams` | 队伍、成员与必达点进度 |
| GET | `/api/race/punches` | 最近打卡提交（含被拒绝记录及原因） |
| GET | `/api/race/results` | 实时排名 + 未完赛缺失清单 |
| GET | `/api/race/adjustments` | 裁判调整日志（每次调整都可查） |
| POST | `/api/race/register` | 领队报名：`teamName`、`leaderName`、`members[]` |
| POST | `/api/race/punch` | 选手打卡：`teamId`、`member`、`cpCode`（成功 200，重复 409，其余拒绝 400/404，返回 `code` 与中文 `message`） |
| POST | `/api/race/judge/punch` | 裁判凭证补记：`teamId`、`cpCode`、`arrivalTime`、`reason`、`evidence` |
| POST | `/api/race/judge/revoke` | 撤销一条有效打卡，名次与缺失立即重算 |
| POST | `/api/race/judge/window` | 调整开赛/截止时间（写入调整日志） |

后端容器启动时会自动执行 `migrate`，并在空库时执行 `seed_race` 播种一场处于进行中的周末赛（6 个必达 CP + 1 个选达点 + 1 支示例队），开箱即可开跑；裁判台提供「未开始 / 进行中 / 已截止」快捷切换，方便演示各拒绝场景。

## 本地开发方式

前端：

```bash
cd frontend
npm install
npm run dev
```

后端：

```bash
cd backend
pip install -r requirements.txt
python manage.py runserver 0.0.0.0:29519
```

## 技术栈

| 分层 | 技术 |
| --- | --- |
| 前端 | React 18 + TypeScript、Ant Design、Vite |
| 后端 | Django + Python |
| 数据库 | PostgreSQL |
| 认证 | JWT |
| 依赖 | Django ORM、djangorestframework-simplejwt |

## 项目目录结构

```text
.
├── backend/              # 后端服务
├── database/             # 数据库脚本
├── frontend/             # 前端应用
├── docker-compose.yml    # 一键部署编排
├── .env.example          # 环境变量示例
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
| JWT_SECRET | JWT 签名密钥 | change_me_to_a_long_random_string |
| FRONTEND_PORT | 前端宿主机端口 | 28519 |
| BACKEND_PORT | 后端宿主机端口 | 29519 |
| DB_PORT | 数据库宿主机端口 | 5432 |

## Docker 部署说明

- 使用 `docker compose up -d` 启动，不需要额外传入 `-p`。
- `docker-compose.yml` 顶层已声明 `name: lporienteering`，并且 `.env` 包含 `COMPOSE_PROJECT_NAME=lporienteering`，可在中文目录名下启动。
- 数据库数据保存在命名卷 `db_data` 中，不依赖当前目录名。
- 前端容器由 Nginx 托管静态资源，并把 `/api/` 反向代理到 `backend:29519`。
- 若本地端口冲突，可修改 `.env` 中的 `FRONTEND_PORT`、`BACKEND_PORT`、`DB_PORT`。

常用命令：

```bash
docker compose config --quiet
docker compose ps
docker compose down
```

## License

MIT
