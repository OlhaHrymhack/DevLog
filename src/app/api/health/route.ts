import type { Health } from "@/shared/api/health/schema";
import { getServerEnv } from "@/shared/config/env";

export const dynamic = "force-dynamic";

export const GET = () => {
  const { aiMode } = getServerEnv();
  return Response.json({ status: "ok", aiMode } satisfies Health);
};
