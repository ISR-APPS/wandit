// A dimension line that measures the element it sits in: ticks, arrowheads, and its true length on screen.
// HeroSection puts it under the title column, SheetsSection over the wide sheet. It reads its own width.
// The label shows the real millimetres of the screen at 96 CSS pixels per inch, so the cote is honest.
import { useRef } from "react";
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useElementWidth } from "../hooks/use-element-width";
import { formatScreenMillimetres } from "../lib/format";

type MeasuredCoteProps = {
	/** The text before the value, for example "L =". */
	label: TranslationKey;
	/** The width in CSS pixels that the server render prints before the browser measures. */
	fallbackWidth: number;
	className?: string;
};

/** A full-width dimension line. It is decoration for screen readers, so it is hidden from them. */
export function MeasuredCote({
	label,
	fallbackWidth,
	className,
}: MeasuredCoteProps) {
	const { t, locale } = useT();
	const lineRef = useRef<HTMLDivElement>(null);
	const width = useElementWidth(lineRef, fallbackWidth);
	return (
		<div
			ref={lineRef}
			aria-hidden="true"
			className={cn("relative h-[30px] text-foreground", className)}
		>
			<span className="absolute start-0 top-[13px] h-[13px] w-[1.5px] bg-foreground" />
			<span className="absolute end-0 top-[13px] h-[13px] w-[1.5px] bg-foreground" />
			<span className="absolute inset-x-0 top-[18.5px] h-[1.5px] bg-foreground" />
			{/* Two CSS triangles of 8 x 8px. The logical borders point them outward in both directions. */}
			<span className="absolute start-0 top-[15.25px] size-0 border-y-4 border-y-transparent border-e-8 border-e-foreground" />
			<span className="absolute end-0 top-[15.25px] size-0 border-y-4 border-y-transparent border-s-8 border-s-foreground" />
			<span className="absolute start-1/2 top-0 -translate-x-1/2 whitespace-nowrap font-display text-[0.6875rem] tracking-[0.08em] rtl:translate-x-1/2">
				{t(label)} {formatScreenMillimetres(locale, width)}
			</span>
		</div>
	);
}
