import { getDictionary, translate } from "@wandit/internationalization";
import { describe, expect, it } from "vitest";

import {
	availableBrandTargets,
	canApplyPageTitle,
	getBrandActionState,
	scanBrandTargetsInDocument,
} from "./data-panel";

class BrandNode {
	readonly children: BrandNode[] = [];
	readonly attributes = new Map<string, string>();
	readonly tagName: string;
	parentElement: BrandNode | null = null;
	textContent: string;

	constructor(
		tag: string,
		attributes: Record<string, string> = {},
		text = "",
		parent?: BrandNode,
	) {
		this.tagName = tag.toUpperCase();
		this.textContent = text;
		for (const [name, value] of Object.entries(attributes)) {
			this.attributes.set(name, value);
		}
		if (parent) {
			this.parentElement = parent;
			parent.children.push(this);
		}
	}

	getAttribute(name: string): string | null {
		return this.attributes.get(name) ?? null;
	}

	closest(selector: string): BrandNode | null {
		const tags = selector.split(",").map((part) => part.trim().toUpperCase());
		let current: BrandNode | null = this;
		while (current) {
			if (tags.includes(current.tagName)) return current;
			current = current.parentElement;
		}
		return null;
	}

	querySelector(selector: string): BrandNode | null {
		return this.querySelectorAll(selector)[0] ?? null;
	}

	querySelectorAll(selector: string): BrandNode[] {
		const matches = (node: BrandNode) => {
			if (selector === "[data-wid]") return node.attributes.has("data-wid");
			const role = /^\[data-brand="(nav|footer)"\]$/.exec(selector)?.[1];
			if (role) return node.getAttribute("data-brand") === role;
			return node.tagName === selector.toUpperCase();
		};
		const found: BrandNode[] = [];
		const visit = (node: BrandNode) => {
			for (const child of node.children) {
				if (matches(child)) found.push(child);
				visit(child);
			}
		};
		visit(this);
		return found;
	}
}

function scan(document: BrandNode) {
	return scanBrandTargetsInDocument(document as unknown as Document);
}

