const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

test('creates a missing environments directory before writing files', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ucv-market-env-'));

  try {
    fs.copyFileSync(path.join(__dirname, 'generate-env.js'), path.join(tempDir, 'generate-env.js'));

    const result = spawnSync(process.execPath, ['generate-env.js'], {
      cwd: tempDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_KEY: 'ci-public-anon-key',
      },
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(
      fs.readFileSync(path.join(tempDir, 'src', 'environments', 'environment.ts'), 'utf8'),
      /production: false/,
    );
    assert.match(
      fs.readFileSync(path.join(tempDir, 'src', 'environments', 'environment.prod.ts'), 'utf8'),
      /production: true/,
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
