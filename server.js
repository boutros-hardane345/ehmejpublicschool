require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const path = require('path');
const multer = require('multer');
const PDFDocument = require('pdfkit');

const app = express();

// Models
const Student = require('./models/Student');
const Announcement = require('./models/Announcement');
const Exercise = require('./models/Exercise');
const Grade = require('./models/Grade');
const Attendance = require('./models/Attendance');
const Lesson = require('./models/Lesson');
const SeatingChart = require('./models/SeatingChart');
const Schedule = require('./models/Schedule');
const Todo = require('./models/Todo');

const CLASSES = ['Grade 7', 'Grade 8', 'Grade 9'];
const MATH_QUOTES = [
  {text:"La géométrie est le plus beau métier du monde, car elle ne ment jamais.",author:"Euclide"},
  {text:"Le bonheur, c'est de résoudre un problème que l'on croyait impossible.",author:"Henri Poincaré"},
  {text:"Les maths, c'est la gymnastique de l'esprit.",author:"Socrate"},
  {text:"En mathématiques, il faut toujours se méfier de ce qui semble évident.",author:"René Descartes"},
  {text:"Les nombres sont les règles du jeu de l'univers.",author:"Galilée"},
  {text:"La nature écrit ses lois en langage mathématique.",author:"Galilée"},
  {text:"Sans les maths, l'ingénieur ne construit rien et le médecin ne guérit rien.",author:"Blaise Pascal"},
  {text:"L'infini est le seul nombre qui nous dépasse tous.",author:"Georg Cantor"},
  {text:"Les maths sont la clef qui ouvre toutes les portes de la science.",author:"Marie Curie"},
  {text:"Un problème bien posé est à moitié résolu.",author:"René Descartes"},
  {text:"Les lignes droites sont les chemins les plus courts, mais pas toujours les plus amusants.",author:"Leonhard Euler"},
  {text:"Le zéro n'est pas rien, c'est le début de tout.",author:"Al-Khwarizmi"},
  {text:"L'algèbre, c'est l'art de rendre l'invisible visible.",author:"Al-Khwarizmi"},
  {text:"En maths, on ne devine pas, on prouve.",author:"Euclide"},
  {text:"Les fractions sont des nombres comme les autres, pas des ennemis.",author:"John Wallis"},
  {text:"Les maths sont partout : dans la musique, dans la danse et dans la nature.",author:"Pythagore"},
  {text:"Tout est arrangé selon le nombre et la mesure.",author:"Pythagore"},
  {text:"Le triangle rectangle est le roi de la géométrie.",author:"Pythagore"},
  {text:"Les équations sont des poèmes qui disent la vérité.",author:"Sophie Germain"},
  {text:"Les maths ne connaissent ni âge, ni pays, ni couleur de peau.",author:"David Hilbert"},
  {text:"La beauté des maths, c'est qu'elles sont justes même quand on a tort.",author:"Blaise Pascal"},
  {text:"Un bon dessin en géométrie vaut mieux qu'un long discours.",author:"Galilée"},
  {text:"Les nombres premiers sont les atomes des mathématiques.",author:"Euclide"},
  {text:"Le compas et la règle sont les deux yeux du géomètre.",author:"Platon"},
  {text:"Le calcul, c'est la force tranquille de l'intelligence.",author:"Isaac Newton"}
];

const getCurrentAcademicYear = () => { const n=new Date(), y=n.getMonth()>=8?n.getFullYear():n.getFullYear()-1; return `${y}-${y+1}`; };
const getStudentFilter = ({className,academicYear}={}) => {
  const f = {};
  if (className&&className!=='all') f.className = className;
  if (academicYear&&academicYear!=='all') f.$or = academicYear===getCurrentAcademicYear() ? [{academicYear},{academicYear:{$exists:false}},{academicYear:null},{academicYear:''}] : [{academicYear}];
  return f;
};
const getAcademicYears = async selectedYear => [...new Set([selectedYear,getCurrentAcademicYear(),...await Student.distinct('academicYear')].filter(Boolean))].sort().reverse();
const gradeSlugToClass = g => { const m=/^grade-(7|8|9)$/.exec(g||''); return m?`Grade ${m[1]}`:null; };
const classToPortalPath = c => `/portal/${c.toLowerCase().replace(' ','-')}`;
const parseScore = (v,m) => { const s=parseFloat(v); return isNaN(s)?0:Math.min(Math.max(s,0),m); };
const getDailyMathQuote = () => { const d=new Date; return MATH_QUOTES[Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000)%MATH_QUOTES.length]; };

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// No daily quote middleware — quotes loaded client-side via /api/quote

