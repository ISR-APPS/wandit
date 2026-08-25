import type {
	BillingInterval,
	BillingPlanCatalogItem,
	CreditTier,
	ManualSubscriptionRequest,
	ProductEventSurface,
	Subscription,
} from "@wandit/contracts";
import {
	createManualSubscriptionRequestBodySchema,
	isManualSubscription,
	manualBillingCountries,
	manualBillingCountrySchema,
	manualPaymentMethodSchema,
	manualPaymentMethods,
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
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@wandit/ui/components/select";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { Textarea } from "@wandit/ui/components/textarea";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@wandit/ui/components/toggle-group";
import { ArrowLeft, ArrowRight, HandCoins, PhoneCall } from "lucide-react";
import { useRef, useState } from "react";
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
	type ManualRequestStep,
	stepForInvalidFields,
} from "@/features/billing/lib/manual-payment-request";
import { formatUsd, tierPriceUsd } from "@/features/billing/lib/plan-pricing";
import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";
import { useDictionary, useTranslation } from "@/lib/i18n";
import { PlanCard } from "./plan-card";

const NO_METHOD_PREFERENCE = "none";

type ManualRequestField =
	| keyof ManualPaymentContactValues
	| "plan"
	| "tierCredits"
	| "interval";

type FieldErrors = Partial<Record<ManualRequestField, string>>;

export type ManualPaymentRequestPanelProps = {
	plan: BillingPlanCatalogItem;
	subscription: Subscription | null;
	defaultFullName: string;
	initialInterval?: BillingInterval;
	initialTierCredits?: CreditTier;
	onClose: () => void;
	surface: ProductEventSurface;
};

