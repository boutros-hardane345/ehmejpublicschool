require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const bcrypt = require('bcryptjs');

const app = express();

// Models
const Student = require('./models/Student');
const Announcement = require('./models/Announcement');
const Exercise = require('./models/Exercise');
const Grade = require('./models/Grade');
const Lesson = require('./models/Lesson');
const Schedule = require('./models/Schedule');
const Todo = require('./models/Todo');
const Question = require('./models/Question');

const CLASSES = ['Grade 7', 'Grade 8', 'Grade 9'];
const PERIOD_LABELS = {1:'S1',2:'S2',3:'Mid-Year',4:'S3',5:'S4',6:'Final-Year'};
const PERIODS = [1,2,3,4,5,6];
const uploadDir = path.join(__dirname, 'uploads');
const allowedUploadMimes = new Set(['application/pdf', 'image/png', 'image/jpeg', 'text/plain']);
const allowedUploadExts = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.txt']);
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
const getGrade20 = g => {
  if (!g) return 0;
  if (typeof g.final20 === 'number' && (g.final20 !== 0 || !g.final60 || g.rawTotal <= 20)) return g.final20;
  return (g.final60 || 0) / 3;
};
const getFinal60 = g => {
  if (!g) return 0;
  if (typeof g.final60 === 'number' && g.final60 > 0) return g.final60;
  return g.rawTotal || 0;
};
const hasGrade20 = g => !!g && typeof g.final20 === 'number' && (g.final20 !== 0 || !g.final60 || g.rawTotal <= 20);
const getComponent20 = (g, key, index) => {
  if (!g) return 0;
  if (hasGrade20(g)) return key === 'ds' ? ((g.ds && g.ds[index]) || 0) : (g[key] || 0);
  if (key === 'attendance') return ((g.attendance || 0) / 6) * 20;
  if (key === 'ds') return (((g.ds && g.ds[index]) || 0) / 24) * 20;
  if (key === 'bigExam') return ((g.bigExam || 0) / 30) * 20;
  return 0;
};
const deleteUploadedFile = file => {
  if (!file) return;
  const filePath = path.join(uploadDir, path.basename(file.filename || ''));
  if (filePath.startsWith(uploadDir) && fs.existsSync(filePath)) fs.unlinkSync(filePath);
};
const getAttendanceFinal6 = att => (att / 10) * 6;
const getDSAverage = (dsValues, numDS, hasExam) => {
  const n = Math.max(1, Math.min(numDS, (dsValues || []).length));
  if (n === 0) return 0;
  const sum = dsValues.slice(0, n).reduce((a, b) => a + b, 0);
  if (hasExam) return (sum / n / 20) * 24;
  return (sum / n / 20) * 54;
};
const getExamFinal = exam => (exam / 20) * 30;
const getDailyMathQuote = () => { const d=new Date; return MATH_QUOTES[Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000)%MATH_QUOTES.length]; };
const isValidClassName = c => CLASSES.includes(c);
const isValidObjectId = id => mongoose.Types.ObjectId.isValid(id);
const cleanText = value => (value || '').toString().trim();
const isValidAcademicYear = year => {
  if (!/^\d{4}-\d{4}$/.test(year || '')) return false;
  const [start, end] = year.split('-').map(Number);
  return end === start + 1;
};
const badRequest = (res, msg) => res.status(400).json({ error: msg });

if (!process.env.MONGODB_URI) {
  console.error('Missing required environment variable: MONGODB_URI');
  process.exit(1);
}
if (!process.env.SESSION_SECRET) {
  console.error('Missing required environment variable: SESSION_SECRET');
  process.exit(1);
}
if (!process.env.ADMIN_EMAIL || (!process.env.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD_HASH)) {
  console.error('Missing required environment variables: ADMIN_EMAIL and ADMIN_PASSWORD or ADMIN_PASSWORD_HASH');
  process.exit(1);
}
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: { maxAge: 1000 * 60 * 60 * 24, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }
}));

const isAuth = (req, res, next) => req.session.isAuthenticated ? next() : res.redirect('/login');
const isApiAuth = (req, res, next) => req.session.isAuthenticated ? next() : res.status(401).json({ error: 'Authentication required' });