// Static HTML pages are served directly from public/

// Multer config
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

const isAuth = (req, res, next) => req.session.isAuthenticated ? next() : res.redirect('/login');
const h = fn => (req, res, next) => fn(req, res, next).catch(err => { console.error(err); res.status(500).send('Error'); });

// ============ ROUTES ============

// Login
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const adminEmail = process.env.ADMIN_EMAIL || 'boutros.hardane@net.eoe.edu.lb';
  const adminPassword = process.env.ADMIN_PASSWORD || 'bth$184$927';

  if ((email || '').trim().toLowerCase() === adminEmail.toLowerCase() && password === adminPassword) {
    req.session.isAuthenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid email or password' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// ============ TEACHER ROUTES ============
// All teacher pages are now static HTML served from public/
// Auth check is applied; data fetched client-side via /api/*

const teacherPages = {
  '/teacher/dashboard': 'teacher/dashboard.html',
  '/teacher/students': 'teacher/students.html',
  '/teacher/content': 'teacher/content.html',
  '/teacher/grades': 'teacher/grades.html',
  '/teacher/year-results': 'teacher/year-results.html',
  '/teacher/seating-chart': 'teacher/seating-chart.html',
  '/teacher/attendance': 'teacher/attendance.html',
  '/teacher/productivity': 'teacher/productivity.html'
};

Object.entries(teacherPages).forEach(([route, file]) => {
  app.get(route, isAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', file));
  });
});

// ============ PDF EXPORT ============
app.get('/teacher/export-year-pdf', isAuth, h(async (req, res) => {
  const selectedClass = req.query.class||'all', selectedYear = req.query.year||getCurrentAcademicYear();
  const students = await Student.find(getStudentFilter({className:selectedClass,academicYear:selectedYear})).sort({name:1});
  const allGrades = await Grade.find({studentId:{$in:students.map(s=>s._id)}});
  const doc = new PDFDocument({margin:50,size:'A4'});
  res.setHeader('Content-Type','application/pdf');
  res.setHeader('Content-Disposition','attachment; filename=year-results.pdf');
  doc.pipe(res);
  const hdrs = ['Student','Class','S1','S2','Mid','S3','S4','Fin','Avg','Status'];
  const cols = [50,120,180,225,270,315,360,405,450,500];
  const drawHeader = y => {
    doc.rect(50,y-5,520,25).fill('#0b2a4a');
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
    hdrs.forEach((h,i)=>doc.text(h,cols[i],y,{width:i>0?30:70,align:i>0?'center':'left'}));
    doc.fillColor('black').rect(50,y+20,520,1).fill('#cccccc');
  };
  doc.fontSize(24).font('Helvetica-Bold').text('Year Results Summary',{align:'center'});
  doc.moveDown(0.5);
  doc.fontSize(12).font('Helvetica').text(`Generated: ${new Date().toLocaleDateString()}`,{align:'center'});
  doc.moveDown(0.5);
  doc.text(`Total Students: ${students.length}`,{align:'center'});
  doc.moveDown(1.5);
  drawHeader(doc.y);
  let y = doc.y + 30;
  doc.fillColor('black').fontSize(8).font('Helvetica');
  students.forEach((student,i) => {
    if (y>750) { doc.addPage(); y=50; drawHeader(y); y+=30; doc.fillColor('black').fontSize(8).font('Helvetica'); }
    const gs = [1,2,3,4,5,6].map(s=>allGrades.find(g=>g.studentId.equals(student._id)&&g.semester===s));
    const sem = gs.map(g=>g?g.final60:0);
    const avg = sem.reduce((a,b)=>a+b,0)/6;
    const st = avg>=50?'Passing':avg>=40?'Borderline':'Failing';
    const sc = avg>=50?'#27ae60':avg>=40?'#f39c12':'#e74c3c';
    if (i%2===0) doc.rect(50,y-2,520,18).fill('#f8f9fa');
    doc.fillColor('black');
    const name = student.name.length>12?student.name.slice(0,10)+'..':student.name;
    doc.text(name,cols[0],y);
    doc.text(student.className.replace('Grade ',''),cols[1],y);
    [0,1,2,3,4,5].forEach(j=>doc.text(sem[j].toFixed(0),cols[2+j],y,{width:30,align:'center'}));
    doc.font('Helvetica-Bold').fillColor('#27ae60').text(avg.toFixed(0),cols[8],y,{width:30,align:'center'});
    doc.font('Helvetica').fillColor(sc).text(st,cols[9],y,{width:50,align:'center'});
    doc.fillColor('black');
    y += 22;
  });
  doc.moveDown(2);
  doc.fontSize(8).font('Helvetica').fillColor('#666666').text('Generated by Maths Teacher Platform',{align:'center'});
  doc.text(`Page ${doc.pageNumber}`,{align:'center'});
  doc.end();
}));

