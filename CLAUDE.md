# CLAUDE.md — AI Assistant Guide for badminton_snowite.github.io

## Project Overview

This is a **Thai-language badminton club ranking system** — a static web app deployed on GitHub Pages. It tracks player scores across sessions using a custom ELO-style scoring engine with anti-gaming mechanics, tier classifications, and Firebase cloud sync.

**Key facts:**
- Pure vanilla JavaScript (no build tools, no framework, no npm)
- All UI text is in Thai
- Firebase Realtime Database is the primary data source
- Designed for mobile use (bottom nav on mobile, top nav on desktop)

---

## Repository Structure

```
/
├── index.html                  # Main app (production) — do all UI work here
├── app.js                      # All application logic (~1,226 lines)
├── style.css                   # All styling (~686 lines)
├── badminton-club-mobile.html  # Mobile-optimized variant
├── firebase_code.txt           # Firebase config/snippets (reference only)
├── icon/                       # Icon assets
│   └── README.md               # Icon documentation (Thai)
├── rule กฏก๊วนแบด 10+ คน.txt  # Club rules in Thai (source of truth for scoring logic)
│
│   — Legacy/experimental versions (do not edit) —
├── index-v2.html
├── index-v3.html
├── index-v4.html
├── index_v2.html
├── index-2.html
└── old_index.html
```

**Only edit `index.html`, `app.js`, and `style.css`** unless a new feature explicitly requires a new file.

---

## Architecture

### Module Structure in `app.js`

The code is organized into four object-literal modules, executed in order:

| Module | Purpose |
|--------|---------|
| `Storage` | localStorage wrapper (`KEY = 'bsw_v1'`) |
| `Scoring` | Pure scoring engine (no side effects) |
| `Data` | CRUD operations over stored state |
| `App` | UI rendering and event handling |

**Section headers** follow this pattern:
```js
// ── Section Name ────────────────────────────────────────────
```

### Scoring Engine (`Scoring.calc`)

The scoring system is the core logic. Understand it before modifying:

1. **`matchType(winAvg, loseAvg)`** — determines game type (FAIR/UPHILL/DOWNHILL/etc.) based on team rating averages
2. **`basePoints(type)`** — lookup table for win/lose base points per type
3. **`calc(game, sessionState)`** — applies all modifiers:
   - Base points (win/lose by match type)
   - **Margin bonus**: ±150 if score difference ≥ 8
   - **Anti-carry multiplier**: 0.8× for winner if diff > 1,500; 1.2× for loser
   - **Anti-farming reduction**: 1st–2nd game = 100%, 3rd = 50%, 4th+ = 20%
   - **Safety cap**: max −900 per game
   - **Streak safety**: 3+ consecutive losses capped at −2,500 total

The rules document (`rule กฏก๊วนแบด 10+ คน.txt`) is the canonical specification. If scoring behavior seems wrong, check that file first.

### State Management

- **Persistent state**: stored in Firebase (primary) and localStorage (fallback)
- **Ephemeral session state**: computed by replaying game history via `Data.sessionState()`
- **Pair counting**: tracks same-team combinations within a session for anti-farming
- Firebase sync is semi-manual: auto-syncs on load, manual sync buttons in UI

### Tab System

Five tabs rendered by `App.switchTab(tab)`:
- `leaderboard` — player rankings + tier badges
- `session` — active game session management
- `players` — player CRUD
- `history` — past sessions + game logs
- `rules` — displays scoring rules

### Tier System

| Tier | Threshold |
|------|-----------|
| Elite | ≥ 24,000 |
| Pro | ≥ 18,000 |
| Mid | ≥ 12,000 |
| Beginner | < 12,000 |

---

## Code Conventions

### JavaScript
- `'use strict'` is always on
- **camelCase** for variables and functions
- **Template literals** (backticks) for all HTML generation
- **Always use `esc(value)`** when interpolating user-supplied strings into HTML to prevent XSS
- Null-check aggressively; alert dialogs use Thai text
- No external dependencies — do not add npm packages or CDN imports beyond what exists

