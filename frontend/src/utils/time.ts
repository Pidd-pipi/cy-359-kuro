import dayjs from "dayjs";

/** ISO8601 -> 'YYYY-MM-DD HH:mm:ss' */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = dayjs(value);
  return d.isValid() ? d.format("YYYY-MM-DD HH:mm:ss") : value;
}

/** 秒 -> '1小时03分20秒' */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, totalSeconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}小时${mm}分${ss}秒` : `${mm}分${ss}秒`;
}
