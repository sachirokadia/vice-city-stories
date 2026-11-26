import { useState } from 'react';
import type { QualitySettings } from '../game/Quality';
import type { GameSettings } from '../game/Settings';
import SettingsPanel from './SettingsPanel';
import AboutPanel from './AboutPanel';
import MissionBoard from './MissionBoard';
import StoryBoard from './StoryBoard';
import {
  loadMissionProgress,
  buildBoardState,
  loadCashBalance,
  trySelectMissionInProgress,
} from '../game/MissionProgress';
import {
  loadStoryProgress,
  buildStoryBoardState,
  trySelectStoryMissionInProgress,
} from '../game/StoryProgress';
import type { MissionBoardState } from '../game/MissionTypes';
import type { StoryBoardState } from '../game/StoryTypes';
import { VcButton } from './ui/VcButton';
import { VcChip } from './ui/VcChip';
import { VcStatBar } from './ui/VcStatBar';

interface MainMenuProps {
  quality: QualitySettings | null;
  settings: GameSettings;
  onSettingsChange: (next: GameSettings) => void;
  onPlay: () => void;
  onExploreCoast: () => void;
}

type MenuPanel = 'none' | 'settings' | 'about' | 'missions' | 'story';

/**
 * Cinematic main menu — pure React/CSS, no Three.js.
 * Original neon-sunset skyline drawn in SVG (with a Beacon Tower
 * silhouette, the in-game landmark); nothing copied from any
 * existing game. Every button works: Play enters the 3D city,
 * Settings opens the real settings panel, About shows the
 * game's description. Progress, cash and chapter are read live
 * from the same saves the game itself uses.
 */
