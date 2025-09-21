#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Testing Augment Monitor Compatibility...\n');

// Test 1: Check Node.js version
console.log('1. Node.js Environment:');
console.log(`   Version: ${process.version}`);
console.log(`   Platform: ${process.platform}`);
console.log(`   Architecture: ${process.arch}`);

// Test 2: Check for required dependencies
console.log('\n2. Dependencies:');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const requiredDeps = ['node-fetch', 'semver', 'chalk'];

for (const dep of requiredDeps) {
  try {
    require(dep);
    console.log(`   ✓ ${dep} - Available`);
  } catch (error) {
    console.log(`   ✗ ${dep} - Missing`);
  }
}

// Test 3: Check IDE detection
console.log('\n3. IDE Detection:');
const homeDir = process.env.HOME || process.env.USERPROFILE;

// Check Cursor
const cursorPath = path.join(homeDir, '.cursor', 'extensions');
if (fs.existsSync(cursorPath)) {
  console.log('   ✓ Cursor extensions folder found');
  try {
    execSync('cursor --version', { stdio: 'ignore', timeout: 5000 });
    console.log('   ✓ Cursor CLI available');
  } catch (error) {
    console.log('   ⚠ Cursor CLI not available (folder detection will be used)');
  }
} else {
  console.log('   ✗ Cursor not found');
}

// Check VS Code
const vscodePath = path.join(homeDir, '.vscode', 'extensions');
if (fs.existsSync(vscodePath)) {
  console.log('   ✓ VS Code extensions folder found');
  try {
    execSync('code --version', { stdio: 'ignore', timeout: 5000 });
    console.log('   ✓ VS Code CLI available');
  } catch (error) {
    console.log('   ⚠ VS Code CLI not available (folder detection will be used)');
  }
} else {
  console.log('   ✗ VS Code not found');
}

// Test 4: Check Augment extension
console.log('\n4. Augment Extension:');
let foundAugment = false;

// Check Cursor
if (fs.existsSync(cursorPath)) {
  const extensions = fs.readdirSync(cursorPath);
  const augmentFolder = extensions.find(folder => folder.startsWith('augment.vscode-augment-'));
  if (augmentFolder) {
    const version = augmentFolder.replace('augment.vscode-augment-', '');
    console.log(`   ✓ Found in Cursor: ${version}`);
    foundAugment = true;
  }
}

// Check VS Code
if (fs.existsSync(vscodePath)) {
  const extensions = fs.readdirSync(vscodePath);
  const augmentFolder = extensions.find(folder => folder.startsWith('augment.vscode-augment-'));
  if (augmentFolder) {
    const version = augmentFolder.replace('augment.vscode-augment-', '');
    console.log(`   ✓ Found in VS Code: ${version}`);
    foundAugment = true;
  }
}

if (!foundAugment) {
  console.log('   ✗ Augment extension not found');
}

// Test 5: Network connectivity
console.log('\n5. Network Connectivity:');
try {
  const { execSync } = require('child_process');
  execSync('ping -c 1 marketplace.visualstudio.com', { stdio: 'ignore', timeout: 10000 });
  console.log('   ✓ Can reach VS Code Marketplace');
} catch (error) {
  console.log('   ✗ Cannot reach VS Code Marketplace');
}

console.log('\n✅ Compatibility test completed!');
console.log('\nTo run the actual update check:');
console.log('   npm start');
console.log('\nTo test without making changes:');
console.log('   npm test');
