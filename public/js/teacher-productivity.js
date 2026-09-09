// ====== TIMER ======
let timerInterval = null;
let timerSeconds = 25 * 60;
let timerRunning = false;
let timerPhase = 'work';
const WORK_TIME = 25 * 60;
const BREAK_TIME = 5 * 60;

function updateTimerDisplay() {
  const m = Math.floor(timerSeconds / 60);
  const s = timerSeconds % 60;
  document.getElementById('timerDisplay').textContent =
    String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  const phase = timerPhase === 'work' ? 'Work' : 'Break';
  document.getElementById('timerPhase').textContent = phase;
}

document.getElementById('timerStart').addEventListener('click', function () {
  if (timerRunning) return;
  timerRunning = true;
  timerInterval = setInterval(() => {
    timerSeconds--;
    updateTimerDisplay();
    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      timerPhase = timerPhase === 'work' ? 'break' : 'work';
      timerSeconds = timerPhase === 'work' ? WORK_TIME : BREAK_TIME;
      updateTimerDisplay();
      document.getElementById('timerPhase').textContent = timerPhase === 'work' ? 'Work' : 'Break';
      showToast(timerPhase === 'work' ? 'Break over! Time to work.' : 'Work session complete! Take a break.', 'success');
    }
  }, 1000);
});

document.getElementById('timerPause').addEventListener('click', function () {
  clearInterval(timerInterval);
  timerRunning = false;
});

document.getElementById('timerReset').addEventListener('click', function () {
  clearInterval(timerInterval);
  timerRunning = false;
  timerPhase = 'work';
  timerSeconds = WORK_TIME;
  updateTimerDisplay();
});

// ====== NAME PICKER ======
document.getElementById('pickNameBtn').addEventListener('click', function () {
  const text = document.getElementById('pickerNames').value.trim();
  const names = text.split('\n').map(n => n.trim()).filter(Boolean);
  if (names.length === 0) {
    showToast('Enter some names first', 'error');
    return;
  }
  const picked = names[Math.floor(Math.random() * names.length)];
  const result = document.getElementById('pickerResult');
  result.textContent = picked;
  result.className = 'result highlight';
  setTimeout(() => { result.className = 'result'; }, 1200);
});

document.getElementById('resetPickerBtn').addEventListener('click', function () {
  document.getElementById('pickerNames').value = '';
  const result = document.getElementById('pickerResult');
  result.textContent = 'Ready';
  result.className = 'result';
});

// ====== GROUP GENERATOR ======
document.getElementById('makeGroupsBtn').addEventListener('click', function () {
  const text = document.getElementById('groupNames').value.trim();
  const names = text.split('\n').map(n => n.trim()).filter(Boolean);
  if (names.length === 0) {
    showToast('Enter some names first', 'error');
    return;
  }

  const perGroup = parseInt(document.getElementById('groupSize').value) || 3;
  const numGroups = parseInt(document.getElementById('numGroups').value) || 0;
  const shuffled = [...names].sort(() => Math.random() - 0.5);
  let groups = [];

  if (numGroups > 0) {
    const size = Math.ceil(shuffled.length / numGroups);
    for (let i = 0; i < numGroups; i++) {
      groups.push(shuffled.slice(i * size, (i + 1) * size));
    }
  } else {
    for (let i = 0; i < shuffled.length; i += perGroup) {
      groups.push(shuffled.slice(i, i + perGroup));
    }
  }

  const container = document.getElementById('groupsContainer');
  container.innerHTML = groups.map((g, i) =>
    '<div class="group-card">' +
    '<h4>Group ' + (i + 1) + '</h4>' +
    g.map(n => '<span class="member">' + escapeHtml(n) + '</span>').join('') +
    '</div>'
  ).join('');
});

document.getElementById('clearGroupsBtn').addEventListener('click', function () {
  document.getElementById('groupsContainer').innerHTML = '';
});

// ====== TO-DO LIST ======
async function loadTodos() {
  try {
    const todos = await API.get('/api/todos');
    renderTodos(todos);
  } catch (e) {
    document.getElementById('todoList').innerHTML = '<p class="text-muted">Error loading todos.</p>';
  }
}

function renderTodos(todos) {
  const list = document.getElementById('todoList');
  if (todos.length === 0) {
    list.innerHTML = '<p class="text-muted" style="text-align:center;padding:1rem">No tasks yet.</p>';
    return;
  }
  list.innerHTML = todos.map(t =>
    '<div class="todo-item">' +
    '<div class="check' + (t.completed ? ' done' : '') + '" onclick="toggleTodo(\'' + t._id + '\', ' + !t.completed + ')">' +
    (t.completed ? '\u2713' : '') +
    '</div>' +
    '<div class="todo-text' + (t.completed ? ' done' : '') + '">' +
    escapeHtml(t.title) +
    '<div class="todo-meta">' +
    (t.category ? '<span>' + escapeHtml(t.category) + '</span>' : '') +
    (t.dueDate ? '<span>Due ' + formatDate(t.dueDate) + '</span>' : '') +
    '</div></div>' +
    '<button class="del-btn" onclick="deleteTodo(\'' + t._id + '\')">Delete</button>' +
    '</div>'
  ).join('');
}

async function toggleTodo(id, completed) {
  await API.put('/api/todos/' + id, { completed });
  loadTodos();
}

async function deleteTodo(id) {
  if (!confirm('Delete this task?')) return;
  await API.del('/api/todos/' + id);
  showToast('Task deleted', 'success');
  loadTodos();
}

document.getElementById('addTodoBtn').addEventListener('click', async function () {
  const title = document.getElementById('todoTitle').value.trim();
  if (!title) return;
  const dueDate = document.getElementById('todoDue').value || null;
  const category = document.getElementById('todoCat').value || null;
  try {
    await API.post('/api/todos', { title, dueDate, category, completed: false });
    showToast('Task added', 'success');
    document.getElementById('todoTitle').value = '';
    document.getElementById('todoDue').value = '';
    document.getElementById('todoCat').value = '';
    loadTodos();
  } catch (e) {
    showToast('Error adding task', 'error');
  }
});

// ====== INIT ======
function loadQuote() {
  API.get('/api/quote').then(q => {
    document.getElementById('sideQuote').textContent = '\u201C' + q.text + '\u201D \u2014 ' + q.author;
  });
}

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

updateTimerDisplay();
loadQuote();
loadTodos();