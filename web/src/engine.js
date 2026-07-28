/*
 * engine.js — turn-based encounter logic + world state.
 * Mutates a `state` object and appends log lines. No DOM here.
 *
 * The journey is LINEAR (a sequence of scenes). The Codex starts EMPTY and
 * fills as you take turns: every Read teaches you something and writes it in.
 * Knowledge persists across encounters, so later foes build on earlier ones.
 */
const Engine = (() => {
  const PLAYER_MAX_HP = 3;

  function newGame() {
    return {
      version: 3,
      hp: PLAYER_MAX_HP,
      maxHp: PLAYER_MAX_HP,
      scene: 0,          // index into scenario.scenes
      otataralUses: 1,
      studied: {},       // codexId -> true  (blank at start)
      bestiary: {},      // enemyId -> { defeated, resolved, weaknessKnown }
      encounter: null,
      won: false,
      dead: false,
    };
  }

  // Keep hard-won knowledge across a death; reset the run itself.
  function retryKeepingLore(state) {
    return Object.assign(newGame(), { studied: state.studied, bestiary: state.bestiary });
  }

  function readCodex(state, codexId) {
    state.studied[codexId] = true;
    const entry = GAME_DATA.codex.find(c => c.id === codexId);
    (entry?.revealsWeaknessFor || []).forEach(eid => {
      (state.bestiary[eid] ||= { defeated: false, resolved: false, weaknessKnown: false }).weaknessKnown = true;
    });
  }

  function hasStudiedFoe(state, enemyId) {
    return GAME_DATA.codex.some(c =>
      (c.revealsWeaknessFor || []).includes(enemyId) && state.studied[c.id]);
  }

  function startEncounter(state, enemyId) {
    const foe = GAME_DATA.enemies[enemyId];
    state.encounter = {
      enemyId,
      turn: 0,
      wounds: foe.wounds,
      reads: { observe: false, probe: false, recall: false },
      knownAtStart: hasStudiedFoe(state, enemyId),  // did prior lore already cover this foe?
      log: [foe.intro],
      over: false,
    };
    return state.encounter;
  }

  // Reading is how you learn. Each read is a turn and writes lore to the Codex.
  function read(state, kind) {
    const enc = state.encounter;
    const foe = GAME_DATA.enemies[enc.enemyId];
    if (enc.over) return;
    if (enc.reads[kind]) { enc.log.push('You have already learned what that will tell you.'); return; }
    if (kind === 'recall' && !(enc.reads.observe || enc.reads.probe || enc.knownAtStart)) {
      enc.log.push('You reach for a memory that isn’t there yet. Look closer first.');
      return;
    }

    enc.reads[kind] = true;
    enc.turn++;
    enc.log.push('» ' + foe.clues[kind]);

    const rev = foe.reveals && foe.reveals[kind];
    if (rev) (Array.isArray(rev) ? rev : [rev]).forEach(cid => {
      if (!state.studied[cid]) {
        readCodex(state, cid);
        const t = GAME_DATA.codex.find(c => c.id === cid);
        enc.log.push('✧ Codex updated — ' + (t ? t.title : cid));
      }
    });

    if (kind === 'recall') markKnown(state, enc.enemyId);
    if (kind === 'probe' && !foe.noFight) damagePlayer(state, 1, 'It answers your prodding with a blow. (-1)');
  }

  // A combat approach (a turn).
  function act(state, approachId) {
    const enc = state.encounter;
    const foe = GAME_DATA.enemies[enc.enemyId];
    if (enc.over) return;
    enc.turn++;

    if (foe.noFight) {
      enc.log.push((foe.attackLethal ? '✖ ' : '· ') + (foe.onAttack || 'Your attack finds nothing worth the name.'));
      if (foe.attackLethal) damagePlayer(state, 99, null);
      return { outcome: foe.attackLethal ? 'death' : 'nofight' };
    }

    if (approachId === 'otataral') {
      if (state.otataralUses <= 0) { enc.log.push('Your otataral is spent.'); enc.turn--; return; }
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

  // A non-combat resolution (a turn). `needs` names a codex entry you must know.
  function interact(state, id) {
    const enc = state.encounter;
    const foe = GAME_DATA.enemies[enc.enemyId];
    if (enc.over) return;
    const it = (foe.interactions || []).find(x => x.id === id);
    if (!it) return;
    enc.turn++;
    const known = !it.needs || !!state.studied[it.needs];
    const branch = known ? it.success : it.blind;
    enc.log.push('» ' + branch.text);

    if (branch.effect === 'provoke') { damagePlayer(state, branch.dmg || 1, null); return { outcome: 'provoke' }; }
    if (branch.boon) applyBoon(state, branch.boon);
    resolvePeace(state, foe);
    return { outcome: 'resolve' };
  }

  function applyBoon(state, boon) {
    const enc = state.encounter;
    if (boon.otataral) { state.otataralUses += boon.otataral; enc.log.push('✧ You gain an otataral shard.'); }
    if (boon.study) (Array.isArray(boon.study) ? boon.study : [boon.study]).forEach(cid => {
      if (!state.studied[cid]) { readCodex(state, cid); enc.log.push('✧ Codex updated — ' + (GAME_DATA.codex.find(c => c.id === cid)?.title || cid)); }
    });
  }

  function resolveKill(state, foe) {
    const enc = state.encounter;
    enc.over = true; enc.result = 'kill';
    markKnown(state, foe.id, { defeated: true });
    enc.log.push('— ' + foe.name + ' is undone.');
  }

  function resolvePeace(state, foe) {
    const enc = state.encounter;
    enc.over = true; enc.result = 'peace';
    markKnown(state, foe.id, { resolved: true });
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

  return {
    PLAYER_MAX_HP, newGame, retryKeepingLore, readCodex, hasStudiedFoe,
    startEncounter, read, act, interact,
  };
})();
