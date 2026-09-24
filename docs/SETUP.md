# Setup: about 25 minutes, once, on a laptop

Do this **before you leave**. After this, everything runs from phones.
You need: a **GitHub** account and a **Google** account (the one whose Drive will hold the data).

> ✅ = check before moving on. If anything goes wrong, see **Troubleshooting** at the bottom.

---

## 1 · Put the code on GitHub (5 min)

1. On github.com, click **＋ → New repository**. Name it `goa-trip-planner` and choose **Public**, because free GitHub Pages needs public. Don't add a README, then click **Create**.
2. On your laptop, in the unzipped `goa-trip-planner` folder:
   ```bash
   git init
   git add .
   git commit -m "Goa trip planner"
   git branch -M main
   git remote add origin https://github.com/<YOUR-USERNAME>/goa-trip-planner.git
   git push -u origin main
   ```
   *No git?* Install **GitHub Desktop**, then choose *File → Add local repository → Publish*. Avoid drag-and-drop upload in the browser: it skips the hidden `.github` folder that holds the automations.
3. Go to **Settings → Pages → Build and deployment**. Set **Source: Deploy from a branch**, **Branch: `main` / `(root)`**, then **Save**.
4. ✅ After 1–2 minutes, `https://<YOUR-USERNAME>.github.io/goa-trip-planner/` opens the planner. At this point it works on one phone only; step 3 turns on sharing.

## 2 · Create the backend in Google Apps Script (10 min)

1. Open **https://script.google.com** and click **New project**. Rename it (top left) to **Goa Trip Backend**.
2. In the editor, **replace everything** in `Code.gs` with the contents of [`backend/Code.gs`](../backend/Code.gs).
3. Click **＋ (Files) → Script** and name it `TripData`. Replace its contents with [`backend/TripData.gs`](../backend/TripData.gs).
4. Click ⚙️ **Project Settings**. Scroll to **Script properties → Add script property**:
   | Property | Value |
   |---|---|
   | `TRIP_PASSCODE` | a passcode you'll share with the group, e.g. `sunset-goa-26` |
   *(optional, step 5)* `PLACES_API_KEY`
5. *(Recommended)* Still in ⚙️, tick **Show "appsscript.json" manifest file**. Go back to the editor and replace that file's contents with [`backend/appsscript.json`](../backend/appsscript.json).
6. Back in the editor, choose **`setup`** from the function dropdown and click **▶ Run**.
   Google asks for permission. Choose your account → **Advanced → Go to Goa Trip Backend (unsafe) → Allow**. It says "unsafe" only because you wrote the script yourself and Google hasn't reviewed it.
   ✅ The log shows links to the **Drive folder** "Goa Trip Planner" and the **Live Sheet**.
7. Click **Deploy → New deployment → ⚙️ → Web app**:
   - Description: `v1`
   - **Execute as: Me**
   - **Who has access: Anyone** (the passcode protects the data)
   - Click **Deploy** and copy the **Web app URL** (`https://script.google.com/macros/s/AKfy…/exec`).
8. ✅ Open that URL with `?action=ping` added to the end in a browser. You should see `{"ok":true,…}`.

## 3 · Connect the website to the backend (2 min)

1. In the repo on GitHub, open **`assets/config.js` → ✏️ Edit**. Paste the URL:
   ```js
   API_URL: "https://script.google.com/macros/s/AKfy…/exec",
   ```
   Click **Commit changes**. Never put the passcode in this file: it is public.
2. ✅ Open the site. It asks **who you are** and for the **trip passcode**. The pill at the top should turn to **✅ Synced**.
   The first phone to connect uploads the plan to the backend.

## 4 · Turn on automatic backups and the health check (3 min)

1. In the repo, go to **Settings → Secrets and variables → Actions → New repository secret** and add two:
   | Name | Value |
   |---|---|
   | `TRIP_API_URL` | the Web app URL |
   | `TRIP_PASSCODE` | the passcode |
2. Go to **Settings → Actions → General → Workflow permissions**, choose **Read and write permissions**, then **Save**.
3. Open the **Actions** tab. If asked, click *"I understand my workflows, go ahead and enable them"*. Then run each of these once with **Run workflow**:
   - **🧾 Backup trip data**. On a **public** repo this deliberately skips storing bills in GitHub, where anyone could read them, and says so. Your **private Drive snapshots every 2 h** still run. To store bills in the repo anyway, add the variable `BACKUP_IN_REPO = true` (Settings → Secrets and variables → Actions → *Variables*).
   - **🩺 Site health check**. ✅ It should turn green.
