import { Descriptions, Space, Tag, Typography } from "antd";
import { useRace } from "../../state/race";
import { formatTime, STATUS_COLOR } from "../../utils/time";

export function RaceHeader() {
  const { event, results, teams } = useRace();
  if (!event) {
    return null;
  }

  const finishedCount = results?.leaderboard.length ?? 0;

  return (
    <div className="race-header">
      <Space align="center" wrap>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {event.name}
        </Typography.Title>
        <Tag color={STATUS_COLOR[event.status]}>{event.statusLabel}</Tag>
      </Space>
      <Typography.Paragraph type="secondary" style={{ margin: "8px 0 0" }}>
        {event.description}
      </Typography.Paragraph>
      <Descriptions size="small" column={{ xs: 1, sm: 2, md: 4 }} style={{ marginTop: 8 }}>
        <Descriptions.Item label="开赛时间">{formatTime(event.startTime, false)}</Descriptions.Item>
        <Descriptions.Item label="打卡截止">{formatTime(event.cutoffTime, false)}</Descriptions.Item>
        <Descriptions.Item label="报名队伍">{teams.length} 支</Descriptions.Item>
        <Descriptions.Item label="已完赛">{finishedCount} 支</Descriptions.Item>
      </Descriptions>
    </div>
  );
}
