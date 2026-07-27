const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6];
let scheduleEntries = [];

async function loadSchedule() {
  const className = document.getElementById('schClass').value;
  try {
    scheduleEntries = await API.get(`/api/schedule?className=${className}`);
    renderSchedule();
  } catch (e) {
    showToast('Error loading schedule', true);
  }
}

function renderSchedule() {
  const tbody = document.getElementById('scheduleBody');
  tbody.innerHTML = PERIODS.map(p => {
    const cols = DAYS.map(day => {
      const entries = scheduleEntries.filter(e => e.day === day && e.period === p);
      return entries.length > 0
        ? `<td onclick="editEntry('${entries[0]._id}')">${entries.map(e => `<div class="schedule-entry">${e.subject}<span class="sub">${e.teacher}${e.room ? ' · ' + e.room : ''}</span></div>`).join('')}</td>`
        : `<td onclick="showAddEntry('${day}', ${p})"><span style="color:#b9c4ce;font-size:.7rem">—</span></td>`;
    });
    return `<tr><td class="period-label">P${p}</td>${cols.join('')}</tr>`;
  }).join('');
}

function showAddEntry(day, period) {
  document.getElementById('entryId').value = '';
  document.getElementById('entryModalTitle').textContent = 'Add Schedule Entry';
  document.getElementById('entrySubject').value = '';
  document.getElementById('entryTeacher').value = '';
  document.getElementById('entryRoom').value = '';
  document.getElementById('deleteEntryBtn').style.display = 'none';
  if (day) document.getElementById('entryDay').value = day;
  if (period) document.getElementById('entryPeriod').value = period;
  document.getElementById('entryModal').style.display = 'flex';
}

function hideEntryModal() {
  document.getElementById('entryModal').style.display = 'none';
}

async function editEntry(id) {
  const e = scheduleEntries.find(x => x._id === id);
  if (!e) return;
  document.getElementById('entryId').value = e._id;
  document.getElementById('entryModalTitle').textContent = 'Edit Entry';
  document.getElementById('entryDay').value = e.day;
  document.getElementById('entryPeriod').value = e.period;
  document.getElementById('entrySubject').value = e.subject || '';
  document.getElementById('entryTeacher').value = e.teacher || '';
  document.getElementById('entryRoom').value = e.room || '';
  document.getElementById('deleteEntryBtn').style.display = 'inline-flex';
  document.getElementById('entryModal').style.display = 'flex';
}

async function saveEntry() {
  const id = document.getElementById('entryId').value;
  const data = {
    className: document.getElementById('schClass').value,
    day: document.getElementById('entryDay').value,
    period: parseInt(document.getElementById('entryPeriod').value),
    subject: document.getElementById('entrySubject').value.trim(),
    teacher: document.getElementById('entryTeacher').value.trim(),
    room: document.getElementById('entryRoom').value.trim()
  };
  if (!data.subject) { showToast('Enter a subject', true); return; }
  try {
    if (id) {
      await API.put(`/api/schedule/${id}`, data);
      showToast('Entry updated!');
    } else {
      await API.post('/api/schedule', data);
      showToast('Entry added!');
    }
    hideEntryModal();
    loadSchedule();
  } catch (e) {
    showToast('Error saving entry', true);
  }
}

async function deleteEntry() {
  const id = document.getElementById('entryId').value;
  if (!id || !confirm('Delete this entry?')) return;
  try {
    await API.del(`/api/schedule/${id}`);
    showToast('Entry deleted!');
    hideEntryModal();
    loadSchedule();
  } catch (e) {
    showToast('Error deleting entry', true);
  }
}

document.addEventListener('DOMContentLoaded', loadSchedule);
