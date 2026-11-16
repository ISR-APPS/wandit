// The "Next up" panel of the home: the open shipment to handle first, large, with its key facts.
// DispatchPage renders it beside the queue and gives it the first row of the sorted queue.
// NextUpDetails adds the steps and the recipient under the key facts.
import { ArrowRightIcon, LightningIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { DueLabel, ShipmentStatusBadge } from "~/features/logistics";
import { LoadText, type Shipment } from "~/features/shipments";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { NextUpDetails } from "./next-up-details";

type NextUpCardProps = {
	/** The first row of the queue. undefined when no shipment is open. */
	shipment: Shipment | undefined;
};

/** The panel keeps the height of the queue. Its action sits at the bottom. */
export function NextUpCard({ shipment }: NextUpCardProps) {
	const { t, locale } = useT();
	const date = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
						<LightningIcon className="size-4" />
					</span>
					{t("dispatch.nextUp")}
				</CardTitle>
				<CardDescription>{t("dispatch.nextUpHint")}</CardDescription>
				{shipment ? (
					<CardAction>
						<ShipmentStatusBadge status={shipment.status} />
					</CardAction>
				) : null}
			</CardHeader>
			{shipment ? (
				<>
					<CardContent className="grid flex-1 content-start gap-5">
						<div className="grid gap-1.5">
							<h2 className="font-(--heading-weight) font-display text-4xl tabular-nums tracking-(--heading-tracking)">
								{shipment.reference}
							</h2>
							<p className="font-medium">{shipment.customerName}</p>
							<p className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground text-sm">
								{shipment.depotName}
								<ArrowRightIcon className="size-3.5 rtl:rotate-180" />
								{shipment.destination}
							</p>
						</div>
						{/* A late shipment gets a red tint, so the delay is the first thing the dispatcher sees. */}
						<div
							className={cn(
								"flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2.5 text-sm",
								shipment.lateDays > 0 ? "bg-destructive/10" : "bg-muted",
							)}
						>
							<DueLabel
								dueAt={shipment.dueAt}
								lateDays={shipment.lateDays}
								isOpen
							/>
							<span className="text-muted-foreground tabular-nums">
								{`${t("dispatch.due")} ${date.format(new Date(shipment.dueAt))}`}
							</span>
						</div>
						{/* The focus-queue recipe: a phone shows only the name, the due day, and Open, so the queue stays near the top. */}
						<dl className="@xl/main:grid hidden @4xl/main:grid-cols-2 @xl/main:grid-cols-3 gap-x-4 gap-y-4 text-sm">
							<div className="grid gap-1">
								<dt className="text-muted-foreground text-xs">
									{t("dispatch.service")}
								</dt>
								<dd className="font-medium">
									{t(`serviceLevel.${shipment.service}`)}
								</dd>
							</div>
							<div className="grid gap-1">
								<dt className="text-muted-foreground text-xs">
									{t("dispatch.booked")}
								</dt>
								<dd className="font-medium tabular-nums">
									{date.format(new Date(shipment.bookedAt))}
								</dd>
							</div>
							<div className="@4xl/main:col-span-2 grid gap-1">
								<dt className="text-muted-foreground text-xs">
									{t("dispatch.load")}
								</dt>
								<dd className="font-medium">
									<LoadText
										pallets={shipment.pallets}
										weightKg={shipment.weightKg}
									/>
								</dd>
							</div>
						</dl>
						<div className="@xl/main:block hidden">
							<NextUpDetails shipmentId={shipment.id} />
						</div>
					</CardContent>
					<CardFooter className="mt-auto">
						<Button asChild className="w-full max-md:min-h-11">
							<Link
								to="/app/shipments/$shipmentId"
								params={{ shipmentId: shipment.id }}
							>
								{t("dispatch.open")}
								<ArrowRightIcon className="rtl:rotate-180" />
							</Link>
						</Button>
					</CardFooter>
				</>
			) : (
				<CardContent className="flex-1">
					<p className="text-muted-foreground text-sm">
						{t("dispatch.nothingOpen")}
					</p>
				</CardContent>
			)}
		</Card>
	);
}
