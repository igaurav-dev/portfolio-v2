/**
 * Runs once when the server starts. Its only job is to make sure an admin
 * account exists — if the store is empty and ADMIN_EMAIL / ADMIN_PASSWORD
 * are set, the first admin is created here rather than on first login.
 *
 * The work lives in a separate module imported inside the runtime check,
 * so the Mongo driver never gets pulled into the edge bundle.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation.node");
  }
}
