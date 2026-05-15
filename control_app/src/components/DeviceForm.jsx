export default function DeviceForm({ device, saving, onChange, onSave }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Jetson Device</h2>
        </div>
      </div>

      <form className="device-form" onSubmit={onSave}>
        <label>
          <span>SSH Address</span>
          <input
            value={device.sshAddress}
            onChange={(event) =>
              onChange({ ...device, sshAddress: event.target.value })
            }
            placeholder="min@plsk-jetson-001"
            autoComplete="off"
          />
        </label>

        <label>
          <span>Remote Folder</span>
          <input
            value={device.remotePath}
            onChange={(event) =>
              onChange({ ...device, remotePath: event.target.value })
            }
            placeholder="/home/min"
            autoComplete="off"
          />
        </label>

        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Device"}
        </button>
      </form>
    </section>
  );
}
