// The wordmark of the estate: two words in the serif face, the second one in bronze.
// SiteHeader and SiteMenu render it.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

type WordmarkProps = {
	/** The text size class. The header and the menu panel use different sizes. */
	className?: string;
};

/** A no-break space joins the two words, so the name never breaks in two lines. */
export function Wordmark({ className }: WordmarkProps) {
	const { t } = useT();
	return (
		<span
			className={cn(
				"whitespace-nowrap font-display font-normal tracking-[0.02em]",
				className,
			)}
		>
			{t("site.brandFirst")}
			{"\u00a0"}
			<span className="text-(--dlp-bronze-deep)">{t("site.brandSecond")}</span>
		</span>
	);
}
