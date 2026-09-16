/**
 * Inline error pages of the preview proxy.
 * Called by src/index.ts. Each page posts its `wandit:preview` event to the
 * parent frame; the builder shell (WANDIT-173) listens for it to refresh
 * the token or to show the stopped state. No external assets: the page
 * must render under the strictest CSP.
 */
import type { PreviewParentMessage } from "@wandit/contracts";

function shell(
	heading: string,
	message: string,
	event?: PreviewParentMessage["event"],
): string {
	const note: PreviewParentMessage | null =
		event === undefined ? null : { type: "wandit:preview", event };
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${heading}</title>
<style>
	:root { color-scheme: light dark; }
	body {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		margin: 0;
		padding: 24px;
		font-family: ui-sans-serif, system-ui, sans-serif;
		background: #fafafa;
		color: #18181b;
	}
	main { max-width: 420px; text-align: center; }
	h1 { font-size: 20px; margin: 0 0 10px; }
	p { font-size: 14px; line-height: 1.6; color: #71717a; margin: 0; }
	@media (prefers-color-scheme: dark) {
		body { background: #09090b; color: #fafafa; }
		p { color: #a1a1aa; }
	}
</style>
</head>
<body>
	<main>
		<h1>${heading}</h1>
		<p>${message}</p>
	</main>
${note === null ? "" : `\t<script>parent.postMessage(${JSON.stringify(note)}, "*")</script>\n`}
</body>
</html>`;
}

/** 401 on a navigation request: the shell refreshes the token on the event. */
export function tokenExpiredPage(): string {
	return shell(
		"Preview session expired",
		"Your preview session has expired. It restarts on its own.",
		"token-expired",
	);
}

/** 503 when the sandbox does not answer: the shell shows the stopped state. */
export function notRunningPage(): string {
	return shell(
		"Preview not running",
		"The app preview is not running right now. Start it again from the builder.",
		"not-running",
	);
}

/** 500 on a proxy error. No postMessage: the parent knows no event for it. */
export function proxyErrorPage(): string {
	return shell(
		"Preview error",
		"The preview could not be loaded. Try again in a moment.",
	);
}
