// The queue of the home: the open shipments under one tab per status, the soonest due day first.
// DispatchPage renders it beside "Next up" and gives it the sorted open rows. It shows at most QUEUE_SIZE rows.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	DueLabel,
	fillMessage,
	OPEN_SHIPMENT_STATUSES,
	type OpenShipmentStatus,
	pluralForm,
	ShipmentStatusBadge,
	StatusTabs,
} from "~/features/logistics";
import type { Shipment } from "~/features/shipments";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
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
import { ArrowRightIcon } from "~/shared/ui/icons";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import { QUEUE_SIZE } from "../lib/queue";

type QueueCardProps = {
	/** Every open shipment, in queue order. The first one is the "Next up" row. */
	shipments: Shipment[];
};

/** The status tab is local state. Each tab shows its count; a status with no open row has no tab. */
export function QueueCard({ shipments }: QueueCardProps) {
	const { t, locale } = useT();
	const [status, setStatus] = useState<OpenShipmentStatus | "all">("all");
	const number = new Intl.NumberFormat(locale);

	const tabs = OPEN_SHIPMENT_STATUSES.map((value) => ({
		value,
		label: t(`shipmentStatus.${value}`),
		count: shipments.filter((row) => row.status === value).length,
	})).filter((tab) => tab.count > 0);
	// A status can lose its last row. Its tab then disappears, so the queue shows all rows.
	const activeStatus = tabs.some((tab) => tab.value === status)
		? status
		: "all";
	const rowsOfTab =
		activeStatus === "all"
			? shipments
			: shipments.filter((row) => row.status === activeStatus);
	const rows = rowsOfTab.slice(0, QUEUE_SIZE);
	const nextUpId = shipments[0]?.id;

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("dispatch.queue")}</CardTitle>
				<CardDescription>{t("dispatch.queueHint")}</CardDescription>
				<CardAction>
					<Button
						asChild
						variant="ghost"
						size="sm"
						className="-me-2 max-md:min-h-11"
					>
						<Link to="/app/shipments">
							{t("dispatch.seeAll")}
							<ArrowRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid flex-1 content-start gap-3">
				<StatusTabs
					value={activeStatus}
					onValueChange={setStatus}
					allLabel={t("dispatch.all")}
					allCount={shipments.length}
					tabs={tabs}
				/>
				{/* Due and Status come first. A phone hides the place and the driver, so the table fits without a sideways scroll. */}
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t("shipments.shipment")}</TableHead>
							<TableHead>{t("shipments.due")}</TableHead>
							<TableHead>{t("shipments.status")}</TableHead>
							<TableHead className="max-sm:hidden">
								{t("shipments.destination")}
							</TableHead>
							<TableHead className="max-sm:hidden">
								{t("shipments.driver")}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={5}
									className="h-24 text-center text-muted-foreground"
								>
									{t("dispatch.nothingOpen")}
								</TableCell>
							</TableRow>
						) : (
							rows.map((row) => (
								// The accent fill ties the first row to the "Next up" panel beside the queue.
								<TableRow
									key={row.id}
									className={cn(row.id === nextUpId && "bg-accent/70")}
								>
									<TableCell>
										<div className="grid justify-items-start">
											<span className="flex items-center gap-2">
												{/* The padding gives the link a touch area of 44 px. The negative margin keeps the row height. */}
												<Link
													to="/app/shipments/$shipmentId"
													params={{ shipmentId: row.id }}
													className="-my-3 py-3 font-semibold tabular-nums hover:underline"
												>
													{row.reference}
												</Link>
												{row.id === nextUpId ? (
													<Badge>{t("dispatch.next")}</Badge>
												) : null}
											</span>
											<span className="text-muted-foreground text-xs">
												{row.customerName}
											</span>
										</div>
									</TableCell>
									<TableCell>
										<DueLabel
											dueAt={row.dueAt}
											lateDays={row.lateDays}
											isOpen
										/>
									</TableCell>
									<TableCell>
										<ShipmentStatusBadge status={row.status} />
									</TableCell>
									<TableCell className="max-sm:hidden">
										{row.destination}
									</TableCell>
									<TableCell className="max-sm:hidden">
										{row.driverName ? (
											<div className="grid">
												<span>{row.driverName}</span>
												<span className="text-muted-foreground text-xs">
													{row.vehicleUnit}
												</span>
											</div>
										) : (
											<span className="text-muted-foreground">
												{t("shipments.noDriver")}
											</span>
										)}
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</CardContent>
			<CardFooter className="mt-auto text-muted-foreground text-xs tabular-nums">
				{fillMessage(
					t(`dispatch.queueCount.${pluralForm(rowsOfTab.length, locale)}`),
					{
						shown: number.format(rows.length),
						total: number.format(rowsOfTab.length),
					},
				)}
			</CardFooter>
		</Card>
	);
}
