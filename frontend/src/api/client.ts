import { API_BASE_URL } from "../constants/app";
import type { OverviewResponse } from "../types";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: "application/json", ...(options?.body ? { "Content-Type": "application/json" } : {}) },
    ...options,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message || `请求失败（HTTP ${response.status}）`;
    const error = new Error(message) as Error & { code?: string; payload?: unknown; status?: number };
    error.code = payload?.code;
    error.payload = payload;
    error.status = response.status;
    throw error;
  }
  return payload as T;
}

export function fetchOverview(): Promise<OverviewResponse> {
  return request<OverviewResponse>("/overview");
}

export const raceApi = {
  event: () => request<import("../types").CheckpointsResponse>("/race/event"),
  teams: () => request<import("../types").TeamsResponse>("/race/teams"),
  punches: () => request<import("../types").PunchesResponse>("/race/punches"),
  results: () => request<import("../types").ResultsResponse>("/race/results"),
  adjustments: () => request<import("../types").AdjustmentsResponse>("/race/adjustments"),

  register: (body: {
    teamName: string;
    leaderName: string;
    contact?: string;
    members: { name: string; number?: string }[];
  }) => request<{ ok: boolean; message: string; team: import("../types").Team }>("/race/register", {
    method: "POST",
    body: JSON.stringify(body),
  }),

  punch: (body: { teamId?: number; teamName?: string; member?: string; cpCode: string }) =>
    request<import("../types").ActionResponse>("/race/punch", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  judgePunch: (body: {
    teamId: number;
    cpCode: string;
    arrivalTime: string;
    reason: string;
    evidence: string;
    operator?: string;
  }) => request<import("../types").ActionResponse>("/race/judge/punch", {
    method: "POST",
    body: JSON.stringify(body),
  }),

  judgeRevoke: (body: { punchId: number }) =>
    request<import("../types").ActionResponse>("/race/judge/revoke", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  setWindow: (body: { startTime: string; cutoffTime: string }) =>
    request<{ ok: boolean; message: string; event: import("../types").RaceEvent }>(
      "/race/judge/window",
      { method: "POST", body: JSON.stringify(body) },
    ),
};
