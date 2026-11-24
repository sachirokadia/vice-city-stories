# Final campaign playthrough guide — Missions 2.1 and 2.4

**Date:** 2026-11-23 (WS7)
**Baseline:** main `80a4573` (Lena release) + WS7 fixes
**Status: BLOCKED — awaiting Sachi's natural human playthrough.**
Nothing in the code makes either mission uncompletable on default
settings; both were verified defect-free from the code except for
the two defects fixed in WS7 (see below). A result counts as
**NATURAL** only on an ordinary playthrough: no teleports, no flag
edits, no cash changes, no disabled requirements.

---

## How to reach these missions

Both missions sit behind the chapter chain — you cannot jump to
them.

- **2.1 TAIL SPIN** unlocks after **1.3 SIGNAL LOST** completes
  (`unlockAfter: 'story-signal-lost'`). Chapter 2 must be unlocked,
  which happens when all of chapter 1 completes.
- **2.4 THE LONG WAY OUT** unlocks after **2.3 DOCKSIDE TROUBLE**
  completes (`unlockAfter: 'story-dockside-trouble'`).
  The chain is 2.1 → 2.2 HOLD THE LINE → 2.3 → 2.4, so 2.1 gates
  the entire rest of the campaign and 2.4 gates chapter 3.

Neither mission starts by itself: completing 1.3 / 2.3 does **not**
auto-select the next mission. Open **Pause → Story**, select the
mission, then walk into its teal discovery marker (25 m radius).
The first objective (find the giver) completes on proximity; press
**E** to talk. The intro cinematic plays first, then the dialogue;
the mission accepts when the dialogue ends. The timer starts only
then — not during the cinematic or the conversation.

## Controls

W/A/S/D move and drive · Shift sprint (10.5 u/s on foot) · E
interact / enter-exit car / talk · F surrender (only when the
arrest prompt shows) · Space handbrake · P pause (Pause Hub →
Story board, Map, Settings). Do not press F during 2.4 unless you
intend to fail — surrendering leads to BUSTED.

## Before you start

The Velocity GT parked at spawn is the fastest option; any owned
car works (all are 32–42 u/s; the sedan in 2.1 does 11 u/s). Cash,
vehicle and flags gate neither mission.

---

## 2.1 TAIL SPIN — "Follow the sedan to the warehouse"

**Giver:** Vic Marino · **Timer:** 150 s · **Reward:** $1,000 ·
**Sets flag:** `warehouse-found` · **Unlocks:** 2.2 HOLD THE LINE

1. **Drive the GT north** up avenue x=60 to Vic at (62.5, −150) —
   the teal diamond marker. Do not walk; it is ~160 m from spawn.
2. **Get out (E), walk to Vic, press E.** Watch the intro
   cinematic, then talk through the dialogue. The 150-second timer
   starts only when the dialogue ends and the mission accepts.
3. **Get back in a car (E).** Any car counts — the one you parked
   by Vic is fine. (WS7 fixed the marker: it used to point back to
   spawn even though any car works.)
4. **Follow the teal sedan with the purple beacon.** Stay **8–35 m**
   behind it — the HUD tells you the band. Closer than 8 m for 3
   seconds and he spots you (fail); farther than 35 m for 5 seconds
   after you have locked on and you lose him (fail). Feather the
   throttle; the sedan does 11 u/s and stops at red lights, so brake
   when it stops. The marker follows the sedan, not the destination.
5. **When the sedan has driven its route** (500 units), drive to the
   warehouse yard at (120, −150), inside the 12 m marker. Mission
   complete: **+$1,000**, flag `warehouse-found`, and 2.2 unlocks.
6. **Success looks like:** the mission-complete screen, cash
   +$1,000, and HOLD THE LINE appearing unlocked on the Story
   board. **Capture:** a screenshot of the complete screen and your
   cash before/after.
7. **Troubleshooting:** spotted → you were under 8 m too long; hang
   back and use the distance readout. Lost → you fell behind; the
   marker tracks the sedan, catch up before its route ends. Timer
   out → drive to Vic instead of walking, and don't wait around
   after accepting. There is no checkpoint in this mission — a fail
   restarts it from the beginning.

**Timing budget (from the code):** ~60–100 s of the 150 s — enter
car ~5–10 s, follow ~45 s at 11 u/s plus red-light stops (each red
costs at most ~5 s), then 10–20 s to the warehouse yard. On foot
you cannot keep up (sprint 10.5 u/s vs sedan 11 u/s).

