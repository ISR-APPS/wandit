// Reads of time off: the request list, the days-off series and breakdown, the two-week planner, and the figures.
// The time-off and overview routes prefetch them in their loaders. The pages read them with useSuspenseQuery.
// Each queryFn reads the sample tables of the people feature. A later turn replaces it with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import {
	absenceDays,
	type BreakdownSlice,
	buildCategorySeries,
	buildDailySeries,
	type CategoryPoint,
	changeRatio,
	type Department,
	fullName,
	isWeekend,
	type KpiItem,
	type LeaveBalance,
	leaveBalance,
	periodDayKeys,
	readPeopleTables,
	shiftDays,
	TIME_OFF_TYPES,
	type TimeOffRequestRow,
	type TimeOffType,
	toDayKey,
	workingDayKeys,
} from "~/features/people";
import type { TranslationKey } from "~/shared/i18n";

// Department of each employee id, for the breakdowns.
function departmentsById(): Map<string, Department> {
	return new Map(
		readPeopleTables().employees.map((employee) => [
			employee.id,
			employee.department,
		]),
	);
}

/** One request with the names that the list shows. */
export type TimeOffRequest = TimeOffRequestRow & {
	employeeName: string;
	employeeTitle: string;
	department: Department;
	/** The name of the person in `decidedById`, or null while pending. */
	decidedByName: string | null;
};

/** Every request, newest request first. The list page filters, searches, sorts, and pages them in the browser. */
export function timeOffRequestsQueryOptions() {
	return queryOptions({
		queryKey: ["time-off", "requests"],
		queryFn: async (): Promise<TimeOffRequest[]> => {
			const { employees, requests } = readPeopleTables();
			const byId = new Map(
				employees.map((employee) => [employee.id, employee]),
			);
			// LIMIT: every row of about 900, paged in the browser. Upgrade: server paging (tables-paging.md).
			return requests
				.flatMap((request) => {
					const employee = byId.get(request.employeeId);
					if (!employee) {
						return [];
					}
					const decidedBy = request.decidedById
						? byId.get(request.decidedById)
						: null;
					return [
						{
							...request,
							employeeName: fullName(employee),
							employeeTitle: employee.title,
							department: employee.department,
							decidedByName: decidedBy ? fullName(decidedBy) : null,
						},
					];
				})
				.reverse();
		},
	});
}

/** One person who is also off during a request, for the overlap list of the request dialog. */
export type OverlapPerson = {
	employeeId: string;
	name: string;
	type: TimeOffType;
	startDate: string;
	endDate: string;
};

/** The detail of one request: the vacation balance of the person and the teammates off on the same days. */
export type TimeOffRequestDetail = {
	balance: LeaveBalance;
	/** People of the same department with an approved or pending request on at least one of the days. */
	overlaps: OverlapPerson[];
};

/** The detail panel data of one request, or null when the id does not exist. The dialog reads it after a click. */
export function timeOffRequestDetailQueryOptions(requestId: string) {
	return queryOptions({
		queryKey: ["time-off", "detail", requestId],
		queryFn: async (): Promise<TimeOffRequestDetail | null> => {
			const { employees, requests, dayStart } = readPeopleTables();
			const request = requests.find((row) => row.id === requestId);
			const employee = employees.find((row) => row.id === request?.employeeId);
			if (!request || !employee) {
				return null;
			}
			const days = new Set(workingDayKeys(request.startDate, request.endDate));
			const overlaps = requests.flatMap((other) => {
				const colleague = employees.find((row) => row.id === other.employeeId);
				const isRelevant =
					other.id !== request.id &&
					other.employeeId !== request.employeeId &&
					(other.status === "approved" || other.status === "pending") &&
					colleague?.department === employee.department &&
					other.startDate <= request.endDate &&
					other.endDate >= request.startDate &&
					workingDayKeys(other.startDate, other.endDate).some((day) =>
						days.has(day),
					);
				return isRelevant && colleague
					? [
							{
								employeeId: colleague.id,
								name: fullName(colleague),
								type: other.type,
								startDate: other.startDate,
								endDate: other.endDate,
							},
						]
					: [];
			});
			return { balance: leaveBalance(employee, requests, dayStart), overlaps };
		},
	});
}

