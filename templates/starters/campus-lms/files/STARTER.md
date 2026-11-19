# Campus: the learning platform of a training school

This project started from the starter template "Campus". It is an app: the pages are behind sign-in.
The school has 18 courses in 5 tracks, 7 instructors, and about 120 students. All content is sample content. No table exists yet.

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/` | Redirect to `/app` | `src/routes/index.tsx` |
| `/app` | Dashboard in three bands. Band 1: welcome card with the classes of today, course progress of the two running courses, top students. Band 2: pass rate, grading progress, activity mix (donut). Band 3: lessons finished per day (area chart, 7/30/90 days), assignments due (table with search) | `src/features/dashboard` |
| `/app/courses` | Courses: the spotlight of the chosen course, its instructor and its description on the left; its progress and the course list (tabs Running, Soon, Done) on the right | `src/features/courses` |
| `/app/courses/$courseId` | One course, in four tabs. Overview: a profile card, open lessons, topics, latest activity, assignments, students to review. Modules, Students, Assignments: one list or table each | `src/features/courses` |
| `/app/students` | Students: a table with search, Status, Track, and Course filters, columns, selection, CSV export. `?student=<id>` opens the record of one student in a side panel | `src/features/students` |
| `/app/assignments` | Assignments: the submissions in a table with Status and Wait filters, selection, CSV export, and "Rows per page". `?submission=<id>` opens one submission | `src/features/assignments` |
| `/app/profile` | Profile (from the base template) | `src/features/profile` |

The nav is in `src/features/app-shell/lib/nav-items.ts`, in three groups: Overview, School, Account.
The header has a page search (Cmd/Ctrl+K) and notifications: work that waits too long for a grade, and assignments due soon (`src/features/school/api/alerts.queries.ts`).
The texts are in `src/shared/i18n/messages.ts`.

## Where the sample content is

`src/features/school/` stands in for the database. `lib/sample-data.ts` holds seven sample tables:

| Row type | Becomes the table |
|---|---|
| `InstructorRow` | `instructors` (name, job title) |
| `CourseRow` | `courses` (code, title, track, level, instructor, summary, class days and time, dates, seats, modules) |
| `StudentRow` | `students` (name, email, joined at) |
| `EnrollmentRow` | `enrollments` (student, course, enrolled at) |
| `LessonCompletionRow` | `lesson_completions` (student, course, lesson number, completed at) |
| `AssignmentRow` | `assignments` (course, title, kind, due at, highest grade) |
| `SubmissionRow` | `submissions` (assignment, student, submitted at, note, graded at, points, feedback) |

- Every date is "today minus N days". A seeded generator gives the same rows for the whole day. No file calls `Math.random()`.
- `getSampleTables(now)` drops each row whose time is after `now`, so no row is in the future.
- `lib/learning.ts` holds the rules of the school: the state of a course, the open lessons, the state of a student, the wait of a submission.
- `lib/catalog.ts` holds the value lists: tracks, levels, course states, assignment kinds, the 5-day grading promise, and the pass mark (70 points).
- Each page reads through `queryOptions` in `src/features/<feature>/api/*.queries.ts`. Each `queryFn` calls `getSampleTables` and pure functions.

## How to make each part real

1. Create the seven tables with one migration. Follow `data.md` of the `app-dashboard` skill: `owner_id`, RLS, indexes.
   Keep `TRACKS`, `COURSE_LEVELS`, and `ASSIGNMENT_KINDS` of `catalog.ts` as `check` constraints.
   Store the modules of a course as a `course_modules` table (course, position, title, lesson count), or as one `jsonb` column.
2. Replace the body of each `queryFn` with a Supabase call. Parse the rows with a zod schema.
   Keep the result types of each query file (`Course`, `Student`, `Submission`), or map the columns to them.
3. The dashboard counts (`dashboardSummaryQueryOptions` and the lessons per day of `buildDailySeries` in `lib/series.ts`): write SQL read functions (`data.md`, section 3).
4. The rules of `learning.ts` can move to SQL views. Keep one place for each rule, so all pages agree.
5. `lesson_completions` grows fast (about 3,900 rows in the sample). With real data, count it on the server and page the tables (`tables-paging.md` of the skill).
6. When every query reads the database, delete `sample-data.ts` of `src/features/school/lib/`.

## What does not exist yet

- No page writes data. No form exists: no new course, no enrollment form, no grade form.
- To add a write: a mutation in `api/<entity>.mutations.ts`, and a dialog as `tables.md` of the skill shows.
- Good first writes: grade a submission (points and feedback in the submission panel), add a course, enroll a student.
- Students have no sign-in of their own. A student portal needs a role column and RLS policies per role.
- The app name is `common.appName` in `messages.ts`.
