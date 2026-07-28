/*
 * data.js — all game content as plain data (no build step, no fetch).
 *
 * LORE NOTE: every codex `summary` and character description is an ORIGINAL
 * paraphrase written for this project, stating established facts about the
 * setting and its characters. Citations point to where a topic is explored in
 * the books — they are references, not quotations. No verbatim text from the
 * novels is included.
 */
const GAME_DATA = {

  // ---- Player's toolkit -------------------------------------------------
  approaches: {
    strike:  { id: 'strike',  name: 'Strike — iron & steel',            kind: 'physical', desc: 'A mortal blow with blade or fist.' },
    tellann: { id: 'tellann', name: 'Tellann — the Warren of Fire',     kind: 'magic', aspect: 'fire', desc: 'Draw on the fire-warren of the T’lan Imass.' },
    omtose:  { id: 'omtose',  name: 'Omtose Phellack — the Ice Warren', kind: 'magic', aspect: 'ice',  desc: 'The elder Jaghut warren of cold and stillness.' },
    otataral:{ id: 'otataral',name: 'Otataral shard',                   kind: 'nullify', desc: 'Dead ore that smothers sorcery.' },
  },

  // ---- Encounters: named characters -------------------------------------
  // Each has a COMBAT profile (weakness/backfire/neutral) AND non-combat
  // `interactions`. Interactions may need study; without it they use `blind`.
  enemies: {

    // The convergence-mad D'ivers — a fight OR a clever evasion.
    gryllen: {
      id: 'gryllen', name: 'Gryllen', title: 'D’ivers — the Tide of Madness',
      nature: 'D’ivers', wounds: 2,
      encounterLabel: 'The ground itself is moving toward you.',
      intro: 'A boiling carpet of rats pours over the rocks — one ravenous will wearing a thousand small bodies. Gryllen has your scent.',
      clues: {
        observe: 'Kill one and the tide simply flows around the gap. There is no single body here to end.',
        probe:   'It recoils as one when pressed — but it strains toward the greater scents of power on the wind, barely holding to you.',
        recall:  'A D’ivers on the Path of Hands: one mad will in a thousand bodies. No duel touches it — only fire across the whole mass. Or, since it hunts the strongest scent of power, give it a greater one to chase and be gone.',
      },
      codexRefs: ['soletaken_divers', 'path_of_hands', 'tellann'],
      reveals: { observe: 'soletaken_divers', probe: 'path_of_hands', recall: 'tellann' },
      weakness: ['tellann'],
      backfire: [],
      neutral:  ['strike', 'omtose', 'otataral'],
      onWeakness: 'Fire washes across the whole tide at once. With no single body to flee into, Gryllen dies as one screaming mass.',
      onNeutral: 'You kill a dozen. A thousand remain, and they are on you.',
      interactions: [
        { id: 'misdirect', label: 'Draw it off with a greater scent', needs: 'path_of_hands',
          success: { text: 'You know what drives it: the Path of Hands, and the strongest spoor of power. You fling a warren wide toward the barrows and the sea — and Gryllen turns, hungering, away from you. You are already gone.', effect: 'resolve' },
          blind:   { text: 'You simply run. A tide of madness is faster than any mortal. It surges over your heels.', effect: 'provoke', dmg: 1 } },
      ],
    },

    // The honourable undead — magic is wasted; but he may be no enemy at all.
    tool: {
      id: 'tool', name: 'Onos T’oolan', title: 'T’lan Imass — the First Sword',
      nature: 'Undead', wounds: 3,
      encounterLabel: 'Something rises from the open barrow.',
      intro: 'Dust and dried sinew over ancient bone; flint weapons worn smooth by ages. The T’lan Imass regards you with the patience of something that stopped fearing death a hundred thousand years ago.',
      clues: {
        observe: 'Sorcery washes over it and does nothing — it endured the death of its own flesh; it will endure yours.',
        probe:   'It does not strike. It waits — measuring whether you are enemy or merely fool. Its frame is brittle, though; a limb once shattered does not knit.',
        recall:  'Onos T’oolan, once First Sword of the T’lan Imass. Sorcery is wasted on the ancient dead — they must be shattered, or unmade by otataral. But this one keeps its honour. It may not be an enemy. Name yourself no foe of the Imass, and it may lower its blade.',
      },
      codexRefs: ['tlan_imass', 'otataral', 'tool_lore'],
      reveals: { observe: 'tlan_imass', probe: 'tool_lore', recall: 'otataral' },
      weakness: ['strike', 'otataral'],
      backfire: [],
      neutral:  ['tellann', 'omtose'],
      onWeakness: 'You do not try to kill what is already dead — you shatter it, driving the pieces apart until the will binding them fails.',
      onNeutral: 'Your warren breaks over it like surf on stone. It endures, and takes a slow step closer.',
      interactions: [
        { id: 'speak', label: 'Declare yourself no enemy of the Imass', needs: 'tool_lore',
          success: { text: 'You name the Ritual of Tellann and the long war with respect, and swear you are no foe of the Imass. The ancient warrior studies you, then lowers its flint blade. In a voice like grinding stone it warns you: beware the shore, and the Lord who waits there.', effect: 'resolve', boon: { study: ['anomander_rake'] } },
          blind:   { text: 'You babble something about mercy. It does not understand mercy, and it does not trust ignorance. The flint sword moves.', effect: 'provoke', dmg: 1 } },
      ],
    },

    // The boss you must NOT fight. Recognizing that is the whole puzzle.
    rake: {
      id: 'rake', name: 'Anomander Rake', title: 'Son of Darkness',
      nature: 'Ascendant', wounds: 99, boss: true,
      noFight: true, attackLethal: true,
      onAttack: 'You raise a weapon against the Lord of Moon’s Spawn. Kurald Galain answers — the dark that came before light — and Dragnipur is already clearing its sheath. You never see the stroke that ends you.',
      encounterLabel: 'The robed figure at the waterline turns to face you.',
      intro: 'The robed figure at the waterline turns. Silver hair, black skin, eyes like a storm at dusk — and at his hip a sword that seems to drink the daylight. The air itself leans away from him.',
      clues: {
        observe: 'He does not reach for the sword. He simply watches you, unhurried, as a mountain watches weather. Every instinct you own says: this is death, if you make it so.',
        probe:   'You take one step and the shadows at his feet stir like living things. He tilts his head — patient, almost sorrowful — waiting to see what you will be foolish enough to do.',
        recall:  'This is Anomander Rake — Soletaken black dragon, bearer of Dragnipur, Lord of the Tiste Andii of Moon’s Spawn. Raise a hand against him and you are already dead. But he has no quarrel with the likes of you. Withdraw, or speak with respect, and walk away breathing.',
      },
      codexRefs: ['anomander_rake', 'kurald_galain', 'dragnipur', 'soletaken_divers', 'ascendants'],
      reveals: { observe: 'soletaken_divers', probe: 'kurald_galain', recall: 'anomander_rake' },
      weakness: [], backfire: [], neutral: [],
      interactions: [
        { id: 'withdraw', label: 'Withdraw slowly, hands open', needsStudy: false,
          success: { text: 'You lower your eyes, open your hands, and back away step by careful step. Anomander Rake watches you go, unmoving, and says nothing. The wind off the sea is the only sound. You live — because you understood the one move that mattered: you did not raise your hand.', effect: 'resolve', win: true } },
        { id: 'parley', label: 'Name him, and speak with respect', needs: 'anomander_rake',
          success: { text: 'You name him — Lord of Moon’s Spawn, Son of Darkness — and say plainly that you seek no quarrel. Something almost like weary amusement crosses his face. “Then we have none,” he answers, and stands aside. You pass, and the shore lets you go.', effect: 'resolve', win: true },
          blind:   { text: 'You start to speak without the faintest idea what you are addressing. The dark at his feet rises to your knees; the temperature drops. His gaze settles on you like a closing door. You sense, with perfect clarity, that a second word may be your last.', effect: 'provoke', dmg: 1 } },
      ],
    },

    // Pure non-combat: the man you cannot fight and should not want to.
    kruppe: {
      id: 'kruppe', name: 'Kruppe', title: 'of Darujhistan',
      nature: 'Mortal', wounds: 1,
      noFight: true, attackLethal: false,
      onAttack: 'You reach for a weapon. Somehow Kruppe is already two steps aside, dabbing his lips with a kerchief, wounded only in his boundless feelings. “Violence! And upon Kruppe, of all innocents!” You feel, obscurely, like a fool.',
      encounterLabel: 'A round little man waves you over as if you were old friends.',
      intro: 'A stout, beaming man in a food-stained waistcoat spreads his arms as though you were the very person he has awaited all his days. “Ahh! Kruppe knew you would come. Kruppe knows a great many things.”',
      clues: {
        observe: 'He talks without pause and says, apparently, nothing — yet his small eyes are quick, and miss nothing at all.',
        probe:   'Press him and the words only multiply, folding around your question like custard around a spoon. There is cunning under all that flattery.',
        recall:  'Only Kruppe — of Darujhistan, hero of his own endless tale, harmless as he insists and cleverer than he admits, a man touched by luck and by dreams. There is nothing here to fight. Listen, and you may leave richer than you came.',
      },
      codexRefs: ['kruppe'],
      reveals: { observe: 'kruppe', recall: 'kruppe' },
      weakness: [], backfire: [], neutral: [],
      interactions: [
        { id: 'listen', label: 'Let Kruppe talk', needsStudy: false,
          success: { text: 'You let him ramble — of pastries, of destiny, of his own unmatched modesty. Then, mid-flourish, he presses something cold into your palm: a dull red shard. “A trifle,” he says, “dead to all sorcery, and worth more than gold on a certain grey shore. Speak gently to the Son of Darkness, friend. Kruppe would hate to lose so promising an acquaintance.”', effect: 'resolve', boon: { otataral: 1, study: ['anomander_rake'] } } },
        { id: 'walkon', label: 'Nod politely and walk on', needsStudy: false,
          success: { text: 'You make your excuses. Kruppe waves you off with a pastry and a blessing you suspect is also a joke at your expense.', effect: 'resolve' } },
      ],
    },
  },

  // ---- Character dossiers ----------------------------------------------
  // Shown in the "tap the name" modal. `appearance` is always visible (you can
  // see them); each entry unlocks with what you've done: observe / probe /
  // study. Deliberately includes flavour and looks, not just the solve.
  dossiers: {
    gryllen: {
      appearance: 'A living carpet of brown-and-grey rats, thousands strong, flowing over the stone as one restless mass. Countless small red eyes catch the light. Where it has passed, nothing living remains — only bare, gleaming bone.',
      entries: [
        { gate: 'always',  label: 'Bearing',        text: 'It moves with a single will, surging and recoiling as though one beast wore a thousand skins at once.' },
        { gate: 'observe', label: 'In the fighting', text: 'Strike any single body and the rest simply flow around the gap. There is nothing here that dying makes smaller.' },
        { gate: 'probe',   label: 'What drives it',  text: 'It strains constantly toward the horizon — toward greater scents of power on the wind. Your presence barely holds its hunger in place.' },
        { gate: 'study',   label: 'What it is',      text: 'A D’ivers: one soul cursed across many bodies, walking the Path of Hands toward a promised ascendancy. They call it the Tide of Madness, and the name is a kindness.' },
      ],
    },
    tool: {
      appearance: 'A gaunt figure taller than a man, dried and leathered flesh stretched over ancient bone. It carries a two-handed sword of chipped flint. Its eyes are two cold points of light in a face that has not been alive since before the memory of the world.',
      entries: [
        { gate: 'always',  label: 'Bearing',        text: 'It stands utterly still — no breath, no shifting of weight, none of the small movements of the living. Patience without any end.' },
        { gate: 'observe', label: 'In the fighting', text: 'Sorcery breaks over it and leaves nothing behind. Yet the ancient frame is brittle; whatever is shattered from it does not mend.' },
        { gate: 'probe',   label: 'Its temper',      text: 'It does not attack. It weighs you — enemy, or merely a fool who wandered too near. There is judgement in the stillness, and something that might be weariness.' },
        { gate: 'study',   label: 'Who it is',       text: 'Onos T’oolan, once First Sword of the T’lan Imass — the finest warrior of an undead host bound by the Ritual of Tellann. Unlike his mindless kin, he has kept his honour, and a sorrow as old as his war.' },
      ],
    },
    rake: {
      appearance: 'A tall figure in dark robes, silver hair spilling to his waist, skin the black of deep shadow. His eyes shift like a storm at dusk — grey, then amber, then some colour with no name. At his hip hangs a plain black sword that seems to drink the daylight from around it.',
      entries: [
        { gate: 'always',  label: 'Bearing',    text: 'He is entirely unhurried. No aggression in him, and no fear — only the quiet, immovable certainty of something very old and very tired.' },
        { gate: 'observe', label: 'The danger', text: 'He has not reached for the sword. He does not need to. Every instinct you own reads him as death, waiting only upon your own foolishness.' },
        { gate: 'probe',   label: 'The shadows', text: 'The darkness at his feet moves with a life of its own, coiling and uncoiling. When you step nearer it rises — a warning, not yet a blow.' },
        { gate: 'study',   label: 'Who he is',   text: 'Anomander Rake — Son of Darkness, Lord of the Tiste Andii of Moon’s Spawn, a Soletaken whose other shape is a vast black dragon. The sword is Dragnipur, and those it slays are chained to haul a wagon through endless Chaos. He is not defeated. He is survived.' },
      ],
    },
    kruppe: {
      appearance: 'A short, round man in a food-stained waistcoat, fingers glittering with rings, a sheen of pastry grease at one corner of his mouth. He beams at you as though you were the dearest of his many old friends.',
      entries: [
        { gate: 'always',  label: 'Bearing',      text: 'He talks without pause and mostly of himself — in the third person, as the hero of a grand tale only he seems able to see.' },
        { gate: 'observe', label: 'Beneath it',   text: 'For all the babble, his small dark eyes are quick, and they miss nothing at all.' },
        { gate: 'probe',   label: 'The evasions', text: 'Press him with a question and the words only multiply, folding around it like custard around a spoon. There is a keen cunning under the foolery.' },
        { gate: 'study',   label: 'Who he is',    text: 'Kruppe of Darujhistan — fence, dreamer, and self-declared genius, touched by luck and by stranger powers than he will admit. He does not fight. He has never needed to.' },
      ],
    },
  },

  // ---- Codex / glossary -------------------------------------------------
  codex: [
    { id: 'warrens', title: 'The Warrens', category: 'Magic',
      summary: 'Magic is drawn through warrens — accessible realms, each with its own aspect: fire, ice, dark, light, death, shadow, and more. A mage opens a warren and channels its power. Because warrens have natures, they also have opposites: the right aspect against the wrong foe is decisive, and the wrong one can be worse than nothing.',
      citation: 'Malazan Book of the Fallen — Gardens of the Moon, and throughout', revealsWeaknessFor: [] },

    { id: 'soletaken_divers', title: 'Soletaken & D’ivers', category: 'Shapeshifters',
      summary: 'A shapeshifting curse of two kinds. Soletaken take a single other form — often a great beast, sometimes a dragon. D’ivers instead become many bodies sharing one mind, from a wolf-pack to a swarm of vermin. It matters in a fight: a Soletaken is one powerful body, while a D’ivers cannot be beaten by killing any single form — only by something that reaches all of it at once, or by not fighting it at all.',
      citation: 'Malazan Book of the Fallen — Deadhouse Gates (the Path of Hands)', revealsWeaknessFor: ['gryllen', 'rake'] },

    { id: 'path_of_hands', title: 'The Path of Hands', category: 'Powers',
      summary: 'A convergence that calls to Soletaken and D’ivers alike — a gathering drawn toward a gate that promises ascendancy. Those who walk it are single-minded, following the strongest trail of power. A clever traveller can turn that hunger against them: offer such a creature a greater scent to chase, and be elsewhere when it turns.',
      citation: 'Malazan Book of the Fallen — Deadhouse Gates', revealsWeaknessFor: ['gryllen'] },

    { id: 'tlan_imass', title: 'The T’lan Imass', category: 'Elder Races',
      summary: 'An ancient people who bound themselves to undeath through the Ritual of Tellann to wage an endless war — bodies of dried sinew and bone that no longer live and so cannot truly be killed. Sorcery is largely wasted on them. What ends a T’lan Imass is force enough to shatter its frame past reassembly, or dead ore that unmakes the ritual holding it together.',
      citation: 'Malazan Book of the Fallen — Gardens of the Moon onward', revealsWeaknessFor: ['tool'] },

    { id: 'tool_lore', title: 'Onos T’oolan', category: 'Characters',
      summary: 'Called “Tool” by those who travel with him: a T’lan Imass, once the First Sword of his kind — the greatest warrior of an undead host. Unlike the mindless dead, he keeps his honour and a deep, weary sorrow at a war without end. He does not strike without cause. Named as no enemy of the Imass, and shown the right respect, he may let a traveller pass — and even offer a warning.',
      citation: 'Malazan Book of the Fallen — Gardens of the Moon', revealsWeaknessFor: ['tool'] },

    { id: 'anomander_rake', title: 'Anomander Rake', category: 'Characters',
      summary: 'The Son of Darkness — Lord of the Tiste Andii who dwell within the floating fortress of Moon’s Spawn. He is Soletaken, and the form he takes is a vast black dragon. His warren is Kurald Galain, the elder realm of Darkness, and at his hip hangs Dragnipur, a sword that chains the souls it slays to an endless march. He is among the oldest and most powerful beings still walking, weary with the weight of his own choices. He is not a foe a mortal defeats. The wise do not draw a blade before him; they show respect and hope he has no quarrel with them.',
      citation: 'Malazan Book of the Fallen — Gardens of the Moon', revealsWeaknessFor: ['rake'] },

    { id: 'kurald_galain', title: 'Kurald Galain', category: 'Magic',
      summary: 'The elder warren of Darkness — oldest of the Tiste aspects and the birthright of the Tiste Andii. It is not a fire or an ice you can answer in kind; it is the dark that was before light. Against a true master of Kurald Galain, mortal sorcery is a candle raised against the night.',
      citation: 'Malazan Book of the Fallen — the Tiste Andii', revealsWeaknessFor: ['rake'] },

    { id: 'dragnipur', title: 'Dragnipur', category: 'Powers',
      summary: 'The black-bladed sword carried by Anomander Rake. Those it slays are not merely killed: their souls are bound to haul a vast wagon through a realm of encroaching Chaos, without rest or end. To face its wielder and imagine victory is to misunderstand the danger entirely.',
      citation: 'Malazan Book of the Fallen — Gardens of the Moon onward', revealsWeaknessFor: ['rake'] },

    { id: 'kruppe', title: 'Kruppe', category: 'Characters',
      summary: 'A stout, self-delighting fixture of the great city of Darujhistan, forever narrating his own life as a tale in which he is the hero. He dresses cunning as foolishness and schemes as flattery; beneath the crumbs and grand words is a mind touched by luck and by dreams, and a friend worth far more than he appears. He does not fight. He talks — and it is usually wiser to listen.',
      citation: 'Malazan Book of the Fallen — Gardens of the Moon', revealsWeaknessFor: ['kruppe'] },

    { id: 'tellann', title: 'Tellann — the Fire Warren', category: 'Magic',
      summary: 'The fire-aspected warren bound up with the T’lan Imass and their ritual. As a weapon it excels where a whole mass must be burned at once — the one sure answer to a swarm — but against a foe whose nature is fire, or one that already survived the ritual’s flames, it is the wrong tool.',
      citation: 'Malazan Book of the Fallen — associated with the T’lan Imass', revealsWeaknessFor: ['gryllen'] },

    { id: 'omtose', title: 'Omtose Phellack — the Ice Warren', category: 'Magic',
      summary: 'The elder warren of the Jaghut: cold, stillness, and the weight of ages. Ice against fire is the oldest opposition there is — though not every foe is a creature of flame, and against the truly ancient it may be no answer at all.',
      citation: 'Malazan Book of the Fallen — the Jaghut and Omtose Phellack', revealsWeaknessFor: [] },

    { id: 'otataral', title: 'Otataral', category: 'Anti-Magic',
      summary: 'A reddish dead ore that negates sorcery. Near it, warrens close and magic simply stops. It can strip a mage of power or unmake a ritual of undeath — but it does not discriminate. Otataral smothers your magic as surely as your enemy’s, and against a foe of pure elder power it is a thin comfort.',
      citation: 'Malazan Book of the Fallen — Deadhouse Gates (the otataral mines)', revealsWeaknessFor: ['tool'] },

    { id: 'ascendants', title: 'Ascendants & Gods', category: 'Powers',
      summary: 'Beings who have risen to great power; some become gods, bound to an aspect or a role they can never fully set aside. You do not defeat such things by matching strength. You survive them by understanding what they are — and sometimes the wisest use of that understanding is to recognize a fight you must never begin.',
      citation: 'Malazan Book of the Fallen — a central theme across the series', revealsWeaknessFor: ['rake'] },
  ],

  // ---- Scenario: a LINEAR, turn-based journey ---------------------------
  // The road runs one way. Between encounters you rest (and heal). What you
  // learn from each foe is written into a Codex that starts empty — and the
  // next encounter builds on it.
  scenario: {
    id: 'scenario1',
    title: 'The Barrows of Morn',
    scenes: [
      { type: 'narration', title: 'The Road to Morn',
        text: 'You are no one of consequence, walking a road you should perhaps have left alone. The Barrows of Morn lie ahead — old ground, and ill-famed. You carry a blade, a little sorcery, and no illusions about your own importance. Where the road forks, a round little man is already waving you over.' },
      { type: 'encounter', enemy: 'kruppe' },

      { type: 'narration', title: 'The Wind-Scoured Ridge',
        text: 'The road climbs to a bare ridge where the wind makes a sound like water over stones. You rest a moment, and gather yourself. Then the ground ahead begins, impossibly, to move toward you.' },
      { type: 'encounter', enemy: 'gryllen' },

      { type: 'narration', title: 'The Barrows',
        text: 'Beyond the ridge lie the barrows themselves — grass-grown mounds, silent under a low sky. You catch your breath among them. One mound has been open a very long time, and something within it is rising.' },
      { type: 'encounter', enemy: 'tool' },

      { type: 'narration', title: 'The Grey Shore',
        text: 'The land falls away to a shore of black sand and grey water. You steady yourself for whatever waits below. A single robed figure stands at the waterline, patient as stone — and as you descend, it turns to face you.' },
      { type: 'encounter', enemy: 'rake' },
    ],
  },
};
