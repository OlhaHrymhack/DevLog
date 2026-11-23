"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "../http";
import { AgentQuotaSchema } from "./schema";

export const useAgentQuota = (open: boolean) => useQuery({
  queryKey: ["agent-quota"],
  queryFn: ({ signal }) => fetchJson("/api/agents/quota", AgentQuotaSchema, { signal }),
  enabled: open,
  refetchInterval: open ? 15_000 : false,
});
