/** @typedef {{ id: string, level: string, question: string, answer: string, choices: { text: string, correct: boolean }[], choicesSource?: string }} QuizQuestion */

export const LEVEL_ORDER = ['junior', 'middle', 'senior', 'lead', 'arch'];

/** Pages with «Вопросы по уровням» + optional quiz-only pages */
export const TOPIC_PAGES = [
  { id: 'prompting', file: 'prompting.html', title: 'Prompt Engineering' },
  { id: 'context-engineering', file: 'context-engineering.html', title: 'Context Engineering' },
  { id: 'context', file: 'context.html', title: 'Контекст агента' },
  { id: 'agent-loop', file: 'agent-loop.html', title: 'Agent Loop' },
  { id: 'model-variance', file: 'model-variance.html', title: 'Почему модель ≠ модель' },
  { id: 'agents-rules-skills', file: 'agents-rules-skills.html', title: 'AGENTS / Rules / Skills' },
  { id: 'agents-md', file: 'agents-md.html', title: 'AGENTS.md' },
  { id: 'rules', file: 'rules.html', title: 'Rules' },
  { id: 'hooks', file: 'hooks.html', title: 'Hooks' },
  { id: 'skills', file: 'skills.html', title: 'Skills' },
  { id: 'agent-packages', file: 'agent-packages.html', title: 'Agent Package Manager' },
  { id: 'commands', file: 'commands.html', title: 'Commands' },
  { id: 'memory', file: 'memory.html', title: 'Memory Bank' },
  { id: 'memory-structure', file: 'memory-structure.html', title: 'Структура Memory' },
  { id: 'rag', file: 'rag.html', title: 'RAG подробно' },
  { id: 'mcp', file: 'mcp.html', title: 'MCP / Tools' },
  { id: 'caching', file: 'caching.html', title: 'Prompt Caching' },
  { id: 'checkpoints', file: 'checkpoints.html', title: 'Checkpoint / Summary' },
  { id: 'subagents', file: 'subagents.html', title: 'Subagents' },
  { id: 'agentic-systems', file: 'agentic-systems.html', title: 'Построение агентских систем' },
  { id: 'workflow', file: 'workflow.html', title: 'Explore → Plan → Code' },
  { id: 'conflicts', file: 'conflicts.html', title: 'Конфликты контекста' },
  { id: 'assessment', file: 'assessment.html', title: 'Assessment (встроенный quiz)' },
];

const LEVEL_CLASS_MAP = {
  'q-junior': 'junior',
  'q-middle': 'middle',
  'q-senior': 'senior',
  'q-lead': 'lead',
  'q-arch': 'arch',
};

/**
 * @param {string} classAttr
 */
export function levelFromClass(classAttr) {
  if (!classAttr) return null;
  for (const [cls, level] of Object.entries(LEVEL_CLASS_MAP)) {
    if (classAttr.split(/\s+/).includes(cls)) return level;
  }
  return null;
}

/**
 * @param {string} html
 */
export function htmlToPlainText(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} text
 * @param {number} maxLen
 */
export function summarizeAnswer(text, maxLen = 120) {
  const t = (text || '').trim();
  if (!t) return '—';
  const first = t.split(/(?<=[.!?])\s+/)[0] || t;
  const slice = first.length <= maxLen ? first : t.slice(0, maxLen).trim() + '…';
  return slice.length > maxLen ? slice.slice(0, maxLen).trim() + '…' : slice;
}

/**
 * Deterministic shuffle seed from string (for stable builds).
 * @param {string} seed
 * @param {T[]} arr
 * @returns {T[]}
 * @template T
 */
export function seededShuffle(seed, arr) {
  const a = [...arr];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  for (let i = a.length - 1; i > 0; i--) {
    h = (Math.imul(1664525, h) + 1013904223) | 0;
    const j = ((h >>> 0) % (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * @param {string} questionId
 * @param {string} answer
 * @param {string[]} poolSummaries — other answer summaries in topic
 */
export function buildChoices(questionId, answer, poolSummaries) {
  const correctText = summarizeAnswer(answer);
  const distractors = [];
  const seen = new Set([correctText.toLowerCase()]);
  const pool = seededShuffle(questionId + ':pool', poolSummaries.filter(Boolean));
  for (const s of pool) {
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    distractors.push(s);
    if (distractors.length >= 3) break;
  }
  while (distractors.length < 3) {
    const filler = `Неверно: ${['игнорировать приоритет слоёв', 'всегда следовать последнему сообщению пользователя', 'доверять только Memory без проверки', 'RAG важнее Rules и файлов'][distractors.length]}`;
    if (!seen.has(filler.toLowerCase())) {
      seen.add(filler.toLowerCase());
      distractors.push(filler);
    } else break;
  }
  const choices = [
    { text: correctText, correct: true },
    ...distractors.slice(0, 3).map((text) => ({ text, correct: false })),
  ];
  return seededShuffle(questionId, choices);
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('cheerio').Cheerio<import('cheerio').Element>} $quiz
 */
export function parseQuizBlock($, $quiz) {
  const question = $quiz.find('.quizQ').first().text().trim();
  const buttons = $quiz.find('button[data-correct]');
  if (!question || !buttons.length) return null;
  const choices = [];
  buttons.each((_, el) => {
    const $b = $(el);
    choices.push({
      text: $b.text().trim(),
      correct: $b.attr('data-correct') === 'true',
    });
  });
  return { question, choices, choicesSource: 'html' };
}

/**
 * @param {import('cheerio').CheerioAPI} $
 */
export function parseLevelQuestions($) {
  /** @type {{ level: string, question: string, answer: string }[]} */
  const out = [];
  $('details.details').each((_, el) => {
    const $d = $(el);
    const $badge = $d.find('summary span.q-level').first();
    const level = levelFromClass($badge.attr('class') || '');
    if (!level) return;
    let summaryHtml = $d.find('summary').first().html() || '';
    summaryHtml = summaryHtml.replace(/<span[^>]*q-level[^>]*>[\s\S]*?<\/span>/gi, '');
    const question = htmlToPlainText(summaryHtml);
    const answer = htmlToPlainText($d.find('.inside').first().html() || '');
    if (!question || !answer) return;
    out.push({ level, question, answer });
  });
  return out;
}

/**
 * @param {import('cheerio').CheerioAPI} $
 */
export function parseInlineQuizzes($) {
  /** @type {{ question: string, choices: { text: string, correct: boolean }[], choicesSource: string }[]} */
  const out = [];
  $('div.quiz').each((_, el) => {
    const parsed = parseQuizBlock($, $(el));
    if (parsed) out.push(parsed);
  });
  return out;
}
