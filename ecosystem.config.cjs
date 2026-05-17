module.exports = {
  apps: [{
    name: 'gods-unleashed',
    script: './node_modules/.bin/tsx',
    args: 'server/src/index.ts',
    cwd: '/home/stergiosgk/projects/gods_unleashed',
    env_file: '/home/stergiosgk/projects/gods_unleashed/.env',
    restart_delay: 3000,
    max_restarts: 10,
  }],
}
