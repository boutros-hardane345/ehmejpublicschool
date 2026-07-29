async function loadContent() {
  const className = document.getElementById('cClass').value;
  const semester = document.getElementById('cSemester').value;
  try {
    const q = `?className=${className}&semester=${semester}`;
    const data = await API.get(`/api/content${q}`);
    renderAnnouncements(data.announcements);
    renderExercises(data.exercises);
  } catch (e) {
    showToast('Error loading content', true);
  }
}

function renderAnnouncements(announcements) {
  const div = document.getElementById('announcementList');
  if (announcements.length === 0) {
    div.innerHTML = '<div class="empty-state"><i class="fas fa-bullhorn"></i><p>No announcements.</p></div>';
    return;
  }
  div.innerHTML = announcements.map(a => `
    <div class="item-card" style="border-left:3px solid #b8944e">
      <h3>${a.title}</h3>
      <p>${a.content}</p>
      <div class="meta">
        <span class="class-badge">${a.className}</span>
        <span>${new Date(a.createdAt).toLocaleDateString()}</span>
      </div>
      <div class="actions">
        <button class="btn btn-sm btn-danger" onclick="deleteAnnouncement('${a._id}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

function renderExercises(exercises) {
  const div = document.getElementById('exerciseList');
  if (exercises.length === 0) {
    div.innerHTML = '<div class="empty-state"><i class="fas fa-dumbbell"></i><p>No exercises.</p></div>';
    return;
  }
  const semLabels = { 1: 'S1', 2: 'S2', 3: 'Mid-Year', 4: 'S3' };
  div.innerHTML = exercises.map(e => `
    <div class="item-card" style="border-left:3px solid #5a7a4a">
      <h3>${e.title}</h3>
      ${e.description ? `<p>${e.description}</p>` : ''}
      <div class="meta">
        <span class="class-badge">${e.className}</span>
        <span>${semLabels[e.semester] || ''}</span>
        <span>${new Date(e.createdAt).toLocaleDateString()}</span>
      </div>
      <div class="actions">
        <button class="btn btn-sm btn-danger" onclick="deleteExercise('${e._id}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

function showAddAnnouncement() {
  document.getElementById('annClass').value = document.getElementById('cClass').value !== 'all' ? document.getElementById('cClass').value : 'Grade 7';
  document.getElementById('annTitle').value = '';
  document.getElementById('annContent').value = '';
  document.getElementById('annModal').style.display = 'flex';
}

function hideAnnModal() {
  document.getElementById('annModal').style.display = 'none';
}

async function saveAnnouncement() {
  const data = {
    className: document.getElementById('annClass').value,
    title: document.getElementById('annTitle').value.trim(),
    content: document.getElementById('annContent').value.trim()
  };
  if (!data.title || !data.content) { showToast('Fill in all fields', true); return; }
  try {
    await API.post('/api/announcements', data);
    showToast('Announcement posted!');
    hideAnnModal();
    loadContent();
  } catch (e) {
    showToast('Error posting announcement', true);
  }
}

async function deleteAnnouncement(id) {
  if (!confirm('Delete this announcement?')) return;
  try {
    await API.del(`/api/announcements/${id}`);
    showToast('Announcement deleted!');
    loadContent();
  } catch (e) {
    showToast('Error deleting', true);
  }
}

function showAddExercise() {
  document.getElementById('exClass').value = document.getElementById('cClass').value !== 'all' ? document.getElementById('cClass').value : 'Grade 7';
  document.getElementById('exTitle').value = '';
  document.getElementById('exDesc').value = '';
  document.getElementById('exSemester').value = '1';
  document.getElementById('exModal').style.display = 'flex';
}

function hideExModal() {
  document.getElementById('exModal').style.display = 'none';
}

async function saveExercise() {
  const title = document.getElementById('exTitle').value.trim();
  if (!title) { showToast('Enter a title', true); return; }
  try {
    const fd = new FormData();
    fd.append('className', document.getElementById('exClass').value);
    fd.append('title', title);
    fd.append('description', document.getElementById('exDesc').value.trim());
    fd.append('semester', document.getElementById('exSemester').value);
    const fileInput = document.getElementById('exFile');
    if (fileInput.files[0]) fd.append('file', fileInput.files[0]);
    const r = await fetch('/api/exercises', { method: 'POST', body: fd });
    if (!r.ok) throw new Error(await r.text());
    showToast('Exercise posted!');
    hideExModal();
    loadContent();
  } catch (e) {
    showToast('Error posting exercise', true);
  }
}

async function deleteExercise(id) {
  if (!confirm('Delete this exercise?')) return;
  try {
    await API.del(`/api/exercises/${id}`);
    showToast('Exercise deleted!');
    loadContent();
  } catch (e) {
    showToast('Error deleting', true);
  }
}

document.addEventListener('DOMContentLoaded', loadContent);
