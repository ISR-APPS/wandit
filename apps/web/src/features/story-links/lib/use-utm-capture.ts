import { useEffect, useRef } from "react";

import { getServerUrl } from "@/lib/server-url";
import { createUtmCapture } from "./utm-capture";

export function useUtmCapture() {
	const captureRef = useRef<ReturnType<typeof createUtmCapture> | null>(null);

	if (!captureRef.current && typeof window !== "undefined") {
		captureRef.current = createUtmCapture({
			apiBaseUrl: getServerUrl(),
			fetch: window.fetch.bind(window),
			history: window.history,
			location: window.location,
			now: () => new Date(),
			referrer: window.document.referrer,
			sessionStorage: window.sessionStorage,
			storage: window.localStorage,
		});
	}

	useEffect(() => {
		try {
			captureRef.current?.();
		} catch {
			// Attribution must never interrupt route rendering. Keeping the UTM
			// parameters in place allows a later reload to retry the local write.
		}
	}, []);
}

export function UtmCapture() {
	useUtmCapture();

	return null;
}
