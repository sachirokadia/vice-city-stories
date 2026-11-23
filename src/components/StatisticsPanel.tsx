/**
 * StatisticsPanel — five real values, read from the live game state
 * at the moment the panel opens (the game is paused while it is up,
 * so the snapshot cannot go stale). No invented playtime, no
 * cash-earned, no hardcoded demonstration values: every number comes
 * from the engine's own board / garage / collectible / cash getters.
 */
import type { GameEngine } from '../game/GameEngine';
import { VcIcon } from './ui/VcIcon';

export interface StatsSnapshot {
  storyDone: number;
  storyTotal: number;
  jobsDone: number;
  jobsTotal: number;
  coinsFound: number;
  coinsTotal: number;
  vehiclesOwned: number;
  vehiclesTotal: number;
  cash: number;
  /** Title of the chapter the player is currently in. */
  chapterTitle: string;
  /** "Title — Giver" of the active/selected story mission, or null. */
  currentStoryMission: string | null;
  /** "Title — Giver" of the active/selected job, or null. */
  currentJobMission: string | null;
}

/** Build the snapshot from the engine's own getters — the same state
 *  the boards, garage and collection screens already render. */
export function buildStatsSnapshot(engine: GameEngine): StatsSnapshot {
  const storyBoard = engine.getStoryBoard();
  const missionBoard = engine.getMissionBoard();
  const collectibles = engine.getCollectibleState();
  const garage = engine.getGarageState();
  const cash = engine.getStats().cash;

  const storyEntries = storyBoard.chapters.flatMap((c) => c.entries);
  const storyDone = storyEntries.filter((e) => e.completed).length;
  const jobsDone = missionBoard.entries.filter((e) => e.completed).length;
  const vehiclesOwned = garage.vehicles.filter((v) => v.owned).length;
  const currentChapter =
    storyBoard.chapters.find((c) => !c.completed) ??
    storyBoard.chapters[storyBoard.chapters.length - 1];
  const storyEntry =
    storyEntries.find((e) => e.active) ?? storyEntries.find((e) => e.selected) ?? null;
  const jobEntry =
    missionBoard.entries.find((e) => e.active) ??
    missionBoard.entries.find((e) => e.selected) ??
    null;

  return {
    storyDone,
    storyTotal: storyEntries.length,
    jobsDone,
    jobsTotal: missionBoard.entries.length,
    coinsFound: collectibles.found,
    coinsTotal: collectibles.total,
    vehiclesOwned,
    vehiclesTotal: garage.vehicles.length,
    cash,
    chapterTitle: currentChapter?.title ?? 'Vice City',
    currentStoryMission: storyEntry ? `${storyEntry.title} — ${storyEntry.giver}` : null,
    currentJobMission: jobEntry ? `${jobEntry.title} — ${jobEntry.giver}` : null,
  };
}

interface StatisticsPanelProps {
  stats: StatsSnapshot;
  onViewJobs: () => void;
  onClose: () => void;
}

export default function StatisticsPanel({ stats, onViewJobs, onClose }: StatisticsPanelProps) {
  const storyPct = stats.storyTotal > 0 ? Math.round((stats.storyDone / stats.storyTotal) * 100) : 0;
  const tiles = [
    { label: 'Story missions', value: `${stats.storyDone} / ${stats.storyTotal}`, icon: 'story' as const, testId: 'stat-story' },
    { label: 'Job missions', value: `${stats.jobsDone} / ${stats.jobsTotal}`, icon: 'missions' as const, testId: 'stat-jobs' },
    { label: 'Sunset Coins', value: `${stats.coinsFound} / ${stats.coinsTotal}`, icon: 'coin' as const, testId: 'stat-coins' },
    { label: 'Vehicles owned', value: `${stats.vehiclesOwned} / ${stats.vehiclesTotal}`, icon: 'car' as const, testId: 'stat-vehicles' },
    { label: 'Current cash', value: `$${stats.cash.toLocaleString('en-US')}`, icon: 'cash' as const, testId: 'stat-cash' },
  ];

  return (
    <div className="panel-overlay" role="dialog" aria-modal="true" aria-label="Statistics">
      <div className="panel panel--stats stats-screen">
        <div className="stats-screen__top">
          <div>
            <p className="eyebrow">FIELD RECORD</p>
            <h2 className="stats-title">STATISTICS</h2>
          </div>
          <div className="stats-screen__actions">
            <button type="button" className="hud-button" onClick={onViewJobs}>
              <VcIcon name="missions" size={15} />
              <span>View jobs</span>
            </button>
            <button type="button" className="panel-close" onClick={onClose} aria-label="Close statistics">
              ✕
            </button>
          </div>
        </div>

        <div className="stats-feature">
          <img src="/images/vice-city-sunset.png" alt="Vice City skyline at sunset" />
          <div className="stats-feature__shade" />
          <span className="stats-feature__chapter">
            {stats.chapterTitle.toUpperCase()} · {stats.storyDone} / {stats.storyTotal} STORY MISSIONS
          </span>
          <h3>{stats.chapterTitle}</h3>
          <div
            className="progress-track"
            role="progressbar"
            aria-label={`Story progress ${stats.storyDone} of ${stats.storyTotal}`}
            aria-valuenow={stats.storyDone}
            aria-valuemin={0}
            aria-valuemax={stats.storyTotal}
          >
            <div className="progress-fill" style={{ width: `${storyPct}%` }} />
          </div>
        </div>

        <div className="stats-grid">
          {tiles.map((t) => (
            <div key={t.label} className="stat-tile" data-testid={t.testId}>
              <span className="stat-tile__icon">
                <VcIcon name={t.icon} size={17} />
              </span>
              <span className="stat-tile__label">{t.label}</span>
              <strong>{t.value}</strong>
              <span className="stat-tile__line" />
            </div>
          ))}
        </div>

        <div className="stats-lower">
          <div className="stats-current">
            <span className="stats-current__label">CURRENT STORY MISSION</span>
            <strong>{stats.currentStoryMission ?? 'No story mission selected'}</strong>
            <span className="stats-current__label">CURRENT JOB</span>
            <strong>{stats.currentJobMission ?? 'No job selected'}</strong>
          </div>
          <button type="button" className="play-button stats-done" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
