/**
 * Story dialogue data — Phase 9C.
 *
 * Data is data, presentation is presentation: this file holds
 * plain dialogue graphs (no React, no Three.js). The runtime
 * lives in Dialogue.ts, the panel in DialoguePanel.tsx. A
 * writer adds or changes a conversation here without touching
 * the engine or the UI.
 *
 * The shape follows the 9A proposal (§4.2). A dialogue is a
 * graph of nodes; each node is one beat. A node with `choices`
 * waits for the player to pick; a node with `next` advances on
 * Continue; a node with `end: true` ends the dialogue. A node
 * with a `condition` is skipped (its `next` is followed) when
 * the flag is not set; a choice with a `condition` is hidden
 * until the flag is set. Events fire when the node is entered
 * (node event) or when the choice is picked (choice event, and
 * `setsFlag` first).
 *
 * Writing rules (9A §4.6): every line is one or two sentences;
 * Kai's choices are dry and short; no choice is a trap — a
 * choice changes a flag, a line, or nothing at all, never the
 * mission outcome; every dialogue has exactly one end node,
 * and the end node fires the event that lets the mission
 * continue (`completeObjective` for a dialogue objective).
 *
 * Flags set by Chapter 1 choices are conversational only:
 * `mara-asked-package` and `rico-asked-watcher` change two
 * flavour lines in June's dialogue (1.3) and nothing else.
 * Progression flags (`mara-trust`, `package-was-wrong`,
 * `ledger-found`, `june-trust`) are still set only by mission
 * completion, never by dialogue.
 *
 * Chapter 2–3 choices are consequential (9E), not flavour:
 * Rook's job (`took-rooks-job` / `refused-rook`, exactly one,
 * a replay can change it) gates 3.1's distance display and
 * changes Rook's closing lines; the finale choice sets exactly
 * one ending flag (`ending-mara` / `ending-june`) and the
 * campaign maps the surviving flag to the saved ending.
 */

import { STORY_CHARACTERS } from './StoryCharacters';

export type DialogueEvent =
  | { type: 'setFlag'; flag: string; value?: boolean }
  | { type: 'giveCash'; amount: number }
  | { type: 'startStoryMission'; missionId: string }
  | { type: 'completeObjective'; objectiveId: string }
  | { type: 'setWanted'; heat: number };

export interface DialogueChoice {
  /** The player's line, in Kai's voice. */
  text: string;
  /** Node id to go to when this choice is picked. */
  next: string;
  /** Only shown when this campaign flag is set. */
  condition?: string;
  /** Fired when this choice is picked (after setsFlag). */
  event?: DialogueEvent;
  /** Campaign flag set by picking this choice. */
  setsFlag?: string;
}

export interface DialogueLine {
  /** Unique within the dialogue, e.g. 'mara-intro-2'. */
  id: string;
  /** Speaker id, resolved through StoryCharacters.ts. */
  speaker: string;
  /** The line, plain text, one or two sentences. */
  text: string;
  /** When present, the player picks; when absent, Continue. */
  choices?: DialogueChoice[];
  /** Node id to go to when there are no choices. */
  next?: string;
  /** Flag that must be set for this node to be shown; when
   * unset, the node is skipped and its `next` is followed. */
  condition?: string;
  /** Fired when this node is entered. */
  event?: DialogueEvent;
  /** This node ends the dialogue. */
  end?: boolean;
}

export interface DialogueDef {
  id: string;
  /** Node id the conversation starts at. */
  start: string;
  nodes: DialogueLine[];
}

