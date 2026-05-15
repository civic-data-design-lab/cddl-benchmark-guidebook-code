import { useMemo, useState } from "react";
import TelemetryDashboard from "./TelemetryDashboard.jsx";

const statusRows = [
  { key: "hostname", label: "Hostname" },
  { key: "uptime", label: "Uptime" },
  { key: "load", label: "Load" },
  { key: "memory", label: "Memory" },
  { key: "disks", label: "Disks" },
  { key: "temperature", label: "Temperature" },
  { key: "system", label: "System State" },
  { key: "wifi", label: "Wi-Fi" },
  { key: "ethernet", label: "Ethernet" },
  { key: "bluetooth", label: "Bluetooth" },
];

const listStatusKeys = new Set(["disks", "wifi", "ethernet", "bluetooth"]);

function AccordionSection({ title, summary, open, onToggle, children }) {
  return (
    <section className="accordion-section">
      <button
        type="button"
        className="accordion-trigger"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span>
          <strong>{title}</strong>
          {summary ? <small>{summary}</small> : null}
        </span>
        <span aria-hidden="true">{open ? "-" : "+"}</span>
      </button>

      {open ? <div className="accordion-content">{children}</div> : null}
    </section>
  );
}

function parentPath(path) {
  const normalized = path.replace(/\/+$/, "");
  if (!normalized || normalized === "/") {
    return "/";
  }

  const parent = normalized.slice(0, normalized.lastIndexOf("/")) || "/";
  return parent;
}

function directoryFromFilePath(path) {
  return path.endsWith("/") ? path : parentPath(path);
}

