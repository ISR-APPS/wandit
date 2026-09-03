import { createFileRoute } from "@tanstack/react-router";

import { AcademyEditorPage } from "@/features/academy/pages/academy-editor-page";
import { RequireAdminPermission } from "@/features/auth/components/require-admin-permission";

export const Route = createFileRoute("/_dashboard/academy/$guideId")({
	component: AcademyGuideRoute,
	head: () => ({
		meta: [{ title: "Academy | Wandit Admin" }],
	}),
});

function AcademyGuideRoute() {
	const { guideId } = Route.useParams();

	return (
		<RequireAdminPermission permission={{ academy: ["read"] }}>
			<AcademyEditorPage guideId={guideId} />
		</RequireAdminPermission>
	);
}
