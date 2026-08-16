import { createFileRoute } from "@tanstack/react-router";
import { storyLinksRoutes } from "@wandit/contracts";
import { useEffect } from "react";

import { getServerUrl } from "@/lib/server-url";

export const Route = createFileRoute("/s/$slug")({
	component: StoryLinkRedirectRoute,
});

function StoryLinkRedirectRoute() {
	const { slug } = Route.useParams();

	useEffect(() => {
		const redirectUrl = new URL(storyLinksRoutes.click(slug), getServerUrl());
		window.location.replace(redirectUrl.toString());
	}, [slug]);

	return null;
}
