// The sample tables of the school: instructors, courses, students, enrollments, lesson completions,
// assignments, and submissions. Only the query files (api/*.queries.ts of each feature) read them, through getSampleTables().
// The rows stand in for a database. A later turn replaces each queryFn with a Supabase call, then deletes this file.
// Every date is relative to the current day. A seeded generator makes the same rows for the whole day.
// LIMIT: the history moves by one day at midnight, so the rows change then. Upgrade: real tables (STARTER.md).
import type { AssignmentKind, CourseLevel, Track } from "./catalog";
import { HOUR_MS, MINUTE_MS, startOfLocalDay } from "./time";

/** One teacher of the school. An instructor leads courses and grades their work. */
export type InstructorRow = {
	id: string;
	name: string;
	/** The job of the instructor outside the school, for example "Data analyst". */
	title: string;
};

/** One part of a course: a title and a count of lessons. The lessons of a course are released in module order. */
export type ModuleRow = { title: string; lessons: number };

/** One course. The times are ISO texts. */
export type CourseRow = {
	/** A slug, for example "sql-and-data-modeling". It is also the `$courseId` of the URL. */
	id: string;
	/** The catalog code, for example "DAT-205". */
	code: string;
	title: string;
	track: Track;
	level: CourseLevel;
	instructorId: string;
	/** Two sentences for the detail page. */
	summary: string;
	/** Weekday numbers of the classes. 0 is Sunday. */
	classDays: number[];
	/** Start of each class as "HH:MM", in the school time zone. */
	classTime: string;
	/** Midnight at the start of the first day. */
	startAt: string;
	/** The last minute of the last day. */
	endAt: string;
	/** The places of the course. */
	seats: number;
	modules: ModuleRow[];
};

/** One student. */
export type StudentRow = {
	id: string;
	name: string;
	email: string;
	/** The time of the first enrollment of the student. */
	joinedAt: string;
};

/** One student in one course. */
export type EnrollmentRow = {
	id: string;
	studentId: string;
	courseId: string;
	enrolledAt: string;
};

/** One finished lesson of one student. The activity charts count these rows per day. */
export type LessonCompletionRow = {
	studentId: string;
	courseId: string;
	/** The number of the lesson in the course. The first lesson is 1. */
	lesson: number;
	completedAt: string;
};

/** One piece of graded work of a course. */
export type AssignmentRow = {
	id: string;
	courseId: string;
	title: string;
	kind: AssignmentKind;
	/** 23:59 on the due day. A later submission is late. */
	dueAt: string;
	/** The highest grade, in points. */
	maxPoints: number;
};

/** The work that one student sent for one assignment. */
export type SubmissionRow = {
	id: string;
	assignmentId: string;
	studentId: string;
	submittedAt: string;
	/** A message of the student to the instructor. null when the student wrote none. */
	note: string | null;
	/** When the instructor gave the grade. null while the submission waits. */
	gradedAt: string | null;
	/** The grade in points, 0 to `maxPoints` of the assignment. null while the submission waits. */
	points: number | null;
	/** The comment of the instructor. null while the submission waits. */
	feedback: string | null;
};

/** Every sample table. Each list is in creation order; the query files sort and join them. */
export type SampleTables = {
	instructors: InstructorRow[];
	courses: CourseRow[];
	students: StudentRow[];
	enrollments: EnrollmentRow[];
	lessonCompletions: LessonCompletionRow[];
	assignments: AssignmentRow[];
	submissions: SubmissionRow[];
};

const INSTRUCTORS: InstructorRow[] = [
	{ id: "ins-1", name: "Helena Marchetti", title: "Lead product designer" },
	{ id: "ins-2", name: "Tobias Lindgren", title: "Senior data analyst" },
	{ id: "ins-3", name: "Priya Venkataraman", title: "Software engineer" },
	{ id: "ins-4", name: "Marcus Oyelaran", title: "Marketing strategist" },
	{ id: "ins-5", name: "Camille Ostrander", title: "Program manager" },
	{ id: "ins-6", name: "Daniel Abernathy", title: "Machine learning engineer" },
	{ id: "ins-7", name: "Sofia Castellanos", title: "Brand designer" },
];

// The four groups of courses. Each group takes its students from its own pool.
type Cohort = "first" | "second" | "running" | "upcoming";

// One course before its dates and its students exist.
type CourseSeed = Omit<CourseRow, "startAt" | "endAt"> & {
	/** Days from today to the first day. Negative for a course that started. */
	startInDays: number;
	/** Length of the course in weeks. */
	weeks: number;
	/** How many students the generator puts in the course. */
	students: number;
	/** The pool that gives the students: see STUDENT_POOLS. */
	cohort: Cohort;
	/** The four assignments, in due order. */
	assignments: { title: string; kind: AssignmentKind }[];
	/** The days from a submission to its grade, as [fewest, most]. DEFAULT_GRADING_DAYS when absent. */
	gradingDays?: readonly [number, number];
};

