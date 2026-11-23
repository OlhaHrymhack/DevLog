export const register = async () => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getDb } = await import("@/server/db/client");
    await getDb();
  }
};
