interface LoadingScreenProps {
  progress: number; // 0..100
  status: string;
}

export default function LoadingScreen({ progress, status }: LoadingScreenProps) {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="loading-sun" aria-hidden="true" />
      <p className="loading-kicker">Vice City Stories</p>
      <h1 className="loading-title">Loading the city…</h1>
      <div className="loading-bar" aria-label={`Loading ${Math.round(progress)} percent`}>
        <div className="loading-bar-fill" style={{ width: `${Math.max(2, Math.min(100, progress))}%` }} />
      </div>
      <p className="loading-status">
        {status} · {Math.round(progress)}%
      </p>
      <p className="loading-note">Warming up the city and the sunset.</p>
    </div>
  );
}
