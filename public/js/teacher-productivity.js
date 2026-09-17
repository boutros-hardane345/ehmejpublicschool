// ====== NAME PICKER ======

let pickerStudents = [];
let excludedNames = new Set();

async function initNamePicker() {
  const className = document.getElementById('pickerClass')?.value || 'Grade 8';
  const academicYear = document.getElementById('pickerYear')?.value || '2026-2027';
  try {
    const data = await API.get(`/api/students?className=${className}&academicYear=${academicYear}`);
    pickerStudents = data.students;
    renderPickerPool();
  } catch (e) {
    showToast('Error loading students', true);
  }
}

function renderPickerPool() {
  const pool = document.getElementById('teacherPickerPool');
  if (pickerStudents.length === 0) {
    pool.innerHTML = '<div style="color:#667588;font-style:italic;font-size:.85rem">No students loaded.</div>';
    return;
  }
  pool.innerHTML = pickerStudents.map(s => `
    <span class="picker-name ${excludedNames.has(s._id) ? 'excluded' : ''}" onclick="toggleExclude('${s._id}')">${s.name}</span>
  `).join('');
}

function toggleExclude(id) {
  if (excludedNames.has(id)) excludedNames.delete(id);
  else excludedNames.add(id);
  renderPickerPool();
}

async function pickName() {
  const available = pickerStudents.filter(s => !excludedNames.has(s._id));
  if (available.length === 0) {
    showToast('All students excluded — click Reset', true);
    return;
  }
  const pick = available[Math.floor(Math.random() * available.length)];
  const el = document.getElementById('teacherPickerResult');
  el.textContent = pick.name;
  el.className = 'result highlight';
  excludedNames.add(pick._id);
  renderPickerPool();
}

function resetPicker() {
  excludedNames.clear();
  renderPickerPool();
  document.getElementById('teacherPickerResult').textContent = 'Ready';
  document.getElementById('teacherPickerResult').className = 'result';
}

// ====== GROUP GENERATOR ======

async function initGroupGenerator() {
  const className = document.getElementById('groupClass')?.value || document.getElementById('pickerClass')?.value || 'Grade 8';
  const academicYear = document.getElementById('groupYear')?.value || document.getElementById('pickerYear')?.value || '';
  const groupCount = parseInt(document.getElementById('groupSize')?.value) || 3;
  try {
    const data = await API.get(`/api/students?className=${className}&academicYear=${academicYear}`);
    const students = data.students;
    if (students.length === 0) { showToast('No students in this class', true); return; }

    const shuffled = [...students];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const groups = Array.from({ length: groupCount }, () => []);
    shuffled.forEach((s, i) => groups[i % groupCount].push(s));

    document.getElementById('teacherGroupsContainer').innerHTML = groups.map((g, gi) => `
      <div class="group-card">
        <h4><i class="fas fa-users"></i> Group ${gi + 1} <span style="font-weight:400;font-size:.82rem;color:#667588">(${g.length} students)</span></h4>
        ${g.map(n => `<span class="student-chip">${n.name}</span>`).join('')}
      </div>
    `).join('');
  } catch (e) {
    showToast('Error loading students', true);
  }
}

// ====== INIT ======

async function initYears() {
  try {
    const year = await API.get('/api/academic-year');
    const opts = `<option value="${year.year}">${year.year}</option><option value="2025-2026">2025-2026</option><option value="2026-2027">2026-2027</option>`;
    const py = document.getElementById('pickerYear');
    if (py) py.innerHTML = opts;
    const gy = document.getElementById('groupYear');
    if (gy) gy.innerHTML = opts;
  } catch (e) {}
}

document.addEventListener('DOMContentLoaded', () => {
  loadQuote();
  initYears().then(() => { initNamePicker(); });
  const pc = document.getElementById('pickerClass');
  if (pc) pc.addEventListener('change', initNamePicker);
  const py = document.getElementById('pickerYear');
  if (py) py.addEventListener('change', initNamePicker);
});