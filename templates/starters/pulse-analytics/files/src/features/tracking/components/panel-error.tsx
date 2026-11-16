// The error state inside one panel: what failed, and a button that reads the data again.
// A panel whose query key changes after a click (a period, a chosen event) renders it at the height of its content.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";

type PanelErrorProps = {
	/** What did not load, already translated. */
	message: string;
	/** Reads the data of the panel again, normally `query.refetch`. */
	onRetry: () => void;
	/** The height class of the content that the error replaces, for example "h-72". */
	className?: string;
};

/** The panel keeps its size, so the page does not jump when a read fails. */
export function PanelError({ message, onRetry, className }: PanelErrorProps) {
	const { t } = useT();
	return (
		<div
			className={cn(
				"grid content-center justify-items-center gap-3 text-center",
				className,
			)}
		>
			<p className="text-sm" role="alert">
				{message}
			</p>
			<Button type="button" variant="outline" size="sm" onClick={onRetry}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
