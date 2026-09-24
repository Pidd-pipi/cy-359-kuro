import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { registerTeam } from "../api/client";
import { useEventContext } from "../state/eventContext";
import { formatDateTime } from "../utils/time";
import type { TeamDetail } from "../types";

const { Title, Text, Paragraph } = Typography;

interface RegisterForm {
  number: string;
  name: string;
  leaderName: string;
  contact?: string;
  members: { name: string }[];
}

export default function RegisterPage() {
  const { events, currentEvent, setCurrentEventId, reload } = useEventContext();
  const [form] = Form.useForm<RegisterForm>();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<TeamDetail | null>(null);

  const registerable = useMemo(
    () => events.filter((e) => e.phase === "upcoming"),
    [events]
  );

  const onFinish = async (values: RegisterForm) => {
    if (!currentEvent) return;
    setSubmitting(true);
    try {
      const team = await registerTeam(currentEvent.id, {
        number: values.number,
        name: values.name,
        leaderName: values.leaderName,
        contact: values.contact,
        members: values.members,
      });
      setResult(team);
      message.success(`报名成功！队伍编号 ${team.number}`);
      reload();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (registerable.length === 0) {
    return (
      <div>
        <Title level={3}>领队报名</Title>
        <Empty description="当前没有可报名的赛事（报名仅在赛前开放）" />
      </div>
    );
  }

  return (
    <div>
      <Title level={3}>领队报名 · 录入成员</Title>
      <Paragraph type="secondary">
        赛前由领队统一报名并录入全体成员；比赛开始后任一成员都可凭队伍编号与本人姓名打卡。
      </Paragraph>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Text strong>选择赛事：</Text>
          <Select
            style={{ minWidth: 320 }}
            value={
              registerable.some((e) => e.id === currentEvent?.id)
                ? currentEvent!.id
                : registerable[0].id
            }
            onChange={setCurrentEventId}
            options={registerable.map((e) => ({
              value: e.id,
              label: `${e.name}（开赛 ${formatDateTime(e.startAt)}）`,
            }))}
          />
        </Space>
      </Card>

      {result ? (
        <Card title={<><Tag color="success">报名成功</Tag>{result.number} {result.name}</>}>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={`请记住队伍编号「${result.number}」，比赛开始后到「选手打卡」页提交 CP 编号即可打卡。`}
          />
          <Table
            size="small"
            pagination={false}
            rowKey="id"
            dataSource={result.members}
            columns={[
              { title: "成员", dataIndex: "name" },
              { title: "号码", dataIndex: "number", render: (v) => v || "—" },
            ]}
          />
          <Button style={{ marginTop: 16 }} onClick={() => setResult(null)}>
            再报一队
          </Button>
        </Card>
      ) : (
        <Card title="队伍与成员信息">
          <Form<RegisterForm>
            form={form}
            layout="vertical"
            initialValues={{ members: [{ name: "" }, { name: "" }] }}
            onFinish={onFinish}
          >
            <Space wrap size={16}>
              <Form.Item
                label="队伍编号"
                name="number"
                rules={[{ required: true, message: "请输入队伍编号，如 T04" }]}
              >
                <Input placeholder="如 T04" style={{ width: 160 }} />
              </Form.Item>
              <Form.Item
                label="队名"
                name="name"
                rules={[{ required: true, message: "请输入队名" }]}
              >
                <Input placeholder="如 追风少年" style={{ width: 200 }} />
              </Form.Item>
              <Form.Item
                label="领队姓名"
                name="leaderName"
                rules={[{ required: true, message: "请输入领队姓名" }]}
              >
                <Input placeholder="领队" style={{ width: 160 }} />
              </Form.Item>
              <Form.Item label="联系方式" name="contact">
                <Input placeholder="选填" style={{ width: 180 }} />
              </Form.Item>
            </Space>

            <Form.List name="members">
              {(fields, { add, remove }) => (
                <>
                  <Text strong>成员名单（至少 1 人，可继续添加）</Text>
                  {fields.map((field) => (
                    <Space key={field.key} align="baseline" style={{ display: "flex" }}>
                      <Form.Item
                        {...field}
                        name={[field.name, "name"]}
                        rules={[{ required: true, message: "成员姓名必填" }]}
                      >
                        <Input placeholder={`成员 ${field.name + 1} 姓名`} style={{ width: 260 }} />
                      </Form.Item>
                      {fields.length > 1 && (
                        <Button
                          danger
                          type="text"
                          icon={<DeleteOutlined />}
                          onClick={() => remove(field.name)}
                        />
                      )}
                    </Space>
                  ))}
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={() => add({ name: "" })}
                    style={{ marginBottom: 16 }}
                  >
                    添加成员
                  </Button>
                </>
              )}
            </Form.List>

            <div>
              <Button type="primary" htmlType="submit" loading={submitting}>
                提交报名
              </Button>
            </div>
          </Form>
        </Card>
      )}
    </div>
  );
}
