// Shared motion classes of the home page. The sections that stagger a group of reveals read them.
// landing.css multiplies --mer-step by 90 ms for the delay of each block.

// The stagger classes, one per position in a group, 0 to 4. Tailwind finds only literal class names,
// so the list holds each one in full. A position past the end gets no delay.
const STAGGER_STEPS = [
	"[--mer-step:0]",
	"[--mer-step:1]",
	"[--mer-step:2]",
	"[--mer-step:3]",
	"[--mer-step:4]",
] as const;

/** The stagger class of a block at `position` in its group. */
export function staggerStep(position: number): string {
	return STAGGER_STEPS[position] ?? "";
}