/** 1.1 FIRST LIGHT — Mara Voss introduces the package. */
export const MARA_FIRST_LIGHT: DialogueDef = {
  id: 'mara-first-light',
  start: 'm1',
  nodes: [
    {
      id: 'm1',
      speaker: 'mara',
      text: "Kai. You're on time for once. This package goes to Beacon Tower, and it goes now.",
      next: 'm2',
    },
    {
      id: 'm2',
      speaker: 'mara',
      text: "Sixty seconds. The tower keeper signs for it — nobody else. Don't stop for anyone.",
      choices: [
        { text: "Sixty seconds? What's the rush?", next: 'm3a' },
        {
          text: "What's in the package?",
          next: 'm3b',
          setsFlag: 'mara-asked-package',
        },
        { text: 'Tower. Sixty seconds. Got it.', next: 'm4' },
      ],
    },
    {
      id: 'm3a',
      speaker: 'mara',
      text: "The rush is the job. Ask me again when it's delivered.",
      next: 'm4',
    },
    {
      id: 'm3b',
      speaker: 'mara',
      text: "You know my rule, Kai. You don't open it, you don't ask. That's why I hire you.",
      next: 'm4',
    },
    {
      id: 'm4',
      speaker: 'mara',
      text: "Go. The light's good and the road's clear. Don't make me regret the rate.",
      end: true,
      event: { type: 'completeObjective', objectiveId: 'talk-mara' },
    },
  ],
};

/** 1.2 DOCKSIDE STATIC — Rico Hale and the watched crate. */
export const RICO_DOCKSIDE_STATIC: DialogueDef = {
  id: 'rico-dockside-static',
  start: 'r1',
  nodes: [
    {
      id: 'r1',
      speaker: 'rico',
      text: "Kai. There's the crate, there's the beach, and there's a forklift that hates me. In that order.",
      next: 'r2',
    },
    {
      id: 'r2',
      speaker: 'rico',
      text: "Same package as the tower run. Only this time it's going to the beach, and somebody's been watching the dock all night.",
      choices: [
        {
          text: 'Watching? Who?',
          next: 'r3a',
          setsFlag: 'rico-asked-watcher',
        },
        { text: 'Same package? I delivered that already.', next: 'r3b' },
        { text: 'Crate. Beach. No questions.', next: 'r4' },
      ],
    },
    {
      id: 'r3a',
      speaker: 'rico',
      text: "If I knew who, I'd have told Mara. Keep your eyes on the mirrors, not the crate.",
      next: 'r4',
    },
    {
      id: 'r3b',
      speaker: 'rico',
      text: "Then you know what it weighs, and you know it isn't paperwork. Don't open it.",
      next: 'r4',
    },
    {
      id: 'r4',
      speaker: 'rico',
      text: 'Beach, hideout — lose the tail first — then lie low till the heat dies. And Kai — if the crate talks, you didn\u2019t hear it.',
      end: true,
      event: { type: 'completeObjective', objectiveId: 'talk-rico' },
    },
  ],
};

/** 1.3 SIGNAL LOST — June Park and the three clues. Two
 * flavour lines appear only when the player asked the right
 * questions in 1.1 / 1.2; the main path never depends on them. */
export const JUNE_SIGNAL_LOST: DialogueDef = {
  id: 'june-signal-lost',
  start: 'j1',
  nodes: [
    {
      id: 'j1',
      speaker: 'june',
      text: 'Kai Reyes. Three clues, three landmarks, one source who stopped answering. You\u2019re the second pair of eyes.',
      next: 'j2',
    },
    {
      id: 'j2',
      speaker: 'june',
      text: 'My source left them for us — east park, the boardwalk, the tower. Each one says a little more than the last.',
      choices: [
        {
          text: 'Your source went quiet. Are they safe?',
          next: 'j3a',
        },
        { text: 'What am I actually looking for?', next: 'j3b' },
        { text: "Three clues. I'll find them.", next: 'j4' },
      ],
    },
    {
      id: 'j3a',
      speaker: 'june',
      text: "I don't know. That's the point of the clues — they tell me if he ran, or if he was bought.",
      next: 'j4',
    },
    {
      id: 'j3b',
      speaker: 'june',
      text: 'Paper. Ink. Names. The kind of names that get docks sold and people disappeared.',
      next: 'j4',
    },
    {
      id: 'j4',
      speaker: 'june',
      text: "Mara told me you asked what's in the package. Good. You're asking the right questions.",
      condition: 'mara-asked-package',
      next: 'j4b',
    },
    {
      id: 'j4b',
      speaker: 'june',
      text: "Rico says someone watched the dock all night. That means we're not the only ones reading these clues.",
      condition: 'rico-asked-watcher',
      next: 'j5',
    },
    {
      id: 'j5',
      speaker: 'june',
      text: "Bring me all three and they'll point to where the ledger is. Go — the van's the only address I trust right now.",
      end: true,
      event: { type: 'completeObjective', objectiveId: 'talk-june' },
    },
  ],
};

