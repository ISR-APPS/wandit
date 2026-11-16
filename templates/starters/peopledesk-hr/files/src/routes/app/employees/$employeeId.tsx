// The profile of one employee behind login. The /app layout checks the session first.
// The loader fills the profile of the id in the URL. Thin: the page lives in the employees feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	EmployeeProfilePage,
	EmployeeProfileSkeleton,
	EmployeesPageError,
	employeeQueryOptions,
} from "~/features/employees";

/** /app/employees/PD-1042: one profile. An id with no row shows a not-found state inside the page. */
export const Route = createFileRoute("/app/employees/$employeeId")({
	loader: ({ context, params }) =>
		context.queryClient.query(employeeQueryOptions(params.employeeId)),
	pendingComponent: EmployeeProfileSkeleton,
	errorComponent: EmployeesPageError,
	component: EmployeeProfilePage,
});
