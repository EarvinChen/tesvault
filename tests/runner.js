const path = require('path');
const Module = require('module');
const fs = require('fs');

// Write vitest mock
fs.writeFileSync('/tmp/vitest-mock.js', `
function createMockFn(impl) {
  const calls = [];
  let resolvedWith = undefined;
  let rejectedWith = null;
  const fn = function(...args) {
    calls.push({ args });
    if (rejectedWith) return Promise.reject(rejectedWith);
    if (typeof impl === 'function') return impl(...args);
    return Promise.resolve(resolvedWith);
  };
  fn.mock = { calls };
  fn.mockResolvedValue = (v) => { resolvedWith = v; return fn; };
  fn.mockRejectedValue = (e) => { rejectedWith = e; return fn; };
  return fn;
}
const vi = {
  fn: (impl) => createMockFn(impl),
  stubGlobal: (name, val) => { global[name] = val; },
};
module.exports = { describe: global.describe, it: global.it, expect: global.expect, vi, beforeEach: global.beforeEach || (() => {}), afterEach: global.afterEach || (() => {}) };
`);

// Resolve aliases
const _resolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...args) {
  if (request === 'vitest') return '/tmp/vitest-mock.js';
  if (request.startsWith('@/')) {
    request = path.join('/tmp/tesvault-test/src', request.slice(2));
  }
  return _resolveFilename.call(this, request, parent, ...args);
};

// Test state
global.beforeEach = () => {};
global.afterEach = () => {};
let currentSuite = '';
let currentItName = '';
let passed = 0, failed = 0;
const failures = [];
const asyncTests = [];

// Catch errors thrown from setTimeout inside async tests
process.on('uncaughtException', (err) => {
  failed++;
  failures.push({ suite: currentSuite, name: currentItName + ' (async)', err });
  process.stdout.write('  ✗ ' + currentItName + ' (async)\n    ' + err.message + '\n');
});

global.describe = (name, fn) => {
  currentSuite = name;
  process.stdout.write('\n' + name + '\n');
  fn();
};

global.it = (name, fn) => {
  currentItName = name;
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      const p = result.then(() => {
        passed++;
        process.stdout.write('  ✓ ' + name + '\n');
      }).catch(err => {
        failed++;
        failures.push({ suite: currentSuite, name, err });
        process.stdout.write('  ✗ ' + name + '\n    ' + err.message + '\n');
      });
      asyncTests.push(p);
      return;
    }
    passed++;
    process.stdout.write('  ✓ ' + name + '\n');
  } catch(err) {
    failed++;
    failures.push({ suite: currentSuite, name, err });
    process.stdout.write('  ✗ ' + name + '\n    ' + err.message + '\n');
  }
};

const expectVal = (actual) => ({
  toBe: (e) => { if (actual !== e) throw new Error('toBe: expected ' + JSON.stringify(e) + ', got ' + JSON.stringify(actual)); },
  toEqual: (e) => {
    const toStr = v => v instanceof Date ? v.toISOString() : JSON.stringify(v);
    if (toStr(actual) !== toStr(e)) throw new Error('toEqual: expected ' + toStr(e) + ', got ' + toStr(actual));
  },
  toHaveLength: (n) => { const len = actual == null ? -1 : actual.length; if (len !== n) throw new Error('toHaveLength: expected ' + n + ', got ' + len); },
  toContain: (item) => { if (!(actual||[]).includes(item)) throw new Error('toContain: ' + JSON.stringify(item) + ' not found'); },
  toBeDefined: () => { if (actual === undefined) throw new Error('toBeDefined: got undefined'); },
  toBeUndefined: () => { if (actual !== undefined) throw new Error('toBeUndefined: got ' + JSON.stringify(actual)); },
  toBeTruthy: () => { if (!actual) throw new Error('toBeTruthy: got ' + actual); },
  toBeFalsy: () => { if (actual) throw new Error('toBeFalsy: got ' + actual); },
  toBeCloseTo: (e, p) => { const diff = Math.abs(actual - e); const prec = Math.pow(10, -(p==null?2:p)); if (diff >= prec) throw new Error('toBeCloseTo: diff=' + diff + ' >= ' + prec); },
  toBeGreaterThan: (e) => { if (actual <= e) throw new Error('toBeGreaterThan: ' + actual + ' <= ' + e); },
  not: {
    toBe: (e) => { if (actual === e) throw new Error('not.toBe: expected not ' + JSON.stringify(e)); },
    toBeDefined: () => { if (actual !== undefined) throw new Error('not.toBeDefined: got ' + actual); },
    toThrow: () => { try { actual(); } catch(err) { throw new Error('not.toThrow: threw ' + err.message); } },
  },
  toHaveBeenCalled: () => { if (!actual || !actual.mock || actual.mock.calls.length === 0) throw new Error('toHaveBeenCalled: mock not called'); },
});
global.expect = expectVal;

console.log('=== TesVault Unit Tests ===');
const OUT = '/tmp/tesvault-test';
require(OUT + '/tests/unit/parser.test.js');
require(OUT + '/tests/unit/clip-navigation.test.js');
require(OUT + '/tests/unit/sync-engine.test.js');

// Wrap each async test with a 5-second timeout so a hanging Promise doesn't block the runner
const timedTests = asyncTests.map(p =>
  Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error('test timed out (5s)')), 5000))])
    .catch(() => {}) // individual test errors already logged above
);

Promise.all(timedTests).then(() => {
  const total = passed + failed;
  console.log('\n─────────────────────────────────────────');
  console.log(total + ' tests: ' + passed + ' passed, ' + failed + ' failed');
  if (failures.length > 0) {
    console.log('\nFailed:');
    failures.forEach(f => console.log('  [' + f.suite + '] ' + f.name + '\n    → ' + f.err.message));
    process.exit(1);
  }
  console.log('All tests passed! ✓');
}).catch(err => {
  console.error('Runner error:', err);
  process.exit(1);
});