/**
 * The short exchange inside the SIGNAL LOST cinematic (9D,
 * Pattern B: dialogue during a shot). Narrative-only — its end
 * node sets a flavour flag, never a mission event. The mission
 * accept stays in `june-signal-lost`, which opens after the
 * cinematic ends, so skipping the cinematic skips this
 * conversation and nothing else.
 */
export const JUNE_CINE_SIGNAL_LOST: DialogueDef = {
  id: 'june-cine-signal-lost',
  start: 'c1',
  nodes: [
    {
      id: 'c1',
      speaker: 'june',
      text: 'My source left the clues where the city can\u2019t see them. Parks, boardwalks, towers — places people walk past.',
      next: 'c2',
    },
    {
      id: 'c2',
      speaker: 'june',
      text: 'Find all three, and I\u2019ll know what the package really is.',
      end: true,
      event: { type: 'setFlag', flag: 'june-cine-seen', value: true },
    },
  ],
};

// ==========================================================================
// Chapter 2 — Two Crews, One City (9E)
// ==========================================================================

/** 2.1 TAIL SPIN — Vic Marino and the sedan that needs following.
 * Sana's warning about Vera is delivered here: it opens Chapter 2. */
export const VIC_TAIL_SPIN: DialogueDef = {
  id: 'vic-tail-spin',
  start: 'v1',
  nodes: [
    {
      id: 'v1',
      speaker: 'vic',
      text: "Kai Reyes. Sana at the food truck says Vera's been asking about you — she hears everything before the docks do.",
      next: 'v2',
    },
    {
      id: 'v2',
      speaker: 'vic',
      text: "There's a sedan on this avenue, teal, purple light on the roof. Follow it. Find out where it sleeps.",
      choices: [
        { text: "Whose sedan is it?", next: 'v3a' },
        { text: 'How close can I get?', next: 'v3b' },
        { text: "Sedan. Avenue. Follow it. Got it.", next: 'v4' },
      ],
    },
    {
      id: 'v3a',
      speaker: 'vic',
      text: "Vera's. Or one of hers. That's the whole point of following it — I want to know, not guess.",
      next: 'v4',
    },
    {
      id: 'v3b',
      speaker: 'vic',
      text: 'Close enough to read the plate, far enough that he forgets you exist. Crowd him and he runs. Lose him and I learn nothing.',
      next: 'v4',
    },
    {
      id: 'v4',
      speaker: 'vic',
      text: "Warehouse yard, north end. He stops there or he doesn't stop anywhere. Bring me the address, not the car.",
      end: true,
      event: { type: 'completeObjective', objectiveId: 'talk-vic' },
    },
  ],
};

/** 2.2 HOLD THE LINE — Mara calls from her office while the
 * crew moves on the beach. A phone call: no cinematic, no
 * staged character, just her voice. */
export const MARA_HOLD_LINE: DialogueDef = {
  id: 'mara-hold-line',
  start: 'h1',
  nodes: [
    {
      id: 'h1',
      speaker: 'mara',
      text: "Kai, it's Mara. Northgate is coming for the beach stash, and they're coming now. The beacon is all that stands between them and it.",
      next: 'h2',
    },
    {
      id: 'h2',
      speaker: 'mara',
      text: 'Three waves, if my count is right. You hold that beacon, I hold the rest. You lose it, we lose the beach.',
      choices: [
        { text: 'Three waves? Against me?', next: 'h3a' },
        { text: "What's in the stash?", next: 'h3b' },
        { text: 'Beacon stands. Go.', next: 'h4' },
      ],
    },
    {
      id: 'h3a',
      speaker: 'mara',
      text: 'Against you, the beacon, and the tide. The tide is on our side. Probably.',
      next: 'h4',
    },
    {
      id: 'h3b',
      speaker: 'mara',
      text: "The same thing that's in everything lately: paper that should have stayed buried. Hold the line, Kai.",
      next: 'h4',
    },
    {
      id: 'h4',
      speaker: 'mara',
      text: 'They come from the sand and the road. Use the cover. Call me when the beach is quiet.',
      end: true,
      event: { type: 'completeObjective', objectiveId: 'talk-mara-beach' },
    },
  ],
};

