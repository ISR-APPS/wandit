/**
 * "CIB / Edahabia" tab of the top-up dialog: one SlickPay payment in DZD buys one wallet top-up.
 * Collects the name, phone, and city for the SlickPay invoice. The dialog gives the amount in USD.
 * Rendered by topup-dialog.tsx. Calls useStartSlickpayCheckout, then sends the browser to the SlickPay page.
 * SlickPay sends the buyer back to /billing/slickpay (pages/slickpay-return-page.tsx).
 */
import type { ProductEventSurface } from "@wandit/contracts";
import { startSlickpayCheckoutBodySchema } from "@wandit/contracts";
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
import { CreditCard } from "lucide-react";
import { type FormEvent, useState } from "react";

import { useStartSlickpayCheckout } from "@/features/billing/api/billing.mutations";
import { completeSlickpayCheckoutStart } from "@/features/billing/lib/checkout-product-events";
import { formatLocalPrice } from "@/features/billing/lib/price-format";
import { getApiErrorMessage } from "@/lib/api-client";
import { useDictionary, useTranslation } from "@/lib/i18n";
import { TopupCreditsLine } from "./topup-receipt";

type ContactValues = {
	fullName: string;
	phone: string;
	/** City or wilaya. The API writes "<city>, Algeria" as the invoice address. */
	city: string;
};

type ContactErrors = Partial<Record<keyof ContactValues, string>>;

/** Props from topup-dialog.tsx. The dialog owns the amount; this panel owns the contact fields. */
export type SlickpayCheckoutPanelProps = {
	/** Whole USD that the dialog parsed. Null while the typed amount is not valid: the pay button stays locked. */
	amountUsd: number | null;
	/** Decimal DZD per 1 USD from GET local-pricing. */
	dzdPerUsdRate: number;
	/** Name of the signed-in user. It fills the full name field at first. */
	defaultFullName: string;
	/** Screen that opened the top-up dialog. It goes to the `upgrade_clicked` product event. */
	surface: ProductEventSurface;
};

/** On success the browser leaves the app for the SlickPay payment page. */
export function SlickpayCheckoutPanel({
	amountUsd,
	dzdPerUsdRate,
	defaultFullName,
	surface,
}: SlickpayCheckoutPanelProps) {
	const { locale, t } = useTranslation();
	const topupCopy = useDictionary().billing.topup;
	const slickpay = topupCopy.slickpay;
	const offline = topupCopy.offline;
	const startCheckout = useStartSlickpayCheckout();
	const [contact, setContact] = useState<ContactValues>({
		city: "",
		fullName: defaultFullName,
		phone: "",
	});
	const [contactErrors, setContactErrors] = useState<ContactErrors>({});
	const [requestError, setRequestError] = useState<string | null>(null);

	// The browser leaves for SlickPay after a success, so the button stays locked.
	const isRedirecting = startCheckout.isPending || startCheckout.isSuccess;

	const updateContact = (field: keyof ContactValues, value: string) => {
		setContact((current) => ({ ...current, [field]: value }));
		setContactErrors((current) => ({ ...current, [field]: undefined }));
	};

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		// Enter in a field submits too. Each call creates a real SlickPay invoice, so one call at a time.
		if (isRedirecting || amountUsd === null) {
			return;
		}
		setRequestError(null);

		const parsed = startSlickpayCheckoutBodySchema.safeParse({
			...contact,
			amountUsd,
		});

		if (!parsed.success) {
			const errors: ContactErrors = {};
			for (const issue of parsed.error.issues) {
				const field = issue.path[0];
				if (field === "fullName" || field === "phone") {
					errors[field] = offline.validation[field];
				} else if (field === "city") {
					errors.city = slickpay.cityError;
				}
			}
			setContactErrors(errors);
			// The amount comes from the dialog parser. A failure there is not a form error.
			if (Object.keys(errors).length === 0) {
				setRequestError(offline.validation.generic);
			}
			return;
		}

		setContactErrors({});
		void startCheckout
			.mutateAsync(parsed.data)
			.then(({ url }) => completeSlickpayCheckoutStart(url, surface))
			.catch((error) => setRequestError(getApiErrorMessage(error)));
	};

	return (
		<form className="flex flex-col gap-5" noValidate onSubmit={submit}>
			<div>
				<h3 className="font-display font-semibold tracking-tight">
					{slickpay.formTitle}
				</h3>
				<p className="mt-1 text-muted-foreground text-sm">
					{slickpay.description} {slickpay.formDescription}
				</p>
				<div className="mt-2">
					<TopupCreditsLine amountUsd={amountUsd} />
				</div>
			</div>

			<FieldGroup className="grid gap-4 sm:grid-cols-2">
				<Field data-invalid={Boolean(contactErrors.fullName)}>
					<FieldLabel htmlFor="slickpay-full-name">
						{offline.form.fullNameLabel}
					</FieldLabel>
					<Input
						id="slickpay-full-name"
						value={contact.fullName}
						maxLength={120}
						required
						autoComplete="name"
						placeholder={offline.form.fullNamePlaceholder}
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
						{offline.form.phoneLabel}
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
						placeholder={offline.form.phonePlaceholder}
						aria-invalid={Boolean(contactErrors.phone)}
						aria-describedby={
							contactErrors.phone
								? "slickpay-phone-hint slickpay-phone-error"
								: "slickpay-phone-hint"
						}
						onChange={(event) => updateContact("phone", event.target.value)}
					/>
					<FieldDescription id="slickpay-phone-hint">
						{offline.form.phoneHint}
					</FieldDescription>
					<FieldError id="slickpay-phone-error">
						{contactErrors.phone}
					</FieldError>
				</Field>

				<Field
					className="sm:col-span-2"
					data-invalid={Boolean(contactErrors.city)}
				>
					<FieldLabel htmlFor="slickpay-city">{slickpay.cityLabel}</FieldLabel>
					<Input
						id="slickpay-city"
						value={contact.city}
						maxLength={120}
						required
						autoComplete="address-level2"
						placeholder={slickpay.cityPlaceholder}
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
				<Button type="submit" disabled={isRedirecting || amountUsd === null}>
					<CreditCard data-icon="inline-start" aria-hidden />
					{isRedirecting
						? slickpay.redirecting
						: amountUsd === null
							? t("billing.page.topup")
							: t("billing.topup.slickpay.pay", {
									amount: formatLocalPrice(amountUsd, locale, dzdPerUsdRate),
								})}
				</Button>
			</DialogFooter>
		</form>
	);
}
