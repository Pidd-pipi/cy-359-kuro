import dayjs from "dayjs";
import type { EventStatus } from "../types";

export function formatTime(iso?: string | null, withSeconds = true): string {
  if (!iso) return "—";
  return dayjs(iso).format(withSeconds ? "MM-DD HH:mm:ss" : "MM-DD HH:mm");
}

export function formatClock(iso?: string | null): string {
  if (!iso) return "—";
  return dayjs(iso).format("HH:mm:ss");
}

export function elapsedText(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}小时${m}分${s}秒`;
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
}

export const STATUS_COLOR: Record<EventStatus, string> = {
  upcoming: "gold",
  ongoing: "green",
  closed: "default",
};
