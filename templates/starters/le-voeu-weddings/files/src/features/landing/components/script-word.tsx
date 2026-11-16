// One script word of the home page, drawn as an inline SVG in the rose of the theme.
// HeroSection, WeddingsSection, and StationerySection render it. It reads the outlines of lib/script-outlines.ts.
// The word is decoration: screen readers skip it, and the text next to it carries the meaning.
import type { CSSProperties } from "react";
import { cn } from "~/shared/lib/utils";
import { SCRIPT_OUTLINES, type ScriptWordKey } from "../lib/script-outlines";

type ScriptWordProps = {
	/** Which word to draw. */
	word: ScriptWordKey;
	/** Size and place. The word is as tall as its ink at the font-size of this class, so a text-[...] class sizes it. */
	className?: string;
	/** "write" lets use-scroll-reveal.ts write the word in from the start side when it scrolls into view. */
	reveal?: "write";
};

/** The ink box of the outline becomes the size of the SVG, in em of the font-size of `className`. */
export function ScriptWord({ word, className, reveal }: ScriptWordProps) {
	const outline = SCRIPT_OUTLINES[word];
	// The outlines use a type size of 100 units, so 100 units are 1em.
	const size: CSSProperties = {
		width: `${outline.width / 100}em`,
		height: `${outline.height / 100}em`,
	};
	return (
		<svg
			aria-hidden="true"
			focusable="false"
			viewBox={outline.viewBox}
			data-reveal={reveal}
			style={size}
			className={cn(
				"pointer-events-none block text-(--voeu-rose-ink)",
				className,
			)}
		>
			<path d={outline.d} fill="currentColor" />
		</svg>
	);
}
