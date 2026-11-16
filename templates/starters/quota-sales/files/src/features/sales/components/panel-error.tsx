// The error state inside one panel whose data loads after a click, for example the trend after a period change.
// The panel keeps its frame; this block fills its plot area. Try again refetches only that query.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";

type PanelErrorProps = {
	/** What failed, already translated. */
	message: string;
	onRetry: () => void;
	/** The height class of the plot that the error replaces, so the panel keeps its size. */
	className?: string;
};

/** One sentence and a Try again button, centered in the plot area. */
export function PanelError({ message, onRetry, className }: PanelErrorProps) {
	const { t } = useT();
	return (
		<div
			className={cn(
				"grid place-content-center justify-items-center gap-3 text-center",
				className,
			)}
		>
			<p role="alert" className="text-muted-foreground text-sm">
				{message}
			</p>
			<Button type="button" variant="outline" size="sm" onClick={onRetry}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
