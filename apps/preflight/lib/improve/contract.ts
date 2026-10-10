import type { Gap } from '@askwell/rules';
import type { Improvement } from '@askwell/improve';
import type { Provider } from '../settings';

// Messages between the extension's pages and its background worker. The
// rewrite contract itself lives in @askwell/improve, shared with the portal.

export type { Improvement };

export type ImproveRequest = { type: 'improve'; prompt: string; gaps: Gap[] };
export type ImproveResponse =
  | { ok: true; improvement: Improvement; model: string }
  | { ok: false; error: string; needsKey?: boolean; detail?: string };

export type ModelsRequest = { type: 'list-models'; provider: Provider; key: string };
export type ModelsResponse = { ok: true; models: string[] } | { ok: false; error: string };

export type ProbeRequest = { type: 'probe-model'; provider: Provider; key: string; model: string };
export type ProbeResponse = { ok: true } | { ok: false; error: string; detail?: string };

