import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Input,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { CheckCircleTwoTone } from "@ant-design/icons";
import { fetchEventDetail, fetchTeam, submitCheckin } from "../api/client";
import { useEventContext } from "../state/eventContext";
import { formatDateTime } from "../utils/time";
import type { CheckpointInfo, TeamDetail, TeamRow } from "../types";

const { Title, Paragraph, Text } = Typography;

export default function CheckinPage() {
  const { events, currentEvent, setCurrentEventId } = useEventContext();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [teamId, setTeamId] = useState<number | undefined>();
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [memberName, setMemberName] = useState<string>("");
  const [cpCode, setCpCode] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const liveEvents = events.filter((e) => e.phase !== "upcoming");

  const loadTeams = useCallback(async (eventId: number) => {
    const detail = await fetchEventDetail(eventId);
    setTeams(detail.teams);
  }, []);

  useEffect(() => {
    if (currentEvent && currentEvent.phase !== "upcoming") {
      loadTeams(currentEvent.id).catch(() => undefined);
    }
  }, [currentEvent, loadTeams]);

  const selectTeam = async (id: number) => {
    setTeamId(id);
    try {
      const detail = await fetchTeam(id);
      setTeam(detail);
      if (detail.event.id !== currentEvent?.id) setCurrentEventId(detail.event.id);
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  const onSubmit = async () => {
    if (!teamId || !memberName || !cpCode) {
      message.warning("请选择队伍、成员并填写 CP 编号");
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitCheckin(teamId, {
        cpCode: cpCode.trim(),
        memberName: memberName.trim(),
      });
      message.success(
        `打卡成功：${result.checkin.cpCode} ${result.checkin.cpName} @ ${formatDateTime(
          result.checkin.time
        )}`
      );
      setCpCode("");
      const detail = await fetchTeam(teamId);
      setTeam(detail);
      if (currentEvent) loadTeams(currentEvent.id);
    } catch (err) {
      // 赛前/截止/非本线路/重复 等拒绝原因直接展示
      message.error({
        content: `打卡被拒绝：${(err as Error).message}`,
        duration: 6,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const finishedCount = team
    ? team.checkpoints.filter((cp) => cp.required && cp.checkedAt).length
    : 0;
  const requiredCount = team ? team.checkpoints.filter((cp) => cp.required).length : 0;

  return (
    <div>
      <Title level={3}>选手 CP 打卡</Title>
      <Paragraph type="secondary">
        任一成员到达点位后提交 CP 编号即可；同一队同一 CP 只保留最早的有效记录。
        赛前、截止后或不在本线路的点位都会被拒绝并说明原因。
      </Paragraph>

      <Space wrap style={{ marginBottom: 16 }}>
        <Text strong>赛事：</Text>
        <Select
          style={{ minWidth: 320 }}
          value={currentEvent && currentEvent.phase !== "upcoming" ? currentEvent.id : undefined}
          onChange={setCurrentEventId}
          placeholder="请选择赛事"
          options={liveEvents.map((e) => ({
            value: e.id,
            label: `${e.name}（${e.phaseLabel}）`,
          }))}
        />
        <Text strong>队伍：</Text>
        <Select
          style={{ minWidth: 240 }}
          showSearch
          optionFilterProp="label"
          value={teamId}
          onChange={selectTeam}
          placeholder="按队伍编号/队名选择"
          options={teams.map((t) => ({
            value: t.id,
            label: `${t.number} ${t.name}（领队 ${t.leaderName}）`,
          }))}
        />
      </Space>

      {team && (
        <Alert
          style={{ marginBottom: 16 }}
          type={team.event.phase === "live" ? "success" : "warning"}
          showIcon
          message={
            team.event.phase === "live"
              ? `比赛进行中（${formatDateTime(team.event.startAt)} ~ ${formatDateTime(
                  team.event.endAt
                )}），可以打卡`
              : "比赛已截止，选手通道关闭；漏打且有凭证请联系裁判补记"
          }
        />
      )}

      <Card title="提交打卡" style={{ marginBottom: 16 }}>
        <Space wrap align="end">
          <div>
            <Text type="secondary">打卡成员</Text>
            <div style={{ marginTop: 4 }}>
              <Select
                style={{ width: 200 }}
                value={memberName || undefined}
                onChange={setMemberName}
                placeholder="选择本人"
                options={team?.members.map((m) => ({ value: m.name, label: m.name })) || []}
                disabled={!team}
              />
            </div>
          </div>
          <div>
            <Text type="secondary">CP 编号</Text>
            <div style={{ marginTop: 4 }}>
              <Input
                style={{ width: 180 }}
                placeholder="如 CP02"
                value={cpCode}
                onChange={(e) => setCpCode(e.target.value.toUpperCase())}
                onPressEnter={onSubmit}
                disabled={!team}
              />
            </div>
          </div>
          <Button type="primary" loading={submitting} onClick={onSubmit} disabled={!team}>
            提交打卡
          </Button>
        </Space>
      </Card>

      {team && (
        <Card
          title={`${team.number} ${team.name} · 点位进度`}
          extra={
            <Space>
              <Text>
                必达 {finishedCount}/{requiredCount}
              </Text>
              {team.finished && <Tag color="gold">已完赛 · {formatDateTime(team.finishTime)}</Tag>}
            </Space>
          }
        >
          <Progress
            percent={requiredCount ? Math.round((finishedCount / requiredCount) * 100) : 0}
            style={{ maxWidth: 480, marginBottom: 16 }}
          />
          <Table<CheckpointInfo>
            size="small"
            pagination={false}
            rowKey="id"
            dataSource={team.checkpoints}
            columns={[
              { title: "#", dataIndex: "seq", width: 50 },
              {
                title: "编号",
                dataIndex: "code",
                render: (v, row) => (
                  <Space>
                    <Text strong>{v}</Text>
                    {!row.required && <Tag>选打</Tag>}
                  </Space>
                ),
              },
              { title: "点位", dataIndex: "name" },
              {
                title: "状态",
                render: (_, row) =>
                  row.checkedAt ? (
                    <Space>
                      <CheckCircleTwoTone twoToneColor="#52c41a" />
                      <Text>{formatDateTime(row.checkedAt)}</Text>
                      {row.source === "裁判补记" && <Tag color="purple">裁判补记</Tag>}
                    </Space>
                  ) : (
                    <Tag color={row.required ? "red" : "default"}>
                      {row.required ? "未打（必达）" : "未打（选打）"}
                    </Tag>
                  ),
              },
              { title: "打卡成员", dataIndex: "memberName", render: (v) => v || "—" },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