export function ManualPaymentRequestPanel({
	plan,
	subscription,
	defaultFullName,
	initialInterval,
	initialTierCredits,
	onClose,
	surface,
}: ManualPaymentRequestPanelProps) {
	const { locale, t } = useTranslation();
	const copy = useDictionary().billing.planPicker;
	const offline = copy.offline;
	const requestQuery = useManualSubscriptionRequestQuery();
	const createRequest = useCreateManualSubscriptionRequest();
	const cancelRequest = useCancelManualSubscriptionRequest();
	const [interval, setInterval] = useState<BillingInterval>(
		initialInterval ?? subscription?.interval ?? "month",
	);
	const [tierCredits, setTierCredits] = useState<CreditTier>(() =>
		resolveInitialTier(plan, subscription, initialTierCredits),
	);
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
	const [step, setStep] = useState<ManualRequestStep>("plan");
	const stepHeadingRef = useRef<HTMLHeadingElement | null>(null);
	const stepChangedAt = useRef(0);

	// Focus lands on the new step's heading so keyboard and screen reader
	// users start at the top of the step, not mid-form.
	const goToStep = (next: ManualRequestStep) => {
		if (next !== step) {
			stepChangedAt.current = performance.now();
			requestAnimationFrame(() => stepHeadingRef.current?.focus());
		}
		setStep(next);
	};
	const tier =
		plan.tiers.find((item) => item.tierCredits === tierCredits) ??
		plan.tiers[0];

	if (!tier) {
		return null;
	}

	if (submittedPhone) {
		return (
			<PanelNotice
				icon={<PhoneCall aria-hidden />}
				title={offline.success.title}
				body={t("billing.planPicker.offline.success.body", {
					phone: submittedPhone,
				})}
			>
				<Button type="button" onClick={onClose}>
					{offline.close}
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
				title={copy.loadErrorTitle}
				body={getApiErrorMessage(requestQuery.error)}
			>
				<Button type="button" variant="outline" onClick={onClose}>
					{offline.close}
				</Button>
			</PanelNotice>
		);
	}

	const currentRequest = requestQuery.data?.request;

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

	// A live CARD subscription cannot file an offline request — the server
	// answers 409 ALREADY_SUBSCRIBED. Explain instead of rendering a form
	// that can only fail (review finding).
	if (subscription && !isManualSubscription(subscription)) {
		return (
			<PanelNotice
				icon={<HandCoins aria-hidden />}
				title={offline.cardActive.title}
				body={offline.cardActive.body}
			>
				<Button type="button" variant="outline" onClick={onClose}>
					{offline.close}
				</Button>
			</PanelNotice>
		);
	}

	const managedOffline = isManualSubscription(subscription);
	const planName = plan.id === "business" ? copy.businessName : copy.proName;
	const planTagline =
		plan.id === "business" ? copy.businessTagline : copy.proTagline;
	const planFeatures =
		plan.id === "business" ? copy.businessFeatures : copy.proFeatures;

	return (
		<form
			className="flex flex-col gap-5"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();

				if (step === "plan") {
					goToStep("contact");
					return;
				}

				// The second click of a double-click on Continue lands on the
				// submit button that replaces it. Ignore submits that arrive
				// faster than a person can read the step.
				if (performance.now() - stepChangedAt.current < 350) {
					return;
				}

				setRequestError(null);

				const candidate = assembleManualSubscriptionRequestBody(
					{ interval, plan: plan.id, tierCredits: tier.tierCredits },
					contact,
				);
				const parsed =
					createManualSubscriptionRequestBodySchema.safeParse(candidate);

				if (!parsed.success) {
					const errors = localizeIssues(
						parsed.error.issues,
						offline.validation,
					);
					setFieldErrors(errors);
					goToStep(
						stepForInvalidFields(
							Object.entries(errors)
								.filter(([, message]) => Boolean(message))
								.map(([field]) => field),
						),
					);
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
			{managedOffline ? (
				<div className="rounded-2xl border border-primary/25 bg-primary/[0.045] p-4">
					<div className="flex items-start gap-3">
						<PhoneCall className="mt-0.5 size-5 shrink-0" aria-hidden />
						<div>
							<h3 className="font-display font-semibold tracking-tight">
								{offline.managed.title}
							</h3>
							<p className="mt-1 text-muted-foreground text-sm">
								{offline.managed.body}
							</p>
						</div>
					</div>
				</div>
			) : null}

			{step === "plan" ? (
				<>
					<StepHeader
						current={1}
						title={offline.steps.plan}
						headingRef={stepHeadingRef}
					/>

					<Field>
						<FieldLabel>
							{copy.billingCycle}
							<FieldRequirement>{offline.form.required}</FieldRequirement>
						</FieldLabel>
						<ToggleGroup
							type="single"
							value={interval}
							variant="outline"
							spacing={0}
							className="w-full"
							aria-label={copy.billingCycle}
							aria-required="true"
							aria-describedby={
								fieldErrors.interval ? "offline-interval-error" : undefined
							}
							onValueChange={(value) => {
								if (value === "month" || value === "year") {
									setInterval(value);
									clearFieldError(setFieldErrors, "interval");
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
						<FieldError id="offline-interval-error">
							{fieldErrors.interval}
						</FieldError>
					</Field>

					<PlanCard
						name={planName}
						tagline={planTagline}
						tier={tier}
						tiers={plan.tiers}
						basePer100Usd={plan.basePer100Usd}
						interval={interval}
						perLabel={interval === "year" ? copy.perYear : copy.perMonth}
						selectId="offline-billing-tier"
						selectLabel={copy.creditTier}
						onSelectTier={(nextTier) => {
							setTierCredits(nextTier);
							clearFieldError(setFieldErrors, "tierCredits");
						}}
						features={planFeatures}
						featureColumns={2}
						highlighted
						action={
							<div className="mt-4 flex items-start gap-2 rounded-xl border bg-muted/30 p-3 text-sm">
								<PhoneCall className="mt-0.5 size-4 shrink-0" aria-hidden />
								<p className="text-muted-foreground">
									{offline.localPriceNote}
								</p>
							</div>
						}
					/>
				</>
			) : (
				<>
					<StepHeader
						current={2}
						title={offline.form.title}
						description={offline.form.description}
						headingRef={stepHeadingRef}
					/>

					<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/30 px-4 py-3">
						<div className="min-w-0">
							<p className="font-medium text-sm">{planName}</p>
							<p className="mt-0.5 text-muted-foreground text-xs">
								{t("credits.creditUnit", { count: tier.tierCredits })}
								{" · "}
								{formatUsd(tierPriceUsd(tier, interval), locale)}{" "}
								{interval === "year" ? copy.perYear : copy.perMonth}
							</p>
							<p className="mt-1 text-muted-foreground text-xs">
								{offline.localPriceNote}
							</p>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => goToStep("plan")}
						>
							{offline.changePlan}
						</Button>
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
							<FieldError id="offline-phone-error">
								{fieldErrors.phone}
							</FieldError>
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
							<FieldError id="offline-city-error">
								{fieldErrors.city}
							</FieldError>
						</Field>

						<Field data-invalid={Boolean(fieldErrors.preferredPaymentMethod)}>
							<FieldLabel htmlFor="offline-payment-method">
								{offline.form.preferredMethodLabel}
								<FieldRequirement>{offline.form.optional}</FieldRequirement>
							</FieldLabel>
							<Select
								value={contact.preferredPaymentMethod || NO_METHOD_PREFERENCE}
								onValueChange={(value) => {
									const parsed = manualPaymentMethodSchema.safeParse(value);
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
										{manualPaymentMethods.map((method) => (
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
							<FieldError id="offline-notes-error">
								{fieldErrors.notes}
							</FieldError>
						</Field>
					</FieldGroup>
				</>
			)}

			{requestError ? <InlineError message={requestError} /> : null}

			<DialogFooter>
				{step === "plan" ? (
					/* Keyed buttons: without keys React reuses one DOM node across
					   the swap, its type flips button->submit while the click is
					   still in flight, and the browser submits the form. No Close
					   here — it would share its slot with Back on the next step and
					   a double-click on Back would close the dialog and destroy the
					   typed form. The dialog's X button and Escape still close. */
					<Button
						key="continue"
						type="button"
						onClick={() => goToStep("contact")}
					>
						{offline.continue}
						<ArrowRight className="rtl:rotate-180" aria-hidden />
					</Button>
				) : (
					<>
						<Button
							key="back"
							type="button"
							variant="outline"
							onClick={() => goToStep("plan")}
						>
							<ArrowLeft className="rtl:rotate-180" aria-hidden />
							{copy.back}
						</Button>
						<Button
							key="submit"
							type="submit"
							disabled={createRequest.isPending}
						>
							<HandCoins data-icon="inline-start" aria-hidden />
							{createRequest.isPending ? offline.submitting : offline.submit}
						</Button>
					</>
				)}
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
	const copy = useDictionary().billing.planPicker;
	const offline = copy.offline;

	return (
		<div className="flex flex-col gap-5">
			<div className="rounded-2xl border border-primary/25 bg-primary/[0.045] p-5">
				<div className="flex items-start gap-3">
					<span className="grid size-10 shrink-0 place-items-center rounded-xl border bg-background">
						<PhoneCall className="size-5" aria-hidden />
					</span>
					<div className="min-w-0">
						<h3 className="font-display font-semibold tracking-tight">
							{offline.pending.title}
						</h3>
						<p className="mt-1 text-muted-foreground text-sm">
							{t("billing.planPicker.offline.pending.body", {
								phone: request.phone,
							})}
						</p>
					</div>
				</div>
				<dl className="mt-5 grid gap-3 rounded-xl border bg-background/70 p-4 sm:grid-cols-2">
					<RequestDetail
						label={offline.pending.planLabel}
						value={
							request.plan === "business" ? copy.businessName : copy.proName
						}
					/>
					<RequestDetail
						label={offline.pending.tierLabel}
						value={t("credits.creditUnit", { count: request.tierCredits })}
					/>
					<RequestDetail
						label={offline.pending.cycleLabel}
						value={request.interval === "year" ? copy.yearly : copy.monthly}
					/>
					<RequestDetail
						label={offline.pending.createdLabel}
						value={formatDate(request.createdAt, locale, {
							dateStyle: "medium",
						})}
					/>
				</dl>
			</div>

			{error ? <InlineError message={error} /> : null}

			<DialogFooter>
				<ManualRequestCancelDialog
					copy={offline.pending}
					isPending={isCancelPending}
					onConfirm={onCancel}
				/>
				<Button type="button" onClick={onClose}>
					{offline.close}
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

const TOTAL_STEPS = 2;

function StepHeader({
	current,
	title,
	description,
	headingRef,
}: {
	current: number;
	title: string;
	description?: string;
	headingRef: React.Ref<HTMLHeadingElement>;
}) {
	const { t } = useTranslation();
	const labelId = `offline-step-label-${current}`;

	return (
		<div>
			<p
				id={labelId}
				className="text-[10px] text-muted-foreground uppercase tracking-wider"
			>
				{t("billing.planPicker.offline.steps.label", {
					current,
					total: TOTAL_STEPS,
				})}
			</p>
			{/* aria-describedby: focus lands on the heading, which sits after
			    the progress label in the DOM — without the link screen readers
			    never announce the wizard position. */}
			<h3
				ref={headingRef}
				tabIndex={-1}
				aria-describedby={labelId}
				className="mt-1 font-display font-semibold tracking-tight outline-none"
			>
				{title}
			</h3>
			{description ? (
				<p className="mt-1 text-muted-foreground text-sm">{description}</p>
			) : null}
		</div>
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

function resolveInitialTier(
	plan: BillingPlanCatalogItem,
	subscription: Subscription | null,
	initialTierCredits: CreditTier | undefined,
): CreditTier {
	const requestedTier =
		initialTierCredits ??
		(subscription?.plan === plan.id ? subscription.tierCredits : undefined);

	return (
		plan.tiers.find((tier) => tier.tierCredits === requestedTier)
			?.tierCredits ??
		plan.tiers[0]?.tierCredits ??
		250
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
		"plan",
		"tierCredits",
		"interval",
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
