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
              In GitHub, create your own repo and copy the template content from{" "}
              <code>civic-data-design-lab/plsk-dtpr</code> into that repo (for
              example by fork or clone/push).
            </p>
          </Step>

          <Step number="2" title="Open the public URL">
            <p>
              Public URL format:
              <code>
                {" "}
                https://&lt;username&gt;.github.io/&lt;repo&gt;/home.html
              </code>
              .
            </p>
          </Step>

          <Step number="3" title="Log in as admin on the public site">
            <p>
              Open <code>settings.html</code> on the public website, then log in
              using the admin password configured in <code>js/config.js</code> (
              <code>adminPassword</code>).
            </p>
            <p>
              If unchanged, the default password is <code>dtpr2024</code>.
            </p>
          </Step>
        </div>
      </section>

      <section className="manager-section">
        <div className="manager-section-header">
          <div>
            <h3>Signage</h3>
            <p>Design file download.</p>
          </div>
        </div>

        <div className="note">
          <strong>Download design file</strong>
          <p>
            Log in as admin, go to the Signage tab, then download the editable
            signage design file.
          </p>
        </div>
      </section>
    </section>
  );
}
