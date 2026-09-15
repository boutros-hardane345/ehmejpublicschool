// ============ QUICK NOTES (localStorage) ============

function loadNotes() {
  const saved = localStorage.getItem('quickNotes');
  if (saved) document.getElementById('notesArea').value = saved;
}

function saveNotes() {
  const text = document.getElementById('notesArea').value;
  localStorage.setItem('quickNotes', text);
}

// ============ GROUP GENERATOR ============

async function initGroupGenerator() {
  const className = document.getElementById('ggClass').value;
  const groupCount = parseInt(document.getElementById('ggCount').value) || 3;
  try {
    const data = await API.get(`/api/students?className=${className}`);
    const students = data.students;
    if (students.length === 0) { showToast('No students in this class', true); return; }

    const shuffled = [...students];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const groups = Array.from({ length: groupCount }, () => []);
    shuffled.forEach((s, i) => groups[i % groupCount].push(s));

    document.getElementById('groupsOutput').innerHTML = groups.map((g, gi) => `
      <div class="group-card">
        <h4><i class="fas fa-users"></i> Group ${gi + 1} <span style="font-weight:400;font-size:.82rem;color:#667588">(${g.length} students)</span></h4>
        ${g.map(n => `<span class="student-chip">${n.name}</span>`).join('')}
      </div>
    `).join('');
  } catch (e) {
    showToast('Error loading students', true);
  }
}

// ============ NAME PICKER ============

let pickerStudents = [];
let excludedNames = new Set();

async function initNamePicker() {
  const className = document.getElementById('npClass').value;
  try {
    const data = await API.get(`/api/students?className=${className}`);
    pickerStudents = data.students;
    renderPickerPool();
  } catch (e) {
    showToast('Error loading students', true);
  }
}

function renderPickerPool() {
  const pool = document.getElementById('pickerPool');
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
  const el = document.getElementById('pickerResult');
  el.textContent = pick.name;
  el.className = 'picker-result highlight';
  excludedNames.add(pick._id);
  renderPickerPool();
}

function resetPicker() {
  excludedNames.clear();
  renderPickerPool();
  document.getElementById('pickerResult').textContent = '—';
  document.getElementById('pickerResult').className = 'picker-result';
}

// ============ INIT ============

document.addEventListener('DOMContentLoaded', () => {
  loadNotes();
  initGroupGenerator();
  initNamePicker();
  document.getElementById('notesArea').addEventListener('input', saveNotes);
});