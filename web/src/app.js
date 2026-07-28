/*
 * app.js — UI layer. Linear scene runner, turn-based encounters, save/load.
 */
(() => {
  const SAVE_KEY = 'morn_save_v3';
  const el = document.getElementById('app');
  let state = null;

  // ---- persistence ------------------------------------------------------
  function save()  { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {} }
  function load()  { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; } }
  function hasSave(){ return !!localStorage.getItem(SAVE_KEY); }

  // ---- helpers ----------------------------------------------------------
  const h = (html) => { el.innerHTML = html; };
  const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c]));
  function on(sel, evt, fn) { el.querySelectorAll(sel).forEach(n => n.addEventListener(evt, fn)); }

  function hpBar() {
    let pips = '';
    for (let i = 0; i < state.maxHp; i++) pips += `<span class="pip ${i < state.hp ? 'on' : ''}"></span>`;
    return `<div class="hp" title="Vitality">${pips}<span class="ota">◈ otataral: ${state.otataralUses}</span></div>`;
  }

  // ---- title / help -----------------------------------------------------
  function title() {
    h(`
      <div class="screen title">
        <h1>The Barrows of Morn</h1>
        <p class="sub">A Malazan text RPG — win by wit, not by numbers.</p>
        <div class="menu">
          ${hasSave() ? `<button data-a="continue" class="primary">Continue</button>` : ``}
          <button data-a="new" class="${hasSave() ? '' : 'primary'}">New Journey</button>
          <button data-a="codex">Codex</button>
          <button data-a="how">How to Play</button>
        </div>
      </div>`);
    on('[data-a="continue"]', 'click', () => { state = load(); route(); });
    on('[data-a="new"]', 'click', () => { if (!hasSave() || confirm('Begin a new journey? Your current save and Codex will be wiped.')) { state = Engine.newGame(); save(); route(); } });
    on('[data-a="codex"]', 'click', () => codex('title'));
    on('[data-a="how"]', 'click', howto);
  }

  function howto() {
    h(`
      <div class="screen">
        <h2>How to Play</h2>
        <div class="prose">
          <p>You are no one special in a world of dragons, undead, and ancient powers. You will not out-fight these things. You survive by <b>paying attention</b>.</p>
          <ul>
            <li>The road runs <b>one way</b>, through one encounter after another. Between them you rest and heal.</li>
            <li>Each encounter is <b>turn based</b>. Every action — a look, a word, a blow — takes a turn.</li>
            <li>Your <b>Codex begins empty</b>. Each time you <b>Read</b> a foe (Observe, Probe, Recall), you learn something and it is written in. That knowledge <b>carries forward</b> — what you learn from one being may already tell you what the next one is.</li>
            <li>Encounters are more than fights. <b>Speak, withdraw, bargain, or misdirect</b> — often the clever path is not violence at all. The right non-combat choice may need something you’ve learned.</li>
            <li>In combat, the correct counter wins; the wrong one can get you killed. Some foes must <i>never</i> be fought.</li>
            <li>Tap any character’s <b>name</b> to see what you’ve worked out about them so far.</li>
          </ul>
        </div>
        <div class="menu"><button data-a="back">Back</button></div>
      </div>`);
    on('[data-a="back"]', 'click', title);
  }

  // ---- router -----------------------------------------------------------
  function route() {
    if (!state) return title();
    if (state.dead) return gameover();
    if (state.encounter && state.encounter.over) return encounterEnd();
    if (state.encounter) return encounter();
    return renderScene();
  }

  function renderScene() {
    const scenes = GAME_DATA.scenario.scenes;
    if (state.scene >= scenes.length) return victory();
    const sc = scenes[state.scene];
    if (sc.type === 'narration') return narration(sc);
    if (sc.type === 'encounter') {
      if (!state.encounter) { Engine.startEncounter(state, sc.enemy); save(); }
      return encounter();
    }
  }

  function narration(sc) {
    if (state.hp < state.maxHp) { state.hp = state.maxHp; save(); }  // rest & heal on the road
    h(`
      <div class="screen">
        <div class="topbar">${hpBar()}<div class="tools"><button data-a="codex">Codex</button><button data-a="menu">Menu</button></div></div>
        <h2>${esc(sc.title || '')}</h2>
        <p class="prose">${esc(sc.text)}</p>
        <div class="menu"><button class="primary" data-a="go">Go on</button></div>
      </div>`);
    on('[data-a="go"]', 'click', () => { state.scene++; save(); route(); });
    on('[data-a="codex"]', 'click', () => codex('scene'));
    on('[data-a="menu"]', 'click', title);
  }

  // ---- encounter (turn based) ------------------------------------------
  function encounter() {
    const enc = state.encounter;
    const foe = GAME_DATA.enemies[enc.enemyId];
    const app = GAME_DATA.approaches;
    const canRecall = enc.reads.observe || enc.reads.probe || enc.knownAtStart;

    const interactions = (foe.interactions || []).map(it =>
      `<button data-interact="${it.id}">${esc(it.label)}${it.needs && !state.studied[it.needs] ? ' <span class="hint">(uncertain)</span>' : ''}</button>`
    ).join('');

    h(`
      <div class="screen">
        <div class="topbar">${hpBar()}<div class="tools"><span class="turn">Turn ${enc.turn}</span><button data-a="codex">Codex</button></div></div>
        <h2 class="foe"><button class="namebtn" data-dossier>${esc(foe.name)} <span class="info" aria-hidden="true">ⓘ</span></button> <span class="tag">${esc(foe.title)}</span></h2>
        <div class="log">${enc.log.map(l => `<p>${esc(l)}</p>`).join('')}</div>

        <h3>Read — learn what it is</h3>
        <div class="menu row">
          <button data-read="observe" ${enc.reads.observe ? 'disabled' : ''}>Observe</button>
          <button data-read="probe" ${enc.reads.probe ? 'disabled' : ''}>Probe${foe.noFight ? '' : ' <span class="hint">(risky)</span>'}</button>
          <button data-read="recall" ${enc.reads.recall ? 'disabled' : ''}>Recall Lore${canRecall ? '' : ' <span class="hint">(look first)</span>'}</button>
        </div>

        ${interactions ? `<h3>Speak &amp; other paths</h3><div class="menu">${interactions}</div>` : ``}

        <h3>${foe.noFight ? 'Or raise a hand' : 'Act'}</h3>
        <div class="menu">
          <button data-act="strike">${esc(app.strike.name)}</button>
          <button data-act="tellann">${esc(app.tellann.name)}</button>
          <button data-act="omtose">${esc(app.omtose.name)}</button>
          <button data-act="otataral" ${state.otataralUses <= 0 ? 'disabled' : ''}>${esc(app.otataral.name)} (${state.otataralUses})</button>
        </div>
      </div>`);
    on('[data-dossier]', 'click', () => openDossier(enc.enemyId));
    on('[data-read]', 'click', (e) => { Engine.read(state, e.target.closest('[data-read]').dataset.read); save(); route(); });
    on('[data-interact]', 'click', (e) => { Engine.interact(state, e.target.closest('[data-interact]').dataset.interact); save(); route(); });
    on('[data-act]',  'click', (e) => { Engine.act(state, e.target.dataset.act); save(); route(); });
    on('[data-a="codex"]', 'click', () => codex('encounter'));
  }

  function encounterEnd() {
    const enc = state.encounter;
    const cont = state.dead ? 'So it ends' : 'Go on';
    h(`
      <div class="screen">
        <div class="topbar">${hpBar()}<div class="tools"><span class="turn">Turn ${enc.turn}</span></div></div>
        <div class="log">${enc.log.map(l => `<p>${esc(l)}</p>`).join('')}</div>
        <div class="menu"><button class="primary" data-a="ok">${cont}</button></div>
      </div>`);
    on('[data-a="ok"]', 'click', () => { state.encounter = null; state.scene++; save(); route(); });
  }

  function victory() {
    h(`<div class="screen title">
        <h1>The Shore Lets You Go</h1>
        <p class="prose">You walked a road of dragons and the ancient dead, and you are still breathing — not because you were strong, but because you understood what you faced, and knew when not to raise your hand.</p>
        <p class="muted">You were never the strongest thing on this road. You were only the one who paid attention.</p>
        <div class="menu"><button data-a="codex">Review your Codex</button><button data-a="menu">Title</button></div>
      </div>`);
    on('[data-a="codex"]', 'click', () => codex('victory'));
    on('[data-a="menu"]', 'click', title);
  }

  function gameover() {
    h(`<div class="screen title">
        <h1>You Fall</h1>
        <p class="prose">The land keeps your name, and little else. But what you learned, you keep — begin again, and let it serve you.</p>
        <div class="menu"><button class="primary" data-a="retry">Walk it again</button><button data-a="menu">Title</button></div>
      </div>`);
    on('[data-a="retry"]', 'click', () => { state = Engine.retryKeepingLore(state); save(); route(); });
    on('[data-a="menu"]', 'click', title);
  }

  // ---- Codex (blank at start; grows as you learn) -----------------------
  function codex(from, filter) {
    filter = (filter || '').toLowerCase();
    const known = GAME_DATA.codex.filter(c => state && state.studied[c.id]);
    const entries = known.filter(c => !filter || (c.title + ' ' + c.category + ' ' + c.summary).toLowerCase().includes(filter));
    const bestiary = state ? Object.entries(state.bestiary).filter(([id]) => GAME_DATA.enemies[id]) : [];
    h(`
      <div class="screen codex">
        <div class="topbar"><h2>Codex</h2><div class="tools"><button data-a="back">Back</button></div></div>
        ${known.length ? `<input id="q" class="search" placeholder="Search what you know…" value="${esc(filter)}" />` : ``}
        ${bestiary.length ? `<h3>Bestiary</h3><div class="best">${bestiary.map(([id, b]) => {
            const f = GAME_DATA.enemies[id];
            const badge = b.defeated ? '<span class="ok">✔ defeated</span>' : (b.resolved ? '<span class="ok">✔ passed peacefully</span>' : '<span class="muted">encountered</span>');
            return `<div class="bcard"><button class="namebtn" data-bdossier="${id}"><b>${esc(f.name)}</b> <span class="info" aria-hidden="true">ⓘ</span></button> <span class="tag">${esc(f.title)}</span> ${badge}</div>`;
          }).join('')}</div>` : ``}
        <h3>Lore</h3>
        ${known.length ? `<div class="entries">${entries.map(c => `
            <details open data-cid="${c.id}">
              <summary>${esc(c.title)} <span class="tag">${esc(c.category)}</span></summary>
              <p class="prose">${esc(c.summary)}</p>
              <p class="cite">📖 ${esc(c.citation)}</p>
            </details>`).join('')}</div>`
          : `<p class="muted empty">Your Codex is empty. You learn by paying attention — Observe, Probe, and Recall what you meet on the road, and it will be written here.</p>`}
      </div>`);
    const back = () => (from === 'title' || from === 'victory') ? title() : route();
    on('[data-a="back"]', 'click', back);
    on('[data-bdossier]', 'click', (e) => openDossier(e.target.closest('[data-bdossier]').dataset.bdossier));
    const q = el.querySelector('#q');
    if (q) q.addEventListener('input', (e) => codex(from, e.target.value));
  }

  // ---- Character dossier modal -----------------------------------------
  function knownState(enemyId) {
    const enc = (state && state.encounter && state.encounter.enemyId === enemyId) ? state.encounter : null;
    const b = state && state.bestiary[enemyId];
    const full = !!(b && (b.defeated || b.resolved));
    return {
      observe: full || !!(enc && enc.reads.observe),
      probe:   full || !!(enc && enc.reads.probe),
      study:   full || !!(enc && enc.reads.recall),
    };
  }

  const GATE_HINT = {
    observe: 'Observe it to learn more.',
    probe:   'Probe it to learn more.',
    study:   'Recall its lore to understand what it truly is.',
  };

  function openDossier(enemyId) {
    const foe = GAME_DATA.enemies[enemyId];
    const d = GAME_DATA.dossiers[enemyId];
    if (!foe || !d) return;
    const k = knownState(enemyId);
    const rows = (d.entries || []).map(e => {
      const shown = e.gate === 'always' || k[e.gate];
      return shown
        ? `<div class="drow"><div class="dlabel">${esc(e.label)}</div><div class="dtext">${esc(e.text)}</div></div>`
        : `<div class="drow locked"><div class="dlabel">${esc(e.label)}</div><div class="dtext muted">${esc(GATE_HINT[e.gate] || 'Not yet known.')}</div></div>`;
    }).join('');

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(foe.name)}">
        <button class="mclose" aria-label="Close">✕</button>
        <h2 class="mname">${esc(foe.name)}</h2>
        <div class="tag">${esc(foe.title)}</div>
        <p class="mappear">${esc(d.appearance)}</p>
        <div class="drows">${rows}</div>
      </div>`;
    const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('.mclose').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
  }

  // ---- boot -------------------------------------------------------------
  state = load();
  title();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
