import { useLocation, useNavigate } from "@tanstack/react-router";

import { scrollToId } from "./scroll";

/**
 * Landing sections only exist on the homepage: on "/" a section link scrolls
 * in place, on any other page (e.g. /pricing) it navigates home with the
 * hash and the homepage scrolls to it on mount.
 */
export function useSectionNav() {
	const navigate = useNavigate();
	const isHome = useLocation({
		select: (location) => location.pathname === "/",
	});

	return (id: string) => {
		if (isHome) {
			scrollToId(id);
			return;
		}

		void navigate({ to: "/", hash: id });
	};
}
