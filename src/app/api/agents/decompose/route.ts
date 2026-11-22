import { createAgentRoute } from "@/server/agents/core/agentRoute";
import { decomposeAgent } from "@/server/agents/decompose/decomposeAgent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createAgentRoute(decomposeAgent);
