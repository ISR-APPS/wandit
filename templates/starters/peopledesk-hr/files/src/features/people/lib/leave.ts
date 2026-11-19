// Leave math on the request rows: the working days of a request, the days off per day for the charts,
// and the vacation balance of one employee for the calendar year. It also holds the display name of a person.
// The query files of the employees, time-off, and overview pages call these pure functions.
import type { Department, TimeOffType } from "./codes";
import type { EmployeeRow, TimeOffRequestRow } from "./sample-data";
import { dayKeyToMs, isWeekend, toDayKey } from "./time";

/** The working days (Monday to Friday) from `startDate` to `endDate`, both YYYY-MM-DD and both included. */
export function workingDayKeys(startDate: string, endDate: string): string[] {
	const keys: string[] = [];
	const date = new Date(dayKeyToMs(startDate));
	const last = dayKeyToMs(endDate);
	while (date.getTime() <= last) {
		if (!isWeekend(date)) {
			keys.push(toDayKey(date));
		}
		date.setDate(date.getDate() + 1);
	}
	return keys;
}

/** One person-day off: the day, the type, and the department of the person. The value is always 1. */
export type AbsenceDay = {
	/** YYYY-MM-DD, a working day. */
	day: string;
	value: number;
	category: TimeOffType;
	department: Department;
	employeeId: string;
};

/**
 * Every person-day off of the approved requests. Pending, declined, and cancelled requests give no day off.
 * `departmentOf` maps an employee id to its department.
 */
export function absenceDays(
	requests: TimeOffRequestRow[],
	departmentOf: Map<string, Department>,
): AbsenceDay[] {
	return requests
		.filter((request) => request.status === "approved")
		.flatMap((request) => {
			const department = departmentOf.get(request.employeeId);
			if (!department) {
				return [];
			}
			return workingDayKeys(request.startDate, request.endDate).map((day) => ({
				day,
				value: 1,
				category: request.type,
				department,
				employeeId: request.employeeId,
			}));
		});
}

/** The vacation balance of one employee for the current calendar year, in working days. */
export type LeaveBalance = {
	/** The allowance of the year: the yearly allowance, pro rata from a start date in this year. */
	allowance: number;
	/** Approved days off before today. */
	taken: number;
	/** Approved days off from today on. */
	booked: number;
	/** Days of requests that wait for the manager. */
	pending: number;
	/** allowance - taken - booked. It can be negative after an exception. */
	remaining: number;
};

/** The vacation balance of `employee` for the calendar year of `dayStart`. Only the vacation type uses the allowance. */
export function leaveBalance(
	employee: EmployeeRow,
	requests: TimeOffRequestRow[],
	dayStart: number,
): LeaveBalance {
	const today = toDayKey(new Date(dayStart));
	const year = today.slice(0, 4);
	const yearStart = new Date(Number(year), 0, 1).getTime();
	const yearEnd = new Date(Number(year) + 1, 0, 1).getTime();
	const startMs = Math.max(yearStart, dayKeyToMs(employee.startDate));
	// A person who joined this year gets the share of the year from the start date.
	const allowance = Math.round(
		(employee.annualAllowance * (yearEnd - startMs)) / (yearEnd - yearStart),
	);
	let taken = 0;
	let booked = 0;
	let pending = 0;
	for (const request of requests) {
		if (request.employeeId !== employee.id || request.type !== "vacation") {
			continue;
		}
		const days = workingDayKeys(request.startDate, request.endDate).filter(
			(day) => day.startsWith(year),
		);
		if (request.status === "pending") {
			pending += days.length;
		} else if (request.status === "approved") {
			taken += days.filter((day) => day < today).length;
			booked += days.filter((day) => day >= today).length;
		}
	}
	return {
		allowance,
		taken,
		booked,
		pending,
		remaining: allowance - taken - booked,
	};
}

/** "Amara Okafor": the full name of an employee as the lists show it. */
export function fullName(
	employee: Pick<EmployeeRow, "firstName" | "lastName">,
): string {
	return `${employee.firstName} ${employee.lastName}`;
}