// The first 8 courses are finished, the next 7 run today, and the last 3 start soon.
const COURSES: CourseSeed[] = [
	{
		id: "digital-marketing-essentials",
		code: "MKT-101",
		title: "Digital Marketing Essentials",
		track: "marketing",
		level: "beginner",
		instructorId: "ins-4",
		summary:
			"A first tour of online marketing, from the funnel to the monthly report. Students plan one campaign for a business that they choose.",
		classDays: [2, 4],
		classTime: "18:30",
		startInDays: -180,
		weeks: 12,
		seats: 16,
		students: 14,
		cohort: "first",
		modules: [
			{ title: "The marketing funnel", lessons: 4 },
			{ title: "Audience and positioning", lessons: 4 },
			{ title: "Search and paid ads", lessons: 5 },
			{ title: "Email and automation", lessons: 4 },
			{ title: "Social media campaigns", lessons: 5 },
			{ title: "Measurement and reporting", lessons: 4 },
		],
		assignments: [
			{ title: "Audience persona brief", kind: "essay" },
			{ title: "Paid search plan", kind: "project" },
			{ title: "Email sequence draft", kind: "project" },
			{ title: "Campaign report", kind: "project" },
		],
	},
	{
		id: "python-for-data-analysis",
		code: "DAT-110",
		title: "Python for Data Analysis",
		track: "data",
		level: "beginner",
		instructorId: "ins-2",
		summary:
			"Python from the first line to a full analysis of a real table. Each week ends with a short notebook exercise.",
		classDays: [1, 3],
		classTime: "18:30",
		startInDays: -186,
		weeks: 12,
		seats: 16,
		students: 15,
		cohort: "first",
		modules: [
			{ title: "Python basics", lessons: 5 },
			{ title: "Tables and data frames", lessons: 5 },
			{ title: "Cleaning messy data", lessons: 5 },
			{ title: "Grouping and joins", lessons: 4 },
			{ title: "Charts and plots", lessons: 4 },
			{ title: "Final analysis project", lessons: 5 },
		],
		assignments: [
			{ title: "Python basics quiz", kind: "quiz" },
			{ title: "Data cleaning lab", kind: "lab" },
			{ title: "Sales analysis notebook", kind: "project" },
			{ title: "Final analysis report", kind: "project" },
		],
	},
	{
		id: "front-end-foundations",
		code: "DEV-100",
		title: "Front-End Foundations",
		track: "development",
		level: "beginner",
		instructorId: "ins-3",
		summary:
			"HTML, CSS, and JavaScript for people who never wrote code. The course ends with a small site that each student publishes.",
		classDays: [2, 4],
		classTime: "19:00",
		startInDays: -175,
		weeks: 12,
		seats: 16,
		students: 14,
		cohort: "first",
		modules: [
			{ title: "Page structure with HTML", lessons: 4 },
			{ title: "Layout with CSS", lessons: 5 },
			{ title: "Responsive design", lessons: 4 },
			{ title: "JavaScript basics", lessons: 6 },
			{ title: "The DOM and events", lessons: 5 },
			{ title: "Ship a small site", lessons: 4 },
		],
		assignments: [
			{ title: "Semantic page build", kind: "lab" },
			{ title: "Responsive layout", kind: "project" },
			{ title: "JavaScript quiz", kind: "quiz" },
			{ title: "Portfolio site", kind: "project" },
		],
	},
	{
		id: "ux-design-foundations",
		code: "UX-101",
		title: "UX Design Foundations",
		track: "design",
		level: "beginner",
		instructorId: "ins-1",
		summary:
			"The full design process on one product idea: research, flows, wireframes, and a tested prototype.",
		classDays: [1, 3],
		classTime: "18:00",
		startInDays: -122,
		weeks: 11,
		seats: 14,
		students: 12,
		cohort: "second",
		modules: [
			{ title: "What user experience is", lessons: 3 },
			{ title: "User research", lessons: 5 },
			{ title: "Personas and journeys", lessons: 4 },
			{ title: "Wireframes and flows", lessons: 5 },
			{ title: "Interactive prototypes", lessons: 5 },
			{ title: "Usability tests", lessons: 4 },
		],
		assignments: [
			{ title: "Interview summary", kind: "essay" },
			{ title: "Journey map", kind: "project" },
			{ title: "Wireframe set", kind: "project" },
			{ title: "Usability test report", kind: "project" },
		],
	},
	{
		id: "spreadsheets-for-business-analysis",
		code: "BUS-120",
		title: "Spreadsheets for Business Analysis",
		track: "business",
		level: "beginner",
		instructorId: "ins-5",
		summary:
			"Formulas, pivot tables, and clean models for people who work with numbers each day. Students build one budget model.",
		classDays: [2, 4],
		classTime: "18:00",
		startInDays: -110,
		weeks: 10,
		seats: 14,
		students: 12,
		cohort: "second",
		modules: [
			{ title: "Clean tables", lessons: 4 },
			{ title: "Formulas that scale", lessons: 5 },
			{ title: "Lookups and references", lessons: 4 },
			{ title: "Pivot tables", lessons: 4 },
			{ title: "Charts for a report", lessons: 4 },
			{ title: "A budget model", lessons: 4 },
		],
		assignments: [
			{ title: "Table cleanup lab", kind: "lab" },
			{ title: "Formula quiz", kind: "quiz" },
			{ title: "Sales pivot report", kind: "project" },
			{ title: "Budget model", kind: "project" },
		],
	},
	{
		id: "social-media-marketing",
		code: "MKT-150",
		title: "Social Media Marketing",
		track: "marketing",
		level: "beginner",
		instructorId: "ins-4",
		summary:
			"Plan, publish, and measure the social channels of a small brand. Students run a four-week content calendar.",
		classDays: [1, 3],
		classTime: "18:30",
		startInDays: -105,
		weeks: 10,
		seats: 14,
		students: 12,
		cohort: "second",
		modules: [
			{ title: "Channels and audiences", lessons: 4 },
			{ title: "Content pillars", lessons: 4 },
			{ title: "Short video", lessons: 5 },
			{ title: "Community replies", lessons: 4 },
			{ title: "Paid social basics", lessons: 4 },
			{ title: "Reports that matter", lessons: 4 },
		],
		assignments: [
			{ title: "Channel audit", kind: "essay" },
			{ title: "Content calendar", kind: "project" },
			{ title: "Short video series", kind: "project" },
			{ title: "Monthly social report", kind: "project" },
		],
	},
	{
		id: "statistics-for-decision-making",
		code: "DAT-150",
		title: "Statistics for Decision Making",
		track: "data",
		level: "intermediate",
		instructorId: "ins-6",
		summary:
			"Samples, averages, and tests for people who decide with numbers. Each week starts from one business question.",
		classDays: [2, 4],
		classTime: "19:00",
		startInDays: -160,
		weeks: 10,
		seats: 14,
		students: 12,
		cohort: "second",
		modules: [
			{ title: "Describe a data set", lessons: 4 },
			{ title: "Samples and surveys", lessons: 4 },
			{ title: "Probability in practice", lessons: 4 },
			{ title: "Confidence intervals", lessons: 4 },
			{ title: "A/B tests", lessons: 5 },
			{ title: "Regression basics", lessons: 4 },
		],
		assignments: [
			{ title: "Descriptive statistics quiz", kind: "quiz" },
			{ title: "Survey design lab", kind: "lab" },
			{ title: "A/B test readout", kind: "project" },
			{ title: "Decision memo", kind: "essay" },
		],
	},
	{
		id: "visual-design-basics",
		code: "UX-110",
		title: "Visual Design Basics",
		track: "design",
		level: "beginner",
		instructorId: "ins-7",
		summary:
			"Type, color, grids, and images for clear screens and print. Students redesign one poster and one landing page.",
		classDays: [1, 3],
		classTime: "19:00",
		startInDays: -150,
		weeks: 9,
		seats: 14,
		students: 12,
		cohort: "second",
		modules: [
			{ title: "Seeing like a designer", lessons: 3 },
			{ title: "Typography", lessons: 5 },
			{ title: "Color", lessons: 4 },
			{ title: "Grids and layout", lessons: 4 },
			{ title: "Images and icons", lessons: 4 },
			{ title: "A full redesign", lessons: 4 },
		],
		assignments: [
			{ title: "Type pairing study", kind: "lab" },
			{ title: "Color palette quiz", kind: "quiz" },
			{ title: "Poster redesign", kind: "project" },
			{ title: "Landing page redesign", kind: "project" },
		],
	},
	{
		id: "product-design-studio",
		code: "UX-201",
		title: "Product Design Studio",
		track: "design",
		level: "intermediate",
		instructorId: "ins-1",
		summary:
			"A studio course for designers who know the basics. Each student builds a design system and one accessible product flow.",
		classDays: [2, 4],
		classTime: "18:00",
		startInDays: -67,
		weeks: 11,
		seats: 16,
		students: 14,
		cohort: "running",
		modules: [
			{ title: "Design critique habits", lessons: 3 },
			{ title: "Design systems", lessons: 5 },
			{ title: "Interaction patterns", lessons: 5 },
			{ title: "Accessibility in practice", lessons: 4 },
			{ title: "Motion and feedback", lessons: 4 },
			{ title: "Studio project", lessons: 6 },
		],
		assignments: [
			{ title: "Component audit", kind: "essay" },
			{ title: "Design system starter", kind: "project" },
			{ title: "Accessible checkout flow", kind: "project" },
			{ title: "Studio case study", kind: "project" },
		],
	},
	{
		id: "sql-and-data-modeling",
		code: "DAT-205",
		title: "SQL and Data Modeling",
		track: "data",
		level: "intermediate",
		instructorId: "ins-2",
		summary:
			"From a first query to a schema that a team can trust. Students write the analytics queries of a small online shop.",
		classDays: [1, 3],
		classTime: "19:00",
		startInDays: -60,
		weeks: 12,
		seats: 16,
		students: 15,
		cohort: "running",
		modules: [
			{ title: "Select and filter", lessons: 4 },
			{ title: "Joins", lessons: 5 },
			{ title: "Aggregates and windows", lessons: 5 },
			{ title: "Schema design", lessons: 5 },
			{ title: "Indexes and speed", lessons: 4 },
			{ title: "Analytics project", lessons: 5 },
		],
		assignments: [
			{ title: "Query drills", kind: "quiz" },
			{ title: "Join lab", kind: "lab" },
			{ title: "Schema design review", kind: "project" },
			{ title: "Analytics queries project", kind: "project" },
		],
	},
	{
		id: "web-app-development",
		code: "DEV-220",
		title: "Web App Development",
		track: "development",
		level: "intermediate",
		instructorId: "ins-3",
		summary:
			"Components, state, data, and tests for a real web application. The capstone is a task board that each student ships.",
		classDays: [2, 4],
		classTime: "19:00",
		startInDays: -53,
		weeks: 12,
		seats: 18,
		students: 17,
		gradingDays: [7, 10],
		cohort: "running",
		modules: [
			{ title: "Components and props", lessons: 5 },
			{ title: "State and events", lessons: 5 },
			{ title: "Data fetching", lessons: 5 },
			{ title: "Routing", lessons: 4 },
			{ title: "Forms and validation", lessons: 4 },
			{ title: "Testing and release", lessons: 5 },
		],
		assignments: [
			{ title: "Component library lab", kind: "lab" },
			{ title: "Task board app", kind: "project" },
			{ title: "Data fetching quiz", kind: "quiz" },
			{ title: "Capstone app", kind: "project" },
		],
	},
	{
		id: "content-and-seo-strategy",
		code: "MKT-210",
		title: "Content and SEO Strategy",
		track: "marketing",
		level: "intermediate",
		instructorId: "ins-4",
		summary:
			"How to plan, write, and measure content that people find in search. Students audit one site and write its content plan.",
		classDays: [1, 4],
		classTime: "18:30",
		startInDays: -39,
		weeks: 10,
		seats: 14,
		students: 11,
		gradingDays: [6, 7],
		cohort: "running",
		modules: [
			{ title: "Search intent", lessons: 4 },
			{ title: "Keyword research", lessons: 4 },
			{ title: "Content planning", lessons: 5 },
			{ title: "Writing for the web", lessons: 5 },
			{ title: "Technical SEO basics", lessons: 4 },
			{ title: "Content audit", lessons: 4 },
		],
		assignments: [
			{ title: "Keyword map", kind: "lab" },
			{ title: "Editorial calendar", kind: "project" },
			{ title: "Long-form article", kind: "essay" },
			{ title: "Content audit report", kind: "project" },
		],
	},
	{
		id: "project-management-fundamentals",
		code: "BUS-101",
		title: "Project Management Fundamentals",
		track: "business",
		level: "beginner",
		instructorId: "ins-5",
		summary:
			"The tools of a first project lead: scope, plan, risk, and delivery. Every student runs one small project from start to end.",
		classDays: [6],
		classTime: "10:00",
		startInDays: -38,
		weeks: 10,
		seats: 20,
		students: 18,
		gradingDays: [6, 8],
		cohort: "running",
		modules: [
			{ title: "Scope and goals", lessons: 4 },
			{ title: "Planning and estimates", lessons: 5 },
			{ title: "Risk and change", lessons: 4 },
			{ title: "Teams and communication", lessons: 4 },
			{ title: "Agile delivery", lessons: 5 },
			{ title: "Closing a project", lessons: 3 },
		],
		assignments: [
			{ title: "Project charter", kind: "essay" },
			{ title: "Work breakdown and schedule", kind: "project" },
			{ title: "Risk register", kind: "lab" },
			{ title: "Retrospective report", kind: "essay" },
		],
	},
	{
		id: "dashboards-and-data-storytelling",
		code: "DAT-240",
		title: "Dashboards and Data Storytelling",
		track: "data",
		level: "intermediate",
		instructorId: "ins-2",
		summary:
			"Charts that people read and dashboards that people use. The course ends with a live presentation to a guest panel.",
		classDays: [2, 4],
		classTime: "18:30",
		startInDays: -18,
		weeks: 10,
		seats: 16,
		students: 13,
		cohort: "running",
		modules: [
			{ title: "The right chart for the question", lessons: 4 },
			{ title: "Dashboard layout", lessons: 4 },
			{ title: "Color and annotation", lessons: 4 },
			{ title: "Interactive filters", lessons: 5 },
			{ title: "Narrative structure", lessons: 4 },
			{ title: "Stakeholder presentation", lessons: 4 },
		],
		assignments: [
			{ title: "Chart critique", kind: "essay" },
			{ title: "Dashboard wireframe", kind: "project" },
			{ title: "Interactive dashboard", kind: "project" },
			{ title: "Insight presentation", kind: "project" },
		],
	},
	{
		id: "brand-identity-design",
		code: "UX-150",
		title: "Brand Identity Design",
		track: "design",
		level: "beginner",
		instructorId: "ins-7",
		summary:
			"A brand from strategy to guidelines. Students name a fictional company, draw its logo, and build its identity system.",
		classDays: [1, 3],
		classTime: "18:00",
		startInDays: -4,
		weeks: 10,
		seats: 14,
		students: 14,
		cohort: "running",
		modules: [
			{ title: "Brand strategy", lessons: 4 },
			{ title: "Naming and voice", lessons: 3 },
			{ title: "Logo design", lessons: 6 },
			{ title: "Color and type systems", lessons: 5 },
			{ title: "Brand guidelines", lessons: 4 },
			{ title: "Launch kit", lessons: 4 },
		],
		assignments: [
			{ title: "Brand strategy brief", kind: "essay" },
			{ title: "Logo explorations", kind: "project" },
			{ title: "Identity system", kind: "project" },
			{ title: "Brand guidelines book", kind: "project" },
		],
	},
	{
		id: "machine-learning-foundations",
		code: "DAT-310",
		title: "Machine Learning Foundations",
		track: "data",
		level: "advanced",
		instructorId: "ins-6",
		summary:
			"Regression, classification, and honest evaluation for analysts who know Python. Students train and report one model.",
		classDays: [1, 3],
		classTime: "19:00",
		startInDays: 6,
		weeks: 12,
		seats: 16,
		students: 12,
		cohort: "upcoming",
		modules: [
			{ title: "Framing a learning problem", lessons: 4 },
			{ title: "Regression", lessons: 5 },
			{ title: "Classification", lessons: 5 },
			{ title: "Model evaluation", lessons: 5 },
			{ title: "Feature engineering", lessons: 5 },
			{ title: "A model in production", lessons: 4 },
		],
		assignments: [
			{ title: "Problem framing memo", kind: "essay" },
			{ title: "Regression lab", kind: "lab" },
			{ title: "Classifier project", kind: "project" },
			{ title: "Model report", kind: "project" },
		],
	},
	{
		id: "back-end-api-development",
		code: "DEV-240",
		title: "Back-End API Development",
		track: "development",
		level: "intermediate",
		instructorId: "ins-3",
		summary:
			"Design, secure, test, and deploy a web API. The course follows Web App Development and uses the same task board.",
		classDays: [2, 4],
		classTime: "19:00",
		startInDays: 13,
		weeks: 12,
		seats: 16,
		students: 8,
		cohort: "upcoming",
		modules: [
			{ title: "HTTP and REST", lessons: 4 },
			{ title: "Routes and controllers", lessons: 5 },
			{ title: "Databases and queries", lessons: 5 },
			{ title: "Authentication", lessons: 5 },
			{ title: "Tests for an API", lessons: 4 },
			{ title: "Deploy and monitor", lessons: 4 },
		],
		assignments: [
			{ title: "Endpoint design quiz", kind: "quiz" },
			{ title: "CRUD service lab", kind: "lab" },
			{ title: "Secure API project", kind: "project" },
			{ title: "Deployed service", kind: "project" },
		],
	},
	{
		id: "leadership-for-new-managers",
		code: "BUS-210",
		title: "Leadership for New Managers",
		track: "business",
		level: "intermediate",
		instructorId: "ins-5",
		summary:
			"The first 90 days of a new team lead: one-to-one meetings, feedback, delegation, and hard conversations.",
		classDays: [6],
		classTime: "10:00",
		startInDays: 27,
		weeks: 8,
		seats: 12,
		students: 4,
		cohort: "upcoming",
		modules: [
			{ title: "From peer to manager", lessons: 3 },
			{ title: "One-to-one meetings", lessons: 4 },
			{ title: "Feedback and coaching", lessons: 4 },
			{ title: "Delegation", lessons: 3 },
			{ title: "Hard conversations", lessons: 4 },
			{ title: "Team goals", lessons: 4 },
		],
		assignments: [
			{ title: "Leadership self-review", kind: "essay" },
			{ title: "Coaching plan", kind: "project" },
			{ title: "Feedback practice notes", kind: "lab" },
			{ title: "Team charter", kind: "project" },
		],
	},
];

