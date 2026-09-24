-- 周末定向赛数据表（PostgreSQL 参考脚本）
--
-- 正常启动时后端会执行 `python manage.py migrate` 自动建表，
-- 本文件仅作为裸库初始化 / 表结构说明用途，docker-compose 默认不会挂载它。
-- 条件唯一索引 uniq_valid_punch_per_team_cp 保证：
-- 同一支队伍在同一个 CP 只允许存在一条有效打卡（valid）记录，
-- 被拒绝的提交（rejected）不受限制，全部保留用于追溯。

CREATE TABLE IF NOT EXISTS event (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(400) NOT NULL DEFAULT '',
    start_time TIMESTAMPTZ NOT NULL,
    cutoff_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS checkpoint (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    code VARCHAR(24) NOT NULL,
    name VARCHAR(80) NOT NULL,
    clue VARCHAR(255) NOT NULL DEFAULT '',
    required BOOLEAN NOT NULL DEFAULT TRUE,
    "order" INTEGER NOT NULL DEFAULT 0,
    UNIQUE (event_id, code)
);

CREATE TABLE IF NOT EXISTS team (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    leader_name VARCHAR(40) NOT NULL,
    contact VARCHAR(60) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (event_id, name)
);

CREATE TABLE IF NOT EXISTS member (
    id BIGSERIAL PRIMARY KEY,
    team_id BIGINT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
    name VARCHAR(40) NOT NULL,
    number VARCHAR(24) NOT NULL DEFAULT '',
    is_leader BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS punch (
    id BIGSERIAL PRIMARY KEY,
    team_id BIGINT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
    checkpoint_id BIGINT NOT NULL REFERENCES checkpoint(id) ON DELETE CASCADE,
    member_name VARCHAR(40) NOT NULL DEFAULT '',
    source VARCHAR(10) NOT NULL DEFAULT 'member',   -- member=成员打卡 judge=裁判补记
    result VARCHAR(10) NOT NULL DEFAULT 'valid',    -- valid=有效 rejected=已拒绝
    reject_reason VARCHAR(255) NOT NULL DEFAULT '',
    punch_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    judge_reason VARCHAR(255) NOT NULL DEFAULT '',
    evidence VARCHAR(255) NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_valid_punch_per_team_cp
    ON punch (team_id, checkpoint_id)
    WHERE result = 'valid';

CREATE TABLE IF NOT EXISTS adjustment_log (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    team_id BIGINT REFERENCES team(id) ON DELETE SET NULL,
    checkpoint_id BIGINT REFERENCES checkpoint(id) ON DELETE SET NULL,
    kind VARCHAR(16) NOT NULL,                      -- judge_punch / revoke / window
    detail VARCHAR(500) NOT NULL,
    operator VARCHAR(40) NOT NULL DEFAULT '裁判',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
