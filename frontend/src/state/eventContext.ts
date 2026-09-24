import { createContext, useContext } from "react";
import type { EventSummary } from "../types";

/** 跨页签共享当前选中的赛事 */
export interface EventContextValue {
  events: EventSummary[];
  currentEvent?: EventSummary;
  setCurrentEventId: (id: number) => void;
  reload: () => void;
  loading: boolean;
}

export const EventContext = createContext<EventContextValue>({
  events: [],
  setCurrentEventId: () => undefined,
  reload: () => undefined,
  loading: false,
});

export const useEventContext = () => useContext(EventContext);
