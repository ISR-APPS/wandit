/**
 * The chat agent's surgical page-edit tools (V2 spec §5, contract §8):
 * get_page_outline / read_section / replace_section. They run inline in the
 * conversation (seconds, not minutes) against the CURRENT active version;
 * replace_section routes through the same ops pipeline as the HTTP endpoint
 * and produces a NEW immutable version.
 *
 * One factory for all three (they share deps), mirroring generate_page's
 * per-request factory pattern.
 */
import {
	type GetPageOutlineInput,
	type GetPageOutlineOutput,
	getPageOutlineInputSchema,
	getPageOutlineOutputSchema,
	type ReadSectionInput,
	type ReadSectionOutput,
	type ReplaceSectionInput,
	type ReplaceSectionOutput,
	readSectionInputSchema,
	readSectionOutputSchema,
	replaceSectionInputSchema,
	replaceSectionOutputSchema,
} from "@wandit/contracts";
import { type Tool, tool } from "ai";

import { getPageHtml } from "../../../../infrastructure/storage/r2";
import type { PageEditsService } from "../../../pages/application/services/page-edits.service";
import {
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
	read_section: Tool<ReadSectionInput, ReadSectionOutput>;
	replace_section: Tool<ReplaceSectionInput, ReplaceSectionOutput>;
};

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

	// Stamp-on-read for legacy pre-V2 versions (READ-ONLY — no version is
	// written): the stamper is deterministic, so the wids shown here match
	// what the first persisted edit will stamp for good.
	return {
		html: html.includes("data-wid=") ? html : stampHtml(html),
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
		replace_section: tool({
			description:
				"Surgically replace ONE section (matched by data-wid) with new " +
				"HTML. Writes a NEW page version and makes it live. Keep the " +
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
	read_section: tool({
		inputSchema: readSectionInputSchema,
		outputSchema: readSectionOutputSchema,
	}),
	replace_section: tool({
		inputSchema: replaceSectionInputSchema,
		outputSchema: replaceSectionOutputSchema,
	}),
};
