"""Generates the IGCSE study tracker workbook (16 Nov - 16 Dec 2026, topic-wise).

Run:  python tools/build_tracker.py
Output: IGCSE_Tracker_16Nov-16Dec.xlsx in the project root.
Upload it to Google Drive and open with Google Sheets (dropdowns, formulas and
formatting carry over). Then protect the "Verified by Varsha" column.
"""
from datetime import date, timedelta
from pathlib import Path

from openpyxl import Workbook
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

START = date(2026, 11, 16)
DAYS = 31  # 16 Nov -> 16 Dec inclusive
OUT = Path(__file__).resolve().parent.parent / "IGCSE_Tracker_16Nov-16Dec.xlsx"

# ---------------------------------------------------------------- syllabus plan
# Each entry: (topic, objective). One entry = one study session.
PHYSICS = [  # 0625 Extended, topics 1-3, 31 x 1 h
    *[("1 Motion, forces & energy", o) for o in [
        "1.1 Physical quantities & measurement techniques",
        "1.2 Motion: speed, velocity, acceleration",
        "1.2 Motion: distance-time & speed-time graphs",
        "1.2 Motion: free fall, terminal velocity",
        "1.3 Mass & weight + 1.4 Density",
        "1.5.1 Effects of forces: Hooke's law, resultant force, F = ma",
        "1.5.1 Friction, drag, circular motion",
        "1.5.2 Turning effect (moments) + 1.5.3 Centre of gravity",
        "1.6 Momentum & impulse",
        "1.6 Momentum: conservation problems",
        "1.7.1 Energy stores, KE & GPE",
        "1.7.2 Work + 1.7.4 Power + efficiency",
        "1.7.3 Energy resources",
        "1.8 Pressure (solids & liquids)",
        "Topic 1 mistakes review",
        "Topic 1 test",
    ]],
    *[("2 Thermal physics", o) for o in [
        "2.1.1-2.1.2 States of matter & particle model",
        "2.1.3 Gases & the absolute scale, pV = constant",
        "2.2.1 Thermal expansion + 2.2.2 Specific heat capacity",
        "2.2.3 Melting, boiling & evaporation",
        "2.3.1-2.3.3 Conduction, convection, radiation",
        "2.3.4 Consequences of thermal energy transfer",
        "Topic 2 test",
    ]],
    *[("3 Waves", o) for o in [
        "3.1 General properties of waves",
        "3.2.1 Reflection + 3.2.2 Refraction",
        "3.2.2 Critical angle & total internal reflection",
        "3.2.3 Thin lenses + 3.2.4 Dispersion",
        "3.3 Electromagnetic spectrum",
        "3.4 Sound",
        "Topic 3 mistakes review",
        "Topic 3 test",
    ]],
]

CHEMISTRY = [  # 0620 Extended, topics 1-4, 31 x 1 h
    *[("1 States of matter", o) for o in [
        "1.1 Solids, liquids & gases: changes of state, heating/cooling curves",
        "1.1 Effect of temperature & pressure on gas volume",
        "1.2 Diffusion",
        "Topic 1 test + mistakes review",
    ]],
    *[("2 Atoms, elements & compounds", o) for o in [
        "2.1 Elements, compounds & mixtures",
        "2.2 Atomic structure & the Periodic Table, electronic configuration",
        "2.3 Isotopes & relative atomic mass calculation",
        "2.4 Ions & ionic bonds: dot-and-cross diagrams",
        "2.4 Giant ionic lattices & properties",
        "2.5 Simple molecules & covalent bonds: dot-and-cross",
        "2.5 Properties of simple molecular substances",
        "2.6 Giant covalent structures (diamond, graphite, SiO2)",
        "2.7 Metallic bonding",
        "Topic 2 mistakes review",
        "Topic 2 test",
    ]],
    *[("3 Stoichiometry", o) for o in [
        "3.1 Formulae, word & symbol equations, state symbols",
        "3.1 Ionic equations + balancing practice",
        "3.2 Relative masses (Ar, Mr)",
        "3.3 The mole & the Avogadro constant",
        "3.3 Reacting masses",
        "3.3 Molar gas volume",
        "3.3 Concentration & titration calculations",
        "3.3 Empirical/molecular formulae, % yield, % purity",
        "Topic 3 mistakes review",
        "Topic 3 test",
    ]],
    *[("4 Electrochemistry", o) for o in [
        "4.1 Electrolysis: principles, molten compounds",
        "4.1 Electrolysis of aqueous solutions: predicting products",
        "4.1 Half-equations, electroplating, refining copper",
        "4.2 Hydrogen-oxygen fuel cells",
        "Topic 4 mistakes review",
        "Topic 4 test",
    ]],
]

