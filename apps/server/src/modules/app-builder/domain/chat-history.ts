/**
 * Page rule of the V2 chat history route (WANDIT-204).
 * `ChatHistoryService` calls it with the rows of
 * `ChatsRepository.listHistoryRows`. No database and no HTTP here.
 */

/**
 * Cuts one page from rows read newest first, plus one extra row when an
 * older page exists. Answers the page in chat order, the oldest row first.
 * The `seq` of that oldest row is the cursor of the next older page.
 */
export function toChatHistoryPage<Row extends { seq: number }>(
	rowsNewestFirst: readonly Row[],
	limit: number,
): { items: Row[]; nextCursor: string | null } {
	const page = rowsNewestFirst.slice(0, limit);
	const oldest = page.at(-1);
	// Only the extra row proves that an older page exists. The next page
	// reads the rows below the oldest row of this page.
	const hasOlderPage = rowsNewestFirst.length > limit;

	return {
		items: page.reverse(),
		nextCursor: hasOlderPage && oldest ? String(oldest.seq) : null,
	};
}