const protectedStaticPages = new Set([
  '/', '/index.html', '/lesson-planner.html',
  '/schedule.html', '/productivity.html', '/students.html',
  '/content.html', '/grades.html'
]);
app.use((req, res, next) => {
  const reqPath = decodeURIComponent(req.path).replace(/\\/g, '/').toLowerCase();
  const isProtectedHtml = reqPath.startsWith('/teacher/') || protectedStaticPages.has(reqPath);
  if (req.method === 'GET' && isProtectedHtml && !req.session.isAuthenticated) return res.redirect('/login');
  next();
});
app.use(express.static(path.join(__dirname, 'public')));
// Uploaded files are served through /download/:id so access can be tied to stored exercises.

// No daily quote middleware — quotes loaded client-side via /api/quote

// Static HTML pages are served directly from public/

// Multer config
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, Date.now() + '-' + crypto.randomBytes(8).toString('hex') + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!allowedUploadMimes.has(file.mimetype) || !allowedUploadExts.has(ext)) return cb(new Error('Unsupported file type'));
    cb(null, true);
  }
});
const uploadExerciseFile = (req, res, next) => upload.single('file')(req, res, err => err ? badRequest(res, err.message) : next());

const h = fn => (req, res, next) => fn(req, res, next).catch(err => { console.error(err); res.status(500).send('Error'); });

// ============ ROUTES ============

// Login
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', h(async (req, res) => {
  const { email, password } = req.body;
  const adminEmail = process.env.ADMIN_EMAIL;
  const okEmail = (email || '').trim().toLowerCase() === adminEmail.toLowerCase();
  const okPassword = process.env.ADMIN_PASSWORD_HASH
    ? await bcrypt.compare(password || '', process.env.ADMIN_PASSWORD_HASH)
    : password === process.env.ADMIN_PASSWORD;

  if (okEmail && okPassword) {
    req.session.isAuthenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid email or password' });
  }
}));

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
  if (selectedClass !== 'all' && !isValidClassName(selectedClass)) return badRequest(res, 'Invalid class');
  if (!isValidAcademicYear(selectedYear)) return badRequest(res, 'Invalid academic year');
  const students = await Student.find(getStudentFilter({className:selectedClass,academicYear:selectedYear})).sort({name:1});
  const allGrades = await Grade.find({studentId:{$in:students.map(s=>s._id)}});
  const doc = new PDFDocument({margin:50,size:'A4'});
  res.setHeader('Content-Type','application/pdf');
  res.setHeader('Content-Disposition','attachment; filename=year-results.pdf');
  doc.pipe(res);
  const hdrs = ['Student','Class','S1','S2','Mid','S3','S4','Fin','Avg /60','Status'];
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
    const sem = gs.map(getFinal60);
    const avg = sem.reduce((a,b)=>a+b,0)/6;
    const st = avg>=30?'Passing':avg>=24?'Borderline':'Failing';
    const sc = avg>=30?'#27ae60':avg>=24?'#f39c12':'#e74c3c';
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
  if (selectedClass !== 'all' && !isValidClassName(selectedClass)) return badRequest(res, 'Invalid class');
  if (!isValidAcademicYear(selectedYear)) return badRequest(res, 'Invalid academic year');
  if (!PERIODS.includes(sn)) return badRequest(res, 'Invalid period');
  const periodLabel = PERIOD_LABELS[sn]||'Period '+sn;
  const students = await Student.find(getStudentFilter({className:selectedClass,academicYear:selectedYear})).sort({name:1});
  const studentIds = students.map(s=>s._id);
  const grades = await Grade.find({studentId:{$in:studentIds},semester:sn});
  const doc = new PDFDocument({margin:50,size:'A4'});
  res.setHeader('Content-Type','application/pdf');
  res.setHeader('Content-Disposition','attachment; filename=grades-'+periodLabel.toLowerCase()+'.pdf');
  doc.pipe(res);
  const isSimple = sn === 3 || sn === 6;
  const hdrs = isSimple ? ['Student','Class','Grade /20'] : ['Student','Class','Att','DS1','DS2','DS3','Exam','Avg /20'];
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
      const fin = getGrade20(g);
      doc.font('Helvetica-Bold').fillColor(fin>=10?'#27ae60':fin>=8?'#f39c12':'#e74c3c').text(fin.toFixed(1),cols[2],y,{width:60,align:'center'});
    } else {
      const att = getComponent20(g, 'attendance'), ds1 = getComponent20(g, 'ds', 0), ds2 = getComponent20(g, 'ds', 1), ds3 = getComponent20(g, 'ds', 2), exam = getComponent20(g, 'bigExam'), fin = getGrade20(g);
      doc.text(att.toFixed(1),cols[2],y,{width:30,align:'center'});
      doc.text(ds1.toFixed(1),cols[3],y,{width:30,align:'center'});
      doc.text(ds2.toFixed(1),cols[4],y,{width:30,align:'center'});
      doc.text(ds3.toFixed(1),cols[5],y,{width:30,align:'center'});
      doc.text(exam.toFixed(1),cols[6],y,{width:30,align:'center'});
      doc.font('Helvetica-Bold').fillColor(fin>=10?'#27ae60':fin>=8?'#f39c12':'#e74c3c').text(fin.toFixed(1),cols[7],y,{width:30,align:'center'});
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
  res.sendFile(path.join(__dirname, 'public', 'portal.html'));
});

