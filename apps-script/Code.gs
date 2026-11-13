/**
 * IGCSE Study Tracker: Google Sheets connector.
 *
 * Paste this into Extensions > Apps Script of the tracker Google Sheet,
 * then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 * Deploy it from VARSHA's Google account so it can write the protected
 * "Verified by Varsha" column.
 *
 * Set two Script Properties (Project Settings > Script properties):
 *   STUDENT_KEY : any word/phrase for the brother's device
 *   VARSHA_KEY  : a different one, only for Varsha (needed to verify)
 */

const LOG_SHEET = 'Daily Log';
const COL = {
  date: 1, day: 2, block: 3, subject: 4, topic: 5, objective: 6, activity: 7,
  planned: 8, actual: 9, pomodoros: 10, score: 11, outOf: 12, pct: 13,
  status: 14, evidence: 15, notes: 16, verified: 17, comment: 18,
};
const STUDENT_FIELDS = ['status', 'score', 'outOf', 'notes', 'evidence', 'actual'];
const VARSHA_FIELDS = STUDENT_FIELDS.concat(['verified', 'comment']);

function doGet() {
  return ContentService.createTextOutput('IGCSE Study Tracker connector is running.');
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return out_({ ok: false, error: 'Bad request' });
  }
  try {
    return out_(handle_(body));
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err) });
  }
}

function handle_(p) {
  const props = PropertiesService.getScriptProperties();
  const studentKey = props.getProperty('STUDENT_KEY');
  const varshaKey = props.getProperty('VARSHA_KEY');
  let role = null;
  if (p.key && varshaKey && p.key === varshaKey) role = 'varsha';
  else if (p.key && studentKey && p.key === studentKey) role = 'student';
  if (!role) return { ok: false, error: 'Wrong key' };

  switch (p.action) {
    case 'ping':
      return { ok: true, role: role };
    case 'rows':
      return { ok: true, role: role, rows: readRows_() };
    case 'log':
    case 'update': {
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        return p.action === 'log' ? logMinutes_(p) : update_(p, role);
      } finally {
        lock.releaseLock();
      }
    }
    default:
      return { ok: false, error: 'Unknown action' };
  }
}

function sheet_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(LOG_SHEET);
  if (!sh) throw new Error('Sheet "' + LOG_SHEET + '" not found');
  return sh;
}

function iso_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  }
  return String(v || '');
}

function readRows_() {
  const values = sheet_().getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const v = values[i];
    if (!v[COL.date - 1] || !v[COL.subject - 1]) continue;
    const row = { row: i + 1 };
    Object.keys(COL).forEach(function (k) { row[k] = v[COL[k] - 1]; });
    row.date = iso_(row.date);
    rows.push(row);
  }
  return rows;
}

function findRow_(date, subject) {
  const values = sheet_().getRange(2, 1, Math.max(sheet_().getLastRow() - 1, 1), COL.subject).getValues();
  for (let i = 0; i < values.length; i++) {
    if (iso_(values[i][COL.date - 1]) === date && values[i][COL.subject - 1] === subject) return i + 2;
  }
  return -1;
}

function logMinutes_(p) {
  const minutes = Number(p.minutes) || 0;
  if (!p.date || !p.subject || minutes <= 0) return { ok: false, error: 'date, subject and minutes required' };
  const sh = sheet_();
  let r = findRow_(p.date, p.subject);
  if (r < 0) {
    // Extra study not in the plan: add a row for it.
    const d = new Date(p.date + 'T00:00:00');
    sh.appendRow([d, Utilities.formatDate(d, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'EEE'),
      'Extra', p.subject, p.topic || '', p.objective || 'Extra study', '', 0, 0, 0, '', '', '', 'Not started']);
    r = sh.getLastRow();
    sh.getRange(r, COL.pct).setFormula('=IF(AND(K' + r + '<>"",L' + r + '>0),K' + r + '/L' + r + ',"")');
  }
  const actual = sh.getRange(r, COL.actual);
  actual.setValue((Number(actual.getValue()) || 0) + minutes);
  if (p.pomodoro) {
    const pom = sh.getRange(r, COL.pomodoros);
    pom.setValue((Number(pom.getValue()) || 0) + 1);
  }
  return { ok: true, row: r };
}

function update_(p, role) {
  if (!p.date || !p.subject) return { ok: false, error: 'date and subject required' };
  const r = findRow_(p.date, p.subject);
  if (r < 0) return { ok: false, error: 'No row for ' + p.subject + ' on ' + p.date };
  const allowed = role === 'varsha' ? VARSHA_FIELDS : STUDENT_FIELDS;
  const fields = p.fields || {};
  const sh = sheet_();
  const changed = [];
  Object.keys(fields).forEach(function (k) {
    if (allowed.indexOf(k) === -1) return;
    sh.getRange(r, COL[k]).setValue(fields[k] === null ? '' : fields[k]);
    changed.push(k);
  });
  return { ok: true, row: r, changed: changed };
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
