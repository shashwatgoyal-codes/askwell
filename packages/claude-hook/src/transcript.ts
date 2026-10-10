import { readFileSync } from 'node:fs';

// The person's earlier prompts in this Claude Code session, oldest first,
// for the conversation nudges. Read from the transcript Claude Code passes
// in; anything that isn't something the person typed is skipped.

interface Line {
  type?: string;
  isMeta?: boolean;
  message?: { role?: string; content?: unknown };
}

function textOf(content: unknown): string | null {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return null;
  // Tool results arrive as user turns too; only plain text blocks are the person's words.
  if (content.some((block) => (block as { type?: string })?.type === 'tool_result')) return null;
  const text = content
    .filter((block): block is { type: 'text'; text: string } => (block as { type?: string })?.type === 'text')
    .map((block) => block.text)
    .join('\n');
  return text || null;
}

export function previousPrompts(transcriptPath: string | undefined, limit = 12): string[] {
  if (!transcriptPath) return [];
  let raw: string;
  try {
    raw = readFileSync(transcriptPath, 'utf8');
  } catch {
    return [];
  }
  const prompts: string[] = [];
  for (const row of raw.split('\n')) {
    if (!row.trim()) continue;
    let line: Line;
    try {
      line = JSON.parse(row) as Line;
    } catch {
      continue;
    }
    if (line.type !== 'user' || line.isMeta || line.message?.role !== 'user') continue;
    const text = textOf(line.message.content)?.trim();
    // Command echoes and injected reminders are wrapped in tags; the person didn't type those.
    if (!text || text.startsWith('<')) continue;
    prompts.push(text);
  }
  return prompts.slice(-limit);
}
