/**
 * Offline billing page: the request queue, the offline and SlickPay top-ups, and old manual subscriptions.
 * Route /offline-billing. Renders the stats strip and one tab for each list.
 */
import { ClipboardListIcon, HistoryIcon, WalletCardsIcon } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ManualRequestsTable } from "@/features/offline-billing/components/manual-requests-table";
import { ManualSubscriptionsTable } from "@/features/offline-billing/components/manual-subscriptions-table";
import { OfflineBillingStats } from "@/features/offline-billing/components/offline-billing-stats";
import { TopupReceiptsTable } from "@/features/offline-billing/components/topup-receipts-table";

export function OfflineBillingPage() {
	return (
		<div className="mx-auto w-full max-w-[1600px] space-y-5">
			<div className="min-w-0">
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
					Billing operations
				</p>
				<h1 className="mt-1 font-semibold text-2xl tracking-tight">
					Offline billing
				</h1>
				<p className="mt-1 max-w-2xl text-muted-foreground text-sm">
					Follow up cash and transfer requests, record the money you receive as
					wallet top-ups, and reverse a top-up when the money goes back.
				</p>
			</div>

			<OfflineBillingStats />

			<Tabs defaultValue="requests" className="gap-4">
				<div className="overflow-x-auto border-b">
					<TabsList variant="line" className="h-11">
						<TabsTrigger value="requests">
							<ClipboardListIcon aria-hidden="true" />
							Requests
						</TabsTrigger>
						<TabsTrigger value="topups">
							<WalletCardsIcon aria-hidden="true" />
							Top-ups
						</TabsTrigger>
						<TabsTrigger value="subscriptions">
							<HistoryIcon aria-hidden="true" />
							Past subscriptions
						</TabsTrigger>
					</TabsList>
				</div>
				<TabsContent value="requests">
					<ManualRequestsTable />
				</TabsContent>
				<TabsContent value="topups">
					<TopupReceiptsTable />
				</TabsContent>
				<TabsContent value="subscriptions">
					<ManualSubscriptionsTable />
				</TabsContent>
			</Tabs>
		</div>
	);
}
