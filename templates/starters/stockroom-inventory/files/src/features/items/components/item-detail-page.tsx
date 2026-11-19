// The page of one item, in the anatomy of the kit profile page: the title row, the Overview | Movements | Orders tabs,
// then a first column (facts, shelf level, stock rules) and a wide column (latest movements, orders, same supplier).
// The /app/items/$itemId route renders it after its loader. The route also uses the skeleton below.
// The Movements tab holds the 90-day level chart and the movement table. An unknown id shows a not-found block.
import { ArrowLeftIcon, ClipboardTextIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { dayCountFormat, fillMessage, formatQuantity } from "~/features/stock";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { itemQueryOptions } from "../api/items.queries";
import { ItemLatestCard } from "./item-latest-card";
import { ItemLevelCard } from "./item-level-card";
import { ItemMovementsCard } from "./item-movements-card";
import { ItemOrderLinesCard } from "./item-order-lines-card";
import { ItemOrdersCard } from "./item-orders-card";
import { ItemProfileCard } from "./item-profile-card";
import { ItemSiblingsCard } from "./item-siblings-card";

type ItemDetailPageProps = {
	/** The `$itemId` param of the URL: the lower case SKU. The query answers null for an unknown id. */
	itemId: string;
};

/** The three tabs of the page. Each one shows real rows of the item. */
type ItemTab = "overview" | "movements" | "orders";

// The timeline shows the 3 newest receipts, counts, or damage reports. Picks are daily noise there.
const LATEST_COUNT = 3;

/** One column on a phone; 1/3 and 2/3 from the 4xl container width. */
export function ItemDetailPage({ itemId }: ItemDetailPageProps) {
	const { t, locale } = useT();
	const { data: detail } = useSuspenseQuery(itemQueryOptions(itemId));
	const [tab, setTab] = useState<ItemTab>("overview");

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className="-ms-3 justify-self-start"
		>
			<Link to="/app/items">
				<ArrowLeftIcon className="rtl:rotate-180" />
				{t("items.title")}
			</Link>
		</Button>
	);
	if (!detail) {
		return (
			<div className="grid gap-4">
				{backLink}
				<p className="text-muted-foreground text-sm">
					{t("itemDetail.notFound")}
				</p>
			</div>
		);
	}

	const { item, supplier } = detail;
	const now = Date.now();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const dayCount = dayCountFormat(locale);
	const usage = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
	// The shelf is full right after a reorder lands: the reorder point plus one order quantity.
	const fullLevel = item.minimum + item.reorderQuantity;
	const fill = Math.min(1, item.onHand / fullLevel);
	// 1 January 2024 is a Monday, so day N of that month names weekday N (1 = Monday, 5 = Friday).
	const orderDay = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(
		new Date(2024, 0, supplier.orderWeekday),
	);
	const rules = [
		fillMessage(t("itemDetail.ruleReorderAt"), {
			quantity: formatQuantity(item.minimum, item.unit, t, locale),
		}),
		fillMessage(t("itemDetail.ruleOrderQuantity"), {
			quantity: formatQuantity(item.reorderQuantity, item.unit, t, locale),
		}),
		fillMessage(t("itemDetail.ruleLeadTime"), {
			days: dayCount.format(supplier.leadTimeDays),
		}),
		fillMessage(t("itemDetail.ruleOrderDay"), { day: orderDay }),
		fillMessage(t("itemDetail.rulePicked"), {
			count: usage.format(item.dailyUsage),
		}),
	];
	const latest = detail.movements
		.filter((movement) => movement.reason !== "pick")
		.slice(0, LATEST_COUNT);

	return (
		<div className="grid gap-4">
			{backLink}
			<PageHeader
				title={item.name}
				description={`${item.sku} · ${t(`categories.${item.category}`)}`}
				actions={
					<Button asChild>
						<Link
							to="/app/purchase-orders"
							search={{ supplier: item.supplierId }}
						>
							<ClipboardTextIcon />
							{t("itemDetail.supplierOrders")}
						</Link>
					</Button>
				}
			/>
			<Tabs
				value={tab}
				onValueChange={(value) => {
					if (
						value === "overview" ||
						value === "movements" ||
						value === "orders"
					) {
						setTab(value);
					}
				}}
				className="gap-4"
			>
				<TabsList>
					<TabsTrigger value="overview">{t("itemDetail.overview")}</TabsTrigger>
					<TabsTrigger value="movements">
						{t("itemDetail.movements")}
						<span className="text-muted-foreground tabular-nums">
							{number.format(detail.movements.length)}
						</span>
					</TabsTrigger>
					<TabsTrigger value="orders">
						{t("itemDetail.orders")}
						<span className="text-muted-foreground tabular-nums">
							{number.format(detail.orders.length)}
						</span>
					</TabsTrigger>
				</TabsList>
				<TabsContent value="overview">
					<div className="grid @4xl/main:grid-cols-3 items-start gap-4">
						<div className="grid gap-4">
							<ItemProfileCard item={item} supplier={supplier} />
							<Card>
								<CardHeader>
									<CardTitle>{t("itemDetail.shelfTitle")}</CardTitle>
									<CardDescription>
										{fillMessage(t("itemDetail.shelfDescription"), {
											quantity: formatQuantity(fullLevel, item.unit, t, locale),
										})}
									</CardDescription>
								</CardHeader>
								<CardContent className="flex items-center gap-4">
									{/* fill is from 0 to 1. Progress takes 0 to 100. */}
									<Progress
										value={fill * 100}
										className="flex-1"
										aria-label={t("itemDetail.shelfTitle")}
									/>
									<span className="text-muted-foreground text-sm tabular-nums">
										{percent.format(fill)}
									</span>
								</CardContent>
							</Card>
							<Card>
								<CardHeader>
									<CardTitle>{t("itemDetail.rulesTitle")}</CardTitle>
								</CardHeader>
								<CardContent>
									<ul className="flex flex-wrap gap-2">
										{rules.map((rule) => (
											<li key={rule}>
												<Badge variant="outline">{rule}</Badge>
											</li>
										))}
									</ul>
								</CardContent>
							</Card>
						</div>
						<div className="@4xl/main:col-span-2 grid gap-4">
							<ItemLatestCard
								movements={latest}
								unit={item.unit}
								now={now}
								onViewAll={() => setTab("movements")}
							/>
							<div className="grid @5xl/main:grid-cols-2 gap-4">
								<ItemOrderLinesCard orders={detail.orders} />
								<ItemSiblingsCard
									items={detail.sameSupplier}
									supplierId={item.supplierId}
								/>
							</div>
						</div>
					</div>
				</TabsContent>
				<TabsContent value="movements" className="grid gap-4">
					<ItemLevelCard
						levels={detail.levels}
						minimum={item.minimum}
						unit={item.unit}
					/>
					<ItemMovementsCard
						movements={detail.movements}
						sku={item.sku}
						now={now}
					/>
				</TabsContent>
				<TabsContent value="orders">
					<ItemOrdersCard orders={detail.orders} />
				</TabsContent>
			</Tabs>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function ItemDetailPageSkeleton() {
	return (
		<div className="grid gap-4">
			<Skeleton className="h-8 w-24" />
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-64 max-w-full" />
					<Skeleton className="h-5 w-48" />
				</div>
				<Skeleton className="h-9 w-40" />
			</div>
			<Skeleton className="h-9 w-72" />
			<div className="grid @4xl/main:grid-cols-3 items-start gap-4">
				<div className="grid gap-4">
					<Skeleton className="h-112" />
					<Skeleton className="h-32" />
				</div>
				<div className="@4xl/main:col-span-2 grid gap-4">
					<Skeleton className="h-96" />
					<Skeleton className="h-80" />
				</div>
			</div>
		</div>
	);
}
