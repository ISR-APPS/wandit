import { createFileRoute } from "@tanstack/react-router";

import { AcademyEditorPage } from "@/features/academy/pages/academy-editor-page";

export const Route = createFileRoute("/_dashboard/academy/$guideId")({
	component: AcademyGuideRoute,
	head: () => ({
		meta: [{ title: "Academy | Wandit Admin" }],
	}),
});

function AcademyGuideRoute() {
	const { guideId } = Route.useParams();

	return <AcademyEditorPage guideId={guideId} />;
}
