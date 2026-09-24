import { Alert, Spin, Tabs } from "antd";
import {
  AppstoreOutlined,
  AuditOutlined,
  FieldTimeOutlined,
  TeamOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import { RaceProvider, useRace } from "../../state/race";
import { RaceHeader } from "./RaceHeader";
import { LeaderTab } from "./LeaderTab";
import { RunnerTab } from "./RunnerTab";
import { ResultsTab } from "./ResultsTab";
import { JudgeTab } from "./JudgeTab";
import { FeatureStrip } from "../FeatureStrip";
import { MetricGrid } from "../MetricGrid";
import { OperationsTable } from "../OperationsTable";
import type { OverviewResponse } from "../../types";

function OverviewPane({ overview }: { overview: OverviewResponse }) {
  return (
    <div>
      <MetricGrid items={overview.kpis} />
      <FeatureStrip items={overview.features} />
      <section className="work-panel">
        <h3>本轮业务链路</h3>
        <OperationsTable records={overview.records} />
      </section>
    </div>
  );
}

function RaceShell({ overview }: { overview: OverviewResponse }) {
  const { loading, error } = useRace();

  return (
    <div className="race-shell">
      <RaceHeader />
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      <Spin spinning={loading}>
        <Tabs
          defaultActiveKey="register"
          type="card"
          items={[
            {
              key: "overview",
              label: (
                <span>
                  <AppstoreOutlined /> 平台总览
                </span>
              ),
              children: <OverviewPane overview={overview} />,
            },
            {
              key: "register",
              label: (
                <span>
                  <TeamOutlined /> 领队报名
                </span>
              ),
              children: <LeaderTab />,
            },
            {
              key: "runner",
              label: (
                <span>
                  <FieldTimeOutlined /> 选手打卡
                </span>
              ),
              children: <RunnerTab />,
            },
            {
              key: "results",
              label: (
                <span>
                  <TrophyOutlined /> 排名与缺失
                </span>
              ),
              children: <ResultsTab />,
            },
            {
              key: "judge",
              label: (
                <span>
                  <AuditOutlined /> 裁判台
                </span>
              ),
              children: <JudgeTab />,
            },
          ]}
        />
      </Spin>
    </div>
  );
}

export function RaceWorkbench({ overview }: { overview: OverviewResponse }) {
  return (
    <RaceProvider>
      <RaceShell overview={overview} />
    </RaceProvider>
  );
}
