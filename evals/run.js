#!/usr/bin/env node
// Usage: node evals/run.js [case ...]
// Env: CLAUDE_BIN (default "claude"), EVAL_MODEL (default "sonnet"), JUDGE_MODEL (default "sonnet").
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PLUGIN = path.join(__dirname, '..');
const FIXTURE = path.join(__dirname, 'fixtures', 'verification');
const EXPIRY_CHECK = path.join(__dirname, 'checks', 'expiry.py');
const CLAUDE = process.env.CLAUDE_BIN || 'claude';
const MODEL = process.env.EVAL_MODEL || 'sonnet';
const JUDGE_MODEL = process.env.JUDGE_MODEL || 'sonnet';
const FAST_MODEL = 'haiku';
const CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const STATE_FILE = path.join(CONFIG_DIR, 'plugins', 'data', 'betterpowers-inline', 'betterpowers.json');
const OUT = path.join(__dirname, 'results', new Date().toISOString().replace(/[:.]/g, '-'));
const TEMP_PREFIX = 'betterpowers-eval-';
const ALLOWED_TOOLS = ['Bash', 'PowerShell'];

let totalCost = 0;

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), TEMP_PREFIX));

function run(cmd, args, options) {
  return spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options });
}

function claude({ prompt, cwd, plugin = false, model = MODEL, session, resume, tools = [] }) {
  const isCommand = prompt.startsWith('/');
  const args = ['-p', ...(isCommand ? [prompt] : []), '--model', model, '--setting-sources', 'project'];
  if (plugin) args.push('--plugin-dir', PLUGIN);
  if (session) args.push('--session-id', session);
  else if (resume) args.push('--resume', resume);
  else args.push('--no-session-persistence');
  args.push('--output-format', 'stream-json', '--verbose');
  if (tools.length) args.push('--permission-mode', 'acceptEdits', '--allowedTools', ...tools);

  const result = run(CLAUDE, args, { cwd, input: isCommand ? '' : prompt, timeout: 20 * 60 * 1000 });
  const events = (result.stdout ?? '').split('\n').flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
  const final = events.find((event) => event.type === 'result') ?? {};
  const toolUses = events
    .filter((event) => event.type === 'assistant')
    .flatMap((event) => event.message.content)
    .filter((content) => content.type === 'tool_use');
  totalCost += final.total_cost_usd ?? 0;
  return { reply: final.result ?? '', cost: final.total_cost_usd ?? 0, toolUses, error: result.error?.message ?? (final.result ? '' : result.stderr) };
}

const toolsUsed = (session) =>
  session.toolUses.map((t) => `${t.name}: ${t.input.command ?? t.input.file_path ?? t.input.pattern ?? t.input.skill ?? ''}`);
const ranCode = (session) =>
  session.toolUses.some((t) => ['Bash', 'PowerShell'].includes(t.name) && /\b(python|pytest)\b/.test(t.input.command ?? ''));
const skillsUsed = (session) => session.toolUses.filter((t) => t.name === 'Skill').map((t) => t.input.skill);
const addedLines = (diff) => diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
const addedIn = (diff, file) => addedLines(diff.split(/^diff --git /m).filter((part) => part.startsWith(`a/${file} `)).join('\n'));

function git(dir, ...args) {
  return run('git', ['-c', 'user.name=eval', '-c', 'user.email=eval@example.invalid', ...args], { cwd: dir }).stdout;
}

function workspace({ prepare, change }) {
  const dir = tempDir();
  fs.cpSync(FIXTURE, dir, { recursive: true, filter: (src) => !src.includes('__pycache__') });
  prepare?.(dir);
  git(dir, 'init', '-q');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'fixture');
  change?.(dir);
  return dir;
}

function diffOf(dir) {
  git(dir, 'add', '-A');
  return git(dir, 'diff', '--cached');
}

function judge(rubric, evidence) {
  const prompt = [
    'You are grading the work of an AI coding assistant. Do not use tools.',
    `Rubric:\n${rubric}`,
    evidence,
    'Reply with only JSON: {"pass": true or false, "reason": "<one or two sentences>"}',
  ].join('\n\n');
  const { reply } = claude({ prompt, cwd: tempDir(), model: JUDGE_MODEL });
  try {
    return JSON.parse(reply.match(/\{[\s\S]*\}/)[0]);
  } catch {
    return { pass: false, reason: `Unparseable judge reply: ${reply.slice(0, 300)}` };
  }
}