BIOLOGY = [  # 0610 Extended, topics 1-5 (topics are small), 31 x 1 h
    *[("1 Characteristics & classification", o) for o in [
        "1.1 Characteristics of living organisms",
        "1.2 Classification, binomial system, dichotomous keys",
        "1.3 Features of organisms: kingdoms, vertebrates, arthropods",
        "1.3 Features of organisms: plants, viruses",
        "Topic 1 test + mistakes review",
    ]],
    *[("2 Organisation of the organism", o) for o in [
        "2.1 Cell structure: animal, plant, bacterial",
        "2.1 Specialised cells & levels of organisation",
        "2.2 Size of specimens: magnification calculations",
        "2.2 Magnification practice (hard)",
        "Topic 2 mistakes review",
        "Topic 2 test",
    ]],
    *[("3 Movement into & out of cells", o) for o in [
        "3.1 Diffusion",
        "3.2 Osmosis: definitions & water potential",
        "3.2 Osmosis in plant cells: turgor, plasmolysis",
        "3.3 Active transport",
        "Practical-style questions: diffusion & osmosis experiments",
        "Topic 3 mistakes review",
        "Topic 3 test",
    ]],
    *[("4 Biological molecules", o) for o in [
        "4 Carbohydrates, fats, proteins: elements & building blocks",
        "4 Food tests",
        "4 DNA structure",
        "Topic 4 mistakes review",
        "Topic 4 test",
    ]],
    *[("5 Enzymes", o) for o in [
        "5 Enzymes as catalysts, active site & specificity",
        "5 Effect of temperature on enzymes",
        "5 Effect of pH on enzymes",
        "5 Enzyme practical questions",
        "Topic 5 mistakes review",
        "Topic 5 test",
    ]],
    ("Review", "Buffer / catch-up on anything unfinished"),
    ("Review", "Month review: redo all wrong questions, topics 1-5"),
]

ADD_MATHS = [  # 0606, topics 1-4 (+5 stretch), 31 x 2 h
    *[("1 Functions", o) for o in [
        "Function notation, domain & range, mappings",
        "Composite functions",
        "Inverse functions",
        "Graphs of f and f^-1 (reflection in y = x)",
        "Modulus functions & graphs of y = |f(x)|",
        "Mixed exam-style questions (hard)",
        "Topic 1 mistakes review",
        "Topic 1 test",
    ]],
    *[("2 Quadratic functions", o) for o in [
        "Completing the square, max/min values",
        "Sketching quadratics, vertex & intercepts",
        "Discriminant & nature of roots",
        "Line-curve intersection & tangency conditions",
        "Quadratic inequalities",
        "Mixed exam-style questions (hard)",
        "Topic 2 mistakes review",
        "Topic 2 test",
    ]],
    *[("3 Factors of polynomials", o) for o in [
        "Polynomial division",
        "Factor theorem",
        "Remainder theorem",
        "Solving cubic equations",
        "Topic 3 mistakes review",
        "Topic 3 test",
    ]],
    *[("4 Equations, inequalities & graphs", o) for o in [
        "Modulus equations |ax + b| = |cx + d|",
        "Modulus inequalities",
        "Cubic graphs & y = |f(x)| for cubics",
        "Solving equations by substitution (e.g. quadratic in x^1/2)",
        "Topic 4 mistakes review + exam-style",
        "Topic 4 test",
    ]],
    *[("5 Simultaneous equations (stretch)", o) for o in [
        "One linear + one non-linear equation",
        "Exam-style simultaneous equations",
    ]],
    ("Review", "Month review: redo all wrong questions, topics 1-4"),
]

