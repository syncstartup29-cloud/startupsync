// pm2.config.js — StartupSync Production Config
module.exports = {
  apps: [{
    name: 'startupsync',
    script: 'server.js',
    instances: 'max',        // use all CPU cores
    exec_mode: 'cluster',    // cluster mode for load balancing
    watch: false,            // don't watch files in production
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'development',
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    // Auto restart if crashes
    autorestart: true,
    max_restarts: 10,
    restart_delay: 3000,
  }],
};