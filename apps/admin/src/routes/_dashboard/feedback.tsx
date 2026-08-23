import { createFileRoute } from "@tanstack/react-router";

import { RequireAdminPermission } from "@/features/auth/components/require-admin-permission";
import { FeedbackPage } from "@/features/feedback/pages/feedback-page";

export const Route = createFileRoute("/_dashboard/feedback")({
	component: FeedbackRoute,
	head: () => ({
		meta: [{ title: "Feedback | Wandit Admin" }],
	}),
});

function FeedbackRoute() {
	return (
		<RequireAdminPermission permission={{ feedback: ["read"] }}>
			<FeedbackPage />
		</RequireAdminPermission>
	);
}