MATHS = [  # 0580 Extended, topics 1-3 (rotating hour, ~10 sessions)
    ("1 Number", "Types of number, HCF/LCM, indices & standard form"),
    ("1 Number", "Percentages: reverse %, compound interest, growth & decay"),
    ("1 Number", "Bounds, ratio & proportion, surds"),
    ("2 Algebra & graphs", "Expanding, factorising, algebraic fractions"),
    ("2 Algebra & graphs", "Solving equations, rearranging, quadratic formula"),
    ("2 Algebra & graphs", "Inequalities & sequences"),
    ("2 Algebra & graphs", "Functions + direct & inverse variation"),
    ("2 Algebra & graphs", "Graphs: sketching, interpreting, gradients of curves"),
    ("3 Coordinate geometry", "Gradient, midpoint, length, y = mx + c, parallel & perpendicular"),
    ("Review", "Topics 1-3 mixed test + mistakes review"),
]

ENGLISH = [  # 0500 First Language assumed (skills-based, rotating hour, ~11 sessions)
    ("1 Reading comprehension", "Explicit & implicit meaning questions"),
    ("1 Reading comprehension", "Comprehension practice (timed)"),
    ("2 Summary writing", "Summary technique: selecting points, own words"),
    ("2 Summary writing", "Summary practice (timed)"),
    ("3 Writer's effects", "Language analysis: identifying & explaining effects"),
    ("3 Writer's effects", "Writer's effects practice (timed)"),
    ("4 Directed writing", "Formats: letter, article, speech, report"),
    ("4 Directed writing", "Directed writing practice (timed)"),
    ("5 Composition", "Descriptive writing"),
    ("5 Composition", "Narrative writing"),
    ("Review", "Vocabulary + mistakes review"),
]

GP = [  # 0457 Global Perspectives (skills-based, rotating hour, ~10 sessions)
    ("1 Analysis skills", "Identifying issues, causes, consequences & perspectives"),
    ("1 Analysis skills", "Analysing arguments: claims, evidence, reasoning"),
    ("2 Evaluation skills", "Evaluating sources: author, purpose, evidence"),
    ("2 Evaluation skills", "Source-based question practice"),
    ("2 Evaluation skills", "Written exam-style section practice (timed)"),
    ("3 Research skills", "Research questions, finding & recording sources"),
    ("3 Research skills", "Individual Report: topic & research question (check school deadline)"),
    ("3 Research skills", "Individual Report: research & notes"),
    ("4 Reflection & communication", "Reflection & communication skills"),
    ("Review", "Mistakes & feedback review"),
]


def activity(obj: str) -> str:
    o = obj.lower()
    if "test" in o:
        return "SME topic questions, exam-style mix, timed"
    if "mistakes" in o or "redo" in o or "catch-up" in o:
        return "Redo wrong questions from Mistake Log"
    if "practice" in o or "exam-style" in o or "hard" in o:
        return "SME topic questions (Hard / Exam-style)"
    return "SME revision notes + topic questions (Easy -> Medium)"


# ---------------------------------------------------------------- styling
BLACK, GREY, LIGHT = "000000", "BFBFBF", "F2F2F2"
thin = Side(style="thin", color=GREY)
thick = Side(style="medium", color=BLACK)
HEAD_FONT = Font(name="Arial", bold=True, color="FFFFFF", size=10)
HEAD_FILL = PatternFill("solid", fgColor=BLACK)
BODY_FONT = Font(name="Arial", size=10)
WRAP = Alignment(wrap_text=True, vertical="top")
CENTER = Alignment(horizontal="center", vertical="top")


def header(ws, cols, widths):
    for i, (c, w) in enumerate(zip(cols, widths), start=1):
        cell = ws.cell(row=1, column=i, value=c)
        cell.font, cell.fill = HEAD_FONT, HEAD_FILL
        cell.alignment = Alignment(wrap_text=True, vertical="center")
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.row_dimensions[1].height = 30
    ws.freeze_panes = "A2"


