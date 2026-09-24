# 🌴 START HERE: Goa Trip Planner

There are two ways to use this, depending on how much time you have.

| | What you get | Setup |
|---|---|---|
| **A · Offline file** | The full planner, bills and history on **one phone**. | 0 min |
| **B · Online (recommended)** | One shared plan for everyone, backups every 2 h, live reviews. | about 30 min on a laptop |

---

## A · Offline file (works right now)
Send `offline/Goa-Trip-Planner-OFFLINE.html` to your phone (WhatsApp to yourself, or Drive) and open it in Chrome or Safari.
- Everything is saved on that phone. Use **🕘 History → download CSV / JSON** to back up.
- Moving later to the online version: **Export JSON** here, then **Import** there.

## B · Online: from zip to live website

**1 · Get the code onto GitHub (5 min)**
1. Create an account on github.com. Click **＋ → New repository**, name it `goa-trip-planner`, choose **Public**, leave README **unticked**, then click **Create**.
2. Push **from inside this folder**. `index.html` must be at the top of the repo, not inside a sub-folder.
   - **GitHub Desktop:** File → Add local repository → this folder → *create a repository* → **Publish repository**. Untick "Keep this code private".
   - **Terminal:**
     ```bash
     git init && git add . && git commit -m "Goa trip planner"
     git branch -M main
     git remote add origin https://github.com/YOUR-USERNAME/goa-trip-planner.git
     git push -u origin main
     ```
   - ❌ Don't drag-and-drop the files on the GitHub website: it drops the hidden `.github` folder, which holds the automations.
3. ✅ The repo's top level shows `index.html`, `explore.html`, `assets/`, `backend/` and `.github/`.

**2 · Put it online (2 min)**
Go to **Settings → Pages**. Set Source **Deploy from a branch**, Branch **main**, folder **/ (root)**, then click **Save**.
✅ In 1–2 minutes, `https://YOUR-USERNAME.github.io/goa-trip-planner/` shows the timetable.

**3 · Shared backend on Google (10 min)**
1. Open script.google.com and click **New project**. Name it `Goa Trip Backend`.
2. Paste `backend/Code.gs` into `Code.gs`. Then click **＋ → Script**, name it `TripData`, and paste in `backend/TripData.gs`.
3. Go to ⚙️ **Project Settings → Script properties → Add**: `TRIP_PASSCODE` = your passcode.
4. *(Recommended)* In ⚙️, tick "Show appsscript.json". Replace that file's contents with `backend/appsscript.json`.
5. Pick **setup** from the function dropdown and click **▶ Run**. Choose your account → **Advanced → Go to … (unsafe) → Allow**.
6. Click **Deploy → New deployment → Web app**. Set Execute as **Me** and Who has access **Anyone**, then click **Deploy**. Copy the **/exec URL**.
7. ✅ Open `<URL>?action=ping`. You should see `{"ok":true…}`.

**4 · Connect the site to the backend (2 min)**
On GitHub, edit `assets/config.js` → `API_URL: "<your /exec URL>",` → **Commit**.
✅ Open the site, pick your name and enter the passcode. The pill should show **✅ Synced**.

**5 · Backups and health check (3 min)**
1. Go to Settings → Secrets and variables → Actions → **New repository secret** and add `TRIP_API_URL` and `TRIP_PASSCODE`.
2. Go to Settings → Actions → General → Workflow permissions, choose **Read and write**, then **Save**.
3. In the Actions tab, click **Enable**, then run **🩺 Site health check** once. ✅ It should turn green.
4. 2-hour snapshots (CSV + Excel + JSON) go to Google Drive → **Goa Trip Planner / Snapshots (every 2h)**.

**6 · (Optional) Live Google reviews**
In console.cloud.google.com, enable **Places API (New)** and create an **API key**. Add it in Apps Script as the Script property `PLACES_API_KEY`, then run **testPlaces**. Full details are in `docs/SETUP.md`, step 5.

**7 · Share on WhatsApp**
> 🌴 https://YOUR-USERNAME.github.io/goa-trip-planner/ · passcode: ●●●● · Open → pick your name → passcode → *Add to Home Screen*

---

### If something looks wrong
| Problem | Fix |
|---|---|
| Site shows this README instead of the timetable | `index.html` is inside a sub-folder. Push from *inside* the folder (step 1.2). |
| 404 | Wait 2 min. Check Settings → Pages (main / root). |
| "Wrong passcode" | Retype it. It must match `TRIP_PASSCODE` exactly. |
| ⚠️ Sync problem | Check the `API_URL` ends in `/exec`, the deployment is set to **Anyone**, and `?action=ping` works. |
| Edited Code.gs, nothing changed | Deploy → Manage deployments → ✏️ → **New version** → Deploy. |
| Data deleted by mistake | 🕘 History → Preview → **Restore this version**. |

More detail: `docs/SETUP.md` (owner) · `docs/USER-GUIDE.md` (everyone else).
