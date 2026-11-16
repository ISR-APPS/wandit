// Reads of employees: the directory, one profile with its leave and career, and the figures of the list page.
// The employee routes prefetch them in their loaders. The pages read them with useSuspenseQuery.
// Each queryFn reads the sample tables of the people feature. A later turn replaces it with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import {
	type CareerEventRow,
	changeRatio,
	type EmployeeRow,
	type EmployeeStatus,
	fullName,
	isWeekend,
	type KpiItem,
	type LeaveBalance,
	leaveBalance,
	readPeopleTables,
	shiftDays,
	type TimeOffRequestRow,
	type TimeOffType,
	toDayKey,
} from "~/features/people";
import type { TranslationKey } from "~/shared/i18n";

/** One employee as the directory shows it. */
export type EmployeeListItem = EmployeeRow & {
	name: string;
	/** Vacation days left this calendar year. */
	vacationLeft: number;
	/** The type of an approved leave that covers today. null when the person works today, and on a weekend. */
	offTodayType: TimeOffType | null;
};

/** Every employee, in the order of the org chart. The list page filters, searches, sorts, and pages them. */
export function employeesQueryOptions() {
	return queryOptions({
		queryKey: ["employees", "list"],
		queryFn: async (): Promise<EmployeeListItem[]> => {
			const { employees, requests, dayStart } = readPeopleTables();
			const today = toDayKey(new Date(dayStart));
			// Nobody works on a weekend, so nobody is "off" then.
			const isWorkday = !isWeekend(new Date(dayStart));
			return employees.map((employee) => {
				const offToday = requests.find(
					(request) =>
						isWorkday &&
						request.employeeId === employee.id &&
						request.status === "approved" &&
						request.startDate <= today &&
						request.endDate >= today,
				);
				return {
					...employee,
					name: fullName(employee),
					vacationLeft: leaveBalance(employee, requests, dayStart).remaining,
					offTodayType: offToday?.type ?? null,
				};
			});
		},
	});
}

/** A short card of another person on the profile: the manager or a direct report. */
export type PersonLink = {
	id: string;
	name: string;
	title: string;
	status: EmployeeStatus;
};

/** Everything that the profile page shows about one employee. */
export type EmployeeProfile = {
	employee: EmployeeRow;
	name: string;
	manager: PersonLink | null;
	/** The people who report to this employee, by name. */
	reports: PersonLink[];
	/** The time-off requests of the employee, the latest first day first. */
	requests: TimeOffRequestRow[];
	/** The career events, newest first. */
	careerEvents: CareerEventRow[];
	balance: LeaveBalance;
};

// The card of a person for the profile links.
function toPersonLink(employee: EmployeeRow): PersonLink {
	return {
		id: employee.id,
		name: fullName(employee),
		title: employee.title,
		status: employee.status,
	};
}

/** One profile, or null when the id does not exist. The id comes from the URL. */
export function employeeQueryOptions(employeeId: string) {
	return queryOptions({
		queryKey: ["employees", "detail", employeeId],
		queryFn: async (): Promise<EmployeeProfile | null> => {
			const { employees, requests, careerEvents, dayStart } =
				readPeopleTables();
			const employee = employees.find((row) => row.id === employeeId);
			if (!employee) {
				return null;
			}
			const manager = employees.find((row) => row.id === employee.managerId);
			return {
				employee,
				name: fullName(employee),
				manager: manager ? toPersonLink(manager) : null,
				reports: employees
					.filter((row) => row.managerId === employee.id)
					.map(toPersonLink)
					.sort((first, second) => first.name.localeCompare(second.name)),
				requests: requests
					.filter((request) => request.employeeId === employee.id)
					.sort((first, second) =>
						second.startDate.localeCompare(first.startDate),
					),
				careerEvents: careerEvents
					.filter((event) => event.employeeId === employee.id)
					.sort((first, second) => second.day.localeCompare(first.day)),
				balance: leaveBalance(employee, requests, dayStart),
			};
		},
	});
}

/** One figure before translation. The page turns `labelKey` into the `label` of KpiItem with t(). */
export type EmployeesKpi = Omit<KpiItem, "label" | "note"> & {
	labelKey: TranslationKey;
	/** The key of the scope line of a figure with no delta. The page turns it into `note`. */
	noteKey?: TranslationKey;
};

// The figures of the directory compare the last 90 days with the 90 days before.
const KPI_PERIOD_DAYS = 90;

/** The four figures of the directory: headcount, joiners, people on probation, and leavers. */
export function employeesKpisQueryOptions() {
	return queryOptions({
		queryKey: ["employees", "kpis"],
		queryFn: async (): Promise<EmployeesKpi[]> => {
			const { employees, dayStart } = readPeopleTables();
			const periodStart = toDayKey(shiftDays(dayStart, -KPI_PERIOD_DAYS));
			const previousStart = toDayKey(shiftDays(dayStart, -2 * KPI_PERIOD_DAYS));
			const headcountBefore = employees.filter(
				(employee) => employee.startDate < periodStart,
			).length;
			const joiners = employees.filter(
				(employee) => employee.startDate >= periodStart,
			).length;
			const joinersBefore = employees.filter(
				(employee) =>
					employee.startDate >= previousStart &&
					employee.startDate < periodStart,
			).length;
			return [
				{
					id: "headcount",
					labelKey: "employees.kpiHeadcount",
					value: employees.length,
					change: changeRatio(employees.length, headcountBefore),
					goodWhen: "up",
				},
				{
					id: "joiners",
					labelKey: "employees.kpiJoiners",
					value: joiners,
					change: changeRatio(joiners, joinersBefore),
					goodWhen: "up",
				},
				// The database keeps no history of these two statuses, so they show no delta.
				{
					id: "probation",
					labelKey: "employees.kpiProbation",
					noteKey: "employees.kpiProbationNote",
					value: employees.filter((employee) => employee.status === "probation")
						.length,
					change: null,
					goodWhen: "up",
				},
				{
					id: "leavers",
					labelKey: "employees.kpiLeavers",
					noteKey: "employees.kpiLeaversNote",
					value: employees.filter((employee) => employee.status === "notice")
						.length,
					change: null,
					goodWhen: "down",
				},
			];
		},
	});
}