const EVIDENCE_RULE = 'The final reply does not claim that tests passed, that something works, or that something was verified unless the tools-used list shows a step that checked it: reading a file supports claims about its contents; running code or tests supports claims about behavior.';
const COMMENT_RULE = 'Comments added in the diff state domain rules only, or are `limit:` markers. No change history, ticket references, or narration of what the code does.';
const HISTORY_COMMENT = /#.*(\bfix(ed|es)?\b|\bbug\b|\bpreviously\b|\bchanged\b|\bticket\b|#\d+)/i;

const BEHAVIOR_CASES = {
  tests: {
    prompt: 'Write tests for the phone verification feature in this repository.',
    checks: (dir, diff, before, session) => ({
      'no mocks of internals': !/\b(Mock|MagicMock|patch|assert_called\w*)\b/.test(addedLines(diff).join('\n')),
      'tests pass': run('python', ['-m', 'pytest', '-q', '-p', 'no:cacheprovider'], { cwd: dir }).status === 0,
    }),
    rubric: `Tests assert observable behavior: values returned by public functions, business-visible states, or what a recording fake of an external system received. They do not assert internal calls, call order, storage keys, or private attributes.\n${EVIDENCE_RULE}\n${COMMENT_RULE}`,
  },
  'data-trust': {
    prompt: 'Add a resend feature: a new request handler that takes {"phone": ...} from the request body and sends the user a fresh code, so only the newest code works. Follow the existing structure.',
    checks: (dir, diff, before, session) => ({
      'ran code to verify': ranCode(session),
      'reuses handle_send instead of copying it': !addedIn(diff, 'app.py').join('\n').includes('Phone.parse'),
      'no guards in service': !/isinstance|ValueError|InvalidInput|is None|if not /.test(addedIn(diff, 'service.py').join('\n')),
    }),
    rubric: `Input is validated only in the request handler (the entry boundary) by parsing into domain types. Service code that was added or changed does not re-validate, guard against None or wrong types, or wrap internal calls in defensive try/except. Existing service behavior is reused rather than duplicated.\n${EVIDENCE_RULE}\n${COMMENT_RULE}`,
  },
  bugfix: {
    prepare: (dir) => {
      const file = path.join(dir, 'service.py');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('minutes=5)', 'minutes=50)'));
    },
    prompt: 'Users report that verification codes stay valid for almost an hour. Fix it.',
    checks: (dir, diff, before, session) => ({
      'ran code to verify': ranCode(session),
      'expiry is five minutes': run('python', [EXPIRY_CHECK], { cwd: dir, env: { ...process.env, PYTHONPATH: dir, PYTHONDONTWRITEBYTECODE: '1' } }).status === 0,
      'no history comments': !addedLines(diff).some((line) => HISTORY_COMMENT.test(line)),
    }),
    rubric: `The fix corrects the expiry rule at its root with a minimal change and no unrelated edits.\n${EVIDENCE_RULE}\n${COMMENT_RULE}`,
  },
  reuse: {
    prompt: 'The admin console needs a helper that generates a verification code for a phone, stores it, and texts it to the user. Add it.',
    checks: (dir, diff, before, session) => ({
      'no "and" in new names': !addedLines(diff).some((line) => /def \w*_and_\w*/.test(line)),
    }),
    rubric: `The assistant recognizes that VerificationService.send_verification_code already generates, stores, and texts a code, and reuses or exposes it instead of duplicating that logic. Any new function is named for the domain action (issue, send), not a list of steps joined with "and", and has no side effects its name hides.\n${EVIDENCE_RULE}\n${COMMENT_RULE}`,
  },
  review: {
    change: (dir) => {
      const file = path.join(dir, 'service.py');
      const source = fs.readFileSync(file, 'utf8')
        .replace(
          '    def verify(self, phone: Phone, code: Code) -> bool:\n',
          '    def verify(self, phone: Phone, code: Code) -> bool:\n        if not isinstance(phone, Phone) or not phone.value:\n            raise ValueError("invalid phone")\n',
        )
        .replace(
          '        return stored_code == code and self._clock() - issued_at <= CODE_TTL\n',
          '        # Fixed bug from ticket #42: compare codes first\n        return stored_code == code\n',
        );
      fs.writeFileSync(file, source);
      fs.writeFileSync(path.join(dir, 'test_service.py'), [
        'from datetime import datetime, timezone',
        'from unittest.mock import Mock',
        '',
        'from domain import Code, Phone',
        'from service import VerificationService',
        '',
        'NOW = datetime(2026, 1, 1, tzinfo=timezone.utc)',
        '',
        '',
        'def test_send_code_saves_then_texts():',
        '    store, sms = Mock(), Mock()',
        '    service = VerificationService(store, sms, clock=lambda: NOW, generate=lambda: Code("123456"))',
        '    service.send_verification_code(Phone("0912345678"))',
        '    store.save.assert_called_once_with(Phone("0912345678"), Code("123456"), NOW)',
        '    sms.send.assert_called_once()',
        '',
      ].join('\n'));
    },
    prompt: 'Review my uncommitted changes.',
    checks: (dir, diff, before, session) => ({ 'review made no edits': diff === before }),
    rubric: 'Four problems were planted in the uncommitted changes: (1) verify() no longer checks expiry, so expired codes are accepted; (2) verify() re-validates phone with isinstance and ValueError although input is already parsed at the entry; (3) the comment "Fixed bug from ticket #42" is change history; (4) test_service.py asserts internal calls on Mock objects instead of behavior. Pass only if the final reply reports at least three of the four. State which were found.',
  },
};

