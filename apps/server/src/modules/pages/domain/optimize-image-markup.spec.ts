import { beforeEach, describe, expect, it, vi } from "vitest";

// r2.ts reaches for env and the S3 client at import time; this spec is about
// URL and key arithmetic, so both are replaced at the module boundary.
const mockEnv = vi.hoisted(() => ({
	R2_PUBLIC_BASE_URL: "https://assets.example.com",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

vi.mock("@aws-sdk/client-s3", () => ({
	DeleteObjectCommand: class {},
	GetObjectCommand: class {},
	HeadObjectCommand: class {},
	ListObjectsV2Command: class {},
	NoSuchKey: class extends Error {},
	PutObjectCommand: class {},
	S3Client: class {
		send = vi.fn();
	},
}));

import {
	emitResponsiveImages,
	optimizeImageMarkup,
} from "./optimize-image-markup";

const HERO_SRC = "https://assets.example.com/sites/p1/assets/a1/img-1.webp";
const GALLERY_SRC = "https://assets.example.com/sites/p1/assets/a1/img-2.webp";

function variantUrl(name: string, width: number): string {
	return `https://assets.example.com/sites/p1/assets/a1/${name}.w${width}.webp`;
}

/**
 * The asdental shape: a brand logo is the FIRST <img> in the document while
 * the real LCP is the second, inside the first content section.
 */
function pageWithLogoAndHero(extra = ""): string {
	return [
		"<!doctype html><html><head><title>T</title></head><body>",
		'<header><a data-brand="nav"><img data-wandit-brand-image src="/logo.png" alt="Brand"></a></header>',
		'<section id="hero">',
		`<img src="${HERO_SRC}" alt="Hero" width="1536" height="1024"${extra}>`,
		'<img src="/badge.png" alt="Badge" width="160" height="160">',
		"</section>",
		'<section id="gallery"><img src="/g.png" alt="G" loading="eager"></section>',
		'<footer><img src="/logo.png" alt="Brand"></footer>',
		"</body></html>",
	].join("");
}

function attributesOf(html: string, alt: string): Record<string, string> {
	const tag = new RegExp(`<img[^>]*alt="${alt}"[^>]*>`).exec(html)?.[0] ?? "";
	const found: Record<string, string> = {};

	for (const match of tag.matchAll(/([\w-]+)="([^"]*)"/g)) {
		found[match[1] as string] = match[2] as string;
	}

	return found;
}

describe("optimizeImageMarkup", () => {
	it("elects the hero over the brand logo that precedes it in the DOM", () => {
		const out = optimizeImageMarkup(pageWithLogoAndHero());

		expect(attributesOf(out, "Hero").fetchpriority).toBe("high");
		expect(attributesOf(out, "Hero").decoding).toBe("async");
		expect(attributesOf(out, "Hero").loading).toBeUndefined();
	});

	it("keeps fetchpriority a document-wide singleton, stripping stray ones", () => {
		const out = optimizeImageMarkup(
			pageWithLogoAndHero().replace(
				'<img src="/badge.png"',
				'<img fetchpriority="high" src="/badge.png"',
			),
		);

		expect(out.match(/fetchpriority="high"/g)).toHaveLength(1);
		expect(attributesOf(out, "Hero").fetchpriority).toBe("high");
		expect(attributesOf(out, "Badge").fetchpriority).toBeUndefined();
	});

	it("prefers the largest declared box, not document order", () => {
		const out = optimizeImageMarkup(
			[
				"<!doctype html><html><head></head><body>",
				'<section><img src="/small.png" alt="Small" width="200" height="200">',
				'<img src="/big.png" alt="Big" width="1600" height="900"></section>',
				"</body></html>",
			].join(""),
		);

		expect(attributesOf(out, "Big").fetchpriority).toBe("high");
		expect(attributesOf(out, "Small").loading).toBe("lazy");
	});

	it("turns a below-fold eager image lazy", () => {
		const out = optimizeImageMarkup(pageWithLogoAndHero());

		expect(attributesOf(out, "G").loading).toBe("lazy");
		expect(attributesOf(out, "G").decoding).toBe("async");
	});

	it("lazy-loads the footer image but never elects it", () => {
		const before = optimizeImageMarkup(pageWithLogoAndHero());
		const footer = /<footer>(.*?)<\/footer>/s.exec(before)?.[1] ?? "";

		expect(footer).toContain('loading="lazy"');
		expect(footer).not.toContain("fetchpriority");
	});

	// Chrome that sits above the fold: lazy-loading it costs LCP time rather
	// than saving it, and ops.ts owns the brand image's attributes.
	it("leaves above-the-fold chrome untouched", () => {
		const html = [
			"<!doctype html><html><head></head><body>",
			'<header><img data-wandit-brand-image src="/logo.png" alt="Brand">',
			'<a data-brand="nav"><img src="/badge.png" alt="Badge"></a></header>',
			'<nav><img src="/nav.png" alt="Nav"></nav>',
			'<section><img src="/hero.png" alt="Hero" width="1200" height="800"></section>',
			"</body></html>",
		].join("");
		const out = optimizeImageMarkup(html);

		for (const alt of ["Brand", "Badge", "Nav"]) {
			expect(attributesOf(out, alt).loading).toBeUndefined();
			expect(attributesOf(out, alt).decoding).toBeUndefined();
			expect(attributesOf(out, alt).fetchpriority).toBeUndefined();
		}

		expect(attributesOf(out, "Hero").fetchpriority).toBe("high");
	});

	// parse5 breaks an <img> out of a bare <svg> (it is a foreign-content
	// breakout tag), so the ancestry test only bites through an HTML
	// integration point — which is exactly where real artwork markup sits.
	it("leaves an image inside SVG artwork untouched", () => {
		const html = [
			"<!doctype html><html><head></head><body><section>",
			'<svg><foreignObject><img src="/art.png" alt="Art"></foreignObject></svg>',
			'<img src="/hero.png" alt="Hero" width="1200" height="800">',
			"</section></body></html>",
		].join("");
		const out = optimizeImageMarkup(html);

		expect(attributesOf(out, "Art").loading).toBeUndefined();
		expect(attributesOf(out, "Art").decoding).toBeUndefined();
		expect(attributesOf(out, "Hero").fetchpriority).toBe("high");
	});

	it("never invents width or height and injects no style", () => {
		const out = optimizeImageMarkup(pageWithLogoAndHero());

		expect(attributesOf(out, "G").width).toBeUndefined();
		expect(attributesOf(out, "G").height).toBeUndefined();
		expect(attributesOf(out, "Hero").width).toBe("1536");
		expect(out).not.toContain("<style");
	});

	it("is idempotent", () => {
		const once = optimizeImageMarkup(pageWithLogoAndHero());

		expect(optimizeImageMarkup(once)).toBe(once);
	});

	it("returns a page with no images byte-identical", () => {
		const html =
			"<!doctype html><html><head></head><body><p>Hi</p></body></html>";

		expect(optimizeImageMarkup(html)).toBe(html);
	});

	// The pass knows where the fold is only through the first content section.
	// A page whose every image sits past it is a page it cannot reason about,
	// and marking the wrong image lazy is worse than marking none: a lazily
	// loaded LCP is a Lighthouse failure in itself.
	it("changes nothing when no candidate sits above the fold", () => {
		const html = [
			"<!doctype html><html><head></head><body>",
			"<header><p>Brand</p></header>",
			"<section><p>Text hero</p></section>",
			'<section><img src="/late.png" alt="Late" width="900" height="900"></section>',
			"</body></html>",
		].join("");

		expect(optimizeImageMarkup(html)).toBe(html);
	});

	// No <section>, <header> or <main> section at all: the fold is unknown, so
	// the pass keeps its hands off. Generated pages always carry sections (the
	// stamping model depends on them), so this only guards hand-written HTML.
	it("changes nothing on a page with no top-level section", () => {
		const html = [
			"<!doctype html><html><head></head><body>",
			'<div><img src="/a.png" alt="A" width="1200" height="800"></div>',
			'<div><img src="/b.png" alt="B" width="400" height="400"></div>',
			"</body></html>",
		].join("");

		expect(optimizeImageMarkup(html)).toBe(html);
	});

	it("lazy-loads everything when the page has no candidate at all", () => {
		const html = [
			"<!doctype html><html><head></head><body>",
			"<header><p>Brand</p></header>",
			'<footer><img src="/f.png" alt="Foot" width="300" height="300"></footer>',
			"</body></html>",
		].join("");
		const out = optimizeImageMarkup(html);

		expect(out).not.toContain("fetchpriority");
		expect(attributesOf(out, "Foot").loading).toBe("lazy");
	});

	// Regression: the hero of this page belongs to NO top-level section
	// (<main> and <div> are wrappers, not sections), so a containment-based
	// scope elected the below-fold gallery image and sent the real LCP lazy.
	it("elects a hero that sits in main > div, not in a section", () => {
		const html = [
			"<!doctype html><html><head></head><body>",
			'<header><a data-brand="nav"><img data-wandit-brand-image src="/logo.png" alt="Brand"></a></header>',
			'<main><div class="hero"><img src="/hero.webp" alt="Hero" width="1536" height="1024"></div></main>',
			'<section id="more"><img src="/b.webp" alt="More" width="800" height="600"></section>',
			"</body></html>",
		].join("");
		const out = optimizeImageMarkup(html);

		expect(attributesOf(out, "Hero").fetchpriority).toBe("high");
		expect(attributesOf(out, "Hero").loading).toBeUndefined();
		expect(attributesOf(out, "More").loading).toBe("lazy");
	});

	it("elects a hero three wrappers deep inside the first section", () => {
		const html = [
			"<!doctype html><html><head></head><body>",
			'<section id="hero"><div><div><figure>',
			'<img src="/hero.webp" alt="Hero" width="1600" height="900">',
			"</figure></div></div></section>",
			'<section id="more"><img src="/b.webp" alt="More" width="800" height="600"></section>',
			"</body></html>",
		].join("");
		const out = optimizeImageMarkup(html);

		expect(attributesOf(out, "Hero").fetchpriority).toBe("high");
		expect(attributesOf(out, "More").loading).toBe("lazy");
	});

	// The builder's own call on its own layout. A promo strip pushes the hero
	// out of the first content section, so without this the hero would go
	// lazy and the below-fold image would take the priority.
	it("keeps a hero the builder already marked, wherever it sits", () => {
		const html = [
			"<!doctype html><html><head></head><body>",
			'<header><a data-brand="nav"><img data-wandit-brand-image src="/logo.png" alt="Brand"></a></header>',
			'<section id="promo"><p>Free delivery</p></section>',
			'<section id="hero"><img src="/hero.webp" alt="Hero" fetchpriority="high" width="1600" height="900"></section>',
			'<section id="more"><img src="/b.webp" alt="More" width="800" height="600"></section>',
			"</body></html>",
		].join("");
		const out = optimizeImageMarkup(html);

		expect(attributesOf(out, "Hero").fetchpriority).toBe("high");
		expect(attributesOf(out, "Hero").loading).toBeUndefined();
		expect(out.match(/fetchpriority="high"/g)).toHaveLength(1);
	});

	// Nothing declares a box, so area cannot decide. Document order alone
	// would crown the logo; the header tie-break is what saves the hero.
	it("prefers a non-header image when no image declares a box", () => {
		const html = [
			"<!doctype html><html><head></head><body>",
			'<header><a href="/"><img src="/logo.png" alt="Logo"></a></header>',
			'<section id="hero"><img src="/hero.jpg" alt="Hero"></section>',
			"</body></html>",
		].join("");
		const out = optimizeImageMarkup(html);

		expect(attributesOf(out, "Hero").fetchpriority).toBe("high");
		expect(attributesOf(out, "Logo").fetchpriority).toBeUndefined();
	});
});

describe("emitResponsiveImages", () => {
	const exists = vi.fn();

	beforeEach(() => {
		exists.mockReset();
	});

	it("emits a srcset from the verified renditions only, plus a preload", async () => {
		exists.mockImplementation(
			async (url: string) =>
				url === variantUrl("img-1", 480) || url === variantUrl("img-1", 960),
		);

		const out = await emitResponsiveImages(
			optimizeImageMarkup(pageWithLogoAndHero()),
			{ exists },
		);
		const hero = attributesOf(out, "Hero");

		expect(hero.srcset).toBe(
			`${variantUrl("img-1", 480)} 480w, ${variantUrl("img-1", 960)} 960w, ${HERO_SRC} 1920w`,
		);
		expect(hero.sizes).toBe("100vw");
		expect(out).not.toContain(variantUrl("img-1", 1600));
		expect(out.match(/rel="preload"/g)).toHaveLength(1);
		expect(out).toContain(`<link rel="preload" as="image" href="${HERO_SRC}"`);
		expect(out).toContain('imagesizes="100vw"');
	});

	// Renditions exist only for objects written since the variant pipeline
	// landed, and there is no backfill, so tying the preload to them would
	// give every already-published site nothing. Preloading the plain src is
	// the highest-yield change on these pages and needs no stored object.
	it("preloads the LCP image even when no rendition exists", async () => {
		exists.mockResolvedValue(false);

		const input = optimizeImageMarkup(pageWithLogoAndHero());
		const out = await emitResponsiveImages(input, { exists });

		expect(out).toContain(`<link rel="preload" as="image" href="${HERO_SRC}">`);
		expect(out).not.toContain("imagesrcset");
		expect(out).not.toContain("srcset=");
		expect(await emitResponsiveImages(out, { exists })).toBe(out);
	});

	it("fails open when the storage probe throws, preload included", async () => {
		exists.mockRejectedValue(new Error("R2 down"));

		const input = optimizeImageMarkup(pageWithLogoAndHero());
		const out = await emitResponsiveImages(input, { exists });

		expect(out).toContain(`<link rel="preload" as="image" href="${HERO_SRC}">`);
		expect(out).not.toContain("srcset=");
	});

	it("preloads no data URI and no image on a page it cannot elect for", async () => {
		exists.mockResolvedValue(true);

		const dataUri = [
			"<!doctype html><html><head></head><body><section>",
			'<img src="data:image/png;base64,AAAA" alt="Inline" width="10" height="10">',
			"</section></body></html>",
		].join("");
		const pastTheFold = [
			"<!doctype html><html><head></head><body>",
			"<section><p>Text hero</p></section>",
			`<section><img src="${HERO_SRC}" alt="Late" width="900" height="900"></section>`,
			"</body></html>",
		].join("");

		expect(await emitResponsiveImages(dataUri, { exists })).toBe(dataUri);
		expect(await emitResponsiveImages(pastTheFold, { exists })).not.toContain(
			"preload",
		);
	});

	it("is idempotent — a second run adds no srcset and no second preload", async () => {
		exists.mockImplementation(
			async (url: string) => url === variantUrl("img-1", 960),
		);

		const once = await emitResponsiveImages(
			optimizeImageMarkup(pageWithLogoAndHero()),
			{ exists },
		);

		expect(await emitResponsiveImages(once, { exists })).toBe(once);
		expect(once.match(/rel="preload"/g)).toHaveLength(1);
	});

	it("skips foreign origins, brand marks and images that already have a srcset", async () => {
		exists.mockResolvedValue(true);

		const html = [
			"<!doctype html><html><head></head><body>",
			'<header><img data-wandit-brand-image src="' +
				GALLERY_SRC +
				'" alt="Brand"></header>',
			'<section><img src="https://cdn.other.test/x.webp" alt="Foreign">',
			`<img src="${GALLERY_SRC}" alt="Kept" srcset="/already.webp 100w">`,
			`<img src="${HERO_SRC}" alt="Hero" width="1200" height="800"></section>`,
			"</body></html>",
		].join("");
		const out = await emitResponsiveImages(optimizeImageMarkup(html), {
			exists,
		});

		expect(attributesOf(out, "Brand").srcset).toBeUndefined();
		expect(attributesOf(out, "Foreign").srcset).toBeUndefined();
		expect(attributesOf(out, "Kept").srcset).toBe("/already.webp 100w");
		expect(attributesOf(out, "Hero").srcset).toContain(
			variantUrl("img-1", 1600),
		);
	});

	it("never builds renditions of a rendition", async () => {
		exists.mockResolvedValue(true);

		const html = [
			"<!doctype html><html><head></head><body><section>",
			`<img src="${variantUrl("img-1", 960)}" alt="Rendition" width="960" height="640">`,
			"</section></body></html>",
		].join("");
		const input = optimizeImageMarkup(html);
		const out = await emitResponsiveImages(input, { exists });

		expect(out).not.toContain("srcset=");
		expect(out).toContain(
			`<link rel="preload" as="image" href="${variantUrl("img-1", 960)}">`,
		);
		expect(exists).not.toHaveBeenCalled();
	});

	it("returns a page with no images byte-identical without probing", async () => {
		const html =
			"<!doctype html><html><head></head><body><p>Hi</p></body></html>";

		expect(await emitResponsiveImages(html, { exists })).toBe(html);
		expect(exists).not.toHaveBeenCalled();
	});
});
