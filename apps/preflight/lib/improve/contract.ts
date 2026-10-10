import type { CheckId, Gap } from '@askwell/rules';
import { z } from 'zod';

// Extensions forbid eval. Zod would probe for it and fall back on its own;
// saying so up front skips the probe and the CSP error it logs.
z.config({ jitless: true });

// What every provider must return, whichever SDK produced it.

export const CHANGE_KINDS = ['assumedMemory', 'context', 'goal', 'constraints', 'output', 'clarity'] as const;

export const Improvement = z.object({
  rewrite: z.string().min(1),
  changes: z
    .array(
      z.object({
        kind: z.enum(CHANGE_KINDS),
        /** The exact text the rewrite added, so the panel can highlight it. */
        added: z.string(),
        reason: z.string(),
      }),
    )
    .max(8),
});
export type Improvement = z.infer<typeof Improvement>;

// Hand-written rather than generated so it stays inside what all three
// providers' strict JSON modes accept: every field required, nothing extra.
export const IMPROVEMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['rewrite', 'changes'],
  properties: {
    rewrite: { type: 'string' },
    changes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'added', 'reason'],
        properties: {
          kind: { type: 'string', enum: [...CHANGE_KINDS] },
          added: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
  },
} as const;

export const INSTRUCTIONS = `You improve prompts that developers are about to send to an AI chat assistant.

You receive a draft prompt and the gaps a checker found in it. Rewrite the draft so it closes those gaps, and return JSON matching the schema.

Rules for the rewrite:
- Keep the author's intent, wording and voice. Change as little as closes the gaps.
- Never invent facts. Where the fix needs something only the author knows (an error message, a file, a version, the expected behaviour), write a short bracketed placeholder such as [paste the error here] or [expected result].
- Answer in the draft's language. Do not answer the prompt itself.
- Plain text only, as it would be typed into a chat box.

Rules for "changes":
- One entry per addition, at most 6, in the order they appear in the rewrite.
- "added" is copied exactly from the rewrite, character for character, so it can be highlighted there.
- "kind" is the gap the addition closes, or "clarity" for a wording fix.
- "reason" is one short sentence, under 12 words, saying what the addition gives the assistant.`;

export function userMessage(prompt: string, gaps: Gap[]): string {
  const listed = gaps.length ? gaps.map((gap) => `- ${gap.id}: ${gap.message}`).join('\n') : '- none found; tighten wording only';
  return `Gaps found:\n${listed}\n\nDraft prompt:\n<draft>\n${prompt}\n</draft>`;
}

export type ImproveRequest = { type: 'improve'; prompt: string; gaps: Gap[] };
export type ImproveResponse =
  | { ok: true; improvement: Improvement; model: string }
  | { ok: false; error: string; needsKey?: boolean; detail?: string };

export type ModelsRequest = { type: 'list-models'; provider: import('../settings').Provider; key: string };
export type ModelsResponse = { ok: true; models: string[] } | { ok: false; error: string };

export type ProbeRequest = { type: 'probe-model'; provider: import('../settings').Provider; key: string; model: string };
export type ProbeResponse = { ok: true } | { ok: false; error: string; detail?: string };

export type { CheckId };