// Student i gets first name i and last name i, so no first name and no last name occurs two times.
const FIRST_NAMES = [
	"Amara",
	"Ben",
	"Chloe",
	"Diego",
	"Elif",
	"Farid",
	"Greta",
	"Hugo",
	"Ines",
	"Jamal",
	"Keiko",
	"Lars",
	"Mina",
	"Noah",
	"Olga",
	"Pablo",
	"Quinn",
	"Rosa",
	"Samir",
	"Tessa",
	"Umar",
	"Vera",
	"Wren",
	"Xavier",
	"Yara",
	"Zane",
	"Adele",
	"Bruno",
	"Carmen",
	"Dmitri",
	"Esme",
	"Felix",
	"Gia",
	"Hassan",
	"Ivy",
	"Jonas",
	"Kira",
	"Leon",
	"Maya",
	"Nico",
	"Odette",
	"Pavel",
	"Rhea",
	"Soren",
	"Talia",
	"Uri",
	"Vanya",
	"Wes",
	"Ximena",
	"Yusuf",
	"Zelda",
	"Anton",
	"Bianca",
	"Cyrus",
	"Dalia",
	"Emil",
	"Freya",
	"Gabriel",
	"Hana",
	"Idris",
	"Jade",
	"Kofi",
	"Lena",
	"Mateo",
	"Nadia",
	"Omar",
	"Petra",
	"Rafael",
	"Selma",
	"Theo",
	"Ula",
	"Viktor",
	"Willa",
	"Yan",
	"Zofia",
	"Aiden",
	"Beatriz",
	"Caleb",
	"Daphne",
	"Enzo",
	"Fatima",
	"Goran",
	"Helga",
	"Ilya",
	"June",
	"Kamal",
	"Lucia",
	"Milo",
	"Nora",
	"Otis",
	"Paloma",
	"Reza",
	"Signe",
	"Tariq",
	"Una",
	"Vito",
	"Wanda",
	"Yosef",
	"Zuri",
	"Arjun",
	"Bella",
	"Cedric",
	"Dara",
	"Elias",
	"Flora",
	"Gus",
	"Hilde",
	"Ivan",
	"Jia",
	"Kellan",
	"Lotte",
	"Marek",
	"Nell",
	"Oskar",
	"Pia",
	"Ravi",
	"Sunniva",
	"Tomas",
] as const;

