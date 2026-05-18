const pages = [
  { id: 'setup', label: 'Setup' },
  { id: 'access', label: 'Remote Access' },
  { id: 'control', label: 'Jetson Manager' },
  { id: 'camera', label: 'Camera Manager' },
  { id: 'dtpr', label: 'DTPR Website' },
];

export default function Header({ activePage, onPageChange }) {
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">Jetson remote access</p>
        <h1>Public Life Sensor Kit Manager</h1>
        <p className="subtitle">Connect to your Jetson through Tailscale and SSH.</p>

        <nav className="page-nav" aria-label="App sections">
          {pages.map((page) => (
            <button
              key={page.id}
              type="button"
              className={activePage === page.id ? 'active' : ''}
              onClick={() => onPageChange(page.id)}
            >
              {page.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
