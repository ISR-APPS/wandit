/**
 * "Cash / transfer" tab of the top-up dialog: a contact form for an offline top-up request.
 * Rendered by topup-dialog.tsx with the amount that the dialog parsed. Calls the manual-request queries and mutations.
 * An admin then calls the customer and records the top-up in the admin app.
 */
import type {
	ManualSubscriptionRequest,
	ProductEventSurface,
} from "@wandit/contracts";
import {
	createManualSubscriptionRequestBodySchema,
	manualBillingCountries,
	manualBillingCountrySchema,
	preferredPaymentMethodSchema,
} from "@wandit/contracts";
import { formatDate } from "@wandit/internationalization";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@wandit/ui/components/alert-dialog";
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
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@wandit/ui/components/select";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { Textarea } from "@wandit/ui/components/textarea";
import { HandCoins, PhoneCall } from "lucide-react";
import { useState } from "react";
import type { ZodIssue } from "zod";

import {
	useCancelManualSubscriptionRequest,
	useCreateManualSubscriptionRequest,
} from "@/features/billing/api/billing.mutations";
import { useManualSubscriptionRequestQuery } from "@/features/billing/api/billing.queries";
import { recordOfflineCheckoutStart } from "@/features/billing/lib/checkout-product-events";
import {
	assembleManualSubscriptionRequestBody,
	type ManualPaymentContactValues,
} from "@/features/billing/lib/manual-payment-request";
import { formatLocalPrice } from "@/features/billing/lib/price-format";
import { usePurchaseSummary } from "@/features/billing/lib/purchase-summary";
import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";
import { useDictionary, useTranslation } from "@/lib/i18n";
import { TopupCreditsLine } from "./topup-receipt";

const NO_METHOD_PREFERENCE = "none";

type ManualRequestField = keyof ManualPaymentContactValues;

type FieldErrors = Partial<Record<ManualRequestField, string>>;

/** Props from topup-dialog.tsx. The dialog owns the amount; this panel owns the contact fields. */
export type ManualPaymentRequestPanelProps = {
	/** Whole USD that the dialog parsed. Null while the typed amount is not valid: the submit button stays locked. */
	amountUsd: number | null;
	/** Name of the signed-in user. It fills the full name field at first. */
	defaultFullName: string;
	/** Decimal DZD per 1 USD from GET local-pricing, or null. Not null shows the DZD amount, so no "local price" note. */
	dzdPerUsdRate: number | null;
	onClose: () => void;
	/** Screen that opened the top-up dialog. It goes to the `upgrade_clicked` product event. */
	surface: ProductEventSurface;
};

