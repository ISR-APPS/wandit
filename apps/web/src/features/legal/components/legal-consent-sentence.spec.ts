import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The router is stubbed so the sentence can render outside a RouterProvider,
// and so the spec can inspect the props each Link receives.
const { linkProps } = vi.hoisted(() => ({
	linkProps: [] as { to?: string; onClick?: () => void }[],
}));

vi.mock("@tanstack/react-router", () => ({
	Link: (props: { to?: string; onClick?: () => void; children?: unknown }) => {
		linkProps.push({ to: props.to, onClick: props.onClick });
		return createElement("a", { href: props.to }, props.children as never);
	},
}));

import { LegalConsentSentence } from "./legal-consent-sentence";

const render = (onNavigate: () => void) =>
	renderToStaticMarkup(
		createElement(LegalConsentSentence, {
			template: "By continuing you accept the {terms} and the {privacy}.",
			termsLabel: "Terms of Service",
			privacyLabel: "Privacy Policy",
			onNavigate,
		}),
	);

describe("LegalConsentSentence", () => {
	beforeEach(() => {
		linkProps.length = 0;
	});

	it("turns the two tokens into links to the legal routes", () => {
		const html = render(vi.fn());

		expect(html).toContain('href="/terms"');
		expect(html).toContain('href="/privacy"');
		expect(html).toContain("By continuing you accept the ");
		expect(linkProps.map((props) => props.to)).toEqual(["/terms", "/privacy"]);
	});

	it("tells the host to close before either link navigates", () => {
		const onNavigate = vi.fn();

		render(onNavigate);
		for (const props of linkProps) {
			props.onClick?.();
		}

		expect(onNavigate).toHaveBeenCalledTimes(2);
	});

	it("shows an unmapped token raw rather than dropping the sentence", () => {
		const html = renderToStaticMarkup(
			createElement(LegalConsentSentence, {
				template: "A {unknownToken} stays visible.",
				termsLabel: "Terms of Service",
				privacyLabel: "Privacy Policy",
				onNavigate: vi.fn(),
			}),
		);

		expect(html).toContain("{unknownToken}");
	});
});
