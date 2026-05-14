/**
 * ============================================================
 *  DTPR PLATFORM — PROJECT CONFIGURATION
 *  Edit this file (or use the Settings panel) to customize
 *  the entire website without touching any HTML.
 * ============================================================
 */

const DTPR_CONFIG = {
  /* ── Project Identity ──────────────────────────────────── */
  projectName: "Your Project Name",
  projectTagline: "A short, compelling tagline for your project",
  projectDescription: `Enter Admin mode (Ctrl+Shift+A) to edit hompage content.
    Replace this with a description of your data collection project.
    Explain what you are studying, where it takes place, who is involved,
    and what the data will be used for. This text appears on the public-facing
    home page and on the printed signage.`,
  projectFunding: "This project is funded by [Your Funding Organisation].",

  /* ── Admin Access ───────────────────────────────────────── */
  adminPassword: "dtpr2024", // ← Change this before hosting!
  adminNavHidden: true, // true = hide admin links from public navbar

  /* ── Branding ───────────────────────────────────────────── */
  heroBackground: "assets/source/background_image_sample.png",
  accentColor: "#1a73e8",
  signageColor: "#c85f98",

  /* ── Navigation Links ───────────────────────────────────── */
  /* adminOnly: true  →  hidden from public; shown only after admin login */
  navLinks: [
    { label: "Home", href: "home.html", newTab: false },
    { label: "DTPR", href: "index.html", newTab: false },
    {
      label: "Settings",
      href: "settings.html",
      newTab: false,
      adminOnly: true,
    },
    { label: "Signage", href: "signage.html", newTab: false, adminOnly: true },
    {
      label: "Deploy Guide",
      href: "deploy.html",
      newTab: false,
      adminOnly: true,
    },
  ],

  /* ── Survey / Qualitative Tool URL ─────────────────────── */
  surveyUrl: "https://your-survey-tool.com/your-form", // ← Replace with your Qualtrics / Google Forms / etc. URL
  surveyLabel: "Participate in our Survey",

  /* ── External / Related Links ───────────────────────────── */
  externalLinks: [
    {
      label: "Learn More",
      href: "https://your-organisation.org",
      newTab: true,
    },
  ],

  /* ── Footer Text Links ────────────────────────────────────────── */
  footerLinks: [
    { label: "Your Organisation", href: "https://your-organisation.org" },
    { label: "Partner Organisation", href: "https://partner.org" },
  ],

  /* ── DTPR Cards ─────────────────────────────────────────── */
  dtprSections: [
    {
      sectionTitle: "What type of technology is this?",
      cards: [
        {
          icon: "assets/source/logo/De-identified%20vedio.svg",
          title: "De-identified video",
          text: "Collects video footage of a sufficient resolution where individuals can be identified, for example by capturing images of faces or unique numbers such as vehicle license plates. However, the video is processed in a way that removes identifying characteristics before it is used or stored (known as de-identified before first use or de-identified on device), for example by blurring faces using computer vision.",
        },
        {
          icon: "assets/source/logo/Person%20detection.svg",
          title: "Person detection",
          text: "Refers to when a system can detect the presence of humans in images or videos, and identify where they are located or how many there are in an image, but does not identify individuals. The technology does not retain or use any personally identifiable information.",
        },
        {
          icon: "assets/source/logo/Motion%20detector.svg",
          title: "Motion detector",
          text: "Is a sensor that detects the movement of nearby objects. This project uses motion detection only for lighting and does not capture data.",
        },
      ],
    },
    {
      sectionTitle: "What is the purpose of this technology?",
      cards: [
        {
          icon: "assets/source/logo/Planning%20%26%20Decision-making.svg",
          title: "Planning & Decision-making",
          text: "Supports the development of future plans; or to enable or measure the impact of a decision. Examples include urban planning.",
        },
        {
          icon: "assets/source/logo/Research%20%26%20Development.svg",
          title: "Research & Development",
          text: "Supports exploratory research and testing.",
        },
      ],
    },
    {
      sectionTitle: "How will this data be processed?",
      cards: [
        {
          icon: "assets/source/logo/Artificial%20Intelligent.svg",
          title: "Artificial intelligence",
          text: "Data that is processed by automated, algorithmic or artificial intelligence systems to derive a new result or data point. Specifically, we use computer vision, which refers to computer science methodologies that enable computers to derive data from digital images or video. We process our de-identified video with the YOLOv8 algorithm.",
        },
        {
          icon: "assets/source/logo/Reviewed%20internally.svg",
          title: "Reviewed internally",
          text: "This project has review processes that consider the potential benefits, risks and implications for privacy and harm for new technologies or data collection activities. The team continuously assesses the data for accuracy and bias.",
        },
      ],
    },
    {
      sectionTitle: "How is the data stored?",
      cards: [
        {
          icon: "assets/source/logo/Cloud%20Storage.svg",
          title: "Cloud storage",
          text: "Anonymized data is stored on behalf of the organization or the data collector in an off-site data centre managed by a trusted cloud provider.",
        },
        {
          icon: "assets/source/logo/Encrypted.svg",
          title: "Encrypted",
          text: "Data has been encoded so that only authorized parties can access it, which can reduce risk related to handling private or sensitive information.",
        },
      ],
    },
    {
      sectionTitle: "Who can access this data?",
      cards: [
        {
          icon: "assets/source/logo/Access.svg",
          title: "Data access",
          text: "Data is available to the accountable organisation and any named partner organisations involved in the project. It is not shared with third parties without consent.",
        },
      ],
    },
  ],
};

/* Merge saved settings from localStorage over defaults */
(function () {
  const saved = localStorage.getItem("dtpr_settings");
  if (saved) {
    try {
      const overrides = JSON.parse(saved);
      if (overrides.heroBackground === "assets/backgroundImage.jpg") {
        delete overrides.heroBackground;
      }
      Object.assign(DTPR_CONFIG, overrides);
    } catch (e) {
      /* ignore corrupt data */
    }
  }
})();