/** Sends one offline top-up request. No money moves until an admin records the top-up. */
export function ManualPaymentRequestPanel({
	amountUsd,
	defaultFullName,
	dzdPerUsdRate,
	onClose,
	surface,
}: ManualPaymentRequestPanelProps) {
	const { locale, t } = useTranslation();
	const offline = useDictionary().billing.topup.offline;
	const requestQuery = useManualSubscriptionRequestQuery();
	const createRequest = useCreateManualSubscriptionRequest();
	const cancelRequest = useCancelManualSubscriptionRequest();
	const [contact, setContact] = useState<ManualPaymentContactValues>(() => ({
		city: "",
		company: "",
		country: "DZ",
		fullName: defaultFullName,
		notes: "",
		phone: "",
		preferredPaymentMethod: "",
	}));
	const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
	const [requestError, setRequestError] = useState<string | null>(null);
	const [submittedPhone, setSubmittedPhone] = useState<string | null>(null);

	if (submittedPhone) {
		return (
			<PanelNotice
				icon={<PhoneCall aria-hidden />}
				title={offline.success.title}
				body={t("billing.topup.offline.success.body", {
					phone: submittedPhone,
				})}
			>
				<Button type="button" onClick={onClose}>
					{t("billing.topup.close")}
				</Button>
			</PanelNotice>
		);
	}

	if (requestQuery.isPending) {
		return (
			<div className="grid gap-3" aria-hidden>
				<Skeleton className="h-28 w-full rounded-2xl" />
				<Skeleton className="h-56 w-full rounded-2xl" />
			</div>
		);
	}

	if (requestQuery.isError) {
		return (
			<PanelNotice
				icon={<HandCoins aria-hidden />}
				title={t("billing.topup.loadErrorTitle")}
				body={getApiErrorMessage(requestQuery.error)}
			>
				<Button type="button" variant="outline" onClick={onClose}>
					{t("billing.topup.close")}
				</Button>
			</PanelNotice>
		);
	}

	const currentRequest = requestQuery.data?.request;

	// The API keeps one open request per wallet, so an open request replaces the form.
	if (currentRequest) {
		return (
			<PendingManualRequest
				request={currentRequest}
				isCancelPending={cancelRequest.isPending}
				error={requestError}
				onCancel={() => {
					setRequestError(null);
					void cancelRequest.mutateAsync().catch((error) => {
						if (isApiClientError(error) && error.code === "NOT_FOUND") {
							void requestQuery.refetch();
							return;
						}
						setRequestError(getApiErrorMessage(error));
					});
				}}
				onClose={onClose}
			/>
		);
	}

	const amountText =
		amountUsd === null
			? null
			: formatLocalPrice(amountUsd, locale, dzdPerUsdRate);

	return (
		<form
			className="flex flex-col gap-5"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				// Enter in a field submits too. The dialog shows the amount error, so a null amount does nothing here.
				if (amountUsd === null || createRequest.isPending) {
					return;
				}
				setRequestError(null);

				const parsed = createManualSubscriptionRequestBodySchema.safeParse(
					assembleManualSubscriptionRequestBody(amountUsd, contact),
				);

				if (!parsed.success) {
					const errors = localizeIssues(
						parsed.error.issues,
						offline.validation,
					);
					setFieldErrors(errors);
					// The amount comes from the dialog parser. A failure there is not a field error.
					if (Object.keys(errors).length === 0) {
						setRequestError(offline.validation.generic);
					}
					return;
				}

				setFieldErrors({});
				void createRequest
					.mutateAsync(parsed.data)
					.then(async (view) => {
						await recordOfflineCheckoutStart(surface);
						setSubmittedPhone(view.request?.phone ?? parsed.data.phone);
					})
					.catch((error) => {
						if (
							isApiClientError(error) &&
							error.code === "MANUAL_REQUEST_PENDING"
						) {
							void requestQuery.refetch();
						}
						setRequestError(getApiErrorMessage(error));
					});
			}}
		>
			<div>
				<h3 className="font-display font-semibold tracking-tight">
					{offline.form.title}
				</h3>
				<p className="mt-1 text-muted-foreground text-sm">
					{t("billing.topup.offline.description", {
						amount: amountText ?? "—",
					})}
				</p>
				{dzdPerUsdRate === null ? (
					<p className="mt-1 text-muted-foreground text-xs">
						{offline.localPriceNote}
					</p>
				) : null}
				<div className="mt-2">
					<TopupCreditsLine amountUsd={amountUsd} />
				</div>
			</div>

			<FieldGroup className="grid gap-4 sm:grid-cols-2">
				<Field data-invalid={Boolean(fieldErrors.fullName)}>
					<FieldLabel htmlFor="offline-full-name">
						{offline.form.fullNameLabel}
						<FieldRequirement>{offline.form.required}</FieldRequirement>
					</FieldLabel>
					<Input
						id="offline-full-name"
						value={contact.fullName}
						maxLength={120}
						required
						autoComplete="name"
						placeholder={offline.form.fullNamePlaceholder}
						aria-invalid={Boolean(fieldErrors.fullName)}
						aria-describedby={
							fieldErrors.fullName ? "offline-full-name-error" : undefined
						}
						onChange={(event) => {
							setContact((current) => ({
								...current,
								fullName: event.target.value,
							}));
							clearFieldError(setFieldErrors, "fullName");
						}}
					/>
					<FieldError id="offline-full-name-error">
						{fieldErrors.fullName}
					</FieldError>
				</Field>

				<Field data-invalid={Boolean(fieldErrors.phone)}>
					<FieldLabel htmlFor="offline-phone">
						{offline.form.phoneLabel}
						<FieldRequirement>{offline.form.required}</FieldRequirement>
					</FieldLabel>
					<Input
						id="offline-phone"
						type="tel"
						dir="ltr"
						value={contact.phone}
						maxLength={32}
						required
						autoComplete="tel"
						className="text-start"
						placeholder={offline.form.phonePlaceholder}
						aria-invalid={Boolean(fieldErrors.phone)}
						aria-describedby={
							fieldErrors.phone
								? "offline-phone-hint offline-phone-error"
								: "offline-phone-hint"
						}
						onChange={(event) => {
							setContact((current) => ({
								...current,
								phone: event.target.value,
							}));
							clearFieldError(setFieldErrors, "phone");
						}}
					/>
					<FieldDescription id="offline-phone-hint">
						{offline.form.phoneHint}
					</FieldDescription>
					<FieldError id="offline-phone-error">{fieldErrors.phone}</FieldError>
				</Field>

				<Field data-invalid={Boolean(fieldErrors.company)}>
					<FieldLabel htmlFor="offline-company">
						{offline.form.companyLabel}
						<FieldRequirement>{offline.form.optional}</FieldRequirement>
					</FieldLabel>
					<Input
						id="offline-company"
						value={contact.company}
						maxLength={120}
						autoComplete="organization"
						placeholder={offline.form.companyPlaceholder}
						aria-invalid={Boolean(fieldErrors.company)}
						aria-describedby={
							fieldErrors.company ? "offline-company-error" : undefined
						}
						onChange={(event) => {
							setContact((current) => ({
								...current,
								company: event.target.value,
							}));
							clearFieldError(setFieldErrors, "company");
						}}
					/>
					<FieldError id="offline-company-error">
						{fieldErrors.company}
					</FieldError>
				</Field>

				<Field data-invalid={Boolean(fieldErrors.country)}>
					<FieldLabel htmlFor="offline-country">
						{offline.form.countryLabel}
						<FieldRequirement>{offline.form.required}</FieldRequirement>
					</FieldLabel>
					<Select
						value={contact.country}
						onValueChange={(value) => {
							const parsed = manualBillingCountrySchema.safeParse(value);
							if (parsed.success) {
								setContact((current) => ({
									...current,
									country: parsed.data,
								}));
								clearFieldError(setFieldErrors, "country");
							}
						}}
					>
						<SelectTrigger
							id="offline-country"
							className="w-full"
							aria-invalid={Boolean(fieldErrors.country)}
							aria-required="true"
							aria-describedby={
								fieldErrors.country ? "offline-country-error" : undefined
							}
						>
							<SelectValue placeholder={offline.form.countryPlaceholder} />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								{manualBillingCountries.map((country) => (
									<SelectItem key={country} value={country}>
										{offline.countries[country]}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
					<FieldError id="offline-country-error">
						{fieldErrors.country}
					</FieldError>
				</Field>

				<Field data-invalid={Boolean(fieldErrors.city)}>
					<FieldLabel htmlFor="offline-city">
						{offline.form.cityLabel}
						<FieldRequirement>{offline.form.optional}</FieldRequirement>
					</FieldLabel>
					<Input
						id="offline-city"
						value={contact.city}
						maxLength={120}
						autoComplete="address-level2"
						placeholder={offline.form.cityPlaceholder}
						aria-invalid={Boolean(fieldErrors.city)}
						aria-describedby={
							fieldErrors.city ? "offline-city-error" : undefined
						}
						onChange={(event) => {
							setContact((current) => ({
								...current,
								city: event.target.value,
							}));
							clearFieldError(setFieldErrors, "city");
						}}
					/>
					<FieldError id="offline-city-error">{fieldErrors.city}</FieldError>
				</Field>

				<Field data-invalid={Boolean(fieldErrors.preferredPaymentMethod)}>
					<FieldLabel htmlFor="offline-payment-method">
						{offline.form.preferredMethodLabel}
						<FieldRequirement>{offline.form.optional}</FieldRequirement>
					</FieldLabel>
					<Select
						value={contact.preferredPaymentMethod || NO_METHOD_PREFERENCE}
						onValueChange={(value) => {
							const parsed = preferredPaymentMethodSchema.safeParse(value);
							setContact((current) => ({
								...current,
								preferredPaymentMethod: parsed.success ? parsed.data : "",
							}));
							clearFieldError(setFieldErrors, "preferredPaymentMethod");
						}}
					>
						<SelectTrigger
							id="offline-payment-method"
							className="w-full"
							aria-invalid={Boolean(fieldErrors.preferredPaymentMethod)}
							aria-describedby={
								fieldErrors.preferredPaymentMethod
									? "offline-payment-method-error"
									: undefined
							}
						>
							<SelectValue
								placeholder={offline.form.preferredMethodPlaceholder}
							/>
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								<SelectItem value={NO_METHOD_PREFERENCE}>
									{offline.form.noMethodPreference}
								</SelectItem>
								{preferredPaymentMethodSchema.options.map((method) => (
									<SelectItem key={method} value={method}>
										{offline.methods[method]}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
					<FieldError id="offline-payment-method-error">
						{fieldErrors.preferredPaymentMethod}
					</FieldError>
				</Field>

				<Field
					className="sm:col-span-2"
					data-invalid={Boolean(fieldErrors.notes)}
				>
					<FieldLabel htmlFor="offline-notes">
						{offline.form.notesLabel}
						<FieldRequirement>{offline.form.optional}</FieldRequirement>
					</FieldLabel>
					<Textarea
						id="offline-notes"
						value={contact.notes}
						maxLength={1000}
						rows={3}
						placeholder={offline.form.notesPlaceholder}
						aria-invalid={Boolean(fieldErrors.notes)}
						aria-describedby={
							fieldErrors.notes ? "offline-notes-error" : undefined
						}
						onChange={(event) => {
							setContact((current) => ({
								...current,
								notes: event.target.value,
							}));
							clearFieldError(setFieldErrors, "notes");
						}}
					/>
					<FieldError id="offline-notes-error">{fieldErrors.notes}</FieldError>
				</Field>
			</FieldGroup>

			{requestError ? <InlineError message={requestError} /> : null}

			<DialogFooter>
				<Button
					type="submit"
					disabled={amountUsd === null || createRequest.isPending}
				>
					<HandCoins data-icon="inline-start" aria-hidden />
					{createRequest.isPending ? offline.submitting : offline.submit}
				</Button>
			</DialogFooter>
		</form>
	);
}

function PendingManualRequest({
	request,
	isCancelPending,
	error,
	onCancel,
	onClose,
}: {
	request: ManualSubscriptionRequest;
	isCancelPending: boolean;
	error: string | null;
	onCancel: () => void;
	onClose: () => void;
}) {
	const { locale, t } = useTranslation();
	const copy = useDictionary().billing.offlineRequest;
	const purchaseSummary = usePurchaseSummary();

	return (
		<div className="flex flex-col gap-5">
			<div className="rounded-2xl border border-primary/25 bg-primary/[0.045] p-5">
				<div className="flex items-start gap-3">
					<span className="grid size-10 shrink-0 place-items-center rounded-xl border bg-background">
						<PhoneCall className="size-5" aria-hidden />
					</span>
					<div className="min-w-0">
						<h3 className="font-display font-semibold tracking-tight">
							{copy.title}
						</h3>
						<p className="mt-1 text-muted-foreground text-sm">
							{t("billing.offlineRequest.body", {
								phone: request.phone,
							})}
						</p>
					</div>
				</div>
				<dl className="mt-5 grid gap-3 rounded-xl border bg-background/70 p-4 sm:grid-cols-2">
					<RequestDetail
						label={copy.amountLabel}
						value={purchaseSummary(request)}
					/>
					<RequestDetail
						label={copy.createdLabel}
						value={formatDate(request.createdAt, locale, {
							dateStyle: "medium",
						})}
					/>
				</dl>
			</div>

			{error ? <InlineError message={error} /> : null}

			<DialogFooter>
				<ManualRequestCancelDialog
					copy={copy}
					isPending={isCancelPending}
					onConfirm={onCancel}
				/>
				<Button type="button" onClick={onClose}>
					{t("billing.topup.close")}
				</Button>
			</DialogFooter>
		</div>
	);
}

export function ManualRequestCancelDialog({
	copy,
	isPending,
	onConfirm,
}: {
	copy: {
		cancel: string;
		cancelling: string;
		cancelTitle: string;
		cancelBody: string;
		keep: string;
		confirmCancel: string;
	};
	isPending: boolean;
	onConfirm: () => void;
}) {
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button type="button" variant="outline" disabled={isPending}>
					{isPending ? copy.cancelling : copy.cancel}
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{copy.cancelTitle}</AlertDialogTitle>
					<AlertDialogDescription>{copy.cancelBody}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{copy.keep}</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						disabled={isPending}
						onClick={onConfirm}
					>
						{isPending ? copy.cancelling : copy.confirmCancel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function PanelNotice({
	icon,
	title,
	body,
	children,
}: {
	icon: React.ReactNode;
	title: string;
	body: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-5 rounded-2xl border bg-card/70 p-5">
			<span className="grid size-10 place-items-center rounded-xl border bg-muted/45 [&_svg]:size-5">
				{icon}
			</span>
			<div>
				<h3 className="font-display font-semibold text-lg tracking-tight">
					{title}
				</h3>
				<p className="mt-2 text-muted-foreground text-sm">{body}</p>
			</div>
			<DialogFooter>{children}</DialogFooter>
		</div>
	);
}

function RequestDetail({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<dt className="text-[10px] text-muted-foreground uppercase tracking-wider">
				{label}
			</dt>
			<dd className="mt-1 text-sm">{value}</dd>
		</div>
	);
}

function FieldRequirement({ children }: { children: string }) {
	return (
		<span
			aria-hidden
			className="ms-1 font-normal text-muted-foreground text-xs"
		>
			({children})
		</span>
	);
}

function InlineError({ message }: { message: string }) {
	return (
		<p
			role="alert"
			className="rounded-lg border border-destructive/25 bg-destructive/[0.045] px-3 py-2 text-destructive text-sm"
		>
			{message}
		</p>
	);
}

function localizeIssues(
	issues: readonly ZodIssue[],
	copy: Record<string, string>,
): FieldErrors {
	const errors: FieldErrors = {};

	for (const issue of issues) {
		const field = issue.path[0];
		if (typeof field !== "string" || !isManualRequestField(field)) {
			continue;
		}

		errors[field] ??= copy[field] ?? copy.generic;
	}

	return errors;
}

function isManualRequestField(value: string): value is ManualRequestField {
	return [
		"fullName",
		"phone",
		"company",
		"country",
		"city",
		"preferredPaymentMethod",
		"notes",
	].includes(value);
}

function clearFieldError(
	setErrors: React.Dispatch<React.SetStateAction<FieldErrors>>,
	field: ManualRequestField,
) {
	setErrors((current) => {
		if (!current[field]) {
			return current;
		}

		return { ...current, [field]: undefined };
	});
}
