import { getServerEnv } from "@/shared/config/env";

export const dynamic = "force-dynamic";

export function GET() {
  const { aiMode } = getServerEnv();
  return Response.json({ status: "ok", aiMode });
}
