// Overlay chrome for the page preview. The floating bars sit ON the user's
// page, whose palette is unknown — so like the prototype they are always
// dark, readable over any landing page in either app theme.

export const PAGE_CHROME = {
	/** Pill/bar fill — prototype oklch(0.26 0.014 55 / 0.94). */
	bar: "rgba(38,34,29,0.95)",
	/** Deeper card fill for the comment composer. */
	card: "rgba(31,27,23,0.97)",
	text: "#F5F1EA",
	textMuted: "rgba(222,214,203,0.72)",
	faint: "rgba(255,255,255,0.09)",
	border: "rgba(255,255,255,0.16)",
} as const;
