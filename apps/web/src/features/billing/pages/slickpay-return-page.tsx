/**
 * Page where SlickPay sends the buyer after the payment: /billing/slickpay?payment=<id>.
 * Rendered by routes/_auth/billing_.slickpay.tsx. It calls the confirm route until the payment is final.
 * The API reads the invoice state from SlickPay. A Trigger.dev sweep finishes the payment if the buyer leaves.
 */
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type {
	SlickpayPaymentStatus,
	SlickpayPaymentView,
} from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import {
	billingKeys,
	useConfirmSlickpayPayment,
} from "@/features/billing/api/billing.queries";
import {
	BillingReturnShell,
	type BillingReturnTone,
	DashboardButton,
} from "@/features/billing/components/billing-return-shell";
import {
	type BillingReturnCopy,
	getBillingReturnCopy,
} from "@/features/billing/lib/billing-return-copy";
import { getBillingPlanName } from "@/features/billing/lib/plan-copy";
import { formatDzd } from "@/features/billing/lib/plan-pricing";
import { creditsKeys } from "@/features/credits/api/credits.queries";
import { useDictionary, useTranslation } from "@/lib/i18n";

// The same cadence and limit as the Stripe order return page (billing-success-page.tsx).
const POLL_INTERVAL_MS = 3_000;
const TIMEOUT_MS = 3 * 60_000;

/** The route gives undefined when the `payment` search value is not a uuid. */
export default function SlickpayReturnPage({
	paymentId,
}: {
	paymentId: string | undefined;
}) {
	const { locale } = useTranslation();
	const copy = getBillingReturnCopy(locale);

	if (!paymentId) {
		return (
			<BillingReturnShell
				tone="error"
				title={copy.invalid.title}
				body={copy.invalid.body}
				actions={<DashboardButton label={copy.backToDashboard} />}
			/>
		);
	}

	return <SlickpayPaymentFlow paymentId={paymentId} />;
}

function SlickpayPaymentFlow({ paymentId }: { paymentId: string }) {
	const { locale } = useTranslation();
	const copy = getBillingReturnCopy(locale);
	const queryClient = useQueryClient();
	const [timedOut, setTimedOut] = useState(false);
	const confirmQuery = useConfirmSlickpayPayment(paymentId, {
		enabled: !timedOut,
		refetchInterval: (view) =>
			view && isFinalStatus(view.status) ? false : POLL_INTERVAL_MS,
	});
	const view = confirmQuery.data;
	const isFinal = view ? isFinalStatus(view.status) : false;
	const isFulfilled = view?.status === "fulfilled";

	useEffect(() => {
		if (isFinal) {
			return;
		}

		const timer = window.setTimeout(() => setTimedOut(true), TIMEOUT_MS);

		return () => window.clearTimeout(timer);
	}, [isFinal]);

	useEffect(() => {
		if (!isFulfilled) {
			return;
		}

		// The buyer paid in the active workspace, so its subscription and credits reload.
		void queryClient.invalidateQueries({ queryKey: billingKeys.scope() });
		void queryClient.invalidateQueries({ queryKey: creditsKeys.all });
	}, [isFulfilled, queryClient]);

	if (!view) {
		return confirmQuery.isError ? (
			<BillingReturnShell
				tone="error"
				title={copy.slickpay.errorTitle}
				body={copy.slickpay.errorBody}
				actions={
					<>
						<BackToBillingButton label={copy.backToBilling} />
						<Button
							type="button"
							onClick={() => void confirmQuery.refetch()}
							className="active:scale-[0.98]"
						>
							<RefreshCw className="size-4" aria-hidden />
							{copy.retry}
						</Button>
					</>
				}
			/>
		) : (
			<BillingReturnShell
				tone="progress"
				title={copy.slickpay.checkingTitle}
				body={copy.slickpay.checkingBody}
			/>
		);
	}

	if (timedOut && !isFinal) {
		return (
			<BillingReturnShell
				tone="warning"
				title={copy.slickpay.timeoutTitle}
				body={copy.slickpay.timeoutBody}
				details={<PaymentDetails view={view} />}
				actions={
					<>
						<BackToBillingButton label={copy.backToBilling} />
						<DashboardButton label={copy.backToDashboard} />
					</>
				}
			/>
		);
	}

	const state = returnStateFor(view.status, copy.slickpay);

	return (
		<BillingReturnShell
			tone={state.tone}
			title={state.title}
			body={state.body}
			details={<PaymentDetails view={view} />}
			actions={
				view.status === "fulfilled" ? (
					<DashboardButton label={copy.backToDashboard} />
				) : isFinal ? (
					<BackToBillingButton label={copy.backToBilling} />
				) : null
			}
		/>
	);
}

// created, pending, and paid can still change. The page stops polling on the other statuses.
function isFinalStatus(status: SlickpayPaymentStatus): boolean {
	return status === "fulfilled" || status === "failed" || status === "expired";
}

function returnStateFor(
	status: SlickpayPaymentStatus,
	copy: BillingReturnCopy["slickpay"],
): { tone: BillingReturnTone; title: string; body: string } {
	switch (status) {
		case "created":
		case "pending":
			return {
				tone: "progress",
				title: copy.checkingTitle,
				body: copy.checkingBody,
			};
		case "paid":
			return { tone: "progress", title: copy.paidTitle, body: copy.paidBody };
		case "fulfilled":
			return {
				tone: "success",
				title: copy.fulfilledTitle,
				body: copy.fulfilledBody,
			};
		case "expired":
			return {
				tone: "warning",
				title: copy.expiredTitle,
				body: copy.expiredBody,
			};
		case "failed":
			return {
				tone: "warning",
				title: copy.failedTitle,
				body: copy.failedBody,
			};
	}
}

function PaymentDetails({ view }: { view: SlickpayPaymentView }) {
	const { locale, t } = useTranslation();
	const planPickerCopy = useDictionary().billing.planPicker;
	const copy = getBillingReturnCopy(locale).slickpay;

	return (
		<dl className="grid gap-3 sm:grid-cols-2">
			<div className="min-w-0">
				<dt className="text-[11px] text-muted-foreground">{copy.planLabel}</dt>
				<dd className="mt-1 font-medium text-[13px]">
					{getBillingPlanName(view.plan, planPickerCopy)}
					{" · "}
					{t("credits.creditUnit", { count: view.tierCredits })}
					{" · "}
					{view.interval === "year"
						? planPickerCopy.yearly
						: planPickerCopy.monthly}
				</dd>
			</div>
			<div className="min-w-0">
				<dt className="text-[11px] text-muted-foreground">
					{copy.amountLabel}
				</dt>
				<dd className="mt-1 font-medium font-mono text-[13px] tabular-nums">
					{formatDzd(view.amountDzd)}
				</dd>
			</div>
		</dl>
	);
}

function BackToBillingButton({ label }: { label: string }) {
	return (
		<Button asChild variant="outline" className="active:scale-[0.98]">
			<Link to="/billing">{label}</Link>
		</Button>
	);
}
