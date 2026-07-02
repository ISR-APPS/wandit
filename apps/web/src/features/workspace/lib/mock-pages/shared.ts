// Shared contract for the mock generated-page library. Each family file
// exports a Record<pageKey, MockPage> (or parameterized builders); index.ts
// merges them and resolves pageKeys stored on versions.

export type PageLang = "fr" | "ar" | "en";

export type MockPage = {
	title: string;
	lang: PageLang;
	/** Full self-contained HTML document — inline CSS/JS, zero network. */
	html: string;
};

export type MockPageBuilder = (ctx: { title: string }) => MockPage;

/** Minimal HTML-escape for user-provided strings injected into page HTML. */
export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
