/**
 * DTPR Platform — Core App Engine + Admin Auth
 * ============================================================
 * Admin pages (Settings, Signage, Deploy Guide) are hidden
 * from the public. Access is unlocked by:
 *   1. Clicking the project name in the navbar 5 times quickly, OR
 *   2. Pressing  Ctrl + Shift + A  on any page, OR
 *   3. Navigating directly to an admin URL (password prompt shown)
 *
 * Admin session is stored in sessionStorage (cleared on tab close).
 * ============================================================
 */

/* ── Admin session helpers ────────────────────────────────── */
const ADMIN_KEY   = 'dtpr_admin_session';
const ADMIN_PAGES = ['settings.html', 'signage.html', 'deploy.html'];

function isAdminPage() {
  const page = location.pathname.split('/').pop();
  return ADMIN_PAGES.includes(page);
}

function isAdminUnlocked() {
  return sessionStorage.getItem(ADMIN_KEY) === '1';
}

function unlockAdmin() {
  sessionStorage.setItem(ADMIN_KEY, '1');
}

function lockAdmin() {
  sessionStorage.removeItem(ADMIN_KEY);
}

/* ── Password modal (injected dynamically) ────────────────── */
function showPasswordModal(onSuccess, onCancel) {
  // Remove any existing modal
  const existing = document.getElementById('admin-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'admin-modal-overlay';
  overlay.innerHTML = `
    <div id="admin-modal">
      <div id="admin-modal-icon">🔒</div>
      <h2 id="admin-modal-title">Admin Access</h2>
      <p id="admin-modal-sub">This page is restricted. Enter the admin password to continue.</p>
      <input type="password" id="admin-pw-input" placeholder="Password" autocomplete="off"
             aria-label="Admin password">
      <p id="admin-pw-error" class="admin-pw-error" style="display:none">
        ✗ Incorrect password. Please try again.
      </p>
      <div id="admin-modal-btns">
        <button id="admin-pw-cancel">Cancel</button>
        <button id="admin-pw-submit">Unlock</button>
      </div>
      <p id="admin-modal-hint">Hint: set your password in <code>js/config.js</code></p>
    </div>`;
  document.body.appendChild(overlay);

  const input  = document.getElementById('admin-pw-input');
  const error  = document.getElementById('admin-pw-error');
  const submit = document.getElementById('admin-pw-submit');
  const cancel = document.getElementById('admin-pw-cancel');

  input.focus();

  function attempt() {
    if (input.value === DTPR_CONFIG.adminPassword) {
      unlockAdmin();
      overlay.remove();
      onSuccess && onSuccess();
    } else {
      error.style.display = 'block';
      input.value = '';
      input.focus();
      input.classList.add('shake');
      setTimeout(() => input.classList.remove('shake'), 500);
    }
  }

  submit.addEventListener('click', attempt);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') attempt(); });
  cancel.addEventListener('click', () => {
    overlay.remove();
    onCancel && onCancel();
  });

  // Close on backdrop click
  overlay.addEventListener('click', e => {
    if (e.target === overlay) { overlay.remove(); onCancel && onCancel(); }
  });
}

/* ── Page guard — blocks admin pages for non-admins ──────── */
function guardAdminPage() {
  if (!isAdminPage()) return;          // not an admin page, skip
  if (isAdminUnlocked()) return;       // already authenticated

  // Block page: blur content, show modal immediately
  document.body.style.filter = 'blur(6px)';
  document.body.style.pointerEvents = 'none';

  // Wait for DOM then show modal
  function showGuard() {
    document.body.style.filter = '';
    document.body.style.pointerEvents = '';
    showPasswordModal(
      () => { /* success — stay on page */ },
      () => { /* cancelled — go back to home */ window.location.href = 'home.html'; }
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showGuard);
  } else {
    showGuard();
  }
}

/* ── Escape text for safe insertion into HTML templates ───── */
function escapeHtml(text) {
  const s = String(text ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Navbar brand click (5 quick clicks = unlock prompt) ─── */
let logoClickCount = 0;
let logoClickTimer = null;

function setupLogoUnlock() {
  const brand = document.querySelector('#dtpr-navbar .navbar-brand');
  if (!brand) return;

  brand.addEventListener('click', e => {
    if (isAdminPage() || isAdminUnlocked()) return;

    e.preventDefault();
    logoClickCount++;
    clearTimeout(logoClickTimer);

    brand.style.transform = `scale(${1 + logoClickCount * 0.04})`;
    setTimeout(() => { brand.style.transform = ''; }, 200);

    if (logoClickCount >= 5) {
      logoClickCount = 0;
      showPasswordModal(() => {
        showAdminToast('Admin mode unlocked! Admin links are now visible.');
        renderNavbar();
        highlightActiveNav();
        setupLogoUnlock();
      });
    } else {
      logoClickTimer = setTimeout(() => {
        logoClickCount = 0;
        brand.style.transform = '';
      }, 2000);
    }
  });
}

/* ── Keyboard shortcut: Ctrl + Shift + A ─────────────────── */
function setupKeyboardShortcut() {
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && e.key === 'A') {
      e.preventDefault();
      if (isAdminUnlocked()) {
        // Toggle: lock admin
        lockAdmin();
        showAdminToast('Admin mode locked.');
        renderNavbar();
        highlightActiveNav();
        setupLogoUnlock();
      } else {
        showPasswordModal(() => {
          showAdminToast('Admin mode unlocked via keyboard shortcut.');
          renderNavbar();
          highlightActiveNav();
          setupLogoUnlock();
        });
      }
    }
  });
}

