import type { ComposerMetadata } from "@wandit/contracts";

/**
 * Decides at stash time whether a signed-out draft may auto-create a project
 * (a paid action) after auth. Only drafts whose generation can actually run,
 * and whose price the visitor saw, qualify:
 * - staged attachments cannot survive the redirect → the generation would run
 *   without the user's files;
 * - source-image outputs need an upload that cannot survive it either;
 * - video drafts bill more than the landing hero ever displays.
 * The source-asset rule is registry-driven (injected predicate), so a future
 * source-first output is prefill-only by default rather than silently billable.
 */
export function canDraftAutostart(
	composer: ComposerMetadata | undefined,
	attachmentCount: number,
	outputRequiresSourceImage: (outputId: string) => boolean,
): boolean {
	if (attachmentCount > 0) return false;
	if (!composer) return true;
	if (composer.mode === "video") return false;
	if (composer.output && outputRequiresSourceImage(composer.output)) {
		return false;
	}
	return true;
}