describe("scanBrandTargets", () => {
	it("prefers explicit nav/footer markers and keeps descendant wids", () => {
		const doc = new BrandNode("html");
		const header = new BrandNode("header", {}, "", doc);
		const nav = new BrandNode("nav", {}, "", header);
		const navBrand = new BrandNode(
			"a",
			{ "data-brand": "nav", "data-wid": "brand-nav", href: "/" },
			"Wandit",
			nav,
		);
		new BrandNode("span", { "data-wid": "e-2" }, "Wandit", navBrand);
		const footer = new BrandNode("footer", {}, "", doc);
		new BrandNode(
			"a",
			{ "data-brand": "footer", "data-wid": "brand-footer", href: "/" },
			"Wandit",
			footer,
		);

		expect(scan(doc)).toEqual([
			{
				wid: "brand-nav",
				role: "nav",
				text: "Wandit",
				descendantWids: ["e-2"],
				explicit: true,
			},
			{
				wid: "brand-footer",
				role: "footer",
				text: "Wandit",
				descendantWids: [],
				explicit: true,
			},
		]);
	});

	it("finds a semantic legacy nav mark and a matching footer mark", () => {
		const doc = new BrandNode("html");
		const nav = new BrandNode("nav", {}, "", doc);
		new BrandNode(
			"a",
			{ class: "site-wordmark", "data-wid": "legacy-nav", href: "/" },
			"Maison Noor",
			nav,
		);
		const footer = new BrandNode("footer", {}, "", doc);
		new BrandNode(
			"a",
			{ "data-wid": "legacy-footer", href: "#" },
			"Maison Noor",
			footer,
		);

		expect(scan(doc)).toMatchObject([
			{ wid: "legacy-nav", role: "nav", explicit: false },
			{ wid: "legacy-footer", role: "footer", explicit: false },
		]);
	});

	it("uses a short home-like anchor when no semantic class exists", () => {
		const doc = new BrandNode("html");
		const nav = new BrandNode("nav", {}, "", doc);
		new BrandNode(
			"a",
			{ "data-wid": "home-brand", href: "#hero" },
			"Atelier Saha",
			nav,
		);

		expect(scan(doc)).toMatchObject([
			{ wid: "home-brand", role: "nav", text: "Atelier Saha" },
		]);
	});

	it("never guesses a bare hero heading in a top-level header", () => {
		const doc = new BrandNode("html");
		const heroHeader = new BrandNode("header", {}, "", doc);
		new BrandNode(
			"h1",
			{ "data-wid": "hero-title" },
			"Launch faster",
			heroHeader,
		);

		expect(scan(doc)).toEqual([]);
	});

	it("refuses phone/social/CTA-like footer links even with brand classes", () => {
		const doc = new BrandNode("html");
		const nav = new BrandNode("nav", {}, "", doc);
		new BrandNode(
			"a",
			{ "data-wid": "brand-nav", href: "/" },
			"Maison Noor",
			nav,
		);
		const footer = new BrandNode("footer", {}, "", doc);
		new BrandNode(
			"a",
			{ class: "brand", "data-wid": "phone", href: "tel:+213555123" },
			"Maison Noor",
			footer,
		);
		new BrandNode(
			"a",
			{
				class: "logo",
				"data-wid": "instagram",
				href: "https://instagram.com/maison-noor",
			},
			"Maison Noor",
			footer,
		);

		expect(scan(doc)).toMatchObject([{ wid: "brand-nav", role: "nav" }]);
	});

	it("does not treat a footer-contained nav as the page nav or duplicate its wid", () => {
		const doc = new BrandNode("html");
		const header = new BrandNode("header", {}, "", doc);
		const headerNav = new BrandNode("nav", {}, "", header);
		new BrandNode(
			"a",
			{ "data-wid": "brand-nav", href: "/" },
			"Maison Noor",
			headerNav,
		);
		const footer = new BrandNode("footer", {}, "", doc);
		const footerNav = new BrandNode("nav", {}, "", footer);
		new BrandNode(
			"a",
			{ "data-wid": "brand-footer", href: "/" },
			"Maison Noor",
			footerNav,
		);

		expect(scan(doc)).toMatchObject([
			{ wid: "brand-nav", role: "nav" },
			{ wid: "brand-footer", role: "footer" },
		]);
	});

	it("rejects broad semantic containers with interactive descendants", () => {
		const doc = new BrandNode("html");
		const nav = new BrandNode("nav", {}, "", doc);
		const links = new BrandNode(
			"div",
			{ class: "brand-links", "data-wid": "all-nav-links" },
			"Call us",
			nav,
		);
		new BrandNode(
			"a",
			{ href: "tel:+213555123", "data-wid": "phone" },
			"Call us",
			links,
		);

		expect(scan(doc)).toEqual([]);
	});

	it("filters targets already pending removal before project logo updates", () => {
		const targets = [
			{
				wid: "brand-nav",
				role: "nav" as const,
				text: "Maison Noor",
				descendantWids: [],
				explicit: true,
			},
			{
				wid: "brand-footer",
				role: "footer" as const,
				text: "Maison Noor",
				descendantWids: [],
				explicit: true,
			},
		];

		expect(availableBrandTargets(targets, ["brand-nav"])).toEqual([targets[1]]);
	});
});

describe("brand card action state", () => {
	it("shows progress only on the action that is actually pending", () => {
		expect(getBrandActionState("upload", true, false)).toEqual({
			busy: true,
			uploadPending: true,
			removePending: false,
		});
		expect(getBrandActionState("remove", true, false)).toEqual({
			busy: true,
			uploadPending: false,
			removePending: true,
		});
	});

	it("disables brand actions without showing progress for unrelated scoped AI", () => {
		expect(getBrandActionState(null, false, true)).toEqual({
			busy: true,
			uploadPending: false,
			removePending: false,
		});
	});
});

