# IGCSE Study Tracker — Build Plan

**Purpose:** Track my brother's daily study habits and completed work for IGCSE, with a built-in Pomodoro timer and a tracker sheet that I (Varsha) verify every night at 11 PM.

**First plan period:** 16 Nov 2026 → 16 Dec 2026 (31 days)
**Look:** clean, minimal, black and white only.

---

## 0. Decisions (confirmed 13 Nov 2026)

| # | Decision |
|---|----------|
| 1 | **6 h = a full day. 5 h = the minimum pass.** |
| 2 | Cambridge IGCSE: Physics 0625, Chemistry 0620, Biology 0610, Add Maths 0606, Maths 0580, English (0500 assumed, still to confirm), Global Perspectives 0457 |
| 3 | **Extended** tier for every subject |
| 4 | Exams in **Oct/Nov 2027**. He has just finished Year 10, and the syllabus isn't fully covered yet. |
| 5 | **Topic-wise study only for now. No full past papers.** Full papers come in later, once more of the syllabus is taught. |
| 6 | Month 1 goal: the **first 3–4 topics of each subject**, sized by how big each subject's topics are (see §2) |
| 7 | Verification and evidence are **relaxed**. Varsha checks in her own way, and evidence is optional. |

---

## 1. Can I use SaveMyExams to fill in the month's objectives?

**Short answer: not directly.**

- SaveMyExams content is behind his paid login. I can't sign in to his account (I'm not allowed to type passwords), and I shouldn't copy their paid content into a sheet.
- **What I can do:** build all 31 days of objectives from the **official Cambridge syllabus topic lists**, which are public. SaveMyExams organises its *Topic Questions* and *Revision Notes* by the same syllabus topics. So every objective in the sheet will say something like "Physics 4.2 Electrical quantities: SME topic questions, Hard". He opens that topic in his own account and does the work.
- **Done:** the full month of objectives is generated in `IGCSE_Tracker_16Nov-16Dec.xlsx`. It's built by `tools/build_tracker.py`, so later months can be made the same way.

---

## 2. Daily study structure (6 h plan / 5 h minimum)

| Block | Subject | Duration | What he does |
|-------|---------|----------|--------------|
| 1 | Physics | 1 h | SME revision notes + topic questions for that day's subtopic |
| 2 | Chemistry | 1 h | Same |
| 3 | Biology | 1 h | Same |
| 4–5 | Add Maths | 2 h | Same, with more time for hard questions |
| 6 | Rotating | 1 h | English → Maths → Global Perspectives, then repeat |

**How each topic is studied:** subtopic sessions start with Easy → Medium topic questions and finish with Hard / exam-style ones. Then comes a **mistakes review** session (redo wrong questions), and finally a **topic test** (a timed, exam-style mix of SME topic questions).

**Month 1 targets (16 Nov – 16 Dec), sized to each subject's topic size:**

| Subject | Hours | Topics | Why |
|---------|-------|--------|-----|
| Physics 0625 | 31 | 1 Motion, forces & energy · 2 Thermal · 3 Waves | Physics has only 6 big topics, so 3 is already half the syllabus |
| Chemistry 0620 | 31 | 1 States of matter · 2 Atoms, elements & compounds · 3 Stoichiometry · 4 Electrochemistry | 4 medium topics. Stoichiometry gets the most sessions. |
| Biology 0610 | 31 | 1 Classification · 2 Organisation · 3 Movement in/out of cells · 4 Biological molecules · 5 Enzymes | Biology topics are small, so the 5th fits |
| Add Maths 0606 | 62 | 1 Functions · 2 Quadratics · 3 Polynomials · 4 Equations, inequalities & graphs (+5 Simultaneous eqns as a stretch) | 2 h a day gives room for a 5th topic |
| Maths 0580 | ~10 | 1 Number · 2 Algebra & graphs · 3 Coordinate geometry | Practice of the key subtopics only. He has already been taught these in Year 10. |
| English | ~11 | Reading comprehension · Summary · Writer's effects · Directed writing · Composition | English is skills-based, not topic-based |
| Global Perspectives | ~10 | Analysis · Evaluation · Research (Individual Report start) · Reflection | Skills-based. Check the school's coursework deadlines. |

**If he falls behind:** a missed objective moves into the next mistakes-review or buffer slot. It doesn't get dropped.

---

## 3. Functional requirements

### 3.1 Pomodoro timer (the same idea as pomofocus.io, with our own design)

