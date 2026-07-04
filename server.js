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
const ClassSchedule = require('./models/ClassSchedule');
const ExamResult = require('./models/ExamResult');
const GradeActivity = require('./models/GradeActivity');

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
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

app.use((req, res, next) => {
  res.locals.dailyMathQuote = getDailyMathQuote();
  next();
});

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const adminEmail = process.env.ADMIN_EMAIL || 'boutros.hardane@net.eoe.edu.lb';
  const adminPassword = process.env.ADMIN_PASSWORD || 'bth$184$927';

  if ((email || '').trim().toLowerCase() === adminEmail.toLowerCase() && password === adminPassword) {
    req.session.isAuthenticated = true;
    res.redirect('/teacher/dashboard');
  } else {
    res.render('login', { error: 'Invalid email or password' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// ============ TEACHER ROUTES ============

// Dashboard
app.get('/teacher/dashboard', isAuth, h(async (req, res) => {
  const currentYear = getCurrentAcademicYear();
  const [students, allGrades, allExamResults, announcements, exercises, schedule] = await Promise.all([
    Student.find(), Grade.find(), ExamResult.find(),
    Announcement.find().sort({createdAt:-1}).limit(5),
    Exercise.find().sort({createdAt:-1}).limit(5),
    ClassSchedule.find().sort({day:1,time:1})
  ]);
  const classBreakdown = CLASSES.map(c => ({className:c, count:students.filter(s=>s.className===c).length}));
  const semesterAverages = [1,2,3,4].map(sem => {
    const gs = allGrades.filter(g=>g.semester===sem);
    return {semester:sem, count:gs.length, average:gs.length ? Math.round(gs.reduce((a,g)=>a+g.final60,0)/gs.length*10)/10 : 0};
  });
  const classAverages = CLASSES.map(c => {
    const ids = students.filter(s=>s.className===c).map(s=>s._id);
    const cg = allGrades.filter(g=>ids.some(id=>id.equals(g.studentId)));
    return {className:c, count:ids.length, semesters:[1,2,3,4].map(sem=>{
      const sg = cg.filter(g=>g.semester===sem);
      return sg.length ? Math.round(sg.reduce((a,g)=>a+g.final60,0)/sg.length*10)/10 : 0;
    })};
  });
  const totalGradedStudents = [...new Set(allGrades.map(g=>g.studentId.toString()))].length;
  const gradedWithAllSemesters = students.filter(s => allGrades.filter(g=>g.studentId.equals(s._id)).length>=4).length;
  const gradedWithWinter = students.filter(s => allGrades.find(g=>g.studentId.equals(s._id)&&g.semester===1) && allGrades.find(g=>g.studentId.equals(s._id)&&g.semester===2)).length;
  const gradedWithSpring = students.filter(s => allGrades.find(g=>g.studentId.equals(s._id)&&g.semester===3) && allGrades.find(g=>g.studentId.equals(s._id)&&g.semester===4)).length;
  const overallAverage = semesterAverages.reduce((s,x)=>s+x.average,0)/4;
  const examsWithMid = allExamResults.filter(e=>e.midYearExam>0).length;
  const examsWithFinal = allExamResults.filter(e=>e.finalYearExam>0).length;
  const examsWithBoth = allExamResults.filter(e=>e.midYearExam>0&&e.finalYearExam>0).length;
  const scheduleDays = [...new Set(schedule.map(s=>s.day))];
  res.render('teacher/dashboard', {students,announcements,exercises,schedule,currentYear,classBreakdown,classAverages,semesterAverages,totalGradedStudents,gradedWithAllSemesters,gradedWithWinter,gradedWithSpring,examsWithMid,examsWithFinal,examsWithBoth,overallAverage,scheduleDays});
}));

// Students
app.get('/teacher/students', isAuth, h(async (req, res) => {
  const selectedClass = req.query.class || 'all';
  const selectedYear = req.query.year || getCurrentAcademicYear();
  const students = await Student.find(getStudentFilter({className:selectedClass,academicYear:selectedYear})).sort({academicYear:-1,className:1,name:1});
  const academicYears = await getAcademicYears(selectedYear);
  res.render('teacher/students', {students, classes:CLASSES, academicYears, selectedClass, selectedYear});
}));

app.post('/teacher/students', isAuth, h(async (req, res) => {
  const {name,className,academicYear} = req.body;
  await Student.create({name,className,academicYear:academicYear||getCurrentAcademicYear()});
  res.redirect(`/teacher/students?class=${encodeURIComponent(className)}&year=${encodeURIComponent(academicYear||getCurrentAcademicYear())}`);
}));

app.post('/teacher/students/delete/:id', isAuth, h(async (req, res) => {
  await Student.findByIdAndDelete(req.params.id);
  res.redirect(req.headers.referer||'/teacher/students');
}));

// Schedule
app.get('/teacher/schedule', isAuth, h(async (req, res) => {
  const {class:cf,day:d} = req.query;
  const filter = {};
  if (cf&&cf!=='all') filter.className = cf;
  if (d&&d!=='all') filter.day = d;
  const schedule = await ClassSchedule.find(filter).sort({day:1,time:1});
  res.render('teacher/schedule', {schedule, classes:CLASSES, selectedClass:cf||'all', selectedDay:d||'all'});
}));

app.post('/teacher/schedule', isAuth, h(async (req, res) => {
  const {className,day,time,subject} = req.body;
  await ClassSchedule.create({className,day,time,subject});
  res.redirect('/teacher/schedule');
}));

app.post('/teacher/schedule/delete/:id', isAuth, h(async (req, res) => {
  await ClassSchedule.findByIdAndDelete(req.params.id);
  res.redirect('/teacher/schedule');
}));

// Activity Log
app.get('/teacher/activity-log', isAuth, h(async (req, res) => {
  const {action,search} = req.query;
  const filter = {};
  if (action&&action!=='all') filter.action = action;
  if (search&&search.trim()) filter.studentName = {$regex:search.trim(),$options:'i'};
  const activities = await GradeActivity.find(filter).sort({createdAt:-1}).limit(100);
  res.render('teacher/activity-log', {activities, selectedAction:action||'all', search:search||''});
}));

// Teacher Content
app.get('/teacher/content', isAuth, h(async (req, res) => {
  const selectedClass = req.query.class||'all';
  const selectedSemester = req.query.semester||'all';
  const af = {}, ef = {};
  if (selectedClass!=='all') { af.className=selectedClass; ef.className=selectedClass; }
  const sn = parseInt(selectedSemester,10);
  if (!isNaN(sn)&&sn>=1&&sn<=4) ef.semester = sn;
  const [announcements, exercises] = await Promise.all([
    Announcement.find(af).sort({createdAt:-1}),
    Exercise.find(ef).sort({createdAt:-1})
  ]);
  res.render('teacher/content', {announcements,exercises,classes:CLASSES,selectedClass,selectedSemester});
}));

app.get('/teacher/announcements', isAuth, (req, res) => {
  res.redirect('/teacher/content');
});

app.post('/teacher/announcements', isAuth, h(async (req, res) => {
  const {className,title,content} = req.body;
  await Announcement.create({className,title,content});
  res.redirect(req.headers.referer||'/teacher/content');
}));

app.post('/teacher/announcements/delete/:id', isAuth, h(async (req, res) => {
  await Announcement.findByIdAndDelete(req.params.id);
  res.redirect(req.headers.referer||'/teacher/content');
}));

// Exercises
app.get('/teacher/exercises', isAuth, (req, res) => {
  res.redirect('/teacher/content');
});

app.post('/teacher/exercises', isAuth, upload.single('file'), h(async (req, res) => {
  const {className,title,description,semester} = req.body;
  await Exercise.create({className,title,description,semester,fileUrl:req.file?'/uploads/'+req.file.filename:null,fileType:req.file?.mimetype||'text'});
  res.redirect(req.headers.referer||'/teacher/content');
}));

app.post('/teacher/exercises/delete/:id', isAuth, h(async (req, res) => {
  await Exercise.findByIdAndDelete(req.params.id);
  res.redirect(req.headers.referer||'/teacher/content');
}));

// Grades
app.get('/teacher/grades', isAuth, h(async (req, res) => {
  const selectedClass = req.query.class||'all', selectedYear = req.query.year||getCurrentAcademicYear(), selectedSemester = req.query.semester||'all';
  const students = await Student.find(getStudentFilter({className:selectedClass,academicYear:selectedYear})).sort({academicYear:-1,className:1,name:1});
  const studentIds = students.map(s=>s._id);
  let grades = await Grade.find({studentId:{$in:studentIds}});
  const examResults = await ExamResult.find({studentId:{$in:studentIds}});
  const sn = parseInt(selectedSemester,10);
  if (!isNaN(sn)&&sn>=1&&sn<=4) grades = grades.filter(g=>g.semester===sn);
  const academicYears = await getAcademicYears(selectedYear);
  res.render('teacher/grades', {students,grades,examResults,classes:CLASSES,academicYears,selectedClass,selectedYear,selectedSemester});
}));

app.post('/teacher/grades', isAuth, h(async (req, res) => {
  const {studentId,semester,attendance,ds1,ds2,ds3,ds4,bigExam} = req.body;
  const ds = [parseFloat(ds1)||0, parseFloat(ds2)||0, parseFloat(ds3)||0, parseFloat(ds4)||0];
  const rawTotal = parseFloat(attendance) + ds.reduce((a,b)=>a+b,0) + parseFloat(bigExam);
  await Grade.findOneAndUpdate({studentId,semester},{studentId,semester,attendance:parseFloat(attendance),ds,bigExam:parseFloat(bigExam),rawTotal,final60:(rawTotal/100)*60},{upsert:true,new:true});
  res.redirect(req.headers.referer||'/teacher/grades');
}));

// Year Results
app.get('/teacher/year-results', isAuth, h(async (req, res) => {
  const {class:className} = req.query;
  const selectedClass = className||'all', selectedYear = req.query.year||getCurrentAcademicYear();
  const selectedMidExamFilter = req.query.midExam||'all', selectedFinalExamFilter = req.query.finalExam||'all', selectedStatusFilter = req.query.status||'all';
  const [students, allGrades, allExamResults] = await Promise.all([
    Student.find(getStudentFilter({className:selectedClass,academicYear:selectedYear})).sort({name:1}),
    Grade.find(), ExamResult.find()
  ]);
  let results = students.map(student => {
    const gs = [1,2,3,4].map(s => allGrades.find(g=>g.studentId.equals(student._id)&&g.semester===s));
    const sem = gs.map(g=>g?g.final60:0);
    const examResult = allExamResults.find(e=>e.studentId.equals(student._id));
    const midYearExam = examResult?examResult.midYearExam:0, finalYearExam = examResult?examResult.finalYearExam:0;
    const yearAverage = (sem[0]+sem[1]+midYearExam+sem[2]+sem[3]+finalYearExam)/6;
    let statusKey = 'fail';
    if (yearAverage>=50) statusKey='pass';
    else if (yearAverage>=40) statusKey='border';
    return {student,sem1:sem[0],sem2:sem[1],midYearExam,sem3:sem[2],sem4:sem[3],finalYearExam,winterAverage:(sem[0]+sem[1]+midYearExam)/3,springAverage:(sem[2]+sem[3]+finalYearExam)/3,yearAverage,statusKey};
  });
  results = results.filter(r => {
    if (selectedMidExamFilter==='entered'&&r.midYearExam===0) return false;
    if (selectedMidExamFilter==='missing'&&r.midYearExam>0) return false;
    if (selectedFinalExamFilter==='entered'&&r.finalYearExam===0) return false;
    if (selectedFinalExamFilter==='missing'&&r.finalYearExam>0) return false;
    if (selectedStatusFilter!=='all'&&r.statusKey!==selectedStatusFilter) return false;
    return true;
  });
  const summary = {total:results.length,passing:results.filter(r=>r.statusKey==='pass').length,borderline:results.filter(r=>r.statusKey==='border').length,failing:results.filter(r=>r.statusKey==='fail').length};
  const academicYears = await getAcademicYears(selectedYear);
  res.render('teacher/year-results', {results,classes:CLASSES,academicYears,selectedClass,selectedYear,selectedMidExamFilter,selectedFinalExamFilter,selectedStatusFilter,summary});
}));

// Update Exam Results
app.post('/teacher/exam-results', isAuth, h(async (req, res) => {
  const {studentId,midYearExam,finalYearExam} = req.body;
  const existing = await ExamResult.findOne({studentId});
  const update = {studentId,updatedAt:new Date()};
  update.midYearExam = req.body.midYearExam!==undefined ? parseScore(midYearExam,60) : (existing?existing.midYearExam:0);
  update.finalYearExam = req.body.finalYearExam!==undefined ? parseScore(finalYearExam,60) : (existing?existing.finalYearExam:0);
  await ExamResult.findOneAndUpdate({studentId},update,{upsert:true,new:true});
  res.redirect(req.headers.referer||'/teacher/year-results');
}));

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
    const gs = [1,2,3,4].map(s=>allGrades.find(g=>g.studentId.equals(student._id)&&g.semester===s));
    const sem = gs.map(g=>g?g.final60:0);
    const mid = (sem[0]+sem[1])/2, fin = (sem[2]+sem[3])/2, avg = (sem[0]+sem[1]+sem[2]+sem[3])/4;
    const st = avg>=50?'Passing':avg>=40?'Borderline':'Failing';
    const sc = avg>=50?'#27ae60':avg>=40?'#f39c12':'#e74c3c';
    if (i%2===0) doc.rect(50,y-2,520,18).fill('#f8f9fa');
    doc.fillColor('black');
    const name = student.name.length>12?student.name.slice(0,10)+'..':student.name;
    doc.text(name,cols[0],y);
    doc.text(student.className.replace('Grade ',''),cols[1],y);
    [0,1,2,3].forEach(j=>doc.text(sem[j].toFixed(0),cols[2+j],y,{width:30,align:'center'}));
    doc.text(mid.toFixed(0),cols[4],y,{width:30,align:'center'});
    doc.text(fin.toFixed(0),cols[7],y,{width:30,align:'center'});
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

// ============ STUDENT PORTAL ============
app.get(['/portal','/portal/:gradeSlug'], h(async (req, res) => {
  const {month,semester} = req.query;
  const className = gradeSlugToClass(req.params.gradeSlug);
  const isGradeLanding = !req.params.gradeSlug;
  if (req.params.gradeSlug&&!className) return res.status(404).send('Class portal not found');
  if (isGradeLanding) return res.render('student/portal',{announcements:[],exercises:[],classes:CLASSES,isGradeLanding,selectedClass:null,portalPath:'/portal',month:month||'',semester:semester||''});
  let [announcements, exercises] = await Promise.all([
    Announcement.find({className}).sort({createdAt:-1}),
    Exercise.find({className}).sort({createdAt:-1})
  ]);
  if (month) {
    const start = new Date(new Date(month).getFullYear(),new Date(month).getMonth(),1);
    const end = new Date(new Date(month).getFullYear(),new Date(month).getMonth()+1,1);
    announcements = announcements.filter(a => {const d=new Date(a.createdAt); return d>=start&&d<end;});
    exercises = exercises.filter(e => {const d=new Date(e.createdAt); return d>=start&&d<end;});
  }
  if (semester&&!isNaN(semester)) { const sn=parseInt(semester); if(sn>=1&&sn<=4) exercises=exercises.filter(e=>e.semester===sn); }
  res.render('student/portal',{announcements,exercises,classes:CLASSES,isGradeLanding,selectedClass:className,portalPath:classToPortalPath(className),month:month||'',semester:semester||''});
}));

// ============ START SERVER ============
mongoose.connect(process.env.MONGODB_URI, {useNewUrlParser:true,useUnifiedTopology:true})
.then(() => { const P = process.env.PORT||3000; app.listen(P, () => { const B='='.repeat(50), L=`http://localhost:${P}`; console.log(`${B}\n🚀 Server running!\n${B}\n📡 ${L}\n🔐 ${L}/login\n👨‍🎓 ${L}/portal\n📊 ${L}/teacher/dashboard\n${B}\n✅ MongoDB\n${B}`); }); })
.catch(err => { console.log('❌ MongoDB:', err.message); process.exit(1); });
