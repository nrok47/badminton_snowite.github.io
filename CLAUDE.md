# CLAUDE.md — AI Assistant Guide for badminton_snowite.github.io

## Project Overview

A **Thai-language badminton club ranking system** — a static single-file web app on GitHub Pages. Tracks player ELO across sessions, supports multiple clubs via a room code system, and syncs to Firebase Realtime Database.

**Key facts:**
- Pure vanilla JavaScript — no build tools, no framework, no npm
- All UI text is in Thai
- **Single file**: all HTML, CSS, and JS lives in `index.html` (~5,300+ lines)
- Firebase Realtime Database 9.22.2 (compat build) for cloud sync
- Designed for mobile use (responsive layout)

---

## Repository Structure

```
/
├── index.html          # THE only production file — all edits go here
├── CLAUDE.md           # This file
├── README.md
├── firebase_code.txt   # Firebase config reference (do not import)
├── icon/               # Icon assets
│
│   — Legacy/experimental (DO NOT EDIT) —
├── index-backup.html
├── index-backup2.html
├── index-backup-icon.html
├── index-2.html
├── index-v3.html
├── index-v4.html
├── index_v2.html
├── indexbwf.html
├── old_index.html
├── app.js              # Legacy (no longer used)
└── style.css           # Legacy (no longer used)
```

**Only edit `index.html`.** Legacy files exist for reference only.

---

## Architecture

### Room System

Every club has a **room code** (5-digit string). Data is scoped per room:

```
Firebase: rooms/{roomCode}/state    ← full club state blob
          rooms/{roomCode}/metadata ← createdAt, adminUid, clubName
```

Session keys (sessionStorage, prefix `bcm_`):

| Key | Value |
|-----|-------|
| `bcm_role` | `'admin'` or `'user'` |
| `bcm_roomCode` | 5-digit room code string |
| `bcm_uid` | Firebase auth UID |
| `bcm_memberId` | member ID in S.members (for non-admin) |

### Role System

| Role | How | Permissions |
|------|-----|-------------|
| `admin` | Google sign-in → create room | Full access |
| `user` (member) | Google sign-in → join room | View-only + edit own name/icon |

**No guest mode** — removed. Everyone must sign in with Google.

Role helpers:
```js
isAdmin()   // bcm_role === 'admin'
isMember()  // bcm_role === 'user'
isGuest()   // always returns false (stub kept for safety)
```

### State Object `S`

All club data lives in a single `S` object, persisted to Firebase and localStorage:

```js
S = {
  members: [...],       // { id, name, phone, elo, matchCount, wins, losses, lossStreak }
  matches: [...],       // { id, winners[], losers[], wDeltas[], lDeltas[], ... }
  finance: [...],       // { id, type, amount, note, date }
  decayEvents: [...],   // { id, memberId, delta, date }
  seasons: [...],
  seasonGoal: null,
  rulesConfig: RC,      // scoring config object
}
```

### Firebase Sync

**`autoSyncToFirebase()`** — uses `.transaction()` for atomic read-modify-write:
- Merges matches/finance/decayEvents by ID (never overwrites server-side data)
- Resolves concurrent writes from multiple users safely
- Called on every `save()`

**`_roomRef()`** — returns `db.ref('rooms/{code}/state')`

### Scoring Engine

ELO-style custom scoring. Key constants:
```js
const BASE  = 10000;  // default starting ELO (overridden by tier at member creation)
const FLOOR = 8000;   // minimum ELO
```

`rulesConfig (RC)` holds all tunable parameters (stored in Firebase alongside state).

**Match types** determined by team ELO average difference (`thresholdDiff`):
- Even game → `evenWin` / `evenLoss`
- Upset win (underdog wins) → `upsetWin` / `upsetLoss`
- Favored win (favorite wins) → `favorWin` / `favorLoss`

**Modifiers applied:**
- Margin bonus if score gap ≥ `marginThreshold`
- Anti-carry multiplier if ELO diff > `antiCarryThreshold`
- Anti-farming reduction per pair (3rd game = 50%, 5th+ = 25%)
- Participation bonus for playing
- Daily loss cap (`dailyLossCap`)
- Loss streak freeze/half (`streakFreezeAt`, `streakHalfMult`)
- Decay for absent members (`decayPct` % per event, max `decayMaxTimes` times)
- Per-tier multipliers (`bgMult`: win/loss/participation scale factors)

### Tier System

| Tier | ELO Range | Starting ELO |
|------|-----------|--------------|
| BB   | 0 – 20,000 | 10,000 |
| BG1  | 20,001 – 35,000 | 20,001 |
| BG2  | 35,001 – 45,000 | 35,001 |
| BG+  | 45,001+ | 45,001 |

Admin selects tier when adding a member (`modal-add` → `#nm-tier` dropdown).

---

## Code Conventions

- **Always use `esc(value)`** when interpolating user strings into HTML (XSS prevention)
- camelCase for functions and variables
- Template literals for all HTML generation
- All UI text in Thai
- No external dependencies beyond existing CDN imports

---

## Development Workflow

### No Build Step

Static site — open `index.html` in browser or serve with `python3 -m http.server`.

### Git

- Production branch: **`main`**
- Push: `git push -u origin main`
- Use PAT if needed (stored separately, never commit credentials)

### Firebase

- **Project ID**: `badmintonsnowite`
- **Database URL**: `badmintonsnowite-default-rtdb.firebaseio.com`
- SDK: Firebase 9.22.2 compat build (CDN, bottom of `<body>`)
- Credentials embedded in `index.html` — intentional for GitHub Pages static site

**Current Firebase Rules** (apply in Console):
```json
{
  "rules": {
    "rooms": {
      ".indexOn": ["adminUid"],
      "$roomCode": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "users": {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid == $uid"
      }
    }
  }
}
```

---

## Key Functions Reference

| Function | Description |
|----------|-------------|
| `isAdmin()` | true if current user is room admin |
| `isMember()` | true if current user is a non-admin member |
| `isGuest()` | always false (guest mode removed) |
| `isMyMember(id)` | true if `id` matches `bcm_memberId` |
| `esc(str)` | HTML-escape user input — always use in templates |
| `save()` | persist S to localStorage + trigger autoSyncToFirebase |
| `autoSyncToFirebase()` | atomic transaction merge to Firebase |
| `_roomRef()` | returns Firebase ref for current room's state |
| `renderAll()` | re-renders entire UI from S |
| `toast(msg, icon)` | shows a transient notification |
| `addMember()` | adds member with tier-based starting ELO |
| `calcMatch(...)` | records a match + applies ELO deltas |
| `getBGTag(elo)` | returns tier string (BB/BG1/BG2/BG+) for an ELO |

---

## Important Constraints

1. **Do not remove `esc()`** from HTML-generating code — prevents XSS
2. **Do not add a build tool** — project is intentionally build-free
3. **Do not edit legacy files** (`index-v*.html`, `old_index.html`, `app.js`, `style.css`)
4. **Do not re-introduce guest mode** — removed intentionally; everyone uses Google sign-in
5. **Do not change `BASE` or `FLOOR` lightly** — affects all existing member ELOs
6. **Firebase credentials in index.html are expected** — no `.env` support (no build pipeline)
7. **All writes go through `save()`** — never write to Firebase directly without transaction merge

---

## Planned Future Features (Not Yet Implemented)

- **Pro Player tier**: ELO 50,000 start, hardmode scoring (+3000/−3000 base, margin ±100/point), sliding 10-game window (game 11 drops game 1)
