let lessons = [];

async function loadLessons() {
  const className = document.getElementById('lpClass').value;
  const date = document.getElementById('lpDate').value;
  try {
    const q = date ? `?className=${className}&date=${date}` : `?className=${className}`;
    lessons = await API.get(`/api/lessons${q}`);
    renderLessons();
  } catch (e) {
    showToast('Error loading lessons', true);
  }
}

function renderLessons() {
  const grid = document.getElementById('lessonGrid');
  if (lessons.length === 0) {
    grid.innerHTML = '<div class="empty-state"><i class="fas fa-book-open"></i><p>No lessons planned yet. Click "New Lesson" to start.</p></div>';
    return;
  }
  grid.innerHTML = lessons.map(l => `
    <div class="item-card">
      <h3>${l.topic}</h3>
      <p><i class="fas fa-calendar" style="color:#b8944e"></i> ${formatDate(l.date)}</p>
      ${l.objectives ? `<p><strong>Objectives:</strong> ${l.objectives}</p>` : ''}
      ${l.activities ? `<p><strong>Activities:</strong> ${l.activities}</p>` : ''}
      ${l.materials ? `<p class="meta"><i class="fas fa-paperclip"></i> ${l.materials}</p>` : ''}
      <p class="meta"><span class="class-badge">${l.className}</span></p>
      <div class="actions">
        <button class="btn btn-sm btn-outline" onclick="editLesson('${l._id}')"><i class="fas fa-edit"></i> Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteLesson('${l._id}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

function showAddLesson() {
  document.getElementById('lessonId').value = '';
  document.getElementById('lessonTopic').value = '';
  document.getElementById('lessonObjectives').value = '';
  document.getElementById('lessonActivities').value = '';
  document.getElementById('lessonMaterials').value = '';
  document.getElementById('modalTitle').textContent = 'New Lesson';
  document.getElementById('lessonModal').style.display = 'flex';
}

function hideAddLesson() {
  document.getElementById('lessonModal').style.display = 'none';
}

async function editLesson(id) {
  const l = lessons.find(x => x._id === id);
  if (!l) return;
  document.getElementById('lessonId').value = l._id;
  document.getElementById('lessonTopic').value = l.topic;
  document.getElementById('lessonObjectives').value = l.objectives || '';
  document.getElementById('lessonActivities').value = l.activities || '';
  document.getElementById('lessonMaterials').value = l.materials || '';
  document.getElementById('modalTitle').textContent = 'Edit Lesson';
  document.getElementById('lessonModal').style.display = 'flex';
}

async function saveLesson() {
  const id = document.getElementById('lessonId').value;
  const data = {
    className: document.getElementById('lpClass').value,
    date: document.getElementById('lpDate').value || todayStr(),
    topic: document.getElementById('lessonTopic').value.trim(),
    objectives: document.getElementById('lessonObjectives').value.trim(),
    activities: document.getElementById('lessonActivities').value.trim(),
    materials: document.getElementById('lessonMaterials').value.trim()
  };
  if (!data.topic) { showToast('Enter a lesson topic', true); return; }
  try {
    if (id) {
      await API.put(`/api/lessons/${id}`, data);
      showToast('Lesson updated!');
    } else {
      await API.post('/api/lessons', data);
      showToast('Lesson created!');
    }
    hideAddLesson();
    loadLessons();
  } catch (e) {
    showToast('Error saving lesson', true);
  }
}

async function deleteLesson(id) {
  if (!confirm('Delete this lesson?')) return;
  try {
    await API.del(`/api/lessons/${id}`);
    showToast('Lesson deleted!');
    loadLessons();
  } catch (e) {
    showToast('Error deleting lesson', true);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('lpDate').value = todayStr();
  loadLessons();
});
