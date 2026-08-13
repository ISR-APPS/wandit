import {
	act,
	createElement,
	isValidElement,
	type ReactElement,
	type ReactNode,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Domain } from "../api/domains.dto";
import { ExternalDomainRoutingNote } from "./external-domain-routing-note";

const mocks = vi.hoisted(() => ({
	buttons: new Map<string, (() => void) | undefined>(),
	domainQueryOptions: undefined as { enabled?: boolean } | undefined,
	domains: [] as unknown[],
	surface: null as "input" | "records" | null,
}));

vi.mock("@/lib/i18n", () => ({
	useTranslation: () => ({
		t: (key: string) => key.split(".").at(-1) ?? key,
	}),
}));

vi.mock("@wandit/ui/components/button", async () => {
	const { createElement, isValidElement } = await import("react");

	function textContent(node: ReactNode): string {
		if (typeof node === "string") return node;
		if (Array.isArray(node)) return node.map(textContent).join("");
		if (!isValidElement<{ children?: ReactNode }>(node)) return "";
		return textContent(node.props.children);
	}

	return {
		Button: ({
			asChild,
			children,
			onClick,
			size: _size,
			variant: _variant,
			...props
		}: {
			asChild?: boolean;
			children?: ReactNode;
			onClick?: () => void;
			size?: string;
			variant?: string;
		}) => {
			const label = textContent(children);
			if (label) mocks.buttons.set(label, onClick);
			if (asChild && isValidElement(children)) return children;
			return createElement("button", props, children);
		},
	};
});

vi.mock("@wandit/ui/components/dialog", async () => {
	const { createElement } = await import("react");
	const passthrough = ({ children }: { children?: ReactNode }) =>
		createElement("div", null, children);

	return {
		Dialog: passthrough,
		DialogContent: passthrough,
		DialogDescription: passthrough,
		DialogHeader: passthrough,
		DialogTitle: passthrough,
	};
});

vi.mock("@wandit/ui/components/input", async () => {
	const { createElement } = await import("react");
	return {
		Input: (props: Record<string, unknown>) => {
			mocks.surface = "input";
			return createElement("input", props);
		},
	};
});

vi.mock("@wandit/ui/components/label", async () => {
	const { createElement } = await import("react");
	return {
		Label: ({ children }: { children?: ReactNode }) =>
			createElement("label", null, children),
	};
});

vi.mock("@wandit/ui/components/separator", () => ({
	Separator: () => null,
}));

vi.mock("../api/domains.mutations", () => ({
	useAttachExternalDomain: () => ({
		isPending: false,
		mutateAsync: vi.fn(),
	}),
	useVerifyDomain: () => ({
		isPending: false,
		mutateAsync: vi.fn(),
	}),
}));

vi.mock("../api/domains.queries", () => ({
	useDomainsQuery: (
		_projectId: string,
		options: { enabled?: boolean } = {},
	) => {
		mocks.domainQueryOptions = options;
		return {
			data: options.enabled === false ? undefined : mocks.domains,
		};
	},
	useDomainDnsStatusQuery: () => ({
		data: undefined,
		isError: false,
		isFetching: false,
		refetch: vi.fn(),
	}),
}));

vi.mock("../lib/hooks", () => ({
	useCopyToClipboard: () => vi.fn(),
}));

vi.mock("./dns-records-table", async () => {
	const { createElement } = await import("react");
	return {
		DnsRecordsTable: () => {
			mocks.surface = "records";
			return createElement("div", null, "dnsRecords");
		},
	};
});

const {
	ExternalDomainConnectWizard,
	ExternalDomainSuccess,
	reconcileExternalDomainStep,
	resolveExternalDomainEntry,
} = await vi.importActual<typeof import("./connect-external-domain")>(
	"./connect-external-domain.tsx",
);

const mountedRoots = new Set<Root>();

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

class FakeNode {
	readonly childNodes: FakeNode[] = [];
	parentNode: FakeNode | null = null;

	constructor(
		readonly nodeType: number,
		readonly nodeName: string,
		readonly ownerDocument: FakeDocument,
	) {}

	get firstChild() {
		return this.childNodes[0] ?? null;
	}

	appendChild(child: FakeNode) {
		child.parentNode = this;
		this.childNodes.push(child);
		return child;
	}

	insertBefore(child: FakeNode, before: FakeNode | null) {
		child.parentNode = this;
		const index = before ? this.childNodes.indexOf(before) : -1;
		if (index < 0) this.childNodes.push(child);
		else this.childNodes.splice(index, 0, child);
		return child;
	}

