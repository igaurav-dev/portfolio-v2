/**
 * PM2 process definition.
 *
 * IMPORTANT — instances: 1 is deliberate, not an oversight.
 *
 * Three things in this app live in the memory of a single process:
 *   1. lib/trace.ts        request traces, read back by /api/trace
 *   2. lib/ratelimit.ts    the per-visitor token bucket and daily spend meter
 *   3. lib/semantic-cache  the in-process half of the answer cache
 *
 * Run two workers and a visitor's /api/trace call can land on the process that
 * did not render their page, the rate limit silently doubles, and cache hit
 * rates halve. Node handles this workload comfortably in one process — a page
 * render is ~15ms and almost entirely I/O.
 *
 * If you genuinely need more processes later, move those three stores to Redis
 * or Mongo first, then raise `instances` and switch exec_mode to "cluster".
 */
module.exports = {
  apps: [
    {
      name: "portfolio",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start --port 8008 --hostname 127.0.0.1",

      exec_mode: "fork",
      instances: 1,

      // Restart policy
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: "20s",
      restart_delay: 2000,
      exp_backoff_restart_delay: 500,

      // Recycle if something leaks; the process is stateless enough to lose.
      max_memory_restart: "512M",

      // Next needs a moment to bind; don't declare it dead too early.
      listen_timeout: 10000,
      kill_timeout: 5000,
      wait_ready: false,

      env: {
        NODE_ENV: "production",
        PORT: "8008",
        HOSTNAME: "127.0.0.1",
        // Secrets belong in .env.local, which `next start` reads automatically.
        // Do not put ANTHROPIC_API_KEY / ADMIN_PASSWORD / MONGODB_URI here —
        // this file is committed.
      },

      // Logs
      error_file: "logs/error.log",
      out_file: "logs/out.log",
      merge_logs: true,
      time: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
