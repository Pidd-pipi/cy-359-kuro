import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, ConfigProvider, Layout, Tabs, Tag, Typography, theme } from "antd";
import {
  ApiOutlined,
  DashboardOutlined,
  EditOutlined,
  EnvironmentOutlined,
  OrderedListOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { fetchOverview } from "./api/client";
import { APP_CODE, APP_NAME, APP_THEME } from "./constants/app";
import { REQUEST_MESSAGES } from "./constants/messages";
import type { EventSummary } from "./types";
import { EventContext } from "./state/eventContext";
import OverviewPage from "./pages/OverviewPage";
import RegisterPage from "./pages/RegisterPage";
import CheckinPage from "./pages/CheckinPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import RefereePage from "./pages/RefereePage";

const { Header, Content } = Layout;
const EVENT_STORAGE_KEY = `${APP_CODE}:currentEventId`;

export default function App() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentEventId, setCurrentEventId] = useState<number | undefined>(() => {
    const saved = Number(localStorage.getItem(EVENT_STORAGE_KEY));
    return Number.isFinite(saved) && saved > 0 ? saved : undefined;
  });

  const reload = useCallback(() => {
    setLoading(true);
    fetchOverview()
      .then((data) => setEvents(data.events))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(reload, [reload]);

  const selectEvent = useCallback((id: number) => {
    setCurrentEventId(id);
    localStorage.setItem(EVENT_STORAGE_KEY, String(id));
  }, []);

  const currentEvent = useMemo(() => {
    const found = events.find((e) => e.id === currentEventId);
    if (found) return found;
    // 默认聚焦进行中的赛事，其次第一场
    return events.find((e) => e.phase === "live") || events[0];
  }, [events, currentEventId]);

  // 首次拿到赛事时记忆默认选择
  useEffect(() => {
    if (currentEvent && currentEvent.id !== currentEventId) {
      localStorage.setItem(EVENT_STORAGE_KEY, String(currentEvent.id));
    }
  }, [currentEvent, currentEventId]);

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
      <EventContext.Provider
        value={{
          events,
          currentEvent,
          setCurrentEventId: selectEvent,
          reload,
          loading,
        }}
      >
        <Layout className="app-shell">
          <Header className="topbar">
            <div className="brand-block">
              <span className="brand-code">{APP_CODE}</span>
              <h1 className="brand-title">
                {APP_NAME}
                {currentEvent && (
                  <Tag
                    color={
                      currentEvent.phase === "live"
                        ? "processing"
                        : currentEvent.phase === "finished"
                        ? "success"
                        : "default"
                    }
                    style={{ marginLeft: 12 }}
                  >
                    {currentEvent.phaseLabel} · {currentEvent.name}
                  </Tag>
                )}
              </h1>
            </div>
            <Button type="primary" ghost icon={<ApiOutlined />} href={REQUEST_MESSAGES.healthPath}>
              API Health
            </Button>
          </Header>
          <Content className="workspace">
            <Tabs
              defaultActiveKey="overview"
              size="large"
              items={[
                {
                  key: "overview",
                  label: (
                    <span>
                      <DashboardOutlined /> 赛事总览
                    </span>
                  ),
                  children: <OverviewPage />,
                },
                {
                  key: "register",
                  label: (
                    <span>
                      <EditOutlined /> 领队报名
                    </span>
                  ),
                  children: <RegisterPage />,
                },
                {
                  key: "checkin",
                  label: (
                    <span>
                      <EnvironmentOutlined /> 选手打卡
                    </span>
                  ),
                  children: <CheckinPage />,
                },
                {
                  key: "leaderboard",
                  label: (
                    <span>
                      <OrderedListOutlined /> 排名与缺失
                    </span>
                  ),
                  children: <LeaderboardPage />,
                },
                {
                  key: "referee",
                  label: (
                    <span>
                      <SafetyCertificateOutlined /> 裁判台
                    </span>
                  ),
                  children: <RefereePage />,
                },
              ]}
            />
          </Content>
        </Layout>
      </EventContext.Provider>
    </ConfigProvider>
  );
}
