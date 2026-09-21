// ====== TEACHER PRODUCTIVITY: picker + groups + todos + timer + notes ======

let pickerStudents = [];
let excludedNames = new Set();
let pickHistory = [];
let lastGroups = [];
let todos = [];
let todoFilter = 'all';

// ---------- shared ----------
function loadQuote() {
  API.get('/api/quote').then(q => {
    const el = document.getElementById('sideQuote');
    if (el) el.textContent = '\u201C' + q.text + '\u201D \u2014 ' + q.author;
  }).catch(() => {});
}

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t == null ? '' : String(t);
  return d.innerHTML;
}

function setStat(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v;
}

// ---------- name picker ----------
async function initNamePicker() {
  const className = document.getElementById('pickerClass')?.value || 'Grade 8';
  const academicYear = document.getElementById('pickerYear')?.value || '';
  const params = new URLSearchParams({ className });
  if (academicYear) params.set('academicYear', academicYear);
  try {
    const data = await API.get('/api/students?' + params.toString());
    pickerStudents = data.students || [];
    setStat('prodStudents', pickerStudents.length);
    renderPickerPool();
  } catch (e) {
    showToast('Error loading students', 'error');
  }
}

function renderPickerPool() {
  const pool = document.getElementById('teacherPickerPool');
  if (!pool) return;
  const remaining = pickerStudents.filter(s => !excludedNames.has(s._id)).length;
  setStat('pickerRemaining', remaining + ' left');
  if (pickerStudents.length === 0) {
    pool.innerHTML = '<span class="text-muted">No students loaded for this class/year.</span>';
    return;
  }
  pool.innerHTML = pickerStudents.map(s =>
    '<button type="button" class="picker-name' + (excludedNames.has(s._id) ? ' excluded' : '') +
    '" data-id="' + s._id + '">' + escapeHtml(s.name) + '</button>'
  ).join('');
  pool.querySelectorAll('.picker-name').forEach(b =>
    b.addEventListener('click', () => toggleExclude(b.getAttribute('data-id'))));
  renderHistory();
}

function renderHistory() {
  const h = document.getElementById('pickerHistory');
  if (!h) return;
  h.innerHTML = pickHistory.length
    ? pickHistory.map((n, i) => '<span class="history-chip">' + (i + 1) + '. ' + escapeHtml(n) + '</span>').join('')
    : '<span class="text-muted">No picks yet.</span>';
}

function toggleExclude(id) {
  if (excludedNames.has(id)) excludedNames.delete(id);
  else excludedNames.add(id);
  renderPickerPool();
}

function pickName() {
  const available = pickerStudents.filter(s => !excludedNames.has(s._id));
  if (available.length === 0) {
    showToast('Everyone picked — click Reset for a new round', 'error');
    return;
  }
  const el = document.getElementById('teacherPickerResult');
  // slot-machine shuffle animation
  let ticks = 0;
  el.classList.remove('highlight');
  const shuffle = setInterval(() => {
    el.textContent = available[Math.floor(Math.random() * available.length)].name;
    if (++ticks > 12) {
      clearInterval(shuffle);
      const pick = available[Math.floor(Math.random() * available.length)];
      el.textContent = pick.name;
      el.classList.add('highlight');
      excludedNames.add(pick._id);
      pickHistory.push(pick.name);
      renderPickerPool();
    }
  }, 60);
}

function resetPicker() {
  excludedNames.clear();
  pickHistory = [];
  const el = document.getElementById('teacherPickerResult');
  el.textContent = 'Ready';
  el.classList.remove('highlight');
  renderPickerPool();
}

// ---------- group generator ----------
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function fetchGroupStudents() {
  const className = document.getElementById('groupClass')?.value || 'Grade 8';
  const academicYear = document.getElementById('groupYear')?.value || '';
  const params = new URLSearchParams({ className });
  if (academicYear) params.set('academicYear', academicYear);
  const data = await API.get('/api/students?' + params.toString());
  return data.students || [];
}

function buildGroups(students) {
  const mode = document.getElementById('groupMode')?.value || 'count';
  let n = parseInt(document.getElementById('groupSize')?.value, 10) || 3;
  n = Math.min(Math.max(n, 1), 12);
  const shuffled = shuffle([...students]);
  let groups;
  if (mode === 'size') {
    groups = [];
    for (let i = 0; i < shuffled.length; i += n) groups.push(shuffled.slice(i, i + n));
  } else {
    const count = Math.min(n, shuffled.length) || 1;
    groups = Array.from({ length: count }, () => []);
    shuffled.forEach((s, i) => groups[i % count].push(s));
  }
  return groups;
}