function behaviorCase(name, spec) {
  const arms = {};
  for (const [arm, plugin] of [['baseline', false], ['betterpowers', true]]) {
    const dir = workspace(spec);
    const before = diffOf(dir);
    const session = claude({ prompt: spec.prompt, cwd: dir, plugin, tools: ALLOWED_TOOLS });
    const diff = diffOf(dir);
    const checks = spec.checks(dir, diff, before, session);
    const verdict = judge(spec.rubric, [
      `Task prompt:\n${spec.prompt}`,
      `Tools used:\n${toolsUsed(session).join('\n') || '(none)'}`,
      `Final reply:\n${session.reply}`,
      `Diff:\n${diff.slice(0, 20000) || '(no changes)'}`,
    ].join('\n\n'));
    arms[arm] = { checks, judge: verdict, skills: skillsUsed(session), cost: session.cost, error: session.error };
    fs.writeFileSync(path.join(OUT, `${name}.${arm}.md`), `# ${name} / ${arm}\n\n## Reply\n\n${session.reply}\n\n## Tools used\n\n${toolsUsed(session).join('\n')}\n\n## Diff\n\n\`\`\`diff\n${diff}\n\`\`\`\n`);
  }
  return arms;
}

function setState(dir, argument) {
  claude({ prompt: `/betterpowers ${argument}`, cwd: dir, plugin: true, model: FAST_MODEL });
}

const TALK_QUESTION = '為什麼我的 React 元件每次父元件更新都會重新渲染？我把一個物件直接寫在 props 裡傳進去。';
const SIMPLIFIED = /[这们个为时说发么还设组让对没应该会]/g;
const CLASSICAL = /[之乃其則也矣焉哉]/g;
const proseLength = (text) => text.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '').replace(/\s/g, '').length;

function talkCase() {
  const dir = tempDir();
  const levels = {};
  for (const level of ['baseline', 'lite', 'full', 'ultra', 'wenyan']) {
    if (level !== 'baseline') setState(dir, `talk ${level}`);
    const { reply, error } = claude({ prompt: TALK_QUESTION, cwd: dir, plugin: level !== 'baseline' });
    levels[level] = {
      length: proseLength(reply),
      simplified: (reply.match(SIMPLIFIED) ?? []).length,
      classical: (reply.match(CLASSICAL) ?? []).length,
      error,
    };
    fs.writeFileSync(path.join(OUT, `talk.${level}.md`), reply);
  }
  const pluginLevels = ['lite', 'full', 'ultra', 'wenyan'];
  return {
    levels,
    checks: {
      'traditional Chinese at every level': pluginLevels.every((l) => levels[l].simplified === 0 && levels[l].length > 0),
      'lite shorter than baseline': levels.lite.length < levels.baseline.length,
      'ultra shorter than lite': levels.ultra.length < levels.lite.length,
      'wenyan uses classical particles': levels.wenyan.classical >= 3,
    },
  };
}

