// Dev-only bridge between the preview iframe and the wandit host.
// The root route calls installPreviewBridge() when import.meta.env.DEV.
// Posts runtime errors to window.parent so the host can show them.

interface RuntimeErrorPayload {
	type: "wandit:runtime-error";
	message: string;
	stack?: string;
}

function postError(message: string, stack?: string) {
	if (typeof window === "undefined" || window.parent === window) {
		return;
	}
	const payload: RuntimeErrorPayload = {
		type: "wandit:runtime-error",
		message,
		stack,
	};
	// The host listens on the parent frame; "*" is required because the
	// preview origin differs from the host origin.
	window.parent.postMessage(payload, "*");
}

let installed = false;

/** Attaches the error listeners once. Safe to call from every render. */
export function installPreviewBridge() {
	if (installed || typeof window === "undefined") {
		return;
	}
	installed = true;

	window.addEventListener("error", (event) => {
		postError(
			event.message,
			event.error instanceof Error ? event.error.stack : undefined,
		);
	});

	window.addEventListener("unhandledrejection", (event) => {
		const reason: unknown = event.reason;
		const message = reason instanceof Error ? reason.message : String(reason);
		const stack = reason instanceof Error ? reason.stack : undefined;
		postError(message, stack);
	});
}