/* ── Admin toast notification ─────────────────────────────── */
function showAdminToast(msg) {
  const old = document.getElementById('admin-toast');
  if (old) old.remove();

  const toast = document.createElement('div');
  toast.id = 'admin-toast';
  toast.innerHTML = `<span>🔓</span> ${msg}`;
  document.body.appendChild(toast);

  setTimeout(() => { toast.classList.add('visible'); }, 50);
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

/* ── Helpers ──────────────────────────────────────────────── */
function applyAccentColor(color) {
  const c = (color || '#1a73e8').trim();
  document.documentElement.style.setProperty('--accent', c);
  let r = 26, g = 115, b = 232;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = h.split('').map(ch => ch + ch).join('');
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
  }
  const rgb = `${r}, ${g}, ${b}`;
  document.documentElement.style.setProperty('--accent-rgb', rgb);
  document.documentElement.style.setProperty('--bs-primary-rgb', rgb);
}

/* ── Render Navbar ────────────────────────────────────────── */
function renderNavbar() {
  const nav = document.getElementById('dtpr-navbar');
  if (!nav) return;
  applyAccentColor(DTPR_CONFIG.accentColor);

  const adminUnlocked = isAdminUnlocked();
  const showAdmin     = adminUnlocked || !DTPR_CONFIG.adminNavHidden;

  // Filter nav links based on admin state
  const visibleLinks = (DTPR_CONFIG.navLinks || []).filter(l => {
    if (l.adminOnly && !showAdmin) return false;
    return true;
  });

  // Admin badge shown when unlocked
  const adminBadge = adminUnlocked
    ? `<li class="nav-item">
         <span class="admin-badge" title="Admin mode active. Press Ctrl+Shift+A to lock.">
           🔓 Admin
         </span>
       </li>`
    : '';

  nav.innerHTML = `
    <div class="container px-lg-5">
      <a class="navbar-brand" href="home.html" title="${!isAdminPage() && DTPR_CONFIG.adminNavHidden ? 'Tip: click 5× for admin access' : ''}">
        ${escapeHtml(DTPR_CONFIG.projectName)}
      </a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse"
        data-bs-target="#navbarContent" aria-controls="navbarContent"
        aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarContent">
        <ul class="navbar-nav ms-auto mb-2 mb-lg-1">
          ${visibleLinks.map(l =>
            `<li class="nav-item">
              <a class="nav-link${l.adminOnly ? ' admin-nav-link' : ''}" href="${l.href}"${l.newTab ? ' target="_blank"' : ''}>${l.label}</a>
            </li>`
          ).join('')}
          ${adminBadge}
        </ul>
      </div>
    </div>`;
}

/* ── Render Footer ────────────────────────────────────────── */
function renderFooter() {
  const footer = document.getElementById('dtpr-footer');
  if (!footer) return;

  const links = (DTPR_CONFIG.footerLinks || []).map(l =>
    `<p class="m-1 text-center site-footer-link-wrap">
       <a href="${l.href}" target="_blank" class="site-footer-link">${l.label}</a>
     </p>`
  ).join('');

  footer.innerHTML = `
    <div class="container p-2">
      ${links}
      <p class="m-1 text-center site-footer-note">
        The <a href="https://dtpr.io/" target="_blank" class="site-footer-link">DTPR Icons Design Guide and Taxonomy</a>
        are licensed under
        <a href="https://creativecommons.org/licenses/by/4.0/legalcode" target="_blank" class="site-footer-link">CC BY 4.0</a>.
      </p>
    </div>`;
}