	removeChild(child: FakeNode) {
		const index = this.childNodes.indexOf(child);
		if (index >= 0) this.childNodes.splice(index, 1);
		child.parentNode = null;
		return child;
	}

	addEventListener() {}
	removeEventListener() {}
}

class FakeElement extends FakeNode {
	readonly attributes = new Map<string, string>();
	readonly namespaceURI = "http://www.w3.org/1999/xhtml";
	readonly style: Record<string, string> & {
		removeProperty: (name: string) => void;
		setProperty: (name: string, value: string) => void;
	};
	readonly tagName: string;

	constructor(tagName: string, ownerDocument: FakeDocument) {
		super(1, tagName.toUpperCase(), ownerDocument);
		this.tagName = tagName.toUpperCase();
		const style = {} as FakeElement["style"];
		style.setProperty = (name, value) => {
			style[name] = value;
		};
		style.removeProperty = (name) => {
			delete style[name];
		};
		this.style = style;
	}

	setAttribute(name: string, value: string) {
		this.attributes.set(name, String(value));
	}

	removeAttribute(name: string) {
		this.attributes.delete(name);
	}
}

class FakeText extends FakeNode {
	constructor(
		public nodeValue: string,
		ownerDocument: FakeDocument,
	) {
		super(3, "#text", ownerDocument);
	}
}

class FakeDocument extends FakeNode {
	activeElement: FakeElement | null = null;
	defaultView: Record<string, unknown> = {};

	constructor() {
		super(9, "#document", undefined as unknown as FakeDocument);
	}

	createElement(tagName: string) {
		return new FakeElement(tagName, this);
	}

	createElementNS(_namespace: string, tagName: string) {
		return this.createElement(tagName);
	}

	createTextNode(value: string) {
		return new FakeText(value, this);
	}
}

function installMinimalDom() {
	const document = new FakeDocument();
	const window = {
		document,
		HTMLElement: FakeElement,
		HTMLIFrameElement: class {},
		Node: FakeNode,
	};
	document.defaultView = window;
	vi.stubGlobal("document", document);
	vi.stubGlobal("window", window);
	vi.stubGlobal("HTMLElement", FakeElement);
	vi.stubGlobal("Node", FakeNode);
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	return document.createElement("div");
}

async function mountWizard() {
	const root = createRoot(installMinimalDom() as unknown as Element);
	mountedRoots.add(root);

	await act(async () => {
		root.render(
			createElement(ExternalDomainConnectWizard, {
				projectId: "11111111-1111-4111-8111-111111111111",
			}),
		);
	});

	return root;
}

beforeEach(() => {
	mocks.buttons.clear();
	mocks.domainQueryOptions = undefined;
	mocks.domains = [];
	mocks.surface = null;
});

afterEach(async () => {
	await act(async () => {
		for (const root of mountedRoots) root.unmount();
	});
	mountedRoots.clear();
	vi.unstubAllGlobals();
});

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
		expect(html).not.toContain("notPublishedTitle");

		const copyButton = findElement(
			ExternalDomainSuccess(props),
			(elementProps) => elementProps["aria-label"] === "copy",
		);
		const onClick = copyButton?.props.onClick;

		expect(onClick).toBeTypeOf("function");
		(onClick as () => void)();
		expect(onCopy).toHaveBeenCalledWith("https://www.example.com");
	});

	it("shows publish guidance in the success state when the site is not live", () => {
		const html = renderToStaticMarkup(
			createElement(ExternalDomainSuccess, {
				domain: { name: "example.com", source: "external" },
				onCopy: vi.fn(async () => undefined),
				onReset: vi.fn(),
				isPublished: false,
				canPublish: true,
				onPublish: vi.fn(),
			}),
		);

		expect(html).toContain("notPublishedTitle");
		expect(html).toContain("notPublishedDescription");
		expect(html).toContain("publishCta");
	});
});

describe("ExternalDomainRoutingNote", () => {
	it("states that www is served and the apex must redirect", () => {
		const html = renderToStaticMarkup(
			createElement(ExternalDomainRoutingNote, { name: "example.com" }),
		);

		expect(html).toContain("externalServedAt");
		expect(html).toContain("externalApexRedirect");
		expect(html).toContain(
			'<bdi dir="ltr" class="font-mono">www.example.com</bdi>',
		);
		expect(html).toContain(
			'<bdi dir="ltr" class="font-mono">example.com</bdi>',
		);
		expect(html).toContain(
			'<bdi dir="ltr" class="font-mono">https://www.example.com</bdi>',
		);
	});
});

