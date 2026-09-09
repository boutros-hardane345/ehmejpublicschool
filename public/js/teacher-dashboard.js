function loadQuote() {
  API.get('/api/quote').then(q => {
    document.getElementById('sideQuote').textContent = '\u201C' + q.text + '\u201D \u2014 ' + q.author;
  });
}

async function loadDashboard() {
  try {
    const [yearData, students, grades] = await Promise.all([
      API.get('/api/academic-year'),
      API.get('/api/students'),
      API.get('/api/grades')
    ]);

    document.getElementById('academicYear').textContent = 'Academic Year ' + yearData.year;
    document.getElementById('totalStudents').textContent = students.students.length;

    const allG = grades.grades || [];
    const classList = ['Grade 7', 'Grade 8', 'Grade 9'];
    const semesters = [1, 2, 3, 4, 5, 6];
    const semLabels = { 1: 'S1', 2: 'S2', 3: 'Mid', 4: 'S3', 5: 'S4', 6: 'Final' };

    let totalAvgSum = 0;
    let totalAvgCount = 0;

    const rows = classList.map(cn => {
      const clsStudents = students.students.filter(s => s.className === cn);
      const clsIds = clsStudents.map(s => s._id);
      const clsGrades = allG.filter(g => clsIds.some(id => id === g.studentId || id.toString() === g.studentId.toString()));

      const semAvgs = semesters.map(sem => {
        const sg = clsGrades.filter(g => g.semester === sem);
        const avg = sg.length ? Math.round(sg.reduce((a, g) => a + g.final60, 0) / sg.length * 10) / 10 : 0;
        if (avg > 0) { totalAvgSum += avg; totalAvgCount++; }
        return avg;
      });

      return '<tr>' +
        '<td><span class="badge badge-neutral">' + cn + '</span></td>' +
        '<td><strong>' + clsStudents.length + '</strong></td>' +
        semAvgs.map(a =>
          '<td class="' + (a >= 30 ? 'text-pass' : a >= 24 ? 'text-border' : 'text-fail') + '">' + a.toFixed(1) + '</td>'
        ).join('') +
        '</tr>';
    });

    if (rows.length === 0 || rows.every(r => r.includes('0 students'))) {
      document.getElementById('avgTableBody').innerHTML = '<tr><td colspan="8" class="text-center text-muted">No students enrolled.</td></tr>';
    } else {
      document.getElementById('avgTableBody').innerHTML = rows.join('');
    }

    const overall = totalAvgCount ? (totalAvgSum / totalAvgCount).toFixed(1) : '0.0';
    document.getElementById('overallAvg').textContent = overall;

  } catch (err) {
    document.getElementById('avgTableBody').innerHTML = '<tr><td colspan="8" class="text-center text-muted">Error loading data.</td></tr>';
  }
}

loadQuote();
loadDashboard();