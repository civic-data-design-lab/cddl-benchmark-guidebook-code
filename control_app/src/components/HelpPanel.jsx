export default function HelpPanel() {
  return (
    <section className="panel help-panel">
      <div className="section-heading">
        <div>
          <span className="section-number">4</span>
          <h2>Help</h2>
        </div>
      </div>

      <p>If connection fails:</p>
      <ul>
        <li>Make sure the Jetson is powered on.</li>
        <li>Make sure Tailscale is running on both devices.</li>
        <li>Run tailscale status.</li>
        <li>Confirm SSH is enabled on the Jetson.</li>
        <li>Confirm the username is correct.</li>
      </ul>
    </section>
  );
}
