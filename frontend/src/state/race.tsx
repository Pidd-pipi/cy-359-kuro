import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { raceApi } from "../api/client";
import type {
  AdjustmentsResponse,
  CheckpointsResponse,
  PunchesResponse,
  ResultsResponse,
  TeamsResponse,
} from "../types";

interface RaceState {
  event: CheckpointsResponse["event"] | null;
  checkpoints: CheckpointsResponse["checkpoints"];
  teams: TeamsResponse["teams"];
  results: ResultsResponse | null;
  punches: PunchesResponse["punches"];
  adjustments: AdjustmentsResponse["adjustments"];
  loading: boolean;
  error: string;
  refreshAll: () => Promise<void>;
  refreshResults: () => Promise<void>;
}

const RaceContext = createContext<RaceState | null>(null);

const EMPTY = { checkpoints: [], teams: [], punches: [], adjustments: [] };

export function RaceProvider({ children }: { children: React.ReactNode }) {
  const [bundle, setBundle] = useState<{
    event: RaceState["event"];
    checkpoints: RaceState["checkpoints"];
    teams: RaceState["teams"];
    results: ResultsResponse | null;
    punches: RaceState["punches"];
    adjustments: RaceState["adjustments"];
  }>({ ...EMPTY, event: null, results: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshAll = useCallback(async () => {
    try {
      const [eventResp, teamsResp, resultsResp, punchesResp, adjResp] = await Promise.all([
        raceApi.event(),
        raceApi.teams(),
        raceApi.results(),
        raceApi.punches(),
        raceApi.adjustments(),
      ]);
      setBundle({
        event: eventResp.event,
        checkpoints: eventResp.checkpoints,
        teams: teamsResp.teams,
        results: resultsResp,
        punches: punchesResp.punches,
        adjustments: adjResp.adjustments,
      });
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "数据加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshResults = useCallback(async () => {
    try {
      const [resultsResp, teamsResp, punchesResp, adjResp, eventResp] = await Promise.all([
        raceApi.results(),
        raceApi.teams(),
        raceApi.punches(),
        raceApi.adjustments(),
        raceApi.event(),
      ]);
      setBundle((prev) => ({
        ...prev,
        event: eventResp.event,
        teams: teamsResp.teams,
        results: resultsResp,
        punches: punchesResp.punches,
        adjustments: adjResp.adjustments,
      }));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "数据加载失败");
    }
  }, []);

  useEffect(() => {
    refreshAll();
    const timer = window.setInterval(refreshResults, 8000);
    return () => window.clearInterval(timer);
  }, [refreshAll, refreshResults]);

  const value = useMemo<RaceState>(
    () => ({
      event: bundle.event,
      checkpoints: bundle.checkpoints,
      teams: bundle.teams,
      results: bundle.results,
      punches: bundle.punches,
      adjustments: bundle.adjustments,
      loading,
      error,
      refreshAll,
      refreshResults,
    }),
    [bundle, loading, error, refreshAll, refreshResults],
  );

  return <RaceContext.Provider value={value}>{children}</RaceContext.Provider>;
}

export function useRace(): RaceState {
  const ctx = useContext(RaceContext);
  if (!ctx) {
    throw new Error("useRace 必须在 RaceProvider 内使用");
  }
  return ctx;
}
