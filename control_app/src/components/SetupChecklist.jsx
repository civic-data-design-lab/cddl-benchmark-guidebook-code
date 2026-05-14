const TOOL_LABELS = {
  tailscale: 'Tailscale',
  ssh: 'SSH',
  code: 'VS Code CLI',
};

function ToolRow({ name, result }) {
  const installed = Boolean(result?.installed);

  return (
    <div className="tool-row">
      <span>{TOOL_LABELS[name]}</span>
      <strong className={installed ? 'installed' : 'missing'}>{installed ? 'Installed' : 'Missing'}</strong>
    </div>
  );
}

export default function SetupChecklist({
  dependencies,
  tailscaleStatus,
  checking,
  checkingStatus,
  onRunCheck,
  onTailscaleStatus,
}) {
  const hasDependencies = Boolean(dependencies);

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <span className="section-number">1</span>
          <h2>Local Setup</h2>
        </div>
        <button type="button" onClick={onRunCheck} disabled={checking}>
          {checking ? 'Checking...' : 'Run Setup Check'}
        </button>
      </div>

      <div className="checklist">
        <ToolRow name="tailscale" result={dependencies?.tailscale} />
        <ToolRow name="ssh" result={dependencies?.ssh} />
        <ToolRow name="code" result={dependencies?.code} />
      </div>

      {hasDependencies && !dependencies.code.installed ? (
        <div className="note">
          <strong>VS Code CLI is missing.</strong>
          <p>Open VS Code, press Cmd/Ctrl + Shift + P, then run: Shell Command: Install 'code' command in PATH.</p>
        </div>
      ) : null}

      {hasDependencies && !dependencies.tailscale.installed ? (
        <div className="note warning">
          <strong>Tailscale is missing on this laptop.</strong>
          <p>Install Tailscale here too, log in with the same Tailscale account as the Jetson, and run the setup check again.</p>
        </div>
      ) : null}

      <div className="tailscale-status">
        <button type="button" className="secondary" onClick={onTailscaleStatus} disabled={checkingStatus}>
          {checkingStatus ? 'Reading status...' : 'Show Tailscale Status'}
        </button>
        {tailscaleStatus ? <pre>{tailscaleStatus}</pre> : null}
      </div>
    </section>
  );
}
