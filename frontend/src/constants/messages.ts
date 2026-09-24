export const REQUEST_MESSAGES = {
  healthPath: "/api/health",
  loadFailed: "后端数据加载失败，请确认后端服务已启动",
};

export const PHASE_COLOR: Record<string, string> = {
  upcoming: "default",
  live: "processing",
  finished: "success",
};
