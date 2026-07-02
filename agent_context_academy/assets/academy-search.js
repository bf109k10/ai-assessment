(function () {
  const SYNONYMS = {
    rag: ['retrieval', 'ретривал', 'chunk', 'чанк', 'embedding', 'эмбеддинг'],
    mcp: ['tool', 'tools', 'инструмент'],
    rule: ['rules', 'правил', 'mdc', 'cursor rules'],
    skill: ['skills', 'скилл'],
    hook: ['hooks', 'хук'],
    memory: ['память', 'memory bank'],
    cache: ['caching', 'кэш', 'кеш'],
    agent: ['агент', 'agents'],
    prompt: ['промпт', 'prompting'],
    subagent: ['subagents', 'субагент'],
  };

  const TYPE_LABELS = {
    page: 'Страница',
    section: 'Раздел',
    question: 'Вопрос',
    nuance: 'Тонкость',
  };

  const TYPE_ORDER = { page: 0, section: 1, nuance: 2, question: 3 };

  let index = null;
  let assetBase = '../assets/';
  let modalOpen = false;

  function detectAssetBase() {
    const scripts = document.getElementsByTagName('script');
    for (let i = scripts.length - 1; i >= 0; i--) {
      const src = scripts[i].src || '';
      if (src.includes('app.js') || src.includes('academy-search.js')) {
        return src.replace(/[^/]+$/, '');
      }
    }
    return '../assets/';
  }

  function norm(s) {
    return (s || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** @returns {string[][]} каждый элемент — OR-группа (достаточно одного совпадения) */
  function tokenGroupsForQuery(query) {
    const n = norm(query);
    if (!n) return [];

    const parts = n.split(/[^\p{L}\p{N}#+._-]+/u).filter((t) => t.length >= 2 || /^[a-z0-9]{1,2}$/i.test(t));
    if (!parts.length && n.length >= 2) parts.push(n);

    return parts.map((part) => synonymVariants(part));
  }

  function synonymVariants(token) {
    const t = norm(token);
    const variants = new Set([t]);
    for (const [key, alts] of Object.entries(SYNONYMS)) {
      const group = [key, ...alts];
      const exact = group.some((w) => norm(w) === t);
      if (exact) group.forEach((w) => variants.add(norm(w)));
    }
    return [...variants];
  }

  /** Плоский список для подсветки — только то, что ввёл пользователь */
  function highlightTokens(query) {
    const n = norm(query);
    if (!n) return [];
    const parts = n.split(/[^\p{L}\p{N}#+._-]+/u).filter((t) => t.length >= 2);
    if (!parts.length && n.length >= 2) return [n];
    return parts;
  }

  function haystack(entry) {
    const title = norm(entry.title);
    const pageTitle = norm(entry.pageTitle);
    const text = norm(entry.text);
    return { title, pageTitle, text, all: `${title} ${pageTitle} ${text}` };
  }

  function indexOfAny(hay, variants) {
    let best = -1;
    let hit = '';
    for (const v of variants) {
      if (!v) continue;
      const i = hay.indexOf(v);
      if (i >= 0 && (best < 0 || i < best)) {
        best = i;
        hit = v;
      }
    }
    return { idx: best, variant: hit };
  }

  function scoreEntry(entry, groups, rawQuery) {
    const { title, pageTitle, text, all } = haystack(entry);
    const qn = norm(rawQuery);
    let score = 0;

    if (qn.length >= 2 && all.includes(qn)) {
      score += qn.length >= 4 ? 100 : 70;
      if (title.includes(qn)) score += 40;
      if (pageTitle.includes(qn)) score += 20;
    }

    for (const group of groups) {
      const inTitle = indexOfAny(title, group);
      const inPage = indexOfAny(pageTitle, group);
      const inText = indexOfAny(text, group);
      if (inTitle.idx < 0 && inPage.idx < 0 && inText.idx < 0) return 0;

      if (inTitle.idx >= 0) score += 35 + Math.max(0, 20 - inTitle.idx);
      else if (inPage.idx >= 0) score += 18;
      else if (inText.idx >= 0) score += 12 + Math.max(0, 8 - Math.floor(inText.idx / 40));
    }

    if (entry.type === 'page') score += 8;
    if (entry.type === 'question' && entry.level === 'senior') score += 2;
    return score;
  }

  function highlightSnippet(snippet, tokens) {
    let s = snippet || '';
    if (!s || !tokens.length) return escapeHtml(s);
    let html = escapeHtml(s);
    const uniq = [...new Set(tokens)].sort((a, b) => b.length - a.length);
    for (const t of uniq) {
      if (t.length < 2) continue;
      const re = new RegExp(`(${escapeReg(t)})`, 'gi');
      html = html.replace(re, '<mark>$1</mark>');
    }
    return html;
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escapeReg(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function pageHref(page) {
    const file = page.replace(/^pages\//, '');
    const inPages = /\/pages\//.test(location.pathname.replace(/\\/g, '/'));
    return inPages ? file : `pages/${file}`;
  }

  function search(query, limit = 24) {
    if (!index?.entries?.length) return [];
    const groups = tokenGroupsForQuery(query);
    if (!groups.length) return [];
    const scored = [];
    for (const e of index.entries) {
      const sc = scoreEntry(e, groups, query);
      if (sc > 0) scored.push({ entry: e, score: sc });
    }
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (TYPE_ORDER[a.entry.type] ?? 9) - (TYPE_ORDER[b.entry.type] ?? 9);
    });
    return scored.slice(0, limit);
  }

  function injectUi() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar || document.getElementById('academySearchTrigger')) return;

    const box = document.createElement('div');
    box.className = 'academySearchBox';
    box.innerHTML =
      '<button type="button" class="academySearchTrigger" id="academySearchTrigger" aria-label="Поиск по академии">' +
      '<span class="academySearchIcon">🔍</span>' +
      '<span class="academySearchPlaceholder">Поиск по темам, разделам, Q&A…</span>' +
      '<kbd class="academySearchKbd">Ctrl K</kbd></button>';

    const brand = sidebar.querySelector('.brand');
    if (brand?.nextSibling) sidebar.insertBefore(box, brand.nextSibling);
    else sidebar.prepend(box);

    const overlay = document.createElement('div');
    overlay.className = 'academySearchOverlay';
    overlay.id = 'academySearchOverlay';
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="academySearchModal" role="dialog" aria-modal="true" aria-label="Поиск">' +
      '<div class="academySearchHead">' +
      '<span class="academySearchIcon">🔍</span>' +
      '<input type="search" id="academySearchInput" autocomplete="off" spellcheck="false" placeholder="RAG, hooks, lost in the middle, junior…" />' +
      '<button type="button" class="academySearchClose" id="academySearchClose" aria-label="Закрыть">✕</button>' +
      '</div>' +
      '<div class="academySearchMeta" id="academySearchMeta"></div>' +
      '<ul class="academySearchResults" id="academySearchResults"></ul>' +
      '<div class="academySearchFoot">↑↓ выбор · Enter открыть · Esc закрыть</div>' +
      '</div>';
    document.body.appendChild(overlay);

    document.getElementById('academySearchTrigger').addEventListener('click', openModal);
    document.getElementById('academySearchClose').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    document.getElementById('academySearchInput').addEventListener('input', onInput);
    document.getElementById('academySearchInput').addEventListener('keydown', onInputKeydown);
  }

  let activeIdx = -1;
  let lastResults = [];

  function openModal() {
    const overlay = document.getElementById('academySearchOverlay');
    if (!overlay) return;
    overlay.hidden = false;
    modalOpen = true;
    document.body.classList.add('academySearchOpen');
    const input = document.getElementById('academySearchInput');
    input.value = '';
    activeIdx = -1;
    renderResults([], '');
    requestAnimationFrame(() => input.focus());
  }

  function closeModal() {
    const overlay = document.getElementById('academySearchOverlay');
    if (!overlay) return;
    overlay.hidden = true;
    modalOpen = false;
    document.body.classList.remove('academySearchOpen');
  }

  function onInput() {
    const q = document.getElementById('academySearchInput').value.trim();
    lastResults = search(q);
    activeIdx = lastResults.length ? 0 : -1;
    renderResults(lastResults, q);
  }

  function onInputKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
      return;
    }
    if (!lastResults.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = Math.min(lastResults.length - 1, activeIdx + 1);
      renderResults(lastResults, document.getElementById('academySearchInput').value.trim(), true);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(0, activeIdx - 1);
      renderResults(lastResults, document.getElementById('academySearchInput').value.trim(), true);
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      go(lastResults[activeIdx].entry);
    }
  }

  function go(entry) {
    if (!entry?.page) return;
    try {
      const recent = JSON.parse(localStorage.getItem('academySearchRecent') || '[]');
      const next = [{ page: entry.page, title: entry.title, t: Date.now() }, ...recent.filter((r) => r.page !== entry.page || r.title !== entry.title)].slice(0, 8);
      localStorage.setItem('academySearchRecent', JSON.stringify(next));
    } catch (_) {}
    location.href = pageHref(entry.page);
  }

  function renderResults(results, query, keepScroll) {
    const meta = document.getElementById('academySearchMeta');
    const list = document.getElementById('academySearchResults');
    if (!meta || !list) return;

    if (!query) {
      meta.textContent = index
        ? `${index.entryCount || index.entries?.length || 0} фрагментов · введите запрос`
        : 'Загрузка индекса…';
      list.innerHTML = '';
      showRecent(list);
      return;
    }

    if (!results.length) {
      meta.textContent = 'Ничего не найдено — попробуйте другое слово или синоним (rules / mdc, cache / caching)';
      list.innerHTML = '';
      return;
    }

    meta.textContent = `${results.length} результат${results.length === 1 ? '' : results.length < 5 ? 'а' : 'ов'}`;
    const tokens = highlightTokens(query);
    list.innerHTML = results
      .map((r, i) => {
        const e = r.entry;
        const type = TYPE_LABELS[e.type] || e.type;
        const level = e.level ? `<span class="academySearchLevel">${escapeHtml(e.level)}</span>` : '';
        const active = i === activeIdx ? ' active' : '';
        return (
          `<li><button type="button" class="academySearchHit${active}" data-idx="${i}">` +
          `<span class="academySearchHitTop">` +
          `<span class="academySearchType">${type}</span>${level}` +
          `<span class="academySearchPage">${escapeHtml(e.pageTitle)}</span></span>` +
          `<span class="academySearchTitle">${highlightSnippet(e.title, tokens)}</span>` +
          `<span class="academySearchSnippet">${highlightSnippet(e.snippet, tokens)}</span>` +
          `</button></li>`
        );
      })
      .join('');

    list.querySelectorAll('.academySearchHit').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.idx);
        if (results[i]) go(results[i].entry);
      });
    });

    if (!keepScroll && activeIdx >= 0) {
      const activeEl = list.querySelector('.academySearchHit.active');
      activeEl?.scrollIntoView({ block: 'nearest' });
    }
  }

  function showRecent(list) {
    let recent = [];
    try {
      recent = JSON.parse(localStorage.getItem('academySearchRecent') || '[]');
    } catch (_) {}
    if (!recent.length) return;
    list.innerHTML =
      '<li class="academySearchRecentLabel">Недавно</li>' +
      recent
        .map(
          (r) =>
            `<li><button type="button" class="academySearchHit" data-recent="${escapeHtml(r.page)}">` +
            `<span class="academySearchTitle">${escapeHtml(r.title)}</span>` +
            `<span class="academySearchPage">${escapeHtml(r.page.replace(/^pages\//, ''))}</span>` +
            `</button></li>`
        )
        .join('');
    list.querySelectorAll('[data-recent]').forEach((btn) => {
      btn.addEventListener('click', () => {
        location.href = pageHref(btn.getAttribute('data-recent'));
      });
    });
  }

  async function loadIndex() {
    if (window.ACADEMY_SEARCH_INDEX) {
      index = window.ACADEMY_SEARCH_INDEX;
      return;
    }
    try {
      const res = await fetch(assetBase + 'search-index.json', { cache: 'no-cache' });
      if (res.ok) {
        index = await res.json();
        return;
      }
    } catch (_) {}
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = assetBase + 'search-index.data.js';
      s.onload = () => {
        index = window.ACADEMY_SEARCH_INDEX || null;
        resolve();
      };
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  }

  function bindShortcuts() {
    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (modalOpen) closeModal();
        else openModal();
      }
      if (mod && e.key === '/') {
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        e.preventDefault();
        openModal();
      }
    });
  }

  window.AcademySearch = { open: openModal, close: closeModal, search };

  async function initSearch() {
    assetBase = detectAssetBase();
    injectUi();
    bindShortcuts();
    await loadIndex();
    const meta = document.getElementById('academySearchMeta');
    if (meta && index) meta.textContent = `${index.entryCount || index.entries?.length || 0} фрагментов · Ctrl+K`;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSearch);
  } else {
    initSearch();
  }
})();
