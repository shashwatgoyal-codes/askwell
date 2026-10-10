// The person's own checks, written in settings as plain words rather than
// patterns: "when a prompt mentions X, it should also mention Y".

export interface CustomRule {
  id: string;
  name: string;
  /** Comma-separated words or phrases; empty means every prompt. */
  when: string;
  /** Comma-separated words or phrases; the prompt should contain at least one. */
  require: string;
  /** Shown when the rule fires; a default is written from the rule when empty. */
  message?: string;
}

const terms = (list: string) =>
  list
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whole-word for single words ("go" doesn't match "good"), plain containment for phrases with spaces or symbols. */
function mentions(text: string, term: string): boolean {
  return /^[\p{L}\p{N}]+$/u.test(term) ? new RegExp(`(^|[^\\p{L}\\p{N}])${escape(term)}($|[^\\p{L}\\p{N}])`, 'iu').test(text) : text.includes(term);
}

export interface CustomGap {
  rule: CustomRule;
  message: string;
}

export function runCustomRules(prompt: string, rules: readonly CustomRule[]): CustomGap[] {
  const text = prompt.toLowerCase();
  const gaps: CustomGap[] = [];
  for (const rule of rules) {
    const required = terms(rule.require);
    if (required.length === 0) continue;
    const when = terms(rule.when);
    if (when.length && !when.some((t) => mentions(text, t))) continue;
    if (required.some((t) => mentions(text, t))) continue;
    gaps.push({
      rule,
      message: rule.message?.trim() || `Your rule “${rule.name}”: mention ${required.map((t) => `“${t}”`).join(' or ')}.`,
    });
  }
  return gaps;
}
