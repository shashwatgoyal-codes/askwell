import { analyze, type Analysis } from './analyze';

export type CheckId = 'assumedMemory' | 'context' | 'goal' | 'constraints' | 'output';

export type Sensitivity = 'relaxed' | 'balanced' | 'strict';

export interface Gap {
  id: CheckId;
  /** What is missing, in one sentence. */
  message: string;
  /** How to fix it. */
  hint: string;
}

export interface CheckOptions {
  /** Relaxed flags only what will certainly cost a round trip; strict flags everything. */
  sensitivity?: Sensitivity;
  /** Checks the user has switched off. */
  disabled?: readonly CheckId[];
}

interface Check {
  id: CheckId;
  /** The least sensitive setting at which this check runs. */
  from: Sensitivity;
  run: (prompt: string, a: Analysis) => Omit<Gap, 'id'> | null;
}

// Phrases that lean on context the model was never given. The chat it is
// typed into starts empty, so "as you know" points at nothing.
const ASSUMED_MEMORY = [
  /\bas you know\b/i,
  /\b(same|like|as) (as )?before\b/i,
  /\bas (we )?discussed\b/i,
  /\blike last time\b/i,
  /\byou (already )?know (the|my|our)\b/i,
];

const GOAL =
  /\b(expect(ed|ing)?|should|so that|so it|instead( of)?|want(ed)? (it|this|to)|needs? to|supposed to|must|goal|result|outcome|until|make sure|to be (able|\w+(er|able|ible|less))|into)\b|→|->/i;

const CONSTRAINT =
  /\b(don['’]?t|do not|without|keep|only|must not|mustn['’]?t|avoid|preserve|leave|unchanged|no (new )?(dependencies|deps|libraries|packages)|stick to|backwards? compatible)\b|\b(node|react|next(\.js)?|python|typescript|java|go|postgres(ql)?|prisma)\s*v?\d+(\.\d+)*\b/i;

const OUTPUT =
  /\b(diff|patch|full (file|code)|whole file|snippet|only the (code|fix)|just the (code|fix)|explain|explanation|walk me through|step[- ]by[- ]step|steps|list|bullet|table|json|yaml|markdown|summary|summari[sz]e|brief(ly)?|short|concise|one line|in \d+ (words|lines|sentences)|example|comments?|tests?)\b/i;

// Order is priority: the panel shows the first gaps it gets.
const CHECKS: Check[] = [
  {
    id: 'assumedMemory',
    from: 'relaxed',
    run: (prompt) => {
      const hit = ASSUMED_MEMORY.map((re) => prompt.match(re)).find(Boolean);
      if (!hit) return null;
      return {
        message: `“${hit[0]}” points to context this chat doesn’t have.`,
        hint: 'Add a line saying what that context is.',
      };
    },
  },
  {
    id: 'context',
    from: 'relaxed',
    run: (_, a) => {
      if (a.unseenReference) {
        return {
          message: `“${a.unseenReference}” isn’t in the prompt.`,
          hint: 'Paste it in. The AI only sees what is in this message.',
        };
      }
      if (a.reportsBug && !a.hasEvidence && a.words < 80) {
        return {
          message: 'You mention a bug, but no error is attached.',
          hint: 'Paste the error or the failing request, the whole thing rather than a summary.',
        };
      }
      return null;
    },
  },
  {
    id: 'goal',
    from: 'balanced',
    run: (_, a) => {
      if (!(a.reportsBug || a.vagueImprovement) || GOAL.test(a.prose) || a.words >= 60) return null;
      return {
        message: 'It isn’t clear what working looks like.',
        hint: 'Add the result you expect, e.g. “Expected: redirect to /dashboard.”',
      };
    },
  },
  {
    id: 'constraints',
    from: 'strict',
    run: (_, a) => {
      if (!a.changesCode || CONSTRAINT.test(a.prose)) return null;
      return {
        message: 'Nothing says what must stay the same.',
        hint: 'Name what must not change: files, APIs, versions or dependencies.',
      };
    },
  },
  {
    id: 'output',
    from: 'strict',
    run: (_, a) => {
      if (!(a.changesCode || a.reportsBug) || OUTPUT.test(a.prose)) return null;
      return {
        message: 'It doesn’t say what you want back.',
        hint: 'Ask for a patch, the full file, or an explanation.',
      };
    },
  },
];

const RANK: Record<Sensitivity, number> = { relaxed: 0, balanced: 1, strict: 2 };

/** Below this many words the person is still typing; say nothing yet. */
const MIN_WORDS = 3;

export function runChecks(prompt: string, options: CheckOptions = {}): Gap[] {
  const level = RANK[options.sensitivity ?? 'balanced'];
  const disabled = new Set(options.disabled ?? []);
  const a = analyze(prompt);
  if (a.words < MIN_WORDS) return [];

  const gaps: Gap[] = [];
  for (const check of CHECKS) {
    if (RANK[check.from] > level || disabled.has(check.id)) continue;
    const gap = check.run(prompt, a);
    if (gap) gaps.push({ id: check.id, ...gap });
  }
  return gaps;
}
export { checkSession, type Nudge, type NudgeId, type Session } from './session';
