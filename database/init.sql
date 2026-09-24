-- 城市定向越野活动平台 - 数据库初始化脚本
--
-- 说明：实际表结构由 Django migrations 自动创建（容器启动时执行 migrate）。
-- 本脚本仅用于数据库初始化阶段的占位与人工查阅，字段以 backend/domain/migrations 为准。

-- 赛事
CREATE TABLE IF NOT EXISTS or_event (
  id            BIGSERIAL PRIMARY KEY,
  code          VARCHAR(40) UNIQUE NOT NULL,
  name          VARCHAR(120) NOT NULL,
  difficulty    VARCHAR(16) NOT NULL DEFAULT 'adult',
  description   VARCHAR(500) NOT NULL DEFAULT '',
  start_at      TIMESTAMPTZ NOT NULL,
  end_at        TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 线路 CP 打卡点（required = 必达点）
CREATE TABLE IF NOT EXISTS or_checkpoint (
  id          BIGSERIAL PRIMARY KEY,
  event_id    BIGINT NOT NULL REFERENCES or_event(id) ON DELETE CASCADE,
  code        VARCHAR(20) NOT NULL,
  name        VARCHAR(80) NOT NULL,
  seq         INTEGER NOT NULL DEFAULT 1,
  clue        VARCHAR(300) NOT NULL DEFAULT '',
  required    BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (event_id, code)
);

-- 报名队伍
CREATE TABLE IF NOT EXISTS or_team (
  id              BIGSERIAL PRIMARY KEY,
  event_id        BIGINT NOT NULL REFERENCES or_event(id) ON DELETE CASCADE,
  number          VARCHAR(20) NOT NULL,
  name            VARCHAR(100) NOT NULL,
  leader_name     VARCHAR(60) NOT NULL,
  contact         VARCHAR(60) NOT NULL DEFAULT '',
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finish_time     TIMESTAMPTZ,
  UNIQUE (event_id, number)
);

-- 队伍成员
CREATE TABLE IF NOT EXISTS or_member (
  id        BIGSERIAL PRIMARY KEY,
  team_id   BIGINT NOT NULL REFERENCES or_team(id) ON DELETE CASCADE,
  name      VARCHAR(60) NOT NULL,
  number    VARCHAR(20) NOT NULL DEFAULT ''
);

-- 有效打卡记录（同一队同一 CP 唯一，选手保留最早；裁判补记同为一条）
CREATE TABLE IF NOT EXISTS or_checkin (
  id             BIGSERIAL PRIMARY KEY,
  team_id        BIGINT NOT NULL REFERENCES or_team(id) ON DELETE CASCADE,
  checkpoint_id  BIGINT NOT NULL REFERENCES or_checkpoint(id) ON DELETE CASCADE,
  member_id      BIGINT REFERENCES or_member(id) ON DELETE SET NULL,
  adjustment_id  BIGINT UNIQUE,
  time           TIMESTAMPTZ NOT NULL,
  source         VARCHAR(16) NOT NULL DEFAULT 'member',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, checkpoint_id)
);

-- 裁判补记 / 撤销审计流水
CREATE TABLE IF NOT EXISTS or_adjustment (
  id             BIGSERIAL PRIMARY KEY,
  event_id       BIGINT NOT NULL REFERENCES or_event(id) ON DELETE CASCADE,
  team_id        BIGINT NOT NULL REFERENCES or_team(id) ON DELETE CASCADE,
  checkpoint_id  BIGINT NOT NULL REFERENCES or_checkpoint(id) ON DELETE CASCADE,
  member_name    VARCHAR(60) NOT NULL DEFAULT '',
  action         VARCHAR(16) NOT NULL DEFAULT 'backfill',
  reason         VARCHAR(500) NOT NULL,
  evidence       VARCHAR(500) NOT NULL DEFAULT '',
  checkin_time   TIMESTAMPTZ,
  operator       VARCHAR(60) NOT NULL DEFAULT '裁判',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
