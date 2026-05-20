# CLAUDE.md - AI Assistant Guide for badminton_snowite.github.io

## Project Overview

Thai-language badminton club ranking web app built as a single static HTML file.

Current production behavior:
- Pure vanilla HTML/CSS/JavaScript
- No build tools, no npm, no framework
- Main production file is `index.html`
- Firebase Realtime Database is used for sync
- App currently runs in a simplified local role model:
  - starts as `guest`
  - unlocks `admin` mode with the in-app admin code flow
  - `member` helpers still exist but currently return `false`

## Repository Structure

```text
/
|-- index.html
|-- README.md
|-- ROADMAP.md
|-- CLAUDE.md
|-- firebase_code.txt
|-- manifest.json
|-- icon.png
|-- favicon.ico
|-- icon/
|
|-- legacy / reference only
|-- index-backup.html
|-- index-backup2.html
|-- index-backup-icon.html
|-- index-2.html
|-- index-v3.html
|-- index-v4.html
|-- index_v2.html
|-- indexbwf.html
|-- old_index.html
|-- app.js
`-- style.css
```

Rules:
- Edit `index.html` for production changes
- Do not treat `app.js` or `style.css` as active production sources
- Do not edit legacy HTML versions unless doing explicit archival/migration work

## Current Architecture

### Runtime Mode

The old auth / room system has mostly been retired from active flow.

What is live now:
- UI starts in guest mode
- Admin mode is unlocked locally with `enterAdminCode()`
- `isAdmin()` checks `_isAdminUnlocked`
- `isGuest()` is the inverse of `_isAdminUnlocked`
- `isMember()` currently always returns `false`

Important:
- Many old helper names still exist as compatibility stubs
- Do not assume a real Google sign-in flow is active just because helper names still exist

### State Object

The app state is kept in a single global `S` object:

```js
S = {
  members: [],
  matches: [],
  finance: [],
  decayEvents: [],
  seasons: [],
  seasonGoal: 100,
  rsvp: {}
}
```

Rules config lives in global `RC`, and is also mirrored into `S.rulesConfig` before sync in relevant flows.

### Firebase Data Layout

Current production code reads/writes these root paths:

```text
state
state/members
defaultRules
activeRooms
.info/connected
```

Important:
- Current code does **not** use `rooms/{roomCode}/state` as its main storage path
- `roomCode` is now mostly compatibility metadata/UI, not true multi-tenant isolation
- Club name is stored in both localStorage and `state.clubName`

### Firebase Sync

Firebase config is embedded in `index.html` and points to:

- project: `badmintonsnowite`
- database: `https://badmintonsnowite-default-rtdb.firebaseio.com`

Key sync functions:
- `save()` triggers `autoSyncToFirebase()` unless guest mode blocks writes
- `autoSyncToFirebase()` merges local state into server state with transaction logic
- `loadMembersFromFirebase()` loads full state from `state`
- `syncMembersToFirebase()` force-syncs members plus merged collections

### Local Storage Usage

Current localStorage keys actively used by the app include:

- `bcm_clubname`
- `bcm_theme`
- `bcm_last_room_code`
- `bcm_last_club_name`

Do not assume sessionStorage is the source of truth for auth or room state in the current version.

## Scoring System

Core constants:

```js
const BASE = 10000;
const FLOOR = 8000;
```

Rules are held in `RC`, including:
- base win/loss values
- upset/favored match scoring
- anti-carry
- anti-farming
- participation bonus
- daily loss cap
- decay
- tier multipliers

Tier keys used internally:
- `BB`
- `BG1`
- `BG2`
- `BG+`

Display labels may differ from internal keys. Do not rename internal keys casually because Firebase data depends on them.

## Code Conventions

- Always use `esc(...)` when interpolating user-controlled text into HTML
- Keep edits build-free and dependency-free
- Prefer minimal, behavior-preserving refactors
- Group new logic with clear section comments because `index.html` is large
- If you touch Firebase paths, update docs to match the code

## Key Functions Reference

| Function | Meaning in current code |
|---|---|
| `isAdmin()` | true after admin code unlock |
| `isGuest()` | true before admin unlock |
| `isMember()` | currently always false |
| `save()` | sync entry point for writable flows |
| `autoSyncToFirebase()` | transaction-based sync to `state` |
| `loadMembersFromFirebase()` | loads current state snapshot from Firebase |
| `syncMembersToFirebase()` | manual sync action |
| `renderAll()` | rerenders the full UI |
| `renderRole()` | updates UI based on guest/admin state |
| `getBGTag(elo)` | maps ELO to internal tier key |

## Important Constraints

1. Do not remove `esc()` from HTML-generating code.
2. Do not introduce a build pipeline unless explicitly requested.
3. Do not assume `CLAUDE.md` from older commits matches the live app flow.
4. Do not re-activate legacy auth/room code without checking every stub call site.
5. Do not change Firebase root paths casually because current data is stored at `state`.
6. Do not edit legacy files as if they were production.
7. Prefer refactors that improve readability without changing behavior.

## Suggested Refactor Direction

- Keep `index.html` as the production file for now
- Improve section headers and shared constants first
- Consolidate repeated Firebase path strings
- Extract repeated render helpers only when behavior is well understood
- Update documentation immediately when architecture changes
