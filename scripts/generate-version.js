#!/usr/bin/env node
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  // Get git information - prioritize Vercel env vars
  const branch = process.env.VERCEL_GIT_COMMIT_REF ||
                 process.env.BRANCH || 
                 execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) ||
                 process.env.COMMIT_REF?.substring(0, 7) || 
                 execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  
  const isDirty = (process.env.VERCEL || process.env.NETLIFY) ? false : 
                  execSync('git status --porcelain', { encoding: 'utf8' }).trim().length > 0;
  
  // Get commit timestamp (works even in shallow clones)
  // This ensures same commit always has same version
  let commitTimestamp;
  try {
    commitTimestamp = parseInt(
      execSync('git log -1 --format=%ct', { encoding: 'utf8' }).trim(),
      10
    );
  } catch (e) {
    commitTimestamp = Math.floor(Date.now() / 1000);
    console.warn('⚠️  Could not get commit timestamp');
  }

  // Count total commits (fallback to estimation if unavailable)
  let commitCount;
  try {
    commitCount = parseInt(
      execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim(),
      10
    );
  } catch (e) {
    // Fallback: estimate from timestamp
    const epochSeconds = 1609459200; // Jan 1, 2021
    commitCount = Math.floor((commitTimestamp - epochSeconds) / 2592000); // ~1 commit per month estimation
    console.warn('⚠️  Using estimated commit count');
  }

  // Version format: 0.{commitCount}.{lastDigitsOfTimestamp}
  // This maintains the dev versioning scheme and increments with new commits
  const patchVersion = commitTimestamp % 1000;
  const version = `0.${commitCount}.${patchVersion}`;

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
  const fallback = `// Auto-generated file - do not edit
export const VERSION_INFO = {
  version: "0.0.0",
  branch: "unknown",
  commit: "unknown",
  isDirty: false,
  buildTime: "${new Date().toISOString()}",
};
`;
  writeFileSync(join(__dirname, '../src/version.ts'), fallback);
}
