/*
 * ─────────────────────────────────────────────────────────────
 *  TRIP CONFIG — the only file you need to edit after setup.
 * ─────────────────────────────────────────────────────────────
 *  API_URL : the "Web app URL" you get when you deploy backend/Code.gs
 *            (looks like https://script.google.com/macros/s/AKfy.../exec).
 *            Leave it "" and the site still works, but each phone keeps
 *            its own copy (no sharing between people).
 *
 *  Do NOT put the trip passcode here — this file is public on GitHub.
 *  Everyone types the passcode once on their phone; it stays on that phone.
 */
window.TRIP_CONFIG = {
  API_URL: "",
  POLL_SECONDS: 30,          // how often phones check for other people's edits
  LOCAL_VERSION_MINUTES: 10, // keep an on-phone restore point at most this often
  LOCAL_VERSIONS_KEEP: 20
};
