import { describe, expect, it } from 'vitest';
import { runCustomRules, type CustomRule } from './custom';
import { runChecks } from './index';

const rule = (r: Partial<CustomRule>): CustomRule => ({ id: 'r', name: 'Rule', when: '', require: '', ...r });

describe('custom rules', () => {
  const prisma = rule({ name: 'Prisma version', when: 'prisma', require: 'prisma 5, prisma 6, prisma 7' });

  it('fires when the trigger is mentioned and the requirement is not', () => {
    expect(runCustomRules('Why does Prisma throw on this update?', [prisma]).map((g) => g.message)).toEqual([
      'Your rule “Prisma version”: mention “prisma 5” or “prisma 6” or “prisma 7”.',
    ]);
  });

  it('stays quiet once the requirement is met, or the trigger is absent', () => {
    expect(runCustomRules('We are on Prisma 6 and it throws on update', [prisma])).toEqual([]);
    expect(runCustomRules('Why does Drizzle throw on this update?', [prisma])).toEqual([]);
  });

  it('matches single words whole, so "go" is not found in "good"', () => {
    const go = rule({ when: 'go', require: 'go version' });
    expect(runCustomRules('this looks good to me, review it', [go])).toEqual([]);
    expect(runCustomRules('my Go service leaks goroutines', [go])).toHaveLength(1);
  });

  it('applies an always-on rule to every prompt and uses its own message', () => {
    const always = rule({ require: 'node', message: 'Say which Node version.' });
    expect(runCustomRules('fix the build please', [always]).map((g) => g.message)).toEqual(['Say which Node version.']);
  });

  it('ignores a rule with nothing required', () => {
    expect(runCustomRules('anything at all', [rule({ when: 'anything' })])).toEqual([]);
  });

  it('runs through runChecks after the built-in checks, as id "custom" with the rule name', () => {
    const gaps = runChecks('fix the login bug, same as before', { customRules: [rule({ name: 'Ticket', require: 'jira-' })] });
    expect(gaps.map((g) => g.id)).toEqual(['assumedMemory', 'context', 'goal', 'custom']);
    expect(gaps.at(-1)?.title).toBe('Ticket');
  });

  it('can be switched off like any check', () => {
    expect(runChecks('fix the login bug, same as before', { customRules: [rule({ require: 'x' })], disabled: ['custom'] }).map((g) => g.id)).not.toContain('custom');
  });
});
