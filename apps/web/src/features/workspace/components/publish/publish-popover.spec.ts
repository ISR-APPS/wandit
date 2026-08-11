import {
	createElement,
	isValidElement,
	type ReactElement,
	type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n", () => ({
	useTranslation: () => ({
		t: (key: string) => key.split(".").at(-1) ?? key,
	}),
}));

import {
	CustomDomainLiveContent,
	PurchasedDomainCard,
	selectPublishDomains,
} from "./publish-popover";

function findElement(
	node: ReactNode,
	predicate: (props: Record<string, unknown>) => boolean,
): ReactElement<Record<string, unknown>> | null {
	if (Array.isArray(node)) {
		for (const child of node) {
			const match = findElement(child, predicate);

			if (match) return match;
		}

		return null;
	}

	if (!isValidElement<Record<string, unknown>>(node)) return null;
	if (predicate(node.props)) return node;

	return findElement(node.props.children as ReactNode, predicate);
}

function renderCustomDomain(
	source: "external" | "purchased",
	onCopy: (url: string) => Promise<void>,
) {
	const props = {
		canPublish: false,
		domain: { isPrimary: true, name: "example.com", source },
		latestVersionNeedsPublishing: false,
		liveVersionNumber: 1,
		publishableVersionNumber: null,
		subdomain: "site.wandit.app",
		subdomainPublishing: false,
		onCopy,
		onPublish: vi.fn(),
	};

	return {
		html: renderToStaticMarkup(createElement(CustomDomainLiveContent, props)),
		view: CustomDomainLiveContent(props),
	};
}

function clickCopy(view: ReactNode) {
	const copyButton = findElement(
		view,
		(props) => props["aria-label"] === "copyLink",
	);
	const onClick = copyButton?.props.onClick;

	expect(onClick).toBeTypeOf("function");
	(onClick as () => void)();
}

describe("CustomDomainLiveContent", () => {
	it("renders, copies, and opens the www URL for an external domain", () => {
		const onCopy = vi.fn(async (_url: string) => undefined);
		const { html, view } = renderCustomDomain("external", onCopy);

		expect(html).toContain(">https://www.example.com</span>");
		expect(html.match(/href="https:\/\/www\.example\.com"/g)).toHaveLength(2);
		expect(html).not.toContain('href="https://example.com"');
		clickCopy(view);
		expect(onCopy).toHaveBeenCalledWith("https://www.example.com");
	});

	it("keeps the apex URL for a purchased domain", () => {
		const onCopy = vi.fn(async (_url: string) => undefined);
		const { html, view } = renderCustomDomain("purchased", onCopy);

		expect(html).toContain(">https://example.com</span>");
		expect(html.match(/href="https:\/\/example\.com"/g)).toHaveLength(2);
		expect(html).not.toContain("https://www.example.com");
		clickCopy(view);
		expect(onCopy).toHaveBeenCalledWith("https://example.com");
	});
});

describe("PurchasedDomainCard", () => {
	it("shows the purchased domain with a pending visual while it configures", () => {
		const html = renderToStaticMarkup(
			createElement(PurchasedDomainCard, {
				domain: {
					name: "example.com",
					source: "purchased",
					status: "configuring",
				},
				onCopy: vi.fn(async (_url: string) => undefined),
			}),
		);

		expect(html).toContain(">example.com</span>");
		expect(html).toContain("domainConfiguring");
		expect(html).toContain("animate-spin");
		expect(html).not.toContain('href="https://example.com"');
	});

	it("renders, copies, and opens the live URL once active", () => {
		const onCopy = vi.fn(async (_url: string) => undefined);
		const props = {
			domain: {
				name: "example.com",
				source: "purchased" as const,
				status: "active" as const,
			},
			onCopy,
		};
		const html = renderToStaticMarkup(
			createElement(PurchasedDomainCard, props),
		);
		const view = PurchasedDomainCard(props);

		expect(html).toContain(">https://example.com</span>");
		expect(html).toContain('href="https://example.com"');
		clickCopy(view);
		expect(onCopy).toHaveBeenCalledWith("https://example.com");
	});
});

describe("selectPublishDomains", () => {
	it("prefers a configuring purchase and preserves an active external domain", () => {
		const activeExternal = {
			isPrimary: true,
			name: "existing.com",
			source: "external" as const,
			status: "active" as const,
		};
		const configuringPurchase = {
			isPrimary: false,
			name: "new-domain.com",
			source: "purchased" as const,
			status: "registering" as const,
		};

		expect(selectPublishDomains([activeExternal, configuringPurchase])).toEqual(
			{
				activeExternalDomain: activeExternal,
				customDomain: activeExternal,
				purchasedDomain: configuringPurchase,
			},
		);
	});

	it("uses an active purchased domain as the main live URL", () => {
		const activeExternal = {
			isPrimary: true,
			name: "existing.com",
			source: "external" as const,
			status: "active" as const,
		};
		const activePurchase = {
			isPrimary: false,
			name: "new-domain.com",
			source: "purchased" as const,
			status: "active" as const,
		};

		expect(selectPublishDomains([activeExternal, activePurchase])).toEqual({
			activeExternalDomain: activeExternal,
			customDomain: activePurchase,
			purchasedDomain: activePurchase,
		});
	});
});
