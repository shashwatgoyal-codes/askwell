// Reads a prompt once and answers the questions every check asks: what kind
// of request it is, and whether it already carries evidence. Checks never
// look at raw text for intent; pasted code is full of words like "error"
// and "should" that say nothing about what the person wants.

export interface Analysis {
  /** The prompt with code blocks and inline code removed. */
  prose: string;
  words: number;
  /** Something is broken: a bug, an error, a failing request. */
  reportsBug: boolean;
  /** Existing work is to be changed: fix, refactor, migrate, rename… */
  changesCode: boolean;
  /** A how-to or what-is question about a topic, not about the asker's own code. */
  generalQuestion: boolean;
  /** A vague "make it better" request with no target. */
  vagueImprovement: boolean;
  /** An error, a stack frame, a status code, a file:line, or pasted code. */
  hasEvidence: boolean;
  /** "this function", "my code", "the log below", with nothing pasted. */
  unseenReference: string | null;
}

const FENCED = /```[\s\S]*?(```|$)/g;
const INLINE = /`[^`\n]+`/g;

const BUG =
  /\b(bugs?|errors?|exceptions?|crash(es|ed|ing)?|broken|fail(s|ed|ing)?|not working|(does|is)n['’]?t work(ing)?|throws?|stack ?trace|traceback|undefined is not|null pointer)\b/i;

const CHANGE =
  /\b(fix|refactor|rewrite|update|change|modify|migrate|convert|port|optimi[sz]e|improve|clean ?up|remove|delete|rename|replace|upgrade|speed up)\b/i;

const VAGUE =
  /\b(improve|optimi[sz]e|clean ?up|refactor|make (it|this|the \w+) (better|cleaner|faster|nicer)|tidy up|polish)\b/i;

const EVIDENCE = [
  /\b\w*(Error|Exception)\b\s*[:(]/, // TypeError: …, ValueError(…)
  /\bat \S+ \(?[^\s()]+:\d+/, // stack frame
  /\bTraceback\b/,
  /\b[\w./-]+\.(tsx?|jsx?|mjs|py|go|rs|java|kt|rb|php|cs|swift|css|scss|sql|json|ya?ml|toml|sh):\d+/,
  /\b[45]\d\d\b/, // HTTP status
  /\b[A-Z][a-zA-Z]+(Error|Exception)\b/, // PrismaClientKnownRequestError
  /\bE[A-Z]{3,}\b/, // ENOENT, ECONNREFUSED
  /\bP\d{4}\b/, // Prisma error codes
];

const QUESTION = /^\s*(how|what|why|when|where|which|is|are|can|could|does|do|should)\b/i;
// First-person signs that the question is about something happening to the
// asker right now, not about a topic in general.
const PERSONAL =
  /\b(my|our|this|these|it|it['’]s|i['’]m getting|i get|i got|we get|we['’]re getting|keeps?|still|again|here)\b/i;

const UNSEEN =
  /\b(this|my|our|the following|the attached)\s+(code|function|component|file|query|script|class|snippet|error|log|logs|stack ?trace|output|test|tests|endpoint|schema)\b/i;
const POINTER = /\b(below|above|attached)\b/i;

export function analyze(prompt: string): Analysis {
  const hasCode = /```/.test(prompt) || (prompt.match(INLINE) ?? []).some((m) => m.length > 12);
  const prose = prompt.replace(FENCED, ' ').replace(INLINE, ' ').replace(/\s+/g, ' ').trim();
  const words = prose ? prose.split(' ').length : 0;

  const hasEvidence = hasCode || EVIDENCE.some((re) => re.test(prompt));
  const unseen = hasCode ? null : prose.match(UNSEEN);
  const pointsAway = !hasCode && POINTER.test(prose) && /\b(code|error|log|output|function)\b/i.test(prose);

  const generalQuestion = QUESTION.test(prose) && !PERSONAL.test(prose);

  return {
    prose,
    words,
    generalQuestion,
    reportsBug: BUG.test(prose) && !generalQuestion,
    changesCode: CHANGE.test(prose) && !generalQuestion,
    vagueImprovement: VAGUE.test(prose),
    hasEvidence,
    unseenReference: unseen ? unseen[0] : pointsAway ? 'the code below' : null,
  };
}
