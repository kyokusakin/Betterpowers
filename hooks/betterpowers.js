#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STATE_FILE = path.join(
  process.env.CLAUDE_PLUGIN_DATA || process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'),
  'betterpowers.json',
);
const LEVELS = { talk: ['lite', 'full', 'ultra', 'wenyan'], code: ['lite', 'full', 'ultra'] };
const DEFAULTS = { on: true, talk: 'lite', code: 'full' };
const USAGE = 'Usage: /betterpowers [on | off | talk lite|full|ultra|wenyan | code lite|full|ultra]';
const COMMAND = /^\/betterpowers(?::betterpowers)?(?:\s+(.*))?$/i;

const readRule = (file) => fs.readFileSync(path.join(ROOT, 'rules', file), 'utf8').trim();

// The state file is hand-editable, so it is an entry boundary.
function loadState() {
  let saved = {};
  try {
    saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) ?? {};
  } catch {}
  return {
    on: typeof saved.on === 'boolean' ? saved.on : DEFAULTS.on,
    talk: LEVELS.talk.includes(saved.talk) ? saved.talk : DEFAULTS.talk,
    code: LEVELS.code.includes(saved.code) ? saved.code : DEFAULTS.code,
  };
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state));
}

const levelRules = (state) => [readRule(`talk/${state.talk}.md`), readRule(`code/${state.code}.md`)];

const fullRules = (state) =>
  [
    readRule('core.md'),
    ...levelRules(state),
    `Worked examples: ${path.join(ROOT, 'references', 'examples.md')}`,
  ].join('\n\n');

const describe = (state) =>
  state.on ? `Betterpowers on: talk ${state.talk}, code ${state.code}.` : 'Betterpowers off.';

function applyArgs(state, args) {
  const [first, second] = args;
  if (args.length === 0) return { state };
  if (args.length === 1 && (first === 'on' || first === 'off')) {
    return { state: { ...state, on: first === 'on' } };
  }
  if (args.length === 2 && Object.hasOwn(LEVELS, first) && LEVELS[first].includes(second)) {
    return { state: { ...state, on: true, [first]: second } };
  }
  return { error: USAGE };
}

function contextForPrompt(prompt) {
  const match = COMMAND.exec(prompt.trim());
  if (!match) return '';
  const args = (match[1] ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const before = loadState();
  const { state: after, error } = applyArgs(before, args);
  if (error) return `${error}\nCurrent: ${describe(before)}`;
  if (args.length) saveState(after);

  if (!after.on) {
    return before.on ? `${describe(after)} Stop applying the Betterpowers rules for the rest of this session.` : describe(after);
  }
  if (!before.on) return `${describe(after)}\n\n${fullRules(after)}`;
  if (before.talk === after.talk && before.code === after.code) return describe(after);
  return [`${describe(after)} These levels replace the earlier Betterpowers levels.`, ...levelRules(after)].join('\n\n');
}

function emit(event, context) {
  const output = context
    ? JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: context } })
    : '';
  process.stdout.write(output, () => process.exit(0));
}

const event = process.argv[2];

if (event === 'SessionStart' || event === 'SubagentStart') {
  const state = loadState();
  emit(event, state.on ? fullRules(state) : '');
} else if (event === 'UserPromptSubmit') {
  let input = '';
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    let prompt = '';
    try {
      prompt = String(JSON.parse(input.replace(/^﻿/, '')).prompt ?? '');
    } catch {}
    emit(event, contextForPrompt(prompt));
  };
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', finish);
  process.stdin.on('error', finish);
  // A hook must never block the user's prompt, even when stdin never closes.
  setTimeout(finish, 1000).unref();
}
