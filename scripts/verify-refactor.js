#!/usr/bin/env node

/**
 * Verification script for refactoring changes
 * Checks that all imports are correct and modules are properly structured
 */

const fs = require('fs');
const path = require('path');

const errors = [];
const warnings = [];

function checkFileExists(filePath, description) {
  if (!fs.existsSync(filePath)) {
    errors.push(`Missing file: ${description} at ${filePath}`);
    return false;
  }
  return true;
}

function checkFileContains(filePath, searchString, description) {
  if (!fs.existsSync(filePath)) {
    errors.push(`Cannot check ${description}: file ${filePath} does not exist`);
    return false;
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  if (!content.includes(searchString)) {
    errors.push(`${description}: Expected to find "${searchString}" in ${filePath}`);
    return false;
  }
  return true;
}

console.log('🔍 Verifying refactoring changes...\n');

console.log('1. Checking new constant modules...');
checkFileExists(
  path.join(process.cwd(), 'lib/constants/batch.ts'),
  'Batch configuration constants'
);
checkFileExists(
  path.join(process.cwd(), 'lib/constants/animation.ts'),
  'Animation constants'
);

console.log('2. Checking HTML parser module...');
checkFileExists(
  path.join(process.cwd(), 'lib/parsers/phabricator-html.ts'),
  'Phabricator HTML parser'
);

console.log('3. Verifying imports in conduitBatch.ts...');
checkFileContains(
  path.join(process.cwd(), 'lib/conduitBatch.ts'),
  'BATCH_CONFIG',
  'conduitBatch uses BATCH_CONFIG'
);
checkFileContains(
  path.join(process.cwd(), 'lib/conduitBatch.ts'),
  'CACHE_CONFIG',
  'conduitBatch uses CACHE_CONFIG'
);

console.log('4. Verifying imports in unstandard API...');
checkFileContains(
  path.join(process.cwd(), 'pages/api/unstandard/index.ts'),
  'parseUnstandardHtml',
  'Unstandard API imports parseUnstandardHtml'
);
checkFileContains(
  path.join(process.cwd(), 'pages/api/unstandard/index.ts'),
  '@/lib/parsers/phabricator-html',
  'Unstandard API imports from parser module'
);

console.log('5. Verifying imports in tasks.tsx...');
checkFileContains(
  path.join(process.cwd(), 'pages/tasks.tsx'),
  'ANIMATION_DURATION',
  'tasks.tsx imports ANIMATION_DURATION'
);
checkFileContains(
  path.join(process.cwd(), 'pages/tasks.tsx'),
  'LIST_TRANSITION_MS',
  'tasks.tsx uses LIST_TRANSITION_MS'
);

console.log('6. Verifying UnstandardWidget imports...');
checkFileContains(
  path.join(process.cwd(), 'components/dashboard/UnstandardWidget.tsx'),
  '@/pages/api/unstandard',
  'UnstandardWidget imports types from API'
);

console.log('7. Checking for removed duplicate code...');
const unstandardApiContent = fs.readFileSync(
  path.join(process.cwd(), 'pages/api/unstandard/index.ts'),
  'utf-8'
);
const duplicatePatterns = [
  'const tableRowRegex =',
  'const cellRegex =',
  'while ((rowMatch = tableRowRegex.exec'
];
duplicatePatterns.forEach(pattern => {
  if (unstandardApiContent.includes(pattern)) {
    warnings.push(`Unstandard API still contains duplicate parsing code: "${pattern}"`);
  }
});

console.log('\n📊 Verification Results:\n');

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ All checks passed! Refactoring is complete and correct.\n');
  process.exit(0);
} else {
  if (errors.length > 0) {
    console.log(`❌ Found ${errors.length} error(s):\n`);
    errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err}`);
    });
    console.log('');
  }
  
  if (warnings.length > 0) {
    console.log(`⚠️  Found ${warnings.length} warning(s):\n`);
    warnings.forEach((warn, i) => {
      console.log(`  ${i + 1}. ${warn}`);
    });
    console.log('');
  }
  
  process.exit(errors.length > 0 ? 1 : 0);
}
