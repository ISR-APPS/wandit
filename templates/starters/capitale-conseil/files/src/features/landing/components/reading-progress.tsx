// The 2px navy hairline under the header. It is the format of the index spine below 1180px.
// SiteHeader renders it. useReadingProgress gives the scrolled share of the page.
import { useReadingProgress } from "../hooks/use-reading-progress";

/** A full-width line that grows from the start edge with the scroll. It is empty at the top and with no script. */
export function ReadingProgress() {
	const progress = useReadingProgress();
	return (
		<div aria-hidden="true" className="h-0.5 min-[73.75rem]:hidden">
			<div
				className="h-full origin-left bg-primary rtl:origin-right"
				style={{ transform: `scaleX(${progress})` }}
			/>
		</div>
	);
}
