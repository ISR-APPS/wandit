// The day of the next service of a vehicle as a relative label: "In 9 days", or "3 days ago" in red.
// The vehicle card and the vehicle panel render it.
import { capitalize, formatRelativeDay } from "~/features/logistics";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { serviceStateOf } from "../lib/service";

type ServiceLabelProps = {
	/** The day of the next service, as ISO. */
	serviceDueAt: string;
	/** Calendar days from today to that day. Negative for an overdue service. */
	serviceInDays: number;
};

/** An overdue service is red, a service that is due soon is amber. The words carry the meaning too. */
export function ServiceLabel({
	serviceDueAt,
	serviceInDays,
}: ServiceLabelProps) {
	const { locale } = useT();
	const state = serviceStateOf(serviceInDays);
	return (
		<span
			className={cn(
				"font-medium",
				state === "overdue" && "text-destructive",
				state === "soon" && "text-warning",
			)}
		>
			{capitalize(formatRelativeDay(serviceDueAt, Date.now(), locale), locale)}
		</span>
	);
}
