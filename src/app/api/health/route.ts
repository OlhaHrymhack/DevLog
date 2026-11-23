import type { Health } from "@/shared/api/health/schema";
import { getServerEnv } from "@/shared/config/env";

export const dynamic = "force-dynamic";

export const GET = () => {
  const { aiMode, agentQuota } = getServerEnv();
  return Response.json({ status: "ok", aiMode, agentQuota } satisfies Health);
};
