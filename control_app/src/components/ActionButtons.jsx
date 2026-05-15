export default function ActionButtons({
  connectionLabel,
  busyAction,
  onTestConnection,
  onOpenTerminal,
  onOpenVSCode,
}) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Remote Access</h2>
        </div>
      </div>

      <div className="connection-state">
        <span>Connection Status</span>
        <strong>{connectionLabel}</strong>
      </div>

      <div className="actions">
        <button type="button" onClick={onTestConnection} disabled={Boolean(busyAction)}>
          {busyAction === 'test' ? 'Testing...' : 'Test Connection'}
        </button>
        <button type="button" className="secondary" onClick={onOpenTerminal} disabled={Boolean(busyAction)}>
          {busyAction === 'terminal' ? 'Opening...' : 'Open SSH Terminal'}
        </button>
        <button type="button" className="secondary" onClick={onOpenVSCode} disabled={Boolean(busyAction)}>
          {busyAction === 'vscode' ? 'Opening...' : 'Open VS Code'}
        </button>
      </div>
    </section>
  );
}
