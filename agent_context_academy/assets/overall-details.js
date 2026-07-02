/* Context schema modal — from overall-full */
(function () {
    const details = {
      system: {
        icon: "🧭", color: "navy-text", title: "System instructions — слой 0", sub: "System Prompt + Prefix Cursor / Prefix Claude Code",
        sections: [
          ["Три узла на графе", "System Prompt — скрытый platform layer. Prefix Cursor — как Cursor склеивает начало окна (Rules в prefix). Prefix Claude Code — сборка system в Claude Code (settings, CLAUDE.md, skills metadata)."],
          ["Что это", "System instructions — зонтичный термин для всего блока до user-диалога. На интерактивной карте выше схемы он разбит на три кликабельных узла + Conflicts."],
          ["При конфликте", "Platform system prompt выше AGENTS.md, Skills, Memory, RAG и запроса пользователя."],
          ["Подробнее", "prompting.html#system-instructions · клик по узлам на графе"]
        ],
        chips: ["System Prompt", "Prefix Cursor", "Prefix Claude Code"]
      },
      conflicts: {
        icon: "⚠️", color: "yellow-text", title: "Conflicts / противоречия инструкций", sub: "Как выбирать, если разные слои говорят разное",
        sections: [
          ["Что такое конфликт", "Конфликт — это ситуация, когда два источника контекста дают несовместимые указания. Например: Rule запрещает менять API, а Skill предлагает изменить API; пользователь просит удалить тесты, а AGENTS.md требует сохранять тестовое покрытие."],
          ["Базовая логика", "Не надо выполнять последнее или самое удобное указание. Нужно применить иерархию: system/platform instructions выше всего; затем проектные инструкции и rules; затем текущая задача; затем memory/RAG/tools/skills как вспомогательные источники."],
          ["Правило 1: приоритет", "Более высокий слой побеждает более низкий. System выше Rules, Rules выше Skill, AGENTS.md выше обычной подсказки из текущего чата, если речь о проектном workflow."],
          ["Правило 2: конкретность", "Если два источника одного уровня не конфликтуют напрямую, выбирается более конкретный. Например, общий AGENTS.md говорит “пиши тесты”, а Rule для backend уточняет “для сервисного слоя использовать integration tests”."],
          ["Правило 3: свежесть фактов", "Для фактов, которые меняются, свежий результат MCP/tool или актуальный файл обычно надёжнее старой Memory. Но свежий факт всё равно не может отменить safety/rules."]
        ],
        cases: [
          ["Rule vs Skill", "Rule: “не добавлять новые зависимости”. Skill: “для отчёта установи новую библиотеку”. Правильный выбор: Rule. Skill нужно адаптировать без новой зависимости."],
          ["AGENTS.md vs User request", "AGENTS.md: “перед изменением кода запускать unit tests”. Пользователь: “быстро поменяй без тестов”. Правильный выбор: не игнорировать AGENTS.md; можно объяснить риск и предложить минимальную проверку."],
          ["Memory vs MCP", "Memory: “сервис называется old-api”. MCP/файлы показывают, что сейчас сервис new-api. Для актуального факта выбираем MCP/файлы."]
        ],
        table: [
          ["Конфликт", "Что выбрать", "Почему"],
          ["System vs всё остальное", "System", "Это верхний слой платформы."],
          ["Rules vs Skills", "Rules", "Skill — способ работы, Rules — ограничения."],
          ["AGENTS.md vs текущий чат", "Зависит от темы, чаще AGENTS.md для workflow", "Чат задаёт задачу, но не отменяет проектные правила."],
          ["Memory vs MCP/tool result", "MCP/tool result для актуальных фактов", "Memory может устареть."],
          ["RAG vs AGENTS.md/Rules", "AGENTS.md/Rules для поведения", "RAG даёт факты, но не управляет поведением."]
        ],
        chips: ["priority", "specificity", "freshness", "source of truth", "safe fallback"]
      },
      checkpoint: {
        icon: "✅", color: "orange-text", title: "Checkpoint", sub: "Структурная точка сохранения состояния задачи",
        sections: [
          ["Что это", "Checkpoint — это structured snapshot: цель, что сделано, какие решения приняты, какие есть риски, что делать дальше, какие команды/файлы/ссылки важны."],
          ["Чем отличается от summary", "Summary просто кратко пересказывает. Checkpoint фиксирует рабочее состояние так, чтобы другой агент или ты сам мог продолжить задачу без потери логики."],
          ["Когда использовать", "Перед длинной паузой, перед context compression, при передаче работы subagent'у, после важного решения, перед сменой направления."],
          ["Хороший шаблон", "Goal → Current state → Done → Decisions → Open questions → Risks/blockers → Next steps → Commands/files/links."]
        ],
        cases: [["Плохой checkpoint", "“Мы чинили CI, что-то падало”. Нельзя продолжить."], ["Хороший checkpoint", "“Goal: починить job X. Done: проверены логи A/B. Decision: причина не infra. Risk: flaky test. Next: проверить commit abc.”"]],
        chips: ["goal", "done", "decisions", "risks", "next steps"]
      },
      agents: {
        icon: "📄", color: "red-text", title: "AGENTS.md", sub: "Проектная инструкция для агента",
        sections: [
          ["Что это", "Файл с инструкциями для агента в конкретном проекте или репозитории. Обычно описывает роль агента, стиль работы, команды, тесты, правила внесения изменений, архитектурные принципы и ожидания команды."],
          ["Когда используется", "Когда агент работает внутри репозитория. В Cursor / Claude Code такой файл помогает понять, как принято работать в этом проекте."],
          ["Что туда класть", "Команды тестов, build, lint, Definition of Done, структуру проекта, важные ограничения, правила PR, способ проверки результата."],
          ["Что не класть", "Секреты, токены, большие логи, часто меняющиеся статусы, огромные документы. Для этого лучше docs, RAG, Memory или tools."]
        ],
        chips: ["роль агента", "workflow проекта", "команды тестов", "Definition of Done"]
      },
      rules: {
        icon: "⚖️", color: "purple-text", title: "Rules / Policy", sub: "Обязательные ограничения и стандарты",
        sections: [
          ["Что это", "Правила проекта, команды, компании или IDE. Они задают code style, формат ответа, запреты, безопасность, compliance, ограничения по библиотекам и архитектурные стандарты."],
          ["Rules vs AGENTS.md", "AGENTS.md часто описывает роль и workflow. Rules чаще задают жёсткие ограничения. Они могут пересекаться, но лучше архитектурно разделять."],
          ["Rules vs Skills", "Если Skill предлагает шаг, который нарушает Rule, Skill нужно адаптировать. Skill — это playbook, а не разрешение нарушать policy."],
          ["Пример", "Rule: “не менять public API”. Skill: “для быстрого фикса поменяй сигнатуру метода”. Правильный выбор: не менять API; искать другой фикс."]
        ],
        chips: ["ограничения", "compliance", "code style", "safety"]
      },
      chat: {
        icon: "💬", color: "blue-text", title: "Запрос пользователя / текущий чат", sub: "Самая актуальная задача",
        sections: [
          ["Что это", "То, что пользователь просит сделать прямо сейчас: задача, уточнения, последние сообщения, прикреплённые файлы, скриншоты, ссылки."],
          ["Почему важен", "Именно текущий запрос определяет конкретный output: ответить, изменить файл, проверить ошибку, сделать схему, написать письмо, найти баг."],
          ["Ограничение", "Текущий запрос не отменяет System Prompt, Rules и проектные ограничения. Если пользователь просит нарушить Rule, агент должен объяснить ограничение и выбрать безопасный вариант."],
          ["Пример", "Пользователь: “удали failing test”. Rule: “не удалять тесты без анализа”. Правильно: сначала понять причину падения, а не удалять тест."]
        ],
        chips: ["текущая задача", "уточнения", "файлы", "output"]
      },
      memory: {
        icon: "🧠", color: "orange-text", title: "Memory Bank", sub: "Долговременная память проекта или пользователя",
        sections: [
          ["Что это", "Сохранённый контекст: решения, договорённости, архитектурные факты, предпочтения пользователя, история проекта, важные ограничения."],
          ["Когда используется", "Когда важно не терять continuity между сессиями: что уже решили, какие команды работают, какие подходы не подходят."],
          ["Memory vs RAG/MCP", "Memory полезна для устойчивого контекста, но может устареть. Если MCP или актуальные файлы показывают другое текущее состояние, лучше доверять свежему источнику."],
          ["Пример", "Memory помнит, что проект использовал Java 17. В pom.xml сейчас Java 21. Для текущего факта выбираем файл."]
        ],
        chips: ["continuity", "решения", "предпочтения", "может устареть"]
      },
      rag: {
        icon: "🔎", color: "green-text", title: "RAG / Retrieval", sub: "Подтягивание релевантных фрагментов",
        sections: [
          ["Что это", "Механизм поиска по внешним источникам: документации, коду, wiki, tickets, knowledge base. В контекст попадают найденные релевантные куски."],
          ["Когда используется", "Когда модели не хватает фактов из текущего чата: API, архитектура, старое решение, содержание документа, описание компонента."],
          ["RAG vs Rules", "RAG даёт факты, но не задаёт поведение. Если документ говорит одно, а актуальные Rules запрещают это делать, Rules выше."],
          ["Риск", "Retrieval может найти устаревший или похожий, но нерелевантный фрагмент. Хороший агент проверяет источник и контекст."]
        ],
        chips: ["docs", "code", "wiki", "knowledge base", "факты"]
      },
      mcp: {
        icon: "🛠", color: "teal-text", title: "MCP / Tools", sub: "Доступ к внешним системам и действиям",
        sections: [
          ["Что это", "Инструменты, через которые агент может читать файлы, ходить в API, базы данных, Jira, GitHub/GitLab, CI/CD, web, мониторинг и другие системы."],
          ["Когда используется", "Когда нужно проверить реальное состояние: открыть файл, посмотреть логи, запросить API, найти тикет, прочитать CI job."],
          ["MCP vs Memory/RAG", "Для актуального состояния системы tool-result обычно сильнее старой памяти или найденной старой документации."],
          ["Ограничение", "Tools требуют permissions. Даже если tool может удалить данные, агент не должен выполнять опасные действия без явного намерения пользователя и без учёта policy."]
        ],
        chips: ["API", "files", "CI/CD", "logs", "permissions"]
      },
      skills: {
        icon: "🎓", color: "blue-text", title: "Skills", sub: "Повторяемые сценарии выполнения задач",
        sections: [
          ["Что это", "Готовые инструкции или шаблоны: как делать code review, troubleshooting, deploy, анализ логов, генерацию отчёта, подготовку документа."],
          ["Skills vs Rules", "Skill отвечает на вопрос “как выполнять задачу”. Rule отвечает на вопрос “что разрешено/запрещено”. Если они конфликтуют — Rule выше."],
          ["Skills vs AGENTS.md", "Если AGENTS.md описывает project-specific workflow, а Skill общий, то Skill нужно адаптировать под AGENTS.md."],
          ["Пример", "Skill говорит: “для PDF используй библиотеку X”. Project Rule говорит: “не добавлять новые зависимости”. Значит, надо использовать уже доступный инструмент или спросить approval."]
        ],
        chips: ["playbook", "workflow", "шаблон", "ниже Rules"]
      },
      summary: {
        icon: "🧾", color: "purple-text", title: "Summary / Compression", sub: "Сжатие длинного контекста",
        sections: [
          ["Что это", "Когда история чата становится длинной, часть сообщений может быть сжата в summary. Это помогает уместить важное в окно контекста."],
          ["Ограничение", "Summary может потерять детали или нюансы. Это не новый источник истины, а сжатая версия прошлого контекста."],
          ["Summary vs текущий чат", "Если summary говорит одно, а пользователь в текущем чате уточнил другое, актуальное уточнение из текущего чата важнее."],
          ["Практика", "Для важных задач лучше делать structured checkpoint: цель, сделано, решения, риски, next steps, команды, ссылки."]
        ],
        chips: ["compression", "checkpoint", "context window", "может потерять детали"]
      },
      subagents: {
        icon: "👥", color: "navy-text", title: "Subagents", sub: "Специализированные агенты для делегирования",
        sections: [
          ["Что это", "Subagent — отдельный агент или специализированный режим, которому главный агент делегирует часть задачи: поиск по коду, анализ логов, review, сбор фактов, проверка гипотез."],
          ["Когда используют", "Когда задача большая, параллельная или требует специализации. Например, один subagent смотрит CI logs, второй ищет изменения в коде, третий проверяет документацию."],
          ["Какой контекст получает", "Обычно subagent не получает весь контекст главного чата. Ему передают подзадачу, нужные файлы/фрагменты, инструкции и иногда часть AGENTS.md/Rules."],
          ["Может ли использовать MCP/tools", "Зависит от платформы. Возможны варианты: те же tools, ограниченные tools, tools только у главного агента, или каждое действие требует разрешения."],
          ["Как возвращает результат", "Обычно возвращает summary: что проверил, что нашёл, доказательства, риски, рекомендации, ссылки/файлы/команды. Главный агент принимает итоговое решение."]
        ],
        cases: [["Хорошая постановка", "“Проверь, почему падает тест X. Используй файлы A/B, не меняй код, верни 3 гипотезы с доказательствами.”"], ["Риск", "Subagent нашёл workaround, но не знает Rule “не менять публичный контракт”. Главный агент должен проверить результат."]],
        chips: ["делегирование", "ограниченный контекст", "MCP зависит от прав", "главный агент проверяет"]
      },
      "subagent-inner": {
        icon: "🔄", color: "blue-text", title: "Внутри subagent", sub: "Отдельное окно — тот же loop, другой срез контекста",
        sections: [
          ["Task brief", "Main передаёт только делегированную часть: цель, scope, запреты, формат findings. Без полной истории чата и без контекста других subagents."],
          ["Permissions", "Часто readonly и урезанный набор tools (explore, shell, …). Subagent не наследует все полномочия main автоматически."],
          ["Subagent loop", "Тот же цикл think → tool → observe, но шум (десятки прочитанных файлов) остаётся в окне worker, а не в main."],
          ["Findings → main", "Structured summary попадает в context main-агента как сообщение. Main сверяет с Rules/AGENTS.md перед edit или merge. Background subagents — дождаться до конца turn."],
          ["Ниже по смыслу", "Вложенный subagent → subagent возможен, но редко и с лимитом глубины. На карте слоёв main это не «уровень 9 в окне модели» — снова делегирование и возврат findings."]
        ],
        cases: [["Assessment", "Findings subagent не отменяют Rule: main обязан проверить перед действием."], ["Параллель", "Несколько workers → fan-in у main; см. agentic-systems.html"]],
        chips: ["изоляция", "findings не autopilot", "permissions", "agent loop"]
      }
    };

    function renderDetails(key) {
      const item = details[key];
      const panel = document.getElementById("details");
      if (!item || !panel) return;

      const cases = item.cases ? `
        <div class="details-section">
          <h3>Мини-кейсы</h3>
          ${item.cases.map(([h, p]) => `<div class="case-card"><b>${h}:</b> ${p}</div>`).join("")}
        </div>` : "";

      const table = item.table ? `
        <div class="details-section">
          <h3>Таблица выбора при конфликте</h3>
          <table class="priority-table">
            <thead><tr>${item.table[0].map(x => `<th>${x}</th>`).join("")}</tr></thead>
            <tbody>${item.table.slice(1).map(row => `<tr>${row.map(x => `<td>${x}</td>`).join("")}</tr>`).join("")}</tbody>
          </table>
        </div>` : "";

      panel.innerHTML = `
        <div class="details-top">
          <div class="details-icon ${item.color}">${item.icon}</div>
          <div>
            <h2>${item.title}</h2>
            <div class="details-sub">${item.sub}</div>
          </div>
        </div>
        ${item.sections.map(([h, p]) => `
          <div class="details-section">
            <h3>${h}</h3>
            <p>${p}</p>
          </div>
        `).join("")}
        ${cases}
        ${table}
        <div class="chips">${item.chips.map(c => `<span class="chip">${c}</span>`).join("")}</div>
        <div class="detail-float-footer">
          <button type="button" class="detail-float-ok" id="detailFloatOk">Понятно, закрыть</button>
        </div>
      `;

      document.querySelectorAll(".schema-card-inner").forEach(el => el.classList.remove("active"));
      document.querySelector(`.schema-card-inner[data-key="${key}"]`)?.classList.add("active");
    }

    const floatEl = document.getElementById("detailFloat");
    let pinnedKey = null;

    const DETAIL_BTN_LABELS = {
      system: "платформа · приоритет",
      conflicts: "иерархия · таблица конфликтов",
      checkpoint: "шаблон · vs summary",
      chat: "задача · vs Rules",
      rag: "retrieval · vs Rules",
      mcp: "tools · свежесть фактов",
      summary: "compression · риски",
      subagents: "делегирование · проверка",
      "subagent-inner": "brief · loop · findings",
      agents: "AGENTS.md · workflow",
      rules: "policy · vs Skills",
      memory: "continuity · vs MCP",
      skills: "playbook · ниже Rules",
    };

    function openFloat(key) {
      pinnedKey = key;
      renderDetails(key);
      document.querySelectorAll(".schema-card-wrap").forEach(w => w.classList.remove("is-open"));
      document.querySelector(`.detail-more-btn[data-key="${key}"]`)?.closest(".schema-card-wrap")?.classList.add("is-open");
      floatEl.hidden = false;
      floatEl.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      requestAnimationFrame(() => floatEl.classList.add("is-open"));
      document.getElementById("detailFloatOk")?.addEventListener("click", closeFloat, { once: true });
    }

    function closeFloat() {
      pinnedKey = null;
      document.querySelectorAll(".schema-card-wrap").forEach(w => w.classList.remove("is-open"));
      floatEl.classList.remove("is-open");
      floatEl.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      document.querySelectorAll(".clickable, .schema-card-inner").forEach(el => el.classList.remove("active"));
      setTimeout(() => { floatEl.hidden = true; }, 180);
    }

    function wrapSchemaCards() {
      document.querySelectorAll("#schema [data-key]").forEach(card => {
        if (card.closest(".schema-card-wrap")) return;
        const key = card.dataset.key;
        const wrap = document.createElement("div");
        wrap.className = "schema-card-wrap";
        card.parentNode.insertBefore(wrap, card);
        if (card.tagName === "BUTTON") {
          const inner = document.createElement("div");
          inner.className = card.className.replace(/\bclickable\b/, "").trim() + " schema-card-inner";
          inner.dataset.key = key;
          inner.innerHTML = card.innerHTML;
          wrap.appendChild(inner);
          card.remove();
        } else {
          card.classList.add("schema-card-inner");
          wrap.appendChild(card);
        }
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "detail-more-btn";
        btn.dataset.key = key;
        btn.innerHTML = `<span class="dmb-label">Подробнее →</span><span class="dmb-sub">${DETAIL_BTN_LABELS[key] || "описание · кейсы · chips"}</span>`;
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          openFloat(key);
        });
        wrap.appendChild(btn);
      });
    }

    wrapSchemaCards();

    document.querySelectorAll(".sub-delegate-more[data-key]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openFloat(btn.dataset.key);
      });
    });

    document.getElementById("detailFloatBackdrop")?.addEventListener("click", closeFloat);
    document.getElementById("detailFloatClose")?.addEventListener("click", closeFloat);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !floatEl.hidden) closeFloat();
    });
})();
