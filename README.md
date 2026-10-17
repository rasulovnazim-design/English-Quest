# English Quest

**[🇬🇧 English](#english) · [🇷🇺 Русский](#русский)**

▶️ **Play: https://rasulovnazim-design.github.io/English-Quest/**

---

## English

English Quest is a free web game for learning English. It is for native Russian speakers. It starts from zero (A0) and goes up to everyday conversation (A2). All menus, instructions and explanations are in Russian. Everything you learn is in English, with Russian translations, and uses British spelling and a British voice by default. You can switch to American in Settings.

- **Made for children:** a bright, blocky look, an obstacle-course map of colourful blocks, a customisable blocky avatar, coins to spend in the avatar shop, 1–3 stars per lesson and game sounds. All graphics are original, drawn in SVG and emoji.
- **Map in four stages**: First Words → Me and My World → Everyday Life → Out and About, plus a final conversation at the end. Each stage unlocks once the previous one is complete. Within a stage, you can do the categories in any order.
- **Short lessons** of about 5 minutes. They go from recognising words to producing them yourself:
  - matching words to pictures or Russian
  - listening and choosing
  - flashcards in both directions
  - filling gaps
  - building sentences from word tiles
  - dictation
  - speaking (checked by the browser's speech recognition)
  - translating from Russian
- **Conversation boss** at the end of every category: a role play with a character, in three rounds — choose the reply, build it from tiles, then type or say it freely. Answers about yourself (name, age, country, city, job) are accepted in any correct form, so *I'm 34*, *I am 34 years old* and *34* all count.
- **XP, levels, daily goal and streak.** Ranks go from Beginner (Новичок) to Explorer (Исследователь), Traveller (Путешественник), Speaker (Собеседник) and Conversationalist (Мастер общения).
- **Review (Повторение)** with spaced repetition: words come back after 1, 3, 7, 14, 30 and 60 days. Words you get wrong come back sooner.
- **Phrasebook** for every category, plus a searchable master phrasebook. Each entry has the Russian translation, IPA and audio. Every phrasebook page can be printed or saved as a PDF.
- **Typical Mistakes** cards in Russian for each category: articles, the *th* sound, *w* vs *v*, *ship* vs *sheep*, false friends and more.
- Works **offline**, installs to the home screen, has light and dark themes, and has no account or server. Progress is saved in your browser, and you can export or import it as a file.

### Install it on your phone

- **iPhone (Safari):** open the link → tap **Share** (the square with an arrow) → **Add to Home Screen**.
- **Android (Chrome):** open the link → menu **⋮** → **Install app** (or **Add to Home screen**).
- **Laptop (Chrome / Edge):** click the install icon in the address bar.

After the first visit, the game works without an internet connection. Speech recognition needs a connection in Chrome, and Firefox doesn't support it. When it isn't available, the speaking exercises turn into typing exercises.

### Run it locally

You need Node.js 20 or later.

```bash
npm install
npm run dev          # development server: http://localhost:5173/English-Quest/
npm test             # unit tests (answer checker, personal answers, review scheduling, content files)
npm run build        # production build in dist/
npm run e2e          # Playwright tests on iPhone, Android and laptop screen sizes (local build)
BASE_URL=https://rasulovnazim-design.github.io/English-Quest/ npm run e2e   # the same tests against the live site
```

Every push to `main` runs the unit tests, deploys to GitHub Pages and then runs the Playwright tests against the live site (`.github/workflows/deploy.yml`).

### Add or correct content

All learning content is kept apart from the code:

| What | Where |
| --- | --- |
| Words, phrases, translations, IPA, lessons, grammar, typical mistakes, boss dialogue | `src/data/categories/<id>.json` |
| Stages and the order of tiles on the map | `src/data/stages.json` |
| Countries, nationalities and languages accepted in answers | `src/data/countries.json` |
| Final conversation | `src/data/final-boss.json` |
| All Russian interface text | `src/locale/ru.json` |

**To add a category:**

1. Copy `src/data/categories/greetings.json` to a new file, such as `food.json`, and change the `id` to `"food"`.
2. Make sure the id is listed in `src/data/stages.json`. Until a data file exists, the tile shows as "Скоро" (coming soon).
3. Fill in the file:
   - `words` (15–25) and `phrases` (8–12): `en`, `ru`, `ipa`. Optional fields:
     - `emoji`
     - `us`: the American variant
     - `alt`: other accepted answers
     - `note`: a short note in Russian
   - `grammar`: a short explanation in Russian, an optional table and examples.
   - `mistakes`: the Typical Mistakes card.
   - `lessons` (3–5): each lesson lists the `items` it introduces and its `steps`.
     - Automatic steps: `"intro"`, `"match"`, `"listen"`, `"meaning"`, `"flash-en"`, `"flash-ru"`, `"dictation"`, `"speak"`, `"grammar"`.
     - Hand-written steps: `{"type": "gap"}`, `{"type": "tiles"}`, `{"type": "translate"}`, `{"type": "choose"}`, `{"type": "dictation"}`.
   - `boss`: a conversation graph of `nodes`. Each node has the character's line (`npc`, `ru`) and an optional `reply`:
     - `answers` are the correct replies. Each has a `say` text and optional `accept` variants, `patterns` for personal answers and `next` for branching.
     - `wrong` are the wrong options shown in round 1.
     - `hint` and `why` are explanations in Russian.
4. Run `npm test`. The content tests check the counts, the ids, the lesson items and the boss graph. They also check that every correct boss reply is accepted and every wrong option is rejected.

**Personal-answer patterns** (in `patterns`): `[a|b]` means one of the alternatives, a `?` after a group makes it optional, and `{slot}` captures the learner's own detail. The slots are `name`, `age`, `country`, `city`, `job`, `nationality`, `language`, `number`, `letters` and `any`. For example, `"[i am]? {age} [years old]?"` accepts *I'm 34*, *I am 34 years old* and *34*. Contractions, capital letters and punctuation are ignored automatically.

---

## Русский

English Quest — бесплатная веб-игра для изучения английского. Она для тех, чей родной язык русский. Курс начинается с нуля (A0) и доводит до свободного бытового разговора (A2). Меню, задания и объяснения — на русском. Всё, что вы учите, — на английском с переводом. По умолчанию используются британское написание и британский голос, а в настройках можно переключиться на американский вариант.

- **Сделано для детей:** яркий «кубический» стиль, карта-полоса препятствий из цветных блоков, собственный персонаж, которого можно наряжать, монетки для магазина персонажа, от 1 до 3 звёзд за урок и звуки в игре. Вся графика оригинальная: SVG и эмодзи.
- **Карта из четырёх этапов**: «Первые слова» → «Я и мой мир» → «Повседневная жизнь» → «В городе и в пути», а в конце — финальный разговор. Следующий этап открывается, когда пройден предыдущий. Разделы внутри этапа можно проходить в любом порядке.
- **Короткие уроки** примерно по 5 минут — от узнавания слов к самостоятельной речи:
  - пары «слово — картинка» или «слово — перевод»
  - аудирование
  - карточки в обе стороны
  - пропуски в предложениях
  - сборка предложений из слов
  - диктант
  - произношение (проверяется распознаванием речи в браузере)
  - перевод с русского
- **Разговор в конце каждого раздела** — ролевая игра с персонажем в три раунда: выбрать ответ, собрать его из слов, а затем написать или сказать самому. Ответы о себе (имя, возраст, страна, город, профессия) принимаются в любой правильной форме: *I'm 34*, *I am 34 years old* и *34* — всё верно.
- **Очки опыта (XP), уровни, цель дня и серия дней.** Звания растут от «Новичка» (Beginner) до «Исследователя» (Explorer), «Путешественника» (Traveller), «Собеседника» (Speaker) и «Мастера общения» (Conversationalist).
- **Повторение** по системе интервального повторения: слова возвращаются через 1, 3, 7, 14, 30 и 60 дней. Если вы ошиблись, слово вернётся раньше.
- **Разговорник** для каждого раздела и общий разговорник с поиском на обоих языках: перевод, транскрипция и озвучка. Любую страницу разговорника можно распечатать или сохранить в PDF.
- **Карточки «Типичные ошибки»** для каждого раздела: артикли, звук *th*, *w* и *v*, *ship* и *sheep*, «ложные друзья переводчика» и многое другое.
- Игра работает **без интернета**, устанавливается на экран телефона, поддерживает светлую и тёмную темы. Регистрация и сервер не нужны: прогресс хранится в браузере, а резервную копию можно сохранить в файл и загрузить обратно.

### Как установить на телефон

- **iPhone (Safari):** откройте ссылку → нажмите **«Поделиться»** (квадрат со стрелкой) → **«На экран „Домой“»**.
- **Android (Chrome):** откройте ссылку → меню **⋮** → **«Установить приложение»** (или **«Добавить на главный экран»**).
- **Ноутбук (Chrome / Edge):** нажмите значок установки в адресной строке.

После первого открытия игра работает без интернета. Распознаванию речи в Chrome нужен интернет, а Firefox его не поддерживает. Если распознавание недоступно, упражнения на произношение заменяются письменными.

### Как запустить на своём компьютере

Нужен Node.js версии 20 или новее.

```bash
npm install
npm run dev          # сервер для разработки: http://localhost:5173/English-Quest/
npm test             # модульные тесты (проверка ответов, ответы о себе, повторение, файлы с контентом)
npm run build        # сборка в папку dist/
npm run e2e          # тесты Playwright на размерах iPhone, Android и ноутбука (локальная сборка)
BASE_URL=https://rasulovnazim-design.github.io/English-Quest/ npm run e2e   # те же тесты на опубликованном сайте
```

При каждой отправке изменений в `main` запускаются тесты, сайт публикуется на GitHub Pages, а затем тесты Playwright проверяют уже опубликованную версию (`.github/workflows/deploy.yml`).

### Как добавить или исправить материалы

Весь учебный материал хранится отдельно от кода:

| Что | Где |
| --- | --- |
| Слова, фразы, переводы, транскрипция, уроки, грамматика, типичные ошибки, диалоги | `src/data/categories/<id>.json` |
| Этапы и порядок разделов на карте | `src/data/stages.json` |
| Страны, национальности и языки для проверки ответов | `src/data/countries.json` |
| Финальный разговор | `src/data/final-boss.json` |
| Весь русский текст интерфейса | `src/locale/ru.json` |

**Как добавить новый раздел:**

1. Скопируйте `src/data/categories/greetings.json` в новый файл, например `food.json`, и замените `id` на `"food"`.
2. Проверьте, что этот id есть в `src/data/stages.json`. Пока файла с данными нет, плитка на карте показывается как «Скоро».
3. Заполните файл:
   - `words` (15–25) и `phrases` (8–12): `en`, `ru`, `ipa`. Необязательные поля:
     - `emoji`
     - `us` — американский вариант
     - `alt` — другие принимаемые ответы
     - `note` — короткая заметка на русском
   - `grammar` — краткое объяснение на русском, таблица (по желанию) и примеры.
   - `mistakes` — карточка «Типичные ошибки».
   - `lessons` (3–5): в каждом уроке перечислены новые слова (`items`) и шаги (`steps`).
     - Автоматические шаги: `"intro"`, `"match"`, `"listen"`, `"meaning"`, `"flash-en"`, `"flash-ru"`, `"dictation"`, `"speak"`, `"grammar"`.
     - Написанные вручную: `{"type": "gap"}`, `{"type": "tiles"}`, `{"type": "translate"}`, `{"type": "choose"}`, `{"type": "dictation"}`.
   - `boss` — граф разговора из узлов (`nodes`). У каждого узла есть реплика персонажа (`npc`, `ru`) и, если нужно, ответ ученика (`reply`):
     - `answers` — правильные ответы: у каждого есть текст `say` и, при необходимости, варианты `accept`, шаблоны `patterns` для ответов о себе и `next` для ветвления.
     - `wrong` — неверные варианты для первого раунда.
     - `hint` и `why` — пояснения на русском.
4. Запустите `npm test`. Тесты проверят количество слов и фраз, идентификаторы, состав уроков и граф разговора. Они также проверят, что каждый правильный ответ принимается, а каждый неверный вариант отклоняется.

**Шаблоны ответов о себе** (поле `patterns`): `[a|b]` — один из вариантов, `?` после группы делает её необязательной, `{slot}` — личные данные ученика. Доступны слоты `name`, `age`, `country`, `city`, `job`, `nationality`, `language`, `number`, `letters` и `any`. Например, `"[i am]? {age} [years old]?"` примет *I'm 34*, *I am 34 years old* и *34*. Сокращения, заглавные буквы и знаки препинания учитываются автоматически.
