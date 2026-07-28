/*
 * engine.js — turn-based encounter logic + world state.
 * Pure-ish: it mutates a `state` object and returns log lines. No DOM here.
 */
const Engine = (() => {
  const PLAYER_MAX_HP = 3;

  function newGame() {
    return {
      version: 1,
      hp: PLAYER_MAX_HP,
      maxHp: PLAYER_MAX_HP,
      node: GAME_DATA.scenario.startNode,
      otataralUses: GAME_DATA.approaches.otataral.uses,
      studied: {},     // codexId -> true (entries the player has read)
      bestiary: {},    // enemyId -> { defeated, weaknessKnown }
      cleared: {},     // nodeId -> true (encounters resolved)
      encounter: null, // active encounter state
      won: false,
      dead: false,
    };
  }

  // Mark a codex entry read; returns ids of foes it just made "studied".
  function readCodex(state, codexId) {
    state.studied[codexId] = true;
    const entry = GAME_DATA.codex.find(c => c.id === codexId);
    const learned = [];
    (entry?.revealsWeaknessFor || []).forEach(eid => {
      const b = (state.bestiary[eid] ||= { defeated: false, weaknessKnown: false });
      if (!b.weaknessKnown) { b.weaknessKnown = true; learned.push(eid); }
    });
    return learned;
  }

  // Does the player have a codex entry that reveals this foe's weakness?
  function hasStudiedFoe(state, enemyId) {
    return GAME_DATA.codex.some(c =>
      (c.revealsWeaknessFor || []).includes(enemyId) && state.studied[c.id]);
  }

  function startEncounter(state, enemyId) {
    const foe = GAME_DATA.enemies[enemyId];
    state.encounter = {
      enemyId,
      wounds: foe.wounds,
      reads: { observe: false, probe: false, recall: false },
      log: [foe.intro],
      over: false,
    };
    return state.encounter;
  }

  // A "read" action: gather information. Some cost you (probe provokes).
  function read(state, kind) {
    const enc = state.encounter;
    const foe = GAME_DATA.enemies[enc.enemyId];
    if (enc.over) return;

    if (kind === 'recall' && !hasStudiedFoe(state, enc.enemyId)) {
      enc.log.push('You search your memory and find nothing certain. Study it in the Codex first.');
      return;
    }
    if (enc.reads[kind]) { enc.log.push('You have already learned what that will tell you.'); return; }

    enc.reads[kind] = true;
    enc.log.push('» ' + foe.clues[kind]);

    if (kind === 'recall') {
      state.bestiary[enc.enemyId] ||= { defeated: false, weaknessKnown: false };
      state.bestiary[enc.enemyId].weaknessKnown = true;
    }
    if (kind === 'probe') {           // probing provokes a reaction
      damagePlayer(state, 1, 'It answers your prodding with a blow. (-1)');
    }
  }

  // Apply an approach. Returns { outcome } and updates the log.
  function act(state, approachId) {
    const enc = state.encounter;
    const foe = GAME_DATA.enemies[enc.enemyId];
    if (enc.over) return;

    if (approachId === 'otataral') {
      if (state.otataralUses <= 0) { enc.log.push('Your otataral is spent.'); return; }
      state.otataralUses--;
    }

    let outcome;
    if (foe.weakness.includes(approachId)) {
      outcome = 'weakness';
      enc.wounds = 0;
      enc.log.push('✔ ' + (foe.onWeakness || 'You strike true and it falls.'));
      resolveWin(state, foe);
    } else if (foe.backfire.includes(approachId)) {
      outcome = 'backfire';
      enc.log.push('✖ ' + (foe.onBackfire || 'It turns your own power against you.'));
      damagePlayer(state, 2, null);
    } else {
      outcome = 'neutral';
      enc.wounds = Math.max(0, enc.wounds - 1);
      enc.log.push('· ' + (foe.onNeutral || 'A glancing hurt — not enough.'));
      if (enc.wounds <= 0) { resolveWin(state, foe); }  // grind it down (costly)
      else damagePlayer(state, 1, 'It answers. (-1)');
    }
    return { outcome };
  }

  function resolveWin(state, foe) {
    const enc = state.encounter;
    enc.over = true;
    state.bestiary[foe.id] ||= { defeated: false, weaknessKnown: false };
    state.bestiary[foe.id].defeated = true;
    state.bestiary[foe.id].weaknessKnown = true;
    state.cleared[state.node] = true;
    if (GAME_DATA.scenario.winNode === state.node && foe.boss) state.won = true;
    enc.log.push('— ' + foe.name + ' is undone.');
  }

  function damagePlayer(state, amount, msg) {
    state.hp = Math.max(0, state.hp - amount);
    if (msg) state.encounter?.log.push(msg);
    if (state.hp <= 0) {
      state.dead = true;
      if (state.encounter) { state.encounter.over = true; state.encounter.log.push('✗ You fall. The land keeps your name.'); }
    }
  }

  function flee(state) {
    const enc = state.encounter;
    enc.over = true;
    enc.fled = true;
    enc.log.push('You break away and fall back to safer ground.');
  }

  function move(state, toNodeId) {
    state.node = toNodeId;
    state.encounter = null;
  }

  return {
    PLAYER_MAX_HP, newGame, readCodex, hasStudiedFoe,
    startEncounter, read, act, flee, move,
  };
})();
