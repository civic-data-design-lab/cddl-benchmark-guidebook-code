function formatNumber(value, suffix = "", digits = 1) {
  if (!Number.isFinite(value)) {
    return "No data";
  }

  return `${value.toFixed(digits)}${suffix}`;
}

function formatBytesPerSecond(value) {
  if (!Number.isFinite(value)) {
    return "No data";
  }

  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)} MB/s`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)} KB/s`;
  }

  return `${Math.round(value)} B/s`;
}

function formatTimestamp(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value || "No timestamp";
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Sparkline({ samples, field, suffix = "", digits = 1 }) {
  const points = samples
    .map((sample, index) => ({ index, value: sample[field] }))
    .filter((point) => Number.isFinite(point.value));

  if (points.length < 2) {
    return <div className="chart-empty">No chart data</div>;
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const maxIndex = Math.max(...points.map((point) => point.index)) || 1;
  const path = points
    .map((point) => {
      const x = (point.index / maxIndex) * 100;
      const y = 34 - ((point.value - min) / span) * 30;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <>
      <svg
        className="sparkline"
        viewBox="0 0 100 36"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polyline points={path} />
      </svg>
      <div className="chart-range">
        <span>{formatNumber(min, suffix, digits)}</span>
        <span>{formatNumber(max, suffix, digits)}</span>
      </div>
    </>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ChartCard({ title, samples, field, suffix, digits }) {
  return (
    <div className="chart-card">
      <h4>{title}</h4>
      <Sparkline
        samples={samples}
        field={field}
        suffix={suffix}
        digits={digits}
      />
    </div>
  );
}

export default function TelemetryDashboard({
  telemetry,
  busyAction,
  onRefreshTelemetry,
}) {
  const samples = telemetry?.samples || [];
  const latest = telemetry?.latest;

  return (
    <section className="telemetry-dashboard">
      <div className="manager-section-header">
        <div>
          <h3>Jetson Status Dashboard</h3>
          <p>
            {latest
              ? `Latest sample ${formatTimestamp(latest.timestamp)}`
              : "Load recent Jetson status log samples."}
          </p>
        </div>

        <button
          type="button"
          onClick={onRefreshTelemetry}
          disabled={Boolean(busyAction)}
        >
          {busyAction === "telemetry" ? "Loading..." : "Load Recent Status"}
        </button>
      </div>

      <div className="metric-grid">
        <MetricCard label="CPU" value={formatNumber(latest?.cpuPercent, "%")} />
        <MetricCard label="RAM" value={formatNumber(latest?.memPercent, "%")} />
        <MetricCard
          label="GPU"
          value={formatNumber(latest?.gpuPercent, "%", 0)}
        />
        <MetricCard
          label="CPU Temp"
          value={formatNumber(latest?.tempCpuC, " C")}
        />
        <MetricCard
          label="Power"
          value={
            Number.isFinite(latest?.powerCurMW)
              ? `${(latest.powerCurMW / 1000).toFixed(2)} W`
              : "No data"
          }
        />
        <MetricCard
          label="Disk Write"
          value={formatBytesPerSecond(latest?.diskWriteBps)}
        />
      </div>

      <div className="chart-grid">
        <ChartCard
          title="CPU %"
          samples={samples}
          field="cpuPercent"
          suffix="%"
        />
        <ChartCard
          title="RAM %"
          samples={samples}
          field="memPercent"
          suffix="%"
        />
        <ChartCard
          title="CPU Temp"
          samples={samples}
          field="tempCpuC"
          suffix=" C"
        />
        <ChartCard
          title="Power"
          samples={samples}
          field="powerCurMW"
          suffix=" mW"
          digits={0}
        />
      </div>

      {telemetry?.logPath ? (
        <p className="telemetry-path">{telemetry.logPath}</p>
      ) : null}
    </section>
  );
}
