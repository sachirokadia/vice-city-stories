import { useCallback, useEffect, useState } from 'react';
import LoadingScreen from './components/LoadingScreen';
import MainMenu from './components/MainMenu';
import GameCanvas from './components/GameCanvas';
import { detectQuality } from './game/Quality';
import type { QualitySettings } from './game/Quality';
import { loadSettings, saveSettings } from './game/Settings';
import type { GameSettings } from './game/Settings';

type Phase = 'loading' | 'menu' | 'playing';

/**
 * App owns only the phase (loading -> menu -> playing) and the
 * shared game settings. All 3D work lives in GameEngine; all menu
 * work is plain React. Phase 1 has no physics engine.
 */
export default function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [coastalEntry, setCoastalEntry] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Starting up…');
  const [quality, setQuality] = useState<QualitySettings | null>(null);
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setStatus('Checking WebGL support…');
        setProgress(15);
        const test = document.createElement('canvas');
        const gl = test.getContext('webgl2') ?? test.getContext('webgl');
        if (!gl) throw new Error('WebGL is not available in this browser.');
        // Lose the test context promptly; the engine creates its own.
        const ext = gl.getExtension('WEBGL_lose_context');
        ext?.loseContext();
        await new Promise((r) => setTimeout(r, 200));

        setStatus('Detecting device performance…');
        setProgress(45);
        const q = detectQuality(loadSettings().quality);
        if (!cancelled) setQuality(q);
        await new Promise((r) => setTimeout(r, 250));

        setStatus('Warming up the sunset…');
        setProgress(75);
        await new Promise((r) => setTimeout(r, 300));

        if (cancelled) return;
        setProgress(100);
        setStatus('Ready');
        await new Promise((r) => setTimeout(r, 250));
        if (!cancelled) setPhase('menu');
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Loading failed.');
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const play = useCallback(() => { setCoastalEntry(false); setPhase('playing'); }, []);
  const exploreCoast = useCallback(() => { setCoastalEntry(true); setPhase('playing'); }, []);
  const toMenu = useCallback(() => setPhase('menu'), []);
  const changeSettings = useCallback((next: GameSettings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  if (phase === 'loading') {
    if (loadError) {
      return (
        <div className="loading-screen">
          <p className="loading-kicker">Vice City Stories</p>
          <h1 className="loading-title">This device can&apos;t run the city yet</h1>
          <p className="loading-note">{loadError}</p>
          <p className="loading-note">
            The game needs WebGL. Try a recent Chrome, Edge, Firefox or Safari, with hardware
            acceleration turned on.
          </p>
          <button type="button" className="play-button" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      );
    }
    return <LoadingScreen progress={progress} status={status} />;
  }

  if (phase === 'menu') {
    return (
      <MainMenu
        quality={quality}
        settings={settings}
        onSettingsChange={changeSettings}
        onPlay={play}
        onExploreCoast={exploreCoast}
      />
    );
  }

  return (
    <GameCanvas
      key="game"
      startAtCoast={coastalEntry}
      settings={settings}
      onSettingsChange={changeSettings}
      onExitToMenu={toMenu}
    />
  );
}
