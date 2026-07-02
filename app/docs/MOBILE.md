# Мобильное приложение (Capacitor)

Веб-контент — [`agent_context_academy/`](../agent_context_academy/) в корне репозитория. Эта папка `app/` — npm, сборка банка вопросов и нативные оболочки Android/iOS.

## Требования

- **Node.js 20+**
- **Android:** [Android Studio](https://developer.android.com/studio), JDK 17+
- **iOS:** macOS, Xcode (сборка `ios/` только на Mac)

## Команды

```bash
cd app
npm install
npm run build:bank      # → ../agent_context_academy/assets/question-bank.json
npx cap sync
```

Или: `npm run cap:sync` (банк + sync).

## Android

```bash
cd app
npm run cap:open:android
```

Старт: `index.html` → `pages/home.html`. Квиз: `pages/quiz-session.html`.

## iOS (на Mac)

```bash
cd app
npx cap add ios
npx cap sync
npx cap open ios
```

## API-ключ для бонус-квиза

В UI квиза («Настройки API»), только `localStorage` на устройстве. Ключи не коммитить.

## После правок HTML

1. `cd app && npm run build:bank`
2. `npx cap sync`
3. Пересобрать в Android Studio / Xcode

## Структура `app/`

| Путь | Назначение |
|------|------------|
| `capacitor.config.json` | `webDir: ../agent_context_academy` |
| `android/` | Проект Android |
| `tools/quiz-bank.mjs` | MCQ при сборке банка |
| `scripts/extract-questions.mjs` | HTML → JSON |
