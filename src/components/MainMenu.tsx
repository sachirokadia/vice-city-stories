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

interface MainMenuProps {
  quality: QualitySettings | null;
  settings: GameSettings;
  onSettingsChange: (next: GameSettings) => void;
  onPlay: () => void;
}

type MenuPanel = 'none' | 'settings' | 'about' | 'missions' | 'story';

/**
 * Cinematic main menu — pure React/CSS, no Three.js.
 * Original neon-sunset skyline drawn in SVG; nothing copied
 * from any existing game. Every button works: Play enters the
 * 3D city, Settings opens the real settings panel, About shows
 * the game's description.
 */
export default function MainMenu({ quality, settings, onSettingsChange, onPlay }: MainMenuProps) {
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

  return (
    <div className="menu">
      <div className="menu-sky" aria-hidden="true">
        <div className="menu-sun" />
        <div className="menu-cloud c1" />
        <div className="menu-cloud c2" />
        <div className="menu-cloud c3" />
        <svg className="menu-skyline" viewBox="0 0 1200 320" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M0 320 V210 h40 v-70 h30 v70 h25 V150 h45 v60 h30 V120 h50 v90 h35 V180 h40 v-50 h30 v50 h45 V140 h55 v70 h30 V100 h45 v110 h40 V170 h35 v-60 h40 v60 h30 V130 h50 v80 h35 V190 h45 v-40 h30 v40 h40 V150 h55 v60 h30 V120 h45 v90 h40 V180 h35 v-55 h40 v55 h30 V140 h50 v70 h45 V320 Z"
            fill="#1a1033"
          />
          <g fill="#ffd27a" opacity="0.85">
            <rect x="52" y="155" width="6" height="8" />
            <rect x="52" y="180" width="6" height="8" />
            <rect x="150" y="165" width="6" height="8" />
            <rect x="290" y="140" width="6" height="8" />
            <rect x="430" y="160" width="6" height="8" />
            <rect x="620" y="130" width="6" height="8" />
            <rect x="800" y="170" width="6" height="8" />
            <rect x="980" y="150" width="6" height="8" />
            <rect x="1120" y="165" width="6" height="8" />
          </g>
        </svg>
        <div className="menu-sea" />
        <div className="menu-road" />
      </div>

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

        <div className="menu-buttons">
          <button type="button" className="play-button" onClick={onPlay} autoFocus>
            ▶&nbsp; Play
          </button>
          <button type="button" className="menu-button" onClick={openStory}>
            📖&nbsp; Story
          </button>
          <button type="button" className="menu-button" onClick={openMissions}>
            ☰&nbsp; Missions
          </button>
          <button type="button" className="menu-button" onClick={() => setPanel('settings')}>
            ⚙&nbsp; Settings
          </button>
          <button type="button" className="menu-button" onClick={() => setPanel('about')}>
            ⓘ&nbsp; About
          </button>
        </div>
        <p className="menu-hint">Enter the city · free-roam foundation · {storyProgressLine()}</p>

        <div className="menu-meta">
          <span className="menu-chip">WASD / Arrows — move</span>
          <span className="menu-chip">Mouse drag — look</span>
          <span className="menu-chip">Shift — sprint</span>
          <span className="menu-chip">Touch — joystick + drag</span>
          {quality && <span className="menu-chip menu-chip-quality">Quality: {quality.label}</span>}
        </div>
      </div>

      <p className="menu-footer">
        An original foundation. Not affiliated with any existing game.
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
