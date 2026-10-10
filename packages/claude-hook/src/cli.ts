import type { Sensitivity } from '@askwell/rules';
import { respond, type Mode } from './respond';
import { previousPrompts } from './transcript';

// Claude Code runs this on every prompt (UserPromptSubmit) and passes the
// prompt as JSON on stdin. A failure here must never stop the person
// working, so anything unexpected ends quietly with exit 0.
//
//   PREFLIGHT_MODE=warn|block            default warn
//   PREFLIGHT_SENSITIVITY=relaxed|balanced|strict   default balanced

interface Input {
  prompt?: string;
  transcript_path?: string;
}

async function main(): Promise<void> {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  const input = JSON.parse(raw) as Input;
  const prompt = input.prompt;
  if (typeof prompt !== 'string') return;

  const mode: Mode = process.env.PREFLIGHT_MODE === 'block' ? 'block' : 'warn';
  const level = process.env.PREFLIGHT_SENSITIVITY;
  const sensitivity: Sensitivity = level === 'relaxed' || level === 'strict' ? level : 'balanced';

  // The transcript ends with the prompt being checked; leave it out of "previous".
  const previous = previousPrompts(input.transcript_path).filter((p) => p !== prompt.trim());
  const result = respond(prompt, previous, { mode, sensitivity });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.code;
}

main().catch(() => {
  process.exitCode = 0;
});