wb = Workbook()

# ---------------------------------------------------------------- Daily Log
log = wb.active
log.title = "Daily Log"
COLS = ["Date", "Day", "Block", "Subject", "Topic", "Objective", "SME Activity",
        "Planned (min)", "Actual (min)", "Pomodoros", "Score", "Out of", "%",
        "Status", "Evidence (optional)", "Mistakes / Notes",
        "Verified by Varsha", "Varsha's Comment"]
header(log, COLS, [11, 6, 6, 13, 26, 44, 30, 9, 9, 9, 7, 7, 7, 11, 18, 28, 13, 24])

rotation = [("English", ENGLISH), ("Maths", MATHS), ("Global Perspectives", GP)]
rot_idx = {name: 0 for name, _ in rotation}
row = 2
for d in range(DAYS):
    day = START + timedelta(days=d)
    rot_name, rot_list = rotation[d % 3]
    rot_item = rot_list[min(rot_idx[rot_name], len(rot_list) - 1)]
    rot_idx[rot_name] += 1
    blocks = [
        ("1", "Physics", *PHYSICS[d], 60),
        ("2", "Chemistry", *CHEMISTRY[d], 60),
        ("3", "Biology", *BIOLOGY[d], 60),
        ("4-5", "Add Maths", *ADD_MATHS[d], 120),
        ("6", rot_name, *rot_item, 60),
    ]
    first = row
    for blk, subj, topic, obj, mins in blocks:
        vals = [day, day.strftime("%a"), blk, subj, topic, obj, activity(obj), mins,
                None, None, None, None, None, "Not started", None, None, None, None]
        for c, v in enumerate(vals, start=1):
            cell = log.cell(row=row, column=c, value=v)
            cell.font = BODY_FONT
            cell.alignment = WRAP
            cell.border = Border(bottom=thin)
        log.cell(row=row, column=1).number_format = "DD-MMM-YY"
        log.cell(row=row, column=13, value=f'=IF(AND(K{row}<>"",L{row}>0),K{row}/L{row},"")')
        log.cell(row=row, column=13).number_format = "0%"
        for c in (2, 3, 8, 9, 10, 11, 12, 13, 14, 17):
            log.cell(row=row, column=c).alignment = CENTER
        row += 1
    for c in range(1, len(COLS) + 1):  # heavy rule under each day
        log.cell(row=row - 1, column=c).border = Border(bottom=thick)
    if d % 2:  # light band on alternate days
        for r in range(first, row):
            for c in range(1, 8):
                log.cell(row=r, column=c).fill = PatternFill("solid", fgColor=LIGHT)
LAST = row - 1

status_dv = DataValidation(type="list", formula1='"Not started,Done,Partial,Not done"', allow_blank=True)
verify_dv = DataValidation(type="list", formula1='"Verified,Partial,Not verified"', allow_blank=True)
log.add_data_validation(status_dv)
log.add_data_validation(verify_dv)
status_dv.add(f"N2:N{LAST}")
verify_dv.add(f"Q2:Q{LAST}")

white_bold = Font(name="Arial", size=10, bold=True, color="FFFFFF")
log.conditional_formatting.add(f"N2:N{LAST}", FormulaRule(formula=['$N2="Done"'],
    fill=PatternFill("solid", fgColor=BLACK), font=white_bold))
log.conditional_formatting.add(f"N2:N{LAST}", FormulaRule(formula=['$N2="Partial"'],
    fill=PatternFill("solid", fgColor=GREY)))
log.conditional_formatting.add(f"Q2:Q{LAST}", FormulaRule(formula=['$Q2="Verified"'],
    fill=PatternFill("solid", fgColor=BLACK), font=white_bold))
log.conditional_formatting.add(f"Q2:Q{LAST}", FormulaRule(formula=['$Q2="Partial"'],
    fill=PatternFill("solid", fgColor=GREY)))
