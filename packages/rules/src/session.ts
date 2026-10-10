import { analyze } from './analyze';

// Habits that cost a round trip no single prompt can show: they only appear
// across the conversation. Each nudge carries a template the person can drop
// into the prompt box instead of retyping the advice.

export type NudgeId = 'sequentialFixing' | 'repeatLoop' | 'contextLoss' | 'learningLoop';

export interface Nudge {
  id: NudgeId;
  title: string;
  body: string;
  action: string;
  /** What "Insert" puts in the prompt box, built around the current draft. */
  template: string;
}

export interface Session {
  /** The person's earlier messages in this chat, oldest first. */
  previous: string[];
  /** What is in the prompt box now. */
  draft: string;
}

const words = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

/** A short message whose whole point is one failure. */
function isLoneError(text: string): boolean {
  const a = analyze(text);
  return (a.reportsBug || a.hasEvidence) && a.words < 80;
}

const SAME_AGAIN =
  /\b(same (thing|fix|change|for)|do (the same|this|that|it) (for|to|in|on)|(now|also) (do|fix|change|update) (it|this|that|the same) (for|in|to|on)|again (for|in|on)|repeat (this|that|it) for)\b/i;

const CARRY_OVER =
  /\b(continue|carry on|pick up|where we left off|from (the )?last (chat|time|session)|the (app|project|code|repo) we (built|made|wrote)|our (app|project|code|repo)|as (we|i) (said|discussed))\b/i;

const WRAP_UP = /^\s*(thanks|thank you|great|perfect|awesome|nice|cool|that (works|worked|fixed it)|it works( now)?|all good|done|ok(ay)?,? (that|it) works)\b/i;

/** A long chat is where corrections pile up; below this it is not worth a summary. */
const LONG_SESSION = 10;

export function checkSession({ previous, draft }: Session): Nudge | null {
  if (words(draft) < 3 && !WRAP_UP.test(draft)) return null;

  const trailing: string[] = [];
  for (let i = previous.length - 1; i >= 0 && isLoneError(previous[i]!); i--) trailing.unshift(previous[i]!);
  if (trailing.length >= 2 && isLoneError(draft)) {
    return {
      id: 'sequentialFixing',
      title: `${ordinal(trailing.length + 1)} error in a row.`,
      body: 'These look related. Paste the whole log in one message and ask for every fix at once: one round instead of several.',
      action: 'Insert template',
      template: `Here is everything failing, together:\n\n${draft.trim()}\n[paste the rest of the log here]\n\nFix all of it in one change, and tell me what the failures have in common.`,
    };
  }

  if (SAME_AGAIN.test(draft) && previous.slice(-4).some((message) => SAME_AGAIN.test(message))) {
    return {
      id: 'repeatLoop',
      title: 'Same fix, again.',
      body: 'Asking for it one place at a time costs a round trip each. Ask for it everywhere at once.',
      action: 'Insert template',
      template: `Apply the same change everywhere it is needed, not one place at a time: [list every file or place, or say "find them all"].\nShow me each change.\n\n${draft.trim()}`,
    };
  }

  if (previous.length === 0 && CARRY_OVER.test(draft)) {
    return {
      id: 'contextLoss',
      title: 'Starting fresh?',
      body: 'This chat has none of your earlier work. Three lines on where things stand save the first few answers.',
      action: 'Add summary lines',
      template: `Where things stand:\n- Done: [what already works]\n- Broken: [what is failing]\n- Next: [what you want now]\n\n${draft.trim()}`,
    };
  }

  if (previous.length >= LONG_SESSION && WRAP_UP.test(draft)) {
    return {
      id: 'learningLoop',
      title: 'Long session, wrapping up.',
      body: 'Before you go, have this chat write down what you corrected along the way, so next time starts from it.',
      action: 'Ask for a summary',
      template:
        'Before we stop: list every correction I made in this session as short, reusable rules (what I asked for, what was wrong, what fixed it). Keep it under 10 lines so I can save it for next time.',
    };
  }

  return null;
}

function ordinal(n: number): string {
  return ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth'][n] ?? `${n}th`;
}
