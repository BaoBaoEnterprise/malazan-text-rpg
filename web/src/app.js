/*
 * app.js — the UI layer. Renders screens, wires buttons, owns save/load.
 */
(() => {
  const SAVE_KEY = 'morn_save_v1';
  const el = document.getElementById('app');
  let state = null;

  // ---- persistence ------------------------------------------------------
  function save()  { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {} }
  function load()  { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; } }
  function hasSave(){ return !!localStorage.getItem(SAVE_KEY); }
  function wipe()  { localStorage.removeItem(SAVE_KEY); }

  // ---- tiny render helpers ---------------------------------------------
  const h = (html) => { el.innerHTML = html; };
  const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c]));
  function on(sel, evt, fn) { el.querySelectorAll(sel).forEach(n => n.addEventListener(evt, fn)); }

  function hpBar() {
    let pips = '';
    for (let i = 0; i < state.maxHp; i++) pips += `<span class="pip ${i < state.hp ? 'on' : ''}"></span>`;
    return `<div class="hp" title="Vitality">${pips}<span class="ota">◈ otataral: ${state.otataralUses}</span></div>`;
  }

  // ---- screens ----------------------------------------------------------
  function title() {
    h(`
      <div class="screen title">
        <h1>The Barrows of Morn</h1>
        <p class="sub">A Malazan text RPG — win by wit, not by numbers.</p>
        <div class="menu">
          ${hasSave() ? `<button data-a="continue" class="primary">Continue</button>` : ``}
          <button data-a="new" class="${hasSave() ? '' : 'primary'}">New Game</button>
          <button data-a="codex">Codex</button>
          <button data-a="how">How to Play</button>
        </div>
      </div>`);
    on('[data-a="continue"]', 'click', () => { state = load(); route(); });
    on('[data-a="new"]', 'click', () => { if (!hasSave() || confirm('Start a new game? Your current save will be replaced.')) { state = Engine.newGame(); save(); route(); } });
    on('[data-a="codex"]', 'click', () => codex('title'));
    on('[data-a="how"]', 'click', howto);
  }

  function howto() {
    h(`
      <div class="screen">
        <h2>How to Play</h2>
        <div class="prose">
          <p>You are no one special in a world of dragons, undead, and gods. You will not out-fight these things. You survive by <b>understanding</b> them.</p>
          <ul>
            <li><b>Explore</b> the region and meet what waits there.</li>
            <li>In an encounter, <b>Read</b> the foe — Observe, Probe (it hurts), and Recall Lore.</li>
            <li><b>Recall Lore</b> only works once you’ve <b>studied</b> the foe in the <b>Codex</b>. Research is a weapon.</li>
            <li><b>Act</b> with the right approach. The <i>correct</i> counter wins outright. The <i>wrong</i> one can get you killed.</li>
            <li>Every foe you understand is recorded in your <b>Bestiary</b>.</li>
          </ul>
        </div>
        <div class="menu"><button data-a="back">Back</button></div>
      </div>`);
    on('[data-a="back"]', 'click', title);
  }

  function route() {
    if (!state) return title();
    // Always show the encounter resolution (killing blow / death line) before
    // routing on to a win or game-over screen.
    if (state.encounter && state.encounter.over) return encounterEnd();
    if (state.dead) return gameover();
    if (state.won)  return victory();
    if (state.encounter) return encounter();
    return explore();
  }

  function explore() {
    const node = GAME_DATA.scenario.nodes[state.node];
    const exits = Object.entries(node.exits)
      .map(([label, to]) => `<button data-go="${to}">${esc(cap(label))} → ${esc(GAME_DATA.scenario.nodes[to].name)}</button>`)
      .join('');
    h(`
      <div class="screen">
        <div class="topbar">${hpBar()}<div class="tools"><button data-a="codex">Codex</button><button data-a="menu">Menu</button></div></div>
        <h2>${esc(node.name)}</h2>
        <p class="prose">${esc(node.desc)}</p>
        ${node.enemy && !state.cleared[node.id] ? `<button class="primary danger" data-a="fight">Something is here. Face it.</button>` : ``}
        ${node.enemy && state.cleared[node.id] ? `<p class="muted">The ground here is quiet now.</p>` : ``}
        <div class="menu">${exits}</div>
      </div>`);
    on('[data-go]', 'click', (e) => { Engine.move(state, e.target.dataset.go); save(); route(); });
    on('[data-a="fight"]', 'click', () => { Engine.startEncounter(state, node.enemy); save(); route(); });
    on('[data-a="codex"]', 'click', () => codex('explore'));
    on('[data-a="menu"]', 'click', title);
  }

  function encounter() {
    const enc = state.encounter;
    const foe = GAME_DATA.enemies[enc.enemyId];
    const studied = Engine.hasStudiedFoe(state, enc.enemyId);
    const app = GAME_DATA.approaches;
    h(`
      <div class="screen">
        <div class="topbar">${hpBar()}<div class="tools"><button data-a="codex">Codex</button></div></div>
        <h2 class="foe">${esc(foe.name)} <span class="tag">${esc(foe.title)}</span></h2>
        <div class="log">${enc.log.map(l => `<p>${esc(l)}</p>`).join('')}</div>

        <h3>Read the foe</h3>
        <div class="menu row">
          <button data-read="observe" ${enc.reads.observe ? 'disabled' : ''}>Observe</button>
          <button data-read="probe" ${enc.reads.probe ? 'disabled' : ''}>Probe <span class="hint">(risky)</span></button>
          <button data-read="recall" ${enc.reads.recall ? 'disabled' : ''} title="${studied ? '' : 'Study it in the Codex first'}">Recall Lore ${studied ? '' : '🔒'}</button>
        </div>

        <h3>Act</h3>
        <div class="menu">
          <button data-act="strike">${esc(app.strike.name)}</button>
          <button data-act="tellann">${esc(app.tellann.name)}</button>
          <button data-act="omtose">${esc(app.omtose.name)}</button>
          <button data-act="otataral" ${state.otataralUses <= 0 ? 'disabled' : ''}>${esc(app.otataral.name)} (${state.otataralUses})</button>
        </div>
        <div class="menu"><button data-a="flee">Break away</button></div>
      </div>`);
    on('[data-read]', 'click', (e) => { Engine.read(state, e.target.closest('[data-read]').dataset.read); save(); route(); });
    on('[data-act]',  'click', (e) => { Engine.act(state, e.target.dataset.act); save(); route(); });
    on('[data-a="flee"]', 'click', () => { Engine.flee(state); save(); route(); });
    on('[data-a="codex"]', 'click', () => codex('encounter'));
  }

  function encounterEnd() {
    const enc = state.encounter;
    h(`
      <div class="screen">
        <div class="topbar">${hpBar()}</div>
        <div class="log">${enc.log.map(l => `<p>${esc(l)}</p>`).join('')}</div>
        <div class="menu"><button class="primary" data-a="ok">${enc.fled ? 'Fall back' : 'Continue'}</button></div>
      </div>`);
    on('[data-a="ok"]', 'click', () => { Engine.move(state, enc.fled ? 'camp' : state.node); save(); route(); });
  }

  function victory() {
    h(`<div class="screen title">
        <h1>The Shore Is Quiet</h1>
        <p class="prose">The dragon is grounded and gone. You never were the strongest thing on this shore — you were only the one who understood it.</p>
        <div class="menu"><button data-a="codex">Review your Bestiary</button><button data-a="menu">Title</button></div>
      </div>`);
    on('[data-a="codex"]', 'click', () => codex('victory'));
    on('[data-a="menu"]', 'click', () => { title(); });
  }

  function gameover() {
    h(`<div class="screen title">
        <h1>You Fall</h1>
        <p class="prose">The land keeps your name, and little else.</p>
        <div class="menu"><button class="primary" data-a="retry">Try again</button><button data-a="menu">Title</button></div>
      </div>`);
    on('[data-a="retry"]', 'click', () => { state = Engine.newGame(); save(); route(); });
    on('[data-a="menu"]', 'click', title);
  }

  // ---- Codex screen (search + read + bestiary) --------------------------
  function codex(from, filter) {
    filter = (filter || '').toLowerCase();
    const entries = GAME_DATA.codex.filter(c =>
      !filter || (c.title + ' ' + c.category + ' ' + c.summary).toLowerCase().includes(filter));
    const bestiary = state ? Object.entries(state.bestiary) : [];
    h(`
      <div class="screen codex">
        <div class="topbar"><h2>Codex</h2><div class="tools"><button data-a="back">Back</button></div></div>
        <input id="q" class="search" placeholder="Search the lore…" value="${esc(filter)}" />
        ${bestiary.length ? `<h3>Bestiary</h3><div class="best">${bestiary.map(([id, b]) => {
            const f = GAME_DATA.enemies[id];
            return `<div class="bcard"><b>${esc(f.name)}</b> <span class="tag">${esc(f.title)}</span>${b.defeated ? ' <span class="ok">✔ defeated</span>' : ''}${b.weaknessKnown ? '<div class="muted">Weakness understood.</div>' : ''}</div>`;
          }).join('')}</div>` : ``}
        <h3>Entries</h3>
        <div class="entries">
          ${entries.map(c => `
            <details ${state && state.studied[c.id] ? 'open' : ''} data-cid="${c.id}">
              <summary>${esc(c.title)} <span class="tag">${esc(c.category)}</span>${state && state.studied[c.id] ? ' <span class="ok">studied</span>' : ''}</summary>
              <p class="prose">${esc(c.summary)}</p>
              <p class="cite">📖 ${esc(c.citation)}</p>
            </details>`).join('')}
        </div>
      </div>`);
    const back = () => (from === 'title' || from === 'victory') ? title() : route();
    on('[data-a="back"]', 'click', back);
    el.querySelector('#q').addEventListener('input', (e) => codex(from, e.target.value));
    // reading (opening) an entry marks it studied
    on('details', 'toggle', (e) => {
      if (!state || !e.target.open) return;
      const cid = e.target.dataset.cid;
      if (!state.studied[cid]) { Engine.readCodex(state, cid); save(); }
    });
  }

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // ---- boot -------------------------------------------------------------
  state = load();
  title();  // always land on title; Continue resumes the save

  // register service worker for offline / installability (ignored on file://)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
