#!/usr/bin/env node
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  // Get git information - use Vercel/Netlify env vars if available
  const branch = process.env.VERCEL_GIT_COMMIT_REF ||
                 process.env.BRANCH || 
                 process.env.HEAD || 
                 execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) ||
                 process.env.COMMIT_REF?.substring(0, 7) || 
                 execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  
  const isDirty = (process.env.VERCEL || process.env.NETLIFY) ? false : 
                  execSync('git status --porcelain', { encoding: 'utf8' }).trim().length > 0;
  
  // Get commit count for version - fallback to timestamp if not available
  let commitCount;
  try {
    commitCount = parseInt(execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim(), 10);
  } catch (e) {
    // If git history not available (shallow clone in Vercel), use timestamp-based version
    const now = new Date();
    const daysSinceEpoch = Math.floor(now.getTime() / (1000 * 60 * 60 * 24));
    commitCount = daysSinceEpoch;
    console.warn('⚠️  Git history not available, using timestamp-based version');
  }
  
  // Calculate version: use build number from timestamp (minutes since Jan 1, 2025)
  const epoch = new Date('2025-01-01T00:00:00Z').getTime();
  const now = Date.now();
  const minutesSinceEpoch = Math.floor((now - epoch) / (1000 * 60));
  const buildNumber = minutesSinceEpoch;
  
  const version = `1.0.${buildNumber}`;
  
  const versionInfo = {
    version,
    branch,
    commit,
    isDirty,
    buildTime: new Date().toISOString(),
  };
  
  const content = `// Auto-generated file - do not edit
export const VERSION_INFO = ${JSON.stringify(versionInfo, null, 2)};
`;
  
  writeFileSync(join(__dirname, '../src/version.ts'), content);
  console.log('✓ Version info generated:', versionInfo);
} catch (error) {
  console.error('Failed to generate version info:', error);
  // Fallback version file
  const buildNumber = Math.floor(Date.now() / 1000);
  const fallback = `// Auto-generated file - do not edit
export const VERSION_INFO = {
  version: "1.0.${buildNumber}",
  branch: "unknown",
  commit: "unknown",
  isDirty: false,
  buildTime: "${new Date().toISOString()}",
};
`;
  writeFileSync(join(__dirname, '../src/version.ts'), fallback);
}
