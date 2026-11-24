import { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/GameEngine';
import type { DriveHudState, OutfitUiState, RangeUiState, ShopUiState } from '../game/GameEngine';
import type { EncounterState } from '../game/Encounters';
import type { CombatHudState } from '../game/Combat';
import type { WantedState } from '../game/Wanted';
import type { ArrestState } from '../game/Arrest';
import { detectQuality } from '../game/Quality';
import type { QualitySettings } from '../game/Quality';
import type { GameSettings } from '../game/Settings';
import TouchControls from './TouchControls';
import SettingsPanel from './SettingsPanel';
import BustedScreen from './BustedScreen';
import DownedScreen from './DownedScreen';
import EncounterHUD from './EncounterHUD';
import ContractHUD from './ContractHUD';
import type { ContractState } from '../game/Contracts';
import MissionHUD from './MissionHUD';
import MissionCompleteScreen from './MissionCompleteScreen';
import MissionFailedScreen from './MissionFailedScreen';
import MissionBoard from './MissionBoard';
import StoryBoard from './StoryBoard';
import StoryHUD from './StoryHUD';
import StoryCompleteScreen from './StoryCompleteScreen';
import StoryFailedScreen from './StoryFailedScreen';
import type { StoryBoardState, StoryHudState } from '../game/StoryTypes';
import DialoguePanel from './DialoguePanel';
import type { DialogueState } from '../game/Dialogue';
import CinematicOverlay from './CinematicOverlay';
import type { CinematicState } from '../game/CinematicTypes';
import GaragePanel from './GaragePanel';
import ShopPanel from './ShopPanel';
import OutfitsPanel from './OutfitsPanel';
import CollectionPanel from './CollectionPanel';
import SprintHUD from './SprintHUD';
import CombatHUD from './CombatHUD';
import RangePanel from './RangePanel';
import Minimap from './Minimap';
import FullMap from './FullMap';
import StatisticsPanel, { buildStatsSnapshot } from './StatisticsPanel';
import type { StatsSnapshot } from './StatisticsPanel';
import PauseHub from './PauseHub';
import type { SettingsSection } from './SettingsPanel';
import Toast, { type ToastData, type ToastTone } from './Toast';
import { getWeapon } from '../game/Weapons';
import { PAINT_PRICE } from '../game/GarageProgress';
import { VcIcon } from './ui/VcIcon';
import type { MissionBoardState, MissionHudState } from '../game/MissionTypes';
import type { GarageUiState, UpgradeKind } from '../game/GarageProgress';
import type { CollectibleState } from '../game/Collectibles';
import type { SprintHudState } from '../game/Sprint';

interface GameCanvasProps {
  settings: GameSettings;
  onSettingsChange: (next: GameSettings) => void;
  onExitToMenu: () => void;
}

const IS_TOUCH =
  typeof window !== 'undefined' &&
  (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);

/**
 * Full-screen 3D canvas + HUD. Rendering lives in GameEngine;
 * this component only mounts the canvas, wires the engine's
 * lifecycle to React's, and renders the overlay UI.
 */
export default function GameCanvas({ settings, onSettingsChange, onExitToMenu }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [fps, setFps] = useState(0);
  const [quality, setQuality] = useState<QualitySettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [started, setStarted] = useState(false);
  const [drive, setDrive] = useState<DriveHudState>({
    mode: 'walk',
    nearVehicle: false,
    nearGarage: false,
    nearInteractable: null,
    collectibles: { found: 0, total: 10 },
    speedKmh: 0,
    gear: 'N',
    vehicleName: 'Velocity GT',
  });
  const [wanted, setWanted] = useState<WantedState>({
    level: 0,
    heat: 0,
    status: 'clear',
    escapeProgress: 0,
    lastKnown: null,
    seen: false,
  });
  const [arrest, setArrest] = useState<ArrestState>('none');
  const [mission, setMission] = useState<MissionHudState | null>(null);
  const [board, setBoard] = useState<MissionBoardState | null>(null);
  const [showBoard, setShowBoard] = useState(false);
  const [story, setStory] = useState<StoryHudState | null>(null);
  const [storyBoard, setStoryBoard] = useState<StoryBoardState | null>(null);
  const [showStoryBoard, setShowStoryBoard] = useState(false);
  const [dialogue, setDialogue] = useState<DialogueState | null>(null);
  const [cinematic, setCinematic] = useState<CinematicState | null>(null);
  const [garage, setGarage] = useState<GarageUiState | null>(null);
  const [showGarage, setShowGarage] = useState(false);
  const [shop, setShop] = useState<ShopUiState | null>(null);
  const [showShop, setShowShop] = useState(false);
  const [outfits, setOutfits] = useState<OutfitUiState | null>(null);
  const [showOutfits, setShowOutfits] = useState(false);
  const [collection, setCollection] = useState<CollectibleState | null>(null);
  const [showCollection, setShowCollection] = useState(false);
  const [sprint, setSprint] = useState<SprintHudState | null>(null);
  const [combat, setCombat] = useState<CombatHudState | null>(null);
  const [range, setRange] = useState<RangeUiState | null>(null);
  const [showRange, setShowRange] = useState(false);
  // Group 2 (WS3): full map + statistics + the Pause Hub's
  // return-to-hub flag. `returnToHub` is true only while a panel
  // opened FROM the hub is up; closing such a panel returns to the
  // hub instead of resuming. It is never true while the hub itself
  // is visible.
  const [showMap, setShowMap] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<StatsSnapshot | null>(null);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('Graphics');
  const [returnToHub, setReturnToHub] = useState(false);
  const [downed, setDowned] = useState(false);
  const [encounters, setEncounters] = useState<EncounterState[]>([]);
  const [contracts, setContracts] = useState<ContractState[]>([]);
  // Persistent cash for the top-right HUD. No engine callback fires
  // on every cash change (shop / garage / sprint / contract rewards
  // all go through different paths), so the HUD polls the engine's
  // own getStats() once a second and only re-renders when the value
  // actually changes — this is not a per-frame update.
  const [cash, setCash] = useState(0);

  // Shared toast (Lovable Group 1): transient feedback for real game
  // outcomes only — purchase success / insufficient funds, wanted
  // level up, collectible found. The timer lives in a ref so a
  // re-render never resets the countdown; a new toast replaces the
  // old one and restarts it.
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastTimer = useRef<number | null>(null);
  const notify = (message: string, tone: ToastTone) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 3400);
  };
  // Previous wanted level / coin count, so the toast fires only on a
  // real increase (not on every ~10Hz wanted update or re-render).
  const prevWantedLevel = useRef(0);
  const prevCoinsFound = useRef(0);
  useEffect(() => {
    if (wanted.level > prevWantedLevel.current) {
      notify(
        wanted.level >= 3
          ? `Wanted level ${wanted.level} — the whole force is after you.`
          : `Wanted level ${wanted.level} — the police are on your tail.`,
        'danger',
      );
    }
    prevWantedLevel.current = wanted.level;
  }, [wanted.level]);
  useEffect(() => {
    if (drive.collectibles.found > prevCoinsFound.current) {
      notify(
        `Sun Coin found — ${drive.collectibles.found} of ${drive.collectibles.total}.`,
        'success',
      );
    }
    prevCoinsFound.current = drive.collectibles.found;
  }, [drive.collectibles.found, drive.collectibles.total]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let engine: GameEngine | null = null;
    try {
      engine = GameEngine.create(canvas, settings, {
        onReady: (q) => setQuality(q),
        onFps: (f) => setFps(f),
        onQualityChange: (q) => setQuality({ ...q }),
        onDrive: (s) => setDrive(s),
        onWanted: (s) => setWanted(s),
        onArrest: (s) => setArrest(s),
        onMission: (s) => setMission(s),
        onStory: (s) => setStory(s),
        // A dialogue pauses the game like a panel does: the
        // engine stops, and the HUD buttons, prompts and the
        // pause overlay all follow the same `paused` flag. (The
        // pause overlay itself is excluded while a dialogue is
        // open — see its condition below.) Without this, the
        // Missions button stayed clickable over the dialogue,
        // and opening the board from it resumed the engine
        // while the conversation was still running.
        onDialogue: (s) => {
          setDialogue(s);
          setPaused(s !== null);
        },
        // A cinematic keeps the engine running (the camera has
        // to move), so it does NOT set `paused` — but the HUD
        // buttons, prompts and touch controls hide all the same
        // (see `hudHidden` below), and the pause overlay is
        // excluded while one plays.
        onCinematic: (s) => {
          setCinematic(s);
        },
        onGarageEnter: () => openGarage(),
        onShopEnter: () => openShop(),
        onSprint: (s) => setSprint(s),
        onCombat: (s) => setCombat(s),
        onRangeEnter: () => openRange(),
        onDowned: (d) => setDowned(d),
        onEncounter: (s) => setEncounters(s),
        onContract: (s) => setContracts(s),
      });
      engineRef.current = engine;
      // Debug handle for automated checks (input state, position).
      (window as unknown as { __vcsEngine?: GameEngine }).__vcsEngine = engine;
      engine.start();
      // WS7: a reload mid-mission resumes at the persisted
      // checkpoint (no-op when there is no usable snapshot).
      engine.restoreSavedStoryCheckpoint();
      setStarted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The 3D engine could not start.');
    }

    // StrictMode mounts twice in dev: the cleanup below disposes
    // the first engine before the second one starts.
    return () => {
      engine?.dispose();
      engineRef.current = null;
      delete (window as unknown as { __vcsEngine?: GameEngine }).__vcsEngine;
    };
    // Engine is created once per mount, from the settings in effect
    // when Play was pressed. Later settings changes go through the
    // live setters below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistent cash for the top-right HUD (see the `cash` state
  // above): poll once a second, re-render only when it changes.
  useEffect(() => {
    const id = window.setInterval(() => {
      const engine = engineRef.current;
      if (!engine) return;
      try {
        const next = engine.getStats().cash;
        setCash((prev) => (prev === next ? prev : next));
      } catch {
        /* engine is mid-dispose — the next tick retries */
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Live-apply settings that can change mid-session.
  useEffect(() => {
    engineRef.current?.setShadows(settings.shadows);
  }, [settings.shadows]);
  useEffect(() => {
    engineRef.current?.setPedestrianCount(settings.pedestrians);
  }, [settings.pedestrians]);
  useEffect(() => {
    engineRef.current?.setTrafficDensity(settings.traffic);
  }, [settings.traffic]);
  useEffect(() => {
    engineRef.current?.setPoliceCount(settings.police);
  }, [settings.police]);
  useEffect(() => {
    engineRef.current?.setPursuitDifficulty(settings.pursuitDifficulty);
  }, [settings.pursuitDifficulty]);
  useEffect(() => {
    engineRef.current?.setWantedEnabled(settings.wantedEnabled);
  }, [settings.wantedEnabled]);
  useEffect(() => {
    engineRef.current?.setInvertY(settings.invertY);
  }, [settings.invertY]);
  // Graphics preset applies immediately now (it used to need a
  // re-entry): the engine rebuilds the city at the new tier with
  // the player and the car kept where they are. Skipped when the
  // engine already runs that tier, including at mount.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const target =
      settings.quality === 'auto' ? detectQuality('auto').tier : settings.quality;
    if (engine.quality.tier !== target) engine.applyQualityPreset(target);
  }, [settings.quality]);

  const togglePause = () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (paused) {
      engine.start();
      setPaused(false);
      setReturnToHub(false);
      setShowSettings(false);
      setShowBoard(false);
      setShowStoryBoard(false);
      setShowGarage(false);
      setShowShop(false);
      setShowOutfits(false);
      setShowCollection(false);
      setShowRange(false);
      setShowMap(false);
      setShowStats(false);
    } else {
      engine.stop();
      setPaused(true);
    }
  };

  /**
   * Close a panel. When it was opened from the Pause Hub, hide it and
   * return to the hub (engine stays stopped, paused stays true);
   * otherwise resume the game exactly as before. Every panel closer
   * below goes through this — the hub contract in one place.
   */
  const closeToHubOrResume = (hide: () => void) => {
    const engine = engineRef.current;
    if (!engine) return;
    if (returnToHub) {
      hide();
      setReturnToHub(false);
    } else {
      engine.start();
      setPaused(false);
      hide();
    }
  };

  /** Picking a mission from a board always resumes play (and clears
   *  the hub flag), even when the board was opened from the hub. */
  const resumeFromPanel = (hide: () => void) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.start();
    setPaused(false);
    setReturnToHub(false);
    hide();
  };

  /** Open the mission board: the engine pauses while it is up. */
  const openBoard = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.stop();
    setPaused(true);
    setBoard(engine.getMissionBoard());
    setShowBoard(true);
  };

  const closeBoard = () => {
    closeToHubOrResume(() => setShowBoard(false));
  };

  const selectFromBoard = (id: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.selectMission(id)) {
      resumeFromPanel(() => setShowBoard(false));
    } else {
      setBoard(engine.getMissionBoard());
    }
  };

  /** Accept a combat contract from the board (the board stays open). */
  const acceptFromBoard = (id: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.acceptContract(id);
  };

  /** Abandon the accepted / active contract from the HUD. */
  const abandonContract = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.abandonContract();
  };

  /** Open the story board: the engine pauses while it is up. */
  const openStoryBoard = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.stop();
    setPaused(true);
    setStoryBoard(engine.getStoryBoard());
    setShowStoryBoard(true);
  };

  const closeStoryBoard = () => {
    closeToHubOrResume(() => setShowStoryBoard(false));
  };

  const selectStoryFromBoard = (id: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.selectStoryMission(id)) {
      resumeFromPanel(() => setShowStoryBoard(false));
    } else {
      setStoryBoard(engine.getStoryBoard());
    }
  };

  /** Open the garage: the engine pauses while it is up. */
  const openGarage = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.stop();
    setPaused(true);
    setGarage(engine.getGarageState());
    setShowGarage(true);
  };

  const closeGarage = () => {
    closeToHubOrResume(() => setShowGarage(false));
  };

  /** Garage actions: the engine owns the cash and the save; the
   * panel refreshes from the engine's fresh state afterwards. */
  const refreshGarage = () => {
    const engine = engineRef.current;
    if (engine) setGarage(engine.getGarageState());
  };
  const garageBuy = (id: string) => {
    const engine = engineRef.current;
    if (!engine) return { ok: false, reason: 'unavailable' };
    const res = engine.garageBuy(id);
    refreshGarage();
    if (res.ok) {
      const spec = garage?.vehicles.find((v) => v.spec.id === id)?.spec;
      notify(
        spec ? `${spec.name} acquired — $${spec.price.toLocaleString('en-US')}` : 'Vehicle acquired',
        'success',
      );
    } else if (res.reason === 'insufficient') {
      notify('Insufficient funds for this vehicle.', 'amber');
    }
    return res;
  };
  const garageSelect = (id: string) => {
    const engine = engineRef.current;
    if (!engine) return false;
    const ok = engine.garageSelect(id);
    refreshGarage();
    return ok;
  };
  const garagePaint = (id: string, hex: number) => {
    const engine = engineRef.current;
    if (!engine) return { ok: false, reason: 'unavailable' };
    const res = engine.garagePaint(id, hex);
    refreshGarage();
    if (res.ok) {
      notify(`Paint applied — $${PAINT_PRICE}`, 'success');
    } else if (res.reason === 'insufficient') {
      notify('Insufficient funds for paint.', 'amber');
    }
    return res;
  };
  const garageUpgrade = (id: string, kind: UpgradeKind) => {
    const engine = engineRef.current;
    if (!engine) return { ok: false, reason: 'unavailable' };
    const res = engine.garageUpgrade(id, kind);
    refreshGarage();
    if (res.ok) {
      const name = garage?.vehicles.find((v) => v.spec.id === id)?.spec.name ?? 'Vehicle';
      notify(`${name} upgraded`, 'success');
    } else if (res.reason === 'insufficient') {
      notify('Insufficient funds for this upgrade.', 'amber');
    }
    return res;
  };

  /** Open the shop: the engine pauses while it is up. */
  const openShop = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.stop();
    setPaused(true);
    setShop(engine.getShopState());
    setShowShop(true);
  };

  const closeShop = () => {
    closeToHubOrResume(() => setShowShop(false));
  };

  const refreshShop = () => {
    const engine = engineRef.current;
    if (engine) setShop(engine.getShopState());
  };
  const shopBuy = (id: string) => {
    const engine = engineRef.current;
    if (!engine) return { ok: false, reason: 'unavailable' };
    const res = engine.shopBuy(id);
    refreshShop();
    if (res.ok) {
      const item = shop?.items.find((i) => i.id === id);
      notify(
        item ? `${item.name} purchased — $${item.price}` : 'Item purchased',
        'success',
      );
    } else if (res.reason === 'insufficient') {
      notify('Insufficient funds for this item.', 'amber');
    }
    return res;
  };

  /** Open the outfits panel: the engine pauses while it is up. */
  const openOutfits = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.stop();
    setPaused(true);
    setOutfits(engine.getOutfitState());
    setShowOutfits(true);
  };

  const closeOutfits = () => {
    closeToHubOrResume(() => setShowOutfits(false));
  };

  const refreshOutfits = () => {
    const engine = engineRef.current;
    if (engine) setOutfits(engine.getOutfitState());
  };
  const outfitBuy = (id: string) => {
    const engine = engineRef.current;
    if (!engine) return { ok: false, reason: 'unavailable' };
    const res = engine.outfitBuy(id);
    refreshOutfits();
    if (res.ok) {
      const def = outfits?.outfits.find((o) => o.def.id === id)?.def;
      notify(
        def ? `${def.name} outfit unlocked — $${def.price}` : 'Outfit unlocked',
        'success',
      );
    } else if (res.reason === 'insufficient') {
      notify('Insufficient funds for this outfit.', 'amber');
    }
    return res;
  };
  const outfitSelect = (id: string) => {
    const engine = engineRef.current;
    if (!engine) return false;
    const ok = engine.outfitSelect(id);
    refreshOutfits();
    return ok;
  };

  /** Open the collection screen: the engine pauses while it is up. */
  const openCollection = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.stop();
    setPaused(true);
    setCollection(engine.getCollectibleState());
    setShowCollection(true);
  };

  /** Open the range panel: the engine pauses while it is up. */
  const openRange = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.stop();
    setPaused(true);
    setRange(engine.getRangeState());
    setShowRange(true);
  };

  const closeRange = () => {
    closeToHubOrResume(() => setShowRange(false));
  };

  const refreshRange = () => {
    const engine = engineRef.current;
    if (engine) setRange(engine.getRangeState());
  };
  const rangeBuy = (id: string) => {
    const engine = engineRef.current;
    if (!engine) return { ok: false, reason: 'unavailable' };
    const res = engine.rangeBuyWeapon(id);
    refreshRange();
    if (res.ok) {
      const def = getWeapon(id);
      notify(
        def ? `${def.name} acquired — $${def.price.toLocaleString('en-US')}` : 'Weapon acquired',
        'success',
      );
    } else if (res.reason === 'insufficient') {
      notify('Insufficient funds for this weapon.', 'amber');
    }
    return res;
  };
  const rangeEquip = (id: string) => {
    const engine = engineRef.current;
    if (!engine) return false;
    const ok = engine.rangeEquipWeapon(id);
    refreshRange();
    return ok;
  };
  const rangeRestock = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.rangeRestock();
    refreshRange();
  };

  const closeCollection = () => {
    closeToHubOrResume(() => setShowCollection(false));
  };

  /** Open the full city map: the engine pauses while it is up. */
  const openMap = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.stop();
    setPaused(true);
    setShowMap(true);
  };

  const closeMap = () => {
    closeToHubOrResume(() => setShowMap(false));
  };

  /** Open statistics: snapshot the real values from the engine. */
  const openStats = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.stop();
    setPaused(true);
    setStats(buildStatsSnapshot(engine));
    setShowStats(true);
  };

  const closeStats = () => {
    closeToHubOrResume(() => setShowStats(false));
  };

  /** Statistics → mission board. The board opens with the hub flag
   *  still set (statistics only opens from the hub), so closing the
   *  board returns to the hub, not to statistics. */
  const viewJobsFromStats = () => {
    setShowStats(false);
    openBoard();
  };

  /** Open settings on a given tab. The game is already paused when
   *  this is called (from the hub), so no engine stop is needed. */
  const openSettings = (section: SettingsSection) => {
    setSettingsSection(section);
    setShowSettings(true);
  };

  /** Closing settings drops back onto the hub (or resumes, if it was
   *  somehow opened without the hub) and clears the hub flag. */
  const closeSettings = () => {
    setShowSettings(false);
    setReturnToHub(false);
  };

  /** Hub openers: same panel, but the close returns to the hub. */
  const openBoardFromHub = () => {
    setReturnToHub(true);
    openBoard();
  };
  const openStoryBoardFromHub = () => {
    setReturnToHub(true);
    openStoryBoard();
  };
  const openGarageFromHub = () => {
    setReturnToHub(true);
    openGarage();
  };
  const openOutfitsFromHub = () => {
    setReturnToHub(true);
    openOutfits();
  };
  const openMapFromHub = () => {
    setReturnToHub(true);
    openMap();
  };
  const openStatsFromHub = () => {
    setReturnToHub(true);
    openStats();
  };
  const openSettingsFromHub = (section: SettingsSection) => {
    setReturnToHub(true);
    openSettings(section);
  };

  const quit = () => {
    engineRef.current?.dispose();
    engineRef.current = null;
    onExitToMenu();
  };

  const engine = engineRef.current;

  // HUD visibility: panels pause the game (`paused`), and a
  // cinematic hides the HUD too — the buttons, prompts and
  // touch controls must not be reachable mid-scene, even
  // though the engine keeps running. The pause overlay itself
  // is excluded during a cinematic (see its condition below),
  // and quitting to the menu stays available as the escape
  // hatch (engine dispose cleans the scene up silently).
  const hudHidden = paused || cinematic !== null;

  // The Pause Hub is visible exactly when the game is paused and no
  // panel, dialogue, cinematic or downed screen is in front of it.
  // (This is the same condition the old pause overlay used, extended
  // with the two new Group 2 screens.)
  const hubOpen =
    paused &&
    !downed &&
    !dialogue &&
    !cinematic &&
    !showSettings &&
    !showBoard &&
    !showStoryBoard &&
    !showGarage &&
    !showShop &&
    !showOutfits &&
    !showCollection &&
    !showRange &&
    !showMap &&
    !showStats;

  // Escape resumes, but ONLY from the hub — never while a panel,
  // dialogue or cinematic is open (those own their own keys).
  useEffect(() => {
    if (!hubOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // togglePause is safe here: hubOpen true implies paused true at
    // this render, so its resume branch is the one that runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubOpen]);

  return (
    <div className="game-screen">
      <canvas ref={canvasRef} className="game-canvas" aria-label="Vice City 3D world" />

      {!started && !error && (
        <div className="game-starting">
          <div className="game-starting-spinner" aria-hidden="true" />
          <p>Entering Vice City…</p>
        </div>
      )}

      {error && (
        <div className="game-error" role="alert">
          <h2>Couldn&apos;t start the 3D world</h2>
          <p>{error}</p>
          <p>Try a browser with WebGL enabled, then come back.</p>
          <button type="button" className="hud-button" onClick={onExitToMenu}>
            Back to menu
          </button>
        </div>
      )}

      {started && !error && (
        <>
          {!hudHidden && (
            <div className="hud hud-top">
            <div className="hud-title">
              <strong>VICE CITY</strong>
              <span>Stories · free roam</span>
            </div>
            <div className="hud-stats">
              <span className="hud-chip hud-cash" aria-label={`Cash $${cash}`}>
                <VcIcon name="cash" size={14} />
                <span className="hud-cash-num">${cash.toLocaleString('en-US')}</span>
              </span>
              {wanted.level > 0 && (
                <span className="hud-wanted" aria-label={`Wanted level ${wanted.level}`}>
                  <span className="hud-wanted-stars" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <VcIcon
                        key={s}
                        name="star"
                        size={14}
                        className={s <= wanted.level ? 'hud-wanted-star on' : 'hud-wanted-star'}
                      />
                    ))}
                  </span>
                  <span className="hud-wanted-status">
                    {wanted.status === 'pursuit' ? 'PURSUIT' : 'SEARCHING'}
                  </span>
                  {wanted.status === 'search' && (
                    <span className="hud-wanted-escape" aria-label="Escape progress">
                      <span
                        className="hud-wanted-escape-fill"
                        style={{ width: `${Math.round(wanted.escapeProgress * 100)}%` }}
                      />
                    </span>
                  )}
                </span>
              )}
              {settings.showFps && <span className="hud-chip hud-sys">{fps} FPS</span>}
              {quality && <span className="hud-chip hud-sys">{quality.label}</span>}
              <button
                type="button"
                className="hud-chip hud-coins"
                onClick={openCollection}
                aria-label={`Sunset Coins: ${drive.collectibles.found} of ${drive.collectibles.total} found`}
                title="Sunset Coins — open your collection"
              >
                <VcIcon name="coin" size={14} />
                <span>
                  {drive.collectibles.found}/{drive.collectibles.total}
                </span>
              </button>
              {!hudHidden && (
                <>
                  <button type="button" className="hud-button" onClick={openBoard} aria-label="Mission board">
                    <VcIcon name="missions" size={15} />
                    <span>Missions</span>
                  </button>
                  <button type="button" className="hud-button" onClick={openStoryBoard} aria-label="Story board">
                    <VcIcon name="story" size={15} />
                    <span>Story</span>
                  </button>
                  <button type="button" className="hud-button" onClick={openOutfits} aria-label="Outfits">
                    <VcIcon name="outfits" size={15} />
                    <span>Outfits</span>
                  </button>
                  <button type="button" className="hud-button" onClick={openMap} aria-label="City map">
                    <VcIcon name="map" size={15} />
                    <span>Map</span>
                  </button>
                  <button type="button" className="hud-button" onClick={togglePause} aria-label="Pause game">
                    <VcIcon name="pause" size={15} />
                    <span>Pause</span>
                  </button>
                </>
              )}
            </div>
            </div>
          )}

          {mission && !hudHidden && (
            <MissionHUD mission={mission} onAbandon={() => engineRef.current?.cancelMission()} />
          )}

          {story && !hudHidden && (
            <StoryHUD story={story} onAbandon={() => engineRef.current?.cancelStoryMission()} />
          )}

          {!hudHidden && (
            <Minimap engineRef={engineRef} quality={quality} />
          )}

          <div className="hud hud-bottom">
            <p className="hud-hint">
              {drive.mode === 'drive'
                ? IS_TOUCH
                  ? 'Steer with ◀ ▶ · GAS to go · BRAKE to stop · hold ✋ to drift'
                  : 'W accelerate · S brake / reverse · A D steer · Space handbrake · E exit'
                : IS_TOUCH
                  ? 'Left stick to move · drag right side to look · hold FIRE to shoot'
                  : 'WASD to move · drag to look · left-click to fire · R reload · Q switch · Shift to sprint'}
            </p>
            <button type="button" className="hud-button hud-quit" onClick={quit}>
              <VcIcon name="close" size={14} />
              <span>Menu</span>
            </button>
          </div>

          {drive.mode === 'walk' &&
            !hudHidden &&
            arrest === 'none' &&
            !downed &&
            combat &&
            (!sprint || sprint.status !== 'running') && (
              <CombatHUD combat={combat} />
            )}

          {drive.mode === 'walk' &&
            !hudHidden &&
            arrest === 'none' &&
            !downed &&
            encounters.length > 0 && <EncounterHUD encounters={encounters} />}

          {drive.mode === 'walk' &&
            !hudHidden &&
            arrest === 'none' &&
            !downed &&
            contracts.length > 0 && (
              <ContractHUD contracts={contracts} onAbandon={abandonContract} />
            )}

          {IS_TOUCH &&
            drive.mode === 'walk' &&
            !hudHidden &&
            arrest === 'none' &&
            !downed &&
            combat &&
            (!sprint || sprint.status !== 'running') && (
              <div className="combat-touch" aria-label="Combat controls">
                <button
                  type="button"
                  className="combat-btn switch-button"
                  aria-label="Switch weapon"
                  onClick={() => engineRef.current?.cycleCombatWeapon?.()}
                >
                  <VcIcon name="switch" size={22} />
                </button>
                <button
                  type="button"
                  className="combat-btn reload-button"
                  aria-label="Reload weapon"
                  onClick={() => engineRef.current?.reloadCombatWeapon?.()}
                >
                  <VcIcon name="reload" size={22} />
                </button>
                <button
                  type="button"
                  className="combat-btn fire-button"
                  aria-label="Hold to fire"
                  onPointerDown={(e) => {
                    try {
                      e.currentTarget.setPointerCapture(e.pointerId);
                    } catch {
                      /* no active pointer — the hold still works without capture */
                    }
                    engineRef.current?.setCombatFiring(true);
                    engineRef.current?.fireCombatWeapon();
                  }}
                  onPointerUp={() => engineRef.current?.setCombatFiring(false)}
                  onPointerCancel={() => engineRef.current?.setCombatFiring(false)}
                  onPointerLeave={() => engineRef.current?.setCombatFiring(false)}
                >
                  FIRE
                </button>
              </div>
            )}

          {drive.mode === 'walk' && drive.nearVehicle && !drive.nearInteractable && !hudHidden && arrest === 'none' && (
            <div className="enter-prompt" role="status">
              {IS_TOUCH ? (
                <button
                  type="button"
                  className="enter-button"
                  onClick={() => engineRef.current?.tryInteract()}
                >
                  <VcIcon name="arrow" size={15} />
                  <span>Enter {drive.vehicleName}</span>
                </button>
              ) : (
                <span>
                  Press <kbd>E</kbd> to enter the {drive.vehicleName}
                </span>
              )}
            </div>
          )}

          {arrest === 'prompt' && !hudHidden && (
            <div className="surrender-prompt" role="status">
              {IS_TOUCH ? (
                <button
                  type="button"
                  className="surrender-button"
                  onClick={() => engineRef.current?.trySurrender()}
                >
                  <VcIcon name="pause" size={15} />
                  <span>Surrender</span>
                </button>
              ) : (
                <span>
                  Cornered — press <kbd>F</kbd> to surrender
                </span>
              )}
            </div>
          )}

          {arrest === 'surrendering' && !hudHidden && (
            <div className="surrender-prompt" role="status">
              <span>Hands up — stand down</span>
            </div>
          )}

          {arrest === 'busted' && <BustedScreen onRespawn={() => engineRef.current?.respawn()} />}

          {downed && arrest === 'none' && <DownedScreen onRespawn={() => engineRef.current?.respawn()} />}

          {drive.mode === 'walk' && drive.nearGarage && !hudHidden && arrest === 'none' && (
            <div className="garage-prompt" role="status">
              {IS_TOUCH ? (
                <button
                  type="button"
                  className="garage-enter-button"
                  onClick={() => engineRef.current?.tryGarageEnter()}
                >
                  <VcIcon name="settings" size={15} />
                  <span>Enter Sunset Garage</span>
                </button>
              ) : (
                <span>
                  Press <kbd>E</kbd> to enter the Sunset Garage
                </span>
              )}
            </div>
          )}

          {mission?.prompt === 'accept' &&
            mission.distance !== null &&
            mission.distance <= 4 &&
            arrest === 'none' &&
            !hudHidden && (
              <div className="mission-prompt" role="status">
                {IS_TOUCH ? (
                  <button
                    type="button"
                    className="mission-start-button"
                    onClick={() => engineRef.current?.tryMissionInteract()}
                  >
                    <VcIcon name="play" size={15} />
                    <span>Start {mission.title}</span>
                  </button>
                ) : (
                  <span>
                    Press <kbd>E</kbd> to start {mission.title}
                  </span>
                )}
              </div>
            )}

          {story?.prompt === 'accept' &&
            story.distance !== null &&
            story.distance <= 4 &&
            arrest === 'none' &&
            !hudHidden && (
              <div className="mission-prompt" role="status">
                {IS_TOUCH ? (
                  <button
                    type="button"
                    className="mission-start-button"
                    onClick={() => engineRef.current?.tryStoryInteract()}
                  >
                    <VcIcon name="play" size={15} />
                    <span>{story.promptLabel ?? `Start ${story.title}`}</span>
                  </button>
                ) : (
                  <span>
                    Press <kbd>E</kbd> to {story.promptLabel ?? `start ${story.title}`}
                  </span>
                )}
              </div>
            )}

          {drive.mode === 'walk' &&
            drive.nearInteractable &&
            !drive.nearGarage &&
            !(
              mission?.prompt === 'accept' &&
              mission.distance !== null &&
              mission.distance <= 4
            ) &&
            !hudHidden &&
            arrest === 'none' && (
              <div className="interact-prompt" role="status">
                {IS_TOUCH ? (
                  <button
                    type="button"
                    className="interact-button"
                    onClick={() => engineRef.current?.tryInteractable()}
                  >
                    <VcIcon name="chevron-right" size={15} />
                    <span>{drive.nearInteractable.prompt}</span>
                  </button>
                ) : (
                  <span>
                    Press <kbd>E</kbd> to {drive.nearInteractable.prompt.charAt(0).toLowerCase() + drive.nearInteractable.prompt.slice(1)}
                  </span>
                )}
              </div>
            )}

          {sprint && sprint.status !== 'idle' && !hudHidden && (
            <SprintHUD sprint={sprint} onClose={() => engineRef.current?.dismissSprint()} />
          )}

          {mission?.state === 'complete' && (
            <MissionCompleteScreen
              mission={mission}
              onContinue={() => engineRef.current?.continueMission()}
              onReplay={() => engineRef.current?.replayMission()}
            />
          )}

          {story?.state === 'complete' && !cinematic && (
            <StoryCompleteScreen
              story={story}
              onContinue={() => {
                // 9E: missions with an outro (the Chapter 2 outro
                // and the two branch endings) play it from
                // Continue, after the reward is banked; the
                // screen hides while the scene plays (!cinematic
                // above), and Continue runs when it ends. If the
                // outro cannot start, continue without it.
                const engine = engineRef.current;
                const outro = story.outroCinematicId;
                if (engine && outro) {
                  const started = engine.playStoryOutro(outro, () => {
                    engine.continueStoryMission();
                  });
                  if (!started) engine.continueStoryMission();
                } else {
                  engine?.continueStoryMission();
                }
              }}
              onReplay={() => engineRef.current?.replayStoryMission()}
            />
          )}

          {mission?.state === 'failed' && arrest === 'none' && (
            <MissionFailedScreen
              mission={mission}
              onRetry={() => engineRef.current?.retryMission()}
              onClose={() => engineRef.current?.dismissMissionFailed()}
            />
          )}

          {story?.state === 'failed' && arrest === 'none' && (
            <StoryFailedScreen
              story={story}
              onRetry={() => engineRef.current?.retryStoryMission()}
              onRetryCheckpoint={() => engineRef.current?.retryStoryMissionFromCheckpoint()}
              onClose={() => engineRef.current?.dismissStoryMissionFailed()}
            />
          )}

          {cinematic && (
            <CinematicOverlay
              cinematic={cinematic}
              dialogueOpen={dialogue !== null}
              onSkip={() => engineRef.current?.skipCinematic()}
            />
          )}

          {dialogue && (
            <DialoguePanel
              dialogue={dialogue}
              onAdvance={() => engineRef.current?.dialogueAdvance()}
              onChoose={(i) => engineRef.current?.dialogueChoose(i)}
              onSkip={() => engineRef.current?.dialogueSkip()}
            />
          )}

          {drive.mode === 'drive' && !hudHidden && (
            <div className="drive-hud" aria-label="Vehicle dashboard">
              <div className="drive-name">
                <VcIcon name="car" size={15} />
                <span>{drive.vehicleName}</span>
              </div>
              <div className="speedo">
                <span className="speedo-value">{drive.speedKmh}</span>
                <span className="speedo-unit">km/h</span>
                <span className="speedo-gear">{drive.gear}</span>
              </div>
              {/* Speed bar (Lovable vehicle HUD): speed as a fraction
                  of a 200 km/h display scale — the fastest car in the
                  game tops out at 178 km/h fully upgraded, so the bar
                  never saturates. A display scale, not a game stat. */}
              <div
                className="speedo-bar"
                role="progressbar"
                aria-label={`Speed ${drive.speedKmh} kilometres per hour`}
                aria-valuenow={drive.speedKmh}
                aria-valuemin={0}
                aria-valuemax={200}
              >
                <div
                  className="speedo-bar-fill"
                  style={{ width: `${Math.min(100, Math.round((drive.speedKmh / 200) * 100))}%` }}
                />
              </div>
              {!IS_TOUCH && (
                <button
                  type="button"
                  className="hud-button drive-exit"
                  onClick={() => engineRef.current?.tryInteract()}
                >
                  E · Exit car
                </button>
              )}
            </div>
          )}

          {IS_TOUCH && engine && !dialogue && !cinematic && (
            <TouchControls
              input={engine.input}
              driving={drive.mode === 'drive'}
              onExitVehicle={() => engineRef.current?.tryInteract()}
              onSprintChange={(s) => {
                engine.input.sprint = s;
              }}
            />
          )}

          {showBoard && board && (
            <MissionBoard
              board={board}
              onSelect={selectFromBoard}
              onClose={closeBoard}
              contracts={contracts}
              onAcceptContract={acceptFromBoard}
            />
          )}

          {showStoryBoard && storyBoard && (
            <StoryBoard
              board={storyBoard}
              onSelect={selectStoryFromBoard}
              onClose={closeStoryBoard}
            />
          )}

          {showGarage && garage && (
            <GaragePanel
              state={garage}
              onBuy={garageBuy}
              onSelect={garageSelect}
              onPaint={garagePaint}
              onUpgrade={garageUpgrade}
              onClose={closeGarage}
            />
          )}

          {showShop && shop && (
            <ShopPanel state={shop} onBuy={shopBuy} onClose={closeShop} />
          )}

          {showOutfits && outfits && (
            <OutfitsPanel
              state={outfits}
              onBuy={outfitBuy}
              onSelect={outfitSelect}
              onClose={closeOutfits}
            />
          )}

          {showCollection && collection && (
            <CollectionPanel state={collection} onClose={closeCollection} />
          )}

          {showRange && range && (
            <RangePanel
              state={range}
              onBuy={rangeBuy}
              onEquip={rangeEquip}
              onRestock={rangeRestock}
              onClose={closeRange}
            />
          )}

          {hubOpen && (
            <PauseHub
              onResume={togglePause}
              onMissions={openBoardFromHub}
              onStory={openStoryBoardFromHub}
              onGarage={openGarageFromHub}
              onOutfits={openOutfitsFromHub}
              onSettings={() => openSettingsFromHub('Graphics')}
              onControls={() => openSettingsFromHub('Controls')}
              onMap={openMapFromHub}
              onStats={openStatsFromHub}
              onQuit={quit}
            />
          )}

          {showMap && (
            <FullMap engineRef={engineRef} quality={quality} onBack={closeMap} />
          )}

          {showStats && stats && (
            <StatisticsPanel stats={stats} onViewJobs={viewJobsFromStats} onClose={closeStats} />
          )}

          {paused && showSettings && (
            <SettingsPanel
              settings={settings}
              onChange={onSettingsChange}
              onClose={closeSettings}
              initialSection={settingsSection}
            />
          )}

          {/* Shared toast: renders outside the hudHidden gate so a
              purchase or wanted toast is visible while a panel is
              open; pointer-events none, auto-dismisses. */}
          <Toast toast={toast} />
        </>
      )}
    </div>
  );
}
