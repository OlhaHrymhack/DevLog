import { createSmokeRoute } from "@/server/agents/smoke/smokeRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createSmokeRoute();
