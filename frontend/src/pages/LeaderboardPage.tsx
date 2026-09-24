import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Card,
  Empty,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import { CrownTwoTone } from "@ant-design/icons";
import { fetchLeaderboard } from "../api/client";
import { useEventContext } from "../state/eventContext";
import { formatDateTime, formatDuration } from "../utils/time";
import type { LeaderboardResponse, MissingRow, RankingRow } from "../types";

const { Title, Paragraph, Text } = Typography;

export default function LeaderboardPage() {
  const { events, currentEvent, setCurrentEventId } = useEventContext();
  const [data, setData] = useState<LeaderboardResponse | null>(null);

  const load = useCallback(async (eventId: number) => {
    setData(await fetchLeaderboard(eventId));
  }, []);

  useEffect(() => {
    if (currentEvent) load(currentEvent.id).catch(() => undefined);
  }, [currentEvent, load]);

  // 页面可见时定时刷新（裁判补记后也能立刻看到最新名次）
  useEffect(() => {
    if (!currentEvent) return;
    const timer = setInterval(() => load(currentEvent.id).catch(() => undefined), 10000);
    return () => clearInterval(timer);
  }, [currentEvent, load]);

  return (
    <div>
      <Title level={3}>实时排名与缺失清单</Title>
      <Paragraph type="secondary">
        完成全部必达点的队伍按「最后一点打卡时间」排名，打卡顺序可以不同；
        未完成队伍不列名次，其缺失必达点实时展示。
      </Paragraph>

      <Space style={{ marginBottom: 16 }}>
        <Select
          style={{ minWidth: 360 }}
          value={currentEvent?.id}
          onChange={setCurrentEventId}
          options={events.map((e) => ({
            value: e.id,
            label: `${e.name}（${e.phaseLabel}）`,
          }))}
        />
        {data && (
          <Text type="secondary">
            数据更新于 {formatDateTime(data.serverTime)}，每 10 秒自动刷新
          </Text>
        )}
      </Space>

      {data && (
        <>
          <Space size={32} style={{ marginBottom: 16 }}>
            <Card>
              <Statistic title="报名队伍" value={data.ranking.length + data.missingList.length} />
            </Card>
            <Card>
              <Statistic title="已完赛" value={data.ranking.length} valueStyle={{ color: "#3f8600" }} />
            </Card>
            <Card>
              <Statistic title="未完成" value={data.missingList.length} valueStyle={{ color: "#cf1322" }} />
            </Card>
            <Card>
              <Statistic title="必达点" value={data.requiredCount} />
            </Card>
          </Space>

          <Card title={<><CrownTwoTone twoToneColor="#faad14" /> 名次榜（按最后一点时间）</>}
            style={{ marginBottom: 16 }}>
            <Table<RankingRow>
              size="small"
              rowKey="teamId"
              pagination={false}
              locale={{ emptyText: <Empty description="还没有队伍完成全部必达点" /> }}
              dataSource={data.ranking}
              columns={[
                {
                  title: "名次",
                  dataIndex: "rank",
                  width: 90,
                  render: (rank: number) =>
                    rank <= 3 ? (
                      <Tag color={rank === 1 ? "gold" : rank === 2 ? "default" : "orange"}>
                        第 {rank} 名
                      </Tag>
                    ) : (
                      `第 ${rank} 名`
                    ),
                },
                { title: "队号", dataIndex: "teamNumber", width: 90 },
                { title: "队名", dataIndex: "teamName" },
                {
                  title: "最后一点时间",
                  dataIndex: "finishTime",
                  render: (v: string) => <Text strong>{formatDateTime(v)}</Text>,
                },
                {
                  title: "总用时（自发车起）",
                  dataIndex: "elapsedSeconds",
                  render: (v: number) => formatDuration(v),
                },
                {
                  title: "打卡顺序（编号 @ 时间）",
                  render: (_, row) =>
                    row.checkins
                      .map((c) => `${c.cpCode}@${formatDateTime(c.time).slice(11)}`)
                      .join("  →  "),
                },
              ]}
            />
          </Card>

          <Card title="缺失清单（未完成队伍）">
            <Table<MissingRow>
              size="small"
              rowKey="teamId"
              pagination={false}
              locale={{ emptyText: <Empty description="所有队伍均已完成必达点 🎉" /> }}
              dataSource={data.missingList}
              columns={[
                { title: "队号", dataIndex: "teamNumber", width: 90 },
                { title: "队名", dataIndex: "teamName" },
                {
                  title: "必达进度",
                  render: (_, row) => `${row.checkedCount}/${row.requiredCount}`,
                },
                {
                  title: "缺失必达点",
                  render: (_, row) => (
                    <Space wrap>
                      {row.missing.map((cp) => (
                        <Tag color="red" key={cp.code}>
                          {cp.code} {cp.name}
                        </Tag>
                      ))}
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );
}
