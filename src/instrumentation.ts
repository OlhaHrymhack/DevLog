export const register = async () => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getServerEnv } = await import("@/shared/config/env");
    getServerEnv();
  }
};
