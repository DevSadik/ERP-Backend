// PM2 process manager config — auto-restarts the backend on crash or overload.
//
// ── VPS-এ ব্যবহার ──────────────────────────────────────────────
//   npm install -g pm2
//   cd /var/www/backend
//   pm2 start ecosystem.config.cjs
//   pm2 save
//   pm2 startup        ← যে line দেখাবে সেটা copy করে চালান (reboot-এ auto start)
//
// ── কাজের command ─────────────────────────────────────────────
//   pm2 status              → কোন process চলছে
//   pm2 logs backend        → live log দেখুন
//   pm2 restart backend     → restart করুন
//   pm2 stop backend        → বন্ধ করুন
//   pm2 monit               → CPU/RAM live monitor

module.exports = {
  apps: [
    {
      name:   'backend',
      script: 'src/server.js',
      cwd:    __dirname,

      // ── একটি instance (ছোট VPS-এর জন্য নিরাপদ) ──────────────────
      // বড় VPS (4GB+) হলে instances: 'max', exec_mode: 'cluster' করতে পারেন।
      instances: 1,
      exec_mode: 'fork',

      // ── Crash হলে auto-restart ──────────────────────────────────
      autorestart: true,
      watch:       false,

      // ── Memory বেশি হলে restart (leak/overload থেকে বাঁচায়) ─────
      max_memory_restart: '400M',

      // ── Crash-loop protection ───────────────────────────────────
      min_uptime:    '10s',
      max_restarts:  10,
      restart_delay: 2000,

      env: {
        NODE_ENV: 'production',
      },

      // ── Log ফাইল (pm2 logs backend দিয়ে দেখা যায়) ──────────────
      error_file: './logs/pm2-error.log',
      out_file:   './logs/pm2-out.log',
      merge_logs: true,
      time:       true,
    },
  ],
};
