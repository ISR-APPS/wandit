// The sample schedules and notes of the Reports page, and the writes of this browser session.
// Only api/reports.queries.ts and api/reports.mutations.ts read and change them.
// A later turn replaces them with two tables (`report_schedules`, `report_notes`) and deletes this file.
// LIMIT: a write lives in memory until the page reloads. Upgrade: the two tables of STARTER.md.
import { HOUR_MS, startOfLocalDay } from "~/features/tracking";
import type { Frequency, ReportKind, ScheduleInput } from "./schedule-schema";

/** One schedule: a report that goes out by email on a fixed rhythm. */
export type ReportSchedule = {
	id: string;
	kind: ReportKind;
	recipientName: string;
	recipientEmail: string;
	frequency: Frequency;
	/** 1 (Monday) to 5 (Friday). Only a weekly schedule reads it. */
	weekday: number;
	/** The hour of the day in the time zone of the browser, 0 to 23. */
	hour: number;
};

/** One note of the team thread of the Reports page. */
export type ReportNote = {
	id: string;
	/** The teammate that wrote it, or null for the signed-in user. */
	authorName: string | null;
	text: string;
	/** ISO time of the note. */
	at: string;
};

/** The teammate of the notes thread. A fictional person with a mail address on example.com. */
export const NOTES_TEAMMATE = {
	name: "Noor Haddad",
	email: "noor.haddad@example.com",
};

const schedules: ReportSchedule[] = [
	{
		id: "schedule-1",
		kind: "signUps",
		recipientName: "Noor Haddad",
		recipientEmail: "noor.haddad@example.com",
		frequency: "weekly",
		weekday: 1,
		hour: 8,
	},
	{
		id: "schedule-2",
		kind: "retention",
		recipientName: "Tomas Lindqvist",
		recipientEmail: "tomas.lindqvist@example.com",
		frequency: "monthly",
		weekday: 1,
		hour: 9,
	},
	{
		id: "schedule-3",
		kind: "activeUsers",
		recipientName: "Aiko Mori",
		recipientEmail: "aiko.mori@example.com",
		frequency: "daily",
		weekday: 1,
		hour: 7,
	},
];

// The seed thread, as hours before the midnight of today: all of it is yesterday, so it is always in the past.
const SEED_NOTES = [
	{
		hoursBefore: 15,
		authorName: NOTES_TEAMMATE.name,
		text: "I moved the sign-ups email to Monday at 8:00.",
	},
	{
		hoursBefore: 14.5,
		authorName: null,
		text: "Good. Can the retention report go to the product team too?",
	},
	{
		hoursBefore: 7,
		authorName: NOTES_TEAMMATE.name,
		text: "Done. It goes out on the first day of each month.",
	},
	{
		hoursBefore: 6.5,
		authorName: null,
		text: "Thanks. I will check the next one.",
	},
];

const sessionNotes: ReportNote[] = [];

/** Every schedule: the samples, then the ones of this session. A copy, so a caller cannot change the store. */
export function listSchedules(): ReportSchedule[] {
	return schedules.map((schedule) => ({ ...schedule }));
}

/** Adds a schedule from a parsed form. */
export function addSchedule(input: ScheduleInput): ReportSchedule {
	const schedule = { id: `schedule-${schedules.length + 1}`, ...input };
	schedules.push(schedule);
	return schedule;
}

/** Sets the rhythm of one schedule. An unknown id is a bug of the caller, so it throws. */
export function setScheduleFrequency(id: string, frequency: Frequency): void {
	const schedule = schedules.find((item) => item.id === id);
	if (!schedule) {
		throw new Error(`sample-reports: no schedule ${id}`);
	}
	schedule.frequency = frequency;
}

/** The thread, the oldest note first. The seed notes are relative to the midnight of today. */
export function listNotes(): ReportNote[] {
	const todayStart = startOfLocalDay(Date.now());
	return [
		...SEED_NOTES.map((note, index) => ({
			id: `note-${index + 1}`,
			authorName: note.authorName,
			text: note.text,
			at: new Date(todayStart - note.hoursBefore * HOUR_MS).toISOString(),
		})),
		...sessionNotes,
	];
}

/** Adds a note of the signed-in user, now. */
export function addNote(text: string): ReportNote {
	const note = {
		id: `note-session-${sessionNotes.length + 1}`,
		authorName: null,
		text,
		at: new Date().toISOString(),
	};
	sessionNotes.push(note);
	return note;
}
