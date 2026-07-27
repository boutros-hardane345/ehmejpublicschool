async function loadDashboard() {
  try {
    const [analytics, year] = await Promise.all([
      API.get('/api/analytics'),
      API.get('/api/academic-year')
    ]);

    document.getElementById('academicYear').textContent = year.year;
    document.getElementById('statPresent').textContent = analytics.present;
    document.getElementById('statAbsent').textContent = analytics.absent;
    document.getElementById('statRate').textContent = analytics.attendanceRate + '%';
    document.getElementById('statLessons').textContent = analytics.lessonCount;

    renderAttendanceChart(analytics.present, analytics.absent);
    renderClassChart(analytics.classBreakdown);
    renderRecentTable(analytics.recentAttendance);
    renderTodoChart(analytics.todosDone, analytics.todosTotal - analytics.todosDone);
    renderClassBreakdown(analytics.classBreakdown);
  } catch (e) {
    showToast('Failed to load dashboard data', true);
  }
}

function renderAttendanceChart(present, absent) {
  const ctx = document.getElementById('attendanceChart').getContext('2d');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Present', 'Absent'],
      datasets: [{
        data: [present, absent],
        backgroundColor: ['#27ae60', '#e74c3c'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

function renderClassChart(classBreakdown) {
  const ctx = document.getElementById('classChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: classBreakdown.map(c => c.className.replace('Grade ', 'G')),
      datasets: [{
        label: 'Attendance Rate %',
        data: classBreakdown.map(c => c.rate),
        backgroundColor: ['#b8944e', '#1a4a6e', '#27ae60'],
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true, max: 100 } },
      plugins: { legend: { display: false } }
    }
  });
}

function renderRecentTable(records) {
  const tbody = document.getElementById('recentTable');
  if (!records || records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No attendance records yet.</td></tr>';
    return;
  }
  tbody.innerHTML = records.slice(0, 7).map(r => `
    <tr>
      <td>${formatDate(r.date)}</td>
      <td><span class="class-badge">${r.className}</span></td>
      <td class="status-present">${r.present}</td>
      <td class="status-absent">${r.absent}</td>
      <td><strong>${r.rate}%</strong></td>
    </tr>
  `).join('');
}

function renderTodoChart(done, pending) {
  const ctx = document.getElementById('todoChart').getContext('2d');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Completed', 'Pending'],
      datasets: [{
        data: [done, pending],
        backgroundColor: ['#27ae60', '#d4c9ba'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

function renderClassBreakdown(classBreakdown) {
  const div = document.getElementById('classBreakdown');
  div.innerHTML = classBreakdown.map(c => `
    <div style="margin-bottom:1rem">
      <div style="display:flex;justify-content:space-between;margin-bottom:.3rem">
        <strong style="font-size:.9rem">${c.className}</strong>
        <span style="font-size:.85rem;color:#667588">${c.rate}%</span>
      </div>
      <div style="display:flex;gap:0;height:24px;border-radius:999px;overflow:hidden;background:#f0ece6">
        <div style="background:#27ae60;flex:${c.present};transition:flex .5s"></div>
        <div style="background:#e74c3c;flex:${Math.max(c.absent,1)};transition:flex .5s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:.75rem;color:#667588;margin-top:.2rem">
        <span>${c.present} present</span>
        <span>${c.absent} absent</span>
      </div>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', loadDashboard);