app.get('/download/:id', h(async (req, res) => {
  if (!isValidObjectId(req.params.id)) return badRequest(res, 'Invalid exercise id');
  const exercise = await Exercise.findById(req.params.id);
  if (!exercise || !exercise.fileUrl) return res.status(404).send('File not found');
  const filename = path.basename(exercise.fileUrl);
  const filePath = path.join(uploadDir, filename);
  if (!filePath.startsWith(uploadDir) || !fs.existsSync(filePath)) return res.status(404).send('File not found');
  res.download(filePath, filename);
}));

// ============ TEACHER DASHBOARD API ============

const publicApiRoutes = new Set(['/classes', '/period-labels', '/periods', '/content', '/academic-year', '/quote', '/questions']);
app.use('/api', (req, res, next) => {
  if (req.method === 'GET' && publicApiRoutes.has(req.path)) return next();
  return isApiAuth(req, res, next);
});

app.get('/api/classes', (req, res) => res.json(CLASSES));
app.get('/api/period-labels', (req, res) => res.json({1:'S1',2:'S2',3:'Mid-Year',4:'S3',5:'S4',6:'Final-Year'}));
app.get('/api/periods', (req, res) => res.json([1,2,3,4,5,6]));

// Students API
app.get('/api/students', h(async (req, res) => {
  const { className, academicYear } = req.query;
  if (className && className !== 'all' && !isValidClassName(className)) return badRequest(res, 'Invalid class');
  if (academicYear && academicYear !== 'all' && !isValidAcademicYear(academicYear)) return badRequest(res, 'Invalid academic year');
  const students = await Student.find(getStudentFilter({ className, academicYear })).sort({ academicYear: -1, className: 1, name: 1 });
  const academicYears = await getAcademicYears(academicYear || getCurrentAcademicYear());
  res.json({ students, classes: CLASSES, academicYears, CLASSES });
}));

app.post('/api/students', h(async (req, res) => {
  const name = cleanText(req.body.name);
  const className = cleanText(req.body.className);
  const academicYear = cleanText(req.body.academicYear) || getCurrentAcademicYear();
  if (!name) return badRequest(res, 'Student name is required');
  if (!isValidClassName(className)) return badRequest(res, 'Invalid class');
  if (!isValidAcademicYear(academicYear)) return badRequest(res, 'Invalid academic year');
  const s = await Student.create({ name, className, academicYear });
  res.json(s);
}));

app.put('/api/students/:id', h(async (req, res) => {
  if (!isValidObjectId(req.params.id)) return badRequest(res, 'Invalid student id');
  const existing = await Student.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Student not found' });
  const name = cleanText(req.body.name);
  const className = cleanText(req.body.className);
  const academicYear = cleanText(req.body.academicYear);
  if (!name) return badRequest(res, 'Student name is required');
  if (!isValidClassName(className)) return badRequest(res, 'Invalid class');
  if (!isValidAcademicYear(academicYear)) return badRequest(res, 'Invalid academic year');
  const oldName = existing.name;
  existing.name = name;
  existing.className = className;
  existing.academicYear = academicYear;
  await existing.save();
  res.json(existing);
}));

app.delete('/api/students/:id', h(async (req, res) => {
  if (!isValidObjectId(req.params.id)) return badRequest(res, 'Invalid student id');
  const student = await Student.findByIdAndDelete(req.params.id);
  if (student) {
    await Grade.deleteMany({ studentId: student._id });
  }
  res.json({ success: true });
}));