const LAST_NAMES = [
	"Okafor",
	"Lindqvist",
	"Moreau",
	"Castillo",
	"Demir",
	"Rahimi",
	"Sorensen",
	"Bellamy",
	"Ferreira",
	"Whitaker",
	"Tanaka",
	"Nyberg",
	"Haddad",
	"Brennan",
	"Petrova",
	"Navarro",
	"Ashford",
	"Delgado",
	"Khoury",
	"Vandermeer",
	"Siddiqui",
	"Kowalski",
	"Hartwell",
	"Dubois",
	"Nasser",
	"Thornton",
	"Lambert",
	"Ricci",
	"Ortega",
	"Volkov",
	"Fairchild",
	"Bauer",
	"Romano",
	"Aziz",
	"Kensington",
	"Eklund",
	"Sato",
	"Fischer",
	"Patel",
	"Mancini",
	"Leclerc",
	"Novak",
	"Kapoor",
	"Halvorsen",
	"Benitez",
	"Shapiro",
	"Dragomir",
	"Holloway",
	"Vargas",
	"Celik",
	"Montague",
	"Sokolov",
	"Marino",
	"Farahani",
	"Qureshi",
	"Lindholm",
	"Asante",
	"Abbott",
	"Nakamura",
	"Bakr",
	"Whitlock",
	"Mensah",
	"Bergstrom",
	"Fuentes",
	"Salib",
	"Farouk",
	"Zeman",
	"Cardoso",
	"Yilmaz",
	"Rousseau",
	"Kalnins",
	"Horvat",
	"Pemberton",
	"Zhou",
	"Wisniewski",
	"Calloway",
	"Santos",
	"Winslow",
	"Pappas",
	"Ferrand",
	"Mansour",
	"Jovanovic",
	"Rasmussen",
	"Morozov",
	"Ellery",
	"Chaudhry",
	"Bianchi",
	"Stratton",
	"Lund",
	"Greaves",
	"Iglesias",
	"Tehrani",
	"Dahl",
	"Osei",
	"Madsen",
	"Costa",
	"Kaplan",
	"Abara",
	"Sandoval",
	"Okeke",
	"Mehta",
	"Rossi",
	"Laurent",
	"Byrne",
	"Amini",
	"Carvalho",
	"Pike",
	"Solberg",
	"Kuznetsov",
	"Lin",
	"Marsh",
	"Jansen",
	"Kral",
	"Whitby",
	"Lindahl",
	"Voss",
	"Menon",
	"Aldana",
] as const;

