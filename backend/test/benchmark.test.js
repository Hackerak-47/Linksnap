const { test } = require('node:test');
const assert = require('node:assert/strict');
const { summarize } = require('../scripts/benchmark');
test('benchmark percentiles use nearest rank, preserve outliers and distinguish no samples', () => {
  assert.deepEqual(summarize([]), { average: null, p50: null, p95: null, p99: null, max: null });
  assert.deepEqual(summarize([9]), { average: 9, p50: 9, p95: 9, p99: 9, max: 9 });
  const values = Array.from({ length: 100 }, (_, i) => 100 - i);
  assert.deepEqual(summarize(values), { average: 50.5, p50: 50, p95: 95, p99: 99, max: 100 });
  assert.equal(values[0], 100);
});
