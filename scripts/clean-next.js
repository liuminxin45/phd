const fs = require('fs');
const path = require('path');

const nextDir = path.join(__dirname, '..', '.next');
const MAX_RETRIES = 5;
const RETRY_DELAY = 500;

for (let i = 0; i < MAX_RETRIES; i++) {
  try {
    fs.rmSync(nextDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    break;
  } catch (err) {
    if (i < MAX_RETRIES - 1 && (err.code === 'EACCES' || err.code === 'EBUSY' || err.code === 'EPERM')) {
      const ms = RETRY_DELAY * (i + 1);
      process.stderr.write(`clean-next: retry ${i + 1}/${MAX_RETRIES} in ${ms}ms (${err.code})\n`);
      const start = Date.now();
      while (Date.now() - start < ms) { /* busy wait */ }
    } else {
      // Last attempt or unknown error — just warn and continue
      process.stderr.write(`clean-next: could not remove .next (${err.code}), continuing anyway\n`);
      break;
    }
  }
}
