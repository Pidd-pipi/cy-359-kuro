import { API_BASE_URL } from "../constants/app";
import type {
  AdjustmentListResponse,
  BackfillResult,
  CheckinResult,
  EventDetailResponse,
  LeaderboardResponse,
  OverviewResponse,
  TeamDetail,
} from "../types";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    ...options,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(
      payload?.reason || payload?.message || `请求失败（${response.status}）`
    ) as Error & { code?: string; status?: number };
    error.code = payload?.code;
    error.status = response.status;
    throw error;
  }
  return payload as T;
}

export const fetchOverview = () => request<OverviewResponse>("/overview");

export const fetchEventDetail = (eventId: number) =>
  request<EventDetailResponse>(`/events/${eventId}`);

export const registerTeam = (
  eventId: number,
  body: {
    number: string;
    name: string;
    leaderName: string;
    contact?: string;
    members: { name: string; number?: string }[];
  }
) =>
  request<TeamDetail>(`/events/${eventId}/teams`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const fetchTeam = (teamId: number) => request<TeamDetail>(`/teams/${teamId}`);

export const submitCheckin = (
  teamId: number,
  body: { cpCode: string; memberName: string }
) =>
  request<CheckinResult>(`/teams/${teamId}/checkins`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const fetchLeaderboard = (eventId: number) =>
  request<LeaderboardResponse>(`/events/${eventId}/leaderboard`);

export const backfillCheckin = (body: {
  teamId: number;
  cpCode: string;
  memberName?: string;
  checkinTime: string;
  reason: string;
  evidence: string;
  operator?: string;
}) =>
  request<BackfillResult>("/adjustments/backfill", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const revokeAdjustment = (
  adjustmentId: number,
  body: { reason?: string; operator?: string }
) =>
  request<BackfillResult>(`/adjustments/${adjustmentId}/revoke`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const fetchAdjustments = (params?: { eventId?: number; teamId?: number }) => {
  const query = new URLSearchParams();
  if (params?.eventId) query.set("eventId", String(params.eventId));
  if (params?.teamId) query.set("teamId", String(params.teamId));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<AdjustmentListResponse>(`/adjustments${suffix}`);
};
