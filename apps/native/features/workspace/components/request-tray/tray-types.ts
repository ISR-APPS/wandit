// Types for the native request tray — the mobile twin of the web system
// (apps/web .../chat/request-tray/types.ts). Every ask the AI makes is ONE
// component: a shared shell docked into the top of the PromptBox card with a
// swappable answer body. The web library carries thirteen body kinds; native
// now ships all thirteen — free-text, single-choice, world-pick,
// multi-select and media-drop are LIVE against the ask_user contract; the
// other eight (segmented, visual-pick, file-drop, link, amount, datetime,
// confirm, connect) are display-only until their slices activate, exactly
// as on web. Settled answers live in the chat transcript (AskUserGroupCard);
// the tray renders only the question that still needs an answer.

import type { WorldCard } from "@wandit/contracts";

export type ChipOption = { id: string; label: string };

/** Single-choice option enriched with its design-world card face (when the
    latest get_direction_candidates menu resolves the option's worldId). */
export type WorldCardOption = ChipOption & { card?: WorldCard };

/** Gradient swatch option for visual picks (hero directions, palettes).
    `preview` is a plain color on native — RN view backgrounds cannot take
    the web type's CSS gradient strings. */
export type VisualOption = {
	id: string;
	label: string;
	preview: string;
	/** Still streaming in — renders as a shimmer skeleton. */
	pending?: boolean;
};

/** One drafted upload inside the media-drop tray body. */
export type TrayMediaItem = {
	id: string;
	name: string;
	/** Local device uri for the thumbnail (images only). */
	previewUri: string | null;
	/** Present while the file is still uploading. */
	uploading?: { percent: number };
	error?: boolean;
};

/** The swappable answer body — the only part that changes between asks.
    Choice bodies carry DRAFTS: picking marks the chip; the composer's
    answer CTA confirms (web parity — no body answers on its own). */
export type TrayBody =
	| { kind: "free-text" } // the composer input IS the answer
	| { kind: "single-choice"; options: ChipOption[]; selectedId?: string }
	| {
			/** Taste question: options reference sampled design worlds — rendered
			    as tappable specimen cards (real font + colors), not text chips. */
			kind: "world-pick";
			options: WorldCardOption[];
			selectedId?: string;
	  }
	| { kind: "multi-select"; options: ChipOption[]; selectedIds: string[] }
	| {
			kind: "media-drop";
			items: TrayMediaItem[];
			/** Which pickers to offer, from the ask's accept kinds. */
			sources: { camera: boolean; library: boolean; files: boolean };
			/** False once maxFiles drafts exist — the picker row hides. */
			canAddMore: boolean;
	  }
	| { kind: "segmented"; options: ChipOption[]; selectedId?: string }
	| {
			kind: "visual-pick";
			options: VisualOption[];
			selectedId?: string;
			/** Quiet caption line under the swatches (web hoverHint — touch has
			    no hover, the line still reads as a hint). */
			hint?: string;
	  }
	| {
			kind: "file-drop";
			prompt: string;
			browse?: boolean;
			formatsHint?: string;
			icon?: "file" | "image";
	  }
	| { kind: "link"; value: string; verified?: string; error?: string }
	| {
			kind: "amount";
			value: string;
			unit: string;
			quickValues: string[];
			hint?: string;
	  }
	| {
			kind: "datetime";
			presets: ChipOption[];
			selectedId?: string;
			pickLabel?: string;
			hint?: string;
	  }
	| { kind: "confirm"; confirmLabel: string; cancelLabel: string }
	| { kind: "connect"; buttonLabel: string };

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
	/** The one escape hatch — always exactly one ("Decide for me"). Omit ONLY
	    for confirm ("consent can't be delegated", web parity). */
	escape?: { label: string };
	question?: string;
	/** Quiet line under the question. */
	helper?: string;
	body: TrayBody;
	step?: { current: number; total: number };
	/** The user is typing a free-form answer instead — the options dim and a
	    small ember note points at the composer. */
	typingOverride?: boolean;
};
