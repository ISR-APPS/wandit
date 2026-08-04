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

import { ExternalDomainSuccess } from "./connect-external-domain";

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

describe("ExternalDomainSuccess", () => {
	it("renders, copies, and opens the www URL", () => {
		const onCopy = vi.fn(async (_url: string) => undefined);
		const props = {
			domain: { name: "example.com", source: "external" as const },
			onCopy,
			onReset: vi.fn(),
		};
		const html = renderToStaticMarkup(
			createElement(ExternalDomainSuccess, props),
		);

		expect(html).toContain(">https://www.example.com</a>");
		expect(html.match(/href="https:\/\/www\.example\.com"/g)).toHaveLength(2);
		expect(html).not.toContain('href="https://example.com"');

		const copyButton = findElement(
			ExternalDomainSuccess(props),
			(elementProps) => elementProps["aria-label"] === "copy",
		);
		const onClick = copyButton?.props.onClick;

		expect(onClick).toBeTypeOf("function");
		(onClick as () => void)();
		expect(onCopy).toHaveBeenCalledWith("https://www.example.com");
	});
});
