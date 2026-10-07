/**
 * "CIB / Edahabia" tab of the plan picker: one SlickPay payment in DZD buys one month or one year of a plan.
 * Step 1 picks the cycle and the tier. Step 2 collects the name, phone, and city for the SlickPay invoice.
 * Rendered by plan-picker-dialog.tsx. Calls useStartSlickpayCheckout, then sends the browser to the SlickPay page.
 * SlickPay sends the buyer back to /billing/slickpay (pages/slickpay-return-page.tsx).
 */
import type {
	BillingInterval,
	BillingPlanCatalogItem,
	BillingTierPrice,
	CreditTier,
	ProductEventSurface,
	Subscription,
} from "@wandit/contracts";
import {
	isManualSubscription,
	startSlickpayCheckoutBodySchema,
} from "@wandit/contracts";
import { Badge } from "@wandit/ui/components/badge";
import { Button } from "@wandit/ui/components/button";
import { DialogFooter } from "@wandit/ui/components/dialog";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@wandit/ui/components/field";
import { Input } from "@wandit/ui/components/input";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@wandit/ui/components/toggle-group";
import { ArrowRight, CreditCard } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";

import { useStartSlickpayCheckout } from "@/features/billing/api/billing.mutations";
import { completeSlickpayCheckoutStart } from "@/features/billing/lib/checkout-product-events";
import { getBillingPlanCopy } from "@/features/billing/lib/plan-copy";
import {
	formatPlanPrice,
	tierPriceUsd,
} from "@/features/billing/lib/plan-pricing";
import { getApiErrorMessage } from "@/lib/api-client";
import { useDictionary, useTranslation } from "@/lib/i18n";
import { PlanCard } from "./plan-card";

type SlickpayStep = "plan" | "contact";

type ContactValues = {
	fullName: string;
	phone: string;
	/** City or wilaya. The API writes "<city>, Algeria" as the invoice address. */
	city: string;
};

type ContactErrors = Partial<Record<keyof ContactValues, string>>;

export type SlickpayCheckoutPanelProps = {
	/** Plan of the active workspace: Pro in a personal workspace, Business in a team workspace. */
	plan: BillingPlanCatalogItem;
	/** Live subscription of the workspace. A manual one turns on the renewal mode. */
	subscription: Subscription | null;
	/** Decimal DZD per 1 USD from GET local-pricing. */
	dzdPerUsdRate: number;
	/** Name of the signed-in user. It fills the full name field at first. */
	defaultFullName: string;
	/** Billing cycle from the plan picker selection. Renewal mode ignores it. Default: "month". */
	initialInterval?: BillingInterval;
	/** Credit tier from the plan picker selection. Renewal mode ignores it. Default: the first tier. */
	initialTierCredits?: CreditTier;
	/** Screen that opened the plan picker. It goes to the `upgrade_clicked` product event. */
	surface: ProductEventSurface;
};

