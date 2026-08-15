/**
 * The chat agent's surgical page-edit tools (V2 spec §5, contract §8):
 * get_page_outline / apply_element_ops / read_elements / read_theme /
 * read_section / insert_section / replace_section. They run inline in the
 * conversation (seconds, not minutes) against the CURRENT active version;
 * writes route through the same ops pipeline as the HTTP endpoint and produce
 * a NEW immutable version.
 *
 * One factory for all seven (they share deps), mirroring generate_page's
 * per-request factory pattern.
 */
import {
	type ApplyElementOpsInput,
	type ApplyElementOpsOutput,
	applyElementOpsInputSchema,
	applyElementOpsOutputSchema,
	CURATED_FONTS,
	type GetPageOutlineInput,
	type GetPageOutlineOutput,
	getPageOutlineInputSchema,
	getPageOutlineOutputSchema,
	type InsertSectionInput,
	type InsertSectionOutput,
	insertSectionInputSchema,
	insertSectionOutputSchema,
	type ReadElementsInput,
	type ReadElementsOutput,
	type ReadSectionInput,
	type ReadSectionOutput,
	type ReadThemeInput,
	type ReadThemeOutput,
	type ReplaceSectionInput,
	type ReplaceSectionOutput,
	readElementsInputSchema,
	readElementsOutputSchema,
	readSectionInputSchema,
	readSectionOutputSchema,
	readThemeInputSchema,
	readThemeOutputSchema,
	replaceSectionInputSchema,
	replaceSectionOutputSchema,
} from "@wandit/contracts";
import { type Tool, tool } from "ai";

import { getPageHtml } from "../../../../infrastructure/storage/r2";
import type { PageEditsService } from "../../../pages/application/services/page-edits.service";
import { extractRootTokens } from "../../../pages/domain/ops";
import {
	extractElementsHtml,
	extractOutline,
	extractSectionHtml,
	stampHtml,
} from "../../../pages/domain/stamp";
import type { PagesRepository } from "../../../pages/infrastructure/persistence/pages.repository";

export type PageEditToolsDeps = {
	pageEditsService: PageEditsService;
	pagesRepository: PagesRepository;
	projectId: string;
};

export type PageEditTools = {
	get_page_outline: Tool<GetPageOutlineInput, GetPageOutlineOutput>;
	apply_element_ops: Tool<ApplyElementOpsInput, ApplyElementOpsOutput>;
	read_elements: Tool<ReadElementsInput, ReadElementsOutput>;
	read_theme: Tool<ReadThemeInput, ReadThemeOutput>;
	read_section: Tool<ReadSectionInput, ReadSectionOutput>;
	insert_section: Tool<InsertSectionInput, InsertSectionOutput>;
	replace_section: Tool<ReplaceSectionInput, ReplaceSectionOutput>;
};

const CURATED_FONT_IDS = CURATED_FONTS.map((font) => font.id).join(", ");

// Active version's stamped HTML, or null when there is no page (or R2 is
// unreachable — the tools answer honestly instead of throwing).
async function loadActiveHtml(
	deps: PageEditToolsDeps,
): Promise<{ html: string; versionNumber: number } | null> {
	const page = await deps.pagesRepository.findActivePageByProjectUnchecked(
		deps.projectId,
	);

	if (!page?.version) {
		return null;
	}

	const html = await getPageHtml(page.version.r2Key);

	if (html === null) {
		return null;
	}

	// Read-only deterministic stamping keeps AI-visible wids identical to the
	// preview and mutation paths, including leaves added by newer predicates.
	return {
		html: stampHtml(html),
		versionNumber: page.version.number,
	};
}