---

## 2.4 THE LONG WAY OUT — "Reach the beach hideout, then lose the tail"

**Giver:** Dana Cole · **Timer:** 180 s · **Reward:** $1,500 ·
**Sets flag:** `vera-lied` · **Unlocks:** 3.1 DEAD DROP + chapter 3
(chapter-2 outro cinematic plays from the complete screen)

1. **Go to Dana at (−6, 30)** — just south of spawn, roadside.
   Walk or drive. Press E, watch the cinematic, finish the
   dialogue. **The moment you accept, police heat jumps to level 3
   (45)** — two pursuers plus roadblocks. The 180-second timer
   starts here.
2. **Drive east to the beach hideout at (180, −30).** Head east
   along the streets; expect a roadblock on the road ahead — drive
   around it or through it (it dissolves when you get close and its
   units join the pursuit). Don't speed over 28 u/s for more than 2
   seconds, don't hit cars or pedestrians, don't run red lights —
   every offence adds heat and restarts your escape clock.
3. **At the hideout, get out of sight and stay hidden.** You need
   ~32 seconds unseen: 6 seconds until police switch to searching,
   then 26 seconds of searching without being spotted. The hideout
   sits off the road network (~60 m east of the easternmost road,
   just outside the normal 55 m sight range), so police cars can
   only search the nearby roads. Stay put, don't move, don't commit
   offences.
4. **When the heat hits zero the mission completes instantly** — you
   don't need to be at the hideout for this part, just unseen.
   Mission complete: **+$1,500**, flag `vera-lied`, chapter 3
   unlocks, and the chapter-2 outro cinematic plays.
5. **Success looks like:** the complete screen, cash +$1,500, the
   outro cinematic, and 3.1 DEAD DROP unlocked on the Story board.
   **Capture:** the complete screen and cash before/after.
6. **Troubleshooting:** busted → you were caught (prompt at ≤7 m
   on foot, or boxed in while stopped in the car). Retry from the
   start and drive straight to the hideout. Heat not dropping → a
   police unit still sees you; move farther from the roads or behind
   a building until the wanted indicator switches to searching.
   Timer out → you spent too long before hiding; drive directly east
   and don't fight the police.

**Wanted math (from the code):** heat 45 = level 3; escape takes
26 s at level 3 after 6 s unseen, so ~32 s minimum. Offences
during the escape add heat (speeding >28 u/s for 2 s: +8; red
light: +8; hitting an AI car: +12; hitting a pedestrian: +25) and
being seen again resets the whole 6 + 26 s clock. Level 3 fields 2
pursuers plus roadblocks. The hideout has a checkpoint: if you fail
after reaching it, "Retry from checkpoint" puts you back at the
hideout with the heat re-applied — you must still evade.

**Timing budget (from the code):** ~45–60 s of the 180 s — drive to
the hideout 10–20 s in the GT, then ≥32 s hiding. Generous.

---

## WS7 fixes that change what you will see

- **2.4 busted-retry bypass — FIXED (P1).** Before WS7, getting
  busted and choosing "Retry from checkpoint" (or full Retry)
  restored the evade objective with heat already at 0, so the
  mission completed instantly without any evasion. Both retry
  paths now re-apply the mission's heat, so a retry still has to
  evade. If you are busted and retry, expect real police heat —
  that is the fix working, not a new bug.
- **2.1 enter-car marker — FIXED (P3).** The marker used to point
  back to spawn (0, −2) even though any car works. It now stays at
  Vic, where you already are.

## Known limitations of this guide

- **Hard difficulty:** on hard, police sight range is 65 m; a unit
  on the easternmost road (~60 m from the hideout) could keep you
  "seen", so the 6 s unseen timer might never start. Default
  difficulty is normal (55 m), where the hideout is outside sight
  range. This guide assumes default difficulty.
- **2.1 has no checkpoint.** A fail at the end of the tail restarts
  the whole 150 s mission. Annoying, not blocking.
- **The evade objective ignores location.** Once heat is 0 the
  mission completes anywhere — the hideout is only required for the
  preceding reach objective. The mission is easier than its text
  suggests, not harder.
- **Manual board selection required.** Completing 1.3/2.3 does not
  auto-select the next mission; you must open Pause → Story and
  select it, or the discovery never runs.