// Messages that a student adds to a submission.
const STUDENT_NOTES = [
	"I added a short walkthrough at the end of the file.",
	"The second part took longer than I planned. Feedback on the structure is welcome.",
	"I used the data set from week 3.",
	"I was not sure about the last question, so I explained my reasoning.",
	"Two versions are inside. The second one is the direction that I prefer.",
	"I tested this with three colleagues before I sent it.",
	"The appendix lists my sources.",
	"I kept the scope small to finish on time.",
] as const;

// Comments of the instructor, by grade band: 90 and more, 80 to 89, 70 to 79, and under 70.
const FEEDBACK_BANDS = [
	{
		from: 90,
		lines: [
			"Excellent work. The structure is clear and every choice has a reason.",
			"A strong result. You can use this as a portfolio piece.",
			"Very complete. The detail in the last section stands out.",
		],
	},
	{
		from: 80,
		lines: [
			"Good work. Tighten the summary and it becomes excellent.",
			"A solid result. The second part needs one more example.",
			"Clear and well organized. Check the edge cases next time.",
		],
	},
	{
		from: 70,
		lines: [
			"A fair result. The idea is right, but the argument needs more evidence.",
			"You met the brief. Spend more time on the review step.",
			"A good start. The final section is too short.",
		],
	},
	{
		from: 0,
		lines: [
			"The basics are here, but key parts are missing. Book a session with me.",
			"Read the brief again and send a revision.",
			"This needs more work. Start from the checklist of week 2.",
		],
	},
] as const;

