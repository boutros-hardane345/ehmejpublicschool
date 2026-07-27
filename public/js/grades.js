let gradeStudents = [];
let gradeRecords = [];
let currentSemester = '1';

async function loadGrades() {
  const className = document.getElementById('gClass').value;
  const academicYear = document.getElementById('gYear').value;
  currentSemester = document.getElementById('gSemester').value;
  try {
    const q = `?className=${className}&academicYear=${academicYear}&semester=${currentSemester}`;
    const data = await API.get(`/api/grades${q}`);
    gradeStudents = data.students;
    gradeRecords = data.grades;
    const yearSelect = document.getElementById('gYear');
    yearSelect.innerHTML = data.academicYears.map(y => `<option value="${y}" ${y === academicYear ? 'selected' : ''}>${y}</option>`).join('');
    renderGrades();
  } catch (e) {
    showToast('Error loading grades', true);
  }
}

function renderGrades() {
  const sn = parseInt(currentSemester);
  const isSimple = sn === 3 || sn === 6;
  const periodLabels = { 1: 'S1', 2: 'S2', 3: 'Mid-Year', 4: 'S3', 5: 'S4', 6: 'Final-Year' };

  const head = document.getElementById('gradeHead');
  head.innerHTML = isSimple
    ? '<tr><th>Student</th><th>Class</th><th>Grade /60</th><th>Save</th></tr>'
    : '<tr><th>Student</th><th>Class</th><th>Att /6</th><th>DS1 /8</th><th>DS2 /8</th><th>DS3 /8</th><th>Exam /30</th><th>Total /60</th><th>Save</th></tr>';

  document.getElementById('gradeContext').textContent = `Period: ${periodLabels[sn] || 'S' + sn}`;

  const tbody = document.getElementById('gradeBody');
  const empty = document.getElementById('gradeEmpty');

  if (gradeStudents.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = gradeStudents.map(s => {
    const g = gradeRecords.find(r => r.studentId === s._id);
    if (isSimple) {
      const val = g ? g.final60 : 0;
      const cls = val >= 30 ? 'grade-pass' : val >= 24 ? 'grade-border' : 'grade-fail';
      return `<tr>
        <td><strong>${s.name}</strong></td>
        <td><span class="class-badge">${s.className}</span></td>
        <td><input class="grade-input ${cls}" type="number" min="0" max="60" step="0.1" value="${val}" id="g_${s._id}_exam" data-sid="${s._id}"></td>
        <td><button class="btn btn-sm btn-success" onclick="saveGrade('${s._id}')"><i class="fas fa-save"></i></button></td>
      </tr>`;
    }
    const att = g ? g.attendance : 0;
    const ds1 = g && g.ds ? g.ds[0] || 0 : 0;
    const ds2 = g && g.ds ? g.ds[1] || 0 : 0;
    const ds3 = g && g.ds ? g.ds[2] || 0 : 0;
    const exam = g ? g.bigExam : 0;
    const raw = att + ds1 + ds2 + ds3 + exam;
    const fCls = raw >= 30 ? 'grade-pass' : raw >= 24 ? 'grade-border' : 'grade-fail';
    return `<tr>
      <td><strong>${s.name}</strong></td>
      <td><span class="class-badge">${s.className}</span></td>
      <td><input class="grade-input" type="number" min="0" max="6" step="0.1" value="${att.toFixed(1)}" id="g_${s._id}_att"></td>
      <td><input class="grade-input" type="number" min="0" max="8" step="0.1" value="${ds1.toFixed(1)}" id="g_${s._id}_ds1"></td>
      <td><input class="grade-input" type="number" min="0" max="8" step="0.1" value="${ds2.toFixed(1)}" id="g_${s._id}_ds2"></td>
      <td><input class="grade-input" type="number" min="0" max="8" step="0.1" value="${ds3.toFixed(1)}" id="g_${s._id}_ds3"></td>
      <td><input class="grade-input" type="number" min="0" max="30" step="0.1" value="${exam.toFixed(1)}" id="g_${s._id}_exam"></td>
      <td class="grade-final ${fCls}">${raw.toFixed(1)}</td>
      <td><button class="btn btn-sm btn-success" onclick="saveGrade('${s._id}')"><i class="fas fa-save"></i></button></td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.grade-input').forEach(inp => {
    inp.addEventListener('input', () => updateRowTotal(inp.dataset.sid));
  });
}

function updateRowTotal(sid) {
  const att = parseFloat(document.getElementById(`g_${sid}_att`)?.value) || 0;
  const ds1 = parseFloat(document.getElementById(`g_${sid}_ds1`)?.value) || 0;
  const ds2 = parseFloat(document.getElementById(`g_${sid}_ds2`)?.value) || 0;
  const ds3 = parseFloat(document.getElementById(`g_${sid}_ds3`)?.value) || 0;
  const exam = parseFloat(document.getElementById(`g_${sid}_exam`)?.value) || 0;
  const total = att + ds1 + ds2 + ds3 + exam;
  const row = document.getElementById(`g_${sid}_att`)?.closest('tr');
  if (row) {
    const td = row.querySelector('.grade-final');
    if (td) {
      td.textContent = total.toFixed(1);
      td.className = 'grade-final ' + (total >= 30 ? 'grade-pass' : total >= 24 ? 'grade-border' : 'grade-fail');
    }
  }
}

async function saveGrade(sid) {
  const sn = parseInt(currentSemester);
  const isSimple = sn === 3 || sn === 6;
  const body = { studentId: sid, semester: sn };
  if (isSimple) {
    body.bigExam = parseFloat(document.getElementById(`g_${sid}_exam`)?.value) || 0;
  } else {
    body.attendance = parseFloat(document.getElementById(`g_${sid}_att`)?.value) || 0;
    body.ds1 = parseFloat(document.getElementById(`g_${sid}_ds1`)?.value) || 0;
    body.ds2 = parseFloat(document.getElementById(`g_${sid}_ds2`)?.value) || 0;
    body.ds3 = parseFloat(document.getElementById(`g_${sid}_ds3`)?.value) || 0;
    body.bigExam = parseFloat(document.getElementById(`g_${sid}_exam`)?.value) || 0;
  }
  try {
    await API.post('/api/grades', body);
    showToast('Grade saved!');
    loadGrades();
  } catch (e) {
    showToast('Error saving grade', true);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const y = document.getElementById('gYear');
  const d = new Date();
  const cy = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
  y.innerHTML = `<option value="${cy}-${cy+1}">${cy}-${cy+1}</option>`;
  loadGrades();
});
