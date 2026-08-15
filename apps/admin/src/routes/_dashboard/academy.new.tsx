import { createFileRoute } from "@tanstack/react-router";

import { AcademyEditorPage } from "@/features/academy/pages/academy-editor-page";

export const Route = createFileRoute("/_dashboard/academy/new")({
	component: NewAcademyGuideRoute,
	head: () => ({
		meta: [{ title: "Academy | Wandit Admin" }],
	}),
});

function NewAcademyGuideRoute() {
	return <AcademyEditorPage guideId={undefined} />;
}