describe("page title card", () => {
	it("applies only a non-empty title that changes the effective value", () => {
		expect(canApplyPageTitle("Maison Noor", "Old tab")).toBe(true);
		expect(canApplyPageTitle("  Maison Noor  ", "Maison Noor")).toBe(false);
		expect(canApplyPageTitle("   ", "Old tab")).toBe(false);
		// A page with no <title> yet: any real title is a change.
		expect(canApplyPageTitle("Atelier Saha", "")).toBe(true);
	});

	it("labels the field and its browser-tab hint in every dictionary", async () => {
		const [en, fr, ar] = await Promise.all([
			getDictionary("en"),
			getDictionary("fr"),
			getDictionary("ar"),
		]);

		expect(en.workspace.page.editor.dataPageTitle).toBe("Page title");
		expect(fr.workspace.page.editor.dataPageTitle).toBe("Titre de la page");
		expect(ar.workspace.page.editor.dataPageTitle).toBe("عنوان الصفحة");
		for (const dictionary of [en, fr, ar]) {
			expect(
				dictionary.workspace.page.editor.dataPageTitleHint.length,
			).toBeGreaterThan(0);
			expect(dictionary.workspace.page.editor.dataApply.length).toBeGreaterThan(
				0,
			);
		}
	});
});

describe("brand card translations", () => {
	it("keeps exact plural structure and native Arabic categories", async () => {
		const [en, fr, ar] = await Promise.all([
			getDictionary("en"),
			getDictionary("fr"),
			getDictionary("ar"),
		]);
		const expectedCategories = ["few", "many", "one", "other", "two", "zero"];

		for (const dictionary of [en, fr, ar]) {
			expect(
				Object.keys(
					dictionary.workspace.page.editor.dataBrandOccurrences,
				).sort(),
			).toEqual(expectedCategories);
		}
		expect(
			translate(
				en,
				"workspace.page.editor.dataBrandOccurrences",
				{ count: 1 },
				"en",
			),
		).toBe("1 location");
		expect(
			translate(
				en,
				"workspace.page.editor.dataBrandOccurrences",
				{ count: 2 },
				"en",
			),
		).toBe("2 locations");
		expect(
			translate(
				fr,
				"workspace.page.editor.dataBrandOccurrences",
				{ count: 1 },
				"fr",
			),
		).toBe("1 emplacement");
		expect(
			translate(
				fr,
				"workspace.page.editor.dataBrandOccurrences",
				{ count: 2 },
				"fr",
			),
		).toBe("2 emplacements");
		expect(
			translate(
				ar,
				"workspace.page.editor.dataBrandOccurrences",
				{ count: 0 },
				"ar",
			),
		).toBe("لا مواضع");
		expect(
			translate(
				ar,
				"workspace.page.editor.dataBrandOccurrences",
				{ count: 1 },
				"ar",
			),
		).toBe("موضع واحد");
		expect(
			translate(
				ar,
				"workspace.page.editor.dataBrandOccurrences",
				{ count: 2 },
				"ar",
			),
		).toBe("موضعان");
		expect(
			translate(
				ar,
				"workspace.page.editor.dataBrandOccurrences",
				{ count: 4 },
				"ar",
			),
		).toBe("4 مواضع");
		expect(
			translate(
				ar,
				"workspace.page.editor.dataBrandOccurrences",
				{ count: 15 },
				"ar",
			),
		).toBe("15 موضعًا");
		expect(
			translate(
				ar,
				"workspace.page.editor.dataBrandOccurrences",
				{ count: 102 },
				"ar",
			),
		).toBe("102 موضع");
	});

	it("uses action-specific progress and page-neutral unavailable copy", async () => {
		const [en, fr, ar] = await Promise.all([
			getDictionary("en"),
			getDictionary("fr"),
			getDictionary("ar"),
		]);

		expect(en.workspace.page.editor.dataBrandRemoving).toBe("Removing…");
		expect(fr.workspace.page.editor.dataBrandRemoving).toBe("Suppression…");
		expect(ar.workspace.page.editor.dataBrandRemoving).toBe("جارٍ الإزالة…");
		expect(en.workspace.page.editor.dataBrandUnavailable).toBe(
			"No editable brand mark was found on this page.",
		);
		expect(fr.workspace.page.editor.dataBrandUnavailable).toBe(
			"Aucune marque modifiable n’a été trouvée sur cette page.",
		);
		expect(ar.workspace.page.editor.dataBrandUnavailable).toBe(
			"لم يتم العثور على علامة تجارية قابلة للتعديل في هذه الصفحة.",
		);
	});
});
