const LOCAL_DTPR_PATH =
  "C:\\Users\\minth\\MIT Dropbox\\CDDL\\LCAU Benchmark 2\\12_DTPR_website";

const REPO_URL = "https://github.com/civic-data-design-lab/plsk-dtpr";

function Step({ number, title, children }) {
  return (
    <div className="guide-step">
      <span className="guide-step-number">{number}</span>
      <div>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

export default function DtprSetupGuide() {
  return (
    <section className="panel dtpr-setup-guide">
      <div className="section-heading">
        <div>
          <h2>DTPR Website Setup</h2>
        </div>
      </div>

      <div className="guide-intro">
        <p>
          This panel uses the official DTPR template from{" "}
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            civic-data-design-lab/plsk-dtpr
          </a>
          . The workflow is: copy to your own GitHub repo, publish with GitHub
          Pages, open the public URL, then log in as admin and edit website
          settings there.
        </p>
      </div>

      <div className="guide-grid">
        <section className="manager-section">
          <div className="manager-section-header">
            <div>
              <h3>Copy + Publish</h3>
              <p>Recommended public deployment workflow.</p>
            </div>
          </div>

          <div className="guide-steps">
            <Step number="1" title="Copy to your own GitHub repo">
              <p>
                In GitHub, create your own repo and copy the template content
                from <code>civic-data-design-lab/plsk-dtpr</code> into that repo
                (for example by fork or clone/push).
              </p>
            </Step>

            <Step number="2" title="Clone your own repo locally">
              <p>Clone your own repo to this local folder path:</p>
              <pre>{`cd "C:\\Users\\minth\\MIT Dropbox\\CDDL\\LCAU Benchmark 2"\ngit clone https://github.com/<your-username>/<your-repo>.git 12_DTPR_website`}</pre>
              <p>
                Use your repo URL and local folder:
                <code> {LOCAL_DTPR_PATH}</code>.
              </p>
            </Step>

            <Step number="3" title="Publish with GitHub Pages">
              <p>
                In your own repo:{" "}
                <code>
                  Settings - Pages - Deploy from branch - main - /(root)
                </code>
                .
              </p>
            </Step>

            <Step number="4" title="Open the public URL">
              <p>
                Public URL format:
                <code>
                  {" "}
                  https://&lt;username&gt;.github.io/&lt;repo&gt;/home.html
                </code>
                .
              </p>
            </Step>

            <Step number="5" title="Log in as admin on the public site">
              <p>
                On the public website, open <code>settings.html</code>, log in
                with admin, and update project settings there.
              </p>
            </Step>

            <Step number="6" title="Preview locally (optional)">
              <p>Start a static server and open the home page:</p>
              <pre>{`cd "C:\\Users\\minth\\MIT Dropbox\\CDDL\\LCAU Benchmark 2\\12_DTPR_website"\npy -m http.server 8000`}</pre>
              <p>
                Open <code>http://localhost:8000/home.html</code>.
              </p>
            </Step>
          </div>
        </section>

        <section className="manager-section">
          <div className="manager-section-header">
            <div>
              <h3>Admin + A4</h3>
              <p>What users should do after publish.</p>
            </div>
          </div>

          <div className="guide-page-list">
            <div className="guide-page-row">
              <code>settings.html</code>
              <span>
                Admin settings page for project content updates on the public
                site.
              </span>
            </div>
            <div className="guide-page-row">
              <code>signage.html</code>
              <span>
                Download signage assets including the A4 design graphic.
              </span>
            </div>
            <div className="guide-page-row">
              <code>deploy.html</code>
              <span>
                Reference deployment instructions for hosting options.
              </span>
            </div>
          </div>

          <div className="note">
            <strong>A4 design graphic download</strong>
            <p>
              Open <code>signage.html</code> and use the A4 download action in
              that page. Keep this file with your print materials and QR signage
              package.
            </p>
          </div>
        </section>
      </div>
    </section>
  );
}