app.delete('/api/students', h(async (req, res) => {
  await Promise.all([
    Student.deleteMany({}),
    Grade.deleteMany({})
  ]);
  res.json({ success: true });
}));

// Content API (Announcements + Exercises)
app.get('/api/content', h(async (req, res) => {
  const { className, semester } = req.query;
  const af = {}, ef = {};
  if (!req.session.isAuthenticated && (!className || className === 'all')) return badRequest(res, 'Class is required');
  if (className && className !== 'all' && !isValidClassName(className)) return badRequest(res, 'Invalid class');
  if (className && className !== 'all') { af.className = className; ef.className = className; }
  const sn = parseInt(semester, 10);
  if (semester && semester !== 'all') {
    if (isNaN(sn) || sn < 1 || sn > 4) return badRequest(res, 'Invalid semester');
    ef.semester = sn;
  }
  const [announcements, exercises] = await Promise.all([
    Announcement.find(af).sort({ createdAt: -1 }),
    Exercise.find(ef).sort({ createdAt: -1 })
  ]);
  res.json({ announcements, exercises, CLASSES });
}));

app.post('/api/announcements', h(async (req, res) => {
  const className = cleanText(req.body.className), title = cleanText(req.body.title), content = cleanText(req.body.content);
  if (!isValidClassName(className)) return badRequest(res, 'Invalid class');
  if (!title || !content) return badRequest(res, 'Title and message are required');
  const a = await Announcement.create({ className, title, content });
  res.json(a);
}));

app.delete('/api/announcements/:id', h(async (req, res) => {
  if (!isValidObjectId(req.params.id)) return badRequest(res, 'Invalid announcement id');
  await Announcement.findByIdAndDelete(req.params.id);
  res.json({ success: true });
}));

app.put('/api/announcements/:id', h(async (req, res) => {
  if (!isValidObjectId(req.params.id)) return badRequest(res, 'Invalid announcement id');
  const className = cleanText(req.body.className), title = cleanText(req.body.title), content = cleanText(req.body.content);
  if (!isValidClassName(className)) return badRequest(res, 'Invalid class');
  if (!title || !content) return badRequest(res, 'Title and message are required');
  res.json(await Announcement.findByIdAndUpdate(req.params.id, { className, title, content }, { new: true }));
}));

app.post('/api/exercises', uploadExerciseFile, h(async (req, res) => {
  const className = cleanText(req.body.className), title = cleanText(req.body.title), description = cleanText(req.body.description);
  const semester = req.body.semester ? parseInt(req.body.semester, 10) : undefined;
  if (!isValidClassName(className)) { deleteUploadedFile(req.file); return badRequest(res, 'Invalid class'); }
  if (!title) { deleteUploadedFile(req.file); return badRequest(res, 'Exercise title is required'); }
  if (!req.file) return badRequest(res, 'Exercise file is required');
  if (semester !== undefined && ![1,2,3,4].includes(semester)) { deleteUploadedFile(req.file); return badRequest(res, 'Invalid semester'); }
  const body = { className, title, description };
  if (semester !== undefined) body.semester = semester;
  if (req.file) {
    body.fileUrl = '/uploads/' + req.file.filename;
    body.fileType = req.file.mimetype;
  }
  const e = await Exercise.create(body);
  res.json(e);
}));

