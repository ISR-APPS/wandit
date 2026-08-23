import { createFileRoute } from "@tanstack/react-router";

import { AcademyEditorPage } from "@/features/academy/pages/academy-editor-page";
import { RequireAdminPermission } from "@/features/auth/components/require-admin-permission";

export const Route = createFileRoute("/_dashboard/academy/new")({
	component: NewAcademyGuideRoute,
	head: () => ({
		meta: [{ title: "Academy | Wandit Admin" }],
	}),
});

function NewAcademyGuideRoute() {
	return (
		<RequireAdminPermission permission={{ academy: ["manage"] }}>
			<AcademyEditorPage guideId={undefined} />
		</RequireAdminPermission>
	);
}
