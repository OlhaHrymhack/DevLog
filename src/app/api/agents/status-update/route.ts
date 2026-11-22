import { createAgentRoute } from "@/server/agents/core/agentRoute";
import { statusUpdateAgent } from "@/server/agents/statusUpdate/statusUpdateAgent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createAgentRoute(statusUpdateAgent);
