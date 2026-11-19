// The profile of one employee behind login. The /app layout checks the session first.
// The loader fills the profile of the id in the URL and the request list for its time-off cards.
// Thin: the page lives in the employees feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	EmployeeProfilePage,
	EmployeeProfileSkeleton,
	EmployeesPageError,
	employeeQueryOptions,
} from "~/features/employees";
import { timeOffRequestsQueryOptions } from "~/features/time-off";

/** /app/employees/PD-1042: one profile. An id with no row shows a not-found state inside the page. */
export const Route = createFileRoute("/app/employees/$employeeId")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.query(employeeQueryOptions(params.employeeId)),
			context.queryClient.query(timeOffRequestsQueryOptions()),
		]),
	pendingComponent: EmployeeProfileSkeleton,
	errorComponent: EmployeesPageError,
	component: EmployeeProfilePage,
});
