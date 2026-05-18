const cvDependencyRows = [
  ["basePath", "Code Folder"],
  ["conda", "Conda"],
  ["condaEnv", "Conda Env"],
  ["environmentYaml", "Environment YML"],
  ["python", "Python"],
  ["tmux", "tmux"],
  ["opencv", "OpenCV"],
  ["ultralytics", "Ultralytics"],
  ["script", "Detection Script"],
  ["poseModel", "Pose Model"],
  ["benchModel", "Bench Model"],
  ["sittingModel", "Sitting Model"],
];

const STATUS_COLORS = {
  ok: { bg: "#dcfce7", color: "#15803d", border: "#bbf7d0" },
  missing: { bg: "#fee2e2", color: "#b91c1c", border: "#fecaca" },
  running: { bg: "#dcfce7", color: "#15803d", border: "#bbf7d0" },
  waiting: { bg: "#fef9c3", color: "#a16207", border: "#fef08a" },
  stopped: { bg: "#f1f5f9", color: "#475569", border: "#e2e8f0" },
  unknown: { bg: "#f1f5f9", color: "#475569", border: "#e2e8f0" },
  "optional-off": { bg: "#f8fafc", color: "#64748b", border: "#e2e8f0" },
  "Not checked": { bg: "#f1f5f9", color: "#94a3b8", border: "#e2e8f0" },
};

function StatusBadge({ value }) {
  const style = STATUS_COLORS[value] || STATUS_COLORS["Not checked"];
  const display = value || "Not checked";
  return (
    <span
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: "6px",
        color: style.color,
        display: "inline-block",
        fontSize: "0.8rem",
        fontWeight: 700,
        lineHeight: 1,
        padding: "4px 10px",
        whiteSpace: "nowrap",
      }}
    >
      {display}
    </span>
  );
}

export default function ComputerVisionManager({
  cvConfig,
  cvStatus,
  cvLog,
  busyAction,
  onCvConfigChange,
  onCheckCv,
  onCvAction,
}) {
  const busy = Boolean(busyAction);
  const updateConfig = (key, value) =>
    onCvConfigChange({ ...cvConfig, [key]: value });

  return (
    <section className="panel camera-manager">
      <div className="section-heading">
        <div>
          <h2>Computer Vision Manager</h2>
        </div>
        <button type="button" onClick={onCheckCv} disabled={busy}>
          {busyAction === "cv-status" ? "Checking..." : "Check CV"}
        </button>
      </div>

      <section className="manager-section">
        <div className="manager-section-header">
          <div>
            <h3>Run Detection Session</h3>
              <p>Pose model is required. Bench model is optional.</p>
          </div>
        </div>

        <div className="camera-config-grid">
            <label>
              <span>Code Folder</span>
              <input
                value={cvConfig.basePath}
                onChange={(event) => updateConfig("basePath", event.target.value)}
              />
            </label>
            <label>
              <span>Script</span>
              <input
                value={cvConfig.script}
                onChange={(event) => updateConfig("script", event.target.value)}
              />
            </label>
            <label>
              <span>Conda Env Name</span>
              <input
                value={cvConfig.condaEnvName}
                onChange={(event) =>
                  updateConfig("condaEnvName", event.target.value)
                }
              />
            </label>
            <label>
              <span>tmux Session</span>
              <input
                value={cvConfig.session}
                onChange={(event) => updateConfig("session", event.target.value)}
              />
            </label>
            <label>
              <span>Stream URL</span>
              <input
                value={cvConfig.streamUrl}
                onChange={(event) => updateConfig("streamUrl", event.target.value)}
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              <span>Output Folder</span>
              <input
                value={cvConfig.outputPath}
                onChange={(event) => updateConfig("outputPath", event.target.value)}
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              <span>Log Folder</span>
              <input
                value={cvConfig.logPath}
                onChange={(event) => updateConfig("logPath", event.target.value)}
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              <span>Environment YML Path</span>
              <input
                value={cvConfig.environmentYamlPath}
                onChange={(event) =>
                  updateConfig("environmentYamlPath", event.target.value)
                }
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              <span>Pose Model Path (required)</span>
              <input
                value={cvConfig.poseModelPath}
                onChange={(event) => updateConfig("poseModelPath", event.target.value)}
              />
            </label>
            <label className="checkbox-row" style={{ gridColumn: "1 / -1" }}>
              <input
                type="checkbox"
                checked={cvConfig.enableBenchModel}
                onChange={(event) =>
                  updateConfig("enableBenchModel", event.target.checked)
                }
              />
              <span>Enable Bench Model (optional)</span>
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              <span>Bench Model Path</span>
              <input
                value={cvConfig.benchModelPath}
                onChange={(event) =>
                  updateConfig("benchModelPath", event.target.value)
                }
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              <span>Sitting Model Path (required)</span>
              <input
                value={cvConfig.sittingModelPath}
                onChange={(event) =>
                  updateConfig("sittingModelPath", event.target.value)
                }
              />
            </label>
        </div>

        <div className="button-row" style={{ marginTop: "12px" }}>
            <button
              type="button"
              className="secondary"
              onClick={() => onCvAction("setup-env")}
              disabled={busy}
            >
              {busyAction === "cv-setup-env" ? "Setting..." : "Setup Conda Env (plsk)"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => onCvAction("patch-script")}
              disabled={busy}
            >
              {busyAction === "cv-patch-script" ? "Patching..." : "Patch CV Script"}
            </button>
            <button type="button" onClick={() => onCvAction("start")} disabled={busy}>
              {busyAction === "cv-start" ? "Starting..." : "Start CV"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => onCvAction("stop")}
              disabled={busy}
            >
              {busyAction === "cv-stop" ? "Stopping..." : "Stop CV"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => onCvAction("read-logs")}
              disabled={busy}
            >
              {busyAction === "cv-read-logs" ? "Loading..." : "Read Logs"}
            </button>
        </div>
      </section>

      <section className="manager-section">
        <div className="manager-section-header">
          <div>
            <h3>Status</h3>
            <p>Runtime and dependency checks for CV pipeline.</p>
          </div>
        </div>
        <div className="status-table">
          {cvDependencyRows.map(([key, label]) => (
            <div className="status-row" key={key}>
              <span>{label}</span>
              <StatusBadge value={cvStatus?.[key]} />
            </div>
          ))}
          <div className="status-row">
            <span>Session State</span>
            <StatusBadge value={cvStatus?.sessionState} />
          </div>
        </div>
      </section>

      {cvLog ? (
        <div className="camera-log-wrap" style={{ marginTop: "16px" }}>
          <div className="camera-log-header">
            <span>CV tmux Output</span>
          </div>
          <pre className="camera-log">{cvLog}</pre>
        </div>
      ) : null}
    </section>
  );
}
