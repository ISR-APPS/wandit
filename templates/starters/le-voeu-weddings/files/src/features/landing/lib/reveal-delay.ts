// The stagger of the scroll reveals. Sections with a row of blocks (columns, stages, packages) give each block its delay.
// landing.css reads --reveal-delay in the "shown" transition of [data-reveal="lift"].
import type { CSSProperties } from "react";

/** The inline style of the block at `index`: 0.09s more delay for each block, like the stagger of the world. */
export function revealDelay(
	index: number,
): CSSProperties & { "--reveal-delay": string } {
	return { "--reveal-delay": `${index * 0.09}s` };
}