/** Person-days off per day and type for the last `days` full days. Feeds the stacked trend. */
export function absenceByTypeQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["time-off", "by-type", days],
		queryFn: async (): Promise<CategoryPoint<TimeOffType>[]> => {
			const { requests, dayStart } = readPeopleTables();
			return buildCategorySeries(
				absenceDays(requests, departmentsById()),
				TIME_OFF_TYPES,
				days,
				dayStart,
			);
		},
	});
}

/** Person-days off per day for the last `days` full days and the period before. Feeds the totals and the deltas. */
export function dailyAbsenceQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["time-off", "daily", days],
		queryFn: async () => {
			const { requests, dayStart } = readPeopleTables();
			return buildDailySeries(
				absenceDays(requests, departmentsById()),
				days,
				dayStart,
			);
		},
	});
}

/** A department code, or "other" for the parts after the four largest. */
export type DepartmentSlice = BreakdownSlice<Department | "other">;

// The digest ranks 3 to 5 parts: the 4 largest, then "other". A single rest part keeps its own name.
const MAX_SLICES = 4;

/** Person-days off by department in the last `days` full days, largest first. Feeds the ranked list. */
export function absenceByDepartmentQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["time-off", "by-department", days],
		queryFn: async (): Promise<DepartmentSlice[]> => {
			const { requests, dayStart } = readPeopleTables();
			const inPeriod = new Set(periodDayKeys(days, dayStart));
			const sums = new Map<Department, number>();
			for (const day of absenceDays(requests, departmentsById())) {
				if (inPeriod.has(day.day)) {
					sums.set(day.department, (sums.get(day.department) ?? 0) + 1);
				}
			}
			const sorted = [...sums.entries()]
				.map(([label, value]) => ({ label, value }))
				.sort((first, second) => second.value - first.value);
			const other = sorted
				.slice(MAX_SLICES)
				.reduce((sum, slice) => sum + slice.value, 0);
			return sorted.length > MAX_SLICES + 1
				? [...sorted.slice(0, MAX_SLICES), { label: "other", value: other }]
				: sorted;
		},
	});
}

// The planner shows two weeks from today.
const PLANNER_DAYS = 14;

/** One leave on the planner: the first and last column (0 is today), the type, and the request status. */
export type PlannerSpan = {
	requestId: string;
	from: number;
	to: number;
	type: TimeOffType;
	isPending: boolean;
};

/** One row of the planner: a person and the leaves in the two weeks. */
export type PlannerRow = {
	employeeId: string;
	name: string;
	title: string;
	spans: PlannerSpan[];
};

/** The two-week planner: the 14 day keys from today, and one row per person with an approved or pending leave. */
export type Planner = { days: string[]; rows: PlannerRow[] };

/** Who is out in the next two weeks, earliest leave first. The time-off page draws it as a grid. */
export function plannerQueryOptions() {
	return queryOptions({
		queryKey: ["time-off", "planner"],
		queryFn: async (): Promise<Planner> => {
			const { employees, requests, dayStart } = readPeopleTables();
			const days = Array.from({ length: PLANNER_DAYS }, (_, index) =>
				toDayKey(shiftDays(dayStart, index)),
			);
			const first = days[0] ?? "";
			const last = days[days.length - 1] ?? "";
			const rows = new Map<string, PlannerRow>();
			for (const request of requests) {
				const isShown =
					(request.status === "approved" || request.status === "pending") &&
					request.startDate <= last &&
					request.endDate >= first;
				const employee = employees.find((row) => row.id === request.employeeId);
				if (!isShown || !employee) {
					continue;
				}
				const row = rows.get(employee.id) ?? {
					employeeId: employee.id,
					name: fullName(employee),
					title: employee.title,
					spans: [],
				};
				// A leave that started before today begins at column 0; one that ends later stops at the last column.
				const end = days.indexOf(request.endDate);
				row.spans.push({
					requestId: request.id,
					from: request.startDate < first ? 0 : days.indexOf(request.startDate),
					to: end === -1 ? PLANNER_DAYS - 1 : end,
					type: request.type,
					isPending: request.status === "pending",
				});
				rows.set(employee.id, row);
			}
			const sorted = [...rows.values()].sort(
				(a, b) =>
					Math.min(...a.spans.map((span) => span.from)) -
						Math.min(...b.spans.map((span) => span.from)) ||
					a.name.localeCompare(b.name),
			);
			return { days, rows: sorted };
		},
	});
}

