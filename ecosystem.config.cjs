// PM2 process manager config — auto-restarts the backend on crash or overload.
// Usage:
//   npm install -g pm2
//   pm2 start ecosystem.config.cjs
//   pm2 save && pm2 startup   (to auto-start on server reboot)
//
// Useful commands:
//   pm2 status            → see running processes
//   pm2 logs minibazar    → live logs
//   pm2 restart minibazar → manual restart
//   pm2 monit             → live CPU/memory monitor

module.exports = {
  apps: [
    {
      name:   'minibazar',
      script: 'src/server.js',
      cwd:    './',

      // ── Auto-restart on crash ──────────────────────────────────────────────
      autorestart: true,
      watch:       false,            // don't restart on file change (production)

      // ── Restart if memory grows too large (memory leak / overload) ─────────
      max_memory_restart: '400M',

      // ── Cluster mode: run multiple instances to handle heavy load ──────────
      // 'max' uses all CPU cores. Requests are load-balanced across them,
      // so one busy instance doesn't block everyone.
      instances: 'max',
      exec_mode: 'cluster',

      // ── Crash-loop protection ──────────────────────────────────────────────
      min_uptime:           '10s',   // must stay up 10s to count as "started"
      max_restarts:         10,      // if it crashes 10x fast, stop trying
      restart_delay:        2000,    // wait 2s between restarts
      exp_backoff_restart_delay: 100,// gradually increase delay on repeat crashes

      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
