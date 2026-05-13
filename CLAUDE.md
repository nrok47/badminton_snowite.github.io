# CLAUDE.md — AI Assistant Guide for badminton_snowite.github.io

## Project Overview

A **Thai-language badminton club ranking system** — a static single-file web app deployed on GitHub Pages. Tracks player ELO across sessions with anti-gaming mechanics, tier classifications, Firebase cloud sync, freemium gating, and a cross-room Pro Mode leaderboard.

**Key facts:**
- Pure vanilla JavaScript — all logic in **`index.html`** (~5,700 lines, no build tools, no framework)
- All UI text is in Thai
- Firebase Realtime Database for persistence (Realtime Sync + manual transactions)
- Mobile-first (bottom nav on mobile, top nav on desktop)

---

## Repository Structure

```
/
├── index.html          ← THE ONLY FILE TO EDIT (production app, ~5,700 lines)
├── CLAUDE.md           ← this file
├── workflow.md         ← app workflow / ops guide
├── firebase_code.txt   ← Firebase config snippets (reference only)
├── icon/               ← Icon assets
│
│   — Legacy versions (do NOT edit) —
├── index-v*.html
├── old_index.html
└── app.js / style.css  ← obsolete split versions, not used in production
```

---

## Architecture (inside `index.html`)

### Section markers
```js
// ===== SECTION NAME =====
```

### Core globals

| Symbol | Line | Description |
|--------|------|-------------|
| `S` | ~1343 | App state: `{ members, matches, finance, decayEvents, seasons, seasonGoal, rsvp, proMatches }` |
| `RC` | ~1346 | Rules config (editable by admin) |
| `BASE`, `FLOOR` | ~1452 | ELO base (10,000) and floor (8,000) |
| `FREE_MATCH_LIMIT` | ~1433 | 15 — max matches for free rooms |
| `FREE_MATCH_WARN` | ~1434 | 10 — warning threshold |
| `SUPER_ADMIN_EMAILS` | ~1435 | `['nrok47@gmail.com']` |
| `PRO_BASE_ELO` | ~1436 | 50,000 — Pro ELO starting point |
| `PRO_WIN / PRO_LOSS` | ~1437 | ±3000 / -2100 base Pro deltas |
| `PRO_WINDOW` | ~1440 | 10 — sliding window size |
| `window._roomMeta` | loaded on login | Firebase `rooms/{code}/metadata` (has `.subscribed` flag) |

### Key helper functions

| Function | Description |
|----------|-------------|
| `isSuperAdmin()` | True if `bcm_adminEmail` ∈ `SUPER_ADMIN_EMAILS` |
| `isSubscribed()` | True if `window._roomMeta.subscribed === true` |
| `freeMatchesLeft()` | `max(0, 15 - S.matches.length)` |
| `isAdmin()` | `bcm_role === 'admin'` |
| `isMember()` | `bcm_role === 'user'` |
| `gm(id)` | Get member by ID |
| `esc(str)` | HTML-escape user input — **always use when interpolating user data into HTML** |
| `todayStr()` | Returns `YYYY-MM-DD` |
| `save()` | Persist S to localStorage + trigger autoSyncToFirebase |

---

## Freemium Model

| Tier | Matches | Pro Mode | Notes |
|------|---------|----------|-------|
| Free | 0–15 | ❌ | Warning at 10, hard lock at 15 |
| Subscribed | Unlimited | ✅ | Super Admin toggles `metadata.subscribed` |

**Guard in `recordMatch()`** (line ~1607):
```js
if(!isSubscribed() && freeMatchesLeft()<=0){ openModal('modal-upgrade'); return; }
```

**Warning banner** (`#freemium-warn-banner`) is shown in page-club when `freeMatchesLeft() <= FREE_MATCH_WARN` and admin is logged in. Rendered by `renderFreemiumBanner()`.

---

## Pro Mode

A **separate ELO track** for serious competitive players. Independent from the regular ELO — the two never mix.

### Data model

**Per member** (stored in `S.members[i]`):
```js
member.proTier         // boolean — admin can toggle (subscribed rooms only)
member.proMatchDeltas  // [{matchId, delta}, ...] — sliding window, max 10
```

**Per room** (stored in `S.proMatches`):
```js
{ id, winners, losers, wDeltas, lDeltas, sw, sl, margin, dateStr, time }
```

**Global Firebase node** (written by `recordProMatch()`):
```
proPlayers/{googleUid}:
  name, photoURL, roomCode, clubName, proMatchDeltas, lastUpdatedAt
```

### Pro scoring

```
proElo = 50,000 + Σ(proMatchDeltas.delta)   // sliding 10-game window
wDelta = +3,000 [+600 if margin]
lDelta = -2,100 [-600 if margin]
```

### Pro Match detection (automatic)

`isProMatch(winners, losers)` returns true if:
- Room is subscribed
- All 4 selected players have `member.proTier === true`

When detected: `updateMatchPreview()` shows `#pro-match-badge` and changes the record button to call `recordProMatch()` instead of `recordMatch()`.

### Global Pro Leaderboard (`page-pro`)

- Tab ⚡ Pro visible to everyone (no subscription required to VIEW)
- `renderProLeaderboard()` reads `proPlayers/` from Firebase
- Cross-room, sorted by proElo descending
- Shows: rank, name, club, proElo, games in window

