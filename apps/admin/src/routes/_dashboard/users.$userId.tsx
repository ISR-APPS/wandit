import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/users/$userId")({
	component: UserDetailLayout,
});

function UserDetailLayout() {
	return <Outlet />;
}