// Semester PDF Export
app.get('/teacher/export-semester-pdf', isAuth, h(async (req, res) => {
  const selectedClass = req.query.class||'all', selectedYear = req.query.year||getCurrentAcademicYear(), selectedSemester = req.query.semester||'1';
  const sn = parseInt(selectedSemester,10);
  const periodLabels = {1:'S1',2:'S2',3:'Mid-Year',4:'S3',5:'S4',6:'Final-Year'};
  const periodLabel = periodLabels[sn]||'Period '+sn;
  const students = await Student.find(getStudentFilter({className:selectedClass,academicYear:selectedYear})).sort({name:1});
  const studentIds = students.map(s=>s._id);
  const grades = await Grade.find({studentId:{$in:studentIds},semester:sn});
  const doc = new PDFDocument({margin:50,size:'A4'});
  res.setHeader('Content-Type','application/pdf');
  res.setHeader('Content-Disposition','attachment; filename=grades-'+periodLabel.toLowerCase()+'.pdf');
  doc.pipe(res);
  const isSimple = sn === 3 || sn === 6;
  const hdrs = isSimple ? ['Student','Class','Grade /60'] : ['Student','Class','Att','DS1','DS2','DS3','Exam','Raw','Final'];
  const cols = isSimple ? [50,160,310] : [50,120,190,245,300,355,410,460,505];
  const drawHeader = y => {
    const w = isSimple ? 250 : 520;
    doc.rect(50,y-5,w,25).fill('#0b2a4a');
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
    hdrs.forEach((h,i)=>doc.text(h,cols[i],y,{width:i===0?110:(isSimple?100:30),align:i===0?'left':'center'}));
    doc.fillColor('black').rect(50,y+20,w,1).fill('#cccccc');
  };
  doc.fontSize(22).font('Helvetica-Bold').text('Semester Grades — '+periodLabel,{align:'center'});
  doc.moveDown(0.5);
  doc.fontSize(12).font('Helvetica').text(`Class: ${selectedClass==='all'?'All':selectedClass}  |  Year: ${selectedYear}`,{align:'center'});
  doc.moveDown(0.3);
  doc.fontSize(12).font('Helvetica').text(`Generated: ${new Date().toLocaleDateString()}`,{align:'center'});
  doc.moveDown(0.5);
  doc.text(`Total Students: ${students.length}`,{align:'center'});
  doc.moveDown(1.5);
  drawHeader(doc.y);
  let y = doc.y + 30;
  doc.fillColor('black').fontSize(8).font('Helvetica');
  students.forEach((student,i) => {
    if (y>750) { doc.addPage(); y=50; drawHeader(y); y+=30; doc.fillColor('black').fontSize(8).font('Helvetica'); }
    const g = grades.find(gr=>gr.studentId.equals(student._id));
    if (i%2===0) doc.rect(50,y-2,cols[cols.length-1]+30-50,18).fill('#f8f9fa');
    doc.fillColor('black');
    const name = student.name.length>14?student.name.slice(0,12)+'..':student.name;
    doc.text(name,cols[0],y);
    doc.text(student.className.replace('Grade ',''),cols[1],y);
    if (isSimple) {
      const fin = g?g.final60:0;
      doc.font('Helvetica-Bold').fillColor(fin>=30?'#27ae60':fin>=24?'#f39c12':'#e74c3c').text(fin.toFixed(1),cols[2],y,{width:60,align:'center'});
    } else {
      const att = g?g.attendance:0, ds1 = g?g.ds[0]||0:0, ds2 = g?g.ds[1]||0:0, ds3 = g?g.ds[2]||0:0, exam = g?g.bigExam:0, raw = g?g.rawTotal:0, fin = g?g.final60:0;
      doc.text(att.toFixed(1),cols[2],y,{width:30,align:'center'});
      doc.text(ds1.toFixed(1),cols[3],y,{width:30,align:'center'});
      doc.text(ds2.toFixed(1),cols[4],y,{width:30,align:'center'});
      doc.text(ds3.toFixed(1),cols[5],y,{width:30,align:'center'});
      doc.text(exam.toFixed(1),cols[6],y,{width:30,align:'center'});
      doc.font('Helvetica-Bold').fillColor('#1a2a3a').text(raw.toFixed(1),cols[7],y,{width:30,align:'center'});
      doc.font('Helvetica').fillColor(fin>=30?'#27ae60':fin>=24?'#f39c12':'#e74c3c').text(fin.toFixed(1),cols[8],y,{width:30,align:'center'});
    }
    doc.fillColor('black').font('Helvetica');
    y += 22;
  });
  doc.moveDown(2);
  doc.fontSize(8).font('Helvetica').fillColor('#666666').text('Generated by Maths Teacher Platform',{align:'center'});
  doc.text(`Page ${doc.pageNumber}`,{align:'center'});
  doc.end();
}));

