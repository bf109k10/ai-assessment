Откройте `index.html` в браузере. Это автономная обучающая платформа по AI agent context.

**Для AI-агентов:** карта всего репозитория, чеклисты и соглашения — в корневом [`AGENTS.md`](../AGENTS.md).


Ключевые страницы:
- `pages/home.html` — вход и карта тем
- `pages/roadmap.html` — граф зависимостей
- `pages/context.html` — карта слоёв + встроенная схема контекста
- `pages/overall-full.html` — полная схема (матрица, Q&A) на весь экран
- `pages/overall.html` — обзорная страница со ссылками

Общие assets: `assets/style.css`, `assets/app.js`, `assets/academy-graph.js`, `assets/overall-embed.css`, `assets/overall-details.js`.

**Банк вопросов для квиза:** после правки Q&A — `cd app`, `npm run build:bank` (создаёт `question-bank.json` и `question-bank.data.js` для открытия квиза даже через `file://`).
