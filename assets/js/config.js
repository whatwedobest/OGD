/* OpenGate Data — form intake settings.

   intakeEnabled: false  → forms validate, then show a beta notice and send nothing
                           (use this on any host without the /api functions, e.g. GitHub Pages).
   intakeEnabled: true   → forms send to the secure intake on this same site:
                           statements upload straight to private storage (/api/upload),
                           then the details go to /api/submit, which creates the monday.com
                           item with secure, expiring links to the files (never attachments). */
window.OGD_CONFIG = {
  intakeEnabled: false,
  apiBase: "/api",
  bookingUrl: "https://calendar.app.google/JTbyWT2rURonvT2TA"
};
