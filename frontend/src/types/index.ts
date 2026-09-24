export type EventPhase = "upcoming" | "live" | "finished";

export interface EventSummary {
  id: number;
  code: string;
  name: string;
  difficulty: string;
  description: string;
  startAt: string;
  endAt: string;
  phase: EventPhase;
  phaseLabel: string;
  requiredCount: number;
  teamCount: number;
}

export interface OverviewResponse {
  serverTime: string;
  events: EventSummary[];
}

export interface CheckpointInfo {
  id: number;
  code: string;
  name: string;
  seq: number;
  clue: string;
  required: boolean;
  checkedAt?: string;
  source?: string;
  memberName?: string;
}

export interface MemberInfo {
  id: number;
  name: string;
  number: string;
}

export interface MissingCp {
  code: string;
  name: string;
  seq: number;
}

export interface TeamRow {
  id: number;
  number: string;
  name: string;
  leaderName: string;
  memberCount: number;
  checkedCount: number;
  requiredCount: number;
  missingCount: number;
  finished: boolean;
  finishTime: string | null;
  registeredAt: string;
}

export interface EventDetailResponse {
  event: EventSummary;
  checkpoints: CheckpointInfo[];
  teams: TeamRow[];
  stats: { teamCount: number; finishedCount: number; requiredCount: number };
}

export interface TeamDetail {
  id: number;
  number: string;
  name: string;
  leaderName: string;
  contact: string;
  registeredAt: string;
  event: EventSummary;
  members: MemberInfo[];
  checkpoints: CheckpointInfo[];
  missing: MissingCp[];
  finished: boolean;
  finishTime: string | null;
}

export interface CheckinInfo {
  id: number;
  teamId: number;
  teamNumber: string;
  cpCode: string;
  cpName: string;
  memberName: string;
  time: string;
  source: "member" | "referee";
  sourceLabel: string;
}

export interface CheckinResult {
  accepted: boolean;
  reason: string;
  code: string;
  checkin: CheckinInfo;
}

export interface RankingRow {
  rank: number;
  teamId: number;
  teamNumber: string;
  teamName: string;
  finishTime: string;
  elapsedSeconds: number;
  requiredCount: number;
  checkins: CheckinInfo[];
}

export interface MissingRow {
  teamId: number;
  teamNumber: string;
  teamName: string;
  checkedCount: number;
  requiredCount: number;
  missing: MissingCp[];
}

export interface LeaderboardResponse {
  event: EventSummary;
  serverTime: string;
  requiredCount: number;
  ranking: RankingRow[];
  missingList: MissingRow[];
}

export interface AdjustmentInfo {
  id: number;
  action: "backfill" | "revoke";
  actionLabel: string;
  eventId: number;
  teamId: number;
  teamNumber: string;
  teamName: string;
  cpCode: string;
  cpName: string;
  memberName: string;
  reason: string;
  evidence: string;
  checkinTime: string | null;
  operator: string;
  createdAt: string;
}

export interface BackfillResult {
  accepted: boolean;
  message: string;
  adjustment: AdjustmentInfo;
  checkin: CheckinInfo;
  ranking: RankingRow[];
  missingList: MissingRow[];
}

export interface AdjustmentListResponse {
  adjustments: AdjustmentInfo[];
  count: number;
}

export interface ApiError {
  accepted: false;
  code: string;
  reason: string;
  message: string;
}