/** 2.2 closing — Mara after the defense, and the crew jacket. */
export const MARA_HOLD_LINE_AFTER: DialogueDef = {
  id: 'mara-hold-line-after',
  start: 'a1',
  nodes: [
    {
      id: 'a1',
      speaker: 'mara',
      text: 'Beacon\u2019s still standing. The beach is still ours. You did that, Kai.',
      next: 'a2',
    },
    {
      id: 'a2',
      speaker: 'mara',
      text: "Word travels fast on the docks. Wear the jacket — the crew will know you held the line. And Kai: Vera's people were watching the beach tonight.",
      choices: [
        { text: "Watching the beach, or watching me?", next: 'a3a' },
        { text: "The jacket's mine? I'll wear it.", next: 'a3b' },
        { text: 'Let them watch.', next: 'a4' },
      ],
    },
    {
      id: 'a3a',
      speaker: 'mara',
      text: "Both. That's why the jacket matters — it says you're not alone out there.",
      next: 'a4',
    },
    {
      id: 'a3b',
      speaker: 'mara',
      text: "It's yours. You earned it standing on that sand.",
      next: 'a4',
    },
    {
      id: 'a4',
      speaker: 'mara',
      text: 'Get off the beach. Rook\u2019s been asking for you — and Rook only asks when there\u2019s money in it.',
      end: true,
      event: { type: 'completeObjective', objectiveId: 'talk-mara-after' },
    },
  ],
};

/** 2.3 DOCKSIDE TROUBLE — Rook Calloway and the choice.
 * Taking the job pays $200 on the spot (a node event on the
 * "take it" branch) and sets `took-rooks-job`; refusing sets
 * `refused-rook` and earns a tip instead. The choice event
 * clears the other flag, so exactly one is ever set — and a
 * replay can change the answer. Skipping is refused at the
 * choice node, so the decision cannot be skipped past. */
export const ROOK_DOCKSIDE_TROUBLE: DialogueDef = {
  id: 'rook-dockside-trouble',
  start: 'k1',
  nodes: [
    {
      id: 'k1',
      speaker: 'rook',
      text: "Kai Reyes. Three of Northgate's finest are on my docks, and I don't do evictions for free. But you might.",
      next: 'k2',
    },
    {
      id: 'k2',
      speaker: 'rook',
      text: "Here's the deal. You clear them, I pay you — two hundred now, the rest when the docks are quiet. Or you walk, and I owe you nothing.",
      choices: [
        {
          text: "Two hundred now. I'm in.",
          next: 'k3a',
          setsFlag: 'took-rooks-job',
          event: { type: 'setFlag', flag: 'refused-rook', value: false },
        },
        {
          text: "Thanks, but I walk. Keep your two hundred.",
          next: 'k3b',
          setsFlag: 'refused-rook',
          event: { type: 'setFlag', flag: 'took-rooks-job', value: false },
        },
        {
          text: "Who hired them, Rook?",
          next: 'k3c',
        },
      ],
    },
    {
      id: 'k3a',
      speaker: 'rook',
      text: "There's the two hundred. Vera's money spends the same as anyone's — don't let the name slow your trigger finger.",
      next: 'k4',
      event: { type: 'giveCash', amount: 200 },
    },
    {
      id: 'k3b',
      speaker: 'rook',
      text: "Principled. Expensive hobby, principles. Fine — clear the docks anyway and I'll tell you something worth more than two hundred.",
      next: 'k4',
    },
    {
      id: 'k3c',
      speaker: 'rook',
      text: "Vera Kwan. She hires everyone twice — once to do the job, once to lie about it. Now pick a side, kid.",
      next: 'k2',
    },
    {
      id: 'k4',
      speaker: 'rook',
      text: 'Three hostiles, my crates for cover. Clear them and the docks are mine again — yours too, if you want them.',
      end: true,
      event: { type: 'completeObjective', objectiveId: 'talk-rook' },
    },
  ],
};

