/*
 * engine.js — turn-based encounter logic + world state.
 * Mutates a `state` object and appends log lines. No DOM here.
 *
 * An encounter can end three ways:
 *   - combat: apply the right approach (weakness) — or die trying (backfire)
 *   - peaceful: an interaction (withdraw / parley / misdirect / converse)
 *   - death: player HP hits zero
 */
const Engine = (() => {
  const PLAYER_MAX_HP = 3;

  function newGame() {
    return {
      version: 2,
      hp: PLAYER_MAX_HP,
      maxHp: PLAYER_MAX_HP,
      node: GAME_DATA.scenario.startNode,
      otataralUses: 1,
      studied: {},     // codexId -> true
      bestiary: {},    // enemyId -> { defeated, resolved, weaknessKnown }
      cleared: {},     // nodeId -> true
      encounter: null,
      won: false,
      dead: false,
    };
  }

  function readCodex(state, codexId) {
    state.studied[codexId] = true;
    const entry = GAME_DATA.codex.find(c => c.id === codexId);
    (entry?.revealsWeaknessFor || []).forEach(eid => {
      const b = (state.bestiary[eid] ||= { defeated: false, resolved: false, weaknessKnown: false });
      b.weaknessKnown = true;
    });
  }

  // Has the player read any codex entry that reveals this foe's weakness/nature?
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

  // Gather information. Probe provokes a reaction.
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
    if (kind === 'recall') markKnown(state, enc.enemyId);
    if (kind === 'probe' && !foe.noFight) damagePlayer(state, 1, 'It answers your prodding with a blow. (-1)');
  }

  // A combat approach.
  function act(state, approachId) {
    const enc = state.encounter;
    const foe = GAME_DATA.enemies[enc.enemyId];
    if (enc.over) return;

    if (foe.noFight) {                     // some things must not be fought
      enc.log.push((foe.attackLethal ? '✖ ' : '· ') + (foe.onAttack || 'Your attack finds nothing worth the name.'));
      if (foe.attackLethal) damagePlayer(state, 99, null);
      return { outcome: foe.attackLethal ? 'death' : 'nofight' };
    }

    if (approachId === 'otataral') {
      if (state.otataralUses <= 0) { enc.log.push('Your otataral is spent.'); return; }
      state.otataralUses--;
    }

    let outcome;
    if (foe.weakness.includes(approachId)) {
      outcome = 'weakness'; enc.wounds = 0;
      enc.log.push('✔ ' + (foe.onWeakness || 'You strike true and it falls.'));
      resolveKill(state, foe);
    } else if (foe.backfire.includes(approachId)) {
      outcome = 'backfire';
      enc.log.push('✖ ' + (foe.onBackfire || 'It turns your own power against you.'));
      damagePlayer(state, 2, null);
    } else {
      outcome = 'neutral';
      enc.wounds = Math.max(0, enc.wounds - 1);
      enc.log.push('· ' + (foe.onNeutral || 'A glancing hurt — not enough.'));
      if (enc.wounds <= 0) resolveKill(state, foe);
      else damagePlayer(state, 1, 'It answers. (-1)');
    }
    return { outcome };
  }

  // A non-combat resolution: withdraw, parley, misdirect, converse, etc.
  function interact(state, id) {
    const enc = state.encounter;
    const foe = GAME_DATA.enemies[enc.enemyId];
    if (enc.over) return;
    const it = (foe.interactions || []).find(x => x.id === id);
    if (!it) return;
    const branch = (it.needsStudy && !hasStudiedFoe(state, enc.enemyId)) ? it.blind : it.success;
    enc.log.push('» ' + branch.text);

    if (branch.effect === 'provoke') { damagePlayer(state, branch.dmg || 1, null); return { outcome: 'provoke' }; }
    // effect === 'resolve'
    if (branch.boon) applyBoon(state, branch.boon);
    resolvePeace(state, foe, !!branch.win);
    return { outcome: 'resolve' };
  }

  function applyBoon(state, boon) {
    const enc = state.encounter;
    if (boon.otataral) { state.otataralUses += boon.otataral; enc.log.push('✧ You gain an otataral shard.'); }
    if (boon.study) (Array.isArray(boon.study) ? boon.study : [boon.study]).forEach(cid => {
      if (!state.studied[cid]) { readCodex(state, cid); }
    });
  }

  function resolveKill(state, foe) {
    const enc = state.encounter;
    enc.over = true; enc.result = 'kill';
    markKnown(state, foe.id, { defeated: true });
    state.cleared[state.node] = true;
    if (GAME_DATA.scenario.winNode === state.node && foe.boss) state.won = true;
    enc.log.push('— ' + foe.name + ' is undone.');
  }

  function resolvePeace(state, foe, win) {
    const enc = state.encounter;
    enc.over = true; enc.result = 'peace';
    markKnown(state, foe.id, { resolved: true });
    state.cleared[state.node] = true;
    if (win) state.won = true;
    enc.log.push('— You leave ' + foe.name + ' behind, and walk on breathing.');
  }

  function markKnown(state, enemyId, extra) {
    const b = (state.bestiary[enemyId] ||= { defeated: false, resolved: false, weaknessKnown: false });
    b.weaknessKnown = true;
    if (extra) Object.assign(b, extra);
  }

  function damagePlayer(state, amount, msg) {
    state.hp = Math.max(0, state.hp - amount);
    if (msg) state.encounter?.log.push(msg);
    if (state.hp <= 0) {
      state.dead = true;
      if (state.encounter) { state.encounter.over = true; state.encounter.result = 'death'; state.encounter.log.push('✗ You fall. The land keeps your name, and little else.'); }
    }
  }

  function flee(state) {
    const enc = state.encounter;
    enc.over = true; enc.fled = true; enc.result = 'flee';
    enc.log.push('You break away and fall back to safer ground.');
  }

  function move(state, toNodeId) { state.node = toNodeId; state.encounter = null; }

  return {
    PLAYER_MAX_HP, newGame, readCodex, hasStudiedFoe,
    startEncounter, read, act, interact, flee, move,
  };
})();
