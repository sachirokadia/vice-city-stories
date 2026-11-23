# WS5 — Natural Gameplay Checklist: Missions 2.1 and 2.4

**Purpose:** exact human-playtest instructions for the two story missions that
remain unverified through genuine natural gameplay. A real human playthrough
must be performed with ordinary gameplay input on the live production build.

**Labels (never mix them):**
- **NATURAL** — ordinary player gameplay, no shortcuts of any kind.
- **ASSISTED** — any teleportation, direct state manipulation, debug shortcut
  or altered game condition.
- **BLOCKED** — the test could not be completed.

**You cannot claim a human playthrough passed unless the user actually
performs it and provides the result.** This document records the test as
BLOCKED until that happens.

---

## Shared setup

**Build:** live production, https://vice-city-stories-sigma.vercel.app/
(production commit `f199a42`, bundle `index-5UWogofC.js` — verify the bundle
in the page source before starting; the old `index-jLcIAx51.js` must 404).

**Starting state:** a fresh save (clear site data first, or use a fresh
browser profile). Cash $0, no missions complete, Chapter 1, no story
mission selected. The game default.

**Controls (keyboard + mouse):**
- Move: **W A S D** (hold W to run forward; **Shift** to sprint)
- Look: **mouse drag**
- Interact / enter vehicle: **E** (press once when the prompt shows)
- Fire weapon: **left-click** · Reload: **R** · Switch weapon: **Q**
- Surrender (when prompted): **F** or the SURRENDER button
- Pause: **Esc** · Resume: **Esc** or the Resume button
- Mission board: top-bar list icon · Story board: top-bar book icon

**Evidence to capture for each mission:** a screenshot or short recording
at every objective change, the mission-complete screen, and the cash total
before/after. Note the real time taken and the frame rate you experienced.

**Forbidden during a NATURAL run:** teleporting, `setHeat(0)` or any
console/engine manipulation, save editing, forcing mission completion,
setting flags, changing cash/inventory, disabling timers, debug shortcuts.
If any of these happen, the run is ASSISTED, not NATURAL — record it as such.

---

## Mission 2.1 — TAIL SPIN

**Status: BLOCKED — no human playthrough yet.**

### Prerequisites (all must be genuinely completed in order)

1. **1.1 FIRST LIGHT** — meet Mara Voss at (66, 6), talk to her, drive the
   Velocity GT to Beacon Tower (0, −165). Reward $500.
2. **1.2 DOCKSIDE (static)** — meet Rico Hale at (−126, 156). Reward $600.
3. **1.3 SIGNAL LOST** — meet June Park at (−90, 60). Reward $600.

After 1.3, Chapter 2 opens and TAIL SPIN unlocks. The Story board shows
TAIL SPIN as available; its start marker is at **(62.5, −150)** on the
north avenue (teal diamond on the full map).

### Code-verified facts (no defect found)

- Unlock: `unlockAfter: 'story-signal-lost'`. Discovery radius 25 m.
- Time limit: **150 seconds** (mission timer, runs only while the mission
  is active).
- Follow rules (`MissionTriggers.evaluateFollow`): the sedan drives its
  route at ~11 m/s; the player must stay **8–35 m** behind it.
  - **Spotted:** under 8 m for 3 continuous seconds → mission fails.
  - **Lost:** over 35 m for 5 continuous seconds after first locking on
    → mission fails.
  - **Done:** the sedan covers its **500 m** route while the player is
    inside the band.
- The sedan stops at red lights and turns at intersections; the player
  GT (top speed ~137 km/h) can keep up easily. The 8–35 m band is
  generous at real frame rates.
- No code defect was found in the unlock chain, triggers, objectives,
  vehicles, timers or completion conditions. The earlier headless
  failure was a test-environment limitation (simulation running at ~3%
  of real time, harness steering), not a game defect — see the WS1
  report. Do not modify mission difficulty, vehicle speeds or timers
  to compensate.

### Natural steps

1. From the Story board, select TAIL SPIN, then walk/drive to the teal
   marker at (62.5, −150) until the mission becomes available.
2. **Objective 1 — Find Vic Marino.** Walk to the marker. (Radius 4 m.)
3. **Objective 2 — Talk to Vic Marino.** Press **E**. A short cinematic
   plays first (`cine-tail-spin`, Vic at the marker), then Vic's dialogue.
   Choose the accept line. The mission becomes active; the 150 s timer
   starts.
4. **Objective 3 — Get in a car.** Get into the Velocity GT (or any car
   you own) with **E**. The GT spawns at (0, −2) by Sunset Garage.
