import { checkSession, runChecks, type CheckId, type Sensitivity } from '@askwell/rules';

// What the hook does with one prompt, as a pure function: the CLI only
// reads stdin and writes these out. Kept separate so it can be tested.

export type Mode = 'warn' | 'block';

export interface HookOptions {
  mode: Mode;
  sensitivity: Sensitivity;
}

export interface HookResult {
  /** JSON for Claude Code on stdout, or nothing. */
  stdout?: string;
  /** Shown to the person when the prompt is blocked (exit 2). */
  stderr?: string;
  code: 0 | 2;
}

const LABEL: Record<CheckId, string> = {
  assumedMemory: 'Assumed memory',
  context: 'Context',
  goal: 'Goal',
  constraints: 'Constraints',
  output: 'Output',
};

/** Typed anywhere in a prompt, sends it as is in block mode. */
export const SEND_ANYWAY = '#go';

// Slash commands, shell mode and memory notes are instructions to Claude
// Code itself, not prompts to coach.
const NOT_A_PROMPT = /^\s*[/!#]/;

export function respond(prompt: string, previous: string[], options: HookOptions): HookResult {
  if (NOT_A_PROMPT.test(prompt)) return { code: 0 };

  const gaps = runChecks(prompt, { sensitivity: options.sensitivity });
  const nudge = checkSession({ previous, draft: prompt });
  if (gaps.length === 0 && !nudge) return { code: 0 };

  const lines = [`Preflight · ${gaps.length ? `${gaps.length} ${gaps.length === 1 ? 'gap' : 'gaps'}` : 'a habit worth a look'}`];
  for (const gap of gaps) lines.push(`  ${LABEL[gap.id]}: ${gap.message} ${gap.hint}`);
  if (nudge) lines.push(`  ${nudge.title} ${nudge.body}`);

  if (options.mode === 'block' && gaps.length > 0 && !prompt.includes(SEND_ANYWAY)) {
    lines.push(`  Not sent. Edit the prompt, or add ${SEND_ANYWAY} to send it as is.`);
    return { stderr: lines.join('\n'), code: 2 };
  }

  // systemMessage is shown to the person; nothing is added to Claude's context.
  return { stdout: JSON.stringify({ systemMessage: lines.join('\n') }), code: 0 };
}
