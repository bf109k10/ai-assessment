(function () {
  const LEVEL_ORDER = ['junior', 'middle', 'senior', 'lead', 'arch'];
  const LEVEL_LABELS = {
    junior: 'Junior',
    middle: 'Middle',
    senior: 'Senior',
    lead: 'Lead',
    arch: 'Architect',
  };
  const SETTINGS_KEY = 'quizSettings';
  const AI_HISTORY_KEY = 'quizAiQuestionHistory';
  const AI_HISTORY_MAX = 200;
  const AI_HISTORY_AVOID_IN_PROMPT = 18;
  const AI_AVOID_SNIPPET_LEN = 140;
  const AI_AVOID_BLOCK_MAX_CHARS = 4200;
  const DEFAULT_SETTINGS = {
    provider: 'openrouter',
    apiKey: '',
    modelOpenRouter: 'openai/gpt-5.4',
    modelOpenAI: 'gpt-5.4',
    passThreshold: 80,
    sessionSize: 15,
  };

  /** @type {object|null} */
  let bank = null;
  /** @type {{ questions: object[], index: number, results: { id: string, ok: boolean, level: string }[], meta: object }|null} */
  let session = null;
  /** @type {boolean} */
  let answered = false;

  function loadSettings() {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(s) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  }

  function aiScopeKey(cfg) {
    const topicPart =
      cfg.topicMode === 'pick'
        ? [...(cfg.topicIds || [])].sort().join(',')
        : cfg.topicMode || 'random_one';
    return [topicPart, cfg.targetLevel, cfg.levelMode].join('|');
  }

  function normalizeQuestionText(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 280);
  }

  function loadAiHistory() {
    try {
      const raw = JSON.parse(localStorage.getItem(AI_HISTORY_KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function saveAiHistory(entries) {
    const trimmed = entries.slice(-AI_HISTORY_MAX);
    localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(trimmed));
  }

  function rememberAiQuestions(questions, cfg) {
    if (!questions?.length) return;
    const scope = aiScopeKey(cfg);
    const seen = new Set(loadAiHistory().map((e) => normalizeQuestionText(e.q)));
    const next = loadAiHistory();
    const now = Date.now();
    for (const item of questions) {
      const qn = normalizeQuestionText(item.question);
      if (!qn || seen.has(qn)) continue;
      seen.add(qn);
      next.push({ scope, q: item.question, at: now });
    }
    saveAiHistory(next);
  }

  function forgetAiQuestions(questions) {
    if (!questions?.length) return;
    const drop = new Set(
      questions.map((item) => normalizeQuestionText(item.question)).filter(Boolean)
    );
    if (!drop.size) return;
    const next = loadAiHistory().filter((e) => !drop.has(normalizeQuestionText(e.q)));
    saveAiHistory(next);
  }

  function persistAiHistoryAfterCompletedSession() {
    if (!session?.questions?.length || !session.meta) return;
    if (session.meta.fromAi || session.meta.bonus) {
      rememberAiQuestions(session.questions, session.meta);
    }
  }

  function truncateForPrompt(text, maxLen) {
    const s = String(text || '')
      .replace(/\s+/g, ' ')
      .trim();
    const n = maxLen || AI_AVOID_SNIPPET_LEN;
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  function buildAvoidPromptBlock(cfg, sessionQuestions) {
    const scope = aiScopeKey(cfg);
    const all = loadAiHistory();
    const sameScope = all.filter((e) => e.scope === scope);
    const pool = [...sameScope, ...all.filter((e) => e.scope !== scope)];
    const lines = [];
    const seen = new Set();
    for (const e of pool) {
      const n = normalizeQuestionText(e.q);
      if (!n || seen.has(n)) continue;
      seen.add(n);
      lines.push(truncateForPrompt(e.q));
      if (lines.length >= AI_HISTORY_AVOID_IN_PROMPT) break;
    }
    for (const q of sessionQuestions || []) {
      const n = normalizeQuestionText(q);
      if (!n || seen.has(n)) continue;
      seen.add(n);
      lines.push(truncateForPrompt(q));
    }
    if (!lines.length) return '';
    let body =
      '\n\nНе повторяй эти вопросы (ни дословно, ни тем же кейсом):\n' +
      lines.map((q, i) => i + 1 + '. ' + q).join('\n');
    if (body.length > AI_AVOID_BLOCK_MAX_CHARS) {
      body = body.slice(0, AI_AVOID_BLOCK_MAX_CHARS) + '\n…(список обрезан)';
    }
    return body;
  }

  function sessionVarietyHint() {
    return '\n\nИдентификатор сессии: ' + Date.now() + '-' + Math.random().toString(36).slice(2, 9) + '. Вариативность обязательна.';
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function levelsForMode(targetLevel, mode) {
    const i = LEVEL_ORDER.indexOf(targetLevel);
    if (i < 0) return [targetLevel];
    if (mode === 'exact') return [targetLevel];
    return LEVEL_ORDER.slice(0, i + 1);
  }

  function flattenQuestions(topics) {
    const out = [];
    for (const t of topics) {
      for (const q of t.questions || []) {
        out.push({ ...q, topicId: t.id, topicTitle: t.title });
      }
    }
    return out;
  }

  function resolveTopicSelection(cfg) {
    if (!bank?.topics?.length) {
      return { ids: [], titles: 'AI agent context', topicTitle: 'AI agent context' };
    }
    const mode = cfg.topicMode || 'random_one';
    if (mode === 'random_one') {
      const t = bank.topics[Math.floor(Math.random() * bank.topics.length)];
      return { ids: [t.id], titles: t.title, topicTitle: t.title };
    }
    if (mode === 'mix_all') {
      const titles = bank.topics.map((t) => t.title);
      return {
        ids: bank.topics.map((t) => t.id),
        titles: titles.join('; '),
        topicTitle: 'Микс (' + bank.topics.length + ' топиков)',
      };
    }
    const ids = (cfg.topicIds || []).filter(Boolean);
    const topics = bank.topics.filter((t) => ids.includes(t.id));
    if (!topics.length) {
      return null;
    }
    const titles = topics.map((t) => t.title);
    return {
      ids: topics.map((t) => t.id),
      titles: titles.join('; '),
      topicTitle:
        titles.length === 1
          ? titles[0]
          : 'Микс: ' + titles.slice(0, 3).join(', ') + (titles.length > 3 ? ' +' + (titles.length - 3) : ''),
    };
  }

  function filterPool(cfg) {
    if (!bank) return [];
    const levels = levelsForMode(cfg.targetLevel, cfg.levelMode);
    const sel = resolveTopicSelection(cfg);
    if (!sel) return [];
    let topics = bank.topics.filter((t) => sel.ids.includes(t.id));
    let pool = flattenQuestions(topics).filter((q) => levels.includes(q.level));
    pool = shuffle(pool);
    const n = cfg.sessionSize === 'all' ? pool.length : Math.min(Number(cfg.sessionSize) || 15, pool.length);
    return pool.slice(0, n);
  }

  function getApiConfig(settings) {
    if (settings.provider === 'openai') {
      return {
        url: 'https://api.openai.com/v1/chat/completions',
        model: settings.modelOpenAI || DEFAULT_SETTINGS.modelOpenAI,
        headers: {
          Authorization: 'Bearer ' + settings.apiKey,
          'Content-Type': 'application/json',
        },
      };
    }
    return {
      url: 'https://openrouter.ai/api/v1/chat/completions',
      model: settings.modelOpenRouter || DEFAULT_SETTINGS.modelOpenRouter,
      headers: {
        Authorization: 'Bearer ' + settings.apiKey,
        'Content-Type': 'application/json',
        'HTTP-Referer': location.origin || 'https://agent-context-academy.local',
        'X-Title': 'Agent Context Academy Quiz',
      },
    };
  }

  /** @type {AbortController|null} */
  let genAbortController = null;

  function setGeneratingStatus(text) {
    const genMsg = el('quiz-generating');
    if (genMsg) {
      genMsg.hidden = false;
      genMsg.textContent = text;
    }
  }

  function mergeAbortSignals(signals) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
      return AbortSignal.any(signals);
    }
    const merged = new AbortController();
    for (const s of signals) {
      if (s.aborted) {
        merged.abort();
        break;
      }
      s.addEventListener('abort', () => merged.abort(), { once: true });
    }
    return merged.signal;
  }

  function completionLimitBody(settings, model) {
    const m = (model || '').toLowerCase();
    const needsCompletionTokens =
      settings.provider === 'openai' || /gpt-5|o1-|o3-|o4-/.test(m);
    if (needsCompletionTokens) {
      return { max_completion_tokens: 8192 };
    }
    return { max_tokens: 8192 };
  }

  function stripCodeFences(text) {
    const m = String(text || '').match(/```(?:json)?\s*([\s\S]*?)```/i);
    return (m ? m[1] : text).trim();
  }

  function extractBalancedJsonArray(text) {
    const t = stripCodeFences(text);
    const start = t.indexOf('[');
    if (start < 0) return null;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < t.length; i++) {
      const c = t[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') {
        inStr = true;
        continue;
      }
      if (c === '[') depth++;
      else if (c === ']') {
        depth--;
        if (depth === 0) return t.slice(start, i + 1);
      }
    }
    return t.slice(start);
  }

  function extractBalancedJsonObject(text) {
    const t = stripCodeFences(text);
    const start = t.indexOf('{');
    if (start < 0) return null;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < t.length; i++) {
      const c = t[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') {
        inStr = true;
        continue;
      }
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) return t.slice(start, i + 1);
      }
    }
    return t.slice(start);
  }

  function fixTrailingCommas(s) {
    return s.replace(/,\s*([}\]])/g, '$1');
  }

  function extractTopLevelObjects(arrayText) {
    const out = [];
    let depth = 0;
    let inStr = false;
    let esc = false;
    let objStart = -1;
    for (let i = 0; i < arrayText.length; i++) {
      const c = arrayText[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') {
        inStr = true;
        continue;
      }
      if (c === '{') {
        if (depth === 0) objStart = i;
        depth++;
      } else if (c === '}') {
        depth--;
        if (depth === 0 && objStart >= 0) {
          const chunk = arrayText.slice(objStart, i + 1);
          let parsed = null;
          for (const candidate of [chunk, fixTrailingCommas(chunk)]) {
            try {
              parsed = JSON.parse(candidate);
              break;
            } catch (_) {
              /* try next */
            }
          }
          if (parsed && typeof parsed === 'object') out.push(parsed);
          objStart = -1;
        }
      }
    }
    return out;
  }

  function parseJsonArray(text) {
    const arrText = extractBalancedJsonArray(text);
    if (arrText) {
      const cleaned = fixTrailingCommas(arrText);
      try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        const salvaged = extractTopLevelObjects(cleaned);
        if (salvaged.length) return salvaged;
      }
    }
    const objText = extractBalancedJsonObject(text);
    if (objText) {
      const cleaned = fixTrailingCommas(objText);
      try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) return parsed;
        if (Array.isArray(parsed.questions)) return parsed.questions;
        if (Array.isArray(parsed.items)) return parsed.items;
      } catch (_) {
        /* fall through */
      }
    }
    throw new Error('Ответ модели без валидного JSON-массива вопросов');
  }

  async function callLlm(settings, messages, onStatus, opts = {}) {
    const { url, model, headers } = getApiConfig(settings);
    const timeoutMs = 180000;
    const timeoutController = new AbortController();
    const tid = setTimeout(() => timeoutController.abort(), timeoutMs);
    const signal = genAbortController?.signal
      ? mergeAbortSignals([timeoutController.signal, genAbortController.signal])
      : timeoutController.signal;
    onStatus?.('Запрос к API (' + model + ')… обычно 30–120 с за пакет');
    const temperature = opts.temperature ?? 0.7;
    const baseBody = {
      model,
      messages,
      temperature,
      ...completionLimitBody(settings, model),
    };
    const bodies = opts.jsonObjectMode
      ? [{ ...baseBody, response_format: { type: 'json_object' } }, baseBody]
      : [baseBody];
    try {
      let lastResError = null;
      for (const body of bodies) {
        const res = await fetch(url, {
          method: 'POST',
          headers,
          signal,
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const errText = await res.text();
          lastResError = new Error(res.status + ': ' + errText.slice(0, 280));
          if (body.response_format && res.status === 400) continue;
          throw lastResError;
        }
        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
      }
      if (lastResError) throw lastResError;
      throw new Error('Пустой ответ API');
    } catch (e) {
      if (e.name === 'AbortError') {
        if (genAbortController?.signal.aborted) {
          throw new Error('Генерация отменена.');
        }
        throw new Error('Таймаут ' + timeoutMs / 1000 + ' с. Уменьшите число вопросов или смените модель.');
      }
      throw e;
    } finally {
      clearTimeout(tid);
    }
  }

  async function requestAiJsonArray(settings, messages, onStatus) {
    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const jsonObjectMode = attempt >= 2;
        const temperature = attempt === 1 ? 0.7 : 0.35;
        const msgs =
          attempt === 1
            ? messages
            : [
                {
                  role: 'system',
                  content:
                    'Ответ — один JSON-объект {"questions":[...]} или массив [...]. Без markdown. Внутри строк экранируй кавычки как \\". Без сырых переносов строк в значениях.',
                },
                messages[messages.length - 1],
              ];
        const content = await callLlm(settings, msgs, onStatus, { temperature, jsonObjectMode });
        return parseJsonArray(content);
      } catch (e) {
        lastErr = e;
        if (genAbortController?.signal?.aborted) throw e;
        if (attempt < 3) {
          onStatus?.('Ошибка разбора JSON, повтор ' + (attempt + 1) + '/3…');
        }
      }
    }
    const detail = lastErr?.message || String(lastErr);
    throw new Error(
      detail.includes('JSON') ? detail : 'Не удалось разобрать JSON от модели: ' + detail
    );
  }

  function resolveTopics(cfg) {
    const sel = resolveTopicSelection(cfg);
    if (sel) return sel;
    return { ids: [], titles: 'AI agent context', topicTitle: 'AI agent context' };
  }

  function sampleFromBank(topicIds, levels, limit) {
    if (!bank) return [];
    let topics = bank.topics;
    if (topicIds.length) topics = topics.filter((t) => topicIds.includes(t.id));
    const pool = flattenQuestions(topics).filter((q) => levels.includes(q.level));
    return shuffle(pool).slice(0, limit);
  }

  function normalizeAiItems(raw, cfg, topicMeta) {
    const levels = levelsForMode(cfg.targetLevel, cfg.levelMode);
    const defaultLevel = cfg.targetLevel;
    return raw.map((item, i) => {
      let level = (item.level || '').toLowerCase();
      if (!levels.includes(level)) level = levels[i % levels.length] || defaultLevel;
      const choices = (item.choices || []).map((c) => ({
        text: c.text,
        correct: !!c.correct,
      }));
      const correct = choices.find((c) => c.correct);
      const answer =
        item.explanation ||
        correct?.text ||
        item.answer ||
        '';
      return {
        id: 'ai-' + Date.now() + '-' + i,
        level,
        question: item.question || 'Вопрос ' + (i + 1),
        answer,
        choices: choices.length >= 2 ? choices : [],
        topicTitle: item.topicHint || topicMeta.topicTitle,
        aiGenerated: true,
      };
    }).filter((q) => q.choices.length >= 2);
  }

  async function generateAiQuestions(settings, cfg, count, onStatus) {
    const topicMeta = resolveTopics(cfg);
    const levels = levelsForMode(cfg.targetLevel, cfg.levelMode);
    const levelLabels = levels.map((l) => LEVEL_LABELS[l] || l).join(', ');
    const samples = sampleFromBank(topicMeta.ids, levels, 3);
    const examples = samples
      .map((q) => `[${q.level}] Q: ${truncateForPrompt(q.question, 100)}`)
      .join('\n');

    const varietyHint = sessionVarietyHint();

    const chunkSize = 5;
    const allNormalized = [];
    let remaining = count;
    let batch = 0;

    while (remaining > 0) {
      const batchCount = Math.min(chunkSize, remaining);
      batch += 1;
      onStatus?.(
        'Генерация ИИ: пакет ' +
          batch +
          ', ' +
          batchCount +
          ' вопр. (готово ' +
          allNormalized.length +
          '/' +
          count +
          ')…'
      );

      const sessionSoFar = allNormalized.map((q) => q.question);
      const avoidBlock = buildAvoidPromptBlock(cfg, sessionSoFar);

      const prompt = `Ты автор quiz для курса «Agent Context Academy» (Cursor, Claude Code, AGENTS.md, Rules, RAG, MCP, memory, subagents).

Сгенерируй ровно ${batchCount} вопросов MCQ на русском.

Тематика: ${topicMeta.titles}
Допустимые уровни (поле level — только из списка): ${levels.join(', ')} (${levelLabels})
Режим: ${cfg.levelMode === 'exact' ? 'только уровень ' + cfg.targetLevel : 'уровни от junior до ' + cfg.targetLevel}

Формат — только JSON-массив:
[{"level":"middle","question":"...","explanation":"пояснение","choices":[{"text":"...","correct":true},{"text":"...","correct":false},{"text":"...","correct":false},{"text":"...","correct":false}]}]

Ровно 4 варианта, один correct:true. Вопросы разные, практические.
${examples ? '\nСтиль (не копируй):\n' + examples : ''}${avoidBlock}${varietyHint}`;

      const raw = await requestAiJsonArray(
        settings,
        [
          {
            role: 'system',
            content:
              'Отвечай только валидным JSON-массивом. Без markdown. Внутри строк JSON экранируй кавычки как \\". Не вставляй сырые переносы строк в значения.',
          },
          { role: 'user', content: prompt },
        ],
        onStatus
      );
      const normalized = normalizeAiItems(raw, cfg, topicMeta);
      if (!normalized.length) {
        throw new Error('Пакет ' + batch + ': модель не вернула валидные вопросы');
      }
      allNormalized.push(...normalized);
      remaining -= batchCount;
    }

    return { questions: allNormalized.slice(0, count), topicMeta, levels };
  }

  async function generateBonusQuestions(settings, meta, count) {
    const examples = (meta.sampleQuestions || [])
      .slice(0, 3)
      .map((q) => `Q: ${q.question}\nA: ${q.answer}`)
      .join('\n\n');
    const topic = meta.topicTitle || 'AI agent context';
    const levels = meta.levels?.join(', ') || meta.targetLevel;
    const avoidBlock = buildAvoidPromptBlock(meta);
    const prompt = `Сгенерируй ровно ${count} новых вопросов MCQ по теме «${topic}» для уровней: ${levels}.
Язык: русский. Формат: JSON-массив объектов:
[{"question":"...","choices":[{"text":"...","correct":true},{"text":"...","correct":false},{"text":"...","correct":false},{"text":"...","correct":false}]}]
Ровно 4 варианта, один correct:true. Вопросы не повторяй из примеров.

Примеры стиля:
${examples}${avoidBlock}${sessionVarietyHint()}`;

    const raw = await requestAiJsonArray(
      settings,
      [
        {
          role: 'system',
          content:
            'Ты генератор учебных quiz. Только валидный JSON-массив или {"questions":[...]}. Экранируй \\" внутри строк.',
        },
        { role: 'user', content: prompt },
      ],
      null
    );
    return raw.map((item, i) => ({
      id: 'bonus-' + Date.now() + '-' + i,
      level: meta.targetLevel,
      question: item.question,
      answer: (item.choices || []).find((c) => c.correct)?.text || '',
      choices: item.choices || [],
      topicTitle: topic,
      bonus: true,
    }));
  }

  function el(id) {
    return document.getElementById(id);
  }

  function showScreen(name) {
    ['quiz-setup', 'quiz-play', 'quiz-results'].forEach((id) => {
      const node = el(id);
      if (node) node.hidden = id !== name;
    });
  }

  function cancelSession() {
    if (!session) {
      showScreen('quiz-setup');
      return;
    }
    const answeredCount = session.results?.length || 0;
    const total = session.questions?.length || 0;
    const msg =
      answeredCount > 0
        ? 'Прервать квиз? Уже отвечено: ' +
          answeredCount +
          ' из ' +
          total +
          '. Результат не сохранится' +
          (session.meta?.fromAi || session.meta?.bonus
            ? '; ИИ снова сможет задать те же вопросы.'
            : '.')
        : 'Прервать квиз и вернуться к настройкам?' +
          (session.meta?.fromAi || session.meta?.bonus
            ? ' ИИ-вопросы этой сессии не запомнятся — их можно сгенерировать снова.'
            : '');
    if (!window.confirm(msg)) return;
    if (session.meta?.fromAi || session.meta?.bonus) {
      forgetAiQuestions(session.questions);
    }
    session = null;
    answered = false;
    showScreen('quiz-setup');
  }

  function populateTopicCheckboxes() {
    const box = el('quiz-topic-picks');
    if (!box || !bank) return;
    box.innerHTML = '';
    for (const t of bank.topics) {
      const label = document.createElement('label');
      label.className = 'quiz-topic-check';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'quiz-topic-cb';
      cb.value = t.id;
      cb.dataset.title = t.title;
      label.appendChild(cb);
      const span = document.createElement('span');
      span.textContent = t.title + ' (' + t.questionCount + ')';
      label.appendChild(span);
      box.appendChild(label);
    }
  }

  function readSelectedTopicIds() {
    return [...document.querySelectorAll('.quiz-topic-cb:checked')].map((c) => c.value);
  }

  function updateTopicModeUi() {
    const mode = el('quiz-topic-mode')?.value || 'random_one';
    const picks = el('quiz-topic-picks');
    const hint = el('quiz-topic-pick-hint');
    if (picks) picks.hidden = mode !== 'pick';
    if (hint) {
      if (mode === 'random_one') {
        hint.textContent = 'На каждую сессию выбирается один случайный топик.';
      } else if (mode === 'mix_all') {
        hint.textContent = 'Вопросы из всех топиков банка в случайном порядке.';
      } else {
        const n = readSelectedTopicIds().length;
        hint.textContent =
          n > 0
            ? 'Выбрано топиков: ' + n + '. Вопросы будут вперемешку.'
            : 'Отметьте хотя бы один топик ниже.';
      }
    }
  }

  function fillSettingsForm() {
    const s = loadSettings();
    const prov = el('quiz-provider');
    if (prov) prov.value = s.provider;
    const key = el('quiz-api-key');
    if (key) key.value = s.apiKey || '';
    const mor = el('quiz-model-or');
    if (mor) mor.value = s.modelOpenRouter;
    const moa = el('quiz-model-oai');
    if (moa) moa.value = s.modelOpenAI;
    toggleProviderFields();
  }

  function toggleProviderFields() {
    const s = loadSettings();
    const prov = el('quiz-provider')?.value || s.provider;
    const orRow = el('quiz-or-model-row');
    const oaiRow = el('quiz-oai-model-row');
    if (orRow) orRow.hidden = prov !== 'openrouter';
    if (oaiRow) oaiRow.hidden = prov !== 'openai';
  }

  function readSettingsFromForm() {
    const s = loadSettings();
    s.provider = el('quiz-provider')?.value || s.provider;
    s.apiKey = el('quiz-api-key')?.value?.trim() || '';
    s.modelOpenRouter = el('quiz-model-or')?.value?.trim() || s.modelOpenRouter;
    s.modelOpenAI = el('quiz-model-oai')?.value?.trim() || s.modelOpenAI;
    saveSettings(s);
    return s;
  }

  function readSessionSize() {
    if (el('quiz-count-all')?.checked) return 'all';
    const n = parseInt(el('quiz-count-num')?.value || '15', 10);
    if (!Number.isFinite(n) || n < 1) return 15;
    return String(n);
  }

  function readSetupConfig() {
    return {
      questionSource: el('quiz-source')?.value || 'bank',
      targetLevel: el('quiz-target-level')?.value || 'middle',
      levelMode: el('quiz-level-mode')?.value || 'cumulative',
      topicMode: el('quiz-topic-mode')?.value || 'random_one',
      topicIds: readSelectedTopicIds(),
      sessionSize: readSessionSize(),
    };
  }

  function updateSourceUi() {
    const src = el('quiz-source')?.value || 'bank';
    const hint = el('quiz-source-hint');
    const num = el('quiz-count-num');
    const allWrap = el('quiz-count-all-wrap');
    const allCb = el('quiz-count-all');
    const maxAi = 25;
    const maxBank = 99;
    if (hint) {
      hint.textContent =
        src === 'ai'
          ? 'Нужен API-ключ. ИИ сгенерирует MCQ по уровню и выбранным топикам.'
          : 'Вопросы из банка (app: npm run build:bank).';
    }
    if (num) {
      num.max = src === 'ai' ? String(maxAi) : String(maxBank);
      if (src === 'ai' && parseInt(num.value, 10) > maxAi) num.value = String(maxAi);
    }
    if (allWrap) allWrap.hidden = src === 'ai';
    if (allCb && src === 'ai') allCb.checked = false;
    updateTopicModeUi();
  }

  async function startSession() {
    const cfg = readSetupConfig();
    readSettingsFromForm();
    const settings = loadSettings();

    if (cfg.questionSource === 'ai') {
      if (!settings.apiKey) {
        alert('Для режима ИИ укажите API-ключ в «Настройки API» и сохраните.');
        el('quiz-settings-panel')?.removeAttribute('hidden');
        return;
      }
      if (cfg.topicMode === 'pick' && !cfg.topicIds.length) {
        alert('Выберите хотя бы один топик в списке.');
        updateTopicModeUi();
        return;
      }
      const nRaw = cfg.sessionSize === 'all' ? 15 : Math.min(parseInt(cfg.sessionSize, 10) || 15, 25);
      const n = Math.max(1, Math.min(nRaw, 25));
      const startBtn = el('quiz-start');
      const genMsg = el('quiz-generating');
      const cancelBtn = el('quiz-cancel-gen');
      genAbortController = new AbortController();
      if (startBtn) startBtn.disabled = true;
      if (cancelBtn) cancelBtn.hidden = false;
      setGeneratingStatus('Старт генерации ИИ…');
      try {
        const { questions, topicMeta, levels } = await generateAiQuestions(
          settings,
          cfg,
          n,
          setGeneratingStatus
        );
        session = {
          questions,
          index: 0,
          results: [],
          meta: {
            ...cfg,
            topicTitle: topicMeta.topicTitle,
            levels,
            sampleQuestions: questions.slice(0, 5),
            fromAi: true,
          },
        };
        answered = false;
        showScreen('quiz-play');
        renderQuestion();
      } catch (e) {
        alert('Ошибка генерации ИИ: ' + (e.message || e));
      } finally {
        genAbortController = null;
        if (startBtn) startBtn.disabled = false;
        if (genMsg) genMsg.hidden = true;
        if (cancelBtn) cancelBtn.hidden = true;
      }
      return;
    }

    const pool = filterPool(cfg);
    if (!pool.length) {
      if (cfg.topicMode === 'pick' && !cfg.topicIds.length) {
        alert('Отметьте хотя бы один топик.');
      } else {
        alert('Нет вопросов для выбранных фильтров. Смените уровень или топики.');
      }
      updateTopicModeUi();
      return;
    }
    const topicMeta = resolveTopicSelection(cfg);
    const topicTitle = topicMeta?.topicTitle || pool[0]?.topicTitle;
    session = {
      questions: pool,
      index: 0,
      results: [],
      meta: {
        ...cfg,
        topicTitle,
        levels: levelsForMode(cfg.targetLevel, cfg.levelMode),
        sampleQuestions: pool.slice(0, 5),
        fromAi: false,
      },
    };
    answered = false;
    showScreen('quiz-play');
    renderQuestion();
  }

  function currentQuestion() {
    return session?.questions[session.index];
  }

  function renderQuestion() {
    const q = currentQuestion();
    const total = session.questions.length;
    const idx = session.index;
    const prog = el('quiz-progress');
    const progText = el('quiz-progress-text');
    if (prog) prog.style.width = Math.round((idx / total) * 100) + '%';
    if (progText) progText.textContent = 'Вопрос ' + (idx + 1) + ' из ' + total;

    const meta = el('quiz-q-meta');
    if (meta && q) {
      meta.textContent =
        (q.topicTitle || '') + ' · ' + (LEVEL_LABELS[q.level] || q.level);
    }

    const qq = el('quiz-question-text');
    if (qq) qq.textContent = q?.question || '';

    const explain = el('quiz-explanation');
    if (explain) {
      explain.hidden = true;
      explain.textContent = '';
    }

    const fb = el('quiz-feedback');
    if (fb) {
      fb.textContent = '';
      fb.style.color = '';
    }

    const choicesEl = el('quiz-choices');
    if (!choicesEl || !q) return;
    choicesEl.innerHTML = '';
    answered = false;

    const choices = shuffle(q.choices || []);
    choices.forEach((c, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quiz-choice-btn';
      btn.textContent = c.text;
      btn.dataset.correct = c.correct ? 'true' : 'false';
      btn.onclick = () => onChoice(btn, q);
      choicesEl.appendChild(btn);
    });

    const nextBtn = el('quiz-next');
    if (nextBtn) nextBtn.hidden = true;
  }

  function onChoice(btn, q) {
    if (answered) return;
    answered = true;
    const ok = btn.dataset.correct === 'true';
    const choicesEl = el('quiz-choices');
    if (choicesEl) {
      choicesEl.querySelectorAll('button').forEach((b) => {
        b.disabled = true;
        if (b.dataset.correct === 'true') b.classList.add('correct');
        else if (b === btn && !ok) b.classList.add('wrong');
      });
    }
    const fb = el('quiz-feedback');
    if (fb) {
      fb.textContent = ok
        ? 'Верно.'
        : 'Неверно. Сверьтесь с пояснением ниже.';
      fb.style.color = ok ? '#15803d' : '#b91c1c';
    }
    const explain = el('quiz-explanation');
    if (explain) {
      explain.hidden = false;
      explain.innerHTML = '<b>Пояснение:</b> ' + escapeHtml(q.answer || '');
    }
    session.results.push({ id: q.id, ok, level: q.level });
    const nextBtn = el('quiz-next');
    if (nextBtn) nextBtn.hidden = false;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function nextQuestion() {
    session.index += 1;
    if (session.index >= session.questions.length) {
      showResults();
      return;
    }
    renderQuestion();
  }

  function showResults() {
    persistAiHistoryAfterCompletedSession();
    showScreen('quiz-results');
    const total = session.results.length;
    const correct = session.results.filter((r) => r.ok).length;
    const pct = total ? Math.round((correct / total) * 100) : 0;
    const summary = el('quiz-results-summary');
    if (summary) {
      summary.textContent = correct + ' из ' + total + ' верно (' + pct + '%)';
    }
    const byLevel = el('quiz-results-levels');
    if (byLevel) {
      const map = {};
      for (const r of session.results) {
        if (!map[r.level]) map[r.level] = { ok: 0, n: 0 };
        map[r.level].n += 1;
        if (r.ok) map[r.level].ok += 1;
      }
      byLevel.innerHTML = Object.keys(map)
        .sort((a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b))
        .map(
          (lv) =>
            '<div class="quiz-level-row"><span>' +
            (LEVEL_LABELS[lv] || lv) +
            '</span><span>' +
            map[lv].ok +
            '/' +
            map[lv].n +
            '</span></div>'
        )
        .join('');
    }
    session.meta.lastPct = pct;
    const bonusBtn = el('quiz-bonus-start');
    const settings = loadSettings();
    const threshold = settings.passThreshold ?? DEFAULT_SETTINGS.passThreshold;
    if (bonusBtn) {
      const fromBank = !session.meta.fromAi;
      const canBonus = fromBank && pct >= threshold && settings.apiKey;
      bonusBtn.hidden = !canBonus;
      bonusBtn.disabled = false;
      bonusBtn.textContent = canBonus
        ? 'Бонус-раунд: 5 вопросов от ИИ'
        : 'Бонус-раунд (нужен API-ключ и ≥' + threshold + '%)';
    }
    const bonusHint = el('quiz-bonus-hint');
    if (bonusHint) {
      if (session.meta.fromAi) {
        bonusHint.textContent =
          'Сессия была полностью от ИИ. Бонус доступен после прохождения квиза из банка.';
      } else if (!settings.apiKey) {
        bonusHint.textContent =
          'Укажите API-ключ OpenRouter или OpenAI в настройках для бонус-раунда.';
      } else if (pct < threshold) {
        bonusHint.textContent =
          'Бонус откроется при ≥' + threshold + '% верных ответов.';
      } else {
        bonusHint.textContent = '';
      }
    }
  }

  async function startBonusRound() {
    readSettingsFromForm();
    const settings = loadSettings();
    if (!settings.apiKey) {
      alert('Добавьте API-ключ в настройках.');
      return;
    }
    const bonusBtn = el('quiz-bonus-start');
    if (bonusBtn) {
      bonusBtn.disabled = true;
      bonusBtn.textContent = 'Генерация…';
    }
    try {
      const bonus = await generateBonusQuestions(settings, session.meta, 5);
      session = {
        questions: bonus,
        index: 0,
        results: [],
        meta: { ...session.meta, bonus: true },
      };
      showScreen('quiz-play');
      renderQuestion();
    } catch (e) {
      alert('Ошибка ИИ: ' + (e.message || e));
      if (bonusBtn) {
        bonusBtn.disabled = false;
        bonusBtn.textContent = 'Бонус-раунд: 5 вопросов от ИИ';
      }
    }
  }

  function applyBank(data) {
    bank = data;
    populateTopicCheckboxes();
    const info = el('quiz-bank-info');
    if (info) {
      info.textContent =
        'В банке: ' + (bank.totalQuestions || 0) + ' вопросов, ' + bank.topics.length + ' топиков.';
    }
  }

  async function loadBank() {
    if (window.ACADEMY_QUESTION_BANK) {
      applyBank(window.ACADEMY_QUESTION_BANK);
      return;
    }
    try {
      const res = await fetch('../assets/question-bank.json');
      if (res.ok) {
        applyBank(await res.json());
        return;
      }
    } catch (_) {
      /* file:// или нет сервера — см. question-bank.data.js */
    }
    throw new Error('Банк не загружен');
  }

  function bind() {
    el('quiz-start')?.addEventListener('click', startSession);
    el('quiz-next')?.addEventListener('click', nextQuestion);
    el('quiz-cancel-session')?.addEventListener('click', cancelSession);
    el('quiz-restart')?.addEventListener('click', () => {
      showScreen('quiz-setup');
    });
    el('quiz-save-settings')?.addEventListener('click', () => {
      readSettingsFromForm();
      alert('Настройки сохранены локально на устройстве.');
    });
    el('quiz-provider')?.addEventListener('change', toggleProviderFields);
    el('quiz-source')?.addEventListener('change', updateSourceUi);
    el('quiz-topic-mode')?.addEventListener('change', updateTopicModeUi);
    el('quiz-topic-picks')?.addEventListener('change', updateTopicModeUi);
    el('quiz-bonus-start')?.addEventListener('click', startBonusRound);
    el('quiz-cancel-gen')?.addEventListener('click', () => {
      if (genAbortController) genAbortController.abort();
    });
    el('quiz-toggle-settings')?.addEventListener('click', () => {
      const panel = el('quiz-settings-panel');
      if (panel) panel.hidden = !panel.hidden;
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    fillSettingsForm();
    bind();
    try {
      await loadBank();
    } catch (e) {
      const info = el('quiz-bank-info');
      if (info) {
        info.textContent =
          'Ошибка загрузки банка. Запустите в app: npm run build:bank (нужны question-bank.json и question-bank.data.js).';
      }
      console.error(e);
    }
    showScreen('quiz-setup');
    updateSourceUi();
  });
})();