/** 2.3 closing — Rook after the fight. The refused branch
 * gives the dead-drop locations (3.1's distance gating); the
 * took-the-job branch names Vera and banks a favour. */
export const ROOK_DOCKSIDE_AFTER: DialogueDef = {
  id: 'rook-dockside-after',
  start: 'd1',
  nodes: [
    {
      id: 'd1',
      speaker: 'rook',
      text: 'Docks are clear. You fight like you mean it, kid. That\u2019s rarer than you think.',
      next: 'd2',
    },
    {
      id: 'd2',
      speaker: 'rook',
      text: "Here's your tip, since you walked away from my money. Three drops. West park, the garage, the tower. Don't ask who left them.",
      condition: 'refused-rook',
      next: 'd3',
    },
    {
      id: 'd3',
      speaker: 'rook',
      text: "Vera Kwan hired them. She hired me, too — same job, different lie. Remember that when she calls you, because she will.",
      condition: 'took-rooks-job',
      next: 'd4',
    },
    {
      id: 'd4',
      speaker: 'rook',
      text: 'Either way, the docks are quiet tonight. Go find Dana — she\u2019s been asking about you, and Dana only asks once.',
      end: true,
      event: { type: 'completeObjective', objectiveId: 'talk-rook-after' },
    },
  ],
};

/** 2.4 THE LONG WAY OUT — Dana Cole and the escape lesson.
 * Dana reveals that Vera set Kai up: `vera-lied` is set by
 * mission completion, but the truth lands here. */
export const DANA_LONG_WAY_OUT: DialogueDef = {
  id: 'dana-long-way-out',
  start: 'n1',
  nodes: [
    {
      id: 'n1',
      speaker: 'dana',
      text: "Kai Reyes. You drive like a courier — careful, slow, polite. Tonight you drive like someone who's being hunted. Because you are.",
      next: 'n2',
    },
    {
      id: 'n2',
      speaker: 'dana',
      text: "Brake later. Turn earlier. Don't look back. That's the whole lesson, and it costs one favour — which I'm calling in right now.",
      choices: [
        { text: 'One favour? For driving lessons?', next: 'n3a' },
        { text: 'Who set me up, Dana?', next: 'n3b' },
        { text: 'Brake later. Turn earlier. Drive.', next: 'n4' },
      ],
    },
    {
      id: 'n3a',
      speaker: 'dana',
      text: "The lesson is free. The favour is the drive. You owe me a sunrise, Kai — I'll collect when I'm ready.",
      next: 'n4',
    },
    {
      id: 'n3b',
      speaker: 'dana',
      text: 'Vera. She set up the package job, then told Northgate where to find it. You were never the courier, Kai. You were the bait.',
      next: 'n4',
    },
    {
      id: 'n4',
      speaker: 'dana',
      text: 'Beach hideout, east end. The police are already looking — lose them first, then lie low till the heat dies.',
      end: true,
      event: { type: 'completeObjective', objectiveId: 'talk-dana' },
    },
  ],
};

// ==========================================================================
// Chapter 3 — The Ledger (9E)
// ==========================================================================

/** 3.1 DEAD DROP — Milo and the three drops. The refused-Rook
 * branch gives exact locations (the HUD shows distances);
 * the took-the-job branch gives neighbourhoods only. */