export function SlickpayCheckoutPanel({
	plan,
	subscription,
	dzdPerUsdRate,
	defaultFullName,
	initialInterval,
	initialTierCredits,
	surface,
}: SlickpayCheckoutPanelProps) {
	const { locale, t } = useTranslation();
	const copy = useDictionary().billing.planPicker;
	const startCheckout = useStartSlickpayCheckout();
	const [interval, setInterval] = useState<BillingInterval>(
		initialInterval ?? "month",
	);
	const [tierCredits, setTierCredits] = useState(initialTierCredits);
	const [contact, setContact] = useState<ContactValues>({
		city: "",
		fullName: defaultFullName,
		phone: "",
	});
	const [contactErrors, setContactErrors] = useState<ContactErrors>({});
	const [requestError, setRequestError] = useState<string | null>(null);
	const [step, setStep] = useState<SlickpayStep>("plan");
	const stepHeadingRef = useRef<HTMLHeadingElement | null>(null);

	const renewal = resolveRenewal(plan, subscription);
	const tier =
		renewal?.tier ??
		plan.tiers.find((item) => item.tierCredits === tierCredits) ??
		plan.tiers[0];

	if (!tier) {
		return null;
	}

	const selectedInterval = renewal?.interval ?? interval;
	const price = formatPlanPrice(
		tierPriceUsd(tier, selectedInterval),
		locale,
		dzdPerUsdRate,
	);
	const planCopy = getBillingPlanCopy(plan.id, copy);
	// The browser leaves for SlickPay after a success, so the button stays locked.
	const isRedirecting = startCheckout.isPending || startCheckout.isSuccess;

	// Focus moves to the heading of the new step, so keyboard and screen reader users start at its top.
	const goToStep = (next: SlickpayStep) => {
		setStep(next);
		requestAnimationFrame(() => stepHeadingRef.current?.focus());
	};

	const updateContact = (field: keyof ContactValues, value: string) => {
		setContact((current) => ({ ...current, [field]: value }));
		setContactErrors((current) => ({ ...current, [field]: undefined }));
	};

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		// Enter in a field submits too. Each call creates a real SlickPay invoice, so one call at a time.
		if (isRedirecting) {
			return;
		}
		setRequestError(null);

		const parsed = startSlickpayCheckoutBodySchema.safeParse({
			...contact,
			interval: selectedInterval,
			plan: plan.id,
			tierCredits: tier.tierCredits,
		});

		if (!parsed.success) {
			const errors: ContactErrors = {};
			for (const issue of parsed.error.issues) {
				const field = issue.path[0];
				if (field === "fullName" || field === "phone") {
					errors[field] = copy.offline.validation[field];
				} else if (field === "city") {
					errors.city = copy.slickpay.cityError;
				}
			}
			setContactErrors(errors);
			// The plan, tier, and cycle come from the catalog. A failure there is not a form error.
			if (Object.keys(errors).length === 0) {
				setRequestError(copy.offline.validation.generic);
			}
			return;
		}

		setContactErrors({});
		void startCheckout
			.mutateAsync(parsed.data)
			.then(({ url }) => completeSlickpayCheckoutStart(url, surface))
			.catch((error) => setRequestError(getApiErrorMessage(error)));
	};

	if (!renewal && step === "plan") {
		return (
			<div className="flex flex-col gap-4">
				<h3
					ref={stepHeadingRef}
					tabIndex={-1}
					className="font-display font-semibold tracking-tight outline-none"
				>
					{copy.offline.steps.plan}
				</h3>
				<div className="grid gap-2">
					<span className="font-medium text-sm">{copy.billingCycle}</span>
					<ToggleGroup
						type="single"
						value={interval}
						variant="outline"
						spacing={0}
						className="w-full"
						aria-label={copy.billingCycle}
						onValueChange={(value) => {
							if (value === "month" || value === "year") {
								setInterval(value);
							}
						}}
					>
						<ToggleGroupItem value="month" className="flex-1">
							{copy.monthly}
						</ToggleGroupItem>
						<ToggleGroupItem value="year" className="flex-1 gap-2">
							{copy.yearly}
							<Badge
								variant="secondary"
								className="px-1.5 font-mono text-[9px]"
							>
								{copy.twoMonthsFree}
							</Badge>
						</ToggleGroupItem>
					</ToggleGroup>
				</div>
				<PlanCard
					name={planCopy.name}
					tagline={planCopy.tagline}
					tier={tier}
					tiers={plan.tiers}
					basePer100Usd={plan.basePer100Usd}
					dzdPerUsdRate={dzdPerUsdRate}
					interval={interval}
					perLabel={interval === "year" ? copy.perYear : copy.perMonth}
					selectId="slickpay-billing-tier"
					selectLabel={copy.creditTier}
					onSelectTier={setTierCredits}
					features={planCopy.features}
					featureColumns={2}
					highlighted
					action={
						<Button
							type="button"
							className="mt-4 w-full"
							onClick={() => goToStep("contact")}
						>
							{copy.offline.continue}
							<ArrowRight className="rtl:rotate-180" aria-hidden />
						</Button>
					}
				/>
			</div>
		);
	}

	return (
		<form className="flex flex-col gap-5" noValidate onSubmit={submit}>
			<div>
				<h3
					ref={stepHeadingRef}
					tabIndex={-1}
					className="font-display font-semibold tracking-tight outline-none"
				>
					{renewal ? copy.slickpay.renewTitle : copy.slickpay.formTitle}
				</h3>
				<p className="mt-1 text-muted-foreground text-sm">
					{renewal ? copy.slickpay.renewBody : copy.slickpay.formDescription}
				</p>
			</div>

			<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/30 px-4 py-3">
				<div className="min-w-0">
					<p className="font-medium text-sm">{planCopy.name}</p>
					<p className="mt-0.5 text-muted-foreground text-xs">
						{t("credits.creditUnit", { count: tier.tierCredits })}
						{" · "}
						{selectedInterval === "year" ? copy.yearly : copy.monthly}
					</p>
				</div>
				<div className="flex items-center gap-3">
					<p className="font-mono font-semibold tabular-nums">{price}</p>
					{renewal ? null : (
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => goToStep("plan")}
						>
							{copy.offline.changePlan}
						</Button>
					)}
				</div>
			</div>

			<FieldGroup className="grid gap-4 sm:grid-cols-2">
				<Field data-invalid={Boolean(contactErrors.fullName)}>
					<FieldLabel htmlFor="slickpay-full-name">
						{copy.offline.form.fullNameLabel}
					</FieldLabel>
					<Input
						id="slickpay-full-name"
						value={contact.fullName}
						maxLength={120}
						required
						autoComplete="name"
						placeholder={copy.offline.form.fullNamePlaceholder}
						aria-invalid={Boolean(contactErrors.fullName)}
						aria-describedby={
							contactErrors.fullName ? "slickpay-full-name-error" : undefined
						}
						onChange={(event) => updateContact("fullName", event.target.value)}
					/>
					<FieldError id="slickpay-full-name-error">
						{contactErrors.fullName}
					</FieldError>
				</Field>

				<Field data-invalid={Boolean(contactErrors.phone)}>
					<FieldLabel htmlFor="slickpay-phone">
						{copy.offline.form.phoneLabel}
					</FieldLabel>
					<Input
						id="slickpay-phone"
						type="tel"
						dir="ltr"
						value={contact.phone}
						maxLength={32}
						required
						autoComplete="tel"
						className="text-start"
						placeholder={copy.offline.form.phonePlaceholder}
						aria-invalid={Boolean(contactErrors.phone)}
						aria-describedby={
							contactErrors.phone
								? "slickpay-phone-hint slickpay-phone-error"
								: "slickpay-phone-hint"
						}
						onChange={(event) => updateContact("phone", event.target.value)}
					/>
					<FieldDescription id="slickpay-phone-hint">
						{copy.offline.form.phoneHint}
					</FieldDescription>
					<FieldError id="slickpay-phone-error">
						{contactErrors.phone}
					</FieldError>
				</Field>

				<Field
					className="sm:col-span-2"
					data-invalid={Boolean(contactErrors.city)}
				>
					<FieldLabel htmlFor="slickpay-city">
						{copy.slickpay.cityLabel}
					</FieldLabel>
					<Input
						id="slickpay-city"
						value={contact.city}
						maxLength={120}
						required
						autoComplete="address-level2"
						placeholder={copy.slickpay.cityPlaceholder}
						aria-invalid={Boolean(contactErrors.city)}
						aria-describedby={
							contactErrors.city ? "slickpay-city-error" : undefined
						}
						onChange={(event) => updateContact("city", event.target.value)}
					/>
					<FieldError id="slickpay-city-error">{contactErrors.city}</FieldError>
				</Field>
			</FieldGroup>

			{requestError ? (
				<p
					role="alert"
					className="rounded-lg border border-destructive/25 bg-destructive/[0.045] px-3 py-2 text-destructive text-sm"
				>
					{requestError}
				</p>
			) : null}

			<DialogFooter>
				<Button type="submit" disabled={isRedirecting}>
					<CreditCard data-icon="inline-start" aria-hidden />
					{isRedirecting
						? copy.slickpay.redirecting
						: renewal
							? t("billing.planPicker.slickpay.renew", { amount: price })
							: t("billing.planPicker.slickpay.pay", { amount: price })}
				</Button>
			</DialogFooter>
		</form>
	);
}

// A live manual subscription renews only its plan, effective tier, and cycle. The API refuses another selection.
// A retired tier has no catalog price, so the panel shows the normal selection and the API explains the refusal.
function resolveRenewal(
	plan: BillingPlanCatalogItem,
	subscription: Subscription | null,
): { interval: BillingInterval; tier: BillingTierPrice } | null {
	if (!isManualSubscription(subscription) || subscription?.plan !== plan.id) {
		return null;
	}

	const tierCredits =
		subscription.pendingTierCredits ?? subscription.tierCredits;
	const tier = plan.tiers.find((item) => item.tierCredits === tierCredits);

	return tier ? { interval: subscription.interval, tier } : null;
}
