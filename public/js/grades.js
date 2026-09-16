let gradeStudents = [];
let gradeRecords = [];
let currentSemester = '1';
let currentNumDS = 3;

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
  if (isSimple) {
    head.innerHTML = '<tr><th>Student</th><th>Class</th><th>Grade /20</th><th>Save</th></tr>';
  } else {
    head.innerHTML = '<tr><th>Student</th><th>Class</th><th>Att /20</th><th>DS avg /20</th><th>Exam /20</th><th>Final /20</th><th>Save</th></tr>';
  }

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
      const val = g ? final20(g) : 0;
      const cls = val >= 10 ? 'grade-pass' : val >= 8 ? 'grade-border' : 'grade-fail';
      return `<tr>
        <td><strong>${s.name}</strong></td>
        <td><span class="class-badge">${s.className}</span></td>
        <td><input class="grade-input ${cls}" type="number" min="0" max="20" step="0.1" value="${val.toFixed(1)}" id="g_${s._id}_exam" data-sid="${s._id}"></td>
        <td><button class="btn btn-sm btn-success" onclick="saveGrade('${s._id}')"><i class="fas fa-save"></i></button></td>
      </tr>`;
    }
    const att = getAttendanceDisplay20(g);
    const dsAvg = getDSDisplay20(g);
    const exam = getExamDisplay20(g);
    const avg = g ? final20(g) : 0;
    const fCls = avg >= 10 ? 'grade-pass' : avg >= 8 ? 'grade-border' : 'grade-fail';
    const numDS = g ? (g.numDS || 3) : 3;
    currentNumDS = numDS;
    const dsFieldsHtml = buildDSFields(numDS, g, s._id);
    return `<tr>
      <td><strong>${s.name}</strong></td>
      <td><span class="class-badge">${s.className}</span></td>
      <td><input class="grade-input" type="number" min="0" max="20" step="0.1" value="${att.toFixed(1)}" id="g_${s._id}_att" data-sid="${s._id}"></td>
      <td><div class="ds-fields" id="ds_${s._id}">${dsFieldsHtml}</div></td>
      <td><input class="grade-input" type="number" min="0" max="20" step="0.1" value="${exam.toFixed(1)}" id="g_${s._id}_exam" data-sid="${s._id}"></td>
      <td class="grade-final ${fCls}">${avg.toFixed(1)}</td>
      <td><button class="btn btn-sm btn-success" onclick="saveGrade('${s._id}')"><i class="fas fa-save"></i></button></td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.grade-input').forEach(inp => {
    inp.addEventListener('input', () => updateRowTotal(inp.dataset.sid));
  });
}

function buildDSFields(numDS, g, sid) {
  let html = '';
  const ds = g ? (g.ds || []) : [];
  for (let i = 0; i < numDS; i++) {
    const val = ds[i] !== undefined ? ds[i] : '';
    html += `<input class="grade-input" type="number" min="0" max="20" step="0.1" value="${val}" id="g_${sid}_ds${i}" data-sid="${sid}" data-ds-index="${i}">`;
  }
  return html;
}

function updateRowTotal(sid) {
  const att = parseFloat(document.getElementById(`g_${sid}_att`)?.value) || 0;
  const numDS = currentNumDS || 3;
  let dsSum = 0;
  for (let i = 0; i < numDS; i++) {
    const el = document.getElementById(`g_${sid}_ds${i}`);
    if (el) dsSum += parseFloat(el.value) || 0;
  }
  const dsAvg = numDS > 0 ? dsSum / numDS : 0;
  const exam = parseFloat(document.getElementById(`g_${sid}_exam`)?.value) || 0;
  const sn = parseInt(currentSemester);
  const hasExam = sn !== 3 && sn !== 6;
  const attContribution = (att / 10) * 6;
  const dsContribution = (dsAvg / 20) * (hasExam ? 24 : 54);
  const examContribution = (exam / 20) * 30;
  const total = attContribution + dsContribution + examContribution;
  const final20 = total / 3;
  const row = document.getElementById(`g_${sid}_att`)?.closest('tr');
  if (row) {
    const td = row.querySelector('.grade-final');
    if (td) {
      td.textContent = final20.toFixed(1);
      td.className = 'grade-final ' + (final20 >= 10 ? 'grade-pass' : final20 >= 8 ? 'grade-border' : 'grade-fail');
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
    const numDS = currentNumDS || 3;
    const dsValues = [];
    for (let i = 0; i < numDS; i++) {
      const el = document.getElementById(`g_${sid}_ds${i}`);
      dsValues.push(parseFloat(el.value) || 0);
    }
    body.ds = dsValues;
    body.numDS = numDS;
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

function hasFinal20(g) {
  return g && typeof g.final20 === 'number' && (g.final20 !== 0 || !g.final60 || g.rawTotal <= 20);
}

function final20(g) {
  return hasFinal20(g) ? g.final20 : ((g.final60 || 0) / 3);
}

function final60(g) {
  return g ? (typeof g.final60 === 'number' ? g.final60 : final20(g) * 3) : 0;
}

function hasGrade20(g) {
  return !!g && typeof g.final20 === 'number' && (g.final20 !== 0 || !g.final60 || g.rawTotal <= 20);
}

function getAttendanceDisplay20(g) {
  if (!g) return 0;
  if (hasGrade20(g)) return (g.attendance || 0) / 10 * 20;
  return g.attendance || 0;
}

function getDSDisplay20(g) {
  if (!g) return 0;
  if (hasGrade20(g)) {
    const n = Math.max(1, g.numDS || 1);
    const ds = g.ds || [];
    const sum = ds.slice(0, n).reduce((a, b) => a + b, 0);
    return n > 0 ? sum / n : 0;
  }
  const ds = g.ds || [];
  const sum = ds.slice(0, (g.numDS || 3)).reduce((a, b) => a + b, 0);
  return (g.numDS || 3) > 0 ? sum / (g.numDS || 3) : 0;
}

function getExamDisplay20(g) {
  if (!g) return 0;
  return g.bigExam || 0;
}
