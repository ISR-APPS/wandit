import { useEffect, useRef } from "react";

import { getServerUrl } from "@/lib/server-url";
import { createAffiliateCapture } from "./affiliate-capture";

export function useAffiliateCapture() {
	const captureRef = useRef<ReturnType<typeof createAffiliateCapture> | null>(
		null,
	);

	if (!captureRef.current && typeof window !== "undefined") {
		captureRef.current = createAffiliateCapture({
			apiBaseUrl: getServerUrl(),
			fetch: window.fetch.bind(window),
			history: window.history,
			location: window.location,
			storage: window.localStorage,
		});
	}

	useEffect(() => {
		void captureRef.current?.().catch(() => {
			// Attribution must never interrupt route rendering or sign-in. The API
			// cookie remains the primary source when the request succeeds.
		});
	}, []);
}

export function AffiliateCapture() {
	useAffiliateCapture();

	return null;
}