export default function MainMenu({ quality, settings, onSettingsChange, onPlay, onExploreCoast }: MainMenuProps) {
  const [panel, setPanel] = useState<MenuPanel>('none');
  const [board, setBoard] = useState<MissionBoardState | null>(null);
  const [storyBoard, setStoryBoard] = useState<StoryBoardState | null>(null);

  const openMissions = () => {
    setBoard(buildBoardState(loadMissionProgress(), loadCashBalance(), null));
    setPanel('missions');
  };

  const selectFromBoard = (id: string) => {
    const progress = trySelectMissionInProgress(id);
    if (progress) {
      setBoard(buildBoardState(progress, loadCashBalance(), null));
    }
  };

  const openStory = () => {
    setStoryBoard(
      buildStoryBoardState(loadStoryProgress(), loadCashBalance(), null, false),
    );
    setPanel('story');
  };

  const selectStoryFromBoard = (id: string) => {
    const progress = trySelectStoryMissionInProgress(id);
    if (progress) {
      setStoryBoard(
        buildStoryBoardState(progress, loadCashBalance(), null, false),
      );
    }
  };

  /** One line of campaign progress for the STORY button. */
  const storyProgressLine = (): string => {
    const progress = loadStoryProgress();
    const done = Object.values(progress.missions).filter((m) => m.completed).length;
    const total = Object.keys(progress.missions).length;
    const chapter = Object.entries(progress.chapters).find(([, c]) => c.unlocked && !c.completed);
    const chapterNum = chapter ? chapter[0].replace('chapter-', '') : '1';
    return `Chapter ${chapterNum} · ${done} of ${total} done`;
  };

  // Live progress for the status block (same saves as above).
  const storyProgress = loadStoryProgress();
  const storyDone = Object.values(storyProgress.missions).filter((m) => m.completed).length;
  const storyTotal = Object.keys(storyProgress.missions).length;
  const cash = loadCashBalance();

  return (
    <div className="menu">
      <div className="menu-sky" aria-hidden="true">
        <div className="menu-sun" />
        <div className="menu-cloud c1" />
        <div className="menu-cloud c2" />
        <div className="menu-cloud c3" />
        <svg className="menu-skyline" viewBox="0 0 1200 320" preserveAspectRatio="none" aria-hidden="true">
          {/* Distant skyline — atmospheric perspective, lighter violet. */}
          <path
            d="M0 320 V200 h60 V150 h50 V210 h50 V120 h70 V180 h50 V90 h70 V170 h60 V140 h70 V200 h60 V110 h80 V190 h60 V130 h80 V200 h60 V150 h70 V100 h80 V180 h60 V140 h70 V200 h60 V160 h70 V120 h80 V190 h60 V150 h60 V200 h80 V320 Z"
            fill="#3a2566"
            opacity="0.55"
          />
          {/* Near skyline — dark violet, with the Beacon Tower at centre. */}
          <path
            d="M0 320 V240 h80 V200 h70 V260 h70 V210 h80 V250 h80 V190 h80 V240 h80 V260 h40 V40 h10 V28 h16 V40 h10 V260 h82 V250 h80 V200 h80 V260 h80 V210 h80 V250 h80 V200 h80 V240 h80 V320 Z"
            fill="#150c2b"
          />
          {/* Beacon light on the tower. */}
          <circle cx="600" cy="26" r="5" fill="#ffd27a" />
          <circle cx="600" cy="26" r="10" fill="#ffd27a" opacity="0.35" />
          {/* Lit windows — front layer. */}
          <g fill="#ffd27a" opacity="0.85">
            <rect x="24" y="252" width="6" height="8" />
            <rect x="24" y="276" width="6" height="8" />
            <rect x="104" y="216" width="6" height="8" />
            <rect x="196" y="224" width="6" height="8" />
            <rect x="288" y="262" width="6" height="8" />
            <rect x="360" y="206" width="6" height="8" />
            <rect x="448" y="252" width="6" height="8" />
            <rect x="540" y="268" width="6" height="8" />
            <rect x="700" y="262" width="6" height="8" />
            <rect x="788" y="216" width="6" height="8" />
            <rect x="880" y="224" width="6" height="8" />
            <rect x="968" y="262" width="6" height="8" />
            <rect x="1060" y="216" width="6" height="8" />
            <rect x="1140" y="252" width="6" height="8" />
          </g>
          {/* Lit windows — distant layer. */}
          <g fill="#ffd27a" opacity="0.4">
            <rect x="80" y="166" width="5" height="7" />
            <rect x="190" y="136" width="5" height="7" />
            <rect x="320" y="106" width="5" height="7" />
            <rect x="470" y="156" width="5" height="7" />
            <rect x="640" y="126" width="5" height="7" />
            <rect x="790" y="146" width="5" height="7" />
            <rect x="950" y="116" width="5" height="7" />
            <rect x="1100" y="136" width="5" height="7" />
          </g>
        </svg>
        <div className="menu-sea" />
        <div className="menu-road" />
      </div>
      <div className="menu-scrim" aria-hidden="true" />

      <div className="menu-content">
        <p className="menu-eyebrow">An Open World Adventure</p>
        <h1 className="menu-title">
          <span className="menu-title-vice">VICE CITY</span>
          <span className="menu-title-stories">Stories</span>
        </h1>
        <p className="menu-tagline">
          Sunset over the bay. Streets that never sleep.
          <br />
          Walk in — the city is yours to explore.
        </p>

        <nav className="menu-nav" aria-label="Main menu">
          <VcButton
            variant="primary"
            size="lg"
            icon="play"
            trailingIcon="chevron-right"
            onClick={onPlay}
            autoFocus
            className="menu-nav-button menu-nav-play"
          >
            Play
          </VcButton>
          <VcButton variant="secondary" size="md" icon="play" trailingIcon="chevron-right"
            onClick={onExploreCoast} className="menu-nav-button">
            Explore Ocean Drive
          </VcButton>
          <VcButton
            variant="secondary"
            size="md"
            icon="story"
            trailingIcon="chevron-right"
            onClick={openStory}
            className="menu-nav-button"
          >
            Story
          </VcButton>
          <VcButton
            variant="secondary"
            size="md"
            icon="missions"
            trailingIcon="chevron-right"
            onClick={openMissions}
            className="menu-nav-button"
          >
            Missions
          </VcButton>
          <VcButton
            variant="secondary"
            size="md"
            icon="settings"
            trailingIcon="chevron-right"
            onClick={() => setPanel('settings')}
            className="menu-nav-button"
          >
            Settings
          </VcButton>
          <VcButton
            variant="secondary"
            size="md"
            icon="info"
            trailingIcon="chevron-right"
            onClick={() => setPanel('about')}
            className="menu-nav-button"
          >
            About
          </VcButton>
        </nav>

        <div className="menu-progress">
          <div className="menu-progress-head">
            <span className="menu-progress-eyebrow">Your progress</span>
            <VcChip tone="cash" icon="cash">
              ${cash.toLocaleString()}
            </VcChip>
          </div>
          <p className="menu-progress-line">{storyProgressLine()}</p>
          <VcStatBar
            label="Story"
            value={storyDone}
            max={Math.max(storyTotal, 1)}
            display={`${storyDone} / ${storyTotal}`}
            tone="story"
          />
        </div>

        <div className="menu-meta">
          <VcChip className="menu-hint-keyboard">WASD / Arrows — move</VcChip>
          <VcChip className="menu-hint-keyboard">Mouse drag — look</VcChip>
          <VcChip className="menu-hint-keyboard">Shift — sprint</VcChip>
          <VcChip>Touch — joystick + drag</VcChip>
          {quality && <VcChip tone="job">Quality: {quality.label}</VcChip>}
        </div>
      </div>

      <p className="menu-footer">
        An original game. Not affiliated with any existing game.
      </p>

      {panel === 'settings' && (
        <SettingsPanel
          settings={settings}
          onChange={onSettingsChange}
          onClose={() => setPanel('none')}
        />
      )}
      {panel === 'about' && <AboutPanel onClose={() => setPanel('none')} />}

      {panel === 'missions' && board && (
        <MissionBoard board={board} onSelect={selectFromBoard} onClose={() => setPanel('none')} />
      )}

      {panel === 'story' && storyBoard && (
        <StoryBoard board={storyBoard} onSelect={selectStoryFromBoard} onClose={() => setPanel('none')} />
      )}
    </div>
  );
}
