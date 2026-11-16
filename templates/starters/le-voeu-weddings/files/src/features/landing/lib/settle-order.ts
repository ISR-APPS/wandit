// The settle order of the blocks of the reply card. ReplyCard and CardField give each block its place.
// landing.css reads --settle-index in .voeu-card-settle: each block starts 0.032 of the scroll after the one before.
import type { CSSProperties } from "react";

/** The inline style of the block at `index` of the card, from 0 at the top. */
export function settleOrder(
	index: number,
): CSSProperties & { "--settle-index": number } {
	return { "--settle-index": index };
}