### HTML
- All user-visible text is in Thai
- Semantic class naming: `.nb` (nav button), `.scard` (stat card), `.tier-elite`, etc.
- Firebase scripts loaded from CDN at bottom of `<body>`

### CSS
- CSS variables for theming: `--bg`, `--accent`, `--text`, `--card`, etc.
- Dark mode is default; light mode toggled via `.light` class on `<body>`
- Mobile breakpoint: `@media (max-width: 600px)`
- No preprocessors — plain CSS only

---

## Development Workflow

### No Build Step

This is a static site. To test changes:
1. Open `index.html` directly in a browser, **or**
2. Use any static file server (e.g., `python3 -m http.server`)

There is no `npm install`, no compilation, and no CI/CD pipeline.

### Git Workflow

- Work on feature branches (current: `claude/add-claude-documentation-DxKWf`)
- Push to `origin/<branch-name>` with `git push -u origin <branch-name>`
- The production branch is `main` — only push there when a feature is complete and tested

### Firebase Configuration

Firebase credentials are embedded directly in `index.html` (not environment variables). This is intentional for a GitHub Pages static site — the database has read/write rules configured on the Firebase console.

- **Project ID**: `badmintonsnowite`
- **Database URL**: `badmintonsnowite-default-rtdb.firebaseio.com`
- Firebase SDK version: **9.22.2 (compat build)**

---

## Key Functions Reference

| Function | Location | Description |
|----------|----------|-------------|
| `uid()` | app.js | Generates unique IDs for players/games |
| `esc(str)` | app.js | HTML-escapes user input — **always use for user data** |
| `fmtNum(n)` | app.js | Formats numbers with Thai locale |
| `todayStr()` | app.js | Returns ISO date string (YYYY-MM-DD) |
| `Data.addGame(...)` | app.js | Records a game and persists state |
| `Data.undoLastGame(id)` | app.js | Removes last game from session |
| `Data.endSession(id)` | app.js | Finalizes session, applies decay to absentees |
| `App.switchTab(tab)` | app.js | Renders a tab by name |
| `Scoring.calc(game, state)` | app.js | Core scoring calculation |

---

## Important Constraints

1. **Do not remove `esc()`** from HTML-generating code — it prevents XSS
2. **Do not add a build tool** (webpack, vite, etc.) — the project is intentionally build-free
3. **Do not edit legacy version files** (`index-v*.html`, `old_index.html`)
4. **Scoring rule changes must match** the rules document (`rule กฏก๊วนแบด 10+ คน.txt`)
5. **All UI text should remain in Thai** unless the user explicitly asks to change the language
6. **Firebase credentials in index.html are expected** — do not move them to a `.env` file (no build pipeline to consume it)
7. **The `Storage` module key is `'bsw_v1'`** — changing it will wipe all users' local data

---

## Common Tasks

### Add a new player field
1. Update `Data.addPlayer()` in `app.js`
2. Update `App.renderPlayers()` to display the new field
3. Update `App.renderLeaderboard()` if it should appear in rankings

### Adjust scoring rules
1. Read `rule กฏก๊วนแบด 10+ คน.txt` to understand the intended rule
2. Modify `Scoring.calc()` or the relevant helper in app.js
3. Verify that the Thai rules text in `App.renderRules()` is updated to match

### Add a new tab
1. Add a nav button in `index.html` (both desktop header nav and mobile bottom nav)
2. Add a corresponding `div.tab-content` in `index.html`
3. Add a `render<TabName>()` method in the `App` module in `app.js`
4. Add the case to `App.switchTab()`

### Modify Firebase sync behavior
- Firebase read/write helpers are in `index.html` (currently embedded, not in `app.js`)
- Reference `firebase_code.txt` for patterns — it contains reusable sync snippets
