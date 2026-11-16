// The employee directory behind login. The /app layout checks the session first.
// The loader fills the list and the figures. Thin: the page lives in the employees feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	EmployeesPage,
	EmployeesPageError,
	EmployeesPageSkeleton,
	employeesKpisQueryOptions,
	employeesQueryOptions,
} from "~/features/employees";

/** /app/employees: every employee in one table. A name opens /app/employees/$employeeId. */
export const Route = createFileRoute("/app/employees/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(employeesQueryOptions()),
			context.queryClient.query(employeesKpisQueryOptions()),
		]),
	pendingComponent: EmployeesPageSkeleton,
	errorComponent: EmployeesPageError,
	component: EmployeesPage,
});
