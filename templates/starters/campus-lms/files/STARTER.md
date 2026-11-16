# Campus: the learning platform of a training school

This project started from the starter template "Campus". It is an app: the pages are behind sign-in.
The school has 18 courses in 5 tracks, 7 instructors, and about 120 students. All content is sample content. No table exists yet.

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/` | Redirect to `/app` | `src/routes/index.tsx` |
| `/app` | Overview: the digest of 7, 30, or 90 days. A summary, lessons finished, work to grade, new enrollments | `src/features/overview` |
| `/app/courses` | Courses: one card per course, with a state filter (tabs, a select on a phone) and a track filter | `src/features/courses` |
| `/app/courses/$courseId` | One course: figures, students, assignments, facts, modules, activity | `src/features/courses` |
| `/app/students` | Students: figures and a table. `?student=<id>` opens the record of one student in a side panel | `src/features/students` |
| `/app/assignments` | Assignments: the submissions, "To grade" first, and the next deadlines. `?submission=<id>` opens one submission | `src/features/assignments` |
| `/app/profile` | Profile (from the base template) | `src/features/profile` |

The nav is in `src/features/app-shell/lib/nav-items.ts`. The texts are in `src/shared/i18n/messages.ts`.
The home follows the `app-dashboard` skill: home `digest`, KPI form `meter`, chart form `bars`.

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
- `lib/catalog.ts` holds the value lists: tracks, levels, course states, assignment kinds, the 5-day grading promise.
- Each page reads through `queryOptions` in `src/features/<feature>/api/*.queries.ts`. Each `queryFn` calls `getSampleTables` and pure functions.

## How to make each part real

1. Create the seven tables with one migration. Follow `data.md` of the `app-dashboard` skill: `owner_id`, RLS, indexes.
   Keep `TRACKS`, `COURSE_LEVELS`, and `ASSIGNMENT_KINDS` of `catalog.ts` as `check` constraints.
   Store the modules of a course as a `course_modules` table (course, position, title, lesson count), or as one `jsonb` column.
2. Replace the body of each `queryFn` with a Supabase call. Parse the rows with a zod schema.
   Keep the result types of each query file (`Course`, `Student`, `Submission`), or map the columns to them.
3. The overview counts per day (`buildDailySeries` of `lib/series.ts`) and the course ranking: write SQL read functions (`data.md`, section 3).
4. The rules of `learning.ts` can move to SQL views. Keep one place for each rule, so all pages agree.
5. `lesson_completions` grows fast (about 3,900 rows in the sample). With real data, count it on the server and page the tables (`tables-paging.md` of the skill).
6. When every query reads the database, delete `sample-data.ts` of `src/features/school/lib/`.

## What does not exist yet

- No page writes data. No form exists: no new course, no enrollment form, no grade form.
- To add a write: a mutation in `api/<entity>.mutations.ts`, and a dialog as `tables.md` of the skill shows.
- Good first writes: grade a submission (points and feedback in the submission panel), add a course, enroll a student.
- Students have no sign-in of their own. A student portal needs a role column and RLS policies per role.
- The app name is `common.appName` in `messages.ts`.