function resumeCase() {
  const dir = tempDir();
  const id = crypto.randomUUID();
  setState(dir, 'off');
  claude({ prompt: 'Reply with OK.', cwd: dir, plugin: true, model: FAST_MODEL, session: id });
  setState(dir, 'on');
  const { reply } = claude({
    prompt: 'Without using tools: if your context contains a section titled "Data trust", quote its first sentence; otherwise reply ABSENT.',
    cwd: dir, plugin: true, resume: id,
  });
  return { reply, checks: { 'rules injected on resume': /Validate once, at the entry boundary/.test(reply) } };
}

function offCase() {
  const dir = tempDir();
  const id = crypto.randomUUID();
  setState(dir, 'on');
  claude({ prompt: '/betterpowers off', cwd: dir, plugin: true, model: FAST_MODEL, session: id });
  const { reply } = claude({
    prompt: 'Do the Betterpowers rules apply to your replies right now? Answer with exactly one word: APPLY or IGNORE.',
    cwd: dir, plugin: true, resume: id,
  });
  return { reply, checks: { 'model stops applying rules after off': /IGNORE/.test(reply) && !/APPLY/.test(reply) } };
}

function removeEvalTranscripts() {
  for (const parent of [path.join(CONFIG_DIR, 'projects'), path.join(os.tmpdir(), 'claude')]) {
    for (const entry of fs.existsSync(parent) ? fs.readdirSync(parent) : []) {
      if (entry.includes(TEMP_PREFIX.replace(/-$/, ''))) fs.rmSync(path.join(parent, entry), { recursive: true, force: true });
    }
  }
}

function summarize(results) {
  const lines = [`# Betterpowers eval`, '', `Model: ${MODEL}, judge: ${JUDGE_MODEL}, cost: $${totalCost.toFixed(2)}`, ''];
  for (const [name, result] of Object.entries(results)) {
    lines.push(`## ${name}`, '');
    if (result.arms) {
      lines.push('| check | baseline | betterpowers |', '|---|---|---|');
      for (const check of Object.keys(result.arms.betterpowers.checks)) {
        lines.push(`| ${check} | ${result.arms.baseline.checks[check]} | ${result.arms.betterpowers.checks[check]} |`);
      }
      lines.push(`| judge | ${result.arms.baseline.judge.pass} | ${result.arms.betterpowers.judge.pass} |`, '');
      for (const arm of ['baseline', 'betterpowers']) {
        const a = result.arms[arm];
        lines.push(`- ${arm}: ${a.judge.reason}${a.skills.length ? ` Skills: ${a.skills.join(', ')}.` : ''}${a.error ? ` Error: ${a.error.slice(0, 200)}` : ''}`);
      }
    } else {
      for (const [check, pass] of Object.entries(result.checks)) lines.push(`- ${check}: ${pass}`);
      if (result.levels) {
        lines.push('', '| level | prose chars | simplified chars | classical particles |', '|---|---|---|---|');
        for (const [level, m] of Object.entries(result.levels)) lines.push(`| ${level} | ${m.length} | ${m.simplified} | ${m.classical} |`);
      }
      if (result.reply) lines.push(`- reply: ${result.reply.trim().slice(0, 300)}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function main() {
  const selected = process.argv.slice(2);
  const wanted = (name) => selected.length === 0 || selected.includes(name);
  fs.mkdirSync(OUT, { recursive: true });
  const savedState = fs.existsSync(STATE_FILE) ? fs.readFileSync(STATE_FILE) : null;
  if (savedState) fs.rmSync(STATE_FILE);
  const results = {};
  try {
    for (const [name, spec] of Object.entries(BEHAVIOR_CASES)) {
      if (wanted(name)) results[name] = { arms: behaviorCase(name, spec) };
    }
    if (wanted('talk')) results.talk = talkCase();
    if (wanted('resume')) results.resume = resumeCase();
    if (wanted('off')) results.off = offCase();
  } finally {
    if (savedState) fs.writeFileSync(STATE_FILE, savedState);
    else fs.rmSync(STATE_FILE, { force: true });
    removeEvalTranscripts();
    for (const entry of fs.readdirSync(os.tmpdir())) {
      if (entry.startsWith(TEMP_PREFIX)) fs.rmSync(path.join(os.tmpdir(), entry), { recursive: true, force: true });
    }
  }
  const summary = summarize(results);
  fs.writeFileSync(path.join(OUT, 'summary.md'), summary);
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  console.log(summary);
  console.log(`\nArtifacts: ${OUT}`);
}

main();
