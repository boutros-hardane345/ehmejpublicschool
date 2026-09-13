# Ehmej Public School Portal

Single-teacher dashboard and public student portal for Grade 7, Grade 8, and Grade 9 math classes.

## Setup

1. Copy `.env.example` to `.env`.
2. Set `MONGODB_URI`, `SESSION_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.
3. Run `npm install` if dependencies are missing.
4. Start development mode with `npm run dev`, or production mode with `npm start`.

## Main URLs

- Teacher login: `/login`
- Teacher dashboard: `/teacher/dashboard`
- Student portal directory: `/portal`
- Direct student portals: `/portal/grade-7`, `/portal/grade-8`, `/portal/grade-9`

## Grades

All grades are entered over /20 and displayed over /20. The final grade is always over /60.

- **Attendance**: entered `/20` → converted to `/60` (× 3)
- **DS assignments**: instructor chooses how many DS assignments (1–5). Each DS entered `/20`. The average of the entered DS values converts to `/24` (× 1.2)
- **Exam**: entered `/20` → converted to `/30` (× 1.5)
- **Final grade**: `Attendance (/60) + DS Average (/24) + Exam (/30) = /60`
- **Mid-Year and Final-Year**: use one direct `/20` value (× 3 = `/60`)
- Year result status: Passing `≥ 10`, Borderline `≥ 8`, Failing `< 8`