function renderGroups(groups) {
  lastGroups = groups;
  const box = document.getElementById('teacherGroupsContainer');
  setStat('prodGroups', groups.length);
  const total = groups.reduce((a, g) => a + g.length, 0);
  const sum = document.getElementById('groupSummary');
  if (sum) sum.textContent = groups.length + ' groups · ' + total + ' students';
  box.innerHTML = groups.map((g, gi) =>
    '<div class="group-card row-in"><h4>Group ' + (gi + 1) +
    ' <span>(' + g.length + ')</span></h4><div>' +
    g.map(s => '<span class="member">' + escapeHtml(s.name) + '</span>').join('') +
    '</div></div>'
  ).join('');
}

async function initGroupGenerator() {
  try {
    const students = await fetchGroupStudents();
    if (!students.length) { showToast('No students in this class/year', 'error'); return; }
    renderGroups(buildGroups(students));
  } catch (e) {
    showToast('Error loading students', 'error');
  }
}

function copyGroups() {
  if (!lastGroups.length) { showToast('Generate groups first', 'error'); return; }
  const text = lastGroups.map((g, i) => 'Group ' + (i + 1) + ': ' + g.map(s => s.name).join(', ')).join('\n');
  navigator.clipboard?.writeText(text)
    .then(() => showToast('Groups copied', 'success'))
    .catch(() => showToast('Copy failed', 'error'));
}

// ---------- todos (server) ----------
async function loadTodos() {
  const box = document.getElementById('todoList');
  try {
    todos = await API.get('/api/todos');
    renderTodos();
  } catch (e) {
    box.innerHTML = '<div class="empty-state">Could not load tasks.</div>';
  }
}

function renderTodos() {
  const box = document.getElementById('todoList');
  const visible = todos.filter(t => todoFilter === 'all' ? true : todoFilter === 'done' ? t.completed : !t.completed);
  const open = todos.filter(t => !t.completed).length;
  setStat('todoCount', open + ' open');
  setStat('prodTasksDone', todos.filter(t => t.completed).length);
  if (!visible.length) {
    box.innerHTML = '<div class="empty-state">Nothing here. Add your first task above.</div>';
    return;
  }
  box.innerHTML = visible.map(t =>
    '<div class="todo-item"><span class="check' + (t.completed ? ' done' : '') + '" data-act="toggle" data-id="' + t._id + '">' +
    (t.completed ? '✓' : '') + '</span><span class="todo-text' + (t.completed ? ' done' : '') + '">' +
    escapeHtml(t.title) + '</span><span class="badge badge-neutral">' + escapeHtml(t.category || 'general') + '</span>' +
    '<button class="del-btn" data-act="del" data-id="' + t._id + '" title="Delete">✕</button></div>'
  ).join('');
  box.querySelectorAll('[data-act]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-id');
      if (el.getAttribute('data-act') === 'del') deleteTodo(id);
      else toggleTodo(id);
    });
  });
}

async function addTodo(title, category) {
  await API.post('/api/todos', { title, category });
  await loadTodos();
}

async function toggleTodo(id) {
  const t = todos.find(x => x._id === id);
  if (!t) return;
  await API.put('/api/todos/' + id, { completed: !t.completed });
  await loadTodos();
}

async function deleteTodo(id) {
  if (!confirm('Delete this task?')) return;
  await API.del('/api/todos/' + id);
  await loadTodos();
}

// ---------- focus timer ----------
let timerSecs = 25 * 60, timerLeft = 25 * 60, timerRunning = false, timerId = null, onBreak = false;

