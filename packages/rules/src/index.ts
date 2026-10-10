export type CheckId = 'goal' | 'context' | 'constraints' | 'output' | 'assumedMemory';

export interface Gap {
  id: CheckId;
  /** What is missing, in one sentence. */
  message: string;
  /** How to fix it. */
  hint: string;
}

type Check = (prompt: string) => Gap | null;

// Phrases that lean on context the model was never given. The chat it is
// typed into starts empty, so "as you know" points at nothing.
const ASSUMED_MEMORY = [
  /\bas you know\b/i,
  /\b(same|like|as) (as )?before\b/i,
  /\bas (we )?discussed\b/i,
  /\blike last time\b/i,
  /\byou (already )?know (the|my|our)\b/i,
];

const assumedMemory: Check = (prompt) => {
  const hit = ASSUMED_MEMORY.map((re) => prompt.match(re)).find(Boolean);
  if (!hit) return null;
  return {
    id: 'assumedMemory',
    message: `“${hit[0]}” points to context this chat doesn’t have.`,
    hint: 'Add a line saying what that context is.',
  };
};

// Goal, context, constraints and output arrive with the checks engine.
const CHECKS: Check[] = [assumedMemory];

export function runChecks(prompt: string): Gap[] {
  return CHECKS.map((check) => check(prompt)).filter((gap): gap is Gap => gap !== null);
}
