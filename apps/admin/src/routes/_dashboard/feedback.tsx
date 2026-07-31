import { createFileRoute } from "@tanstack/react-router";

import { FeedbackPage } from "@/features/feedback/pages/feedback-page";

export const Route = createFileRoute("/_dashboard/feedback")({
	component: FeedbackPage,
	head: () => ({
		meta: [{ title: "Feedback | Wandit Admin" }],
	}),
});
