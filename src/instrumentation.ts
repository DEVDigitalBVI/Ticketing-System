export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { getPublicEnvironment } = await import("@/config/public");
  const { getServerEnvironment } = await import("@/config/server");
  getPublicEnvironment();
  getServerEnvironment();
}
