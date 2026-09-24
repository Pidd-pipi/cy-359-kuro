import { useEffect, useState } from "react";
import { Button, ConfigProvider, Layout, Typography, theme } from "antd";
import { ApiOutlined } from "@ant-design/icons";
import { fetchOverview } from "./api/client";
import { APP_CODE, APP_NAME, APP_THEME } from "./constants/app";
import { REQUEST_MESSAGES } from "./constants/messages";
import { createFallbackOverview } from "./state/dashboard";
import type { OverviewResponse } from "./types";
import { RaceWorkbench } from "./components/race/RaceWorkbench";

const { Header, Content } = Layout;

export default function App() {
  const [overview, setOverview] = useState<OverviewResponse>(createFallbackOverview());
  const [notice, setNotice] = useState(REQUEST_MESSAGES.overviewFallback);

  useEffect(() => {
    fetchOverview()
      .then((payload) => {
        setOverview(payload);
        setNotice("后端服务已联通，当前展示实时接口数据。");
      })
      .catch(() => setNotice(REQUEST_MESSAGES.overviewFallback));
  }, []);

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: APP_THEME.accent,
          colorText: APP_THEME.ink,
          colorBgBase: APP_THEME.paper,
          borderRadius: 8,
        },
      }}
    >
      <Layout className="app-shell">
        <Header className="topbar">
          <div className="brand-block">
            <span className="brand-code">{APP_CODE}</span>
            <h1 className="brand-title">
              {APP_NAME} · <span className="brand-sub">周末定向赛工作台</span>
            </h1>
          </div>
          <Button type="primary" icon={<ApiOutlined />} href={REQUEST_MESSAGES.healthPath}>
            API Health
          </Button>
        </Header>
        <Content className="workspace">
          <section className="hero-panel race-hero">
            <span className="pill">{notice}</span>
            <Typography.Title level={2} style={{ marginTop: 12 }}>
              报名 → CP 打卡 → 排名 → 裁判补记，一轮跑通
            </Typography.Title>
            <p>
              领队在「领队报名」录入成员；开赛之后队内任一成员到点提交 CP 编号，同一队同一 CP
              只保留最早一条有效记录；赛前、截止后或非本线路点位一律拒绝并说明原因。完成全部必达点的队伍按
              <strong> 最后一点时间</strong> 排名（顺序不限）。裁判为漏打队伍凭凭证补记后，缺失清单与名次立即重算，每次调整均可在「裁判台」追溯。
            </p>
          </section>
          <RaceWorkbench overview={overview} />
        </Content>
      </Layout>
    </ConfigProvider>
  );
}
