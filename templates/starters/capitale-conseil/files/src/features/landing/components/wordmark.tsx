// The serif wordmark of the firm: "Capitale" in ink and "Conseil" in navy.
// The header, the phone menu, and the footer render it. The size comes from the caller.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

type WordmarkProps = {
	/** Size and layout classes. The face and the two colors are fixed. */
	className?: string;
};

/** The two words of the brand in one line that never wraps. */
export function Wordmark({ className }: WordmarkProps) {
	const { t } = useT();
	return (
		<span
			className={cn(
				"whitespace-nowrap font-display font-normal tracking-[-0.01em]",
				className,
			)}
		>
			{t("site.brandFirst")}{" "}
			<span className="text-primary">{t("site.brandSecond")}</span>
		</span>
	);
}