// ============ STUDENT PORTAL ============
app.get(['/portal','/portal/:gradeSlug'], (req, res) => {
  // Static portal page — client-side JS handles class selection via ?class= param
  res.sendFile(path.join(__dirname, 'public', 'portal.html'));
});

// ============ TEACHER DASHBOARD API ============

app.get('/api/classes', (req, res) => res.json(CLASSES));
app.get('/api/period-labels', (req, res) => res.json({1:'S1',2:'S2',3:'Mid-Year',4:'S3',5:'S4',6:'Final-Year'}));
app.get('/api/periods', (req, res) => res.json([1,2,3,4,5,6]));

// Students API
app.get('/api/students', h(async (req, res) => {
  const { className, academicYear } = req.query;
  const students = await Student.find(getStudentFilter({ className, academicYear })).sort({ academicYear: -1, className: 1, name: 1 });
  const academicYears = await getAcademicYears(academicYear || getCurrentAcademicYear());
  res.json({ students, classes: CLASSES, academicYears, CLASSES });
}));

app.post('/api/students', h(async (req, res) => {
  const { name, className, academicYear } = req.body;
  const s = await Student.create({ name, className, academicYear: academicYear || getCurrentAcademicYear() });
  res.json(s);
}));

app.delete('/api/students/:id', h(async (req, res) => {
  await Student.findByIdAndDelete(req.params.id);
  res.json({ success: true });
}));

app.delete('/api/students', h(async (req, res) => {
  await Student.deleteMany({});
  res.json({ success: true });
}));

// Content API (Announcements + Exercises)
app.get('/api/content', h(async (req, res) => {
  const { className, semester } = req.query;
  const af = {}, ef = {};
  if (className && className !== 'all') { af.className = className; ef.className = className; }
  const sn = parseInt(semester, 10);
  if (!isNaN(sn) && sn >= 1 && sn <= 4) ef.semester = sn;
  const [announcements, exercises] = await Promise.all([
    Announcement.find(af).sort({ createdAt: -1 }),
    Exercise.find(ef).sort({ createdAt: -1 })
  ]);
  res.json({ announcements, exercises, CLASSES });
}));

app.post('/api/announcements', h(async (req, res) => {
  const a = await Announcement.create(req.body);
  res.json(a);
}));

app.delete('/api/announcements/:id', h(async (req, res) => {
  await Announcement.findByIdAndDelete(req.params.id);
  res.json({ success: true });
}));

app.post('/api/exercises', upload.single('file'), h(async (req, res) => {
  const body = { ...req.body };
  if (req.file) {
    body.fileUrl = '/uploads/' + req.file.filename;
    body.fileType = req.file.mimetype;
  }
  const e = await Exercise.create(body);
  res.json(e);
}));

app.delete('/api/exercises/:id', h(async (req, res) => {
  await Exercise.findByIdAndDelete(req.params.id);
  res.json({ success: true });
}));

