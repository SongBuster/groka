#!/usr/bin/env node
import fs from 'fs'
import { execSync } from 'child_process'

const args = process.argv.slice(2)
if (args.length === 0) {
  console.log('Usage: version.js [minor|patch] [--commit|--auto]')
  process.exit(1)
}

const kind = args[0]
const doCommit = args.includes('--commit') || args.includes('--auto')
const versionPath = `${process.cwd()}/VERSION`

if (!fs.existsSync(versionPath)) {
  console.error('VERSION file not found at', versionPath)
  process.exit(2)
}

let v = fs.readFileSync(versionPath, 'utf8').trim()
const parts = v.split('.').map((p) => Number(p) || 0)
while (parts.length < 3) parts.push(0)
let [major, minor, patch] = parts

if (kind === 'minor') {
  minor = minor + 1
  patch = 0
} else if (kind === 'patch') {
  patch = patch + 1
} else {
  console.error('Unknown bump kind:', kind)
  process.exit(3)
}

const newV = `${major}.${minor}.${patch}`
fs.writeFileSync(versionPath, newV + '\n')
console.log(newV)

if (doCommit) {
  try {
    execSync(`git add ${versionPath}`, { stdio: 'inherit' })
    execSync(`git commit -m "chore: bump version to ${newV}"`, { stdio: 'inherit' })
  } catch (e) {
    // If commit fails (e.g. nothing to commit) ignore and continue
  }
}
