import { createAgentRoute } from "@/server/agents/core/agentRoute";
import { stuckRadarAgent } from "@/server/agents/stuckRadar/stuckRadarAgent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createAgentRoute(stuckRadarAgent);
