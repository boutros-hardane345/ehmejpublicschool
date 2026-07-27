let desks = [];

async function loadSeating() {
  const className = document.getElementById('scClass').value;
  const rows = parseInt(document.getElementById('scRows').value) || 4;
  const cols = parseInt(document.getElementById('scCols').value) || 5;
  try {
    const data = await API.get(`/api/seating/${className}`);
    if (data && data.desks && data.desks.length > 0) {
      desks = data.desks;
      document.getElementById('scRows').value = data.rows || rows;
      document.getElementById('scCols').value = data.cols || cols;
    } else {
      desks = [];
    }
    renderSeating();
  } catch (e) {
    showToast('Error loading seating chart', true);
  }
}

function renderSeating() {
  const rows = parseInt(document.getElementById('scRows').value) || 4;
  const cols = parseInt(document.getElementById('scCols').value) || 5;
  const grid = document.getElementById('deskGrid');
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  let html = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const desk = desks.find(d => d.row === r && d.col === c);
      const hasStudent = desk && desk.studentName;
      html += `
        <div class="desk-cell ${hasStudent ? '' : 'empty'}" onclick="editDesk(${r},${c})">
          ${hasStudent ? `<span class="desk-label">Desk ${String.fromCharCode(65+r)}${c+1}</span><span class="student-name">${desk.studentName}</span>` : `<span class="desk-label">Desk ${String.fromCharCode(65+r)}${c+1}</span><span style="font-size:.65rem;color:#b9c4ce">Empty</span>`}
        </div>
      `;
    }
  }
  grid.innerHTML = html;
}

function editDesk(row, col) {
  document.getElementById('editRow').value = row;
  document.getElementById('editCol').value = col;
  const desk = desks.find(d => d.row === row && d.col === col);
  document.getElementById('studentNameInput').value = desk && desk.studentName ? desk.studentName : '';
  document.getElementById('studentModal').style.display = 'flex';
}

function assignStudent() {
  const row = parseInt(document.getElementById('editRow').value);
  const col = parseInt(document.getElementById('editCol').value);
  const name = document.getElementById('studentNameInput').value.trim();
  const existing = desks.findIndex(d => d.row === row && d.col === col);
  if (existing >= 0) {
    if (name) {
      desks[existing].studentName = name;
    } else {
      desks.splice(existing, 1);
    }
  } else if (name) {
    desks.push({ row, col, studentName: name });
  }
  closeStudentModal();
  renderSeating();
}

function removeStudent() {
  const row = parseInt(document.getElementById('editRow').value);
  const col = parseInt(document.getElementById('editCol').value);
  desks = desks.filter(d => !(d.row === row && d.col === col));
  closeStudentModal();
  renderSeating();
}

function closeStudentModal() {
  document.getElementById('studentModal').style.display = 'none';
}

async function saveSeating() {
  const className = document.getElementById('scClass').value;
  const rows = parseInt(document.getElementById('scRows').value) || 4;
  const cols = parseInt(document.getElementById('scCols').value) || 5;
  try {
    await API.post('/api/seating', { className, rows, cols, desks });
    showToast('Seating chart saved!');
  } catch (e) {
    showToast('Error saving seating chart', true);
  }
}

document.addEventListener('DOMContentLoaded', loadSeating);
