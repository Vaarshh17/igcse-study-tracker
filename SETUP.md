# Setup Guide

About 20 minutes, done once. Steps 1–2 are enough to start on 16 Nov. Step 3 adds auto-logging and the Review page.

## 1. Put the tracker in Google Sheets (Varsha's account)

1. Go to drive.google.com → **New → File upload** → choose `IGCSE_Tracker_16Nov-16Dec.xlsx`.
2. Open it, then **File → Save as Google Sheets**. Use the new Google Sheets copy from now on.
3. **Share** it with your brother's Google account as **Editor**.
4. Protect your column so only you can verify:
   **Data → Protect sheets and ranges → Add a range** → `'Daily Log'!Q:R` → **Set permissions → Only you**.
5. Copy the sheet's link (from the address bar).

## 2. Put the website online (free)

The website is the `web/` folder. It's just files, with no server needed.

**Vercel (connected to GitHub, redeploys on every push)**
1. vercel.com → **Add New → Project** → import the GitHub repo `igcse-study-tracker`.
2. Leave the settings as they are (`vercel.json` already tells Vercel to serve the `web` folder) → **Deploy**.
3. Every `git push` to `main` updates the site automatically.

**Alternative: Netlify Drop**
1. Go to app.netlify.com/drop and sign up (free).
2. Drag the **`web`** folder onto the page. You get a link like `https://something.netlify.app`.
3. Open the link on his laptop and on your phone. Use **Add to Home Screen** on the phone.

On each device, open **⚙ Settings → Google Sheet → Sheet link**, paste the sheet link, and press **Save**. The **Tracker** tab will now show the sheet.

> To try it locally first, run `python -m http.server 5173 --directory web` and open http://localhost:5173.

## 3. Connect the website to the sheet (recommended)

This lets the timer write his minutes into the sheet automatically, and lets you verify from the **Review** page on your phone.

1. In the Google Sheet: **Extensions → Apps Script**.
2. Delete what's there, paste everything from `apps-script/Code.gs`, and press **Save**.
3. **Project Settings (⚙) → Script properties → Add**:
   - `STUDENT_KEY` = any phrase for him, e.g. `physics-is-fun-42`
   - `VARSHA_KEY` = a *different* phrase only you know
4. **Deploy → New deployment → ⚙ Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Press **Deploy**, allow the permissions, then copy the **Web app URL** (it ends in `/exec`).
5. In the website's **⚙ Settings** on each device:
   - **Connector URL** = the `/exec` URL
   - **Key** = `STUDENT_KEY` on his laptop, `VARSHA_KEY` on your phone
   - Press **Test connection**. It should say "Connected as student" or "Connected as Varsha (can verify)".

What each key can do:
- **His key** can update status, score, notes and minutes. It **cannot** change "Verified by Varsha".
- **Your key** can do everything, including verifying.

## Daily use

**Him:**
1. Open the site. Today's 5 objectives load into **Tasks** automatically.
2. Tap a task, then press **START**. Each finished pomodoro logs its minutes to that subject in the sheet.
3. Tick the circle when an objective is done. Use **⋮** on a task to add the SME score and notes.
4. Write mistakes in the sheet's **Mistake Log** tab.

**You, at 11 PM:**
- Open **Review** on your phone and tap **Verified / Partial / Not verified** for each objective. You can add a comment, or use **Mark all "Done" as verified**.

## Next month

Edit the topic lists in `tools/build_tracker.py` (and the start date), then run:

```
python tools/build_tracker.py
```

This creates a new `.xlsx` and a new `web/plan.js`. Re-upload the `web` folder to Netlify.

## Notes

- Timer settings, tasks and the Report are stored in each browser. Use the same browser each day.
- If the sheet doesn't show inside the Tracker page, the browser is blocking Google's sign-in inside the page. Use **Open in Google Sheets** instead.
- The default pomodoro is **30 min** (pomofocus uses 25), so a 1-hour block is exactly 2 pomodoros and 6 h is 12. You can change it in Settings.
