export interface FeatureItem {
  id: number;
  title: string;
  description: string;
  status: string;
  metric: string;
}

export interface KpiItem {
  label: string;
  value: string;
  trend: string;
  tone: string;
}

export interface OperationRecord {
  key: string;
  name: string;
  owner: string;
  status: string;
  metric: string;
  priority: string;
}

export interface OverviewResponse {
  appName: string;
  appCode: string;
  description: string;
  features: FeatureItem[];
  kpis: KpiItem[];
  records: OperationRecord[];
}

export type EventStatus = "upcoming" | "ongoing" | "closed";

export interface RaceEvent {
  id: number;
  name: string;
  description: string;
  startTime: string;
  cutoffTime: string;
  status: EventStatus;
  statusLabel: string;
}

export interface Checkpoint {
  id: number;
  code: string;
  name: string;
  clue: string;
  required: boolean;
  order: number;
}

export interface Member {
  id: number;
  name: string;
  number: string;
  isLeader: boolean;
}

export interface Punch {
  id: number;
  teamId: number;
  teamName: string;
  checkpointId: number;
  cpCode: string;
  cpName: string;
  required: boolean;
  memberName: string;
  source: "member" | "judge";
  sourceLabel: string;
  result: "valid" | "rejected";
  resultLabel: string;
  accepted: boolean;
  rejectReason: string;
  judgeReason: string;
  evidence: string;
  punchTime: string;
  createdAt: string;
}

export interface Team {
  id: number;
  name: string;
  leaderName: string;
  contact: string;
  createdAt: string;
  members: Member[];
  punchedCount: number;
  requiredTotal: number;
  punches: Punch[];
  finished: boolean;
}

export interface RankHit {
  cpCode: string;
  cpName: string;
  punchTime: string;
  source: "member" | "judge";
  sourceLabel: string;
}

export interface RankRow {
  rank: number;
  teamId: number;
  teamName: string;
  leaderName: string;
  finishTime: string;
  elapsedSeconds: number;
  punchedCount: number;
  requiredTotal: number;
  hits: RankHit[];
}

export interface MissingCp {
  code: string;
  name: string;
}

export interface MissingRow {
  teamId: number;
  teamName: string;
  leaderName: string;
  punchedCount: number;
  requiredTotal: number;
  missingCps: MissingCp[];
  lastPunchTime: string | null;
}

export interface ResultsResponse {
  event: RaceEvent;
  requiredTotal: number;
  leaderboard: RankRow[];
  missing: MissingRow[];
  generatedAt: string;
}

export interface TeamsResponse {
  event: RaceEvent;
  teams: Team[];
}

export interface CheckpointsResponse {
  event: RaceEvent;
  checkpoints: Checkpoint[];
}

export interface PunchesResponse {
  event: RaceEvent;
  punches: Punch[];
}

export interface Adjustment {
  id: number;
  kind: "judge_punch" | "revoke" | "window";
  kindLabel: string;
  detail: string;
  operator: string;
  teamId: number | null;
  teamName: string | null;
  cpCode: string | null;
  createdAt: string;
}

export interface AdjustmentsResponse {
  event: RaceEvent;
  adjustments: Adjustment[];
}

export interface ActionResponse {
  ok: boolean;
  message: string;
  accepted?: boolean;
  punch?: Punch;
}
