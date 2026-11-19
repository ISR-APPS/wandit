// The employee directory behind login. The /app layout checks the session first.
// The loader fills the list. Thin: the page lives in the employees feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	EmployeesPage,
	EmployeesPageError,
	EmployeesPageSkeleton,
	employeesQueryOptions,
} from "~/features/employees";

/** /app/employees: every employee in one table. A name opens /app/employees/$employeeId. */
export const Route = createFileRoute("/app/employees/")({
	loader: ({ context }) => context.queryClient.query(employeesQueryOptions()),
	pendingComponent: EmployeesPageSkeleton,
	errorComponent: EmployeesPageError,
	component: EmployeesPage,
});
