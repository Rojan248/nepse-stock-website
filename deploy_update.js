const { execSync } = require('child_process');
const path = require('path');

/**
 * Deployment Automation Script
 * Handles the complete update lifecycle: pull, install, build, restart
 */

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, message) {
    log(`\n${'='.repeat(60)}`, colors.cyan);
    log(`STEP ${step}: ${message}`, colors.bright + colors.cyan);
    log('='.repeat(60), colors.cyan);
}

function logSuccess(message) {
    log(`✓ ${message}`, colors.green);
}

function logError(message) {
    log(`✗ ${message}`, colors.red);
}

function runCommand(command, cwd = process.cwd()) {
    try {
        log(`Running: ${command}`, colors.yellow);
        execSync(command, {
            cwd,
            stdio: 'inherit',
            shell: true
        });
        return true;
    } catch (error) {
        logError(`Command failed: ${command}`);
        logError(`Error: ${error.message}`);
        return false;
    }
}

async function deploy() {
    const startTime = Date.now();
    log('\n🚀 Starting deployment process...', colors.bright + colors.blue);

    const rootDir = process.cwd();
    const backendDir = path.join(rootDir, 'backend');
    const frontendDir = path.join(rootDir, 'frontend');

    try {
        // Step 1: Git Pull
        logStep(1, 'Pulling latest changes from Git');
        if (!runCommand('git pull origin master', rootDir)) {
            throw new Error('Git pull failed');
        }
        logSuccess('Code updated successfully');

        // Step 2: Backend Dependencies
        logStep(2, 'Installing backend dependencies');
        if (!runCommand('npm install', backendDir)) {
            throw new Error('Backend npm install failed');
        }
        logSuccess('Backend dependencies installed');

        // Step 3: Frontend Dependencies
        logStep(3, 'Installing frontend dependencies');
        if (!runCommand('npm install', frontendDir)) {
            throw new Error('Frontend npm install failed');
        }
        logSuccess('Frontend dependencies installed');

        // Step 4: Build Frontend
        logStep(4, 'Building frontend (this may take a minute...)');
        if (!runCommand('npm run build', frontendDir)) {
            throw new Error('Frontend build failed');
        }
        logSuccess('Frontend built successfully');

        // Step 5: Restart Backend
        logStep(5, 'Restarting backend via PM2');
        if (!runCommand('npx pm2 reload ecosystem.config.js --env production', backendDir)) {
            throw new Error('PM2 reload failed');
        }
        logSuccess('Backend restarted successfully');

        // Success Summary
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        log('\n' + '='.repeat(60), colors.green);
        log('🎉 DEPLOYMENT SUCCESSFUL!', colors.bright + colors.green);
        log('='.repeat(60), colors.green);
        log(`Total time: ${duration}s`, colors.green);
        log('\nYour site is now running the latest version.', colors.green);
        log('Visit https://nepse.me to see the changes.\n', colors.green);

    } catch (error) {
        // Error Summary
        log('\n' + '='.repeat(60), colors.red);
        log('❌ DEPLOYMENT FAILED', colors.bright + colors.red);
        log('='.repeat(60), colors.red);
        log(`\nError: ${error.message}`, colors.red);
        log('\nPlease fix the error and try again.', colors.yellow);
        log('You can run individual commands manually if needed.\n', colors.yellow);
        process.exit(1);
    }
}

// Run deployment
deploy();