---

## Super Admin

### Role

`isSuperAdmin()` checks `bcm_adminEmail` against `SUPER_ADMIN_EMAILS = ['nrok47@gmail.com']`.

To add a second Super Admin: append their email to the array in `index.html` ~line 1435.

### UI

- Nav button `🛡️ Super` (`.super-admin-only` class) — hidden by default, shown by `renderRole()` for super admins
- `page-superadmin` tab — lists all rooms with member count, match count, subscription status
- `saToggleSubscription(code, value)` — writes `rooms/{code}/metadata/subscribed` to Firebase

### Firebase rules needed

```json
"rooms": {
  "$roomCode": {
    "metadata": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
},
"proPlayers": {
  ".read": "auth != null",
  "$uid": { ".write": "auth != null" }
}
```

---

## ELO Engine (regular)

`computeDeltas(winners, losers, sw, sl)` at line ~1495. Applies:
- Match type by avg ELO diff (`evenWin/Loss`, `upsetWin/Loss`, `favorWin/Loss`)
- Margin bonus (±`marginBonus` if score diff ≥ `marginThreshold`)
- Anti-carry multiplier (ELO gap within team)
- Anti-farming reduction (same winner team repeat today)
- Streak freeze (3 consecutive losses → 0 points; then −50%)
- Participation bonus (`participationBonus` per game)
- Daily loss cap (`dailyLossCap` max net loss per day)
- BG Tier multipliers (`RC.bgMult`)

All config lives in `RC` object (editable in admin Rules modal).

---

## Firebase Data Structure

```
/rooms/{roomCode}/
  clubName: string
  metadata/
    subscribed: boolean        ← Super Admin toggles
    createdAt: timestamp
  state/
    members: [...]             ← includes proTier, proMatchDeltas
    matches: [...]
    proMatches: [...]
    finance: [...]
    decayEvents: [...]
    seasons: [...]
    seasonGoal: number
    rulesConfig: {...}
    lastUpdatedAt: timestamp

/proPlayers/{googleUid}/      ← global Pro rankings
  name, photoURL, roomCode, clubName
  proMatchDeltas: [{matchId, delta}, ...]
  lastUpdatedAt: timestamp
```

---

## Key Functions Reference

| Function | Line | Description |
|----------|------|-------------|
| `recordMatch()` | ~1607 | Record regular match (freemium-guarded) |
| `recordProMatch()` | ~1666 | Record Pro match + write to global proPlayers/ |
| `computeDeltas()` | ~1495 | Regular ELO delta calculation |
| `calcProDeltas()` | ~1667 | Pro ELO delta calculation |
| `calcProElo(member)` | ~1679 | `PRO_BASE_ELO + sum(proMatchDeltas)` |
| `isProMatch(w,l)` | ~1683 | True if all 4 players are proTier + subscribed |
| `autoSyncToFirebase()` | ~4455 | Background Firebase transaction sync |
| `renderRole()` | ~2314 | Sets body classes + shows/hides admin UI + Super Admin nav |
| `renderFreemiumBanner()` | ~2373 | Shows warning banner when approaching free limit |
| `renderProLeaderboard()` | ~4180 | Loads global proPlayers/ and renders rank list |
| `renderSuperAdminPanel()` | ~4220 | Lists all rooms for Super Admin |
| `saToggleSubscription()` | ~4265 | Toggle subscribed flag for a room |
| `renderRules()` | ~3560 | Renders scoring rules page (includes Free Tier + Pro sections) |
| `tab(name, btn)` | ~3766 | Switch tab (calls renderProLeaderboard/renderSuperAdminPanel) |
| `renderAll()` | ~2374 | Full re-render (called after every state change) |

---

## Development Workflow

### No Build Step
Open `index.html` directly in a browser. No `npm install`, no compilation.

### Git Workflow
- Feature branches: `claude/<name>`
- Current branch: `claude/fix-data-conflicts-wK5V8`
- `main` branch = production

### Firebase Config
Credentials embedded in `index.html` — intentional for GitHub Pages.
- Project: `badmintonsnowite`
- DB URL: `badmintonsnowite-default-rtdb.firebaseio.com`
- SDK: Firebase 9.22.2 compat build

---

## Important Constraints

1. **`esc()`** must be used for all user-supplied strings in HTML templates
2. **No build tools** — vanilla JS only, no npm
3. **Do not edit legacy files** (`index-v*.html`, `old_index.html`, `app.js`, `style.css`)
4. **`RC` is the single source for scoring config** — do not hardcode scoring values elsewhere
5. **All UI text in Thai** unless explicitly asked to change
6. **Firebase credentials in index.html are expected** — do not move to `.env`
7. **localStorage key is `'bcm_v1'`** — changing it wipes all local state
8. **`S.proMatches` syncs via `autoSyncToFirebase`** — do not manually write it to Firebase elsewhere (handled automatically)

---

## Future Roadmap (do NOT implement now)

- **1v1 Singles Mode**: match type toggle (2v2 / 1v1), singles ELO track, Pro 1v1 global ranking
- **Payment gateway**: PromptPay / Stripe — current flow is Super Admin manual toggle after payment
- **Second Super Admin**: append email to `SUPER_ADMIN_EMAILS` array
