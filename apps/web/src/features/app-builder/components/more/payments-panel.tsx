/**
 * Payments panel of the More view: the provider card with its test/live
 * toggle, the product list, the amount collected this month, and the webhook.
 * Rendered by components/more/more-view.tsx inside PanelShell, which draws the
 * title. Reads paymentsSummaryQuery and writes through useSetPaymentsMode.
 */

import { useSuspenseQuery } from "@tanstack/react-query";
import { Badge } from "@wandit/ui/components/badge";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { toast } from "sonner";

import {
	formatCurrencyDZD,
	formatDate,
	formatNumber,
	useTranslation,
} from "@/lib/i18n";
import { useSetPaymentsMode } from "../../api/app-builder.mutations";
import { paymentsSummaryQuery } from "../../api/app-builder.queries";
import type { PaymentProduct } from "../../api/dto";
import { SegmentedControl } from "../shell/segmented-control";

export type PaymentsPanelProps = {
	projectId: string;
};

export function PaymentsPanel({ projectId }: PaymentsPanelProps) {
	const { t, locale } = useTranslation();
	const { data } = useSuspenseQuery(paymentsSummaryQuery(projectId));
	const setMode = useSetPaymentsMode(projectId);
	const notWired = () => toast(t("appBuilder.mock.notWired"));

	// The provider is null until the user connects one; the other cards need it.
	if (!data.provider) {
		return (
			<div className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3">
				<span className="font-semibold">
					{t("appBuilder.payments.noProvider")}
				</span>
				<Button onClick={notWired}>
					{t("appBuilder.payments.connectProvider")}
				</Button>
			</div>
		);
	}
	const { provider } = data;
	// The month string is `YYYY-MM`; the first day at local midnight keeps the month in every time zone.
	const collectedMonth = formatDate(
		new Date(`${data.collectedMonth}-01T00:00:00`),
		locale,
		{ month: "long" },
	);

	return (
		<>
			<div className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3">
				<span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted font-semibold">
					{provider.name.charAt(0)}
				</span>
				<div className="min-w-0 flex-1">
					<div className="font-semibold" dir="auto">
						{provider.name}
					</div>
					<div className="text-muted-foreground text-xs">
						{t("appBuilder.payments.connectedAs", {
							account: provider.account,
							cards: provider.cards,
						})}
					</div>
				</div>
				{provider.mode === "live" ? (
					<Badge variant="success">
						<span aria-hidden className="size-1.5 rounded-full bg-success" />
						{t("appBuilder.payments.live")}
					</Badge>
				) : null}
				<SegmentedControl
					size="sm"
					ariaLabel={t("appBuilder.payments.modeAriaLabel")}
					value={provider.mode}
					onChange={(mode) => setMode.mutate(mode)}
					options={[
						{ value: "test", label: t("appBuilder.payments.test") },
						{ value: "live", label: t("appBuilder.payments.live") },
					]}
				/>
			</div>

			<div className="rounded-2xl border bg-card">
				<div className="flex items-center justify-between px-4 py-3">
					<span className="font-semibold">
						{t("appBuilder.payments.products")}
					</span>
					<Button variant="outline" size="sm" onClick={notWired}>
						{t("appBuilder.payments.addProduct")}
					</Button>
				</div>
				{data.products.map((product) => (
					<div
						key={product.id}
						className="grid grid-cols-[1fr_auto_auto] items-center gap-6 border-t px-4 py-3 text-sm"
					>
						<span dir="auto">{product.name}</span>
						<span className="text-muted-foreground">
							{billingLabel(product, t)}
						</span>
						<span className="font-semibold tabular-nums">
							{formatCurrencyDZD(product.priceDzd, locale)}
						</span>
					</div>
				))}
			</div>

			<div className="grid grid-cols-2 gap-3">
				<div className="rounded-2xl border bg-card p-4">
					<div className="text-muted-foreground text-xs">
						{t("appBuilder.payments.collected", { month: collectedMonth })}
					</div>
					<div className="mt-1 font-semibold text-2xl tabular-nums">
						{formatCurrencyDZD(data.collectedDzd, locale)}
					</div>
					<div className="mt-1 text-muted-foreground text-xs">
						{t("appBuilder.payments.paymentCount", {
							count: data.paymentCount,
							countDisplay: formatNumber(data.paymentCount, locale),
						})}
						{" · "}
						{t("appBuilder.payments.refundCount", {
							count: data.refundCount,
							countDisplay: formatNumber(data.refundCount, locale),
						})}
					</div>
				</div>
				<div className="rounded-2xl border bg-card p-4">
					<div className="text-muted-foreground text-xs">
						{t("appBuilder.payments.webhook")}
					</div>
					<div className="mt-1 flex items-center gap-2 font-medium text-sm">
						<span
							aria-hidden
							className={cn(
								"size-2 shrink-0 rounded-full",
								data.webhookReceiving ? "bg-success" : "bg-faint",
							)}
						/>
						{t(
							data.webhookReceiving
								? "appBuilder.payments.receiving"
								: "appBuilder.payments.notReceiving",
						)}
					</div>
					<div className="mt-1 font-mono text-muted-foreground text-xs">
						{data.webhookPath}
					</div>
				</div>
			</div>
		</>
	);
}

/** Billing text of one product row: "recurring · 30 days" or "one-time". */
function billingLabel(
	product: PaymentProduct,
	t: ReturnType<typeof useTranslation>["t"],
): string {
	if (product.billing.kind === "recurring") {
		return t("appBuilder.payments.recurring", { days: product.billing.days });
	}
	return t("appBuilder.payments.oneTime");
}
