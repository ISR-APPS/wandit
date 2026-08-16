import { createFileRoute } from "@tanstack/react-router";

import AcademyGuidePage from "@/features/academy/pages/academy-guide-page";
import { pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/_auth/academy/$guideId")({
	head: () => ({
		meta: [{ title: pageTitle("academy.meta.title") }],
	}),
	component: AcademyGuideRoute,
});

function AcademyGuideRoute() {
	const { guideId } = Route.useParams();

	return <AcademyGuidePage guideId={guideId} />;
}
