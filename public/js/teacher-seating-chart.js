let currentChart = null;
let allStudents = [];
let unassignedStudents = [];
let selectedDesk = null;

function init() {
  loadQuote();
  API.get('/api/classes').then(cls => {
    const sel = document.getElementById('scClass');
    sel.innerHTML = cls.map(c => '<option value="' + c + '">' + c + '</option>').join('');
  });
}

document.getElementById('loadSeatingBtn').addEventListener('click', loadSeating);
document.getElementById('saveSeatingBtn').addEventListener('click', saveSeating);
document.getElementById('resizeGrid').addEventListener('click', resizeGrid);

async function loadSeating() {
  const className = document.getElementById('scClass').value;
  if (!className) return;

  try {
    const [chart, students] = await Promise.all([
      API.get('/api/seating/' + encodeURIComponent(className)),
      API.get('/api/students?className=' + encodeURIComponent(className))
    ]);

    currentChart = chart;
    allStudents = students.students || [];

    document.getElementById('scRows').value = chart.rows || 4;
    document.getElementById('scCols').value = chart.cols || 5;
    document.getElementById('seatingControls').style.display = '';

    updateUnassigned();
    renderGrid();
    document.getElementById('seatingGrid').style.display = '';
    document.getElementById('seatingEmpty').style.display = 'none';
  } catch (e) {
    showToast('Error loading seating chart', 'error');
  }
}

function updateUnassigned() {
  const assigned = (currentChart.desks || []).filter(d => d.studentName).map(d => d.studentName);
  unassignedStudents = allStudents
    .map(s => s.name)
    .filter(name => !assigned.includes(name));

  const container = document.getElementById('unassignedStudents');
  if (unassignedStudents.length === 0) {
    container.innerHTML = '<span class="text-muted">All students assigned</span>';
    return;
  }
  container.innerHTML = unassignedStudents.map(name =>
    '<span class="badge badge-neutral" style="cursor:pointer" onclick="assignFromUnassigned(\'' + escapeHtml(name) + '\')">' + escapeHtml(name) + ' +</span>'
  ).join('');
}

function renderGrid() {
  const grid = document.getElementById('seatingGrid');
  const rows = parseInt(document.getElementById('scRows').value);
  const cols = parseInt(document.getElementById('scCols').value);
  currentChart.rows = rows;
  currentChart.cols = cols;

  grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';

  const desks = currentChart.desks || [];
  let html = '';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const desk = desks.find(d => d.row === r && d.col === c);
      const studentName = desk ? desk.studentName : '';
      const isOccupied = !!studentName;
      html += '<div class="seat-card ' + (isOccupied ? 'occupied' : 'empty') + '" data-row="' + r + '" data-col="' + c + '" onclick="clickDesk(' + r + ',' + c + ',\'' + escapeAttr(studentName) + '\')">' +
        (isOccupied ? escapeHtml(studentName) : 'Empty') +
        '</div>';
    }
  }

  grid.innerHTML = html;
  selectedDesk = null;
}

function clickDesk(row, col, currentName) {
  const desks = currentChart.desks || [];
  const idx = desks.findIndex(d => d.row === row && d.col === col);

  selectedDesk = { row, col, idx, currentName };

  if (currentName) {
    if (confirm('Remove ' + currentName + ' from this seat?')) {
      if (idx >= 0) {
        desks.splice(idx, 1);
        currentChart.desks = desks;
        updateUnassigned();
        renderGrid();
        showToast(currentName + ' removed', 'success');
      }
    }
  } else {
    const available = unassignedStudents;
    if (available.length === 0) {
      showToast('No unassigned students', 'error');
      return;
    }
    const name = prompt('Enter student name to assign:\nAvailable: ' + available.join(', '));
    if (name && available.includes(name.trim())) {
      const trimmed = name.trim();
      if (!currentChart.desks) currentChart.desks = [];
      currentChart.desks.push({ row, col, studentName: trimmed });
      updateUnassigned();
      renderGrid();
      showToast(trimmed + ' assigned', 'success');
    } else if (name) {
      showToast('Student not in unassigned list', 'error');
    }
  }
}

function assignFromUnassigned(name) {
  if (!selectedDesk) {
    if (!currentChart.desks) currentChart.desks = [];
    const rows = parseInt(document.getElementById('scRows').value);
    const cols = parseInt(document.getElementById('scCols').value);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!currentChart.desks.find(d => d.row === r && d.col === c)) {
          currentChart.desks.push({ row: r, col: c, studentName: name });
          updateUnassigned();
          renderGrid();
          showToast(name + ' assigned', 'success');
          return;
        }
      }
    }
    showToast('No empty seats', 'error');
  } else {
    const d = currentChart.desks.find(d => d.row === selectedDesk.row && d.col === selectedDesk.col);
    if (d) {
      unassignedStudents.push(d.studentName);
      d.studentName = name;
    } else {
      if (!currentChart.desks) currentChart.desks = [];
      currentChart.desks.push({ row: selectedDesk.row, col: selectedDesk.col, studentName: name });
    }
    updateUnassigned();
    renderGrid();
    showToast(name + ' assigned', 'success');
  }
}

function resizeGrid() {
  const rows = parseInt(document.getElementById('scRows').value);
  const cols = parseInt(document.getElementById('scCols').value);
  if (rows < 1 || cols < 1) return;
  currentChart.desks = (currentChart.desks || []).filter(d => d.row < rows && d.col < cols);
  renderGrid();
  updateUnassigned();
  showToast('Grid resized', 'success');
}

async function saveSeating() {
  const className = document.getElementById('scClass').value;
  if (!className) return;
  const btn = document.getElementById('saveSeatingBtn');
  btn.textContent = 'Saving...';
  try {
    await API.post('/api/seating', {
      className,
      rows: currentChart.rows,
      cols: currentChart.cols,
      desks: currentChart.desks || []
    });
    showToast('Seating chart saved', 'success');
  } catch (e) {
    showToast('Error saving', 'error');
  }
  btn.textContent = 'Save Layout';
}

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

function escapeAttr(t) {
  return t.replace(/'/g, '\\\'').replace(/"/g, '&quot;');
}

init();