| ID | Requirement |
|----|-------------|
| P1 | Three modes: **Pomodoro** (default 25 min), **Short Break** (5 min) and **Long Break** (15 min), switched with tabs |
| P2 | Large countdown display with Start, Pause and Skip controls |
| P3 | A long break comes automatically after every 4 pomodoros (the number is configurable) |
| P4 | A round counter ("#3") and a short message ("Time to focus!" / "Time for a break!") |
| P5 | The browser tab title shows the live countdown, for example `18:42 – Physics` |
| P6 | **Task list:** add a task with a **Subject**, **Topic**, estimated pomodoros and notes. Each task shows its progress, for example `2/4`. |
| P7 | Pick the active task. Every finished pomodoro is credited to that task. |
| P8 | Mark a task done, edit it, delete it, reorder it, and clear finished tasks |
| P9 | An end time is shown, for example "Finish at 21:35", based on the remaining pomodoros |
| P10 | **Settings:** durations for each mode, auto-start breaks, auto-start pomodoros, long-break interval, alarm sound and volume, optional ticking sound, and keyboard shortcuts (Space = start/pause) |
| P11 | Desktop notification and sound when a timer ends |
| P12 | Timer state survives a page refresh. Settings are saved. |
| P13 | **Report page:** focus hours today, this week and this month, days studied, and current streak. Charts are per day and per subject. |
| P14 | **Auto-logging:** finished pomodoros are written to the tracker sheet as a row with date, subject, topic and minutes. This is what turns the timer into a proof of work. |
| P15 | Daily progress bar toward 5 h (minimum) and 6 h (full plan), plus a per-subject breakdown for today |

### 3.2 Tracker sheet (Google Sheets, shown inside the website)

**Approach:** the Google Sheet is the single source of truth. The website **embeds** it so you can edit it inside the site, and also shows a **"Open in Google Sheets"** link. You and your brother can both edit from a phone with the Sheets app.

| ID | Requirement |
|----|-------------|
| S1 | The sheet is embedded on the Tracker page as an editable iframe, with an "Open in new tab" link |
| S2 | Objectives are organised **by subject and syllabus topic** |
| S3 | Dropdowns (data validation) for Subject, Activity Type, Status and Verified, so entries stay consistent |
| S4 | Conditional formatting in black, white and greys: done = black fill, partial = grey, not done = white with a border |
| S5 | **"Verified by Varsha" column is protected.** Only your Google account can edit it, so he can't tick his own work. |
| S6 | Formulas add up planned vs actual minutes for each day, subject and week |
| S7 | The website's Progress page reads the sheet (a published CSV or the Sheets API) to draw charts and streaks |

**Tab 1: `Daily Log`** (one row per objective)

| Column | Example |
|--------|---------|
| Date | 16-Nov-2026 |
| Day | Mon |
| Subject | Physics |
| Syllabus Topic | 4.2 Electrical quantities |
| Objective | 0625/22 M/J 2023, full MCQ, timed |
| Activity Type | Past Paper / Topic Questions / Notes / Mock / Corrections |
| SME Difficulty | Easy / Medium / Hard / Exam |
| Planned (min) | 60 |
| Actual (min) | 55 (filled automatically from the timer) |
| Pomodoros | 2 |
| Score | 31 / 40 |
| % | 78% (formula) |
| Status | Done / Partial / Not done |
| Evidence | Link to a photo of his worked answers or the SME results screen |
| Mistakes / Notes | "Mixed up series and parallel resistance" |
| **Verified by Varsha** | ✅ Verified / ⚠️ Partial / ❌ Not verified |
| Varsha's Comment | "Corrections missing for Q14" |
| Verified At | 16-Nov 23:05 |

**Tab 2: `Topic Coverage`.** A syllabus checklist for each subject, with one row per topic:
`Subject | Topic # | Topic | Notes read | Topic Qs done | Best % | Confidence (1–5) | Last revised | Status (Weak / OK / Strong)`

**Tab 3: `Daily Summary`.** Planned vs actual minutes for each day, the result (Full day 6 h / Pass 5 h / Below minimum), and objectives done and verified.

**Tab 4: `Weekly Summary`.** Formulas only: hours per subject per week, and the number of days that hit 5 h.

**Tab 5: `Mistake Log`.** Every wrong question, with the topic, what went wrong, the correct method, and whether it was redone.

*(A `Past Paper Log` tab gets added later, once full papers start.)*

### 3.3 Nightly verification (11 PM)

| ID | Requirement |
|----|-------------|
| V1 | **"Tonight's Review" page:** today's objectives with his self-reported status, minutes logged by the timer, and links to his evidence. It's built for checking quickly on a phone. |
| V2 | Each row has a **Verified / Partial / Not verified** choice and an optional comment. These write to the protected column. |
| V3 | Verification is informational, not a gate. Totals count everything he logs, and the verified count is shown next to them. |
| V4 | A reminder at 10:30 PM tells him to finish logging. A reminder at 11:00 PM tells you to review. |
| V5 | Evidence is optional |

### 3.4 Dashboard / Home

| ID | Requirement |
|----|-------------|
| D1 | **Today:** the date, today's objectives from the sheet, the timer, and the progress bar (0 → 5 h → 6 h) |
| D2 | A calendar heatmap from 16 Nov to 16 Dec, shaded by verified hours |
| D3 | Streak counter (days in a row with the minimum hit **and** verified) |
| D4 | Average topic-question score % per subject as a trend line |
| D5 | The three weakest topics, from Topic Coverage |
| D6 | Countdown to the exams |

