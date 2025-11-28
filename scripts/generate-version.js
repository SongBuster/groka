#!/usr/bin/env node
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  // Get git information - use Netlify env vars if available
  const branch = process.env.BRANCH || 
                 process.env.HEAD || 
                 execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  const commit = process.env.COMMIT_REF?.substring(0, 7) || 
                 execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  const isDirty = process.env.NETLIFY ? false : 
                  execSync('git status --porcelain', { encoding: 'utf8' }).trim().length > 0;
  
  // Get commit count for major.minor version
  const commitCount = parseInt(execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim(), 10);
  
  // Calculate patch version based on uncommitted changes
  let patchVersion = 0;
  if (isDirty) {
    // Get hash of all modified files (staged + unstaged)
    const diffOutput = execSync('git diff HEAD --no-ext-diff', { encoding: 'utf8' });
    const contentHash = createHash('md5').update(diffOutput).digest('hex').substring(0, 8);
    
    // Try to read previous version file
    const versionPath = join(__dirname, '../src/version.ts');
    if (existsSync(versionPath)) {
      const prevContent = readFileSync(versionPath, 'utf8');
      const prevMatch = prevContent.match(/"version":\s*"0\.(\d+)\.(\d+)"/);
      if (prevMatch) {
        const prevCommitCount = parseInt(prevMatch[1], 10);
        const prevPatch = parseInt(prevMatch[2], 10);
        // If commit count is the same, increment patch
        if (prevCommitCount === commitCount) {
          patchVersion = prevPatch + 1;
        }
      }
    }
  }
  
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
  version: "0.5.0",
  branch: "unknown",
  commit: "unknown",
  isDirty: false,
  buildTime: "${new Date().toISOString()}",
};
`;
  writeFileSync(join(__dirname, '../src/version.ts'), fallback);
}
