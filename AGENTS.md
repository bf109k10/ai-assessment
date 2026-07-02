# AGENTS.md — oral-ai-assessment

## Роль агента

Ты помогаешь развивать **Agent Context Academy** — автономный учебный сайт (статический HTML/CSS/JS) про контекст AI-агентов: prompting, rules, RAG, MCP, memory и т.д. Контент на **русском**. Отвечай пользователю на русском, если он не просит иначе.

**Не нужно** при каждой задаче обходить весь репозиторий: опирайся на этот файл и на `.cursor/rules/`.

## Стек и запуск

| | |
|---|---|
| Сборка | **Нет** — открыть HTML в браузере |
| Точка входа академии | `agent_context_academy/index.html` → редирект на `pages/home.html` |
| Стили / скрипты | `agent_context_academy/assets/` (`style.css`, `app.js`, `academy-graph.js`, …) |
| Темы | `agent_context_academy/pages/*.html` |

Локально: открыть `agent_context_academy/pages/home.html` или поднять простой static server из `agent_context_academy/`.

## Дерево репозитория

```
oral-ai-assessment/
├── AGENTS.md                 ← этот файл (workflow + карта)
├── README.md                 ← шаблон GitLab (не описывает академию)
├── .cursor/rules/
│   ├── html-code-blocks.mdc  ← alwaysApply: шаблон страниц, nav, Q&A, topic-card
│   └── academy-sync.mdc      ← globs: **/agent_context_academy/**/*.html — sync при новых страницах
│
├── agent_context_academy/    ← ОСНОВНОЙ продукт (веб)
│   ├── index.html
│   ...
├── app/                        ← Capacitor + npm (build:bank, android/)
│   ├── package.json
│   ├── capacitor.config.json
│   ├── scripts/extract-questions.mjs
│   ├── tools/quiz-bank.mjs
│   ├── android/
│   └── docs/MOBILE.md
│
├── interactive_context_conflicts_assessment.html
└── ai-dept-topics.html                            ← standalone, темы AI-отдела
```

## Где что менять (шпаргалка)

| Задача | Файлы |
|--------|--------|
| Текст/разметка темы | `agent_context_academy/pages/<topic>.html` |
| Общий UI, прогресс | `assets/style.css`, `assets/app.js` |
| **Новая страница темы** | См. чеклист ниже + правила `html-code-blocks.mdc` и `academy-sync.mdc` |
| Граф зависимостей | `roadmap.html` — таблица последовательности, **`VP_PHASES`**, **`NODES` / `EDGES`** |
| Карточка на главной | `home.html` — `topicCard`, `step-badge`, `card-why` |
| Квиз / банк вопросов | `app/` → `npm run build:bank`; JSON в `agent_context_academy/assets/question-bank.json` |
| Мобилка Capacitor | `app/android/`, см. `app/docs/MOBILE.md` |

### Канонический порядок nav

Одинаков на всех страницах (не менять порядок, не удалять Hooks). Полный блок — в `html-code-blocks.mdc` § Nav sync. При массовом обновлении nav предпочтителен скрипт (в правилах упоминается `sync_nav.py`; если его нет — править nav по образцу `home.html` или добавить скрипт).

### Чеклист: новая страница в академии

1. Создать `pages/new-topic.html` (hero → core → format → examples → nuances → best practices → Q&A 25 вопросов для тематических страниц).
2. Nav во **всех** `.html` + `active` только на новой.
3. `home.html` — карточка с номером шага и `card-why`.
4. `roadmap.html` — строка в таблице последовательности + шаг в **`VP_PHASES`** + узел в `NODES` + рёбра в `EDGES`.
5. `app.js` — добавить путь в `PAGES`.
6. При новом «слое» — строка в mental model на `home.html`.
7. После правки Q&A — `cd app && npm run build:bank`.

### Страницы вне учебного трека

- `overall.html`, `overall-full.html` — вспомогательные/схемы; не все входят в `PAGES`.
- Корневые `interactive_*.html`, `ai-dept-topics.html` — **не** часть sidebar nav академии; правки по запросу, без обязательного nav sync.

## Соглашения по контенту (кратко)

- Topic-карточки: сразу видимая строка **«Для чего это»** / `card-why` — практическая цель, не определение из словаря.
- Код в `.schema-box`: обязательно `white-space: pre-wrap` (см. rules).
- Platform-specific темы: блок `platform-split` + таблица Cursor vs Claude Code.
- Минимизируй дифф: не трогай несвязанные страницы и не переписывай README/GitLab-шаблон без запроса.

## Ссылки на правила (детали — там, не дублировать целиком)

| Файл | Когда читать |
|------|----------------|
| `.cursor/rules/html-code-blocks.mdc` | Любая правка страниц академии |
| `.cursor/rules/academy-sync.mdc` | Новая/удалённая страница в `pages/` |

## Git

Коммиты и push — **только по явной просьбе** пользователя.

## Claude Code

Для Claude Code можно продублировать этот файл как `CLAUDE.md` в корне репозитория (тот же текст).
