/*
 * data.js — all game content as plain data (no build step, no fetch).
 * Loaded as a global so it works from file:// and any static host.
 *
 * LORE NOTE: every codex `summary` is an original paraphrase written for this
 * project. Citations point to where in the books the topic is explored; they
 * are references, not quotations. No verbatim text from the novels is included.
 */
const GAME_DATA = {

  // ---- Player's toolkit -------------------------------------------------
  // The challenge is choosing the RIGHT tool, not having enough of them.
  approaches: {
    strike:  { id: 'strike',  name: 'Strike — iron & steel',            kind: 'physical', desc: 'A mortal blow with blade or fist.' },
    tellann: { id: 'tellann', name: 'Tellann — the Warren of Fire',     kind: 'magic', aspect: 'fire', desc: 'Draw on the fire-warren of the T’lan Imass.' },
    omtose:  { id: 'omtose',  name: 'Omtose Phellack — the Ice Warren', kind: 'magic', aspect: 'ice',  desc: 'The elder Jaghut warren of cold and stillness.' },
    otataral:{ id: 'otataral',name: 'Otataral shard',                   kind: 'nullify', desc: 'Dead ore that smothers sorcery. One use.', uses: 1 },
  },

  // ---- Enemies ----------------------------------------------------------
  // weakness  : approaches that resolve the fight in your favour
  // backfire  : approaches that harm you or empower the foe
  // neutral   : approaches that do little and invite retaliation
  enemies: {
    swarm: {
      id: 'swarm', name: 'A Boiling of Rats', title: 'D’ivers',
      nature: 'D’ivers',
      wounds: 2,
      intro: 'The ground itself seems to move — a single will wearing a thousand small bodies.',
      clues: {
        observe: 'Cut one and the rest simply flow around the wound. There is no single body to kill.',
        probe:   'When you press it, the mass recoils as one — but the heat of your lantern makes it seethe and scatter.',
        recall:  'One mind, many forms. A duel means nothing to it; only something that strikes *all* of it at once will matter.',
      },
      codexRefs: ['soletaken_divers'],
      weakness: ['tellann'],            // area fire scours the whole swarm
      backfire: [],
      neutral:  ['strike', 'omtose', 'otataral'], // single-target / anti-magic does nothing to a mundane swarm
      onWeakness: 'Fire washes across the whole boiling mass at once. With no single body to flee into, the D’ivers dies as one.',
      onNeutral: 'You kill a dozen. A thousand remain, and they are on you.',
    },

    imass: {
      id: 'imass', name: 'A Kneeling Warrior of Bone', title: 'T’lan Imass',
      nature: 'Undead',
      wounds: 3,
      intro: 'Dust and dried sinew over ancient bone. It has waited here longer than the kingdom that forgot it.',
      clues: {
        observe: 'Sorcery washes over it and does nothing — it endured the death of its own flesh; it will endure yours.',
        probe:   'It does not bleed, does not tire, does not fear. But its frame is brittle; a limb, once shattered, does not knit.',
        recall:  'These are the undead of the Ritual of Tellann. Magic is wasted on them. They must be *broken* — or unmade by dead ore.',
      },
      codexRefs: ['tlan_imass', 'otataral'],
      weakness: ['strike', 'otataral'], // shatter it physically, or unmake its ritual with otataral
      backfire: [],
      neutral:  ['tellann', 'omtose'],  // it survived worse fire and ice than you can raise
      onWeakness: 'You do not try to kill what is already dead — you shatter it, driving the pieces apart until the will holding them together fails.',
      onNeutral: 'Your warren breaks over it like surf on a cliff. It steps through the light and closes.',
    },

    dragon: {
      id: 'dragon', name: 'The Shape That Was A Man', title: 'Soletaken Eleint',
      nature: 'Soletaken',
      wounds: 3,
      boss: true,
      intro: 'The air splits. Where a robed figure stood, a dragon now fills the sky — blood of the Eleint, and it has taken your measure already.',
      clues: {
        observe: 'It is wreathed in its own fire. Meeting that flame with flame would be feeding a furnace.',
        probe:   'Its power pours from a warren older than the gods. Cut off from that well, it is only flesh and fury.',
        recall:  'A single soul that becomes a dragon — Soletaken. Its strength is sorcerous. Smother the cold at its heart, or cut it from magic entirely, and the dragon becomes merely large.',
      },
      codexRefs: ['soletaken_divers', 'eleint', 'otataral', 'omtose'],
      weakness: ['otataral', 'omtose'], // strip its magic, or smother dragonfire with the ice warren
      backfire: ['tellann'],            // feeding fire to a fire-blooded dragon empowers it
      neutral:  ['strike'],
      onWeakness: 'You do not out-burn a dragon — you take the fire away. Robbed of the warren that makes it terrible, the Eleint is grounded, and mortal steel finishes what wit began.',
      onBackfire: 'Your fire pours into it like tribute. The dragon drinks the warren and grows brighter — and turns that brightness on you.',
      onNeutral: 'Steel scores a scale and skitters away. The dragon has not yet begun to try.',
    },
  },

  // ---- Codex / glossary -------------------------------------------------
  // Research here. Reading an entry marks its `revealsWeaknessFor` foes as
  // "studied", which unlocks the reliable Recall Lore read in an encounter.
  codex: [
    {
      id: 'warrens', title: 'The Warrens', category: 'Magic',
      summary: 'Magic in this world is drawn through warrens — accessible realms, each with its own aspect (fire, ice, dark, light, death, shadow, and more). A mage opens a warren and channels its power. Because warrens have natures, they also have opposites: the right aspect against the wrong foe is decisive, and the wrong one can be worse than nothing.',
      citation: 'Malazan Book of the Fallen — Gardens of the Moon, and throughout the series',
      revealsWeaknessFor: [],
    },
    {
      id: 'soletaken_divers', title: 'Soletaken & D’ivers', category: 'Shapeshifters',
      summary: 'A shapeshifting curse, or gift, of two kinds. Soletaken take a single other form — often a great beast, sometimes a dragon. D’ivers instead become many bodies sharing one mind, from a pack of wolves to a swarm of vermin. The distinction matters in a fight: a Soletaken is one powerful body to face, while a D’ivers cannot be beaten by killing any single form — only by something that reaches all of it at once.',
      citation: 'Malazan Book of the Fallen — Deadhouse Gates (the Path of Hands)',
      revealsWeaknessFor: ['swarm'],
    },
    {
      id: 'eleint', title: 'The Eleint & Dragons', category: 'Powers',
      summary: 'Dragons — the Eleint — are creatures of pure sorcery, tied to the eldest warren of all. Their power is not muscle but magic; a dragon’s fire is warren-fire. To answer such a thing with more fire is to feed it. The counter is to deny it its power: smother it with an opposed elder aspect, or sever it from magic altogether.',
      citation: 'Malazan Book of the Fallen — dragons appear throughout; lineage explored in later volumes',
      revealsWeaknessFor: ['dragon'],
    },
    {
      id: 'tlan_imass', title: 'The T’lan Imass', category: 'Elder Races',
      summary: 'An ancient people who performed a ritual binding themselves to undeath to wage an endless war — bodies of dried sinew and bone that no longer live and so cannot truly be killed. Sorcery is largely wasted on them; they simply endure it. What ends a T’lan Imass is force enough to shatter its frame past reassembly, or dead ore that unmakes the ritual holding it together.',
      citation: 'Malazan Book of the Fallen — the Ritual of Tellann, Gardens of the Moon onward',
      revealsWeaknessFor: ['imass'],
    },
    {
      id: 'tellann', title: 'Tellann — the Fire Warren', category: 'Magic',
      summary: 'The fire-aspected warren bound up with the T’lan Imass and their ritual. As a weapon it excels where a single body must be scoured or a mass must be burned all at once — but against a foe whose very nature is fire, or one that already survived the ritual’s flames, it is the wrong tool.',
      citation: 'Malazan Book of the Fallen — associated with the T’lan Imass',
      revealsWeaknessFor: ['swarm'],
    },
    {
      id: 'omtose', title: 'Omtose Phellack — the Ice Warren', category: 'Magic',
      summary: 'The elder warren of the Jaghut: cold, stillness, and the weight of ages. Ice against fire is the oldest opposition there is. Raised against a creature of flame — even a fire-blooded dragon — Omtose Phellack does not try to out-burn it; it smothers the fire at its heart.',
      citation: 'Malazan Book of the Fallen — the Jaghut and Omtose Phellack',
      revealsWeaknessFor: ['dragon'],
    },
    {
      id: 'otataral', title: 'Otataral', category: 'Anti-Magic',
      summary: 'A reddish dead ore that negates sorcery. Near it, warrens close and magic simply stops. It is the great equalizer: it can strip an Ascendant, a mage, or a dragon of the power that makes it dangerous, and it can unmake rituals of undeath. The catch — it does not discriminate. Otataral smothers your magic just as surely as your enemy’s.',
      citation: 'Malazan Book of the Fallen — Deadhouse Gates (the otataral mines)',
      revealsWeaknessFor: ['dragon', 'imass'],
    },
    {
      id: 'ascendants', title: 'Ascendants & Gods', category: 'Powers',
      summary: 'Ascendants are beings who have risen to great power; some become gods, tied to an aspect or a role they can never fully escape. You do not defeat such things by matching strength. You defeat them by understanding what binds them — the nature they cannot set aside — and turning it against them.',
      citation: 'Malazan Book of the Fallen — a central theme across the series',
      revealsWeaknessFor: [],
    },
  ],

  // ---- Scenario: a small region to explore ------------------------------
  scenario: {
    id: 'scenario1',
    title: 'The Barrows of Morn',
    startNode: 'camp',
    winNode: 'shore',        // defeating the dragon here wins the slice
    nodes: {
      camp:  { id: 'camp',  name: 'A Cold Camp', desc: 'A dead fire and old stones. Safe, for now. The land opens north to a ridge, east to the barrows, and down a long slope to the shore.', exits: { ridge: 'ridge', barrows: 'barrows', shore: 'shore' } },
      ridge: { id: 'ridge', name: 'The Wind-Scoured Ridge', desc: 'Bare rock and a sound like water where there is no water.', exits: { back: 'camp' }, enemy: 'swarm' },
      barrows:{ id: 'barrows', name: 'The Barrows', desc: 'Grass-covered mounds. One has been open a very long time.', exits: { back: 'camp' }, enemy: 'imass' },
      shore: { id: 'shore', name: 'The Grey Shore', desc: 'Black sand and a robed figure waiting at the waterline, patient as stone.', exits: { back: 'camp' }, enemy: 'dragon' },
    },
  },
};
