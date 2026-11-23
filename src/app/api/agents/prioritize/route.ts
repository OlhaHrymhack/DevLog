import { createAgentRoute } from "@/server/agents/core/agentRoute";
import { prioritizeAgent } from "@/server/agents/prioritize/prioritizeAgent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createAgentRoute(prioritizeAgent);
