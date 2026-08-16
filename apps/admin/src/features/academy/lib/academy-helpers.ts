import {
	ACADEMY_GUIDE_CATEGORIES,
	type AcademyGuideCategory,
} from "@wandit/contracts";

const guideDateFormatter = new Intl.DateTimeFormat("en-US", {
	day: "numeric",
	month: "short",
	year: "numeric",
});

const htmlEntityValues: Readonly<Record<string, string>> = {
	amp: "&",
	apos: "'",
	gt: ">",
	lt: "<",
	nbsp: " ",
	quot: '"',
};

type SaveableGuide = {
	title: string;
	youtubeVideoId: string | null | undefined;
	bodyHtml: string;
};

const academyCategoryLabels = {
	"getting-started": "Getting started",
	websites: "Websites",
	"landing-pages": "Landing pages",
	ads: "Ads",
	leads: "Leads",
	marketing: "Marketing",
	domains: "Domains",
	apps: "Apps & integrations",
} satisfies Record<AcademyGuideCategory, string>;

export function canSaveGuide({
	title,
	youtubeVideoId,
	bodyHtml,
}: SaveableGuide): boolean {
	return (
		title.trim().length > 0 &&
		(Boolean(youtubeVideoId?.trim()) || hasGuideBodyContent(bodyHtml))
	);
}

/** Returns whether guide HTML contains visible text or at least one image. */
export function hasGuideBodyContent(bodyHtml: string): boolean {
	return (
		/<img(?:\s|\/?>)/iu.test(bodyHtml) || guideBodyText(bodyHtml).length > 0
	);
}

/** Moves back one page when an item removal would empty the current page. */
export function pageAfterListItemRemoval(
	currentPage: number,
	itemCount: number,
): number {
	return currentPage > 1 && itemCount === 1 ? currentPage - 1 : currentPage;
}

export function isAcademyGuideCategory(
	category: string,
): category is AcademyGuideCategory {
	return ACADEMY_GUIDE_CATEGORIES.some((value) => value === category);
}

export function academyCategoryLabel(category: string): string {
	return isAcademyGuideCategory(category)
		? academyCategoryLabels[category]
		: category;
}

export function formatGuideDate(value: string | null): string {
	if (!value) {
		return "—";
	}

	return guideDateFormatter.format(new Date(value));
}

export function guideBodyText(bodyHtml: string): string {
	return decodeHtmlEntities(bodyHtml.replace(/<[^>]*>/g, " "))
		.replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

export function errorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback;
}

function decodeHtmlEntities(value: string): string {
	return value.replace(
		/&(#\d+|#x[\da-f]+|amp|apos|gt|lt|nbsp|quot);/gi,
		(entity, name: string) => {
			if (name.startsWith("#")) {
				const hexadecimal = name[1]?.toLowerCase() === "x";
				const codePoint = Number.parseInt(
					name.slice(hexadecimal ? 2 : 1),
					hexadecimal ? 16 : 10,
				);

				if (
					Number.isInteger(codePoint) &&
					codePoint >= 0 &&
					codePoint <= 0x10ffff
				) {
					return String.fromCodePoint(codePoint);
				}
				return entity;
			}

			return htmlEntityValues[name.toLowerCase()] ?? entity;
		},
	);
}
