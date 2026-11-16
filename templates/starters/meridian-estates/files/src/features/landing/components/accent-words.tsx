// A sentence with one bronze italic word or phrase, the single accent that each Meridian title allows.
// The hero, intro, portfolio, residence, and contact sections render it inside their own heading tag.
import type { ReactNode } from "react";

type AccentWordsProps = {
	/** The words before the accent. A space separates them from it. */
	start: ReactNode;
	/** The accent words, set in bronze italics. */
	accent: ReactNode;
	/** The words after the accent, or nothing when the accent ends the sentence. */
	end?: ReactNode;
};

/** Inline text only: the parent heading sets the face, the size, and the line breaks. */
export function AccentWords({ start, accent, end }: AccentWordsProps) {
	return (
		<>
			{start} <em className="text-primary italic">{accent}</em>
			{end === undefined ? null : <> {end}</>}
		</>
	);
}