export const MILO_DEAD_DROP: DialogueDef = {
  id: 'milo-dead-drop',
  start: 'o1',
  nodes: [
    {
      id: 'o1',
      speaker: 'milo',
      text: "You're Kai, right? Rook says you're the one. Three drops, three places, and I'm the only one who knows all three. Probably.",
      next: 'o2',
    },
    {
      id: 'o2',
      speaker: 'milo',
      text: "Okay, okay. West park, the garage, the tower — and the exact spots, since Rook already paid for the tip: the middle of the park, the garage door, the tower plaza. Don't make me repeat them.",
      condition: 'refused-rook',
      next: 'o3',
    },
    {
      id: 'o3',
      speaker: 'milo',
      text: "West park, the garage, the tower — somewhere in each. I know the exact spots, but Rook didn't pay me to share those. Sorry, not sorry.",
      condition: 'took-rooks-job',
      next: 'o4',
    },
    {
      id: 'o4',
      speaker: 'milo',
      text: "They're little packages, wrapped in grey. Don't open them — June gets angry when people open her mail. Go fast, I'm hungry.",
      end: true,
      event: { type: 'completeObjective', objectiveId: 'talk-milo' },
    },
  ],
};

/** 3.1 closing — Lena Ortiz patches Kai up at the boardwalk clinic. */
export const LENA_DEAD_DROP: DialogueDef = {
  id: 'lena-dead-drop',
  start: 'l1',
  nodes: [
    {
      id: 'l1',
      speaker: 'lena',
      text: 'You look like the drops found you first. Sit. Hands where I can see them — no, the other hands. The clean ones.',
      next: 'l2',
    },
    {
      id: 'l2',
      speaker: 'lena',
      text: "Three drops, no blood. You're luckier than most of the people who come through that door. June's been asking for you.",
      choices: [
        { text: 'June asked for me? What did she say?', next: 'l3a' },
        { text: "Thanks, Lena. I'm fine, really.", next: 'l3b' },
        { text: 'Just patch me up. I have a warehouse to visit.', next: 'l4' },
      ],
    },
    {
      id: 'l3a',
      speaker: 'lena',
      text: "She said the warehouse is holding something worth more than all three drops. And she said to tell you: don't go alone in your head.",
      next: 'l4',
    },
    {
      id: 'l3b',
      speaker: 'lena',
      text: "Fine is a word people use right before they fall over. You're done. Go — but walk, don't run, for an hour.",
      next: 'l4',
    },
    {
      id: 'l4',
      speaker: 'lena',
      text: 'One more thing: whatever\u2019s in that warehouse, it isn\u2019t just paper. People don\u2019t guard paper with six guns. Be careful, Kai.',
      end: true,
      event: { type: 'completeObjective', objectiveId: 'talk-lena' },
    },
  ],
};

/** 3.2 CRANE'S NEST — June and Theo. Theo gives the car:
 * finish the job and the Vortex RS is Kai's. */
export const JUNE_CRANES_NEST: DialogueDef = {
  id: 'june-cranes-nest',
  start: 'e1',
  nodes: [
    {
      id: 'e1',
      speaker: 'june',
      text: "The drops point to one place: Crane's warehouse, north end. Six hostiles, one ledger, and a man who collects both.",
      next: 'e2',
    },
    {
      id: 'e2',
      speaker: 'theo',
      text: "Six guns against one courier. So I'm lending you a car that outruns all six. The Vortex RS — fastest thing I've ever tuned.",
      next: 'e3',
    },
    {
      id: 'e3',
      speaker: 'june',
      text: 'Two groups of three. Clear them, take the ledger, and come back to this van. The ledger is the story, Kai — everything else is noise.',
      choices: [
        { text: "The car's mine if I finish?", next: 'e4a' },
        { text: "Six hostiles. What's the plan, June?", next: 'e4b' },
        { text: "Ledger. Van. Go.", next: 'e5' },
      ],
    },
    {
      id: 'e4a',
      speaker: 'theo',
      text: "Finish the job and the keys are yours. That's the deal, and I don't make deals twice.",
      next: 'e5',
    },
    {
      id: 'e4b',
      speaker: 'june',
      text: 'The plan is: you, the RS, and no hesitation. First group, then the second — they reinforce each other if you wait.',
      next: 'e5',
    },
    {
      id: 'e5',
      speaker: 'june',
      text: 'One more thing. Crane never loses. If he offers you a choice at the end — and he will — remember who sent you here.',
      end: true,
      event: { type: 'completeObjective', objectiveId: 'talk-june-2' },
    },
  ],
};

