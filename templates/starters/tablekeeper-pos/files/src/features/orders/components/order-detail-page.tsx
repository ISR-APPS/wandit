// The detail page of one check, in the anatomy of the kit profile page.
// Header and tabs (Overview, Lines, Timeline). Overview: a start column (check card, service progress, allergens)
// and a 2/3 column (timeline, then the line summary beside the other checks of the table).
// The /app/orders/$orderId route renders it after its loader. An unknown check shows a not-found block.
import { ArrowLeftIcon, PlusIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	fillMessage,
	menuQueryOptions,
	OPEN_ORDER_STATUSES,
	orderQueryOptions,
	ordersQueryOptions,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { CheckAllergensCard } from "./check-allergens-card";
import { CheckCard } from "./check-card";
import { LineSummaryCard } from "./line-summary-card";
import { OrderLinesCard } from "./order-lines-card";
import { OrderTimeline } from "./order-timeline";
import { ServiceProgressCard } from "./service-progress-card";
import { TableChecksCard } from "./table-checks-card";

const TABS = ["overview", "lines", "timeline"] as const;
type DetailTab = (typeof TABS)[number];

type OrderDetailPageProps = {
	/** The `$orderId` param of the URL: a check number as text. The query returns null for an unknown one. */
	orderId: string;
};

/** The overview splits 1/3 and 2/3 from the @4xl/main width. Each tab is a real view of the same check. */
export function OrderDetailPage({ orderId }: OrderDetailPageProps) {
	const { t } = useT();
	const { data: order } = useSuspenseQuery(orderQueryOptions(orderId));
	const { data: orders } = useSuspenseQuery(ordersQueryOptions());
	const { data: menu } = useSuspenseQuery(menuQueryOptions());
	const [tab, setTab] = useState<DetailTab>("overview");
	const now = Date.now();

	const backButton = (
		<Button asChild variant="outline">
			<Link to="/app/orders">
				<ArrowLeftIcon className="rtl:rotate-180" />
				{t("orderDetail.back")}
			</Link>
		</Button>
	);
	if (!order) {
		return (
			<div className="grid justify-items-start gap-4">
				{backButton}
				<p className="text-muted-foreground text-sm">
					{t("orderDetail.notFound")}
				</p>
			</div>
		);
	}

	const isOpen = OPEN_ORDER_STATUSES.includes(order.status);
	const sameTable = orders.filter(
		(other) => other.tableId === order.tableId && other.id !== order.id,
	);

	return (
		<div className="grid gap-4">
			<PageHeader
				title={fillMessage(t("orderDetail.title"), {
					number: String(order.number),
				})}
				actions={
					isOpen ? (
						<>
							{backButton}
							<Button asChild>
								<Link to="/app/order" search={{ table: order.tableId }}>
									<PlusIcon />
									{t("orderDetail.addItems")}
								</Link>
							</Button>
						</>
					) : (
						backButton
					)
				}
			/>
			<Tabs
				value={tab}
				onValueChange={(value) => {
					const next = TABS.find((entry) => entry === value);
					if (next) {
						setTab(next);
					}
				}}
				className="gap-4"
			>
				<TabsList>
					{TABS.map((value) => (
						<TabsTrigger key={value} value={value}>
							{t(`orderDetail.tabs.${value}`)}
						</TabsTrigger>
					))}
				</TabsList>
				<TabsContent value="overview">
					<div className="grid @4xl/main:grid-cols-3 items-start gap-4">
						<div className="grid gap-4">
							<CheckCard order={order} now={now} />
							<ServiceProgressCard order={order} />
							<CheckAllergensCard order={order} menu={menu} />
						</div>
						<div className="@4xl/main:col-span-2 grid gap-4">
							<OrderTimeline
								order={order}
								now={now}
								onViewAll={() => setTab("timeline")}
							/>
							<div className="grid @4xl/main:grid-cols-2 gap-4">
								<LineSummaryCard order={order} />
								<TableChecksCard orders={sameTable} />
							</div>
						</div>
					</div>
				</TabsContent>
				<TabsContent value="lines">
					<OrderLinesCard order={order} />
				</TabsContent>
				<TabsContent value="timeline">
					<OrderTimeline order={order} now={now} />
				</TabsContent>
			</Tabs>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function OrderDetailPageSkeleton() {
	return (
		<div className="grid gap-4">
			<Skeleton className="h-8 w-48" />
			<Skeleton className="h-9 w-72" />
			<div className="grid @4xl/main:grid-cols-3 items-start gap-4">
				<Skeleton className="h-96 rounded-surface" />
				<Skeleton className="@4xl/main:col-span-2 h-96 rounded-surface" />
			</div>
		</div>
	);
}
