/* eslint-disable no-unused-vars */
window.AcademyGraph = function initAcademyGraph(cfg) {
  const NODES = cfg.nodes;
  const EDGES = cfg.edges;
  const LC = cfg.levelColors;
  const PAGE_LINKS = cfg.pageLinks || {};
  const CAT_ICON = cfg.catIcons || {};
  const chipTag = cfg.chipTag || 'граф';
  const markerPrefix = cfg.markerPrefix || 'ag';
  const NW = cfg.nodeWidth || 142;
  const NH = cfg.nodeHeight || 52;
  const GAP = cfg.gap || 14;
  const minSvgW = cfg.minSvgW || 1060;
  const rowGutter = cfg.rowGutter ?? 0;

  const ids = Object.assign({
    inner: 'graphInner',
    viewport: 'graphViewport',
    zoomIn: 'zoomIn',
    zoomOut: 'zoomOut',
    zoomReset: 'zoomReset',
    zoomLabel: 'zoomLabel',
    zoomFullscreen: 'zoomFullscreen',
    wrap: 'graphWrap',
    modal: 'graphModal',
    backdrop: 'graphBackdrop',
    close: 'graphClose',
    panel: 'graphPanel',
    filters: 'graphFilters',
    legend: 'graphLegend',
  }, cfg.ids || {});

  const order = new Map(NODES.map((n, i) => [n.id, i]));
  const maxRank = Math.max(...NODES.map(n => n.rank));
  const RANK_Y = cfg.rankY || Array.from({ length: maxRank + 1 }, (_, i) => 44 + i * (cfg.rowStep || 124));
  const svgHBase = cfg.svgHeight || (RANK_Y[maxRank] + NH + 48);

  let selectedId = null;
  let levelFilter = 'all';
  let graphZoom = 1;
  let lastSvgW = minSvgW;
  let lastSvgH = svgHBase;
  const ZOOM_MIN = 0.55;
  const ZOOM_MAX = 1.85;
  const ZOOM_STEP = 0.12;

  function splitLabel(label) {
    if (label.length <= 17) return [label];
    const words = label.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      const mid = Math.ceil(words.length / 2);
      return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
    }
    const mid = Math.floor(label.length / 2);
    let br = label.lastIndexOf('/', mid);
    if (br < 6) br = label.lastIndexOf(' ', mid);
    if (br < 6) br = mid;
    return [label.slice(0, br).trim(), label.slice(br).replace(/^\s*/, '')];
  }

  function nodeWidth(label) {
    const lines = splitLabel(label);
    const longest = Math.max(...lines.map(l => l.length));
    return Math.max(NW, Math.min(172, Math.ceil(longest * 7.2) + 28));
  }

  function rowLabelParts(label) {
    const i = String(label).indexOf(' · ');
    if (i === -1) return { line1: label, line2: '' };
    return { line1: label.slice(0, i), line2: label.slice(i + 3) };
  }

  function computeX(nodes, svgW, gap) {
    nodes.forEach(n => { n.w = nodeWidth(n.label); });
    const byRank = {};
    nodes.forEach(n => {
      if (!byRank[n.rank]) byRank[n.rank] = [];
      byRank[n.rank].push(n);
    });
    Object.keys(byRank).sort((a, b) => +a - +b).forEach(rank => {
      const row = byRank[rank].sort((a, b) => (order.get(a.id) || 0) - (order.get(b.id) || 0));
      const totalW = row.reduce((sum, n, i) => sum + n.w + (i ? gap : 0), 0);
      let sx = Math.max(rowGutter || 14, (svgW - totalW) / 2);
      row.forEach(n => {
        n.x = sx;
        sx += n.w + gap;
      });
    });
  }

  function rowTotalWidth(nodes, gap) {
    return nodes.reduce((sum, n, i) => sum + nodeWidth(n.label) + (i ? gap : 0), 0);
  }

  function buildSVG(nodes, edges) {
    const gap = GAP;
    const byRank = {};
    nodes.forEach(n => {
      if (!byRank[n.rank]) byRank[n.rank] = [];
      byRank[n.rank].push(n);
    });
    const maxRowW = Math.max(...Object.values(byRank).map(row => rowTotalWidth(row, gap)));
    const maxCount = Math.max(...Object.values(byRank).map(row => row.length));
    const svgW = Math.max(minSvgW, maxRowW + 32, maxCount * NW + (maxCount - 1) * gap + 32);
    const svgH = svgHBase;
    computeX(nodes, svgW, gap);
    const nm = {};
    nodes.forEach(n => { n.y = RANK_Y[n.rank]; nm[n.id] = n; });

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', svgW);
    svg.setAttribute('height', svgH);
    svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
    lastSvgW = svgW;
    lastSvgH = svgH;

    const defs = document.createElementNS(ns, 'defs');
    ['def', 'hi'].forEach(k => {
      const m = document.createElementNS(ns, 'marker');
      m.setAttribute('id', `${markerPrefix}-arr-${k}`);
      m.setAttribute('markerWidth', '8');
      m.setAttribute('markerHeight', '8');
      m.setAttribute('refX', '7');
      m.setAttribute('refY', '3');
      m.setAttribute('orient', 'auto');
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', 'M0,0 L0,6 L8,3 z');
      p.setAttribute('fill', k === 'hi' ? '#2563eb' : '#94a3b8');
      m.appendChild(p);
      defs.appendChild(m);
    });
    svg.appendChild(defs);

    [...new Set(nodes.map(n => n.rank))].sort((a, b) => a - b).forEach(r => {
      const lvl = nodes.find(n => n.rank === r).level;
      const c = LC[lvl];
      const rankLabels = cfg.rankLabels || {};
      const bandX = rowGutter ? rowGutter - 12 : 8;
      const bandW = rowGutter ? svgW - rowGutter + 4 : svgW - 16;
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', bandX);
      rect.setAttribute('y', RANK_Y[r] - 18);
      rect.setAttribute('width', bandW);
      rect.setAttribute('height', NH + 36);
      rect.setAttribute('rx', 14);
      rect.setAttribute('fill', c.band);
      svg.appendChild(rect);
      const labelText = rankLabels[r] != null ? rankLabels[r] : c.label;
      if (rowGutter) {
        const parts = rowLabelParts(labelText);
        const lblBg = document.createElementNS(ns, 'rect');
        lblBg.setAttribute('x', 10);
        lblBg.setAttribute('y', RANK_Y[r] - 2);
        lblBg.setAttribute('width', rowGutter - 22);
        lblBg.setAttribute('height', NH + 4);
        lblBg.setAttribute('rx', 8);
        lblBg.setAttribute('fill', '#ffffff');
        lblBg.setAttribute('fill-opacity', '0.72');
        svg.appendChild(lblBg);
        const lbl = document.createElementNS(ns, 'text');
        lbl.setAttribute('x', 16);
        lbl.setAttribute('font-size', '9.5');
        lbl.setAttribute('font-weight', '800');
        lbl.setAttribute('font-family', 'Inter,Arial,sans-serif');
        lbl.setAttribute('fill', c.text);
        const cy = RANK_Y[r] + NH / 2 + (parts.line2 ? -2 : 4);
        const l1 = document.createElementNS(ns, 'tspan');
        l1.setAttribute('x', 16);
        l1.setAttribute('y', cy);
        l1.textContent = parts.line1;
        lbl.appendChild(l1);
        if (parts.line2) {
          const l2 = document.createElementNS(ns, 'tspan');
          l2.setAttribute('x', 16);
          l2.setAttribute('dy', '11');
          l2.setAttribute('font-size', '8.5');
          l2.setAttribute('font-weight', '700');
          l2.setAttribute('opacity', '0.85');
          l2.textContent = parts.line2;
          lbl.appendChild(l2);
        }
        svg.appendChild(lbl);
      } else {
        const lbl = document.createElementNS(ns, 'text');
        lbl.setAttribute('x', 22);
        lbl.setAttribute('y', RANK_Y[r] + NH / 2 + 4);
        lbl.setAttribute('font-size', '10');
        lbl.setAttribute('font-weight', '800');
        lbl.setAttribute('font-family', 'Inter,Arial,sans-serif');
        lbl.setAttribute('fill', c.text);
        lbl.setAttribute('opacity', '0.6');
        lbl.textContent = labelText;
        svg.appendChild(lbl);
      }
    });

    edges.forEach(e => {
      const s = nm[e.from];
      const t = nm[e.to];
      if (!s || !t) return;
      const x1 = s.x + s.w / 2;
      const y1 = s.y + NH;
      const x2 = t.x + t.w / 2;
      const y2 = t.y;
      const my = (y1 + y2) / 2;
      const isRel = selectedId && (e.from === selectedId || e.to === selectedId);
      const isDim = selectedId && !isRel;
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', `M${x1} ${y1} C${x1} ${my},${x2} ${my},${x2} ${y2}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', isRel ? '#2563eb' : '#94a3b8');
      path.setAttribute('stroke-width', isRel ? '2.2' : '1.5');
      path.setAttribute('stroke-opacity', isDim ? '0.08' : (isRel ? '1' : '0.5'));
      path.setAttribute('marker-end', isRel ? `url(#${markerPrefix}-arr-hi)` : `url(#${markerPrefix}-arr-def)`);
      svg.appendChild(path);
    });

    nodes.forEach(n => {
      const c = LC[n.level];
      const isSel = n.id === selectedId;
      const isRel = selectedId && edges.some(e =>
        (e.from === selectedId && e.to === n.id) || (e.to === selectedId && e.from === n.id));
      const isDim = selectedId && !isSel && !isRel;

      const g = document.createElementNS(ns, 'g');
      g.setAttribute('data-id', n.id);
      g.setAttribute('opacity', isDim ? '0.18' : '1');
      g.style.cursor = 'pointer';

      const w = n.w || NW;
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', n.x);
      rect.setAttribute('y', n.y);
      rect.setAttribute('width', w);
      rect.setAttribute('height', NH);
      rect.setAttribute('rx', 9);
      rect.setAttribute('fill', isSel ? '#1e40af' : c.fill);
      rect.setAttribute('stroke', isSel ? '#1e40af' : (isRel ? '#2563eb' : c.stroke));
      rect.setAttribute('stroke-width', (isSel || isRel) ? '2' : '1');
      g.appendChild(rect);

      const txt = document.createElementNS(ns, 'text');
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('font-family', 'Inter,Arial,sans-serif');
      txt.setAttribute('fill', isSel ? '#ffffff' : c.text);
      txt.setAttribute('font-weight', '700');
      const cx = n.x + w / 2;
      const lines = splitLabel(n.label);
      if (lines.length > 1) {
        txt.setAttribute('font-size', '10');
        const s1 = document.createElementNS(ns, 'tspan');
        s1.setAttribute('x', cx);
        s1.setAttribute('y', n.y + NH / 2 - 8);
        s1.textContent = lines[0];
        const s2 = document.createElementNS(ns, 'tspan');
        s2.setAttribute('x', cx);
        s2.setAttribute('dy', '12');
        s2.textContent = lines[1];
        txt.appendChild(s1);
        txt.appendChild(s2);
      } else {
        txt.setAttribute('font-size', '11.5');
        txt.setAttribute('x', cx);
        txt.setAttribute('y', n.y + NH / 2 + 1);
        txt.textContent = n.label;
      }
      g.appendChild(txt);

      const cat = document.createElementNS(ns, 'text');
      cat.setAttribute('x', cx);
      cat.setAttribute('y', n.y + NH - 7);
      cat.setAttribute('text-anchor', 'middle');
      cat.setAttribute('font-size', '9');
      cat.setAttribute('font-family', 'Inter,Arial,sans-serif');
      cat.setAttribute('fill', isSel ? '#93c5fd' : '#64748b');
      cat.textContent = n.cat;
      g.appendChild(cat);

      g.addEventListener('click', () => {
        const next = selectedId === n.id ? null : n.id;
        selectedId = next;
        render();
        if (next) openDetailModal(NODES.find(x => x.id === next));
        else closeDetailModal();
      });
      svg.appendChild(g);
    });

    return svg;
  }

  function applyGraphZoom() {
    const inner = document.getElementById(ids.inner);
    const scaleEl = inner?.querySelector('.ac-graph-scale');
    const label = document.getElementById(ids.zoomLabel);
    if (!inner || !scaleEl) return;
    scaleEl.style.transform = `scale(${graphZoom})`;
    inner.style.width = Math.ceil(lastSvgW * graphZoom) + 'px';
    inner.style.height = Math.ceil(lastSvgH * graphZoom) + 'px';
    if (label) label.textContent = Math.round(graphZoom * 100) + '%';
  }

  function setGraphZoom(z) {
    graphZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));
    applyGraphZoom();
  }

  function render() {
    const inner = document.getElementById(ids.inner);
    if (!inner) return;
    inner.innerHTML = '';
    const includes = cfg.levelFilterIncludes && cfg.levelFilterIncludes[levelFilter];
    const vis = levelFilter === 'all'
      ? NODES
      : includes
        ? NODES.filter(n => includes.includes(n.level))
        : NODES.filter(n => n.level === levelFilter);
    const visIds = new Set(vis.map(n => n.id));
    const visEdges = EDGES.filter(e => visIds.has(e.from) && visIds.has(e.to));
    const svg = buildSVG(vis, visEdges);
    svg.classList.add('ac-graph-svg');
    const scale = document.createElement('div');
    scale.className = 'ac-graph-scale';
    scale.appendChild(svg);
    inner.appendChild(scale);
    applyGraphZoom();
  }

  function closeDetailModal() {
    selectedId = null;
    const modal = document.getElementById(ids.modal);
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
    render();
  }

  function openDetailModal(node) {
    const modal = document.getElementById(ids.modal);
    const panel = document.getElementById(ids.panel);
    if (!modal || !panel) return;
    const c = LC[node.level];
    const icon = node.icon || CAT_ICON[node.cat] || '📌';
    const inc = EDGES.filter(e => e.to === node.id).map(e => NODES.find(n => n.id === e.from)).filter(Boolean);
    const out = EDGES.filter(e => e.from === node.id).map(e => NODES.find(n => n.id === e.to)).filter(Boolean);
    const link = PAGE_LINKS[node.id];
    const linkHtml = link
      ? `<p style="margin-top:12px"><a class="btn primary" href="${link}">Открыть тему в Academy →</a></p>`
      : '';
    const incHtml = inc.length ? `
      <div class="ac-graph-details-section">
        <h3>${cfg.edgeInLabel || 'Требует знания'}</h3>
        ${inc.map(n => `<button type="button" class="ac-graph-case-card" data-goto="${n.id}"><b>← ${n.label}</b><br><span style="font-size:12px;color:#64748b">${n.cat} · ${LC[n.level].label}</span></button>`).join('')}
      </div>` : '';
    const outHtml = out.length ? `
      <div class="ac-graph-details-section">
        <h3>${cfg.edgeOutLabel || 'Влияет на'}</h3>
        ${out.map(n => `<button type="button" class="ac-graph-case-card out" data-goto="${n.id}"><b>→ ${n.label}</b><br><span style="font-size:12px;color:#64748b">${n.cat} · ${LC[n.level].label}</span></button>`).join('')}
      </div>` : '';
  const priority = node.priority ? `
      <div class="ac-graph-details-section">
        <h3>Приоритет при конфликте</h3>
        <p>${node.priority}</p>
      </div>` : '';

    panel.innerHTML = `
      <div class="ac-graph-details-top">
        <div class="ac-graph-details-icon" style="color:${c.text};border-color:${c.stroke}">${icon}</div>
        <div>
          <h2 id="detailModalTitle">${node.label}</h2>
          <div class="ac-graph-details-sub">${c.label} · ${node.cat}</div>
        </div>
      </div>
      <div class="ac-graph-details-section">
        <h3>Описание</h3>
        <p>${node.desc}</p>
      </div>
      ${priority}
      ${incHtml}
      ${outHtml}
      <div class="ac-graph-chips">
        <span class="ac-graph-chip">${c.label}</span>
        <span class="ac-graph-chip">${node.cat}</span>
        <span class="ac-graph-chip">${chipTag}</span>
      </div>
      ${linkHtml}
      <p class="ac-graph-modal-hint">Esc или фон — закрыть. Клик по связи — перейти к другому слою на карте.</p>`;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.getElementById(ids.close)?.focus();
  }

  function initFullscreen() {
    const wrap = ids.wrap ? document.getElementById(ids.wrap) : null;
    const btn = ids.zoomFullscreen ? document.getElementById(ids.zoomFullscreen) : null;
    if (!wrap || !btn) return;
    const sync = () => {
      const on = document.fullscreenElement === wrap;
      btn.title = on ? 'Выйти из полного экрана (Esc)' : 'На весь экран';
      btn.setAttribute('aria-label', btn.title);
      btn.textContent = on ? '⤓' : '⛶';
    };
    btn.addEventListener('click', () => {
      if (document.fullscreenElement === wrap) document.exitFullscreen().catch(() => {});
      else wrap.requestFullscreen().catch(() => {});
    });
    document.addEventListener('fullscreenchange', sync);
    sync();
  }

  function initZoom() {
    // Всегда 100% при открытии страницы — иначе сохранённый zoom графа выглядит как «сломался масштаб сайта».
    graphZoom = 1;
    document.getElementById(ids.zoomIn)?.addEventListener('click', () => setGraphZoom(graphZoom + ZOOM_STEP));
    document.getElementById(ids.zoomOut)?.addEventListener('click', () => setGraphZoom(graphZoom - ZOOM_STEP));
    document.getElementById(ids.zoomReset)?.addEventListener('click', () => setGraphZoom(1));
    document.getElementById(ids.viewport)?.addEventListener('wheel', e => {
      // Alt+колёсико — только граф. Ctrl+колёсико в Windows = zoom всей страницы (включая сайдбар).
      if (!e.altKey) return;
      e.preventDefault();
      setGraphZoom(graphZoom + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
    }, { passive: false });
  }

  function initModal() {
    document.getElementById(ids.backdrop)?.addEventListener('click', closeDetailModal);
    document.getElementById(ids.close)?.addEventListener('click', closeDetailModal);
    document.getElementById(ids.panel)?.addEventListener('click', e => {
      const btn = e.target.closest('[data-goto]');
      if (!btn) return;
      e.stopPropagation();
      const id = btn.dataset.goto;
      const next = NODES.find(n => n.id === id);
      if (!next) return;
      selectedId = id;
      render();
      openDetailModal(next);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !document.getElementById(ids.modal)?.hidden) closeDetailModal();
    });
  }

  function initFilters() {
    const el = document.getElementById(ids.filters);
    if (!el || !cfg.filterLevels) return;
    el.addEventListener('click', e => {
      const btn = e.target.closest('.ac-graph-filter-pill');
      if (!btn) return;
      levelFilter = btn.dataset.level;
      selectedId = null;
      el.querySelectorAll('.ac-graph-filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render();
      closeDetailModal();
    });
  }

  function initLegend() {
    const leg = document.getElementById(ids.legend);
    if (!leg) return;
    Object.entries(LC).forEach(([k, c]) => {
      const d = document.createElement('div');
      d.className = 'ac-graph-legend-item';
      d.innerHTML = `<div class="ac-graph-legend-dot" style="background:${c.fill};border:1.5px solid ${c.stroke}"></div><span>${c.label} · ${NODES.filter(n => n.level === k).length}</span>`;
      leg.appendChild(d);
    });
  }

  initZoom();
  initFullscreen();
  initModal();
  initFilters();
  initLegend();
  render();

  return { render, closeDetailModal, openDetailModal };
};