5. **Objective 4 — Follow the sedan to the warehouse.** Drive behind the
   sedan. Keep the gap **between 8 and 35 metres** — the HUD shows the
   distance and warns you ("Stay 8–35m behind the sedan — too close and
   he spots you, too far and you lose him"). Do not ram it, do not drop
   back. Expect the drive to take roughly 45–60 seconds of driving.
6. **Objective 5 — Reach the warehouse yard.** Once the sedan finishes
   its route, drive into the yard at (120, −150) (radius 12 m).

### Expected completion state

- Mission-complete screen: **TAIL SPIN — $1,000**.
- Cash increases by exactly $1,000.
- Flag `warehouse-found` set; **2.2 HOLD THE LINE unlocks**.
- Story board: TAIL SPIN completed; Chapter 2 progress 1/4.

### Prior evidence (ASSISTED — not natural)

- WS1 campaign run (2026-11-22, Phase 1 build): TAIL SPIN completed with
  a harness rescue — `debugSetFollowTravelled(500)` plus a teleport to
  15 m behind the sedan when the gap had grown to 40.9 m. Cash 5,000 →
  6,000. Labelled **assisted objective-transition verification** in
  `docs/ws1-campaign-regression-report.md`. It proves the completion,
  reward and unlock logic work; it does NOT prove natural drivability.
- Cloud-browser attempt (2026-11-23): BLOCKED before reaching the
  mission — the browser ran at 4–5 FPS with tap-only keys and could not
  complete the prerequisite BEACON RUN job in its 60 s window. That
  attempt is **not** a pass or a fail for TAIL SPIN; it never reached it.

### Actual result

| Field | Value |
|---|---|
| Tester | _pending — human playthrough required_ |
| Date / build | _pending_ |
| Result | **BLOCKED** |
| Evidence | _none yet_ |

---

## Mission 2.4 — THE LONG WAY OUT

**Status: BLOCKED — no human playthrough yet. Locked behind 2.1.**

### Prerequisites (all must be genuinely completed in order)

1. **2.1 TAIL SPIN** (above). Reward $1,000.
2. **2.2 HOLD THE LINE** — defend the beach beacon at (165, 0) through
   3 waves. Reward $1,200 + crew-jacket outfit.
3. **2.3 DOCKSIDE TROUBLE** — Rook's job at the dockside; the dialogue
   choice (accept $200 now, or refuse and get the dead-drop tip) sets
   exactly one flag. Reward $800 on completion either way.

After 2.3, THE LONG WAY OUT unlocks. The Story board shows it as
available; its start marker is at **(−6, 30)** (teal diamond on the
full map).

### Code-verified facts (no defect found)

- Unlock: `unlockAfter: 'story-dockside-trouble'`. Discovery radius 25 m.
- Time limit: **180 seconds**. Reward: **$1,500**. Sets flag `vera-lied`.
- **Start heat: 45 (wanted level 3)** — the police are already after you
  when the mission starts. The outro cinematic `cine-chapter2-outro`
  plays after completion; Chapter 3 then unlocks.
- Evade rules (`MissionTriggers.evaluateTrigger`, `Wanted` state machine):
  the evade objective completes when the **wanted level reaches 0**.
  - While any police unit can see you: PURSUIT (heat does not fall).
  - After **6 seconds unseen**: SEARCH — police drive to your last
    known spot and look around. Heat falls 1.5/s.
  - The escape timer is **14 + 4 × level** seconds — at level 3, **26
    seconds** unseen. If a unit re-spots you, the timer resets.
  - The HUD hint reads: "Wanted level N — break line of sight to lose
    the tail" / "The heat is off — hold on".
- The mission timer (180 s) comfortably covers the natural sequence:
  find + talk (~30 s), drive to the hideout (~20 s), then 6 s unseen +
  26 s search (~32 s). No defect found in the escape, wanted-level,
  vehicle or completion logic. The WS1 headless run's evade timeout was
  a re-detection (a police unit spotted the player at escape progress
  0.87 and reset the timer) — the mechanic working as designed, not a
  defect. Do not use `setHeat(0)` and call the result natural.

### Natural steps

1. From the Story board, select THE LONG WAY OUT, then go to the teal
   marker at (−6, 30) until the mission becomes available.
2. **Objective 1 — Find Dana Cole.** Walk to the marker. (Radius 4 m.)
3. **Objective 2 — Talk to Dana Cole.** Press **E**. A short cinematic
   plays first (`cine-long-way-out`, Dana at the marker), then Dana's
   dialogue. Choose the accept line. The mission becomes active, the
   180 s timer starts, and wanted level jumps to 3 (heat 45).
4. **Objective 3 — Reach the beach hideout.** Drive to **(180, −30)**
   on the far east beach (radius 12 m). This objective is a checkpoint:
   if the mission fails afterwards, retrying restarts here. Expect
   police pursuit on the way — drive, don't fight.
5. **Objective 4 — Lose the tail, then stay hidden until the heat dies
   down.** At the hideout, **break line of sight**: get out of every
   police unit's view (behind dunes, the lifeguard tower, or simply far
   from the road) and **stay unseen**. Watch the wanted stars and the
   escape bar in the HUD. After ~6 s unseen the status changes to
   SEARCH; after ~26 s more without being re-spotted, the heat clears
   to 0 and the objective completes. If you are spotted, the timer
   resets — hide again. Do not leave the hideout area while hiding.

### Expected completion state

- Mission-complete screen: **THE LONG WAY OUT — $1,500**.
- Cash increases by exactly $1,500.
- Flag `vera-lied` set; outro `cine-chapter2-outro` plays; **Chapter 3
  (DEAD DROP) unlocks**.
- Story board: THE LONG WAY OUT completed; Chapter 2 progress 4/4.

### Prior evidence (ASSISTED — not natural)

- WS1 campaign run (2026-11-22, Phase 1 build): THE LONG WAY OUT
  completed with two harness assists — a teleport to (150, −10) after
  the hideout drive failed headlessly, and `wanted.setHeat(0)` after the
  evade timed out on re-detection. Cash 8,000 → 9,500; outro played;
  Chapter 3 unlocked. Labelled **assisted** in
  `docs/ws1-campaign-regression-report.md`. It proves the completion,
  reward, outro and unlock logic work; it does NOT prove the natural
  escape is achievable.
- Cloud-browser attempt (2026-11-23): BLOCKED — never reached (locked
  behind 2.1/2.2/2.3).

### Actual result

| Field | Value |
|---|---|
| Tester | _pending — human playthrough required_ |
| Date / build | _pending_ |
| Result | **BLOCKED** |
| Evidence | _none yet_ |

---

## How to report back

For each mission, send: the completed checklist above with the actual
result filled in, the cash before/after, the time taken, and the
screenshots/recordings. If anything behaved differently from the
"Expected completion state" section, describe exactly what happened —
that is the most valuable evidence. If a run used any shortcut, label it
ASSISTED and say which one.
