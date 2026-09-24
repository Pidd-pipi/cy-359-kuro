import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import dayjs, { Dayjs } from "dayjs";
import {
  backfillCheckin,
  fetchAdjustments,
  fetchEventDetail,
  revokeAdjustment,
} from "../api/client";
import { useEventContext } from "../state/eventContext";
import { formatDateTime } from "../utils/time";
import type { AdjustmentInfo, TeamRow } from "../types";

const { Title, Paragraph, Text } = Typography;

interface BackfillForm {
  teamId: number;
  cpCode: string;
  memberName?: string;
  checkinTime: Dayjs;
  reason: string;
  evidence: string;
  operator?: string;
}

export default function RefereePage() {
  const { events, currentEvent, setCurrentEventId } = useEventContext();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [logs, setLogs] = useState<AdjustmentInfo[]>([]);
  const [form] = Form.useForm<BackfillForm>();
  const [submitting, setSubmitting] = useState(false);

  const loadTeams = useCallback(async (eventId: number) => {
    const detail = await fetchEventDetail(eventId);
    setTeams(detail.teams);
  }, []);

  const loadLogs = useCallback(async (eventId?: number) => {
    const data = await fetchAdjustments(eventId ? { eventId } : undefined);
    setLogs(data.adjustments);
  }, []);

  useEffect(() => {
    if (currentEvent) {
      loadTeams(currentEvent.id).catch(() => undefined);
      loadLogs(currentEvent.id).catch(() => undefined);
    }
  }, [currentEvent, loadTeams, loadLogs]);

  const onBackfill = async (values: BackfillForm) => {
    setSubmitting(true);
    try {
      const result = await backfillCheckin({
        teamId: values.teamId,
        cpCode: values.cpCode.trim().toUpperCase(),
        memberName: values.memberName?.trim(),
        checkinTime: values.checkinTime.format("YYYY-MM-DDTHH:mm:ss"),
        reason: values.reason.trim(),
        evidence: values.evidence.trim(),
        operator: values.operator?.trim() || "裁判",
      });
      message.success(result.message);
      form.resetFields(["cpCode", "memberName", "reason", "evidence"]);
      if (currentEvent) {
        loadTeams(currentEvent.id);
        loadLogs(currentEvent.id);
      }
    } catch (err) {
      message.error({ content: `补记被拒绝：${(err as Error).message}`, duration: 6 });
    } finally {
      setSubmitting(false);
    }
  };

  const onRevoke = async (record: AdjustmentInfo) => {
    try {
      const result = await revokeAdjustment(record.id, {
        reason: "凭证复核后撤销",
        operator: form.getFieldValue("operator") || "裁判",
      });
      message.success(result.message);
      if (currentEvent) {
        loadTeams(currentEvent.id);
        loadLogs(currentEvent.id);
      }
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  const selectedTeamId = Form.useWatch("teamId", form);
  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  return (
    <div>
      <Title level={3}>裁判补记与调整记录</Title>
      <Paragraph type="secondary">
        对漏打但持有凭证（照片/签字单等）的队伍补记实际到点时间与原因后，
        缺失清单和名次立刻重算；每一次补记与撤销都会留痕，可在此页逐条查询。
      </Paragraph>

      <Space style={{ marginBottom: 16 }}>
        <Text strong>赛事：</Text>
        <Select
          style={{ minWidth: 360 }}
          value={currentEvent?.id}
          onChange={setCurrentEventId}
          options={events.map((e) => ({
            value: e.id,
            label: `${e.name}（${e.phaseLabel}）`,
          }))}
        />
      </Space>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="补记仅限本线路 CP，且该队该 CP 当前没有任何有效记录；选手重复打卡不能用补记覆盖（只保留最早一条）。"
      />

      <Card title="补记漏打" style={{ marginBottom: 16 }}>
        <Form<BackfillForm>
          form={form}
          layout="vertical"
          initialValues={{ checkinTime: dayjs() }}
          onFinish={onBackfill}
        >
          <Space wrap size={16} align="end">
            <Form.Item
              label="队伍"
              name="teamId"
              rules={[{ required: true, message: "请选择队伍" }]}
            >
              <Select
                style={{ width: 280 }}
                showSearch
                optionFilterProp="label"
                placeholder="选择漏打的队伍"
                options={teams.map((t) => ({
                  value: t.id,
                  label: `${t.number} ${t.name}（缺 ${t.missingCount} 点）`,
                }))}
              />
            </Form.Item>
            <Form.Item
              label="CP 编号"
              name="cpCode"
              rules={[{ required: true, message: "请填写 CP 编号" }]}
            >
              <Input placeholder="如 CP02" style={{ width: 140 }} />
            </Form.Item>
            <Form.Item label="实际到点成员" name="memberName">
              <Input placeholder="选填" style={{ width: 140 }} />
            </Form.Item>
            <Form.Item
              label="实际到点时间"
              name="checkinTime"
              rules={[{ required: true, message: "请选择实际到点时间" }]}
            >
              <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" style={{ width: 220 }} />
            </Form.Item>
            <Form.Item label="操作裁判" name="operator">
              <Input placeholder="默认：裁判" style={{ width: 140 }} />
            </Form.Item>
          </Space>
          <Space wrap size={16} align="start">
            <Form.Item
              label="补记原因"
              name="reason"
              style={{ flex: 1, minWidth: 280 }}
              rules={[{ required: true, message: "必须填写补记原因" }]}
            >
              <Input.TextArea rows={2} placeholder="如：扫码设备故障，队员在打卡牌前拍照留证" />
            </Form.Item>
            <Form.Item
              label="凭证说明（照片编号 / 签字单号等）"
              name="evidence"
              style={{ flex: 1, minWidth: 280 }}
              rules={[{ required: true, message: "必须填写凭证说明" }]}
            >
              <Input.TextArea rows={2} placeholder="如：照片 IMG_2030/31/32 + 裁判员签字单 #07" />
            </Form.Item>
          </Space>
          {selectedTeam && (
            <Text type="secondary">
              当前进度：{selectedTeam.checkedCount}/{selectedTeam.requiredCount} 必达，
              缺失 {selectedTeam.missingCount} 点；
              {selectedTeam.finished ? "该队已完赛。" : "补记后名次将立即重算。"}
            </Text>
          )}
          <div style={{ marginTop: 12 }}>
            <Button type="primary" htmlType="submit" loading={submitting}>
              提交补记并立即重算
            </Button>
          </div>
        </Form>
      </Card>

      <Card title={`调整记录（${logs.length}）`}>
        <Table<AdjustmentInfo>
          size="small"
          pagination={{ pageSize: 8 }}
          rowKey="id"
          dataSource={logs}
          columns={[
            {
              title: "操作",
              dataIndex: "action",
              width: 100,
              render: (action: string) => (
                <Tag color={action === "backfill" ? "purple" : "default"}>
                  {action === "backfill" ? "补记" : "撤销"}
                </Tag>
              ),
            },
            { title: "时间", dataIndex: "createdAt", render: formatDateTime, width: 170 },
            { title: "队伍", render: (_, r) => `${r.teamNumber} ${r.teamName}`, width: 140 },
            { title: "CP", render: (_, r) => `${r.cpCode} ${r.cpName}`, width: 140 },
            { title: "成员", dataIndex: "memberName", width: 90 },
            { title: "认定到点时间", dataIndex: "checkinTime", render: formatDateTime, width: 170 },
            { title: "原因", dataIndex: "reason" },
            { title: "凭证", dataIndex: "evidence" },
            { title: "裁判", dataIndex: "operator", width: 100 },
            {
              title: "操作",
              width: 90,
              render: (_, record) =>
                record.action === "backfill" ? (
                  <Popconfirm
                    title="撤销该补记？"
                    description="删除对应打卡并重算缺失清单与名次，撤销动作同样留痕。"
                    onConfirm={() => onRevoke(record)}
                  >
                    <Button size="small" danger>
                      撤销
                    </Button>
                  </Popconfirm>
                ) : (
                  <Text type="secondary">—</Text>
                ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
