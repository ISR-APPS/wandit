// Types for the request-tray system — the "waiting on you" half of the chat
// states (design/Wandit-Workspace-v3.html, turn 10 "Every way Wandit waits on
// you"). Every ask the AI makes is ONE component: a shared shell (header +
// escape hatch + dismiss + question) docked into the top of the PromptBox
// card, with a swappable answer body. These types describe that shell and its
// twelve body kinds; the live ask_user plumbing will build these states from
// stream parts later.

export type ChipOption = { id: string; label: string };

/** Gradient swatch card for visual picks (hero directions, palettes).
    `preview` is a CSS background — decorative artwork, not chrome tokens. */
export type VisualOption = {
	id: string;
	label: string;
	preview: string;
	/** Still streaming in (design 7a) — renders as a shimmer skeleton. */
	pending?: boolean;
};

export type MediaItem = {
	id: string;
	name: string;
	/** CSS background standing in for the thumbnail. */
	preview: string;
	/** Present while the file is still uploading. */
	uploading?: { percent: number };
};

/** The swappable answer body — the only part of the tray that changes
    between asks (design 10b–10m). */
export type TrayBody =
	| { kind: "free-text" } // 10b — the composer input IS the answer
	| { kind: "single-choice"; options: ChipOption[]; selectedId?: string } // 10c
	| { kind: "multi-select"; options: ChipOption[]; selectedIds?: string[] } // 10d
	| { kind: "segmented"; options: ChipOption[]; selectedId?: string } // 10e
	| {
			kind: "visual-pick"; // 10f
			options: VisualOption[];
			selectedId?: string;
			hoverHint?: string;
	  }
	| {
			kind: "media-drop"; // 10g empty / 9b filled
			title?: string;
			formatsHint?: string;
			tip?: string;
			items?: MediaItem[];
	  }
	| {
			kind: "file-drop"; // 10h (also the 10p founder-photo row)
			prompt: string;
			browse?: boolean;
			formatsHint?: string;
			icon?: "file" | "image";
	  }
	| { kind: "link"; value: string; verified?: string; error?: string } // 10i
	| {
			kind: "amount"; // 10j
			value: string;
			unit: string;
			quickValues: string[];
			hint?: string;
	  }
	| {
			kind: "datetime"; // 10k
			presets: ChipOption[];
			selectedId?: string;
			pickLabel?: string;
			hint?: string;
	  }
	| { kind: "confirm"; confirmLabel: string; cancelLabel: string } // 10l
	| { kind: "connect"; buttonLabel: string }; // 10m

export type TrayBadgeIcon =
	| "question"
	| "media"
	| "file"
	| "link"
	| "calendar"
	| "access"
	| "confirm"
	| "spinner";

export type RequestTrayState = {
	badge: TrayBadgeIcon;
	/** Mono micro-label naming what's needed, e.g. "Needs a detail". */
	label: string;
	/** ember (default) = waiting on you · amber = consent · muted = optional. */
	labelTone?: "ember" | "amber" | "muted";
	/** Quiet mono text at the header's end (e.g. total upload size "24.6 MB"). */
	meta?: string;
	/** The one escape hatch — "always exactly one: Decide for me · Use
	    placeholders · Skip. Never zero, never two." Omit ONLY for confirm
	    ("consent can't be delegated"). */
	escape?: { label: string; icon?: "shuffle" };
	question?: string;
	/** Quiet line under the question (helper, or a confirm's consequence). */
	helper?: string;
	body: TrayBody;
	/** The user is typing a free-form answer instead — the body's options dim
	    and a small ember note points at the composer (design 10n state 2). */
	typingOverride?: boolean;
};
