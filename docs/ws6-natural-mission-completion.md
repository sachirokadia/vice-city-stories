# WS6 — Natural Mission Completion: Missions 2.1 and 2.4

**Purpose:** the short, player-facing checklist for the two story missions
still unverified through genuine natural gameplay. This supersedes the
setup section of `docs/ws5-natural-gameplay-checklist.md` (which still
names the old production build) — the full code-verified detail stays
there; this document is what you actually follow while playing.

**Labels (never mix them):**
- **NATURAL** — ordinary player gameplay, no shortcuts of any kind.
- **ASSISTED** — any teleportation, direct state manipulation, debug
  shortcut or altered game condition.
- **BLOCKED** — the test could not be completed.

**You cannot claim a human playthrough passed unless you actually play
it and report the result.** Both missions below are BLOCKED until then.

---

## Setup (do this first)

- **Build:** live production, https://vice-city-stories-sigma.vercel.app/
  (production `b68b7c1`, bundle `index-B9LExE1Q.js` — check the page
  source before starting; the old `index-5UWogofC.js` must 404).
- **Starting state:** a fresh save (clear site data, or a fresh browser
  profile). Cash $0, Chapter 1, no missions complete.
- **Controls:** move **W A S D** · sprint **Shift** · look **mouse drag** ·
  interact / enter car **E** · surrender **F** · pause **Esc**.
  Mission board: top-bar list icon. Story board: top-bar book icon.
- **Evidence:** a screenshot or short recording at each objective change,
  the mission-complete screen, and cash before/after. Note the time
  taken and the frame rate.
- **Forbidden in a NATURAL run:** teleporting, console/engine commands
  (`setHeat(0)` etc.), save editing, forcing completion, setting flags,
  changing cash/inventory, disabling timers, debug shortcuts. If any of
  these happen, the run is ASSISTED — say which one.

## Does the game support every step? — verified

The mission code is unchanged since WS5 (production build byte-identical,
`index-B9LExE1Q.js`, 1,198,811 B). WS5 verified from code, no defects:

- 2.1 unlocks after 1.3 SIGNAL LOST; marker (62.5, −150); 150 s timer;
  follow band 8–35 m; sedan route 500 m at ~11 m/s.
- 2.4 unlocks after 2.3 DOCKSIDE TROUBLE; marker (−6, 30); 180 s timer;
  starts at wanted level 3; evade completes at wanted level 0.
- All markers, prompts, HUD hints, timers, rewards and unlocks exist in
  the current build. No missing control, no confusing objective, no
  broken trigger was found. No game code was changed for WS6.

---

## Mission 2.1 — TAIL SPIN — **BLOCKED**

**First finish, in order:** 1.1 FIRST LIGHT (meet Mara at (66, 6), drive
to Beacon Tower) → 1.2 DOCKSIDE (meet Rico at (−126, 156)) → 1.3 SIGNAL
LOST (meet June at (−90, 60)). Then TAIL SPIN appears on the Story
board; its teal marker is at **(62.5, −150)** on the north avenue.

1. Go to the marker. **Find Vic Marino.**
2. Press **E**. A short cinematic plays, then Vic's dialogue — choose
   the accept line. The 150 s timer starts.
3. Press **E** to get in a car (the Velocity GT is by Sunset Garage).
4. **Follow the sedan.** Stay **8–35 m** behind it — the HUD shows the
   distance and warns you. Too close for 3 s and he spots you; too far
   for 5 s and you lose him. About 45–60 s of driving.
5. Drive into the warehouse yard at **(120, −150)**.

**Done when:** the screen says **TAIL SPIN — $1,000**, cash is up exactly
$1,000, and 2.2 HOLD THE LINE unlocks.

**Prior evidence (ASSISTED, not natural):** WS1 harness run completed it
with a rescue (follow distance forced to 500 m + a teleport); it proves
completion, reward and unlock logic work, not natural drivability.

| Field | Value |
|---|---|
| Tester | _pending — human playthrough required_ |
| Date / build | _pending_ |
| Result | **BLOCKED** |
| Evidence | _none yet_ |

---

## Mission 2.4 — THE LONG WAY OUT — **BLOCKED**

**First finish, in order:** 2.1 TAIL SPIN → 2.2 HOLD THE LINE (defend
the beach beacon at (165, 0), 3 waves) → 2.3 DOCKSIDE TROUBLE (Rook's
job at the dockside). Then THE LONG WAY OUT appears on the Story board;
its teal marker is at **(−6, 30)**.

1. Go to the marker. **Find Dana Cole.**
2. Press **E**. A short cinematic plays, then Dana's dialogue — choose
   the accept line. The 180 s timer starts and **wanted jumps to
   level 3** — the police are already after you.
3. Drive to the beach hideout at **(180, −30)**. Expect pursuit on the
   way — drive, don't fight.
4. **Lose the tail.** Get out of every police unit's view (behind dunes,
   the lifeguard tower, or far from the road) and **stay unseen**. After
   ~6 s unseen the status changes to SEARCH; after ~26 s more without
   being re-spotted, the heat clears to 0 and the objective completes.
   If you are spotted, the timer resets — hide again. Don't leave the
   hideout area while hiding.

**Done when:** the screen says **THE LONG WAY OUT — $1,500**, cash is up
exactly $1,500, the outro cinematic plays, and Chapter 3 (DEAD DROP)
unlocks.

**Prior evidence (ASSISTED, not natural):** WS1 harness run completed it
with two assists (a teleport + `wanted.setHeat(0)`); it proves
completion, reward, outro and unlock logic work, not the natural escape.

| Field | Value |
|---|---|
| Tester | _pending — human playthrough required_ |
| Date / build | _pending_ |
| Result | **BLOCKED** |
| Evidence | _none yet_ |

---

## How to report back

For each mission, send: this checklist with the result filled in, cash
before/after, time taken, and the screenshots/recordings. If anything
behaved differently from the "Done when" line, describe exactly what
happened — that is the most valuable evidence. If a run used any
shortcut, label it ASSISTED and say which one.
