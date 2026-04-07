'use strict';

// ── Storage ──────────────────────────────────────────────────────────────────
const Storage = {
  KEY: 'bsw_v1',
  get() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  },
  save(data) {
    try { localStorage.setItem(this.KEY, JSON.stringify(data)); } catch (e) {}
  }
};

// ── Utils ────────────────────────────────────────────────────────────────────
let _uidCounter = 0;
const uid = () => Date.now().toString(36) + (++_uidCounter).toString(36) + Math.random().toString(36).slice(2, 6);
const fmtNum = n => Math.round(n).toLocaleString();
const fmtDelta = n => (n >= 0 ? '+' : '') + Math.round(n).toLocaleString();
const fmtDate = dateStr => {
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('th-TH', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    });
  } catch(e) { return dateStr; }
};
const todayStr = () => new Date().toISOString().slice(0, 10);

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function avg(arr) {
  if (!arr || !arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// ── Scoring Engine ────────────────────────────────────────────────────────────
const Scoring = {
  // Determine match type based on winner avg vs loser avg
  matchType(winAvg, loseAvg) {
    const delta = Math.abs(winAvg - loseAvg);
    if (delta <= 300) return 'equal';
    // Winner is stronger (higher avg) → favorite win
    if (winAvg > loseAvg) return 'favorite';
    // Winner is weaker (lower avg) → upset
    return 'upset';
  },

  basePoints(type) {
    if (type === 'equal')    return { win: 1000, lose: -1000 };
    if (type === 'upset')    return { win: 1200, lose: -1000 };
    if (type === 'favorite') return { win: 800,  lose: -800  };
    return { win: 1000, lose: -1000 };
  },

  matchTypeLabel(type) {
    if (type === 'equal')    return '🟰 สูสี';
    if (type === 'upset')    return '⬆️ เจอทีมเก่งกว่า (ทีมอ่อนชนะ)';
    if (type === 'favorite') return '⬇️ เจอทีมอ่อนกว่า (ทีมเก่งชนะ)';
    return '';
  },

  /**
   * Calculate score changes for one game.
   * teamA, teamB: arrays of {id, score}
   * winner: 'A' | 'B'
   * hasMargin: bool
   * pairCounts: map of pairKey → count (number of times this pair has played together)
   * lossStreaks: map of playerId → current consecutive loss streak count
   * lossTotals: map of playerId → sum of losses during current streak
   *
   * Returns: { changes: {id: delta}, meta: {id: {...}}, type, winAvg, loseAvg }
   */
  calc(teamA, teamB, winner, hasMargin, scores, pairCounts, lossStreaks, lossTotals) {
    const winTeam  = winner === 'A' ? teamA : teamB;
    const loseTeam = winner === 'A' ? teamB : teamA;

    const winAvg  = avg(winTeam.map(p  => scores[p.id] || 10000));
    const loseAvg = avg(loseTeam.map(p => scores[p.id] || 10000));

    const type = this.matchType(winAvg, loseAvg);
    const base = this.basePoints(type);
    const marginBonus = 150;

    const changes = {};
    const meta = {};

    const processTeam = (team, isWinner) => {
      const baseVal = isWinner ? base.win : base.lose;
      const marginVal = hasMargin ? (isWinner ? marginBonus : -marginBonus) : 0;

      // Anti-carry: check if the team (if 2 players) has a score diff > 1500
      const teamScores = team.map(p => scores[p.id] || 10000);
      const teamHasCarry = team.length === 2 && Math.abs(teamScores[0] - teamScores[1]) > 1500;
      const teamMaxScore = Math.max(...teamScores);
      const teamMinScore = Math.min(...teamScores);

      // Anti-farming pair key
      const pairKey = team.length === 2
        ? [team[0].id, team[1].id].sort().join('|')
        : null;
      const pairPlayed = pairKey ? (pairCounts[pairKey] || 0) : 0;
      const farmingMult = pairPlayed >= 3 ? 0.2 : pairPlayed === 2 ? 0.5 : 1;
      const isFarming = farmingMult < 1;

      team.forEach(p => {
        const pScore = scores[p.id] || 10000;
        let pts = baseVal + marginVal;

        const pMeta = {
          base: baseVal,
          margin: marginVal,
          antiCarry: false,
          antiCarryMult: 1,
          farming: false,
          farmingMult: 1,
          safeGame: false,
          safeStreak: false,
          rawBeforeCaps: 0
        };

        // Anti-carry multiplier
        if (teamHasCarry) {
          const isHigher = pScore >= teamMaxScore;
          const mult = isHigher ? 0.8 : 1.2;
          pts = Math.round(pts * mult);
          pMeta.antiCarry = true;
          pMeta.antiCarryMult = mult;
        }

        // Anti-farming
        if (isFarming) {
          pts = Math.round(pts * farmingMult);
          pMeta.farming = true;
          pMeta.farmingMult = farmingMult;
        }

        pMeta.rawBeforeCaps = pts;

        // Per-game safety cap: max loss -900
        if (pts < -900) {
          pts = -900;
          pMeta.safeGame = true;
        }

        // Streak safety: if this loss makes 3rd consecutive loss
        if (!isWinner) {
          const prevStreak = lossStreaks[p.id] || 0;
          const prevTotal  = lossTotals[p.id]  || 0;
          if (prevStreak === 2) {
            // This is the 3rd loss
            const maxLoss = -2500 - prevTotal;
            if (pts < maxLoss) {
              pts = maxLoss;
              pMeta.safeStreak = true;
            }
          }
        }

        changes[p.id] = pts;
        meta[p.id] = pMeta;
      });
    };

    processTeam(winTeam, true);
    processTeam(loseTeam, false);

    return { changes, meta, type, winAvg, loseAvg };
  },

  /**
   * Update pairCounts, lossStreaks, lossTotals after a game (in-place).
   * Must be called after calc() to prepare state for the NEXT game.
   */
  applyState(teamA, teamB, winner, changes, pairCounts, lossStreaks, lossTotals) {
    const winTeam  = winner === 'A' ? teamA : teamB;
    const loseTeam = winner === 'A' ? teamB : teamA;

    // Increment pair counts for both teams
    [teamA, teamB].forEach(team => {
      if (team.length === 2) {
        const key = [team[0].id, team[1].id].sort().join('|');
        pairCounts[key] = (pairCounts[key] || 0) + 1;
      }
    });

    // Reset winners' streaks
    winTeam.forEach(p => {
      lossStreaks[p.id] = 0;
      lossTotals[p.id]  = 0;
    });

    // Update losers' streaks
    loseTeam.forEach(p => {
      const prevStreak = lossStreaks[p.id] || 0;
      const prevTotal  = lossTotals[p.id]  || 0;
      const newStreak  = prevStreak + 1;

      if (newStreak >= 3) {
        // Reset after 3rd loss
        lossStreaks[p.id] = 0;
        lossTotals[p.id]  = 0;
      } else {
        lossStreaks[p.id] = newStreak;
        lossTotals[p.id]  = prevTotal + (changes[p.id] || 0);
      }
    });
  },

  /**
   * Replay all games in a session to rebuild ephemeral state.
   * Returns { pairCounts, lossStreaks, lossTotals, scoreMap }
   * scoreMap is a snapshot of scores BEFORE any yet-unplayed games (i.e., current scores).
   */
  sessionState(session, allPlayers) {
    const pairCounts  = {};
    const lossStreaks = {};
    const lossTotals  = {};

    // Build a running score map from game history
    const scoreMap = {};
    allPlayers.forEach(p => { scoreMap[p.id] = p.score; });

    // Undo all game changes to get the scores at session start
    // (we'll reapply them step by step)
    const games = session.games || [];
    // Actually, we store cumulative changes per game, so just replay from player.score
    // which already includes all game changes. We need to REPLAY from session-start scores.
    // Session-start scores = current scores - sum(all game changes for that player)
    const sessionScoreMap = {};
    allPlayers.forEach(p => {
      let s = p.score;
      games.forEach(g => {
        if (g.changes && g.changes[p.id] !== undefined) {
          s -= g.changes[p.id];
        }
      });
      sessionScoreMap[p.id] = s;
    });

    // Now replay
    const runningScores = { ...sessionScoreMap };
    games.forEach(g => {
      const teamA = g.teamA.map(id => ({ id }));
      const teamB = g.teamB.map(id => ({ id }));

      // For state update we need the changes (already computed)
      this.applyState(teamA, teamB, g.winner, g.changes, pairCounts, lossStreaks, lossTotals);

      // Update running scores
      Object.entries(g.changes).forEach(([id, delta]) => {
        runningScores[id] = (runningScores[id] || 10000) + delta;
      });
    });

    return { pairCounts, lossStreaks, lossTotals, sessionScoreMap };
  }
};

// ── Data Layer ────────────────────────────────────────────────────────────────
const Data = {
  _db: null,

  _load() {
    if (this._db) return;
    const saved = Storage.get();
    if (saved) {
      this._db = saved;
    } else {
      this._db = { players: [], sessions: [] };
    }
  },

  _save() { Storage.save(this._db); },

  get db() { this._load(); return this._db; },

  addPlayer(name) {
    this._load();
    const p = { id: uid(), name: name.trim(), score: 10000, decayCount: 0 };
    this._db.players.push(p);
    this._save();
    return p;
  },

  removePlayer(id) {
    this._load();
    this._db.players = this._db.players.filter(p => p.id !== id);
    this._save();
  },

  renamePlayer(id, name) {
    this._load();
    const p = this._db.players.find(p => p.id === id);
    if (p) { p.name = name.trim(); this._save(); }
  },

  activeSession() {
    this._load();
    return this._db.sessions.find(s => !s.ended) || null;
  },

  startSession(attendees, date) {
    this._load();
    const s = {
      id: uid(),
      date,
      attendees: [...attendees],
      games: [],
      ended: false,
      decayChanges: null
    };
    this._db.sessions.push(s);
    this._save();
    return s;
  },

  addGame(sessionId, teamA, teamB, winner, hasMargin) {
    this._load();
    const session = this._db.sessions.find(s => s.id === sessionId);
    if (!session) return null;

    // Build current score map
    const scoreMap = {};
    this._db.players.forEach(p => { scoreMap[p.id] = p.score; });

    // Replay session to get ephemeral state
    const { pairCounts, lossStreaks, lossTotals } = Scoring.sessionState(session, this._db.players);

    const teamAObjs = teamA.map(id => ({ id }));
    const teamBObjs = teamB.map(id => ({ id }));

    const result = Scoring.calc(teamAObjs, teamBObjs, winner, hasMargin, scoreMap, pairCounts, lossStreaks, lossTotals);

    const game = {
      id: uid(),
      teamA: [...teamA],
      teamB: [...teamB],
      winner,
      hasMargin,
      changes: result.changes,
      meta: result.meta,
      type: result.type,
      winAvg: result.winAvg,
      loseAvg: result.loseAvg
    };

    session.games.push(game);

    // Apply changes to player scores
    this._db.players.forEach(p => {
      if (result.changes[p.id] !== undefined) {
        p.score += result.changes[p.id];
      }
    });

    this._save();
    return { game, result };
  },

  undoLastGame(sessionId) {
    this._load();
    const session = this._db.sessions.find(s => s.id === sessionId);
    if (!session || !session.games.length) return false;

    const lastGame = session.games[session.games.length - 1];

    // Reverse score changes
    this._db.players.forEach(p => {
      if (lastGame.changes[p.id] !== undefined) {
        p.score -= lastGame.changes[p.id];
      }
    });

    session.games.pop();
    this._save();
    return true;
  },

  endSession(sessionId) {
    this._load();
    const session = this._db.sessions.find(s => s.id === sessionId);
    if (!session) return {};

    const attendeeSet = new Set(session.attendees);
    const decayChanges = {};

    this._db.players.forEach(p => {
      if (!attendeeSet.has(p.id) && p.decayCount < 2) {
        p.score -= 300;
        p.decayCount = (p.decayCount || 0) + 1;
        decayChanges[p.id] = -300;
      }
    });

    session.ended = true;
    session.decayChanges = decayChanges;
    this._save();
    return decayChanges;
  },

  exportJson() {
    this._load();
    return JSON.stringify(this._db, null, 2);
  },

  importJson(json) {
    try {
      const data = JSON.parse(json);
      if (!data.players || !data.sessions) throw new Error('Invalid format');
      this._db = data;
      this._save();
      return true;
    } catch (e) { return false; }
  }
};

// ── App UI Controller ─────────────────────────────────────────────────────────
const App = {
  _tab: 'leaderboard',
  _gameState: null, // {sessionId, attendees, teamA:[], teamB:[], winner:null, hasMargin:false}

  init() {
    this.switchTab('leaderboard');
  },

  switchTab(tab) {
    this._tab = tab;
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    const renders = {
      leaderboard: () => this.renderLeaderboard(),
      session: () => this.renderSession(),
      players: () => this.renderPlayers(),
      history: () => this.renderHistory(),
      rules: () => this.renderRules()
    };
    const fn = renders[tab];
    if (fn) fn();
  },

  _setContent(html) {
    document.getElementById('main-content').innerHTML = html;
  },

  openModal(html) {
    document.getElementById('modal-content').innerHTML = html;
    document.getElementById('modal-overlay').classList.add('open');
    document.getElementById('modal').classList.add('open');
    // Scroll modal body to top
    const mc = document.getElementById('modal-content');
    if (mc) mc.scrollTop = 0;
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
    document.getElementById('modal').classList.remove('open');
  },

  // ── Tier ──
  _tier(score) {
    if (score >= 24000) return { label: 'Elite', cls: 'tier-elite' };
    if (score >= 18000) return { label: 'Pro', cls: 'tier-pro' };
    if (score >= 12000) return { label: 'Mid', cls: 'tier-mid' };
    return { label: 'Beginner', cls: 'tier-beginner' };
  },

  // ── Leaderboard ──────────────────────────────────────────────────────────
  renderLeaderboard() {
    const players = [...Data.db.players].sort((a, b) => b.score - a.score);
    if (!players.length) {
      this._setContent(`
        <div class="empty-state">
          <div class="empty-icon">🏸</div>
          <div class="empty-title">ยังไม่มีผู้เล่น</div>
          <div class="empty-desc">เพิ่มผู้เล่นในแท็บ 👥 ก่อนเริ่มใช้งาน</div>
        </div>
      `);
      return;
    }

    const rankIcons = ['🥇', '🥈', '🥉'];
    const rows = players.map((p, i) => {
      const rank = i + 1;
      const tier = this._tier(p.score);
      const rankCls = rank <= 3 ? `rank-${rank}` : '';
      const rankDisplay = rank <= 3
        ? `<span class="rank-badge">${rankIcons[rank - 1]}</span>`
        : `<span class="rank-num">#${rank}</span>`;
      const decayInfo = p.decayCount > 0
        ? `<span class="score-decay">Decay: ${p.decayCount}/2</span>` : '';
      return `
        <div class="player-card ${rankCls}">
          ${rankDisplay}
          <div class="player-info">
            <div class="player-name">${esc(p.name)}</div>
            <div class="player-meta"><span class="tier-badge ${tier.cls}">${tier.label}</span></div>
          </div>
          <div class="player-score">
            <div class="score-value">${fmtNum(p.score)}</div>
            ${decayInfo}
          </div>
        </div>
      `;
    }).join('');

    this._setContent(`
      <div class="section-title">ตารางคะแนน</div>
      ${rows}
    `);
  },

  // ── Session Tab ──────────────────────────────────────────────────────────
  renderSession() {
    const session = Data.activeSession();
    if (!session) {
      this._setContent(`
        <div class="empty-state">
          <div class="empty-icon">🎮</div>
          <div class="empty-title">ยังไม่มีเซสชันที่กำลังเล่น</div>
          <div class="empty-desc">กดปุ่มด้านล่างเพื่อเริ่มเซสชันใหม่</div>
          <div class="mt12">
            <button class="btn btn-primary btn-lg" onclick="App.showStartSession()">+ เริ่มเซสชันใหม่</button>
          </div>
        </div>
      `);
      return;
    }

    const players = Data.db.players;
    const playerMap = {};
    players.forEach(p => { playerMap[p.id] = p; });

    const gameCount = session.games.length;
    const attendeeNames = session.attendees.map(id => playerMap[id] ? esc(playerMap[id].name) : '?').join(', ');

    const attendeeChips = session.attendees.map(id => {
      const p = playerMap[id];
      return p ? `<span class="attendee-chip">${esc(p.name)}</span>` : '';
    }).join('');

    const gameCards = session.games.map((g, i) => this._gameCard(g, playerMap, i + 1)).join('');

    const undoBtn = gameCount > 0
      ? `<button class="btn btn-outline btn-sm" onclick="App.undoLastGame('${esc(session.id)}')">↩ ยกเลิกเกมล่าสุด</button>` : '';

    this._setContent(`
      <div class="card">
        <div class="session-header">
          <div>
            <div class="session-date">${fmtDate(session.date)}</div>
            <div class="session-stats">เล่นแล้ว ${gameCount} เกม</div>
          </div>
          <div class="session-actions">
            ${undoBtn}
            <button class="btn btn-danger btn-sm" onclick="App.confirmEnd('${esc(session.id)}')">จบเซสชัน</button>
          </div>
        </div>
        <div class="attendee-chips">${attendeeChips}</div>
      </div>
      <button class="btn btn-primary btn-lg mb4" onclick="App.showAddGame('${esc(session.id)}')">+ เพิ่มเกม</button>
      <div class="section-title mt8">เกมในเซสชันนี้</div>
      ${gameCards || '<div class="text-muted text-center" style="padding:20px">ยังไม่มีเกม กดเพิ่มเกมด้านบน</div>'}
    `);
  },

  _gameCard(game, playerMap, num) {
    const getPlayer = id => playerMap[id] || { name: '?', score: 10000 };

    const renderTeam = (teamIds, teamLabel, isWinner) => {
      const badgeCls = teamLabel === 'A' ? 'badge-a' : 'badge-b';
      const rows = teamIds.map(id => {
        const p = getPlayer(id);
        const delta = game.changes ? (game.changes[id] !== undefined ? game.changes[id] : null) : null;
        let deltaHtml = '';
        if (delta !== null) {
          const cls = delta > 0 ? 'delta-pos' : delta < 0 ? 'delta-neg' : 'delta-zero';
          deltaHtml = `<span class="game-delta-chip ${cls}">${fmtDelta(delta)}</span>`;
        }
        const m = game.meta ? game.meta[id] : null;
        const tags = [];
        if (m) {
          if (m.antiCarry) tags.push(`<span class="tag tag-carry">×${m.antiCarryMult}</span>`);
          if (m.farming) tags.push(`<span class="tag tag-farm">${Math.round(m.farmingMult*100)}%</span>`);
          if (m.safeGame) tags.push('<span class="tag tag-safe">cap</span>');
          if (m.safeStreak) tags.push('<span class="tag tag-streak">streak</span>');
        }
        const tagsHtml = tags.length ? `<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:2px">${tags.join('')}</div>` : '';
        return `
          <div style="margin-bottom:4px">
            <div class="game-player-row">
              <span class="game-pname">${esc(p.name)}</span>
              ${deltaHtml}
            </div>
            ${tagsHtml}
          </div>
        `;
      }).join('');
      const winnerBadge = isWinner ? `<span class="game-winner-badge ${badgeCls}">🏆 ชนะ</span>` : '';
      return `
        <div class="game-team ${teamLabel === 'B' ? 'game-team-b' : ''}">
          ${winnerBadge}
          ${rows}
        </div>
      `;
    };

    const marginChip = game.hasMargin ? `<span class="game-score-chip chip-margin">+Margin</span>` : '';
    const typeLabel = game.type ? Scoring.matchTypeLabel(game.type) : '';

    return `
      <div class="game-card">
        <div class="game-card-header">
          <span class="game-num">เกม ${num}</span>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:11px;color:var(--text-muted)">${esc(typeLabel)}</span>
            ${marginChip}
          </div>
        </div>
        <div class="game-teams">
          ${renderTeam(game.teamA, 'A', game.winner === 'A')}
          <div class="game-vs">VS</div>
          ${renderTeam(game.teamB, 'B', game.winner === 'B')}
        </div>
      </div>
    `;
  },

  showStartSession() {
    if (Data.activeSession()) {
      alert('มีเซสชันที่กำลังเล่นอยู่แล้ว');
      return;
    }
    const players = Data.db.players;
    if (!players.length) {
      alert('ยังไม่มีผู้เล่น กรุณาเพิ่มผู้เล่นก่อน');
      return;
    }

    const playerChecks = players.map(p => `
      <label class="check-row">
        <input type="checkbox" class="attendee-check" value="${esc(p.id)}" checked>
        <span class="check-row-label">${esc(p.name)} <span style="color:var(--text-muted);font-size:12px">(${fmtNum(p.score)})</span></span>
      </label>
    `).join('');

    this.openModal(`
      <div class="modal-handle"></div>
      <div class="modal-header">
        <span class="modal-title">🎮 เริ่มเซสชันใหม่</span>
        <button class="btn-icon" onclick="App.closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <label class="form-label">วันที่</label>
        <input class="input" type="date" id="session-date" value="${todayStr()}" style="width:100%;margin-bottom:12px">
        <label class="form-label">ผู้เล่นที่เข้าร่วม</label>
        <div class="check-list">${playerChecks}</div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="App.closeModal()">ยกเลิก</button>
        <button class="btn btn-primary" onclick="App._doStartSession()">เริ่มเลย</button>
      </div>
    `);
  },

  _doStartSession() {
    const date = document.getElementById('session-date').value;
    if (!date) { alert('กรุณาเลือกวันที่'); return; }

    const checked = [...document.querySelectorAll('.attendee-check:checked')].map(el => el.value);
    if (checked.length < 4) { alert('ต้องมีผู้เล่นอย่างน้อย 4 คน'); return; }

    Data.startSession(checked, date);
    this.closeModal();
    this.switchTab('session');
  },

  // ── Add Game Modal ──────────────────────────────────────────────────────
  showAddGame(sessionId) {
    const session = Data.db.sessions.find(s => s.id === sessionId);
    if (!session) return;

    const players = Data.db.players.filter(p => session.attendees.includes(p.id));

    this._gameState = {
      sessionId,
      attendees: players,
      teamA: [],
      teamB: [],
      winner: null,
      hasMargin: false
    };

    this.openModal(this._buildGameModal());
  },

  _buildGameModal() {
    const gs = this._gameState;
    if (!gs) return '';

    const players = gs.attendees;
    const chips = players.map(p => {
      const inA = gs.teamA.includes(p.id);
      const inB = gs.teamB.includes(p.id);
      let cls = '';
      let badge = '';
      if (inA) { cls = 'team-a'; badge = `<span class="team-dot team-dot-a">A</span>`; }
      else if (inB) { cls = 'team-b'; badge = `<span class="team-dot team-dot-b">B</span>`; }
      return `
        <button class="player-chip ${cls}" onclick="App._cycleTeam('${esc(p.id)}')">
          ${badge}
          <div style="flex:1;text-align:left">
            <div class="chip-name">${esc(p.name)}</div>
            <div class="chip-score">${fmtNum(p.score)}</div>
          </div>
        </button>
      `;
    }).join('');

    const aCount = gs.teamA.length;
    const bCount = gs.teamB.length;
    const canSelectWinner = aCount === 2 && bCount === 2;

    const winnerSection = canSelectWinner ? `
      <div class="winner-row">
        <button class="btn winner-btn-a ${gs.winner === 'A' ? 'selected' : ''}" onclick="App._setWinner('A')">🏆 ทีม A ชนะ</button>
        <button class="btn winner-btn-b ${gs.winner === 'B' ? 'selected' : ''}" onclick="App._setWinner('B')">🏆 ทีม B ชนะ</button>
      </div>
    ` : `<div class="info-box">เลือกผู้เล่น <strong>ทีม A 2 คน</strong> และ <strong>ทีม B 2 คน</strong> ก่อน</div>`;

    const marginRow = canSelectWinner ? `
      <div class="margin-row">
        <span class="margin-label">🎯 Margin Score (ต่าง ≥8 แต้ม)</span>
        <button class="toggle ${gs.hasMargin ? 'on' : ''}" onclick="App._toggleMargin()"></button>
      </div>
    ` : '';

    let previewHtml = '';
    if (canSelectWinner && gs.winner) {
      previewHtml = this._buildPreview();
    }

    const canSave = canSelectWinner && gs.winner !== null;

    return `
      <div class="modal-handle"></div>
      <div class="modal-header">
        <span class="modal-title">+ เพิ่มเกม</span>
        <button class="btn-icon" onclick="App.closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="team-counter">
          <span class="counter-a">ทีม A: ${aCount}/2</span>
          <span class="counter-vs">VS</span>
          <span class="counter-b">ทีม B: ${bCount}/2</span>
        </div>
        <div class="chip-grid">${chips}</div>
        ${winnerSection}
        ${marginRow}
        ${previewHtml}
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="App.closeModal()">ยกเลิก</button>
        <button class="btn btn-primary" onclick="App._saveGame()" ${canSave ? '' : 'disabled'}>บันทึกเกม</button>
      </div>
    `;
  },

  _buildPreview() {
    const gs = this._gameState;
    const scoreMap = {};
    Data.db.players.forEach(p => { scoreMap[p.id] = p.score; });

    const session = Data.db.sessions.find(s => s.id === gs.sessionId);
    if (!session) return '';

    const { pairCounts, lossStreaks, lossTotals } = Scoring.sessionState(session, Data.db.players);

    const teamAObjs = gs.teamA.map(id => ({ id }));
    const teamBObjs = gs.teamB.map(id => ({ id }));

    let result;
    try {
      result = Scoring.calc(teamAObjs, teamBObjs, gs.winner, gs.hasMargin, scoreMap, pairCounts, lossStreaks, lossTotals);
    } catch(e) { return ''; }

    const playerMap = {};
    Data.db.players.forEach(p => { playerMap[p.id] = p; });

    const renderTeamPreview = (teamIds, label) => {
      const isWin = gs.winner === label;
      const rows = teamIds.map(id => {
        const p = playerMap[id] || { name: '?' };
        const delta = result.changes[id] || 0;
        const m = result.meta[id] || {};
        const cls = delta >= 0 ? 'positive' : 'negative';
        const tags = [];
        if (m.antiCarry) tags.push(`<span class="tag tag-carry">anti-carry ×${m.antiCarryMult}</span>`);
        if (m.farming) tags.push(`<span class="tag tag-farm">anti-farm ${Math.round(m.farmingMult*100)}%</span>`);
        if (m.safeGame) tags.push('<span class="tag tag-safe">cap-900</span>');
        if (m.safeStreak) tags.push('<span class="tag tag-streak">streak-safe</span>');
        if (m.margin) tags.push('<span class="tag tag-margin">margin</span>');
        return `
          <div class="preview-player-row">
            <div class="preview-player-name">${esc(p.name)}</div>
            <div class="preview-delta ${cls}">${fmtDelta(delta)}</div>
            ${tags.length ? `<div class="preview-tags">${tags.join('')}</div>` : ''}
          </div>
        `;
      }).join('');
      const winLabel = isWin ? ' 🏆' : '';
      return `
        <div class="preview-team-${label.toLowerCase()}">
          <div class="preview-team-header">ทีม ${label}${winLabel}</div>
          ${rows}
        </div>
      `;
    };

    return `
      <div class="preview-section">
        <div class="preview-title">ตัวอย่างคะแนน</div>
        <div class="preview-match-type">${esc(Scoring.matchTypeLabel(result.type))}</div>
        <div class="preview-teams">
          ${renderTeamPreview(gs.teamA, 'A')}
          ${renderTeamPreview(gs.teamB, 'B')}
        </div>
      </div>
    `;
  },

  _cycleTeam(id) {
    const gs = this._gameState;
    if (!gs) return;

    const inA = gs.teamA.includes(id);
    const inB = gs.teamB.includes(id);

    if (!inA && !inB) {
      // unselected → Team A (if A has room)
      if (gs.teamA.length < 2) {
        gs.teamA.push(id);
      } else if (gs.teamB.length < 2) {
        gs.teamB.push(id);
      }
    } else if (inA) {
      // Team A → Team B
      gs.teamA = gs.teamA.filter(x => x !== id);
      if (gs.teamB.length < 2) {
        gs.teamB.push(id);
      }
    } else if (inB) {
      // Team B → unselected
      gs.teamB = gs.teamB.filter(x => x !== id);
    }

    // Reset winner if teams changed
    if (gs.teamA.length !== 2 || gs.teamB.length !== 2) {
      gs.winner = null;
    }

    this.openModal(this._buildGameModal());
  },

  _setWinner(team) {
    if (this._gameState) {
      this._gameState.winner = team;
      this.openModal(this._buildGameModal());
    }
  },

  _toggleMargin() {
    if (this._gameState) {
      this._gameState.hasMargin = !this._gameState.hasMargin;
      this.openModal(this._buildGameModal());
    }
  },

  _saveGame() {
    const gs = this._gameState;
    if (!gs || !gs.winner || gs.teamA.length !== 2 || gs.teamB.length !== 2) return;

    Data.addGame(gs.sessionId, gs.teamA, gs.teamB, gs.winner, gs.hasMargin);
    this._gameState = null;
    this.closeModal();
    this.renderSession();
  },

  undoLastGame(sessionId) {
    if (!confirm('ยืนยันการยกเลิกเกมล่าสุด?')) return;
    Data.undoLastGame(sessionId);
    this.renderSession();
  },

  confirmEnd(sessionId) {
    const session = Data.db.sessions.find(s => s.id === sessionId);
    if (!session) return;

    const attendeeSet = new Set(session.attendees);
    const decayPlayers = Data.db.players.filter(p => !attendeeSet.has(p.id) && p.decayCount < 2);

    let decayHtml = '';
    if (decayPlayers.length) {
      decayHtml = `
        <div class="section-title">ผู้เล่นที่จะได้รับ Decay (-300)</div>
        ${decayPlayers.map(p => `
          <div class="decay-row">
            <span>${esc(p.name)}</span>
            <span class="decay-amount">-300 (ครั้งที่ ${p.decayCount + 1}/2)</span>
          </div>
        `).join('')}
      `;
    } else {
      decayHtml = '<div class="text-muted" style="padding:8px 0">ไม่มีผู้เล่นที่ได้รับ Decay</div>';
    }

    this.openModal(`
      <div class="modal-handle"></div>
      <div class="modal-header">
        <span class="modal-title">จบเซสชัน</span>
        <button class="btn-icon" onclick="App.closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="info-box">เล่นไปแล้ว <strong>${session.games.length} เกม</strong> พร้อมจบเซสชันนี้?</div>
        ${decayHtml}
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="App.closeModal()">ยกเลิก</button>
        <button class="btn btn-danger" onclick="App._doEnd('${esc(sessionId)}')">จบเซสชัน</button>
      </div>
    `);
  },

  _doEnd(sessionId) {
    Data.endSession(sessionId);
    this.closeModal();
    this.switchTab('leaderboard');
  },

  // ── Players Tab ──────────────────────────────────────────────────────────
  renderPlayers() {
    const players = [...Data.db.players].sort((a, b) => b.score - a.score);

    const playerRows = players.map(p => {
      const tier = this._tier(p.score);
      return `
        <div class="card" style="display:flex;align-items:center;gap:10px">
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:600">${esc(p.name)}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px">
              <span class="tier-badge ${tier.cls}">${tier.label}</span>
              <span style="margin-left:6px">${fmtNum(p.score)}</span>
              ${p.decayCount > 0 ? `<span style="margin-left:6px;color:var(--red)">Decay ${p.decayCount}/2</span>` : ''}
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="btn btn-outline btn-sm" onclick="App.editPlayer('${esc(p.id)}','${esc(p.name)}')">✏️</button>
            <button class="btn btn-danger-outline btn-sm" onclick="App.removePlayer('${esc(p.id)}')">🗑</button>
          </div>
        </div>
      `;
    }).join('');

    this._setContent(`
      <div class="section-title">เพิ่มผู้เล่นใหม่</div>
      <div class="card">
        <div class="input-row">
          <input class="input" id="new-player-name" type="text" placeholder="ชื่อผู้เล่น" maxlength="30">
          <button class="btn btn-primary" onclick="App.addPlayer()">เพิ่ม</button>
        </div>
      </div>
      <div class="section-title">ผู้เล่นทั้งหมด (${players.length} คน)</div>
      ${playerRows || '<div class="text-muted text-center" style="padding:20px">ยังไม่มีผู้เล่น</div>'}
      <div class="data-section">
        <div class="section-title">ข้อมูล</div>
        <div class="data-btn-row">
          <button class="btn btn-outline" style="flex:1" onclick="App.exportData()">📤 Export JSON</button>
          <button class="btn btn-outline" style="flex:1" onclick="App.importData()">📥 Import JSON</button>
        </div>
        <input type="file" id="import-file" accept=".json" style="display:none" onchange="App._onImportFile(event)">
        <div style="font-size:11px;color:var(--text-faint);text-align:center">Export/Import เพื่อสำรองข้อมูล</div>
      </div>
    `);

    // Enter key on input
    const inp = document.getElementById('new-player-name');
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') App.addPlayer(); });
  },

  addPlayer() {
    const inp = document.getElementById('new-player-name');
    if (!inp) return;
    const name = inp.value.trim();
    if (!name) { alert('กรุณาใส่ชื่อผู้เล่น'); return; }
    if (Data.db.players.find(p => p.name.toLowerCase() === name.toLowerCase())) {
      alert('มีชื่อนี้แล้ว'); return;
    }
    Data.addPlayer(name);
    inp.value = '';
    this.renderPlayers();
  },

  editPlayer(id, currentName) {
    const newName = prompt('ชื่อใหม่:', currentName);
    if (newName === null) return;
    const trimmed = newName.trim();
    if (!trimmed) { alert('ชื่อต้องไม่ว่าง'); return; }
    Data.renamePlayer(id, trimmed);
    this.renderPlayers();
  },

  removePlayer(id) {
    const session = Data.activeSession();
    if (session && session.attendees.includes(id)) {
      alert('ไม่สามารถลบผู้เล่นที่อยู่ในเซสชันปัจจุบันได้');
      return;
    }
    if (!confirm('ยืนยันการลบผู้เล่นนี้?')) return;
    Data.removePlayer(id);
    this.renderPlayers();
  },

  exportData() {
    const json = Data.exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `badminton-snowite-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importData() {
    const el = document.getElementById('import-file');
    if (el) el.click();
  },

  _onImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const ok = Data.importJson(e.target.result);
      if (ok) {
        alert('นำเข้าข้อมูลสำเร็จ');
        this.renderPlayers();
      } else {
        alert('ไฟล์ไม่ถูกต้อง');
      }
    };
    reader.readAsText(file);
  },

  // ── History Tab ──────────────────────────────────────────────────────────
  renderHistory() {
    const sessions = [...Data.db.sessions].filter(s => s.ended).reverse();

    if (!sessions.length) {
      this._setContent(`
        <div class="empty-state">
          <div class="empty-icon">📜</div>
          <div class="empty-title">ยังไม่มีประวัติ</div>
          <div class="empty-desc">ประวัติจะแสดงหลังจบเซสชัน</div>
        </div>
      `);
      return;
    }

    const playerMap = {};
    Data.db.players.forEach(p => { playerMap[p.id] = p; });

    const cards = sessions.map(s => {
      const attendeeNames = s.attendees.map(id => playerMap[id] ? playerMap[id].name : '?').join(', ');
      const decayCount = s.decayChanges ? Object.keys(s.decayChanges).length : 0;
      return `
        <div class="history-card" onclick="App.showHistory('${esc(s.id)}')">
          <div class="history-date">${fmtDate(s.date)}</div>
          <div class="history-meta">${s.games.length} เกม • ${s.attendees.length} ผู้เล่น${decayCount ? ` • Decay ${decayCount} คน` : ''}</div>
          <div style="font-size:11px;color:var(--text-faint);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(attendeeNames)}</div>
        </div>
      `;
    }).join('');

    this._setContent(`
      <div class="section-title">ประวัติเซสชัน</div>
      ${cards}
    `);
  },

  showHistory(sessionId) {
    const session = Data.db.sessions.find(s => s.id === sessionId);
    if (!session) return;

    const playerMap = {};
    Data.db.players.forEach(p => { playerMap[p.id] = p; });

    const gameCards = session.games.map((g, i) => this._gameCard(g, playerMap, i + 1)).join('');

    let decayHtml = '';
    if (session.decayChanges && Object.keys(session.decayChanges).length) {
      const rows = Object.entries(session.decayChanges).map(([id, delta]) => {
        const p = playerMap[id] || { name: '?' };
        return `<div class="decay-row"><span>${esc(p.name)}</span><span class="decay-amount">${fmtDelta(delta)}</span></div>`;
      }).join('');
      decayHtml = `<div class="divider"></div><div class="section-title">Decay</div>${rows}`;
    }

    this.openModal(`
      <div class="modal-handle"></div>
      <div class="modal-header">
        <span class="modal-title">${fmtDate(session.date)}</span>
        <button class="btn-icon" onclick="App.closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="info-box">เล่น <strong>${session.games.length} เกม</strong> • ผู้เล่น <strong>${session.attendees.length} คน</strong></div>
        <div class="section-title">เกมทั้งหมด</div>
        ${gameCards || '<div class="text-muted">ไม่มีเกม</div>'}
        ${decayHtml}
      </div>
    `);
  },

  // ── Rules Tab ──────────────────────────────────────────────────────────
  renderRules() {
    this._setContent(`
      <div class="section-title">กติกาการแข่งขัน</div>

      <div class="rule-card">
        <div class="rule-title">📌 กติกา 1 — คะแนนตั้งต้น</div>
        <div class="rule-body">ทุกคนเริ่มต้นที่ <strong>10,000 คะแนน</strong></div>
      </div>

      <div class="rule-card">
        <div class="rule-title">⚡ กติกา 2 — คะแนนต่อเกม</div>
        <div class="rule-body">
          คำนวณจากค่าเฉลี่ยคะแนน (Δ = |เฉลี่ยA − เฉลี่ยB|)
          <table class="rule-table">
            <tr><th>สถานการณ์</th><th>ชนะ</th><th>แพ้</th></tr>
            <tr><td>🟰 สูสี (Δ ≤ 300)</td><td class="pos">+1,000</td><td class="neg">-1,000</td></tr>
            <tr><td>⬆️ ทีมอ่อนชนะ (upset)</td><td class="pos">+1,200</td><td class="neg">-1,000</td></tr>
            <tr><td>⬇️ ทีมเก่งชนะ (favorite)</td><td class="pos">+800</td><td class="neg">-800</td></tr>
          </table>
        </div>
      </div>

      <div class="rule-card">
        <div class="rule-title">🎯 กติกา 3 — Margin Score</div>
        <div class="rule-body">
          ถ้าแต้มต่างในเกม <strong>≥ 8 แต้ม</strong><br>
          ผู้ชนะ <strong style="color:var(--green)">+150</strong> / ผู้แพ้ <strong style="color:var(--red)">-150</strong> เพิ่มเติม
        </div>
      </div>

      <div class="rule-card">
        <div class="rule-title">⚖️ กติกา 4 — Anti-Carry</div>
        <div class="rule-body">
          ถ้าคะแนนของคนในทีมต่างกัน <strong>> 1,500</strong><br>
          คนคะแนนสูง: คะแนนที่ได้ <strong>× 0.8</strong><br>
          คนคะแนนต่ำ: คะแนนที่ได้ <strong>× 1.2</strong>
        </div>
      </div>

      <div class="rule-card">
        <div class="rule-title">🔥 กติกา 5 — Anti-Farming</div>
        <div class="rule-body">
          คู่เดิมในเซสชันเดียวกัน:<br>
          เกม 1–2: <strong>100%</strong> คะแนนปกติ<br>
          เกม 3: <strong>50%</strong> คะแนน<br>
          เกม 4+: <strong>20%</strong> คะแนน
        </div>
      </div>

      <div class="rule-card">
        <div class="rule-title">📉 กติกา 6 — Decay</div>
        <div class="rule-body">
          ขาดเซสชัน: <strong style="color:var(--red)">-300</strong> คะแนน<br>
          ใช้ได้สูงสุด <strong>2 ครั้ง</strong> (รวม -600 สูงสุด)
        </div>
      </div>

      <div class="rule-card">
        <div class="rule-title">🛡️ กติกา 7 — Safety</div>
        <div class="rule-body">
          <strong>7.1 ต่อเกม:</strong> เสียสูงสุดไม่เกิน <strong style="color:var(--red)">-900</strong> ต่อเกม<br><br>
          <strong>7.2 แพ้ติด:</strong> แพ้ 3 เกมติด → รวมการหักทั้ง 3 เกมนั้นไม่เกิน <strong style="color:var(--red)">-2,500</strong><br><br>
          <strong>ลำดับคำนวณ:</strong> base + margin → anti-carry → anti-farming (50%/20%) → cap -900 → streak safety
        </div>
      </div>

      <div class="rule-card">
        <div class="rule-title">🏸 กติกา 8 — รูปแบบการแข่งขัน</div>
        <div class="rule-body">
          เล่น <strong>15 เกม</strong> ต่อเซสชัน<br>
          คู่เดิมเล่นได้ <strong>สูงสุด 2 เกมติดต่อกัน</strong> แล้วต้องสลับ
        </div>
      </div>

      <div class="rule-card">
        <div class="rule-title">📊 Tier คะแนน</div>
        <div class="rule-body">
          <span class="tier-badge tier-elite">Elite</span> ≥ 24,000<br>
          <span class="tier-badge tier-pro">Pro</span> ≥ 18,000<br>
          <span class="tier-badge tier-mid">Mid</span> ≥ 12,000<br>
          <span class="tier-badge tier-beginner">Beginner</span> &lt; 12,000
        </div>
      </div>
    `);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