// Grades API
app.get('/api/grades', h(async (req, res) => {
  const { className, academicYear, semester } = req.query;
  const students = await Student.find(getStudentFilter({ className, academicYear })).sort({ name: 1 });
  const studentIds = students.map(s => s._id);
  let grades = await Grade.find({ studentId: { $in: studentIds } });
  const sn = parseInt(semester, 10);
  if (!isNaN(sn) && [1, 2, 3, 4, 5, 6].includes(sn)) grades = grades.filter(g => g.semester === sn);
  const academicYears = await getAcademicYears(academicYear || getCurrentAcademicYear());
  res.json({ students, grades, classes: CLASSES, academicYears, periods: [1, 2, 3, 4, 5, 6], periodLabels: { 1: 'S1', 2: 'S2', 3: 'Mid-Year', 4: 'S3', 5: 'S4', 6: 'Final-Year' }, CLASSES });
}));

app.post('/api/grades', h(async (req, res) => {
  const { studentId, semester, attendance, bigExam, ds1, ds2, ds3 } = req.body;
  const sn = parseInt(semester);
  if (sn === 3 || sn === 6) {
    const exam = parseScore(bigExam, 60);
    await Grade.findOneAndUpdate({ studentId, semester: sn }, { studentId, semester: sn, attendance: 0, ds: [0, 0, 0], bigExam: exam, rawTotal: exam, final60: exam }, { upsert: true, new: true });
  } else {
    const ds = [];
    for (let i = 1; i <= 3; i++) {
      const dsRaw = parseScore(req.body['ds' + i], 10);
      ds.push((dsRaw / 10) * 8);
    }
    const attRaw = parseScore(attendance, 10);
    const att = (attRaw / 10) * 6;
    const examRaw = parseScore(bigExam, 20);
    const exam = (examRaw / 20) * 30;
    const rawTotal = att + ds.reduce((a, b) => a + b, 0) + exam;
    const final60 = rawTotal;
    await Grade.findOneAndUpdate({ studentId, semester: sn }, { studentId, semester: sn, attendance: att, ds, bigExam: exam, rawTotal, final60 }, { upsert: true, new: true });
  }
  res.json({ success: true });
}));

app.get('/api/academic-year', (req, res) => res.json({ year: getCurrentAcademicYear() }));
app.get('/api/quote', (req, res) => res.json(getDailyMathQuote()));

// Attendance
app.post('/api/attendance', h(async (req, res) => {
  const { date, className, records } = req.body;
  let att = await Attendance.findOne({ date, className });
  if (att) { att.records = records; await att.save(); }
  else att = await Attendance.create({ date, className, records });
  res.json(att);
}));

app.get('/api/attendance', h(async (req, res) => {
  const { date, className } = req.query;
  const filter = {};
  if (date) filter.date = date;
  if (className) filter.className = className;
  res.json(await Attendance.find(filter).sort({ date: -1 }));
}));

app.get('/api/attendance/stats', h(async (req, res) => {
  const { className } = req.query;
  const filter = {};
  if (className) filter.className = className;
  const all = await Attendance.find(filter).sort({ date: -1 }).limit(30);
  let totalPresent = 0, totalAbsent = 0, totalStudents = 0;
  const dayStats = all.map(a => {
    const p = a.records.filter(r => r.status === 'present').length;
    const ab = a.records.filter(r => r.status === 'absent').length;
    totalPresent += p; totalAbsent += ab; totalStudents += a.records.length;
    return { date: a.date, className: a.className, present: p, absent: ab, total: a.records.length, rate: a.records.length ? Math.round(p / a.records.length * 100) : 0 };
  });
  res.json({ dayStats, overall: { totalPresent, totalAbsent, totalStudents, rate: totalStudents ? Math.round(totalPresent / totalStudents * 100) : 0 } });
}));

// Lessons
app.get('/api/lessons', h(async (req, res) => {
  const { className, date } = req.query;
  const filter = {};
  if (className) filter.className = className;
  if (date) filter.date = date;
  res.json(await Lesson.find(filter).sort({ date: -1, createdAt: -1 }));
}));

app.post('/api/lessons', h(async (req, res) => {
  res.json(await Lesson.create(req.body));
}));

app.put('/api/lessons/:id', h(async (req, res) => {
  res.json(await Lesson.findByIdAndUpdate(req.params.id, req.body, { new: true }));
}));

