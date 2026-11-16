// The badge of a lead that waits longer than the answer target of the agency.
// The attention list of the home renders it with the waiting time. The leads table renders it beside the status.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { fillMessage } from "../lib/format";

type LateBadgeProps = {
	/** The waiting time as a text, for example "7d". With it, the badge reads "Late · 7d". */
	waited?: string;
};

/** A tint of the destructive color with its own text, like the success and warning badges of the kit. */
export function LateBadge({ waited }: LateBadgeProps) {
	const { t } = useT();
	return (
		<Badge
			variant="outline"
			className="border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/10 hover:text-destructive"
		>
			{waited === undefined
				? t("agency.late")
				: fillMessage(t("agency.lateFor"), { time: waited })}
		</Badge>
	);
}
