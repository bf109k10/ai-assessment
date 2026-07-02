
const PAGES=["pages/home.html",
  "pages/prompting.html","pages/context-engineering.html","pages/context.html","pages/agent-loop.html","pages/workflow.html","pages/model-variance.html",
  "pages/agents-rules-skills.html","pages/agents-md.html","pages/rules.html","pages/hooks.html","pages/skills.html","pages/agent-packages.html","pages/commands.html",
  "pages/memory.html","pages/memory-structure.html","pages/rag.html","pages/mcp.html",
  "pages/caching.html","pages/checkpoints.html","pages/subagents.html","pages/agentic-systems.html","pages/permissions.html",
  "pages/conflicts.html","pages/tool-choice.html","pages/tricky-questions.html","pages/assessment.html","pages/quiz-session.html",
  "pages/roadmap.html","pages/overall.html"];

function currentKey(){
  const p=location.pathname.replace(/\\/g,'/');
  const parts=p.split('/').filter(Boolean);
  if(parts.length>=2 && parts[parts.length-2]==='pages') return 'pages/'+parts[parts.length-1];
  if(parts.length && parts[parts.length-1]==='index.html') return 'pages/home.html';
  return parts.length?parts[parts.length-1]:'pages/home.html';
}

function hrefToPageKey(href){
  let h=(href||'').replace(/^\.\//,'').replace(/^\.\.\//,'');
  if(h==='index.html'||h==='') return 'pages/home.html';
  if(!h.includes('/')&&h.endsWith('.html')) return 'pages/'+h;
  return h;
}

function initProgress(){
  const done=JSON.parse(localStorage.getItem('agentPlatformDone')||'{}');
  const count=PAGES.filter(p=>done[p]).length;
  const pct=Math.round(count/PAGES.length*100);
  document.querySelectorAll('.progressFill').forEach(e=>e.style.width=pct+'%');
  document.querySelectorAll('.progressText').forEach(e=>e.textContent=`${count}/${PAGES.length} страниц отмечено (${pct}%)`);
  const key=currentKey();
  const btn=document.querySelector('.markDone');
  if(btn){
    btn.textContent=done[key]?'✓ Страница изучена':'Отметить страницу изученной';
    btn.onclick=()=>{done[key]=!done[key];localStorage.setItem('agentPlatformDone',JSON.stringify(done));initProgress();};
  }
  document.querySelectorAll('.nav a').forEach(a=>{
    a.classList.remove('active');
    if(hrefToPageKey(a.getAttribute('href'))===key) a.classList.add('active');
  });
}

function initQuiz(){document.querySelectorAll('.quiz').forEach(q=>q.querySelectorAll('button[data-correct]').forEach(b=>b.onclick=()=>{const ok=b.dataset.correct==='true'; q.querySelectorAll('button').forEach(x=>x.classList.remove('correct','wrong')); b.classList.add(ok?'correct':'wrong'); const fb=q.querySelector('.quizFeedback'); if(fb){fb.textContent=ok?'Верно. Логика приоритета соблюдена.':'Не совсем. Определи: это правило, факт, workflow или действие?'; fb.style.color=ok?'#15803d':'#b91c1c';}}));}
function copyText(id){const el=document.getElementById(id); navigator.clipboard.writeText(el.innerText); const btn=document.querySelector(`[data-copy="${id}"]`); if(btn){const old=btn.textContent;btn.textContent='Скопировано';setTimeout(()=>btn.textContent=old,1200);}}
function loadAcademySearch(){
  if(document.querySelector('script[data-academy-search]')) return;
  let base='../assets/';
  const scripts=document.getElementsByTagName('script');
  for(let i=scripts.length-1;i>=0;i--){
    const src=scripts[i].src||'';
    if(src.includes('app.js')){ base=src.replace(/[^/]+$/,''); break; }
  }
  const s=document.createElement('script');
  s.src=base+'academy-search.js';
  s.dataset.academySearch='1';
  s.defer=true;
  document.head.appendChild(s);
}

document.addEventListener('DOMContentLoaded',()=>{
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  initProgress();
  initQuiz();
  loadAcademySearch();
  const main = document.querySelector('.main');
  if (main) {
    main.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    }, { passive: false });
  }
});
