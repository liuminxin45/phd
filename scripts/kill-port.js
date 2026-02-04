#!/usr/bin/env node

/**
 * Kill process using specified port
 * Usage: node scripts/kill-port.js <port>
 */

const { execSync } = require('child_process');

const port = process.argv[2] || '9641';

function killPort(port) {
  try {
    console.log(`Checking for processes on port ${port}...`);
    
    // Windows
    if (process.platform === 'win32') {
      try {
        const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
        const lines = output.split('\n').filter(line => line.includes('LISTENING'));
        
        const pids = new Set();
        lines.forEach(line => {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && !isNaN(pid)) {
            pids.add(pid);
          }
        });
        
        if (pids.size > 0) {
          console.log(`Found ${pids.size} process(es) using port ${port}`);
          pids.forEach(pid => {
            try {
              execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
              console.log(`✓ Killed process ${pid}`);
            } catch (e) {
              console.log(`✗ Failed to kill process ${pid}`);
            }
          });
        } else {
          console.log(`No process found on port ${port}`);
        }
      } catch (e) {
        console.log(`No process found on port ${port}`);
      }
    } 
    // Unix-like (macOS, Linux)
    else {
      try {
        const pid = execSync(`lsof -ti:${port}`, { encoding: 'utf8' }).trim();
        if (pid) {
          execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
          console.log(`✓ Killed process ${pid} on port ${port}`);
        } else {
          console.log(`No process found on port ${port}`);
        }
      } catch (e) {
        console.log(`No process found on port ${port}`);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

killPort(port);
