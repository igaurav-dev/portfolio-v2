import { ensureAdmin } from "./lib/auth";

const prefix = "[admin]";

try {
  const result = await ensureAdmin();
  if (result.created) {
    console.log(`${prefix} ${result.reason} — ${result.email}`);
  } else if (result.total > 0) {
    console.log(`${prefix} ${result.total} admin account(s) present`);
  } else {
    console.warn(`${prefix} ${result.reason}`);
  }
} catch (err) {
  // Never let bootstrap take the server down; login retries it lazily.
  console.error(`${prefix} bootstrap failed:`, err);
}