### 3.5 Design (black and white, minimal)

- Pure black `#000`, white `#fff`, and two greys only. No colours. Status is shown with fills, weights and icons.
- One clean sans-serif font (Inter). The timer digits use a monospaced font.
- Lots of white space, thin 1px borders, no shadows and no gradients
- A dark mode that inverts the colours, used automatically at night
- Works on a phone first, since you'll verify on your phone at 11 PM
- Four pages: **Timer**, **Tracker**, **Review**, **Progress**

---

## 4. Technical approach

| Part | Choice | Why |
|------|--------|-----|
| Website | Vite + React (or plain HTML/JS) | Simple and fast, with no server to run |
| Hosting | Vercel or Netlify (free) | You get a link you can open on any device |
| Data store | Google Sheet | You both already know Sheets, it edits easily on a phone, and it has protected ranges for your column |
| Timer → sheet writes | Google Apps Script web app attached to the sheet | Free, and writes pomodoro rows into `Daily Log` |
| Sheet → site reads | Sheets API, or the sheet published as CSV | Powers the dashboard and charts |
| Timer settings and tasks | Browser storage | Lives on his device, like pomofocus |
| Notifications | Browser notifications + a scheduled Apps Script email or reminder | Covers the 10:30 PM and 11 PM reminders |

---

## 5. Build phases

| Phase | Deliverable | Rough timing |
|-------|-------------|--------------|
| **1. Sheet** | Google Sheet with all 5 tabs, dropdowns, formatting, the protected Varsha column, and the month plan pre-filled from 16 Nov to 16 Dec | Day 1 (needed before 16 Nov) |
| **2. Timer** | Full Pomodoro (P1–P12) with subject/topic tasks, black and white UI | Days 1–2 |
| **3. Embed + link** | Tracker page with the editable sheet embed and the open-in-Sheets link | Day 2 |
| **4. Auto-logging** | Timer writes finished pomodoros to the sheet (P14), with a daily progress bar | Days 3–4 |
| **5. Review page** | The 11 PM verification view (V1–V5) | Day 4 |
| **6. Dashboard** | Heatmap, streaks, score trends, weak topics, report (P13, D1–D6) | Days 5–6 |
| **7. Polish** | Dark mode, phone layout, reminders, deploy | Day 7 |

**Minimum for 16 Nov:** Phases 1–3. He can start studying and you can start verifying while the rest gets built.

---

## 6. Suggestions to make it more effective

1. **Log the SME score for every session.** Score and "Out of" from the topic questions feed Avg Score % in Topic Coverage, so weak topics show up on their own.
2. **The timer is the source of truth for minutes.** Self-reported time is easy to inflate. Time the timer logs is much harder to fake.
3. **Mistake log ("error book").** Every wrong question goes in the Mistake Log. The mistakes-review sessions are built into the plan for exactly this. It's the highest-value revision there is.
4. **Corrections count as part of the hour.** A session isn't "Done" until the wrong answers are corrected. Otherwise it's "Partial".
5. **Weak-topic loop.** Any topic scoring under 60% gets SME topic questions again 3 days later, then 7 days later (spaced repetition).
6. **Bring in past papers gradually.** From around Feb–Mar 2027, once more of the syllabus is taught, start using past-paper questions *filtered by topic*. Full timed papers can wait until mid-2027. That leaves plenty of time before the Oct/Nov 2027 exams.
7. **A topic test at the end of each topic.** These are already in the plan. Do them timed, with the phone in another room.
8. **A buffer slot.** Plan for 6 h, but the 5 h minimum covers bad days. If he falls behind, the missed objective rolls to Sunday instead of disappearing.
9. **Phone away during pomodoros.** Use Focus mode or a site blocker during focus blocks. Breaks are the only time for the phone.
10. **Hardest subject first.** Put Add Maths in his best-focus hours, which is usually the first block, not the last.
11. **Small reward system.** For example, a 7-day verified streak earns a pre-agreed reward. The streak resets on any unverified day.
12. **10-minute Sunday review with you.** Look at the Weekly Summary together. Agree on next week's focus topics, and adjust the plan based on scores, not feelings.
13. **Lock verified rows.** Once you verify a row, it shouldn't be edited. An Apps Script can protect it automatically.
14. **Daily start ritual.** He opens the site, sees today's objectives, and presses Start on the timer. Reducing the decisions he has to make is half the battle.

---

## 7. Next steps

1. ✅ Month plan generated: `IGCSE_Tracker_16Nov-16Dec.xlsx` (155 objectives across 31 days)
2. Upload it to Google Drive → open with Google Sheets → protect column Q ("Verified by Varsha")
3. Confirm which English syllabus he takes (0500 First Language, or 0510/0990 Second Language)
4. Build the website, starting with the timer and the embedded sheet
