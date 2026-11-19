// Reads of employees: the directory, and one profile with its manager, reports, peers, career, and vacation balance.
// The employee routes prefetch them in their loaders. The pages read them with useSuspenseQuery.
// Each queryFn reads the sample tables of the people feature. A later turn replaces it with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import {
	type CareerEventRow,
	type EmployeeRow,
	type EmployeeStatus,
	fullName,
	isWeekend,
	type LeaveBalance,
	leaveBalance,
	readPeopleTables,
	type TimeOffType,
	toDayKey,
} from "~/features/people";

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

/** A short card of another person on the profile: the manager, a direct report, or a peer. */
export type PersonLink = {
	id: string;
	name: string;
	title: string;
	email: string;
	status: EmployeeStatus;
};

/** Everything that the profile page shows about one employee. */
export type EmployeeProfile = {
	employee: EmployeeRow;
	name: string;
	manager: PersonLink | null;
	/** The people who report to this employee, by name. */
	reports: PersonLink[];
	/** The other people with the same manager, by name. Empty when the employee has no manager. */
	peers: PersonLink[];
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
		email: employee.email,
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
			const byName = (first: PersonLink, second: PersonLink) =>
				first.name.localeCompare(second.name);
			return {
				employee,
				name: fullName(employee),
				manager: manager ? toPersonLink(manager) : null,
				reports: employees
					.filter((row) => row.managerId === employee.id)
					.map(toPersonLink)
					.sort(byName),
				peers: manager
					? employees
							.filter(
								(row) => row.managerId === manager.id && row.id !== employee.id,
							)
							.map(toPersonLink)
							.sort(byName)
					: [],
				careerEvents: careerEvents
					.filter((event) => event.employeeId === employee.id)
					.sort((first, second) => second.day.localeCompare(first.day)),
				balance: leaveBalance(employee, requests, dayStart),
			};
		},
	});
}
