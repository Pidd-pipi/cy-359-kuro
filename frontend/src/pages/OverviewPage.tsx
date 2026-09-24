import { useEffect, useState } from "react";
import { Alert, Card, Col, Descriptions, Row, Spin, Tag, Typography } from "antd";
import {
  ClockCircleOutlined,
  EnvironmentOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { fetchOverview } from "../api/client";
import { PHASE_COLOR } from "../constants/messages";
import type { EventSummary } from "../types";
import { formatDateTime } from "../utils/time";
import { useEventContext } from "../state/eventContext";

const { Title, Paragraph, Text } = Typography;

export default function OverviewPage() {
  const { events, loading, reload } = useEventContext();
  const [serverTime, setServerTime] = useState<string>("");
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchOverview()
      .then((data) => setServerTime(data.serverTime))
      .catch(() => setError(true));
  }, []);

  if (loading && events.length === 0) return <Spin size="large" style={{ marginTop: 80 }} />;

  return (
    <div>
      <Title level={3}>周末定向赛 · 总览</Title>
      <Paragraph type="secondary">
        领队报名、选手 CP 打卡、裁判补记与赛后排名已全部打通；服务器当前时间：
        <Text strong> {formatDateTime(serverTime)}</Text>（所有打卡以服务端时间为准）
      </Paragraph>
      {error && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="后端服务暂不可达，请稍后重试"
          action={<a onClick={reload}>重新加载</a>}
        />
      )}

      <Row gutter={[16, 16]}>
        {events.map((event: EventSummary) => (
          <Col xs={24} md={12} key={event.id}>
            <Card
              hoverable
              title={
                <span>
                  <Tag color={PHASE_COLOR[event.phase]}>{event.phaseLabel}</Tag>
                  {event.name}
                </span>
              }
            >
              <Descriptions column={1} size="small">
                <Descriptions.Item label="难度">{event.difficulty}</Descriptions.Item>
                <Descriptions.Item label={<ClockCircleOutlined />}>
                  {formatDateTime(event.startAt)} ~ {formatDateTime(event.endAt)}
                </Descriptions.Item>
                <Descriptions.Item label={<EnvironmentOutlined />}>
                  必达点 {event.requiredCount} 个
                </Descriptions.Item>
                <Descriptions.Item label={<TeamOutlined />}>
                  已报名 {event.teamCount} 队
                </Descriptions.Item>
              </Descriptions>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                {event.description}
              </Paragraph>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
