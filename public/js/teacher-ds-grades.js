let dsRows = [];
let dsQuota = 13;

function quotaFor(cls) {
  if (cls === 'Grade 7') return 13;
  if (cls === 'Grade 8') return 19;
  if (cls === 'Grade 9') return 10;
  return 13;
}

async function loadDsGrades() {
  const cls = document.getElementById('dcf').value || 'Grade 7';
  dsQuota = quotaFor(cls);
  document.getElementById('dsTableLabel').textContent = 'DS Grades - ' + cls + ' (' + dsQuota + ' DS)';
  try {
    const data = await API.get('/api/ds-grades?className=' + encodeURIComponent(cls));
    dsRows = data.students || [];
    renderDsTable();
  } catch (e) {
    console.error(e);
    document.getElementById('dsTableBody').innerHTML = '<tr><td colspan="30" class="text-center text-muted">Error loading DS grades. Session may have expired — please log in again.</td></tr>';
  }
}

function renderDsTable() {
  const q = (document.getElementById('dsearch').value || '').toLowerCase();
  const rows = dsRows.filter(r => !q || r.student.name.toLowerCase().includes(q));
  document.getElementById('dsCount').textContent = rows.length + ' students • ' + dsQuota + ' DS each (/20, empty = waiting)';
  let heads = '<tr><th class="ds-student">Student</th>';
  for (let i = 1; i <= dsQuota; i++) heads += '<th class="ds-col">DS' + i + '</th>';
  heads += '<th class="ds-save">Save</th></tr>';
  document.getElementById('dsTableHead').innerHTML = heads;
  const tbody = document.getElementById('dsTableBody');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="30" class="text-center text-muted">No students in this class.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(r => {
    const sid = r.student._id;
    let cells = '';
    for (let i = 0; i < dsQuota; i++) {
      const v = r.ds ? r.ds[i] : null;
      const filled = (v !== null && v !== undefined && v !== '') ? ' filled' : '';
      cells += '<td class="ds-col"><input type="number" min="0" max="20" step="0.5" class="ds-input' + filled + '" id="ds_' + sid + '_' + i + '" value="' + (v === null || v === undefined ? '' : v) + '"></td>';
    }
    return '<tr><td class="ds-student" title="' + escapeHtml(r.student.name) + '"><strong>' + escapeHtml(r.student.name) + '</strong></td>' + cells +
      '<td class="ds-save"><button class="btn btn-sm btn-success" onclick="saveDsRow(\'' + sid + '\')">Save</button></td></tr>';
  }).join('');
}

function collectRow(sid) {
  const row = dsRows.find(r => r.student._id === sid);
  const quota = row ? row.quota : dsQuota;
  const out = [];
  for (let i = 0; i < quota; i++) {
    const el = document.getElementById('ds_' + sid + '_' + i);
    const raw = el ? el.value : '';
    if (raw === '' || raw === null || raw === undefined) { out.push(null); continue; }
    const n = parseFloat(raw);
    if (isNaN(n) || n < 0 || n > 20) return { error: 'DS' + (i + 1) + ' must be 0-20' };
    out.push(n);
  }
  return { ds: out };
}

async function saveDsRow(sid) {
  const res = collectRow(sid);
  if (res.error) { showToast(res.error, 'error'); return; }
  try {
    await API.post('/api/ds-grades', { studentId: sid, ds: res.ds });
    showToast('DS saved', 'success');
  } catch (e) {
    showToast('Error saving DS', 'error');
  }
}

async function saveAllDs() {
  const btn = document.getElementById('dsSaveAllBtn');
  btn.textContent = 'Saving...';
  btn.disabled = true;
  let ok = 0, fail = 0;
  for (const r of dsRows) {
    const res = collectRow(r.student._id);
    if (res.error) { fail++; continue; }
    try {
      await API.post('/api/ds-grades', { studentId: r.student._id, ds: res.ds });
      ok++;
    } catch (e) { fail++; }
  }
  showToast('Saved ' + ok + (fail ? ', ' + fail + ' failed' : ''), fail ? 'error' : 'success');
  btn.textContent = 'Save all';
  btn.disabled = false;
  loadDsGrades();
}

function loadQuote() {
  API.get('/api/quote').then(q => {
    document.getElementById('sideQuote').textContent = '\u201C' + q.text + '\u201D — ' + q.author;
  }).catch(() => {});
}

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t == null ? '' : t;
  return d.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  loadQuote();
  loadDsGrades();
  document.getElementById('dsReloadBtn').addEventListener('click', loadDsGrades);
  document.getElementById('dcf').addEventListener('change', loadDsGrades);
  document.getElementById('dsearch').addEventListener('input', renderDsTable);
  document.getElementById('dsSaveAllBtn').addEventListener('click', saveAllDs);
});
