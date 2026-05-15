const dependencyRows = [
  ['basePath', 'Code Folder'],
  ['python', 'Python'],
  ['tmux', 'tmux'],
  ['ffmpeg', 'FFmpeg'],
  ['openGoPro', 'open_gopro'],
  ['opencv', 'OpenCV'],
  ['streamScript', 'Stream Script'],
  ['captureScript', 'Capture Script'],
  ['collectorScript', 'Collector Script'],
  ['passwordlessSudo', 'Passwordless sudo'],
];

const runtimeRows = [
  ['streamSession', 'Stream Session'],
  ['goproConnection', 'GoPro Connection'],
  ['streamHealth', 'Stream Health'],
  ['collectorSession', 'Collector Session'],
  ['udp8554', 'UDP 8554'],
];

const STATUS_COLORS = {
  ok: { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' },
  missing: { bg: '#fee2e2', color: '#b91c1c', border: '#fecaca' },
  'needs-password': { bg: '#fef9c3', color: '#a16207', border: '#fef08a' },
  running: { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' },
  stopped: { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' },
  connected: { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' },
  failed: { bg: '#fee2e2', color: '#b91c1c', border: '#fecaca' },
  retrying: { bg: '#fef9c3', color: '#a16207', border: '#fef08a' },
  streaming: { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' },
  listening: { bg: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe' },
  unknown: { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' },
  'running-no-stream-yet': { bg: '#fef9c3', color: '#a16207', border: '#fef08a' },
  'Not checked': { bg: '#f1f5f9', color: '#94a3b8', border: '#e2e8f0' },
};

function StatusBadge({ value }) {
  const style = STATUS_COLORS[value] || STATUS_COLORS['Not checked'];
  const display = value || 'Not checked';
  return (
    <span
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: '6px',
        color: style.color,
        display: 'inline-block',
        fontSize: '0.8rem',
        fontWeight: 700,
        lineHeight: 1,
        padding: '4px 10px',
        whiteSpace: 'nowrap',
      }}
    >
      {display}
    </span>
  );
}

export default function CameraManager({
  cameraConfig,
  cameraStatus,
  cameraLog,
  busyAction,
  onCameraConfigChange,
  onCheckCamera,
  onCameraAction,
  onGrantPasswordlessSudo,
}) {
  const busy = Boolean(busyAction);
  const needsSudo = cameraStatus?.passwordlessSudo && cameraStatus.passwordlessSudo !== 'ok';

  function updateConfig(key, value) {
    onCameraConfigChange({ ...cameraConfig, [key]: value });
  }

  return (
    <section className="panel camera-manager">
      {/* ── Header ── */}
      <div className="section-heading">
        <div>
          <h2>Camera Manager</h2>
        </div>
        <button type="button" onClick={onCheckCamera} disabled={busy}>
          {busyAction === 'camera-status' ? 'Checking...' : 'Check Camera'}
        </button>
      </div>

      {/* ── Sudo callout ── */}
      {needsSudo && (
        <div className="sudo-callout">
          <div className="sudo-callout-text">
            <strong>⚠ Passwordless sudo required</strong>
            <p>The GoPro Bluetooth script needs passwordless sudo to run on the Jetson. Click Grant once — it persists across reboots.</p>
          </div>
          <button type="button" onClick={onGrantPasswordlessSudo} disabled={busy}>
            {busyAction === 'grant-sudo' ? 'Granting...' : 'Grant Passwordless Sudo'}
          </button>
        </div>
      )}

      {/* ── GoPro Scripts (collapsible) ── */}
      <details className="manager-section config-details">
        <summary>
          <span>GoPro Scripts</span>
          <small>Remote paths on the Jetson</small>
        </summary>

        <div className="camera-config-grid" style={{ marginTop: '14px' }}>
          <label>
            <span>Code Folder</span>
            <input
              value={cameraConfig.basePath}
              onChange={(event) => updateConfig('basePath', event.target.value)}
              autoComplete="off"
            />
          </label>
          <label>
            <span>Stream Script</span>
            <input
              value={cameraConfig.streamScript}
              onChange={(event) => updateConfig('streamScript', event.target.value)}
              autoComplete="off"
            />
          </label>
          <label>
            <span>Stop Script</span>
            <input
              value={cameraConfig.stopScript}
              onChange={(event) => updateConfig('stopScript', event.target.value)}
              autoComplete="off"
            />
          </label>
          <label>
            <span>Capture Script</span>
            <input
              value={cameraConfig.captureScript}
              onChange={(event) => updateConfig('captureScript', event.target.value)}
              autoComplete="off"
            />
          </label>
          <label>
            <span>Collector Script</span>
            <input
              value={cameraConfig.collectorScript}
              onChange={(event) => updateConfig('collectorScript', event.target.value)}
              autoComplete="off"
            />
          </label>
          <label>
            <span>Stream URL</span>
            <input
              value={cameraConfig.streamUrl}
              onChange={(event) => updateConfig('streamUrl', event.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="checkbox-row" style={{ gridColumn: '1 / -1' }}>
            <input
              type="checkbox"
              checked={cameraConfig.useSudo}
              onChange={(event) => updateConfig('useSudo', event.target.checked)}
            />
            <span>Run GoPro scripts with sudo</span>
          </label>
        </div>
      </details>

      {/* ── Streaming + Interval Recording ── */}
      <div className="manager-grid">
        <section className="manager-section">
          <div className="manager-section-header">
            <div>
              <h3>Streaming</h3>
              <p>Start or stop the GoPro webcam stream.</p>
            </div>
          </div>

          <div className="manager-form">
            <label>
              <span>tmux Session</span>
              <input
                value={cameraConfig.streamSession}
                onChange={(event) => updateConfig('streamSession', event.target.value)}
                autoComplete="off"
              />
            </label>

            <div className="button-row">
              <button type="button" onClick={() => onCameraAction('start-stream')} disabled={busy}>
                {busyAction === 'camera-start-stream' ? 'Starting...' : 'Start Stream'}
              </button>
              <button type="button" className="secondary" onClick={() => onCameraAction('stop-stream')} disabled={busy}>
                {busyAction === 'camera-stop-stream' ? 'Stopping...' : 'Stop Stream'}
              </button>
            </div>

            <div className="capture-row">
              <button type="button" className="secondary" onClick={() => onCameraAction('capture-frame')} disabled={busy} style={{ width: '100%' }}>
                {busyAction === 'camera-capture-frame' ? 'Capturing...' : '📷 Capture Frame'}
              </button>
            </div>
          </div>
        </section>

        <section className="manager-section">
          <div className="manager-section-header">
            <div>
              <h3>Interval Recording</h3>
              <p>Run the video collector in tmux.</p>
            </div>
          </div>

          <div className="camera-number-grid">
            <label>
              <span>Session</span>
              <input
                value={cameraConfig.collectorSession}
                onChange={(event) => updateConfig('collectorSession', event.target.value)}
                autoComplete="off"
              />
            </label>
            <label>
              <span>Duration (s)</span>
              <input
                type="number"
                min="1"
                value={cameraConfig.durationSeconds}
                onChange={(event) => updateConfig('durationSeconds', Number(event.target.value))}
              />
            </label>
            <label>
              <span>Samples</span>
              <input
                type="number"
                min="1"
                value={cameraConfig.samples}
                onChange={(event) => updateConfig('samples', Number(event.target.value))}
              />
            </label>
            <label>
              <span>Pause (s)</span>
              <input
                type="number"
                min="0"
                value={cameraConfig.pauseSeconds}
                onChange={(event) => updateConfig('pauseSeconds', Number(event.target.value))}
              />
            </label>
          </div>

          <div className="button-row">
            <button type="button" onClick={() => onCameraAction('start-collector')} disabled={busy}>
              {busyAction === 'camera-start-collector' ? 'Starting...' : 'Start Collector'}
            </button>
            <button type="button" className="secondary" onClick={() => onCameraAction('stop-collector')} disabled={busy}>
              {busyAction === 'camera-stop-collector' ? 'Stopping...' : 'Stop Collector'}
            </button>
          </div>
        </section>
      </div>

      {/* ── Status ── */}
      <div className="manager-section">
        <div className="manager-section-header">
          <div>
            <h3>Status</h3>
            <p>Dependencies, connection state, and stream health.</p>
          </div>
          <div className="button-row">
            {!needsSudo && (
              <button type="button" className="secondary" onClick={onGrantPasswordlessSudo} disabled={busy} style={{ fontSize: '0.82rem' }}>
                {busyAction === 'grant-sudo' ? 'Granting...' : 'Grant Sudo'}
              </button>
            )}
            <button type="button" className="secondary" onClick={() => onCameraAction('read-logs')} disabled={busy}>
              {busyAction === 'camera-read-logs' ? 'Loading...' : 'Read Logs'}
            </button>
          </div>
        </div>

        <div className="status-two-col">
          {/* Dependencies */}
          <div>
            <p className="status-group-label">Dependencies</p>
            <div className="status-table">
              {dependencyRows.map(([key, label]) => (
                <div className="status-row" key={key}>
                  <span>{label}</span>
                  <StatusBadge value={cameraStatus?.[key]} />
                </div>
              ))}
            </div>
          </div>

          {/* Runtime */}
          <div>
            <p className="status-group-label">Runtime</p>
            <div className="status-table">
              {runtimeRows.map(([key, label]) => (
                <div className="status-row" key={key}>
                  <span>{label}</span>
                  <StatusBadge value={cameraStatus?.[key]} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Log */}
        {cameraLog && (
          <div className="camera-log-wrap">
            <div className="camera-log-header">
              <span>tmux Output</span>
            </div>
            <pre className="camera-log">{cameraLog}</pre>
          </div>
        )}
      </div>
    </section>
  );
}