app.delete('/api/exercises/:id', h(async (req, res) => {
  if (!isValidObjectId(req.params.id)) return badRequest(res, 'Invalid exercise id');
  const exercise = await Exercise.findByIdAndDelete(req.params.id);
  if (exercise?.fileUrl) {
    const filePath = path.join(uploadDir, path.basename(exercise.fileUrl));
    if (filePath.startsWith(uploadDir) && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  res.json({ success: true });
}));

app.put('/api/exercises/:id', h(async (req, res) => {
  if (!isValidObjectId(req.params.id)) return badRequest(res, 'Invalid exercise id');
  const className = cleanText(req.body.className), title = cleanText(req.body.title), description = cleanText(req.body.description);
  const semester = req.body.semester ? parseInt(req.body.semester, 10) : undefined;
  if (!isValidClassName(className)) return badRequest(res, 'Invalid class');
  if (!title) return badRequest(res, 'Exercise title is required');
  if (semester !== undefined && ![1,2,3,4].includes(semester)) return badRequest(res, 'Invalid semester');
  const update = semester !== undefined
    ? { className, title, description, semester }
    : { $set: { className, title, description }, $unset: { semester: '' } };
  res.json(await Exercise.findByIdAndUpdate(req.params.id, update, { new: true }));
}));

// Grades API
app.get('/api/grades', h(async (req, res) => {
  const { className, academicYear, semester } = req.query;
  if (className && className !== 'all' && !isValidClassName(className)) return badRequest(res, 'Invalid class');
  if (academicYear && academicYear !== 'all' && !isValidAcademicYear(academicYear)) return badRequest(res, 'Invalid academic year');
  const students = await Student.find(getStudentFilter({ className, academicYear })).sort({ name: 1 });
  const studentIds = students.map(s => s._id);
  let grades = await Grade.find({ studentId: { $in: studentIds } });
  const sn = parseInt(semester, 10);
  if (semester && semester !== 'all') {
    if (!PERIODS.includes(sn)) return badRequest(res, 'Invalid period');
    grades = grades.filter(g => g.semester === sn);
  }
  const academicYears = await getAcademicYears(academicYear || getCurrentAcademicYear());
  res.json({ students, grades, classes: CLASSES, academicYears, periods: PERIODS, periodLabels: PERIOD_LABELS, CLASSES });
}));

app.post('/api/grades', h(async (req, res) => {
  const { studentId, semester, attendance, bigExam, ds, numDS } = req.body;
  const sn = parseInt(semester);
  if (!isValidObjectId(studentId)) return badRequest(res, 'Invalid student id');
  if (!PERIODS.includes(sn)) return badRequest(res, 'Invalid period');
  const student = await Student.findById(studentId);
  if (!student) return badRequest(res, 'Student not found');
  const numDSValue = parseInt(numDS, 10);
  if (isNaN(numDSValue) || numDSValue < 1 || numDSValue > 5) return badRequest(res, 'Invalid numDS');
  const dsValues = Array.isArray(ds) ? ds.map(v => parseScore(v, 20)) : [];
  const exam = parseScore(bigExam, 20);
  const hasExam = sn !== 3 && sn !== 6;
  if (sn === 3 || sn === 6) {
    const attFinal6 = getAttendanceFinal6(parseScore(attendance, 10));
    const dsAvg54 = getDSAverage(dsValues, numDSValue, false);
    const final60 = attFinal6 + dsAvg54;
    const final20 = final60 / 3;
    await Grade.findOneAndUpdate({ studentId, semester: sn }, { studentId, semester: sn, attendance: parseScore(attendance, 10), ds: paddedDS || [0, 0, 0], bigExam: 0, rawTotal: final60, final20, final60, numDS: 0 }, { upsert: true, new: true });
  } else {
    const attFinal6 = getAttendanceFinal6(parseScore(attendance, 10));
    const dsAvg24 = getDSAverage(dsValues, numDSValue, true);
    const examFinal30 = getExamFinal(exam);
    const final60 = attFinal6 + dsAvg24 + examFinal30;
    const final20 = final60 / 3;
    const paddedDS = [];
    for (let i = 0; i < numDSValue; i++) paddedDS.push(dsValues[i] || 0);
    await Grade.findOneAndUpdate({ studentId, semester: sn }, { studentId, semester: sn, attendance: parseScore(attendance, 10), ds: paddedDS, bigExam: exam, rawTotal: final60, final20, final60, numDS: numDSValue }, { upsert: true, new: true });
  }
  res.json({ success: true });
}));

app.put('/api/grades/:id', h(async (req, res) => {
  if (!isValidObjectId(req.params.id)) return badRequest(res, 'Invalid grade id');
  const existing = await Grade.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Grade not found' });
  const { studentId, semester, attendance, bigExam, ds, numDS } = req.body;
  const sn = parseInt(semester);
  if (!PERIODS.includes(sn)) return badRequest(res, 'Invalid period');
  const numDSValue = parseInt(numDS, 10);
  if (isNaN(numDSValue) || numDSValue < 1 || numDSValue > 5) return badRequest(res, 'Invalid numDS');
  const dsValues = Array.isArray(ds) ? ds.map(v => parseScore(v, 20)) : [];
  const exam = parseScore(bigExam, 20);
  const hasExam = sn !== 3 && sn !== 6;
  if (sn === 3 || sn === 6) {
    const attFinal6 = getAttendanceFinal6(parseScore(attendance, 10));
    const dsAvg54 = getDSAverage(dsValues, numDSValue, false);
    const final60 = attFinal6 + dsAvg54;
    const final20 = final60 / 3;
    await Grade.findByIdAndUpdate(req.params.id, { studentId, semester: sn, attendance: parseScore(attendance, 10), ds: paddedDS || [0, 0, 0], bigExam: 0, rawTotal: final60, final20, final60, numDS: 0 }, { new: true });
  } else {
    const attFinal6 = getAttendanceFinal6(parseScore(attendance, 10));
    const dsAvg24 = getDSAverage(dsValues, numDSValue, true);
    const examFinal30 = getExamFinal(exam);
    const final60 = attFinal6 + dsAvg24 + examFinal30;
    const final20 = final60 / 3;
    const paddedDS = [];
    for (let i = 0; i < numDSValue; i++) paddedDS.push(dsValues[i] || 0);
    await Grade.findByIdAndUpdate(req.params.id, { studentId, semester: sn, attendance: parseScore(attendance, 10), ds: paddedDS, bigExam: exam, rawTotal: final60, final20, final60, numDS: numDSValue }, { new: true });
  }
  res.json({ success: true });
}));

app.get('/api/academic-year', (req, res) => res.json({ year: getCurrentAcademicYear() }));
app.get('/api/quote', (req, res) => res.json(getDailyMathQuote()));

// Lessons
app.get('/api/lessons', h(async (req, res) => {
  const { className, date } = req.query;
  const filter = {};
  if (className && !isValidClassName(className)) return badRequest(res, 'Invalid class');
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest(res, 'Invalid date');
  if (className) filter.className = className;
  if (date) filter.date = date;
  res.json(await Lesson.find(filter).sort({ date: -1, createdAt: -1 }));
}));

app.post('/api/lessons', h(async (req, res) => {
  const className = cleanText(req.body.className), date = cleanText(req.body.date), topic = cleanText(req.body.topic);
  if (!isValidClassName(className)) return badRequest(res, 'Invalid class');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest(res, 'Invalid date');
  if (!topic) return badRequest(res, 'Lesson topic is required');
  res.json(await Lesson.create({ className, date, topic, objectives: cleanText(req.body.objectives), activities: cleanText(req.body.activities), materials: cleanText(req.body.materials) }));
}));

app.put('/api/lessons/:id', h(async (req, res) => {
  if (!isValidObjectId(req.params.id)) return badRequest(res, 'Invalid lesson id');
  const className = cleanText(req.body.className), date = cleanText(req.body.date), topic = cleanText(req.body.topic);
  if (!isValidClassName(className)) return badRequest(res, 'Invalid class');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest(res, 'Invalid date');
  if (!topic) return badRequest(res, 'Lesson topic is required');
  res.json(await Lesson.findByIdAndUpdate(req.params.id, { className, date, topic, objectives: cleanText(req.body.objectives), activities: cleanText(req.body.activities), materials: cleanText(req.body.materials) }, { new: true }));
}));

app.delete('/api/lessons/:id', h(async (req, res) => {
  if (!isValidObjectId(req.params.id)) return badRequest(res, 'Invalid lesson id');
  await Lesson.findByIdAndDelete(req.params.id);
  res.json({ success: true });
}));

// Schedule
app.get('/api/schedule', h(async (req, res) => {
  const { className } = req.query;
  const filter = {};
  if (className && !isValidClassName(className)) return badRequest(res, 'Invalid class');
  if (className) filter.className = className;
  res.json(await Schedule.find(filter).sort({ day: 1, period: 1 }));
}));

app.post('/api/schedule', h(async (req, res) => {
  const className = cleanText(req.body.className), day = cleanText(req.body.day), subject = cleanText(req.body.subject);
  const period = parseInt(req.body.period, 10);
  if (!isValidClassName(className)) return badRequest(res, 'Invalid class');
  if (!['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(day)) return badRequest(res, 'Invalid day');
  if (isNaN(period) || period < 1 || period > 12) return badRequest(res, 'Invalid period');
  if (!subject) return badRequest(res, 'Subject is required');
  res.json(await Schedule.create({ className, day, period, subject, teacher: cleanText(req.body.teacher), room: cleanText(req.body.room) }));
}));

app.put('/api/schedule/:id', h(async (req, res) => {
  if (!isValidObjectId(req.params.id)) return badRequest(res, 'Invalid schedule id');
  const className = cleanText(req.body.className), day = cleanText(req.body.day), subject = cleanText(req.body.subject);
  const period = parseInt(req.body.period, 10);
  if (!isValidClassName(className)) return badRequest(res, 'Invalid class');
  if (!['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(day)) return badRequest(res, 'Invalid day');
  if (isNaN(period) || period < 1 || period > 12) return badRequest(res, 'Invalid period');
  if (!subject) return badRequest(res, 'Subject is required');
  res.json(await Schedule.findByIdAndUpdate(req.params.id, { className, day, period, subject, teacher: cleanText(req.body.teacher), room: cleanText(req.body.room) }, { new: true }));
}));

app.delete('/api/schedule/:id', h(async (req, res) => {
  if (!isValidObjectId(req.params.id)) return badRequest(res, 'Invalid schedule id');
  await Schedule.findByIdAndDelete(req.params.id);
  res.json({ success: true });
}));

// Todos
app.get('/api/todos', h(async (req, res) => {
  res.json(await Todo.find().sort({ createdAt: -1 }));
}));

app.post('/api/todos', h(async (req, res) => {
  const title = cleanText(req.body.title);
  if (!title) return badRequest(res, 'Task title is required');
  res.json(await Todo.create({ title, description: cleanText(req.body.description), dueDate: cleanText(req.body.dueDate), category: cleanText(req.body.category) || 'general', completed: !!req.body.completed }));
}));

app.put('/api/todos/:id', h(async (req, res) => {
  if (!isValidObjectId(req.params.id)) return badRequest(res, 'Invalid todo id');
  const update = {};
  if ('title' in req.body) update.title = cleanText(req.body.title);
  if ('description' in req.body) update.description = cleanText(req.body.description);
  if ('dueDate' in req.body) update.dueDate = cleanText(req.body.dueDate);
  if ('category' in req.body) update.category = cleanText(req.body.category) || 'general';
  if ('completed' in req.body) update.completed = !!req.body.completed;
  if ('title' in update && !update.title) return badRequest(res, 'Task title is required');
  res.json(await Todo.findByIdAndUpdate(req.params.id, update, { new: true }));
}));

app.delete('/api/todos/:id', h(async (req, res) => {
  if (!isValidObjectId(req.params.id)) return badRequest(res, 'Invalid todo id');
  await Todo.findByIdAndDelete(req.params.id);
  res.json({ success: true });
}));

// Questions
app.post('/api/questions', h(async (req, res) => {
  const studentName = cleanText(req.body.studentName);
  const className = cleanText(req.body.className);
  const question = cleanText(req.body.question);
  if (!studentName) return badRequest(res, 'Student name is required');
  if (!isValidClassName(className)) return badRequest(res, 'Invalid class');
  if (!question) return badRequest(res, 'Question is required');
  const q = await Question.create({ studentName, className, question });
  res.json(q);
}));

app.get('/api/questions', h(async (req, res) => {
  const { className } = req.query;
  const filter = {};
  if (className && isValidClassName(className)) filter.className = className;
  const questions = await Question.find(filter).sort({ createdAt: -1 }).limit(100);
  res.json(questions);
}));

// Analytics
app.get('/api/analytics', h(async (req, res) => {
  const lessonCount = await Lesson.countDocuments();
  const todoStats = await Todo.aggregate([{ $group: { _id: '$completed', count: { $sum: 1 } } }]);
  const todosDone = todoStats.find(t => t._id === true)?.count || 0;
  const todosTotal = todoStats.reduce((s, t) => s + t.count, 0);
  res.json({ lessonCount, todosDone, todosTotal });
}));

// ============ START SERVER ============
mongoose.connect(process.env.MONGODB_URI, {useNewUrlParser:true,useUnifiedTopology:true})
.then(() => { const P = process.env.PORT||3000; app.listen(P, () => { const B='='.repeat(50), L=`http://localhost:${P}`; console.log(`${B}\n🚀 Server running!\n${B}\n📡 ${L}\n🔐 ${L}/login\n👨‍🎓 ${L}/portal\n📊 ${L}/teacher/dashboard\n${B}\n✅ MongoDB\n${B}`); }); })
.catch(err => { console.log('❌ MongoDB:', err.message); process.exit(1); });