function fmt(s) {
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

function drawTimer() {
  document.getElementById('timerTime').textContent = fmt(timerLeft);
  const phase = document.getElementById('timerPhase');
  if (phase) {
    phase.textContent = timerRunning ? (onBreak ? 'Break' : 'Focusing') : 'Ready';
    phase.className = 'badge ' + (timerRunning && !onBreak ? 'badge-warning' : timerRunning ? 'badge-positive' : 'badge-neutral');
  }
  const ring = document.querySelector('.timer-ring');
  if (ring && timerSecs > 0) {
    const p = 1 - timerLeft / timerSecs;
    ring.style.setProperty('--p', Math.round(p * 100));
  }
}

function timerTick() {
  if (--timerLeft <= 0) {
    clearInterval(timerId);
    timerRunning = false;
    if (!onBreak) {
      const n = (parseInt(localStorage.getItem('focusSessions') || '0', 10) || 0) + 1;
      localStorage.setItem('focusSessions', String(n));
      setStat('prodSessions', n);
      showToast('Focus done! Take a break.', 'success');
      onBreak = true;
      timerSecs = timerLeft = (parseInt(document.getElementById('breakLen').value, 10) || 5) * 60;
    } else {
      showToast('Break over — ready for another sprint?', 'success');
      onBreak = false;
      timerSecs = timerLeft = (parseInt(document.getElementById('focusLen').value, 10) || 25) * 60;
    }
  }
  drawTimer();
}

// ---------- notes ----------
function loadNotes() {
  const saved = localStorage.getItem('teacherQuickNotes') || localStorage.getItem('quickNotes') || '';
  document.getElementById('notesArea').value = saved;
}

function saveNotes() {
  localStorage.setItem('teacherQuickNotes', document.getElementById('notesArea').value);
  const st = document.getElementById('notesStatus');
  if (st) {
    st.textContent = 'Saving...';
    clearTimeout(st._t);
    st._t = setTimeout(() => { st.textContent = 'Autosaved'; }, 600);
  }
}

// ---------- years + init ----------
async function initYears() {
  try {
    const year = await API.get('/api/academic-year');
    const opts = '<option value="' + year.year + '">' + year.year + '</option>' +
      ['2025-2026', '2026-2027', '2024-2025'].filter(y => y !== year.year)
        .map(y => '<option value="' + y + '">' + y + '</option>').join('');
    const py = document.getElementById('pickerYear');
    if (py) py.innerHTML = opts;
    const gy = document.getElementById('groupYear');
    if (gy) gy.innerHTML = opts;
  } catch (e) {}
}

document.addEventListener('DOMContentLoaded', () => {
  loadQuote();
  setStat('prodSessions', localStorage.getItem('focusSessions') || '0');
  initYears().then(() => { initNamePicker(); });
  loadTodos();
  loadNotes();
  drawTimer();

  document.getElementById('pickBtn')?.addEventListener('click', pickName);
  document.getElementById('pickerLoadBtn')?.addEventListener('click', initNamePicker);
  document.getElementById('pickerResetBtn')?.addEventListener('click', resetPicker);
  document.getElementById('pickerClass')?.addEventListener('change', initNamePicker);
  document.getElementById('pickerYear')?.addEventListener('change', initNamePicker);

  document.getElementById('genGroupsBtn')?.addEventListener('click', initGroupGenerator);
  document.getElementById('reshuffleBtn')?.addEventListener('click', initGroupGenerator);
  document.getElementById('copyGroupsBtn')?.addEventListener('click', copyGroups);

  document.getElementById('todoForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const input = document.getElementById('todoTitle');
    const title = input.value.trim();
    if (!title) return;
    try {
      await addTodo(title, document.getElementById('todoCategory').value);
      input.value = '';
      showToast('Task added', 'success');
    } catch (err) { showToast('Error adding task', 'error'); }
  });
  document.querySelectorAll('.todo-filter').forEach(b =>
    b.addEventListener('click', () => {
      document.querySelectorAll('.todo-filter').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      todoFilter = b.getAttribute('data-f');
      renderTodos();
    }));

  document.getElementById('timerStart')?.addEventListener('click', () => {
    if (timerRunning) return;
    timerRunning = true;
    clearInterval(timerId);
    timerId = setInterval(timerTick, 1000);
    drawTimer();
  });
  document.getElementById('timerPause')?.addEventListener('click', () => {
    timerRunning = false;
    clearInterval(timerId);
    drawTimer();
  });
  document.getElementById('timerReset')?.addEventListener('click', () => {
    timerRunning = false;
    clearInterval(timerId);
    onBreak = false;
    timerSecs = timerLeft = (parseInt(document.getElementById('focusLen').value, 10) || 25) * 60;
    drawTimer();
  });
  document.getElementById('focusLen')?.addEventListener('change', e => {
    if (!timerRunning && !onBreak) { timerSecs = timerLeft = (parseInt(e.target.value, 10) || 25) * 60; drawTimer(); }
  });

  document.getElementById('notesArea')?.addEventListener('input', saveNotes);
});
