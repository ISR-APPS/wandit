/**
 * Branded fallback pages, fully inline: the edge must never depend on
 * external assets (no fonts, no images, no scripts), so these render under
 * the strictest CSP and even when everything else is down.
 */

function shell(title: string, heading: string, message: string): string {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${title}</title>
<style>
	:root { color-scheme: light dark; }
	* { box-sizing: border-box; margin: 0; padding: 0; }
	body {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 24px;
		font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
		background: #fafafa;
		color: #18181b;
	}
	.card {
		max-width: 420px;
		width: 100%;
		border: 1px solid #e4e4e7;
		border-radius: 18px;
		padding: 40px 32px;
		background: #ffffff;
		text-align: center;
	}
	.spark {
		display: inline-grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		border: 1px solid #e4e4e7;
		font-size: 18px;
		margin-bottom: 20px;
	}
	h1 { font-size: 20px; letter-spacing: -0.4px; margin-bottom: 10px; }
	p { font-size: 14px; line-height: 1.6; color: #71717a; }
	.brand { margin-top: 28px; font-size: 12px; color: #a1a1aa; }
	.brand a { color: inherit; }
	@media (prefers-color-scheme: dark) {
		body { background: #09090b; color: #fafafa; }
		.card { background: #111113; border-color: #27272a; }
		.spark { border-color: #27272a; }
		p { color: #a1a1aa; }
		.brand { color: #52525b; }
	}
</style>
</head>
<body>
	<main class="card">
		<span class="spark">✦</span>
		<h1>${heading}</h1>
		<p>${message}</p>
		<p class="brand">Powered by <a href="https://wandit.app" rel="noopener">Wandit</a></p>
	</main>
</body>
</html>`;
}

export function notFoundPage(): string {
	return shell(
		"Site not found",
		"This site isn’t available",
		"There’s no website at this address right now. If you typed it by hand, double-check the spelling.",
	);
}

export function notPublishedPage(): string {
	return shell(
		"Not published yet",
		"Nothing published here yet",
		"This site exists but its owner hasn’t published a page. Check back soon.",
	);
}

export function suspendedPage(): string {
	return shell(
		"Site suspended",
		"This site is suspended",
		"The site at this address has been suspended and can’t be viewed.",
	);
}

export function healthPage(): string {
	return "wandit-edge: ok\n";
}
