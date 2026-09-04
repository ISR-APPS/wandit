/**
 * Decides at stash time whether a signed-out draft may auto-create a project
 * (a paid action) after auth. Only drafts whose generation can actually run,
 * and whose price the visitor saw, qualify:
 * - staged attachments cannot survive the redirect → the generation would run
 *   without the user's files;
 */
export function canDraftAutostart(attachmentCount: number): boolean {
	if (attachmentCount > 0) return false;
	return true;
}
