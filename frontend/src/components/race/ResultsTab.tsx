import { Button, Card, Col, Empty, Row, Statistic, Table, Tag, Typography } from "antd";
import { ReloadOutlined, TrophyOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useRace } from "../../state/race";
import type { MissingRow, RankRow } from "../../types";
import { elapsedText, formatClock, formatTime } from "../../utils/time";

export function ResultsTab() {
  const { results, refreshResults } = useRace();

  if (!results) {
    return <Empty description="暂无赛事数据" />;
  }

  const rankColors: Record<number, string> = { 1: "#f6b01d", 2: "#9e9e9e", 3: "#c07b4d" };

  const rankColumns: ColumnsType<RankRow> = [
    {
      title: "名次",
      dataIndex: "rank",
      width: 80,
      render: (rank: number) => (
        <span
          className="rank-badge"
          style={rank <= 3 ? { background: rankColors[rank], color: "#fff" } : undefined}
        >
          {rank}
        </span>
      ),
    },
    {
      title: "队伍",
      dataIndex: "teamName",
      render: (name: string, row) => (
        <span>
          <strong>{name}</strong>
          {row.rank === 1 && <TrophyOutlined style={{ color: "#f6b01d", marginLeft: 8 }} />}
          <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
            领队 {row.leaderName}
          </Typography.Text>
        </span>
      ),
    },
    {
      title: "最后一点时间（排名依据）",
      dataIndex: "finishTime",
      width: 200,
      render: (v: string) => <Tag color="blue">{formatClock(v)}</Tag>,
    },
    {
      title: "总用时",
      dataIndex: "elapsedSeconds",
      width: 160,
      render: (sec: number) => elapsedText(sec),
      sorter: (a, b) => a.elapsedSeconds - b.elapsedSeconds,
    },
    {
      title: "必达点",
      dataIndex: "punchedCount",
      width: 100,
      render: (n: number, row) => `${n}/${row.requiredTotal}`,
    },
  ];

  const missingColumns: ColumnsType<MissingRow> = [
    { title: "队伍", dataIndex: "teamName", render: (v, row) => (
      <span><strong>{v}</strong><Typography.Text type="secondary" style={{ marginLeft: 8 }}>领队 {row.leaderName}</Typography.Text></span>
    ) },
    {
      title: "必达进度",
      key: "count",
      width: 110,
      render: (_, row) => `${row.punchedCount}/${row.requiredTotal}`,
    },
    {
      title: "缺失 CP（裁判可凭凭证补记）",
      dataIndex: "missingCps",
      render: (cps: MissingRow["missingCps"]) => (
        <span>
          {cps.map((cp) => (
            <Tag key={cp.code} color="error" style={{ marginBottom: 4 }}>
              {cp.code} {cp.name}
            </Tag>
          ))}
        </span>
      ),
    },
    {
      title: "最近打卡",
      dataIndex: "lastPunchTime",
      width: 160,
      render: (v: string | null) => (v ? formatTime(v) : "无记录"),
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="必达点数" value={results.requiredTotal} suffix="个" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="已完赛" value={results.leaderboard.length} suffix="支" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="未完赛 / 有缺失"
              value={results.missing.length}
              suffix="支"
              valueStyle={{ color: results.missing.length ? "#cf1322" : undefined }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="榜单生成时间"
              value={formatClock(results.generatedAt)}
              valueStyle={{ fontSize: 20 }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="实时 / 赛后排名（完成全部必达点，按最后一点时间排序，顺序不限）"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => refreshResults()}>
            刷新
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        <Table
          rowKey="teamId"
          columns={rankColumns}
          dataSource={results.leaderboard}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无完赛队伍" /> }}
          expandable={{
            expandedRowRender: (row: RankRow) => (
              <Table
                rowKey="cpCode"
                size="small"
                pagination={false}
                dataSource={row.hits}
                columns={[
                  { title: "顺序", key: "idx", width: 70, render: (_v, _r, i) => i + 1 },
                  { title: "CP", dataIndex: "cpCode", width: 90 },
                  { title: "点位", dataIndex: "cpName" },
                  {
                    title: "到达时间",
                    dataIndex: "punchTime",
                    width: 120,
                    render: (v: string) => formatClock(v),
                  },
                  {
                    title: "来源",
                    dataIndex: "sourceLabel",
                    width: 120,
                    render: (label: string, row) => (
                      <Tag color={row.source === "judge" ? "orange" : "default"}>{label}</Tag>
                    ),
                  },
                ]}
              />
            ),
          }}
        />
      </Card>

      <Card title="缺失清单（裁判补记后立即重算）">
        <Table
          rowKey="teamId"
          columns={missingColumns}
          dataSource={results.missing}
          pagination={false}
          locale={{ emptyText: <Empty description="所有队伍都已完成必达点 🎉" /> }}
        />
      </Card>
    </div>
  );
}
