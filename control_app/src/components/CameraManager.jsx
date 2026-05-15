const cameraStatusRows = [
  ['basePath', 'Code Folder'],
  ['python', 'Python'],
  ['tmux', 'tmux'],
  ['ffmpeg', 'FFmpeg'],
  ['openGoPro', 'open_gopro'],
  ['opencv', 'OpenCV'],
  ['streamScript', 'Stream Script'],
  ['captureScript', 'Capture Script'],
  ['collectorScript', 'Collector Script'],
  ['streamSession', 'Stream Session'],
  ['collectorSession', 'Collector Session'],
  ['udp8554', 'UDP 8554'],
];

export default function CameraManager({
  cameraConfig,
  cameraStatus,
  cameraLog,
  busyAction,
  onCameraConfigChange,
  onCheckCamera,
  onCameraAction,
}) {
  const busy = Boolean(busyAction);

  function updateConfig(key, value) {
    onCameraConfigChange({ ...cameraConfig, [key]: value });
  }

  return (
    <section className="panel camera-manager">
      <div className="section-heading">
        <div>
          <h2>Camera Manager</h2>
        </div>

        <button type="button" onClick={onCheckCamera} disabled={busy}>
          {busyAction === 'camera-status' ? 'Checking...' : 'Check Camera'}
        </button>
      </div>

      <div className="manager-section">
        <div className="manager-section-header">
          <div>
            <h3>GoPro Scripts</h3>
            <p>Remote paths on the Jetson.</p>
          </div>
        </div>

        <div className="camera-config-grid">
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
        </div>
      </div>

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
              <button type="button" className="secondary" onClick={() => onCameraAction('capture-frame')} disabled={busy}>
                {busyAction === 'camera-capture-frame' ? 'Capturing...' : 'Capture Frame'}
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
              <span>Duration</span>
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
              <span>Pause</span>
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

      <div className="manager-section">
        <div className="manager-section-header">
          <div>
            <h3>Status</h3>
            <p>Dependencies and tmux session state.</p>
          </div>
          <button type="button" className="secondary" onClick={() => onCameraAction('read-logs')} disabled={busy}>
            {busyAction === 'camera-read-logs' ? 'Loading...' : 'Read Logs'}
          </button>
        </div>

        <div className="status-table">
          {cameraStatusRows.map(([key, label]) => (
            <div className="status-row" key={key}>
              <span>{label}</span>
              <div className="status-value">
                <strong>{cameraStatus?.[key] || 'Not checked'}</strong>
              </div>
            </div>
          ))}
        </div>

        {cameraLog ? <pre className="camera-log">{cameraLog}</pre> : null}
      </div>
    </section>
  );
}
