// One-time rescue: import surviving uploads/* files into MongoDB (persistent).
// Usage: MONGODB_URI=... node scripts/backfill-files-to-db.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Exercise = require('../models/Exercise');

const uploadDir = path.join(__dirname, '..', 'uploads');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const docs = await Exercise.find({ $or: [{ fileData: { $exists: false } }, { fileData: null }] });
  let migrated = 0, missing = 0;
  for (const doc of docs) {
    if (!doc.fileUrl || doc.fileUrl.startsWith('db:')) continue;
    const fp = path.join(uploadDir, path.basename(doc.fileUrl));
    if (!fp.startsWith(uploadDir) || !fs.existsSync(fp)) { missing++; continue; }
    try {
      doc.fileData = fs.readFileSync(fp);
      doc.fileName = doc.fileName || path.basename(doc.fileUrl);
      doc.fileSize = doc.fileData.length;
      doc.fileUrl = 'db:' + Date.now();
      await doc.save();
      migrated++;
    } catch (e) {
      console.error('Failed', doc._id, e.message);
    }
  }
  console.log(`Migrated: ${migrated}, missing-on-disk (needs re-upload): ${missing}, checked: ${docs.length}`);
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