/** 3.3 SUNSET RUN — Mara sends Kai to the tower with the ledger. */
export const MARA_SUNSET_RUN: DialogueDef = {
  id: 'mara-sunset-run',
  start: 'u1',
  nodes: [
    {
      id: 'u1',
      speaker: 'mara',
      text: 'Kai. You have the ledger, and the whole city knows it. The tower, sunset, and the Vortex RS — that car was built for this run.',
      next: 'u2',
    },
    {
      id: 'u2',
      speaker: 'mara',
      text: "Seventy heat, Kai, and two minutes on the clock. The police and Northgate — everyone with a badge or a gun is looking for that car. Don't stop. Don't explain. Just drive.",
      choices: [
        { text: "Seventy heat? In the RS?", next: 'u3a' },
        { text: 'What happens at the tower?', next: 'u3b' },
        { text: 'Tower. Sunset. Driving.', next: 'u4' },
      ],
    },
    {
      id: 'u3a',
      speaker: 'mara',
      text: 'In the RS, yes. It\u2019s the only car in this city that outruns a roadblock and still has brakes left for the plaza.',
      next: 'u4',
    },
    {
      id: 'u3b',
      speaker: 'mara',
      text: "Silas Crane will be waiting. He always waits — it's his favourite move. Listen to him, Kai. Then decide for yourself.",
      next: 'u4',
    },
    {
      id: 'u4',
      speaker: 'mara',
      text: 'Go. The light\u2019s perfect and the road is yours. Whatever you decide at the tower — I\u2019ll stand by it.',
      end: true,
      event: { type: 'completeObjective', objectiveId: 'talk-mara-3' },
    },
  ],
};

/** 3.3 finale — Silas Crane, inside the finale cinematic
 * (Pattern B: the dialogue opens on the last shot). Ferris
 * gets one line, then Silas offers the choice: burn the
 * ledger with Mara, or publish it with June. The choice
 * sets exactly one ending flag and clears the other; the
 * branch closings are condition-gated on the flag the
 * choice just set. Skipping is refused at the choice node. */
export const SILAS_FINALE: DialogueDef = {
  id: 'silas-finale',
  start: 's1',
  nodes: [
    {
      id: 's1',
      speaker: 'ferris',
      text: "He's waited a long time for this ledger, Kai Reyes. Longer than you've been alive. Mind your step on the plaza.",
      next: 's2',
    },
    {
      id: 's2',
      speaker: 'silas',
      text: 'Kai Reyes. Polite of you to bring it yourself. I have two offers, and I only make them once.',
      next: 's3',
    },
    {
      id: 's3',
      speaker: 'silas',
      text: 'Give it to Mara Voss, and it burns tonight — the city keeps its secrets, and everyone keeps their jobs. Give it to June Park, and it prints tomorrow — the city learns the truth, and everyone pays for it. Choose.',
      choices: [
        {
          text: 'Give the ledger to Mara. Burn it.',
          next: 's4a',
          setsFlag: 'ending-mara',
          event: { type: 'setFlag', flag: 'ending-june', value: false },
        },
        {
          text: 'Give the ledger to June. Publish it.',
          next: 's4b',
          setsFlag: 'ending-june',
          event: { type: 'setFlag', flag: 'ending-mara', value: false },
        },
      ],
    },
    {
      id: 's4a',
      speaker: 'silas',
      text: "Then the city keeps its secrets, Kai Reyes. Mara will burn it before dawn — and you will have chosen the quiet.",
      condition: 'ending-mara',
      next: 's5',
    },
    {
      id: 's4b',
      speaker: 'silas',
      text: "Then the city learns the truth, Kai Reyes. June will print every name — and you will have chosen the noise.",
      condition: 'ending-june',
      next: 's5',
    },
    {
      id: 's5',
      speaker: 'silas',
      text: 'Either way, Kai Reyes — the ledger was never the point. You were. The city needed someone who could carry it, and it chose you.',
      end: true,
      event: { type: 'completeObjective', objectiveId: 'talk-silas' },
    },
  ],
};

