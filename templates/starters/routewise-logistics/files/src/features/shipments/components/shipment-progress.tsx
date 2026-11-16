// The four steps of a shipment as a path: booked, assigned, picked up, and delivered or failed.
// The shipment page and the Next up panel of the home render it. A step that happened shows its time; the next step is marked.
import {
	capitalize,
	fillMessage,
	formatRelativeDay,
} from "~/features/logistics";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { CheckIcon, XIcon } from "~/shared/ui/icons";
import type { ShipmentDetail } from "../api/shipments.queries";

type ShipmentProgressProps = {
	shipment: ShipmentDetail;
};

/** A row of steps from the 36rem panel width, a column of steps under it. */
export function ShipmentProgress({ shipment }: ShipmentProgressProps) {
	const { t, locale } = useT();
	const dateTime = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		hour: "numeric",
		minute: "2-digit",
	});
	const isFailed = shipment.status === "failed";
	const steps = [
		{
			id: "booked",
			label: t("shipment.steps.booked"),
			occurredAt: shipment.bookedAt,
			pendingText: "",
		},
		{
			id: "assigned",
			label: t("shipment.steps.assigned"),
			occurredAt: shipment.assignedAt,
			pendingText: t("shipment.waitsForDriver"),
		},
		{
			id: "picked_up",
			label: t("shipment.steps.pickedUp"),
			occurredAt: shipment.pickedUpAt,
			pendingText: t("shipment.waitsForPickup"),
		},
		{
			id: "closed",
			label: t(isFailed ? "shipment.steps.failed" : "shipment.steps.delivered"),
			occurredAt: shipment.closedAt,
			pendingText: fillMessage(t("shipment.dueDay"), {
				day: formatRelativeDay(shipment.dueAt, Date.now(), locale),
			}),
		},
	];
	// The step that the shipment waits for: the first one with no time. -1 when the shipment is closed.
	const nextIndex = steps.findIndex((step) => step.occurredAt === null);

	return (
		<div className="@container/progress">
			<ol className="grid @xl/progress:grid-cols-4 @xl/progress:gap-0 gap-4">
				{steps.map((step, index) => {
					const isDone = step.occurredAt !== null;
					const isNext = index === nextIndex;
					const isLast = index === steps.length - 1;
					return (
						<li
							key={step.id}
							className="flex @xl/progress:flex-col items-start @xl/progress:gap-2 gap-3"
						>
							<div className="flex @xl/progress:w-full items-center">
								<span
									className={cn(
										"flex size-7 shrink-0 items-center justify-center rounded-full border font-semibold text-xs tabular-nums",
										isDone
											? isLast && isFailed
												? "border-destructive bg-destructive text-destructive-foreground"
												: "border-primary bg-primary text-primary-foreground"
											: isNext
												? "border-primary bg-accent text-accent-foreground"
												: "bg-muted text-muted-foreground",
									)}
								>
									{isDone ? (
										isLast && isFailed ? (
											<XIcon className="size-3.5" />
										) : (
											<CheckIcon className="size-3.5" />
										)
									) : (
										new Intl.NumberFormat(locale).format(index + 1)
									)}
								</span>
								{isLast ? null : (
									// The line to the next step. It takes the accent color when that step happened.
									<span
										aria-hidden="true"
										className={cn(
											"@xl/progress:block hidden h-0.5 flex-1",
											steps[index + 1]?.occurredAt ? "bg-primary" : "bg-border",
										)}
									/>
								)}
							</div>
							<div className="grid gap-0.5 @xl/progress:pe-4">
								<p
									className={cn(
										"font-medium text-sm",
										!isDone && !isNext && "text-muted-foreground",
									)}
								>
									{step.label}
								</p>
								<p className="text-muted-foreground text-xs tabular-nums">
									{step.occurredAt
										? dateTime.format(new Date(step.occurredAt))
										: capitalize(step.pendingText, locale)}
								</p>
							</div>
						</li>
					);
				})}
			</ol>
		</div>
	);
}
