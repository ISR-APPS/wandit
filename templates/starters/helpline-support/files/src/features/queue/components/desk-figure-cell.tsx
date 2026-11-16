// One cell of the desk figures strip: the label, the value, and the change against the previous period.
// DeskFiguresStrip renders one per figure. The value format follows the kind: a count, a time, or a share.
import { formatDuration } from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import type { DeskFigure } from "../api/desk.queries";
import { FigureChange } from "./figure-change";

type DeskFigureCellProps = {
	figure: DeskFigure;
	/** The translated label of the figure. */
	label: string;
};

/** The cell draws its top and start rule. The strip moves the grid by 1 px, so the rules at the edge disappear. */
export function DeskFigureCell({ figure, label }: DeskFigureCellProps) {
	const { locale } = useT();
	const value = !figure.hasValue
		? "—"
		: figure.kind === "minutes"
			? formatDuration(figure.value, locale)
			: new Intl.NumberFormat(
					locale,
					figure.kind === "percent"
						? { style: "percent", maximumFractionDigits: 0 }
						: {},
				).format(figure.value);
	return (
		<div className="grid content-start gap-1 border-s border-t px-4 py-3.5">
			<p className="label-text text-muted-foreground text-xs">{label}</p>
			<p className="font-numeric text-xl tabular-nums">{value}</p>
			<FigureChange change={figure.change} goodWhen={figure.goodWhen} />
		</div>
	);
}
