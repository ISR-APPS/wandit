// One client line in the display face, on a full-width band of the hot ground.
// DriveSection renders it as its last block. It is the only social proof of the page.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { DISPLAY_TEXT, LABEL_TEXT, WRAP } from "../lib/type-styles";

/** The end of the quote is the light mustard: display text on the hot ground. The name sits at the end edge, on the baseline of the last line. */
export function QuoteBand() {
	const { t } = useT();
	return (
		<div className="sc-on-hot mt-[clamp(46px,6.5vh,80px)] bg-primary py-[clamp(32px,5vh,60px)] text-primary-foreground">
			<figure
				data-flick="l"
				className={cn(
					WRAP,
					"flex flex-wrap items-end justify-between gap-x-[clamp(14px,3vw,44px)] gap-y-4",
				)}
			>
				<blockquote
					className={cn(
						DISPLAY_TEXT,
						"max-w-[17em] flex-[1_1_320px] text-[clamp(1.6rem,3.9vw,3.3rem)] leading-[1.02]",
					)}
				>
					{t("drive.quoteStart")}{" "}
					<span className="text-(--sc-mustard-on-hot)">
						{t("drive.quoteAccent")}
					</span>
				</blockquote>
				<figcaption className={cn(LABEL_TEXT, "shrink-0 pb-[0.4em]")}>
					{t("drive.quoteAuthor")}
				</figcaption>
			</figure>
		</div>
	);
}
