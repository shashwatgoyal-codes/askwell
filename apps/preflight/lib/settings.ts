import type { CheckId, Sensitivity } from '@askwell/rules';
import { storage } from '#imports';

// Everything here lives in storage.local: on this device, never synced.

export const sensitivity = storage.defineItem<Sensitivity>('local:sensitivity', {
  fallback: 'balanced',
});

export const disabledChecks = storage.defineItem<CheckId[]>('local:disabledChecks', {
  fallback: [],
});

/** Site ids (see lib/sites.ts) where the user switched coaching off. */
export const disabledSites = storage.defineItem<string[]>('local:disabledSites', {
  fallback: [],
});
