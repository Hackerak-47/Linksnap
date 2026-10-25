const { spawnSync } = require('node:child_process');
const path = require('node:path');
const result = spawnSync(process.execPath, ['--test', path.join(__dirname, '../test/integration.test.js')], {
  stdio: 'inherit', env: { ...process.env, LINKSNAP_DB_TESTS: '1' },
});
process.exitCode = result.status ?? 1;