app.delete('/api/lessons/:id', h(async (req, res) => {
  await Lesson.findByIdAndDelete(req.params.id);
  res.json({ success: true });
}));

// Seating Chart
app.get('/api/seating/:className', h(async (req, res) => {
  const chart = await SeatingChart.findOne({ className: req.params.className });
  res.json(chart || { className: req.params.className, rows: 4, cols: 5, desks: [] });
}));

app.post('/api/seating', h(async (req, res) => {
  const { className, rows, cols, desks } = req.body;
  let chart = await SeatingChart.findOne({ className });
  if (chart) { chart.rows = rows; chart.cols = cols; chart.desks = desks; await chart.save(); }
  else chart = await SeatingChart.create({ className, rows, cols, desks });
  res.json(chart);
}));

// Schedule
app.get('/api/schedule', h(async (req, res) => {
  const { className } = req.query;
  const filter = {};
  if (className) filter.className = className;
  res.json(await Schedule.find(filter).sort({ day: 1, period: 1 }));
}));

app.post('/api/schedule', h(async (req, res) => {
  res.json(await Schedule.create(req.body));
}));

app.put('/api/schedule/:id', h(async (req, res) => {
  res.json(await Schedule.findByIdAndUpdate(req.params.id, req.body, { new: true }));
}));

app.delete('/api/schedule/:id', h(async (req, res) => {
  await Schedule.findByIdAndDelete(req.params.id);
  res.json({ success: true });
}));

// Todos
app.get('/api/todos', h(async (req, res) => {
  res.json(await Todo.find().sort({ createdAt: -1 }));
}));

app.post('/api/todos', h(async (req, res) => {
  res.json(await Todo.create(req.body));
}));

app.put('/api/todos/:id', h(async (req, res) => {
  res.json(await Todo.findByIdAndUpdate(req.params.id, req.body, { new: true }));
}));

app.delete('/api/todos/:id', h(async (req, res) => {
  await Todo.findByIdAndDelete(req.params.id);
  res.json({ success: true });
}));

// Analytics
app.get('/api/analytics', h(async (req, res) => {
  const attendanceStats = await Attendance.aggregate([
    { $unwind: '$records' },
    { $group: { _id: '$records.status', count: { $sum: 1 } } }
  ]);
  const present = attendanceStats.find(a => a._id === 'present')?.count || 0;
  const absent = attendanceStats.find(a => a._id === 'absent')?.count || 0;
  const totalAttendance = present + absent;
  const lessonCount = await Lesson.countDocuments();
  const todoStats = await Todo.aggregate([{ $group: { _id: '$completed', count: { $sum: 1 } } }]);
  const todosDone = todoStats.find(t => t._id === true)?.count || 0;
  const todosTotal = todoStats.reduce((s, t) => s + t.count, 0);
  const classAttendance = await Attendance.aggregate([
    { $unwind: '$records' },
    { $group: { _id: { className: '$className', status: '$records.status' }, count: { $sum: 1 } } }
  ]);
  const classBreakdown = CLASSES.map(c => {
    const p = classAttendance.find(a => a._id.className === c && a._id.status === 'present')?.count || 0;
    const a = classAttendance.find(a => a._id.className === c && a._id.status === 'absent')?.count || 0;
    return { className: c, present: p, absent: a, total: p + a, rate: (p + a) ? Math.round(p / (p + a) * 100) : 0 };
  });
  const recentAttendance = await Attendance.find().sort({ date: -1 }).limit(7);
  res.json({ present, absent, totalAttendance, attendanceRate: totalAttendance ? Math.round(present / totalAttendance * 100) : 0, lessonCount, todosDone, todosTotal, classBreakdown, recentAttendance });
}));

// ============ START SERVER ============
mongoose.connect(process.env.MONGODB_URI, {useNewUrlParser:true,useUnifiedTopology:true})
.then(() => { const P = process.env.PORT||3000; app.listen(P, () => { const B='='.repeat(50), L=`http://localhost:${P}`; console.log(`${B}\n🚀 Server running!\n${B}\n📡 ${L}\n🔐 ${L}/login\n👨‍🎓 ${L}/portal\n📊 ${L}/teacher/dashboard\n${B}\n✅ MongoDB\n${B}`); }); })
.catch(err => { console.log('❌ MongoDB:', err.message); process.exit(1); });
