import { describe, expect, it } from "vitest";

import { extractHtmlDocument } from "./marketing-html";

const DOCUMENT = `<!doctype html>
<html lang="fr">
<head><title>Test</title></head>
<body><main>Contenu</main></body>
</html>`;

describe("extractHtmlDocument", () => {
	it("unwraps a fenced html code block", () => {
		const reply = "Voici le document:\n```html\n" + DOCUMENT + "\n```\nFin.";

		expect(extractHtmlDocument(reply, "Test")).toBe(DOCUMENT);
	});

	it("slices from the doctype and trims trailing commentary", () => {
		const reply = `Some preamble the model should not have written.\n${DOCUMENT}\nAnd a closing note.`;

		expect(extractHtmlDocument(reply, "Test")).toBe(DOCUMENT);
	});

	it("accepts a document starting at <html> when no doctype exists", () => {
		const bare = DOCUMENT.replace("<!doctype html>\n", "");

		expect(extractHtmlDocument(`x ${bare}`, "Test")).toBe(bare);
	});

	it("wraps plain text in a minimal styled document instead of failing", () => {
		const wrapped = extractHtmlDocument(
			"Juste du texte avec <chevrons> & esperluette.",
			"Mon plan",
		);

		expect(wrapped).toContain("<!doctype html>");
		expect(wrapped).toContain("<h1>Mon plan</h1>");
		expect(wrapped).toContain("&lt;chevrons&gt; &amp; esperluette");
	});
});
