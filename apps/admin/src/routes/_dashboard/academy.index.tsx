import { createFileRoute } from "@tanstack/react-router";
import { AcademyPage } from "@/features/academy/pages/academy-page";
import { RequireAdminPermission } from "@/features/auth/components/require-admin-permission";

export const Route = createFileRoute("/_dashboard/academy/")({
	component: AcademyIndexRoute,
	head: () => ({
		meta: [{ title: "Academy | Wandit Admin" }],
	}),
});

function AcademyIndexRoute() {
	return (
		<RequireAdminPermission permission={{ academy: ["read"] }}>
			<AcademyPage />
		</RequireAdminPermission>
	);
}