log.auto_filter.ref = f"A1:R{LAST}"

# ---------------------------------------------------------------- Daily Summary
summ = wb.create_sheet("Daily Summary")
header(summ, ["Date", "Day", "Planned (min)", "Actual (min)", "Hours", "Result",
              "Objectives Done", "Objectives Verified", "Varsha's Note"],
       [11, 6, 10, 10, 8, 16, 11, 11, 40])
R = f"'Daily Log'!$A$2:$A${LAST}"
for d in range(DAYS):
    r = d + 2
    day = START + timedelta(days=d)
    summ.cell(row=r, column=1, value=day).number_format = "DD-MMM-YY"
    summ.cell(row=r, column=2, value=day.strftime("%a"))
    summ.cell(row=r, column=3, value=f"=SUMIFS('Daily Log'!$H$2:$H${LAST},{R},A{r})")
    summ.cell(row=r, column=4, value=f"=SUMIFS('Daily Log'!$I$2:$I${LAST},{R},A{r})")
    summ.cell(row=r, column=5, value=f"=D{r}/60").number_format = "0.0"
    summ.cell(row=r, column=6, value=f'=IF(D{r}=0,"",IF(D{r}>=360,"Full day (6h)",IF(D{r}>=300,"Pass (5h)","Below minimum")))')
    summ.cell(row=r, column=7, value=f"=COUNTIFS({R},A{r},'Daily Log'!$N$2:$N${LAST},\"Done\")&\" / 5\"")
    summ.cell(row=r, column=8, value=f"=COUNTIFS({R},A{r},'Daily Log'!$Q$2:$Q${LAST},\"Verified\")&\" / 5\"")
    for c in range(1, 10):
        summ.cell(row=r, column=c).font = BODY_FONT
        summ.cell(row=r, column=c).border = Border(bottom=thin)
summ.conditional_formatting.add(f"F2:F{DAYS+1}", FormulaRule(formula=['$F2="Full day (6h)"'],
    fill=PatternFill("solid", fgColor=BLACK), font=white_bold))
summ.conditional_formatting.add(f"F2:F{DAYS+1}", FormulaRule(formula=['$F2="Pass (5h)"'],
    fill=PatternFill("solid", fgColor=GREY)))
summ.conditional_formatting.add(f"F2:F{DAYS+1}", FormulaRule(formula=['$F2="Below minimum"'],
    font=Font(name="Arial", size=10, bold=True, underline="single")))
t = DAYS + 3
summ.cell(row=t, column=1, value="Month totals").font = Font(name="Arial", bold=True)
summ.cell(row=t, column=4, value=f"=SUM(D2:D{DAYS+1})")
summ.cell(row=t, column=5, value=f"=D{t}/60").number_format = "0.0"
summ.cell(row=t + 1, column=1, value="Days >= 5h").font = Font(name="Arial", bold=True)
summ.cell(row=t + 1, column=4, value=f'=COUNTIF(D2:D{DAYS+1},">=300")&" / {DAYS}"')
summ.cell(row=t + 2, column=1, value="Days = 6h").font = Font(name="Arial", bold=True)
summ.cell(row=t + 2, column=4, value=f'=COUNTIF(D2:D{DAYS+1},">=360")&" / {DAYS}"')

# ---------------------------------------------------------------- Topic Coverage
cov = wb.create_sheet("Topic Coverage")
header(cov, ["Subject", "Topic", "Sessions Planned", "Sessions Done", "% Complete",
             "Avg Score %", "Confidence (1-5)", "Status", "Notes"],
       [18, 34, 10, 10, 10, 10, 11, 12, 36])
subjects = [("Physics", PHYSICS), ("Chemistry", CHEMISTRY), ("Biology", BIOLOGY),
            ("Add Maths", ADD_MATHS), ("Maths", MATHS[:rot_idx["Maths"]]),
            ("English", ENGLISH[:rot_idx["English"]]),
            ("Global Perspectives", GP[:rot_idx["Global Perspectives"]])]