/* ── Render DTPR Cards (index.html) ───────────────────────── */
function renderDtprCards() {
  const container = document.getElementById('dtpr-cards');
  if (!container) return;

  const sections = DTPR_CONFIG.dtprSections || [];
  let html = '';

  sections.forEach((section, sIdx) => {
    const sectionId = `dtpr-section-${sIdx}`;
    const num = String(sIdx + 1).padStart(2, '0');

    html += `
      <section class="dtpr-section" id="${sectionId}">
        <div class="dtpr-section-header">
          <span class="dtpr-section-num">${num}</span>
          <h2 class="dtpr-section-title">${section.sectionTitle}</h2>
        </div>
        <div class="dtpr-cards-grid">`;

    section.cards.forEach(card => {
      html += `
          <div class="dtpr-card">
            <div class="dtpr-card-icon-wrap">
              <img class="dtpr-card-icon" src="${card.icon}" alt="${card.title}">
            </div>
            <div class="dtpr-card-body">
              <h3 class="dtpr-card-title">${card.title}</h3>
              <p class="dtpr-card-text">${card.text}</p>
            </div>
          </div>`;
    });

    html += `
        </div>
      </section>`;
  });

  container.innerHTML = html;

  /* Populate section quick-nav pills */
  const nav = document.getElementById('dtpr-section-nav');
  if (nav) {
    nav.innerHTML = sections.map((s, i) =>
      `<a href="#dtpr-section-${i}" class="dtpr-nav-pill">
         <span class="dtpr-nav-num">${String(i+1).padStart(2,'0')}</span>
         ${s.sectionTitle}
       </a>`
    ).join('');

    /* Smooth scroll + active pill highlighting */
    nav.querySelectorAll('.dtpr-nav-pill').forEach(pill => {
      pill.addEventListener('click', e => {
        e.preventDefault();
        const target = document.querySelector(pill.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    /* Intersection observer for active pill */
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          nav.querySelectorAll('.dtpr-nav-pill').forEach(p => p.classList.remove('active'));
          const active = nav.querySelector(`[href="#${entry.target.id}"]`);
          if (active) active.classList.add('active');
        }
      });
    }, { threshold: 0.3 });

    document.querySelectorAll('.dtpr-section').forEach(sec => observer.observe(sec));
  }
}

/* ── Render Hero (home.html) ──────────────────────────────── */
function renderHero() {
  const hero = document.getElementById('dtpr-hero');
  if (!hero) return;

  hero.style.backgroundImage = `url('${DTPR_CONFIG.heroBackground}')`;

  const title = document.getElementById('hero-title');
  if (title) title.textContent = DTPR_CONFIG.projectName;

  const desc = document.getElementById('hero-description');
  if (desc) desc.textContent = DTPR_CONFIG.projectDescription;

  const funding = document.getElementById('hero-funding');
  if (funding) funding.textContent = DTPR_CONFIG.projectFunding;

  const survey = document.getElementById('hero-survey-btn');
  if (survey) { survey.href = DTPR_CONFIG.surveyUrl; survey.textContent = DTPR_CONFIG.surveyLabel; }
}

/* ── Page title ───────────────────────────────────────────── */
function setPageTitle(suffix) {
  document.title = DTPR_CONFIG.projectName + (suffix ? ' — ' + suffix : '');
}

/* ── Highlight active nav link ────────────────────────────── */
function highlightActiveNav() {
  const page = location.pathname.split('/').pop() || 'home.html';
  document.querySelectorAll('#dtpr-navbar .nav-link').forEach(a => {
    a.classList.remove('active');
    a.removeAttribute('aria-current');
    if (a.getAttribute('href') === page) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
  });
}

/* ── Bootstrap everything on DOM ready ───────────────────── */

// Run page guard immediately (before DOM ready) to avoid flash
guardAdminPage();

document.addEventListener('DOMContentLoaded', () => {
  applyAccentColor(DTPR_CONFIG.accentColor);
  renderNavbar();
  renderFooter();
  renderDtprCards();
  renderHero();
  highlightActiveNav();
  setPageTitle();
  setupLogoUnlock();
  setupKeyboardShortcut();

  // If we're on an admin page and just authenticated, remove blur
  if (isAdminPage() && isAdminUnlocked()) {
    document.body.style.filter = '';
    document.body.style.pointerEvents = '';
  }
});
