import { useState } from "react";
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Popconfirm,
  Progress,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import { DeleteOutlined, PlusOutlined, TeamOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { raceApi } from "../../api/client";
import { useRace } from "../../state/race";
import type { Member, Team } from "../../types";
import { formatTime } from "../../utils/time";

interface MemberFormRow {
  name: string;
  number?: string;
}

export function LeaderTab() {
  const { teams, event, refreshAll } = useRace();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const registrationOpen = event?.status === "upcoming";

  const onFinish = async (values: {
    teamName: string;
    leaderName: string;
    contact?: string;
    members?: MemberFormRow[];
  }) => {
    const members = (values.members ?? []).filter((row) => row?.name?.trim());
    setSubmitting(true);
    try {
      const resp = await raceApi.register({
        teamName: values.teamName.trim(),
        leaderName: values.leaderName.trim(),
        contact: values.contact?.trim(),
        members,
      });
      messageApi.success(`报名成功：${resp.team.name}（${resp.team.members.length} 名成员已录入）`);
      form.resetFields();
      await refreshAll();
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "报名失败");
    } finally {
      setSubmitting(false);
    }
  };

  const memberColumns: ColumnsType<Member> = [
    {
      title: "成员",
      dataIndex: "name",
      render: (name: string, row) => (
        <Space>
          {name}
          {row.isLeader && <Tag color="blue">领队</Tag>}
        </Space>
      ),
    },
    { title: "号码布", dataIndex: "number", render: (v: string) => v || "—", width: 120 },
  ];

  const teamColumns: ColumnsType<Team> = [
    {
      title: "队伍",
      dataIndex: "name",
      render: (name, row) => (
        <Space>
          <TeamOutlined />
          <strong>{name}</strong>
          {row.finished && <Tag color="green">已完赛</Tag>}
        </Space>
      ),
    },
    { title: "领队", dataIndex: "leaderName", width: 120 },
    {
      title: "成员",
      dataIndex: "members",
      render: (members: Member[]) =>
        members.map((m) => m.name).join("、") + `（${members.length} 人）`,
    },
    {
      title: "必达进度",
      key: "progress",
      width: 200,
      render: (_, row) => (
        <Progress
          percent={row.requiredTotal ? Math.round((row.punchedCount / row.requiredTotal) * 100) : 0}
          size="small"
          format={() => `${row.punchedCount}/${row.requiredTotal}`}
        />
      ),
    },
    { title: "报名时间", dataIndex: "createdAt", width: 150, render: (v: string) => formatTime(v, false) },
  ];

  return (
    <div className="race-grid">
      {contextHolder}
      <Card
        title="领队报名"
        extra={
          registrationOpen ? (
            <Tag color="green">报名中</Tag>
          ) : (
            <Tag color="red">比赛开始，报名已截止</Tag>
          )
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ members: [{ name: "", number: "" }] }}
          disabled={!registrationOpen}
        >
          <Form.Item
            label="队名"
            name="teamName"
            rules={[{ required: true, message: "请输入队名（同赛事不可重复）" }]}
          >
            <Input placeholder="如：疾风小队" maxLength={80} />
          </Form.Item>
          <Space size="large" align="start" style={{ display: "flex" }}>
            <Form.Item
              label="领队姓名"
              name="leaderName"
              style={{ flex: 1 }}
              rules={[{ required: true, message: "请输入领队姓名" }]}
            >
              <Input placeholder="领队自动计入成员" maxLength={40} />
            </Form.Item>
            <Form.Item label="联系方式" name="contact" style={{ flex: 1 }}>
              <Input placeholder="手机号（选填）" maxLength={60} />
            </Form.Item>
          </Space>

          <Form.List name="members">
            {(fields, { add, remove }) => (
              <div className="member-editor">
                <div className="member-editor-head">
                  <span>成员名单（至少含领队，可只填姓名）</span>
                  <Button
                    type="dashed"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => add({ name: "", number: "" })}
                  >
                    添加成员
                  </Button>
                </div>
                {fields.map((field) => (
                  <Space key={field.key} align="baseline" className="member-row">
                    <Form.Item
                      name={[field.name, "name"]}
                      rules={[{ required: true, message: "姓名" }]}
                      style={{ marginBottom: 8, width: 160 }}
                    >
                      <Input placeholder="成员姓名" maxLength={40} />
                    </Form.Item>
                    <Form.Item name={[field.name, "number"]} style={{ marginBottom: 8, width: 140 }}>
                      <Input placeholder="号码布（选填）" maxLength={24} />
                    </Form.Item>
                    <Popconfirm title="移除该成员？" onConfirm={() => remove(field.name)}>
                      <Button danger type="text" icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                ))}
              </div>
            )}
          </Form.List>

          <Button type="primary" htmlType="submit" loading={submitting} disabled={!registrationOpen}>
            提交报名
          </Button>
        </Form>
      </Card>

      <Card title={`已报名队伍（${teams.length}）`}>
        {teams.length === 0 ? (
          <Empty description="还没有队伍报名" />
        ) : (
          <Table
            rowKey="id"
            columns={teamColumns}
            dataSource={teams}
            pagination={false}
            expandable={{
              expandedRowRender: (team: Team) => (
                <Table
                  rowKey="id"
                  size="small"
                  columns={memberColumns}
                  dataSource={team.members}
                  pagination={false}
                />
              ),
            }}
          />
        )}
      </Card>
    </div>
  );
}
