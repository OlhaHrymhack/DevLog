import { getAgentQuotaSummary } from "@/server/agentQuota/summary";
import { withHandler } from "@/server/http/handler";
import { getServerEnv } from "@/shared/config/env";

export const dynamic = "force-dynamic";

export const GET = withHandler(async () => Response.json(
  await getAgentQuotaSummary(getServerEnv().agentQuota),
  { headers: { "Cache-Control": "no-store" } },
));
