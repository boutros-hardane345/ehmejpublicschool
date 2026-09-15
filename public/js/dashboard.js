async function loadDashboard() {
  try {
    const [analytics, year] = await Promise.all([
      API.get('/api/analytics'),
      API.get('/api/academic-year')
    ]);

    document.getElementById('academicYear').textContent = year.year;
    document.getElementById('statLessons').textContent = analytics.lessonCount;
    document.getElementById('statTodos').textContent = analytics.todosDone;

    renderTodoChart(analytics.todosDone, analytics.todosTotal - analytics.todosDone);
  } catch (e) {
    showToast('Failed to load dashboard data', true);
  }
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

document.addEventListener('DOMContentLoaded', loadDashboard);
