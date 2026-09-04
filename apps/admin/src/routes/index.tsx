import { createFileRoute, Navigate } from "@tanstack/react-router";

import { useEffectiveAdminPermissions } from "@/features/auth/lib/permissions";
import { getVisibleAdminNavigation } from "@/lib/navigation";

export const Route = createFileRoute("/")({
	component: AdminIndexRedirect,
});

function AdminIndexRedirect() {
	const { map, isLoading } = useEffectiveAdminPermissions();

	// Support grants have to resolve before choosing a landing page. Otherwise a
	// user without Overview would be sent to a page they cannot open.
	if (isLoading) {
		return null;
	}

	const destination = getVisibleAdminNavigation(map)[0]?.to ?? "/dashboard";
	return <Navigate to={destination} replace />;
}
