let allStudents = [];
let allAccounts = [];
let freshPasswords = {}; // username -> one-time plain password (only until refresh)

async function init() {
  loadQuote();
  const cls = await API.get('/api/classes');
  const sel = document.getElementById('lcf');
  sel.innerHTML = '<option value="all">All Classes</option>' + cls.map(c => '<option value="' + c + '">' + c + '</option>').join('');
  await loadLogins();
  document.getElementById('lcf').addEventListener('change', renderTable);
  document.getElementById('lsearch').addEventListener('input', renderTable);
  document.getElementById('genBtn').addEventListener('click', generateMissing);
  document.getElementById('printBtn').addEventListener('click', () => window.print());
  document.getElementById('csvBtn').addEventListener('click', downloadCsv);
}

async function loadLogins() {
  try {
    const [sData, accs] = await Promise.all([
      API.get('/api/students'),
      API.get('/api/student-accounts')
    ]);
    allStudents = sData.students || [];
    allAccounts = accs || [];
    renderTable();
  } catch (e) {
    document.getElementById('loginTableBody').innerHTML = '<tr><td colspan="5" class="text-center text-muted">Error loading logins. Session may have expired — please log in again.</td></tr>';
  }
}

function filteredRows() {
  const cls = document.getElementById('lcf').value || 'all';
  const q = (document.getElementById('lsearch').value || '').toLowerCase();
  const accByStudent = {};
  allAccounts.forEach(a => { accByStudent[a.studentId] = a; });
  return allStudents
    .filter(s => cls === 'all' || s.className === cls)
    .map(s => ({ student: s, acc: accByStudent[s._id] || null }))
    .filter(({ student, acc }) => {
      if (!q) return true;
      return student.name.toLowerCase().includes(q) || (acc && acc.username.toLowerCase().includes(q));
    })
    .sort((a, b) => a.student.name.localeCompare(b.student.name));
}

function renderTable() {
  const rows = filteredRows();
  document.getElementById('loginCount').textContent = rows.length + ' students • ' + rows.filter(r => r.acc).length + ' have logins';
  const tbody = document.getElementById('loginTableBody');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No students found.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(({ student, acc }) => {
    const username = acc ? acc.username : '<span class="text-muted">—</span>';
    const fresh = acc && freshPasswords[acc.username];
    const passCell = !acc
      ? '<span class="text-muted">No login yet</span>'
      : fresh
        ? '<strong>' + escapeHtml(fresh) + '</strong>'
        : '<span class="text-muted">•••• (reset for new)</span>';
    const actions = acc
      ? '<button class="btn btn-secondary btn-sm" onclick="copyPass(\'' + acc.username + '\')">Copy</button> <button class="btn btn-secondary btn-sm" onclick="resetLogin(\'' + acc.username + '\')">Reset</button>'
      : '<span class="text-muted">Use Generate</span>';
    return '<tr><td>' + escapeHtml(student.name) + '</td>' +
      '<td><span class="badge badge-neutral">' + escapeHtml(student.className) + '</span></td>' +
      '<td><code>' + (acc ? escapeHtml(acc.username) : '—') + '</code></td>' +
      '<td>' + passCell + '</td>' +
      '<td class="no-print">' + actions + '</td></tr>';
  }).join('');
}

async function generateMissing() {
  const rows = filteredRows().filter(r => !r.acc);
  if (rows.length === 0) { showToast('All filtered students already have logins', 'success'); return; }
  const btn = document.getElementById('genBtn');
  btn.textContent = 'Generating...';
  btn.disabled = true;
  try {
    const items = rows.map(r => ({ name: r.student.name, className: r.student.className }));
    const data = await API.post('/api/student-accounts/generate-list', { items });
    (data.accounts || []).forEach(a => {
      if (a.password) freshPasswords[a.username] = a.password;
    });
    showToast('Generated ' + (data.accounts || []).length + ' logins — copy/print now', 'success');
    await loadLogins();
    // re-apply fresh passwords after reload (usernames persist)
    (data.accounts || []).forEach(a => {
      if (a.password) freshPasswords[a.username] = a.password;
    });
    renderTable();
  } catch (e) {
    showToast('Error generating logins', 'error');
  }
  btn.textContent = 'Generate missing logins';
  btn.disabled = false;
}

async function resetLogin(username) {
  if (!confirm('Reset password for ' + username + '? Old password stops working.')) return;
  try {
    const data = await API.post('/api/student-accounts/reset', { username });
    freshPasswords[data.username] = data.password;
    renderTable();
    showToast('New password shown once — copy now', 'success');
  } catch (e) {
    showToast('Error resetting password', 'error');
  }
}

function copyPass(username) {
  const pw = freshPasswords[username];
  if (!pw) { showToast('Password hidden — Reset to get a new one', 'error'); return; }
  navigator.clipboard.writeText(username + ' / ' + pw).then(
    () => showToast('Copied username + password', 'success'),
    () => showToast('Copy failed', 'error')
  );
}

function downloadCsv() {
  const rows = filteredRows();
  const lines = ['name,username,password,class'];
  rows.forEach(({ student, acc }) => {
    const u = acc ? acc.username : '';
    const p = acc && freshPasswords[acc.username] ? freshPasswords[acc.username] : '';
    lines.push('"' + student.name.replace(/"/g, '""') + '",' + u + ',' + p + ',' + student.className);
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'student-logins.csv';
  a.click();
  showToast('CSV downloaded (passwords only for newly generated/reset)', 'success');
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

document.addEventListener('DOMContentLoaded', init);
