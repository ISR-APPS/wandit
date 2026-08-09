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

import { CustomDomainLiveContent } from "./publish-popover";

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
		domain: { isPrimary: true, name: "example.com", source },
		subdomain: "site.wandit.app",
		subdomainPublishing: false,
		historicalVersionNumber: null,
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