export function createPageEditTools(deps: PageEditToolsDeps): PageEditTools {
	return {
		get_page_outline: tool({
			description:
				"Map of the current page: every section's data-wid, tag, a text " +
				"snippet, and element count. Cheap — call it before reading or " +
				"editing sections.",
			inputSchema: getPageOutlineInputSchema,
			outputSchema: getPageOutlineOutputSchema,
			execute: async (): Promise<GetPageOutlineOutput> => {
				try {
					const active = await loadActiveHtml(deps);

					if (!active) {
						return {
							message: "No page has been generated yet.",
							status: "no-page",
						};
					}

					return {
						sections: extractOutline(active.html).sections,
						status: "ok",
						versionNumber: active.versionNumber,
					};
				} catch {
					return {
						message: "The page could not be loaded right now.",
						status: "no-page",
					};
				}
			},
		}),
		apply_element_ops: tool({
			description:
				"Use for small targeted page changes: text content, image replacement " +
				"with image-src when a final Wandit-hosted URL is known, element " +
				"styles, link hrefs, removing an element, inserting one element inside " +
				"an existing section or container, hosted section backgrounds and " +
				"padding, or " +
				"theme-wide changes with set-tokens. set-tokens edits the page's 11 " +
				":root tokens and restyles the whole page consistently. Use one op " +
				"per user ask when possible. For one new section, use insert_section. " +
				"For restructuring one section's layout or content, use read_section + " +
				"replace_section; for multi-section redesigns, use generate_page. Never " +
				"introduce raw colors when a token fits. Feature additions or removals " +
				"require read_section + replace_section. " +
				"set-tokens values: colors are hex; radius is px, rem, " +
				`or em; font-heading and font-body are curated font IDs: ${CURATED_FONT_IDS}.`,
			inputSchema: applyElementOpsInputSchema,
			outputSchema: applyElementOpsOutputSchema,
			execute: async ({ ops }): Promise<ApplyElementOpsOutput> => {
				try {
					const result = await deps.pageEditsService.applyAiOps(
						deps.projectId,
						ops,
					);

					if (result.status === "applied") {
						return {
							message: `Done — version ${result.versionNumber} is live in the Page tab.`,
							status: "applied",
							versionNumber: result.versionNumber,
						};
					}

					return { message: result.message, status: result.status };
				} catch (error) {
					return {
						message:
							"The edit could not be applied: " +
							(error instanceof Error ? error.message : String(error)),
						status: "rejected",
					};
				}
			},
		}),
		read_elements: tool({
			description:
				"Read the current HTML of specific elements by data-wid before " +
				"making targeted edits when the outline snippet is not enough. " +
				"Cheaper than read_section.",
			inputSchema: readElementsInputSchema,
			outputSchema: readElementsOutputSchema,
			execute: async ({ wids }): Promise<ReadElementsOutput> => {
				try {
					const active = await loadActiveHtml(deps);

					if (!active) {
						return {
							message: "No page has been generated yet.",
							status: "no-page",
						};
					}

					return {
						elements: extractElementsHtml(active.html, wids),
						status: "ok",
						versionNumber: active.versionNumber,
					};
				} catch {
					return {
						message: "The page could not be loaded right now.",
						status: "no-page",
					};
				}
			},
		}),
		read_theme: tool({
			description:
				"Read the page theme's 11 reserved :root tokens before theme-wide " +
				"changes. Change them with apply_element_ops set-tokens.",
			inputSchema: readThemeInputSchema,
			outputSchema: readThemeOutputSchema,
			execute: async (): Promise<ReadThemeOutput> => {
				try {
					const active = await loadActiveHtml(deps);

					if (!active) {
						return {
							message: "No page has been generated yet.",
							status: "no-page",
						};
					}

					return {
						status: "ok",
						tokens: extractRootTokens(active.html),
						versionNumber: active.versionNumber,
					};
				} catch {
					return {
						message: "The page could not be loaded right now.",
						status: "no-page",
					};
				}
			},
		}),
		read_section: tool({
			description:
				"Read ONE section's HTML by its data-wid (from get_page_outline). " +
				"Read before you rewrite.",
			inputSchema: readSectionInputSchema,
			outputSchema: readSectionOutputSchema,
			execute: async ({ wid }): Promise<ReadSectionOutput> => {
				try {
					const active = await loadActiveHtml(deps);

					if (!active) {
						return {
							message: "No page has been generated yet.",
							status: "no-page",
							wid,
						};
					}

					const html = extractSectionHtml(active.html, wid);

					if (html === null) {
						const wids = extractOutline(active.html)
							.sections.map((section) => section.wid)
							.join(", ");

						return {
							message:
								`No unique element carries data-wid="${wid}". ` +
								`Section wids on this page: ${wids || "none"}.`,
							status: "not-found",
							wid,
						};
					}

					return { html, status: "ok", wid };
				} catch {
					return {
						message: "The page could not be loaded right now.",
						status: "no-page",
						wid,
					};
				}
			},
		}),
		insert_section: tool({
			description:
				"Surgically insert ONE new section before or after an existing section " +
				"(matched by data-wid). Writes a NEW page version and makes it live. " +
				"You do not need to preserve data-wid attributes; the server stamps them. " +
				"For interactive features, use the data-wandit-* catalog described by " +
				"replace_section. " +
				"For broader redesigns, use generate_page with a full brief instead.",
			inputSchema: insertSectionInputSchema,
			outputSchema: insertSectionOutputSchema,
			execute: async ({
				anchorWid,
				html,
				position,
			}): Promise<InsertSectionOutput> => {
				try {
					const result = await deps.pageEditsService.applyAiOps(
						deps.projectId,
						[
							{
								kind: "insert-section",
								position,
								value: html,
								wid: anchorWid,
							},
						],
					);

					if (result.status === "applied") {
						return {
							message: `Done — version ${result.versionNumber} is live in the Page tab.`,
							status: "applied",
							versionNumber: result.versionNumber,
						};
					}

					return { message: result.message, status: result.status };
				} catch (error) {
					return {
						message:
							"The edit could not be applied: " +
							(error instanceof Error ? error.message : String(error)),
						status: "rejected",
					};
				}
			},
		}),
		replace_section: tool({
			description:
				"Surgically replace ONE section (matched by data-wid) with new " +
				"HTML. Return HTML only, never JavaScript. Interactive behavior uses " +
				"data-wandit-toast, data-wandit-carousel, data-wandit-lightbox, " +
				"data-wandit-counter, data-wandit-phone-mask, data-wandit-confetti, " +
				"data-wandit-countdown, data-wandit-stock-counter, or " +
				"data-wandit-whatsapp-float marker attributes. Iframes are limited to " +
				"HTTPS YouTube, Vimeo, or Google Maps embeds. Writes a NEW page version " +
				"and makes it live. Keep the " +
				"section's data-wid on the root element you return. For redesigns " +
				"touching several sections or the overall look, use generate_page " +
				"with a full brief instead.",
			inputSchema: replaceSectionInputSchema,
			outputSchema: replaceSectionOutputSchema,
			execute: async ({ html, wid }): Promise<ReplaceSectionOutput> => {
				try {
					const result = await deps.pageEditsService.applyAiOps(
						deps.projectId,
						[{ kind: "replace-section", value: html, wid }],
					);

					if (result.status === "applied") {
						return {
							message: `Done — version ${result.versionNumber} is live in the Page tab.`,
							status: "applied",
							versionNumber: result.versionNumber,
						};
					}

					return { message: result.message, status: result.status };
				} catch (error) {
					return {
						message:
							"The edit could not be applied: " +
							(error instanceof Error ? error.message : String(error)),
						status: "rejected",
					};
				}
			},
		}),
	};
}

// Execute-less twins used ONLY for validateUIMessages in the controller:
// same schemas, zero side effects — validating history must never read R2
// or write a version.
export const pageEditToolsSchemaOnly: PageEditTools = {
	get_page_outline: tool({
		inputSchema: getPageOutlineInputSchema,
		outputSchema: getPageOutlineOutputSchema,
	}),
	apply_element_ops: tool({
		inputSchema: applyElementOpsInputSchema,
		outputSchema: applyElementOpsOutputSchema,
	}),
	read_elements: tool({
		inputSchema: readElementsInputSchema,
		outputSchema: readElementsOutputSchema,
	}),
	read_theme: tool({
		inputSchema: readThemeInputSchema,
		outputSchema: readThemeOutputSchema,
	}),
	read_section: tool({
		inputSchema: readSectionInputSchema,
		outputSchema: readSectionOutputSchema,
	}),
	insert_section: tool({
		inputSchema: insertSectionInputSchema,
		outputSchema: insertSectionOutputSchema,
	}),
	replace_section: tool({
		inputSchema: replaceSectionInputSchema,
		outputSchema: replaceSectionOutputSchema,
	}),
};
