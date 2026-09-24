import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
  message,
} from "antd";
import { CheckCircleFilled, CloseCircleFilled } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { raceApi } from "../../api/client";
import { useRace } from "../../state/race";
import type { ActionResponse, Punch } from "../../types";
import { formatClock, formatTime } from "../../utils/time";

interface PunchFeedback {
  accepted: boolean;
  message: string;
  punch?: Punch;
}

export function RunnerTab() {
  const { teams, checkpoints, punches, event, refreshResults } = useRace();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<PunchFeedback | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const [selectedTeamId, setSelectedTeamId] = useState<number | undefined>();

  useEffect(() => {
    if (!selectedTeamId && teams.length > 0) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === selectedTeamId),
    [teams, selectedTeamId],
  );

  const ongoing = event?.status === "ongoing";

  const onFinish = async (values: { teamId: number; member: string; cpCode: string }) => {
    setSubmitting(true);
    setFeedback(null);
    try {
      const resp: ActionResponse = await raceApi.punch({
        teamId: values.teamId,
        member: values.member.trim(),
        cpCode: values.cpCode.trim(),
      });
      setFeedback({ accepted: true, message: resp.message, punch: resp.punch });
      messageApi.success(resp.message);
      form.setFieldValue("cpCode", "");
    } catch (err) {
      const e = err as Error & { payload?: ActionResponse };
      // 409 重复打卡：后端同时返回了被拒绝的记录，界面明确展示原因
      const punch = e.payload?.punch;
      setFeedback({
        accepted: false,
        message: e.message,
        punch,
      });
      messageApi.error(e.message);
    } finally {
      setSubmitting(false);
      refreshResults();
    }
  };

  const punchColumns: ColumnsType<Punch> = [
    {
      title: "结果",
      dataIndex: "accepted",
      width: 90,
      render: (accepted: boolean) =>
        accepted ? (
          <Tag icon={<CheckCircleFilled />} color="success">
            有效
          </Tag>
        ) : (
          <Tag icon={<CloseCircleFilled />} color="error">
            拒绝
          </Tag>
        ),
    },
    { title: "队伍", dataIndex: "teamName", width: 120 },
    { title: "CP", dataIndex: "cpCode", width: 90 },
    { title: "点位", dataIndex: "cpName" },
    { title: "提交人", dataIndex: "memberName", width: 100, render: (v: string) => v || "—" },
    {
      title: "到达时间",
      dataIndex: "punchTime",
      width: 100,
      render: (v: string) => formatClock(v),
    },
    {
      title: "说明 / 拒绝原因",
      key: "reason",
      render: (_, row) =>
        row.accepted ? (
          <Space size={4}>
            <Tag>{row.sourceLabel}</Tag>
            {row.judgeReason && <Typography.Text type="secondary">{row.judgeReason}</Typography.Text>}
          </Space>
        ) : (
          <Typography.Text type="danger">{row.rejectReason}</Typography.Text>
        ),
    },
    { title: "提交时间", dataIndex: "createdAt", width: 110, render: (v: string) => formatTime(v) },
  ];

  return (
    <div className="race-grid">
      {contextHolder}
      <Card
        title="到点打卡"
        extra={
          ongoing ? <Tag color="green">打卡通道开放</Tag> : <Tag color="red">{event?.statusLabel}，禁止打卡</Tag>
        }
      >
        {!ongoing && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message={
              event?.status === "upcoming"
                ? "比赛尚未开始，提交将被拒绝并记录原因。"
                : "打卡已截止，现场通道关闭；漏打请联系裁判凭凭证补记。"
            }
          />
        )}
        <Form form={form} layout="vertical" onFinish={onFinish} onValuesChange={() => setFeedback(null)}>
          <Form.Item label="选择队伍" name="teamId" rules={[{ required: true, message: "请选择队伍" }]}>
            <Select
              placeholder="选择你的队伍"
              value={selectedTeamId}
              onChange={(v) => {
                setSelectedTeamId(v);
                form.setFieldValue("member", undefined);
              }}
              options={teams.map((t) => ({
                value: t.id,
                label: `${t.name}（领队 ${t.leaderName}）`,
              }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item
            label="打卡成员（姓名或号码布，须为本队成员）"
            name="member"
            rules={[{ required: true, message: "请选择或输入队内成员" }]}
          >
            <AutoCompleteMember
              members={selectedTeam?.members ?? []}
              disabled={!selectedTeam}
            />
          </Form.Item>
          <Form.Item
            label="CP 点位编号（现场扫码或按牌面输入）"
            name="cpCode"
            rules={[{ required: true, message: "请输入 CP 编号，如 CP01" }]}
          >
            <Input placeholder="如 CP01" allowClear autoComplete="off" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting} block>
            提交打卡
          </Button>
        </Form>

        {feedback && (
          <Alert
            style={{ marginTop: 16 }}
            type={feedback.accepted ? "success" : "error"}
            showIcon
            message={feedback.accepted ? "打卡成功" : "打卡被拒绝"}
            description={
              <Space direction="vertical" size={2}>
                <span>{feedback.message}</span>
                {feedback.punch && (
                  <Typography.Text type="secondary">
                    {feedback.punch.cpCode} · {feedback.punch.cpName} · 到达 {formatClock(feedback.punch.punchTime)}
                  </Typography.Text>
                )}
              </Space>
            }
          />
        )}
      </Card>

      <Card title="本线路 CP 点位">
        {checkpoints.length === 0 ? (
          <Empty />
        ) : (
          <Timeline
            items={checkpoints.map((cp) => ({
              color: cp.required ? "red" : "gray",
              children: (
                <Space direction="vertical" size={0}>
                  <Space>
                    <strong>{cp.code}</strong>
                    <span>{cp.name}</span>
                    {cp.required ? <Tag color="red">必达</Tag> : <Tag>选达</Tag>}
                  </Space>
                  <Typography.Text type="secondary">{cp.clue}</Typography.Text>
                </Space>
              ),
            }))}
          />
        )}
      </Card>

      <Card title="最近提交（含被拒绝记录）" style={{ gridColumn: "1 / -1" }}>
        <Table
          rowKey="id"
          size="small"
          columns={punchColumns}
          dataSource={punches}
          pagination={{ pageSize: 12 }}
          locale={{ emptyText: <Empty description="还没有任何打卡提交" /> }}
        />
      </Card>
    </div>
  );
}

function AutoCompleteMember({
  members,
  disabled,
}: {
  members: { id: number; name: string; number: string; isLeader: boolean }[];
  disabled?: boolean;
}) {
  // AutoComplete 支持自由输入：可选名单，也可直接输入姓名/号码布
  const options = members.flatMap((m) => {
    const rows = [{ value: m.name }];
    if (m.number) {
      rows.push({ value: m.number });
    }
    return rows;
  });
  return (
    <AutoComplete
      options={options}
      disabled={disabled}
      placeholder="选择成员，或直接输入姓名 / 号码布"
      filterOption={(input, option) =>
        (option?.value ?? "").toLowerCase().includes(input.toLowerCase())
      }
    />
  );
}