export const STORY_DIALOGUES: DialogueDef[] = [
  MARA_FIRST_LIGHT,
  RICO_DOCKSIDE_STATIC,
  JUNE_SIGNAL_LOST,
  JUNE_CINE_SIGNAL_LOST,
  VIC_TAIL_SPIN,
  MARA_HOLD_LINE,
  MARA_HOLD_LINE_AFTER,
  ROOK_DOCKSIDE_TROUBLE,
  ROOK_DOCKSIDE_AFTER,
  DANA_LONG_WAY_OUT,
  MILO_DEAD_DROP,
  LENA_DEAD_DROP,
  JUNE_CRANES_NEST,
  MARA_SUNSET_RUN,
  SILAS_FINALE,
];

export function getDialogue(id: string): DialogueDef | undefined {
  return STORY_DIALOGUES.find((d) => d.id === id);
}

export interface DialogueValidation {
  errors: string[];
  warnings: string[];
}

/**
 * Build-time checker (9A §4.3): every `next` and every choice
 * target must resolve to a node in the same dialogue, every
 * dialogue must have exactly one end node that fires an event,
 * and every node must be reachable or at least resolvable.
 * The Dialogue runtime refuses to start a dialogue with
 * errors; warnings are for the writer, not the player.
 */
export function validateStoryDialogues(): DialogueValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const def of STORY_DIALOGUES) {
    const prefix = `dialogue '${def.id}'`;
    if (def.nodes.length === 0) {
      errors.push(`${prefix}: has no nodes`);
      continue;
    }
    const byId = new Map<string, DialogueLine>();
    for (const node of def.nodes) {
      if (byId.has(node.id)) {
        errors.push(`${prefix}: duplicate node id '${node.id}'`);
      }
      byId.set(node.id, node);
    }
    if (!byId.has(def.start)) {
      errors.push(`${prefix}: start node '${def.start}' does not exist`);
    }
    const ends = def.nodes.filter((n) => n.end === true);
    if (ends.length === 0) {
      errors.push(`${prefix}: has no end node`);
    } else if (ends.length > 1) {
      errors.push(
        `${prefix}: has ${ends.length} end nodes (${ends.map((n) => n.id).join(', ')}) — exactly one is allowed`,
      );
    }
    // Reachability: walk every path from the start, following
    // `next` and every choice target (conditions ignored — a
    // conditioned node is reachable when its flag is set).
    const reachable = new Set<string>();
    const stack: string[] = [def.start];
    while (stack.length > 0) {
      const id = stack.pop() as string;
      if (reachable.has(id)) continue;
      const node = byId.get(id);
      if (!node) continue;
      reachable.add(id);
      if (node.next) stack.push(node.next);
      for (const choice of node.choices ?? []) stack.push(choice.next);
    }
    for (const node of def.nodes) {
      const where = `${prefix} node '${node.id}'`;
      if (!byId.has(node.id)) continue;
      if (!STORY_CHARACTERS[node.speaker]) {
        errors.push(`${where}: unknown speaker '${node.speaker}'`);
      }
      if (node.end === true) {
        if (node.condition) {
          errors.push(`${where}: end node must not have a condition — a skipped end would strand the dialogue`);
        }
        if (node.next || (node.choices && node.choices.length > 0)) {
          errors.push(`${where}: end node must not have a next or choices`);
        }
        if (!node.event) {
          errors.push(`${where}: end node must fire an event so the mission can continue`);
        }
      } else {
        const hasNext = typeof node.next === 'string';
        const hasChoices = (node.choices?.length ?? 0) > 0;
        if (!hasNext && !hasChoices) {
          errors.push(`${where}: has no next, no choices and is not an end node — a dead end`);
        }
        if (hasNext && hasChoices) {
          errors.push(`${where}: has both a next and choices — one path only`);
        }
        if (hasNext && !byId.has(node.next as string)) {
          errors.push(`${where}: next '${node.next}' does not resolve`);
        }
      }
      for (const choice of node.choices ?? []) {
        if (!byId.has(choice.next)) {
          errors.push(`${where} choice '${choice.text}': next '${choice.next}' does not resolve`);
        }
      }
      if (!reachable.has(node.id)) {
        warnings.push(`${where}: unreachable from the start node`);
      }
    }
  }
  return { errors, warnings };
}
