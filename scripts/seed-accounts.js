// Bulk generate Student + StudentAccount from teacher-provided names.
// Usage: MONGODB_URI=... node scripts/seed-accounts.js
// Outputs CSV (name,username,password,class) for paper handout. Passwords shown once only.
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Student = require('../models/Student');
const StudentAccount = require('../models/StudentAccount');

const GRADE7 = ["Jhon charbel zgheib","jean pierre antoine lahoud","jean paul emile el moujabber","charbel mounir el ghobry","robin roger abi younes","miguel tony abboud","rabih ziade ziade","georgio bernard abi ramia","ahmad ahmad","jibril ahmad","ghady baraket","joseph chadi elias","lucas jean trad","elias joseph khalife","gianna bou gharios","ali awwad","rouby gebrael","rita charbel semaan","angelina wissam sawma","lamita gilbert abi younes","charbel abi ramia","jamil daher","tatiana tannous","joelle joseph khalife","charbel jean abi ramia","charbel benoit barbar","georgio ghassan abi ramia","noelyn el moujabber","rayan hardan","adriano moussa abi khalil","majed toufic hamdar"];
const GRADE8 = ["Aimee Pierre Abi Semaan","Challita Benoit Barbar","Charbel Abdo Matta","Charbel Daoud Gebrael","Christian Joe Marice Skaff","Elias Youssef Zgheib","Ghassan Awwad","Giovani Simon Charbel Khalife","Helena Charbel Chedid","Jonas Saba Baraket","Marguerite Marie Elias Challitta","Matheo Mario Lahoud","Mikaella Tofi El Moujabber","Mohammad Hasan Nasr El Din","Nadine Youssef Daher","Naya Ahmad Koubeissi","Naya Ousama Noun","Nour Tony Abi Younes","Paoula Maria Pascal Gerges","Petra Youssef Abi Younes","Riham Rida Ibrahim","Ronaldo Toni Baraket","Sirine Melhem Awwad","Tala Mohammad Lakis","Theresia Fares Abou Nassif","Yehya Akram Nasr EL Din"];
const GRADE9 = ["Anna Maria Antoine Abboud","Aquilina Samir Ramia","Marguerita Ghassan Abi Rami","Anthony Wissam Sawma","Aya Melhem Awwad","Celine Simon Daher","Charbel Georges Abi Khalil","Charbel Maurice Skaff","Charelle Fadi Baraket","Christa Maria Charbel Matta","Clauda Maria Bou Younes","Firas jihad Hssein","Jason Charbel Harb","Joud Toufic Hamdar","Joyce Charbel Abboud","Khalil Ahmad Ghadar","Marianne Jean Matta","Mariano Moussa Abi Khalil","Marie Antoinette Elias Challita","Noor Georges Haddad","Stephan Jean Matta","Steven Edward Daou","Thea Zahi Daher","Yana Ziad Daher"];

const slugify = s => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60) || 'student';
const prefix = c => c==='Grade 7' ? 'eb7' : c==='Grade 8' ? 'eb8' : 'eb9';
const randPass = () => crypto.randomBytes(5).toString('base64').replace(/[^A-Za-z0-9]/g,'X').slice(0,8);
const getYear = () => { const n=new Date(), y=n.getMonth()>=8?n.getFullYear():n.getFullYear()-1; return `${y}-${y+1}`; };

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const all = [...GRADE7.map(n=>({name:n,className:'Grade 7'})), ...GRADE8.map(n=>({name:n,className:'Grade 8'})), ...GRADE9.map(n=>({name:n,className:'Grade 9'}))];
  console.log('name,username,password,class');
  for (const {name,className} of all) {
    let student = await Student.findOne({ name, className });
    if (!student) student = await Student.create({ name, className, academicYear: getYear() });
    let acc = await StudentAccount.findOne({ studentId: student._id });
    if (acc) { console.log(`"${name}",${acc.username},(already exists),${className}`); continue; }
    let base = `${prefix(className)}-${slugify(name)}`, username = base, i = 2;
    while (await StudentAccount.findOne({ username })) username = `${base}-${i++}`;
    const password = randPass();
    await StudentAccount.create({ username, passwordHash: await bcrypt.hash(password,10), studentId: student._id, className });
    console.log(`"${name}",${username},${password},${className}`);
  }
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