r = 2
conf_dv = DataValidation(type="list", formula1='"1,2,3,4,5"', allow_blank=True)
stat_dv = DataValidation(type="list", formula1='"Weak,OK,Strong"', allow_blank=True)
cov.add_data_validation(conf_dv)
cov.add_data_validation(stat_dv)
S, T, N, P = (f"'Daily Log'!${c}$2:${c}${LAST}" for c in "DENM")
for subj, plan in subjects:
    seen = []
    for topic, _ in plan:
        if topic not in seen and topic != "Review":
            seen.append(topic)
    for topic in seen:
        cov.cell(row=r, column=1, value=subj)
        cov.cell(row=r, column=2, value=topic)
        cov.cell(row=r, column=3, value=f'=COUNTIFS({S},A{r},{T},B{r})')
        cov.cell(row=r, column=4, value=f'=COUNTIFS({S},A{r},{T},B{r},{N},"Done")')
        cov.cell(row=r, column=5, value=f'=IF(C{r}=0,"",D{r}/C{r})').number_format = "0%"
        cov.cell(row=r, column=6, value=f'=IFERROR(AVERAGEIFS({P},{S},A{r},{T},B{r}),"")').number_format = "0%"
        for c in range(1, 10):
            cov.cell(row=r, column=c).font = BODY_FONT
            cov.cell(row=r, column=c).border = Border(bottom=thin)
        r += 1
    for c in range(1, 10):
        cov.cell(row=r - 1, column=c).border = Border(bottom=thick)
conf_dv.add(f"G2:G{r-1}")
stat_dv.add(f"H2:H{r-1}")
cov.conditional_formatting.add(f"E2:E{r-1}", FormulaRule(formula=['AND(ISNUMBER($E2),$E2>=1)'],
    fill=PatternFill("solid", fgColor=BLACK), font=white_bold))
cov.conditional_formatting.add(f"H2:H{r-1}", FormulaRule(formula=['$H2="Weak"'],
    font=Font(name="Arial", size=10, bold=True, underline="single")))

# ---------------------------------------------------------------- Weekly Summary
wk = wb.create_sheet("Weekly Summary")
subj_names = ["Physics", "Chemistry", "Biology", "Add Maths", "Maths", "English", "Global Perspectives"]
header(wk, ["Week", "From", "To", *[f"{s} (h)" for s in subj_names], "Total (h)", "Days >= 5h"],
       [8, 11, 11, *[11] * len(subj_names), 10, 10])
weeks, cur = [], START
end = START + timedelta(days=DAYS - 1)
while cur <= end:
    stop = min(cur + timedelta(days=6 - cur.weekday()), end)
    weeks.append((cur, stop))
    cur = stop + timedelta(days=1)
I = f"'Daily Log'!$I$2:$I${LAST}"
for i, (a, b) in enumerate(weeks, start=2):
    wk.cell(row=i, column=1, value=f"W{i-1}")
    wk.cell(row=i, column=2, value=a).number_format = "DD-MMM"
    wk.cell(row=i, column=3, value=b).number_format = "DD-MMM"
    for j, s in enumerate(subj_names):
        col = 4 + j
        wk.cell(row=i, column=col,
                value=f'=SUMIFS({I},{S},"{s}",{R},">="&$B{i},{R},"<="&$C{i})/60').number_format = "0.0"
    tot = 4 + len(subj_names)
    wk.cell(row=i, column=tot, value=f"=SUM(D{i}:{get_column_letter(tot-1)}{i})").number_format = "0.0"
    wk.cell(row=i, column=tot + 1,
            value=f"=COUNTIFS('Daily Summary'!$A$2:$A${DAYS+1},\">=\"&$B{i},'Daily Summary'!$A$2:$A${DAYS+1},\"<=\"&$C{i},'Daily Summary'!$D$2:$D${DAYS+1},\">=300\")")
    for c in range(1, tot + 2):
        wk.cell(row=i, column=c).font = BODY_FONT
        wk.cell(row=i, column=c).border = Border(bottom=thin)

