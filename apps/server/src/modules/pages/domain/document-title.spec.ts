import { describe, expect, it } from "vitest";

import { ensureDocumentTitle } from "./document-title";

const PAGE =
	'<!doctype html><html lang="ar" dir="rtl"><head>' +
	'<meta charset="utf-8"></head><body><h1>Hi</h1></body></html>';

describe("ensureDocumentTitle", () => {
	it("inserts the fallback after the charset meta when no title exists", () => {
		const result = ensureDocumentTitle(PAGE, "زيت الأركان");

		expect(result).toContain("<title>زيت الأركان</title>");
		expect(result).toContain('<meta charset="utf-8"><title>');
		expect(result).toContain("<!DOCTYPE html>");
		expect(result).toContain("<h1>Hi</h1>");
	});

	it("fills a title that is present but empty or whitespace", () => {
		const empty = PAGE.replace("</head>", "<title></title></head>");
		const blank = PAGE.replace("</head>", "<title>   </title></head>");

		expect(ensureDocumentTitle(empty, "Wandit")).toContain(
			"<title>Wandit</title>",
		);
		expect(ensureDocumentTitle(blank, "Wandit")).toContain(
			"<title>Wandit</title>",
		);
	});

	it("returns a document that already names itself byte-identical", () => {
		const named = PAGE.replace(
			"</head>",
			"<title>Serum Éclat — livraison 48 h</title></head>",
		);

		expect(ensureDocumentTitle(named, "Wandit")).toBe(named);
	});

	it("returns the document unchanged when the fallback is blank", () => {
		expect(ensureDocumentTitle(PAGE, "   ")).toBe(PAGE);
	});

	it("escapes a brand name carrying HTML syntax", () => {
		const result = ensureDocumentTitle(PAGE, 'Ben & Co <script>"x"');

		expect(result).toContain('<title>Ben &amp; Co &lt;script&gt;"x"</title>');
		expect(result).not.toContain("<script>");
	});
});
