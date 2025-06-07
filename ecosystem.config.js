module.exports = {
  apps: [
    {
      name: 'temporal-server',
      script: 'temporal',
      args: 'server start-dev --ip 0.0.0.0 --port 7233 --ui-port 8233',
      env: {
        TEMPORAL_CLI_ADDRESS: '0.0.0.0:7233'
      }
    },
    {
      name: 'temporal-worker',
      script: 'npm',
      args: 'run worker',
      env: {
        TEMPORAL_ADDRESS: 'localhost:7233'
      },
      // Wait for Temporal server to start
      wait_ready: true,
      listen_timeout: 10000
    },
    {
      name: 'web-server',
      script: 'npm',
      args: 'start',
      env: {
        PORT: process.env.PORT || 3000,
        TEMPORAL_ADDRESS: 'localhost:7233'
      },
      // Wait for worker to be ready
      wait_ready: true,
      listen_timeout: 15000
    }
  ]
}; 