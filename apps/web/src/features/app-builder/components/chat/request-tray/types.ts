/**
 * Types of the request tray: the card that opens on top of the composer
 * when the agent asks the user something. A copy of the V1 tray types
 * (features/workspace/components/chat/request-tray/types.ts), cut to the
 * bodies the V2 `ask_user` tool uses. lib/use-request-tray.ts builds the
 * state; request-tray.tsx and tray-bodies.tsx render it.
 */

import type { WorldCard } from "@wandit/contracts";

/** One option of a chip question: the id the answer sends back and the label. */
export type ChipOption = { id: string; label: string };

/** One option of a design-world question; `card` is absent when the world has no preview. */
export type WorldCardOption = ChipOption & { card?: WorldCard };

/** One image the user picked for an `attachments` question. */
export type MediaItem = {
	/** Local id of the pick; the remove button sends it back. */
	id: string;
	name: string;
	/** CSS background of the thumbnail: the object URL of the picked image. */
	preview: string;
	/** True while the upload runs. */
	isUploading: boolean;
	/** True when the upload failed or the file broke the type or size rule. */
	hasError: boolean;
};

/** The answer body of the tray: the only part that changes between questions. */
export type TrayBody =
	// The composer textarea is the answer; the tray shows no body.
	| { kind: "free-text" }
	| { kind: "single-choice"; options: ChipOption[]; selectedId: string | null }
	| { kind: "multi-select"; options: ChipOption[]; selectedIds: string[] }
	| {
			kind: "world-pick";
			options: WorldCardOption[];
			selectedId: string | null;
	  }
	| {
			kind: "media-drop";
			/** File-input accept attribute: the image media types the upload route takes. */
			accept: string;
			items: MediaItem[];
			/** False once the user picked `maxFiles` images. */
			canAddMore: boolean;
	  };

/** Everything the tray shell shows for one question. */
export type RequestTrayState = {
	/** "media" for an image question, "question" for the others. */
	badge: "question" | "media";
	/** Mono micro-label that names what the agent needs, for example "Needs a detail". */
	label: string;
	question: string;
	/** Quiet line under the question, or null. */
	helper: string | null;
	/** Position in a round of several questions; null for a single question. */
	step: { current: number; total: number } | null;
	body: TrayBody;
	/** True while the user types an answer over the options; the options dim. */
	typingOverride: boolean;
};
