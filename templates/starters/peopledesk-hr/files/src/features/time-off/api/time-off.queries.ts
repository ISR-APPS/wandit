// Reads of time off: the request list, and the detail of one request (balance and overlaps).
// The time-off route and the home prefetch the list in their loaders. The request dialog reads the detail after a click.
// Each queryFn reads the sample tables of the people feature. A later turn replaces it with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import {
	type Department,
	fullName,
	type LeaveBalance,
	leaveBalance,
	readPeopleTables,
	type TimeOffRequestRow,
	type TimeOffType,
	workingDayKeys,
} from "~/features/people";

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