// Where each assignment falls in its course, as a share of the course length.
const ASSIGNMENT_DUE_SHARES = [0.27, 0.52, 0.76, 0.98] as const;

// The student numbers of each pool, as [from, to) ranges. A student is in one course of a pool at most.
// Students 6 to 15 are only in finished courses. Students 0 to 5 finished a course and return for one that starts soon.
// The second pool has 60 students for its 5 courses of 12. Students 74 to 97 also take a running course.
const STUDENT_POOLS = {
	first: [{ from: 0, to: 43 }],
	second: [
		{ from: 20, to: 56 },
		{ from: 74, to: 98 },
	],
	running: [{ from: 16, to: 118 }],
	upcoming: [
		{ from: 0, to: 6 },
		{ from: 56, to: 74 },
	],
} as const satisfies Record<Cohort, { from: number; to: number }[]>;

// Most instructors grade 2 to 6 days after a submission. Three running courses are slower, so the queue mixes courses.
const DEFAULT_GRADING_DAYS = [2, 6] as const;
// Enrollment opens 30 days before the first day of a course.
const ENROLLMENT_WINDOW_DAYS = 30;
// A student can still finish lessons for 7 days after the last day of a course.
const GRACE_DAYS = 7;
// A fixed seed gives the same rows for the whole day, so the numbers do not jump between loads.
const SEED = 20_260;

// mulberry32: a small generator with a 32-bit state. It returns a number from 0 to 1, 1 not included.
function createRandom(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
		mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
		return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
	};
}

