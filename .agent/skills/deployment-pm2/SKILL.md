---
name: PM2 Deployment
description: Patterns for deploying Node.js applications with PM2, including process management, clustering, logging, and monitoring
---

# PM2 Deployment Skill

## Ecosystem Configuration

### ecosystem.config.js
```javascript
module.exports = {
  apps: [
    {
      name: 'nepse-backend',
      script: 'src/server.js',
      instances: 'max',        // Use all CPU cores
      exec_mode: 'cluster',    // Enable clustering
      watch: false,            // Disable in production
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      // Logging
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      log_file: 'logs/combined.log',
      time: true,
      // Restart policy
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
```

## Common Commands

### Process Management
```bash
# Start application
pm2 start ecosystem.config.js --env production

# Stop application
pm2 stop nepse-backend

# Restart application
pm2 restart nepse-backend

# Reload with zero downtime
pm2 reload nepse-backend

# Delete from PM2
pm2 delete nepse-backend

# List all processes
pm2 list

# Show process details
pm2 show nepse-backend
```

### Monitoring
```bash
# Real-time monitoring dashboard
pm2 monit

# View logs
pm2 logs nepse-backend

# View last 100 lines
pm2 logs nepse-backend --lines 100

# Clear logs
pm2 flush
```

### Startup & Persistence
```bash
# Generate startup script
pm2 startup

# Save current process list
pm2 save

# Resurrect saved processes
pm2 resurrect
```

## Zero-Downtime Deployments

### Deployment Script
```bash
#!/bin/bash
# deploy.sh

echo "Pulling latest changes..."
git pull origin master

echo "Installing dependencies..."
npm install --production

echo "Running migrations..."
npx prisma migrate deploy

echo "Reloading application..."
pm2 reload ecosystem.config.js --env production

echo "Deployment complete!"
```

## Health Monitoring

### Graceful Shutdown
```javascript
// In your server.js
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// For PM2 cluster mode
process.on('message', async (msg) => {
  if (msg === 'shutdown') {
    await prisma.$disconnect();
    process.exit(0);
  }
});
```

### Health Check Endpoint
```javascript
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage()
  });
});
```

## Log Rotation

### PM2 Log Rotate Module
```bash
# Install log rotate module
pm2 install pm2-logrotate

# Configure rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

## Environment Variables

### Using .env in Production
```bash
# Start with dotenv
pm2 start ecosystem.config.js --env production

# Or in ecosystem file
env_production: {
  NODE_ENV: 'production',
  DATABASE_URL: 'file:./data/nepse.db'
}
```

## Best Practices

1. **Use cluster mode** - Utilize all CPU cores
2. **Set memory limits** - Prevent memory leaks from crashing server
3. **Enable log rotation** - Prevent disk space issues
4. **Use graceful reload** - Zero downtime deployments
5. **Monitor with pm2 monit** - Real-time resource monitoring
6. **Save process list** - Persist across reboots with `pm2 save`
