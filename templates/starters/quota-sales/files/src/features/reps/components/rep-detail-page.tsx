// The page of one rep: the header with Email, the tabs Overview, Orders, and Accounts,
// then a start column (profile, quota, product lines) and an end column (latest orders, largest orders, top accounts).
// The /app/reps/$repId route renders it after its loader. An unknown id shows one sentence and a link back.
// The tab and the open order are state of the page. "View all" and the arrow buttons switch the tab.
import { ArrowLeftIcon, EnvelopeSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { OrderDialog } from "~/features/orders";
import type { Order } from "~/features/sales";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { repQueryOptions } from "../api/reps.queries";
import { RepAccountsCard } from "./rep-accounts-card";
import { RepAccountsTable } from "./rep-accounts-table";
import { RepAttainmentCard } from "./rep-attainment-card";
import { RepLargestOrdersCard } from "./rep-largest-orders-card";
import { RepLatestOrdersCard } from "./rep-latest-orders-card";
import { RepOrdersTable } from "./rep-orders-table";
import { RepProductsCard } from "./rep-products-card";
import { RepProfileCard } from "./rep-profile-card";

/** The tabs of the page. Each tab shows real rows of the rep. */
const REP_TABS = ["overview", "orders", "accounts"] as const;

type RepTab = (typeof REP_TABS)[number];

type RepDetailPageProps = {
	/** The id from the URL. It can name no rep. */
	repId: string;
};

/** One column on a phone; on a wide main column the start column takes 1/3 and the end column 2/3. */
export function RepDetailPage({ repId }: RepDetailPageProps) {
	const { t } = useT();
	const { data: rep } = useSuspenseQuery(repQueryOptions(repId));
	const [tab, setTab] = useState<RepTab>("overview");
	const [openOrder, setOpenOrder] = useState<Order | null>(null);

	const backLink = (
		<Link
			to="/app/reps"
			className="flex w-fit items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
		>
			<ArrowLeftIcon className="size-4 rtl:rotate-180" />
			{t("reps.backToList")}
		</Link>
	);

	if (!rep) {
		return (
			<div className="grid gap-4">
				{backLink}
				<p className="text-muted-foreground text-sm">{t("reps.notFound")}</p>
			</div>
		);
	}

	return (
		<div className="grid gap-4">
			{backLink}
			<PageHeader
				title={rep.name}
				description={`${t(`roles.${rep.role}`)} · ${rep.territoryName}`}
				actions={
					<Button asChild>
						<a href={`mailto:${rep.email}`}>
							<EnvelopeSimpleIcon />
							{t("reps.sendEmail")}
						</a>
					</Button>
				}
			/>
			<Tabs
				value={tab}
				onValueChange={(value) =>
					setTab(REP_TABS.find((option) => option === value) ?? "overview")
				}
				className="gap-4"
			>
				<TabsList aria-label={t("reps.sections")}>
					<TabsTrigger value="overview">{t("reps.tabs.overview")}</TabsTrigger>
					<TabsTrigger value="orders">{t("reps.tabs.orders")}</TabsTrigger>
					<TabsTrigger value="accounts">{t("reps.tabs.accounts")}</TabsTrigger>
				</TabsList>
				<TabsContent value="overview">
					<div className="grid @4xl/main:grid-cols-3 gap-4">
						<div className="grid content-start gap-4">
							<RepProfileCard rep={rep} />
							<RepAttainmentCard rep={rep} />
							<RepProductsCard productMix={rep.productMix} />
						</div>
						<div className="@4xl/main:col-span-2 grid min-w-0 content-start gap-4">
							<RepLatestOrdersCard
								orders={rep.quarterOrders}
								onOpenOrder={setOpenOrder}
								onViewAll={() => setTab("orders")}
							/>
							<div className="grid @4xl/main:grid-cols-2 gap-4">
								<RepLargestOrdersCard orders={rep.quarterOrders} />
								<RepAccountsCard
									accounts={rep.accounts}
									onViewAll={() => setTab("accounts")}
								/>
							</div>
						</div>
					</div>
				</TabsContent>
				<TabsContent value="orders">
					<RepOrdersTable
						orders={rep.quarterOrders}
						quarterLabel={rep.quarterLabel}
						onOpenOrder={setOpenOrder}
					/>
				</TabsContent>
				<TabsContent value="accounts">
					<RepAccountsTable
						accounts={rep.accounts}
						quarterLabel={rep.quarterLabel}
					/>
				</TabsContent>
			</Tabs>
			<OrderDialog order={openOrder} onClose={() => setOpenOrder(null)} />
		</div>
	);
}

/** Placeholder while the rep loader runs. The route sets it as pendingComponent. */
export function RepDetailPageSkeleton() {
	return (
		<div className="grid gap-4">
			<Skeleton className="h-5 w-40" />
			<div className="grid gap-2">
				<Skeleton className="h-8 w-56" />
				<Skeleton className="h-4 w-48" />
			</div>
			<Skeleton className="h-9 w-72" />
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<Skeleton className="h-144" />
				<Skeleton className="@4xl/main:col-span-2 h-144" />
			</div>
		</div>
	);
}