export default function JetsonControlPanel({
  sshAddress,
  jetsonStatus,
  telemetry,
  monitorConfig,
  monitorRunning,
  remoteBrowser,
  wifiNetworks,
  bluetoothDevices,
  busyAction,
  onMonitorConfigChange,
  onCheckMonitorStatus,
  onStartMonitor,
  onStopMonitor,
  onBrowseRemotePath,
  onRefreshStatus,
  onRefreshTelemetry,
  onReboot,
  onScanWifi,
  onConnectWifi,
  onDisconnectWifi,
  onSetWifiPower,
  onScanBluetooth,
  onSetBluetoothPower,
  onBluetoothDeviceAction,
}) {
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [bluetoothAddress, setBluetoothAddress] = useState("");
  const [openSections, setOpenSections] = useState({
    status: true,
    monitor: true,
    connectivity: false,
    power: false,
    telemetry: true,
  });
  const hasStatus = Boolean(jetsonStatus && Object.keys(jetsonStatus).length);
  const busy = Boolean(busyAction);
  const sortedWifiNetworks = useMemo(
    () =>
      [...wifiNetworks].sort(
        (a, b) => Number(b.signal || 0) - Number(a.signal || 0),
      ),
    [wifiNetworks],
  );
  const sortedBluetoothDevices = useMemo(
    () => [...bluetoothDevices].sort((a, b) => a.name.localeCompare(b.name)),
    [bluetoothDevices],
  );

  function connectWifi(event) {
    event.preventDefault();
    onConnectWifi({ ssid: wifiSsid, password: wifiPassword });
  }

  function runBluetoothAction(action) {
    onBluetoothDeviceAction(action, bluetoothAddress);
  }

  function updateMonitorConfig(key, value) {
    onMonitorConfigChange({ ...monitorConfig, [key]: value });
  }

  function toggleSection(section) {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  function selectRemoteEntry(entry) {
    if (entry.type === "directory") {
      onBrowseRemotePath(entry.path);
      return;
    }

    updateMonitorConfig("logPath", entry.path);
  }

  function browseLogFolder() {
    onBrowseRemotePath(
      directoryFromFilePath(monitorConfig.logPath || "/home/lcau"),
    );
  }

  function renderStatusValue(row) {
    const value =
      jetsonStatus?.[row.key] || (hasStatus ? "Unavailable" : "Not loaded");
    const items = listStatusKeys.has(row.key)
      ? value
          .split(";")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

    if (items.length > 1) {
      return (
        <div className="status-value-list">
          {items.map((item) => (
            <strong key={item}>{item}</strong>
          ))}
        </div>
      );
    }

    return <strong>{value}</strong>;
  }

  return (
    <section className="panel control-panel">
      <div className="section-heading">
        <div>
          <h2>Jetson Manager</h2>
        </div>

        <button type="button" onClick={onRefreshStatus} disabled={busy}>
          {busyAction === "jetson-status" ? "Refreshing..." : "Refresh Status"}
        </button>
      </div>

      <div className="connection-state">
        <span>Target Jetson</span>
        <strong>{sshAddress || "Not configured"}</strong>
      </div>

      <div className="accordion-stack">
        <AccordionSection
          title="System Status"
          summary={
            hasStatus
              ? "Last refreshed values"
              : "Refresh Jetson hardware and network state"
          }
          open={openSections.status}
          onToggle={() => toggleSection("status")}
        >
          <div className="status-table" aria-live="polite">
            {statusRows.map((row) => (
              <div className="status-row" key={row.key}>
                <span>{row.label}</span>
                <div className="status-value">{renderStatusValue(row)}</div>
              </div>
            ))}
          </div>
        </AccordionSection>

        <AccordionSection
          title="Monitor Logging"
          summary={
            monitorRunning
              ? "Monitor running"
              : "Configure CSV logging and telemetry source"
          }
          open={openSections.monitor}
          onToggle={() => toggleSection("monitor")}
        >
          <div className="manager-section-header">
            <div>
              <h3>Run Monitor</h3>
              <p>
                {monitorRunning === null
                  ? "Status not checked"
                  : monitorRunning
                    ? "Running"
                    : "Stopped"}
              </p>
            </div>

            <div className="compact-actions">
              <button
                type="button"
                className="secondary"
                onClick={onCheckMonitorStatus}
                disabled={busy}
              >
                {busyAction === "monitor-status" ? "Checking..." : "Check"}
              </button>
              <button type="button" onClick={onStartMonitor} disabled={busy}>
                {busyAction === "monitor-start" ? "Starting..." : "Run Monitor"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={onStopMonitor}
                disabled={busy}
              >
                {busyAction === "monitor-stop" ? "Stopping..." : "Stop"}
              </button>
            </div>
          </div>

          <div className="monitor-form">
            <label>
              <span>Log CSV Path</span>
              <input
                value={monitorConfig.logPath}
                onChange={(event) =>
                  updateMonitorConfig("logPath", event.target.value)
                }
                placeholder="/home/lcau/jetson_status_log.csv"
                autoComplete="off"
              />
            </label>

            <label>
              <span>Interval Seconds</span>
              <input
                type="number"
                min="5"
                max="3600"
                value={monitorConfig.intervalSeconds}
                onChange={(event) =>
                  updateMonitorConfig(
                    "intervalSeconds",
                    Number(event.target.value),
                  )
                }
              />
            </label>

            <label>
              <span>tmux Session</span>
              <input
                value={monitorConfig.sessionName}
                onChange={(event) =>
                  updateMonitorConfig("sessionName", event.target.value)
                }
                placeholder="plsk_monitor"
                autoComplete="off"
              />
            </label>
          </div>

          <div className="file-browser">
            <div className="file-browser-header">
              <strong>{remoteBrowser.path}</strong>
              <div className="compact-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={browseLogFolder}
                  disabled={busy}
                >
                  {busyAction === "browse-path"
                    ? "Loading..."
                    : "Browse Log Folder"}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    onBrowseRemotePath(parentPath(remoteBrowser.path))
                  }
                  disabled={busy || remoteBrowser.path === "/"}
                >
                  Up
                </button>
              </div>
            </div>

            <div className="file-list">
              {remoteBrowser.entries.length ? (
                remoteBrowser.entries.map((entry) => (
                  <button
                    type="button"
                    className={
                      entry.type === "directory"
                        ? "file-entry directory"
                        : "file-entry"
                    }
                    key={entry.path}
                    onClick={() => selectRemoteEntry(entry)}
                    disabled={busy}
                  >
                    <span>
                      {entry.type === "directory" ? "Folder" : "File"}
                    </span>
                    <strong>{entry.name}</strong>
                  </button>
                ))
              ) : (
                <p>No folder loaded yet.</p>
              )}
            </div>
          </div>
        </AccordionSection>

        <AccordionSection
          title="Connectivity"
          summary="Wi-Fi and Bluetooth controls"
          open={openSections.connectivity}
          onToggle={() => toggleSection("connectivity")}
        >
          <div className="manager-grid">
            <section className="manager-section">
              <div className="manager-section-header">
                <h3>Wi-Fi</h3>
                <div className="compact-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={onScanWifi}
                    disabled={busy}
                  >
                    {busyAction === "wifi-scan" ? "Scanning..." : "Scan"}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => onSetWifiPower("on")}
                    disabled={busy}
                  >
                    On
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => onSetWifiPower("off")}
                    disabled={busy}
                  >
                    Off
                  </button>
                </div>
              </div>

              <form className="manager-form" onSubmit={connectWifi}>
                <label>
                  <span>Network</span>
                  <select
                    value={wifiSsid}
                    onChange={(event) => setWifiSsid(event.target.value)}
                  >
                    <option value="">Select or type a network</option>
                    {sortedWifiNetworks.map((network) => (
                      <option key={network.ssid} value={network.ssid}>
                        {network.ssid} ({network.signal || "?"}%,{" "}
                        {network.security})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>SSID</span>
                  <input
                    value={wifiSsid}
                    onChange={(event) => setWifiSsid(event.target.value)}
                    placeholder="Network name"
                    autoComplete="off"
                  />
                </label>

                <label>
                  <span>Password</span>
                  <input
                    type="password"
                    value={wifiPassword}
                    onChange={(event) => setWifiPassword(event.target.value)}
                    placeholder="Leave blank for open networks"
                    autoComplete="new-password"
                  />
                </label>

                <div className="button-row">
                  <button type="submit" disabled={busy || !wifiSsid}>
                    {busyAction === "wifi-connect"
                      ? "Connecting..."
                      : "Connect Wi-Fi"}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={onDisconnectWifi}
                    disabled={busy}
                  >
                    {busyAction === "wifi-disconnect"
                      ? "Disconnecting..."
                      : "Disconnect"}
                  </button>
                </div>
              </form>
            </section>

            <section className="manager-section">
              <div className="manager-section-header">
                <h3>Bluetooth</h3>
                <div className="compact-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={onScanBluetooth}
                    disabled={busy}
                  >
                    {busyAction === "bluetooth-scan" ? "Scanning..." : "Scan"}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => onSetBluetoothPower("on")}
                    disabled={busy}
                  >
                    On
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => onSetBluetoothPower("off")}
                    disabled={busy}
                  >
                    Off
                  </button>
                </div>
              </div>

              <div className="manager-form">
                <label>
                  <span>Device</span>
                  <select
                    value={bluetoothAddress}
                    onChange={(event) =>
                      setBluetoothAddress(event.target.value)
                    }
                  >
                    <option value="">Select or type an address</option>
                    {sortedBluetoothDevices.map((device) => (
                      <option key={device.address} value={device.address}>
                        {device.name} ({device.address})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Address</span>
                  <input
                    value={bluetoothAddress}
                    onChange={(event) =>
                      setBluetoothAddress(event.target.value)
                    }
                    placeholder="AA:BB:CC:DD:EE:FF"
                    autoComplete="off"
                  />
                </label>

                <div className="button-row">
                  <button
                    type="button"
                    onClick={() => runBluetoothAction("pair")}
                    disabled={busy || !bluetoothAddress}
                  >
                    {busyAction === "bluetooth-pair" ? "Pairing..." : "Pair"}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => runBluetoothAction("connect")}
                    disabled={busy || !bluetoothAddress}
                  >
                    {busyAction === "bluetooth-connect"
                      ? "Connecting..."
                      : "Connect"}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => runBluetoothAction("disconnect")}
                    disabled={busy || !bluetoothAddress}
                  >
                    {busyAction === "bluetooth-disconnect"
                      ? "Disconnecting..."
                      : "Disconnect"}
                  </button>
                </div>
              </div>
            </section>
          </div>
        </AccordionSection>

        <AccordionSection
          title="Power"
          summary="Restart device"
          open={openSections.power}
          onToggle={() => toggleSection("power")}
        >
          <div className="power-actions">
            <div>
              <h3>Power</h3>
              <p>
                {busyAction === "reboot" ? "Sending reboot signal..." : "Ready"}
              </p>
            </div>

            <button
              type="button"
              className="danger"
              onClick={onReboot}
              disabled={busy}
            >
              Reboot Jetson
            </button>
          </div>
        </AccordionSection>

        <AccordionSection
          title="Jetson Status Dashboard"
          summary={
            telemetry.latest
              ? "Recent log trends loaded"
              : "Load monitor data from CSV"
          }
          open={openSections.telemetry}
          onToggle={() => toggleSection("telemetry")}
        >
          <TelemetryDashboard
            telemetry={telemetry}
            busyAction={busyAction}
            onRefreshTelemetry={onRefreshTelemetry}
          />
        </AccordionSection>
      </div>
    </section>
  );
}
