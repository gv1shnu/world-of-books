// Minimal test to see if Node.js works
console.log('=== TEST SCRIPT ===');
console.log('Node works!');
console.log('Node version:', process.version);
console.log('==================');

// Try importing modules one by one to find the culprit
console.log('Testing @nestjs/core...');
try {
    require('@nestjs/core');
    console.log('✓ @nestjs/core OK');
} catch (e) {
    console.error('✗ @nestjs/core FAILED:', e.message);
}

console.log('Testing @nestjs/bull...');
try {
    require('@nestjs/bull');
    console.log('✓ @nestjs/bull OK');
} catch (e) {
    console.error('✗ @nestjs/bull FAILED:', e.message);
}

console.log('Testing bull...');
try {
    require('bull');
    console.log('✓ bull OK');
} catch (e) {
    console.error('✗ bull FAILED:', e.message);
}

console.log('Testing @prisma/client...');
try {
    require('@prisma/client');
    console.log('✓ @prisma/client OK');
} catch (e) {
    console.error('✗ @prisma/client FAILED:', e.message);
}

console.log('Testing playwright...');
try {
    require('playwright');
    console.log('✓ playwright OK');
} catch (e) {
    console.error('✗ playwright FAILED:', e.message);
}

console.log('Testing crawlee...');
try {
    require('crawlee');
    console.log('✓ crawlee OK');
} catch (e) {
    console.error('✗ crawlee FAILED:', e.message);
}

console.log('=== ALL TESTS DONE ===');

// Force exit to ensure script terminates (modules may have open handles)
process.exit(0);
