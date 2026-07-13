// Types for the native request tray — the mobile twin of the web system
// (apps/web .../chat/request-tray/types.ts). Every ask the AI makes is ONE
// component: a shared shell docked into the top of the PromptBox card with a
// swappable answer body. The web library carries twelve body kinds; native
// ports only the three the live ask_user contract recognizes — more kinds
// join the union when their slices activate.

export type ChipOption = { id: string; label: string };

/** The swappable answer body — the only part that changes between asks. */
export type TrayBody =
	| { kind: "free-text" } // the composer input IS the answer
	| { kind: "single-choice"; options: ChipOption[] }
	| { kind: "multi-select"; options: ChipOption[]; selectedIds: string[] };

export type TrayBadgeIcon = "question" | "spinner";

/** Answered/delegated questions collapse to receipt rows stacked above the
    active question. */
export type TrayReceipt = {
	kind: "answered" | "delegated";
	label: string;
	value: string;
};

export type RequestTrayState = {
	badge: TrayBadgeIcon;
	/** Mono micro-label naming what's needed, e.g. "Needs a detail". */
	label: string;
	/** The one escape hatch — always exactly one ("Decide for me"). */
	escape?: { label: string };
	question?: string;
	/** Quiet line under the question. */
	helper?: string;
	receipts?: TrayReceipt[];
	body: TrayBody;
	/** The user is typing a free-form answer instead — the options dim and a
	    small ember note points at the composer. */
	typingOverride?: boolean;
};
