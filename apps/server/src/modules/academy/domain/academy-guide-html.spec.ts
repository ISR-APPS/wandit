import { describe, expect, it } from "vitest";

import {
	isAcademyGuideHtmlEmpty,
	sanitizeAcademyGuideHtml,
} from "./academy-guide-html";

describe("sanitizeAcademyGuideHtml", () => {
	it("keeps the supported rich-text elements", () => {
		const sanitized = sanitizeAcademyGuideHtml(
			[
				"<h2>Heading</h2>",
				"<p>Text <strong>bold</strong> <em>emphasis</em> <u>underlined</u></p>",
				"<blockquote><code>const answer = 42;</code></blockquote>",
				"<ul><li>First</li><li>Second</li></ul>",
				"<hr><br><span>Closing</span>",
			].join(""),
		);

		expect(sanitized).toContain("<h2>Heading</h2>");
		expect(sanitized).toContain("<strong>bold</strong>");
		expect(sanitized).toContain("<em>emphasis</em>");
		expect(sanitized).toContain("<blockquote>");
		expect(sanitized).toContain("<ul><li>First</li><li>Second</li></ul>");
		expect(sanitized).toContain("<span>Closing</span>");
	});

	it("strips active content and all unapproved attributes", () => {
		const sanitized = sanitizeAcademyGuideHtml(
			[
				'<p class="marketing" style="color:red" onclick="steal()">Safe text</p>',
				'<img src="https://images.example.com/guide.png" alt="Guide" onerror="steal()" class="hero" style="width:100vw">',
				"<script>alert('xss')</script>",
				'<iframe src="https://evil.example/embed"></iframe>',
				'<form action="https://evil.example"><input name="secret"></form>',
				'<svg onload="steal()"><circle></circle></svg>',
			].join(""),
		);

		expect(sanitized).toContain("Safe text");
		expect(sanitized).toContain(
			'<img src="https://images.example.com/guide.png" alt="Guide" />',
		);
		expect(sanitized).not.toMatch(
			/<script|alert\(|<iframe|<form|<input|<svg|<circle/iu,
		);
		expect(sanitized).not.toMatch(
			/\s(?:class|style|onclick|onerror|onload)=/iu,
		);
	});

	it("forces safe link target and relationship attributes", () => {
		const sanitized = sanitizeAcademyGuideHtml(
			'<p><a href="https://wandit.ai/docs" target="_self" rel="opener">Docs</a></p>',
		);

		expect(sanitized).toContain('href="https://wandit.ai/docs"');
		expect(sanitized).toContain('target="_blank"');
		expect(sanitized).toContain('rel="noopener noreferrer nofollow"');
		expect(sanitized).not.toContain('target="_self"');
	});

	it("removes javascript links while retaining safe HTTP and mail links", () => {
		const sanitized = sanitizeAcademyGuideHtml(
			[
				'<a href="javascript:alert(1)">Unsafe</a>',
				'<a href="http://wandit.test/help">HTTP</a>',
				'<a href="mailto:academy@wandit.ai">Email</a>',
			].join(""),
		);

		expect(sanitized).not.toContain("javascript:");
		expect(sanitized).toContain('href="http://wandit.test/help"');
		expect(sanitized).toContain('href="mailto:academy@wandit.ai"');
	});

	it("allows only HTTPS image sources", () => {
		const sanitized = sanitizeAcademyGuideHtml(
			[
				'<img src="https://images.example.com/safe.png" alt="Safe" title="Title" width="640" height="360">',
				'<img src="http://images.example.com/insecure.png" alt="Insecure">',
				'<img src="data:image/png;base64,AAAA" alt="Inline">',
				'<img src="/relative.png" alt="Relative">',
			].join(""),
		);

		expect(sanitized).toContain('src="https://images.example.com/safe.png"');
		expect(sanitized).toContain('width="640"');
		expect(sanitized).toContain('height="360"');
		expect(sanitized).not.toContain("http://images.example.com/insecure.png");
		expect(sanitized).not.toContain("data:image/png");
		expect(sanitized).not.toContain("/relative.png");
	});
});

describe("isAcademyGuideHtmlEmpty", () => {
	it.each([
		"",
		"   \n\t",
		"<p><br></p>",
		"<p><strong> </strong></p>",
		"<p>&nbsp;</p>",
		"<h2></h2><hr>",
	])("treats markup without visible content as empty: %s", (html) => {
		expect(isAcademyGuideHtmlEmpty(html)).toBe(true);
	});

	it.each([
		"Plain text",
		"<p>Visible text</p>",
		'<img src="https://images.example.com/guide.png" alt="">',
		"<p><br></p><img>",
	])("treats text or an image as content: %s", (html) => {
		expect(isAcademyGuideHtmlEmpty(html)).toBe(false);
	});
});
