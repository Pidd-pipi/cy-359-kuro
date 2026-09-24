import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import { AuditOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs, { Dayjs } from "dayjs";
import { raceApi } from "../../api/client";
import { useRace } from "../../state/race";
import type { Adjustment, Punch } from "../../types";
import { formatTime } from "../../utils/time";

const { RangePicker } = DatePicker;

export function JudgeTab() {
  const { teams, checkpoints, results, adjustments, event, refreshResults } = useRace();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [windowSubmitting, setWindowSubmitting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const missingMap = useMemo(() => {
    const map = new Map<number, Set<string>>();
    results?.missing.forEach((row) => {
      map.set(row.teamId, new Set(row.missingCps.map((cp) => cp.code)));
    });
    return map;
  }, [results]);

  const watchedTeamId = Form.useWatch("teamId", form) as number | undefined;
  const cpOptions = useMemo(() => {
    const team = teams.find((t) => t.id === watchedTeamId);
    const validSet = new Set((team?.punches ?? []).filter((p) => p.accepted).map((p) => p.cpCode));
    const missingSet = watchedTeamId ? missingMap.get(watchedTeamId) : undefined;
    return checkpoints
      .filter((cp) => cp.required)
      .map((cp) => {
        const isMissing = missingSet?.has(cp.code);
        const label = isMissing
          ? `${cp.code} ${cp.name}（缺失中）`
          : validSet.has(cp.code)
            ? `${cp.code} ${cp.name}（已有有效打卡）`
            : `${cp.code} ${cp.name}`;
        return { value: cp.code, label, disabled: validSet.has(cp.code) };
      });
  }, [checkpoints, teams, watchedTeamId, missingMap]);

  const onJudgeFinish = async (values: {
    teamId: number;
    cpCode: string;
    arrival: Dayjs;
    reason: string;
    evidence: string;
  }) => {
    setSubmitting(true);
    try {
      const resp = await raceApi.judgePunch({
        teamId: values.teamId,
        cpCode: values.cpCode,
        arrivalTime: values.arrival.toISOString(),
        reason: values.reason.trim(),
        evidence: values.evidence.trim(),
      });
      messageApi.success(resp.message);
      form.resetFields(["cpCode", "reason", "evidence"]);
      await refreshResults();
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "补记失败");
    } finally {
      setSubmitting(false);
    }
  };

  const onRevoke = async (punchId: number) => {
    try {
      const resp = await raceApi.judgeRevoke({ punchId });
      messageApi.success(resp.message);
      await refreshResults();
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "撤销失败");
    }
  };

  const setWindow = async (kind: "upcoming" | "ongoing" | "closed") => {
    const now = dayjs();
    const start = kind === "upcoming" ? now.add(1, "hour") : now.subtract(1, "hour");
    const cutoff =
      kind === "closed" ? now.subtract(5, "minute") : now.add(3, "hour");
    setWindowSubmitting(true);
    try {
      const resp = await raceApi.setWindow({
        startTime: start.toISOString(),
        cutoffTime: cutoff.toISOString(),
      });
      messageApi.success(`${resp.message}（${resp.event.statusLabel}）`);
      await refreshResults();
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "时间调整失败");
    } finally {
      setWindowSubmitting(false);
    }
  };

  const onRangeApply = async (range: [Dayjs, Dayjs] | null) => {
    if (!range) {
      return;
    }
    try {
      const resp = await raceApi.setWindow({
        startTime: range[0].toISOString(),
        cutoffTime: range[1].toISOString(),
      });
      messageApi.success(resp.message);
      await refreshResults();
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "时间调整失败");
    }
  };

  const punchColumns: ColumnsType<Punch> = [
    { title: "队伍", dataIndex: "teamName", width: 120 },
    { title: "CP", dataIndex: "cpCode", width: 80 },
    { title: "点位", dataIndex: "cpName" },
    {
      title: "来源",
      dataIndex: "source",
      width: 100,
      render: (s: Punch["source"]) => (
        <Tag color={s === "judge" ? "orange" : "default"}>
          {s === "judge" ? "裁判补记" : "成员打卡"}
        </Tag>
      ),
    },
    {
      title: "凭证 / 补记原因",
      key: "evidence",
      render: (_, row) =>
        row.source === "judge" ? (
          <Space direction="vertical" size={0}>
            <span>{row.evidence}</span>
            <Tag color="orange">{row.judgeReason}</Tag>
          </Space>
        ) : (
          "—"
        ),
    },
    { title: "到达时间", dataIndex: "punchTime", width: 120, render: (v: string) => formatTime(v) },
    {
      title: "操作",
      key: "action",
      width: 90,
      render: (_, row) => (
        <Popconfirm
          title="撤销这条有效打卡？"
          description="撤销后排名与缺失清单立即重算，并写入调整日志。"
          onConfirm={() => onRevoke(row.id)}
        >
          <Button size="small" danger>
            撤销
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const validPunches: Punch[] = useMemo(
    () =>
      teams
        .flatMap((t) => t.punches)
        .filter((p) => p.accepted)
        .sort((a, b) => (a.punchTime < b.punchTime ? 1 : -1)),
    [teams],
  );

  const logColumns: ColumnsType<Adjustment> = [
    {
      title: "时间",
      dataIndex: "createdAt",
      width: 150,
      render: (v: string) => formatTime(v),
    },
    {
      title: "类型",
      dataIndex: "kindLabel",
      width: 110,
      render: (label: string, row) => (
        <Tag color={row.kind === "judge_punch" ? "orange" : row.kind === "revoke" ? "red" : "blue"}>
          {label}
        </Tag>
      ),
    },
    { title: "对象", key: "target", width: 160, render: (_, row) =>
      [row.teamName, row.cpCode].filter(Boolean).join(" · ") || "全场赛事" },
    { title: "调整内容", dataIndex: "detail" },
    { title: "裁判", dataIndex: "operator", width: 90 },
  ];

  return (
    <div>
      {contextHolder}
      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        icon={<AuditOutlined />}
        message="裁判台用于为「漏打且有凭证」的队伍补记有效打卡；每次补记、撤销都会留痕，缺失清单和名次立即重算。"
      />

      <Row gutter={16}>
        <Col xs={24} lg={10}>
          <Card title="凭证补记" style={{ marginBottom: 16 }}>
            <Form form={form} layout="vertical" onFinish={onJudgeFinish}>
              <Form.Item label="队伍" name="teamId" rules={[{ required: true, message: "请选择队伍" }]}>
                <Select
                  placeholder="选择漏打的队伍"
                  options={teams.map((t) => ({
                    value: t.id,
                    label: `${t.name}（${t.punchedCount}/${t.requiredTotal}）`,
                  }))}
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
              <Form.Item label="CP 编号" name="cpCode" rules={[{ required: true, message: "请选择 CP" }]}>
                <Select
                  placeholder="选择要补记的 CP"
                  options={cpOptions}
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
              <Form.Item
                label="凭证上的到达时间"
                name="arrival"
                rules={[{ required: true, message: "请选择凭证上的到达时间" }]}
                extra={`须在赛事时间窗内：${formatTime(event?.startTime)} ~ ${formatTime(event?.cutoffTime)}`}
              >
                <DatePicker showTime style={{ width: "100%" }} placeholder="选择到达时间" />
              </Form.Item>
              <Form.Item label="漏打原因" name="reason" rules={[{ required: true, message: "请填写漏打原因" }]}>
                <Input.TextArea rows={2} placeholder="如：打卡设备没电 / 二维码牌脱落" maxLength={255} />
              </Form.Item>
              <Form.Item
                label="凭证说明"
                name="evidence"
                rules={[{ required: true, message: "请填写凭证（照片编号 / 证人等）" }]}
              >
                <Input.TextArea rows={2} placeholder="如：IMG_2031.jpg 合影含点位背景" maxLength={255} />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={submitting} block>
                确认补记并重算
              </Button>
            </Form>
          </Card>

          <Card title="赛事时间窗（演示用）" size="small">
            <Space wrap style={{ marginBottom: 12 }}>
              <Button size="small" loading={windowSubmitting} onClick={() => setWindow("upcoming")}>
                切到「未开始」
              </Button>
              <Button size="small" loading={windowSubmitting} onClick={() => setWindow("ongoing")}>
                切到「进行中」
              </Button>
              <Button size="small" danger loading={windowSubmitting} onClick={() => setWindow("closed")}>
                切到「已截止」
              </Button>
            </Space>
            <RangePicker
              showTime
              format="MM-DD HH:mm"
              onChange={(range) => {
                if (range && range[0] && range[1]) {
                  onRangeApply([range[0], range[1]]);
                }
              }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card title="有效打卡（可纠错撤销）" style={{ marginBottom: 16 }}>
            <Table
              rowKey="id"
              size="small"
              columns={punchColumns}
              dataSource={validPunches}
              pagination={{ pageSize: 6 }}
              locale={{ emptyText: <Empty description="暂无有效打卡" /> }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="调整日志（每一次调整都可追溯）">
        <Table
          rowKey="id"
          size="small"
          columns={logColumns}
          dataSource={adjustments}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description="暂无调整记录" /> }}
        />
      </Card>
    </div>
  );
}
