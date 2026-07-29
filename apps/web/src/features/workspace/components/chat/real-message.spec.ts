import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RealChatMessage } from "./real-message";

function renderAssistant(text: string): string {
	return renderToStaticMarkup(
		createElement(RealChatMessage, {
			messageRole: "assistant",
			text,
		}),
	);
}

describe("RealChatMessage markdown rendering", () => {
	it("renders bold, lists and tables as HTML", () => {
		const html = renderAssistant(
			[
				"Performance globale : **43 598** impressions.",
				"",
				"- CTR : 0.44%",
				"- CPC : $0.10",
				"",
				"| Créa | Leads |",
				"| --- | --- |",
				"| ego 2 | 7 |",
			].join("\n"),
		);

		expect(html).toContain('data-streamdown="strong"');
		expect(html).toContain('data-streamdown="list-item"');
		expect(html).toContain("<table");
		expect(html).not.toContain("**43 598**");
	});

	it("keeps user bubbles as plain text", () => {
		const html = renderToStaticMarkup(
			createElement(RealChatMessage, {
				messageRole: "user",
				text: "**not markdown**",
			}),
		);

		expect(html).toContain("**not markdown**");
		expect(html).not.toContain("<strong>");
	});

	it("survives incomplete markdown mid-stream", () => {
		const html = renderAssistant("Voici le **dé");

		expect(html).toContain("Voici le");
		expect(html).not.toContain("Voici le **dé");
	});

	it("renders single newlines as hard breaks (legacy plain-text history)", () => {
		const html = renderAssistant("Première ligne.\nDeuxième ligne.");

		expect(html).toContain("<br");
		expect(html).toContain("Première ligne.");
		expect(html).toContain("Deuxième ligne.");
	});
});
