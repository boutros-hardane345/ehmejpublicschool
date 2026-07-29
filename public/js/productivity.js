// ============ TODOS ============

async function loadTodos() {
  try {
    const todos = await API.get('/api/todos');
    renderTodos(todos);
  } catch (e) {
    showToast('Error loading todos', true);
  }
}

function renderTodos(todos) {
  const div = document.getElementById('todoList');
  if (todos.length === 0) {
    div.innerHTML = '<div class="empty-state"><i class="fas fa-tasks"></i><p>No tasks yet. Add one above!</p></div>';
    return;
  }
  div.innerHTML = todos.map(t => `
    <div class="item-card" style="display:flex;align-items:center;gap:.8rem;padding:.7rem 1rem;margin-bottom:.5rem">
      <input type="checkbox" class="todo-checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTodo('${t._id}', this.checked)">
      <div style="flex:1">
        <span class="${t.completed ? 'completed-text' : ''}" style="font-weight:600;font-size:.9rem">${t.title}</span>
        <div style="display:flex;gap:.5rem;margin-top:.2rem">
          <span class="category-badge cat-${t.category}">${t.category}</span>
          ${t.dueDate ? `<span style="font-size:.75rem;color:#667588"><i class="fas fa-calendar"></i> ${formatDate(t.dueDate)}</span>` : ''}
        </div>
      </div>
      <button class="btn btn-sm btn-danger" onclick="deleteTodo('${t._id}')"><i class="fas fa-trash"></i></button>
    </div>
  `).join('');
}

async function addTodo() {
  const title = document.getElementById('todoTitle').value.trim();
  const category = document.getElementById('todoCategory').value;
  const dueDate = document.getElementById('todoDue').value;
  if (!title) return;
  try {
    await API.post('/api/todos', { title, category, dueDate });
    document.getElementById('todoTitle').value = '';
    document.getElementById('todoDue').value = '';
    showToast('Task added!');
    loadTodos();
  } catch (e) {
    showToast('Error adding task', true);
  }
}

async function toggleTodo(id, completed) {
  try {
    await API.put(`/api/todos/${id}`, { completed });
    loadTodos();
  } catch (e) {
    showToast('Error updating task', true);
  }
}

async function deleteTodo(id) {
  if (!confirm('Delete this task?')) return;
  try {
    await API.del(`/api/todos/${id}`);
    showToast('Task deleted!');
    loadTodos();
  } catch (e) {
    showToast('Error deleting task', true);
  }
}

// ============ POMODORO TIMER ============

const POMODORO_WORK = 25 * 60;
const POMODORO_BREAK = 5 * 60;
let timerSeconds = POMODORO_WORK;
let timerInterval = null;
let isWorkMode = true;
let sessionsCompleted = parseInt(localStorage.getItem('pomodoroSessions') || '0');

function updateTimerDisplay() {
  const m = Math.floor(timerSeconds / 60);
  const s = timerSeconds % 60;
  document.getElementById('timerDisplay').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  document.getElementById('sessionCount').textContent = sessionsCompleted;
}

function startTimer() {
  if (timerInterval) return;
  document.getElementById('timerStartBtn').style.display = 'none';
  document.getElementById('timerPauseBtn').style.display = 'inline-flex';
  timerInterval = setInterval(() => {
    timerSeconds--;
    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      if (isWorkMode) {
        sessionsCompleted++;
        localStorage.setItem('pomodoroSessions', sessionsCompleted);
        showToast('Work session complete! Time for a break!');
        isWorkMode = false;
        timerSeconds = POMODORO_BREAK;
      } else {
        showToast('Break over! Ready to focus!');
        isWorkMode = true;
        timerSeconds = POMODORO_WORK;
      }
      updateTimerDisplay();
      document.getElementById('timerStartBtn').style.display = 'inline-flex';
      document.getElementById('timerPauseBtn').style.display = 'none';
    }
    updateTimerDisplay();
  }, 1000);
}

function pauseTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
    document.getElementById('timerStartBtn').style.display = 'inline-flex';
    document.getElementById('timerPauseBtn').style.display = 'none';
  }
}

function resetTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  isWorkMode = true;
  timerSeconds = POMODORO_WORK;
  updateTimerDisplay();
  document.getElementById('timerStartBtn').style.display = 'inline-flex';
  document.getElementById('timerPauseBtn').style.display = 'none';
}

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

let groupStudents = [];

async function generateGroups() {
  const className = document.getElementById('ggClass').value;
  const groupCount = parseInt(document.getElementById('ggCount').value) || 3;
  try {
    const data = await API.get(`/api/students?className=${className}`);
    const names = data.students.map(s => s.name);
    if (names.length === 0) { showToast('No students in this class', true); return; }

    const shuffled = [...names];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const groups = Array.from({ length: groupCount }, () => []);
    shuffled.forEach((name, i) => groups[i % groupCount].push(name));

    document.getElementById('groupsOutput').innerHTML = groups.map((g, gi) => `
      <div class="group-card">
        <h4><i class="fas fa-users"></i> Group ${gi + 1} <span style="font-weight:400;font-size:.82rem;color:#667588">(${g.length} students)</span></h4>
        ${g.map(n => `<span class="student-chip">${n}</span>`).join('')}
      </div>
    `).join('');
  } catch (e) {
    showToast('Error loading students', true);
  }
}

// ============ NAME PICKER ============

let pickerStudents = [];
let excludedNames = new Set();

async function loadPickerStudents() {
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
  updateTimerDisplay();
  document.getElementById('sessionCount').textContent = sessionsCompleted;
  loadTodos();
  loadNotes();
  document.getElementById('notesArea').addEventListener('input', saveNotes);
  setInterval(saveNotes, 2000);
  loadPickerStudents();
});