4. Install the **GitHub app** on your phone. If the health check finds a problem, it opens an issue and you get a notification.

## 5 · (Optional) Live Google reviews for "Should I go?" (5 min)

Without this step the Explore page still works: curated guide, scores and links to Google Maps, Zomato and Tripadvisor. With it, you get live ratings, the newest reviews, a verdict for any name or Maps link, and **better options near you**.

1. Go to **https://console.cloud.google.com**. Create a project, e.g. `goa-trip`. Billing must be enabled: Google gives a monthly free allowance and charges per request above it. Set a **budget alert** under *Billing → Budgets & alerts*, e.g. ₹500.
2. Under **APIs & Services → Library**, search for **Places API (New)** and click **Enable**.
3. Under **APIs & Services → Credentials → Create credentials → API key**, click **Edit key → API restrictions → Restrict key → Places API (New)**, then **Save**. Copy the key.
4. In Apps Script, go to ⚙️ **Script properties** and add **`PLACES_API_KEY`** = the key. No redeploy is needed.
5. ✅ In the editor, run **`testPlaces`**. The log should show Thalassa with a rating and reviews.

The backend caps live lookups at **300 per day** and caches each result for 6 hours, which protects your bill. You can change the cap with `PLACES_DAILY_LIMIT` at the top of `Code.gs`.

## 6 · Share with the group

Send this on WhatsApp:
> 🌴 Trip planner: https://<YOUR-USERNAME>.github.io/goa-trip-planner/
> Passcode: `sunset-goa-26`
> Open it → pick your name → enter the passcode. Then *Share → Add to Home Screen* so it opens like an app.
> Guide: https://github.com/<YOUR-USERNAME>/goa-trip-planner/blob/main/docs/USER-GUIDE.md

## 7 · Final check with two phones (3 min)

- [ ] Phone A and phone B both show **✅ Synced**.
- [ ] Phone A adds a bill (＋ bill under a slot). Within about 30 s it appears on phone B.
- [ ] Both phones add a bill at the same time. Both bills survive.
- [ ] Turn on flight mode on one phone and add a bill: the pill shows **📴 Offline**. Turn flight mode off: it syncs.
- [ ] **🕘 History → 📸 Snapshot now** creates a snapshot. Drive → *Goa Trip Planner / Snapshots (every 2h)* has CSV, XLSX and JSON files.
- [ ] The live Sheet shows the bills in the **Expenses** tab.
- [ ] Explore: search `Thalassa` or paste a Maps link. You get a verdict (live, if you did step 5).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Pill says **🔒 Enter trip passcode** or "Wrong passcode" | Tap the pill and retype it. It's case-sensitive and must match `TRIP_PASSCODE` exactly. |
| **⚠️ Sync problem** / "Failed to fetch" | Check `API_URL` in `assets/config.js` ends in `/exec`. Open `…/exec?action=ping`. Check the deployment is **Anyone** + **Execute as Me**. |
| "Backend not set up" | Add the `TRIP_PASSCODE` script property, then run `setup`. |
| Changed `Code.gs` but nothing changed | **Deploy → Manage deployments → ✏️ → Version: New version → Deploy.** Saving the file alone doesn't update the web app. |
| Backup workflow fails with 403 on push | Step 4.2: set Workflow permissions to **Read and write**. |
| Explore says "Live reviews aren't switched on" | Do step 5, or ignore it. The guide and the links still work. |
| A phone shows old data | Pull down or reopen the page. It re-checks on open and every 30 s. Tap the pill → **Sync now**. |
| Someone deleted things by mistake | **🕘 History → Preview → Restore this version.** Or in Apps Script run `restoreLatestSnapshot`. |
| Big deletions are blocked | This is deliberate: the backend refuses to wipe the plan or more than half the bills unless you confirm. |
| The site shows a GitHub 404 | Wait 2 minutes after the first push. Check **Settings → Pages** (branch `main`, folder `/root`). |

**Where the data lives:** Google Drive → **Goa Trip Planner** holds:
- `trip-state.json`: the live data
- *Goa Trip — Live Sheet*
- *Snapshots (every 2h)*

The GitHub repo holds only the website, plus `backups/` if the repo is private or you opted in.
