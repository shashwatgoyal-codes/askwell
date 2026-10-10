import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { respond, SEND_ANYWAY } from './respond';
import { previousPrompts } from './transcript';

const warn = { mode: 'warn', sensitivity: 'balanced' } as const;
const block = { mode: 'block', sensitivity: 'balanced' } as const;

describe('respond', () => {
  it('stays silent for a complete prompt', () => {
    expect(respond('Fix the 401 on /api/auth/login. Expected: redirect to /dashboard.', [], warn)).toEqual({ code: 0 });
  });

  it('warns the person, without blocking or adding to Claude’s context', () => {
    const result = respond('fix the login bug, same as before', [], warn);
    expect(result.code).toBe(0);
    expect(result.stderr).toBeUndefined();
    const json = JSON.parse(result.stdout!);
    expect(Object.keys(json)).toEqual(['systemMessage']);
    expect(json.systemMessage).toContain('Preflight · 3 gaps');
    expect(json.systemMessage).toContain('Assumed memory');
  });

  it('blocks in block mode, and says how to send anyway', () => {
    const result = respond('fix the login bug, same as before', [], block);
    expect(result.code).toBe(2);
    expect(result.stdout).toBeUndefined();
    expect(result.stderr).toContain(`add ${SEND_ANYWAY} to send it as is`);
  });

  it('lets the person send anyway with the marker', () => {
    expect(respond(`fix the login bug, same as before ${SEND_ANYWAY}`, [], block).code).toBe(0);
  });

  it.each(['/compact', '!npm test', '# remember to use pnpm'])('ignores Claude Code commands: %j', (prompt) => {
    expect(respond(prompt, [], block)).toEqual({ code: 0 });
  });

  it('adds the conversation nudge from earlier prompts', () => {
    const previous = [
      "TypeError: Cannot read properties of undefined (reading 'id') at getUser (auth.ts:42)",
      'now this: PrismaClientKnownRequestError P2025 at updateSession',
    ];
    const json = JSON.parse(respond('another one: 500 on /api/session/refresh', previous, warn).stdout!);
    expect(json.systemMessage).toContain('Third error in a row.');
  });
});

describe('previousPrompts', () => {
  const file = (lines: unknown[]) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'preflight-'));
    const p = path.join(dir, 't.jsonl');
    writeFileSync(p, lines.map((l) => JSON.stringify(l)).join('\n') + '\nnot json\n');
    return p;
  };

  it('keeps only what the person typed, oldest first', () => {
    const p = file([
      { type: 'user', message: { role: 'user', content: 'first prompt here' } },
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'answer' }] } },
      { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'output' }] } },
      { type: 'user', isMeta: true, message: { role: 'user', content: 'meta' } },
      { type: 'user', message: { role: 'user', content: '<command-name>/clear</command-name>' } },
      { type: 'user', message: { role: 'user', content: [{ type: 'text', text: 'second prompt here' }] } },
    ]);
    expect(previousPrompts(p)).toEqual(['first prompt here', 'second prompt here']);
  });

  it('returns nothing for a missing transcript', () => {
    expect(previousPrompts('/nope/missing.jsonl')).toEqual([]);
    expect(previousPrompts(undefined)).toEqual([]);
  });
});