/** One figure before translation. The page turns `labelKey` into the `label` of KpiItem with t(). */
export type TimeOffKpi = Omit<KpiItem, "label" | "note"> & {
	labelKey: TranslationKey;
	/** The key of the scope line of a figure with no delta. The page turns it into `note`. */
	noteKey?: TranslationKey;
};

// The sick-day figure compares 30 days with the 30 days before.
const SICK_PERIOD_DAYS = 30;
// The booked-days figure looks 30 days ahead.
const BOOKED_AHEAD_DAYS = 30;

/** The four figures of the time-off page: out on the next working day, to review, booked days ahead, and sick days. */
export function timeOffKpisQueryOptions() {
	return queryOptions({
		queryKey: ["time-off", "kpis"],
		queryFn: async (): Promise<TimeOffKpi[]> => {
			const { requests, dayStart } = readPeopleTables();
			const today = toDayKey(new Date(dayStart));
			// Nobody works on a weekend. Then "out" counts the next working day, a Monday.
			let workdayOffset = 0;
			while (isWeekend(shiftDays(dayStart, workdayOffset))) {
				workdayOffset += 1;
			}
			const workday = toDayKey(shiftDays(dayStart, workdayOffset));
			const aheadEnd = toDayKey(shiftDays(dayStart, BOOKED_AHEAD_DAYS - 1));
			const approved = requests.filter(
				(request) => request.status === "approved",
			);
			const outOnWorkday = new Set(
				approved
					.filter(
						(request) =>
							request.startDate <= workday && request.endDate >= workday,
					)
					.map((request) => request.employeeId),
			).size;
			const bookedDays = approved
				.flatMap((request) =>
					workingDayKeys(request.startDate, request.endDate),
				)
				.filter((day) => day >= today && day <= aheadEnd).length;
			const sick = buildDailySeries(
				absenceDays(
					requests.filter((request) => request.type === "sick"),
					departmentsById(),
				),
				SICK_PERIOD_DAYS,
				dayStart,
			);
			const sickNow = sick.reduce((sum, point) => sum + point.current, 0);
			const sickBefore = sick.reduce((sum, point) => sum + point.previous, 0);
			return [
				// The database keeps no history of who was out, so these three show no delta.
				{
					id: "out-today",
					labelKey:
						workdayOffset === 0
							? "timeOff.kpiOutToday"
							: "timeOff.kpiOutMonday",
					noteKey: "timeOff.kpiOutNote",
					value: outOnWorkday,
					change: null,
					goodWhen: "down",
				},
				{
					id: "to-review",
					labelKey: "timeOff.kpiToReview",
					noteKey: "timeOff.kpiToReviewNote",
					value: requests.filter((request) => request.status === "pending")
						.length,
					change: null,
					goodWhen: "down",
				},
				{
					id: "booked-days",
					labelKey: "timeOff.kpiBooked",
					noteKey: "timeOff.kpiBookedNote",
					value: bookedDays,
					change: null,
					goodWhen: "up",
				},
				{
					id: "sick-days",
					labelKey: "timeOff.kpiSick",
					value: sickNow,
					change: changeRatio(sickNow, sickBefore),
					goodWhen: "down",
				},
			];
		},
	});
}
