import { describe, expect, it } from "vitest";

import { toChatHistoryPage } from "./chat-history";

const LIMIT = 3;

// What `ChatsRepository.listHistoryRows` answers for a chat with the seq
// values 1 to `total`: the rows below the cursor, newest first, limit + 1.
function rowsBelow(total: number, cursor: string | null) {
	const below = cursor === null ? total + 1 : Number(cursor);
	return Array.from({ length: total }, (_, index) => ({ seq: total - index }))
		.filter((row) => row.seq < below)
		.slice(0, LIMIT + 1);
}

describe("toChatHistoryPage", () => {
	// 6 rows end on a full page with no extra row; 7 rows end on a short page.
	it.each([
		{
			total: 6,
			pages: [
				[4, 5, 6],
				[1, 2, 3],
			],
		},
		{ total: 7, pages: [[5, 6, 7], [2, 3, 4], [1]] },
	])("walks $total rows newest page first, each page in chat order, with no gap and no repeat", ({
		total,
		pages,
	}) => {
		const walked: number[][] = [];
		let cursor: string | null = null;
		do {
			// The loop reads `cursor` from `page`, so TypeScript needs the type here.
			const page: { items: { seq: number }[]; nextCursor: string | null } =
				toChatHistoryPage(rowsBelow(total, cursor), LIMIT);
			walked.push(page.items.map((row) => row.seq));
			cursor = page.nextCursor;
			// The length check stops a cursor that never turns null.
		} while (cursor !== null && walked.length <= total);

		expect(walked).toEqual(pages);
	});
});