# ---------------------------------------------------------------- Mistake Log
ml = wb.create_sheet("Mistake Log")
header(ml, ["Date", "Subject", "Topic", "Question / Source", "What went wrong",
            "Correct method", "Redone? (date)", "Got it right?"],
       [11, 14, 26, 26, 36, 36, 13, 11])
yn = DataValidation(type="list", formula1='"Yes,No"', allow_blank=True)
ml.add_data_validation(yn)
yn.add("H2:H500")
subj_dv = DataValidation(type="list", formula1='"' + ",".join(subj_names) + '"', allow_blank=True)
ml.add_data_validation(subj_dv)
subj_dv.add("B2:B500")

# ---------------------------------------------------------------- How to use
how = wb.create_sheet("How to use", 0)
how.column_dimensions["A"].width = 100
lines = [
    ("IGCSE STUDY TRACKER: 16 Nov - 16 Dec 2026", True),
    ("Target: 6 h per day = full day. 5 h = minimum pass. Exams: Oct/Nov 2027 (Cambridge IGCSE, Extended).", False),
    ("", False),
    ("DAILY BLOCKS", True),
    ("1  Physics: 1 h   |   2  Chemistry: 1 h   |   3  Biology: 1 h   |   4-5  Add Maths: 2 h   |   6  English -> Maths -> GP (rotates daily)", False),
    ("", False),
    ("THIS MONTH'S GOAL (topic-wise, no full past papers yet)", True),
    ("Physics 1-3  |  Chemistry 1-4  |  Biology 1-5 (small topics)  |  Add Maths 1-4 (+5 stretch)  |  Maths 1-3  |  English & GP: core skills", False),
    ("", False),
    ("BROTHER: EACH DAY", True),
    ("1. Open 'Daily Log', filter by today's date.  2. Do each objective using the SME topic named in the row.", False),
    ("3. Fill Actual (min), Pomodoros, Score / Out of (from SME topic questions), and Status.", False),
    ("4. Every wrong question goes in 'Mistake Log'.  5. Evidence is optional (photo/screenshot link).", False),
    ("", False),
    ("VARSHA: 11 PM CHECK", True),
    ("Filter 'Daily Log' to today and set 'Verified by Varsha' + comment. 'Daily Summary' shows whether the day hit 5h / 6h.", False),
    ("Tip: in Google Sheets, Data > Protect sheets and ranges > column Q, so only you can edit it.", False),
    ("", False),
    ("OTHER TABS", True),
    ("Daily Summary: hours per day + result  |  Topic Coverage: % of each topic done + confidence  |  Weekly Summary: hours per subject per week", False),
    ("If a day is missed, move that objective to the next Review/Buffer slot. Don't skip it.", False),
]
for i, (text, bold) in enumerate(lines, start=1):
    c = how.cell(row=i, column=1, value=text)
    c.font = Font(name="Arial", size=12 if bold else 10, bold=bold)
    c.alignment = Alignment(wrap_text=True)

for ws in wb.worksheets:
    ws.sheet_view.showGridLines = False
wb.active = 1
wb.save(OUT)

# ---------------------------------------------------------------- website plan
import json

plan_days = {}
for r in range(2, LAST + 1):
    v = [log.cell(row=r, column=c).value for c in range(1, 9)]
    plan_days.setdefault(v[0].strftime("%Y-%m-%d"), []).append({
        "block": v[2], "subject": v[3], "topic": v[4], "objective": v[5],
        "activity": v[6], "planned": v[7]})
web_plan = Path(__file__).resolve().parent.parent / "web" / "plan.js"
web_plan.parent.mkdir(exist_ok=True)
web_plan.write_text(
    "// Generated by tools/build_tracker.py. Do not edit by hand.\n"
    f"window.PLAN = {json.dumps({'start': START.isoformat(), 'end': (START + timedelta(days=DAYS - 1)).isoformat(), 'days': plan_days}, indent=1)};\n",
    encoding="utf-8")
print(f"Saved {web_plan}")
print(f"Saved {OUT}  ({LAST - 1} objective rows, rotation counts: {rot_idx})")