describe("reconcileExternalDomainStep", () => {
	it("keeps a stalled restart in checking while its verification request runs", () => {
		expect(
			reconcileExternalDomainStep({
				currentStep: "checking",
				domainStatus: "configuring",
				stalled: true,
				verificationPending: true,
			}),
		).toBe("checking");
	});

	it("returns to the records when a stalled check finishes without activation", () => {
		expect(
			reconcileExternalDomainStep({
				currentStep: "checking",
				domainStatus: "configuring",
				stalled: true,
				verificationPending: false,
			}),
		).toBe("records");
	});

	it("stops checking when the domain reaches a non-active terminal status", () => {
		expect(
			reconcileExternalDomainStep({
				currentStep: "checking",
				domainStatus: "failed",
				stalled: false,
				verificationPending: false,
			}),
		).toBe("records");
	});
});

describe("resolveExternalDomainEntry", () => {
	it("reopens at records with the newest pending external domain", () => {
		const olderPending = domain({
			id: "22222222-2222-4222-8222-222222222221",
			name: "older.com",
			createdAt: "2026-08-12T10:00:00.000Z",
		});
		const newestPending = domain({
			id: "22222222-2222-4222-8222-222222222222",
			name: "newest.com",
			createdAt: "2026-08-12T12:00:00.000Z",
			dns: {
				externalVerification: {
					attempts: 101,
					stalledAt: "2026-08-13T12:00:00.000Z",
				},
				records: [
					{
						type: "TXT",
						name: "_verify.newest.com",
						value: "verification-token",
						purpose: "ownership",
					},
				],
			},
		});

		expect(
			resolveExternalDomainEntry(
				[
					domain({ status: "active", createdAt: "2026-08-13T15:00:00.000Z" }),
					olderPending,
					domain({ status: "failed", createdAt: "2026-08-13T14:00:00.000Z" }),
					domain({
						source: "purchased",
						createdAt: "2026-08-13T13:00:00.000Z",
					}),
					newestPending,
				],
				true,
			),
		).toEqual({ step: "records", domain: newestPending });
	});

	it("returns to input after choosing another domain without losing the pending row", () => {
		const pendingDomain = domain();
		const domains = [pendingDomain];

		expect(resolveExternalDomainEntry(domains, false)).toEqual({
			step: "input",
			domain: null,
		});
		expect(resolveExternalDomainEntry(domains, true)).toEqual({
			step: "records",
			domain: pendingDomain,
		});
	});
});

describe("ExternalDomainConnectWizard pending domain resume", () => {
	it("reopens at records with the pending domain", async () => {
		mocks.domains = [
			domain({
				dns: {
					externalVerification: {
						attempts: 101,
						stalledAt: "2026-08-13T12:00:00.000Z",
					},
					records: [],
				},
			}),
		];
		const root = await mountWizard();

		expect(mocks.surface).toBe("records");
		expect(mocks.domainQueryOptions?.enabled).not.toBe(false);

		await act(async () => root.render(null));
		mocks.surface = null;
		await act(async () => {
			root.render(
				createElement(ExternalDomainConnectWizard, {
					projectId: "11111111-1111-4111-8111-111111111111",
				}),
			);
		});

		expect(mocks.surface).toBe("records");
	});

	it("returns to input when another domain is requested", async () => {
		const pendingDomain = domain();
		mocks.domains = [pendingDomain];
		await mountWizard();
		expect(mocks.surface).toBe("records");

		const useAnotherDomain = mocks.buttons.get("useAnotherDomain");
		expect(useAnotherDomain).toBeTypeOf("function");
		mocks.surface = null;
		await act(async () => useAnotherDomain?.());

		expect(mocks.surface).toBe("input");
		expect(mocks.domains).toEqual([pendingDomain]);
	});
});

function domain(overrides: Partial<Domain> = {}): Domain {
	return {
		autoRenew: false,
		createdAt: "2026-08-12T10:00:00.000Z",
		dns: { records: [] },
		error: null,
		expiresAt: null,
		id: "22222222-2222-4222-8222-222222222222",
		isPrimary: false,
		name: "example.com",
		projectId: "11111111-1111-4111-8111-111111111111",
		provider: null,
		registrant: null,
		source: "external",
		status: "configuring",
		tld: "com",
		updatedAt: "2026-08-12T10:00:00.000Z",
		userId: "user_1",
		whoisPrivacy: false,
		...overrides,
	};
}
