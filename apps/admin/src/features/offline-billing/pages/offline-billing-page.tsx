import { ClipboardListIcon, ReceiptTextIcon } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ManualRequestsTable } from "@/features/offline-billing/components/manual-requests-table";
import { ManualSubscriptionsTable } from "@/features/offline-billing/components/manual-subscriptions-table";
import { OfflineBillingStats } from "@/features/offline-billing/components/offline-billing-stats";

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
					Follow up cash and transfer requests, record collected payments, and
					manage subscriptions that do not renew automatically.
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
						<TabsTrigger value="subscriptions">
							<ReceiptTextIcon aria-hidden="true" />
							Subscriptions
						</TabsTrigger>
					</TabsList>
				</div>
				<TabsContent value="requests">
					<ManualRequestsTable />
				</TabsContent>
				<TabsContent value="subscriptions">
					<ManualSubscriptionsTable />
				</TabsContent>
			</Tabs>
		</div>
	);
}
