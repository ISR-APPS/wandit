// The agency name as a wordmark: "Horizon" in the display serif and "VOYAGES" in small tracked capitals.
// SiteHeader and SiteMenu render it. The footer sets the same two parts large on its own.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

type WordmarkProps = {
	/** Sets the size of the serif part. The capitals stay at 9.5px. */
	className?: string;
};

/** The name on one line. Screen readers read "Horizon Voyages". */
export function Wordmark({ className }: WordmarkProps) {
	const { t } = useT();
	return (
		<span
			className={cn(
				"inline-flex items-baseline gap-[9px] whitespace-nowrap font-display font-normal tracking-[0.06em]",
				className,
			)}
		>
			{t("site.wordmark")}
			<span className="font-sans font-semibold text-(--hz-ink-soft) text-[9.5px] uppercase tracking-[0.22em]">
				{t("site.wordmarkTag")}
			</span>
		</span>
	);
}