// The item at `index`, counted in a circle. Every list of this file has items, so an empty list is a code error.
function cycle<Item>(items: readonly Item[], index: number): Item {
	const item = items[index % items.length];
	if (item === undefined) {
		throw new Error("sample-data: the list is empty");
	}
	return item;
}

// The numbers `from` to `to - 1`.
function range(from: number, to: number): number[] {
	return Array.from({ length: to - from }, (_, index) => from + index);
}

/** The count of lessons of a course: the sum over its modules. */
export function lessonCountOf(course: Pick<CourseRow, "modules">): number {
	return course.modules.reduce((sum, module) => sum + module.lessons, 0);
}

// Builds every table for the day of `now`. It reads only the start of that day, never the hour:
// the hour must not change which random numbers a row gets.
function buildSampleTables(now: number): SampleTables {
	const random = createRandom(SEED);
	const between = (min: number, max: number) => min + random() * (max - min);
	const today = startOfLocalDay(now);
	// A time `days` calendar days from today, `hours` after midnight. setDate keeps the day across a clock change.
	const at = (days: number, hours = 0) => {
		const date = new Date(today);
		date.setDate(date.getDate() + days);
		return (
			date.getTime() + Math.round((hours * HOUR_MS) / MINUTE_MS) * MINUTE_MS
		);
	};
	const iso = (ms: number) => new Date(ms).toISOString();
	// Fisher-Yates with the seeded generator.
	const shuffle = (items: number[]) => {
		const result = [...items];
		for (let index = result.length - 1; index > 0; index -= 1) {
			const other = Math.floor(random() * (index + 1));
			const item = cycle(result, index);
			result[index] = cycle(result, other);
			result[other] = item;
		}
		return result;
	};

	const studentNames = FIRST_NAMES.map(
		(first, index) => `${first} ${cycle(LAST_NAMES, index)}`,
	);
	// How well each student does graded work, as the usual grade in points.
	const ability = studentNames.map(() => between(62, 96));

	const courses: CourseRow[] = COURSES.map((seed) => ({
		id: seed.id,
		code: seed.code,
		title: seed.title,
		track: seed.track,
		level: seed.level,
		instructorId: seed.instructorId,
		summary: seed.summary,
		classDays: seed.classDays,
		classTime: seed.classTime,
		startAt: iso(at(seed.startInDays)),
		endAt: iso(at(seed.startInDays + seed.weeks * 7) - MINUTE_MS),
		seats: seed.seats,
		modules: seed.modules,
	}));

	// Each group of courses takes its students from its own shuffled pool, so no student is in a course two times.
	const poolOf = (cohort: Cohort) =>
		shuffle(STUDENT_POOLS[cohort].flatMap((pool) => range(pool.from, pool.to)));
	const pools = {
		first: poolOf("first"),
		second: poolOf("second"),
		running: poolOf("running"),
		upcoming: poolOf("upcoming"),
	} satisfies Record<Cohort, number[]>;

	const enrollments: EnrollmentRow[] = [];
	const lessonCompletions: LessonCompletionRow[] = [];
	const assignments: AssignmentRow[] = [];
	const submissions: SubmissionRow[] = [];
	const firstEnrollment = new Map<number, number>();

	for (const seed of COURSES) {
		const lengthDays = seed.weeks * 7;
		const lessonCount = lessonCountOf(seed);
		const hasEnded = seed.startInDays + lengthDays <= 0;
		const hasStarted = seed.startInDays <= 0;
		const members = pools[seed.cohort].splice(0, seed.students);

		const courseAssignments = seed.assignments.map((assignment, index) => {
			const dueInDays =
				seed.startInDays +
				Math.floor(cycle(ASSIGNMENT_DUE_SHARES, index) * lengthDays);
			const row: AssignmentRow = {
				id: `asg-${String(assignments.length + 1).padStart(2, "0")}`,
				courseId: seed.id,
				title: assignment.title,
				kind: assignment.kind,
				// 23:59 on the due day.
				dueAt: iso(at(dueInDays + 1) - MINUTE_MS),
				maxPoints: 100,
			};
			assignments.push(row);
			return { row, dueInDays };
		});

		for (const studentIndex of members) {
			// About one student in six falls behind: slow in a running course, and an early stop in a finished one.
			const isBehind = random() < (hasEnded ? 0.12 : 0.16);
			// An on-track student is up to 5 days late on a lesson, so the newest one or two lessons differ between students.
			const lagDays = isBehind ? between(12, 22) : between(0.3, 5);
			const stopAfterLesson = isBehind
				? Math.floor(lessonCount * between(0.45, 0.82))
				: lessonCount;

			// Most students sign up before the first day. A few join in the first 3 days.
			// For a course that starts soon, the sign-ups grow as the first day comes near: the power puts more of them in the last days.
			const enrolledInDays = hasStarted
				? random() < 0.12
					? seed.startInDays + Math.floor(between(0, 4))
					: seed.startInDays - Math.floor(between(2, 30))
				: -Math.floor(
						random() ** 1.5 *
							Math.max(1, ENROLLMENT_WINDOW_DAYS - seed.startInDays + 1),
					);
			const enrolledAt = at(enrolledInDays, between(8, 21));
			const studentId = `stu-${String(studentIndex + 1).padStart(3, "0")}`;
			enrollments.push({
				id: `enr-${String(enrollments.length + 1).padStart(3, "0")}`,
				studentId,
				courseId: seed.id,
				enrolledAt: iso(enrolledAt),
			});
			firstEnrollment.set(
				studentIndex,
				Math.min(firstEnrollment.get(studentIndex) ?? enrolledAt, enrolledAt),
			);

			// Lesson k is released at midnight of its day. The student finishes it some days later.
			let previousAt = enrolledAt;
			for (let lesson = 0; lesson < lessonCount; lesson += 1) {
				const releasedInDays =
					seed.startInDays + Math.floor((lesson * lengthDays) / lessonCount);
				if (releasedInDays > 0 || (hasEnded && lesson >= stopAfterLesson)) {
					break;
				}
				let doneInDays =
					releasedInDays + Math.floor(lagDays * between(0.7, 1.3));
				// Fewer students study on Saturday and Sunday: 4 in 10 wait for Monday or Tuesday.
				const weekday = new Date(at(doneInDays)).getDay();
				if ((weekday === 0 || weekday === 6) && random() < 0.4) {
					doneInDays += (weekday === 6 ? 2 : 1) + Math.floor(between(0, 2));
				}
				// Evening is the study time of most students with a job.
				const hour = random() < 0.6 ? between(17.5, 22.5) : between(7, 17.5);
				// A late joiner catches up after the enrollment. Lessons stay in order, at least 25 minutes apart.
				const completedAt = Math.max(
					at(doneInDays, hour),
					previousAt + 25 * MINUTE_MS,
				);
				if (completedAt > at(seed.startInDays + lengthDays + GRACE_DAYS)) {
					break;
				}
				previousAt = completedAt;
				lessonCompletions.push({
					studentId,
					courseId: seed.id,
					lesson: lesson + 1,
					completedAt: iso(completedAt),
				});
			}

			for (const { row, dueInDays } of courseAssignments) {
				// Students send their work in the 4 days before the due day, or up to 3 days late.
				const isLate = random() < (isBehind ? 0.5 : 0.1);
				const submittedInDays = isLate
					? dueInDays + 1 + Math.floor(between(0, 3))
					: dueInDays - Math.floor(between(0, 4));
				const hasSubmission = random() < (isBehind ? 0.6 : 0.96);
				const submittedAt = at(submittedInDays, between(8, 23.5));
				const [fewestDays, mostDays] = seed.gradingDays ?? DEFAULT_GRADING_DAYS;
				const gradedInDays =
					submittedInDays +
					fewestDays +
					Math.floor(between(0, mostDays - fewestDays + 1));
				const points = Math.min(
					100,
					Math.max(
						38,
						Math.round(
							cycle(ability, studentIndex) +
								between(-10, 8) -
								(isLate ? 3 : 0) -
								(isBehind ? 6 : 0),
						),
					),
				);
				const note =
					random() < 0.45
						? cycle(STUDENT_NOTES, Math.floor(between(0, STUDENT_NOTES.length)))
						: null;
				const feedbackIndex = Math.floor(between(0, 3));
				const gradedHour = between(9, 18);
				if (!hasSubmission || submittedInDays > 0 || submittedAt < enrolledAt) {
					continue;
				}
				// A grade never has a time of today: the queue of the day stays the same from morning to evening.
				const isGraded = gradedInDays < 0;
				const band =
					FEEDBACK_BANDS.find((item) => points >= item.from) ??
					cycle(FEEDBACK_BANDS, FEEDBACK_BANDS.length - 1);
				submissions.push({
					id: `sub-${String(submissions.length + 1).padStart(4, "0")}`,
					assignmentId: row.id,
					studentId,
					submittedAt: iso(submittedAt),
					note,
					gradedAt: isGraded ? iso(at(gradedInDays, gradedHour)) : null,
					points: isGraded ? points : null,
					feedback: isGraded ? cycle(band.lines, feedbackIndex) : null,
				});
			}
		}
	}

	const students: StudentRow[] = studentNames.flatMap((name, index) => {
		const joinedAt = firstEnrollment.get(index);
		// A name with no enrollment is not a student of the school.
		return joinedAt === undefined
			? []
			: [
					{
						id: `stu-${String(index + 1).padStart(3, "0")}`,
						name,
						email: `${name.toLowerCase().replace(" ", ".")}@campusmail.example`,
						joinedAt: iso(joinedAt),
					},
				];
	});

	return {
		instructors: INSTRUCTORS,
		courses,
		students,
		enrollments,
		lessonCompletions,
		assignments,
		submissions,
	};
}

// The tables of one day. A reload on the same day builds the same rows.
let cached: { day: number; tables: SampleTables } | null = null;

/**
 * The sample tables as they are at `now` (milliseconds since 1970). Every query file calls it, so all pages see the same rows.
 * A row of today whose time is after `now` does not exist yet, so no row has a time in the future.
 */
export function getSampleTables(now: number): SampleTables {
	const day = startOfLocalDay(now);
	if (cached?.day !== day) {
		cached = { day, tables: buildSampleTables(now) };
	}
	const { tables } = cached;
	const isPast = (timestamp: string) => Date.parse(timestamp) <= now;
	return {
		...tables,
		students: tables.students.filter((row) => isPast(row.joinedAt)),
		enrollments: tables.enrollments.filter((row) => isPast(row.enrolledAt)),
		lessonCompletions: tables.lessonCompletions.filter((row) =>
			isPast(row.completedAt),
		),
		submissions: tables.submissions.filter((row) => isPast(row.submittedAt)),
	};
}
