const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { test } = require('node:test');

const HOOK = path.join(__dirname, 'betterpowers.js');

function session() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'betterpowers-'));
  const run = (event, input = '') => {
    const { stdout } = spawnSync(process.execPath, [HOOK, event], {
      input,
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PLUGIN_DATA: dataDir },
    });
    return stdout ? JSON.parse(stdout).hookSpecificOutput.additionalContext : '';
  };
  return {
    dataDir,
    start: () => run('SessionStart'),
    subagent: () => run('SubagentStart'),
    prompt: (text) => run('UserPromptSubmit', JSON.stringify({ prompt: text })),
  };
}

test('new install starts with core rules at talk lite and code full', () => {
  const context = session().start();
  assert.match(context, /# Betterpowers/);
  assert.match(context, /Talk level: lite/);
  assert.match(context, /Code level: full/);
});

test('subagents receive the same rules', () => {
  assert.match(session().subagent(), /## Data trust/);
});

test('changing a level applies now and in later sessions', () => {
  const s = session();
  assert.match(s.prompt('/betterpowers talk ultra'), /Talk level: ultra/);
  assert.match(s.start(), /Talk level: ultra/);
  assert.match(s.prompt('/betterpowers:betterpowers code lite'), /Code level: lite/);
  assert.match(s.start(), /Talk level: ultra[\s\S]*Code level: lite/);
});

test('off stops injection until turned back on', () => {
  const s = session();
  assert.match(s.prompt('/betterpowers off'), /Stop applying/);
  assert.strictEqual(s.start(), '');
  assert.strictEqual(s.subagent(), '');
  assert.match(s.prompt('/betterpowers on'), /# Betterpowers/);
  assert.match(s.start(), /# Betterpowers/);
});

test('invalid arguments show usage and keep the state', () => {
  const s = session();
  assert.match(s.prompt('/betterpowers talk loud'), /Usage:[\s\S]*talk lite, code full/);
  assert.match(s.prompt('/betterpowers constructor full'), /Usage:/);
  assert.match(s.start(), /Talk level: lite/);
});

test('a hand-corrupted state file falls back to defaults', () => {
  const s = session();
  fs.writeFileSync(path.join(s.dataDir, 'betterpowers.json'), '{"talk":"loud","on":"yes"}');
  assert.match(s.start(), /Talk level: lite/);
  fs.writeFileSync(path.join(s.dataDir, 'betterpowers.json'), 'null');
  assert.match(s.start(), /# Betterpowers/);
});

test('ordinary prompts add nothing', () => {
  const s = session();
  assert.strictEqual(s.prompt('fix the login bug'), '');
  assert.strictEqual(s.prompt('please run /betterpowers off later'), '');
});

test('a prompt hook whose stdin never closes still exits promptly', async () => {
  const started = Date.now();
  const child = spawn(process.execPath, [HOOK, 'UserPromptSubmit'], { stdio: ['pipe', 'pipe', 'pipe'] });
  const code = await new Promise((resolve) => child.on('exit', resolve));
  assert.strictEqual(code, 0);
  assert.ok(Date.now() - started < 3000);
});
