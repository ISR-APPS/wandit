import type { SearchDomainsResult } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@wandit/ui/components/dialog";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@wandit/ui/components/field";
import { Input } from "@wandit/ui/components/input";
import { Separator } from "@wandit/ui/components/separator";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import {
	ArrowLeft,
	Check,
	ChevronRight,
	Globe2,
	Loader2,
	LockKeyhole,
	Search,
	ShieldCheck,
	X,
} from "lucide-react";
import {
	type ComponentProps,
	type FormEvent,
	useEffect,
	useRef,
	useState,
} from "react";

import { useSession } from "@/features/auth";
import { useDomainSearchQuery } from "@/features/domains/api/domains.queries";
import { DOMAIN_SEARCH_DEBOUNCE_MS } from "@/features/domains/lib/constants";
import {
	createRegistrantDefaults,
	normalizeDomainInput,
	type RegistrantFormField,
	registrantPathToField,
	toRegistrantBody,
} from "@/features/domains/lib/helpers";
import { useDebouncedValue } from "@/features/domains/lib/hooks";
import type { RegistrantFlatFormValues } from "@/features/domains/lib/schemas";
import { registrantFormSchema } from "@/features/domains/lib/schemas";
import { useCreateDomainOrder } from "@/features/orders/api/orders.mutations";
import { getApiErrorMessage } from "@/lib/api-client";
import { type Locale, useTranslation } from "@/lib/i18n";
import { RoundIconButton } from "./publish-bits";

type DomainPurchaseStep = "search" | "details" | "checkout";

type RegistrantErrors = Partial<Record<RegistrantFormField, string>>;

export type DomainPurchaseDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectId: string;
	suggestedStem: string;
};

const STEP_INDEX: Record<DomainPurchaseStep, number> = {
	search: 1,
	details: 2,
	checkout: 3,
};

export function DomainPurchaseDialog({
	open,
	onOpenChange,
	projectId,
	suggestedStem,
}: DomainPurchaseDialogProps) {
	const { t } = useTranslation();
	const { data: session } = useSession();
	const createOrder = useCreateDomainOrder();
	const wasOpenRef = useRef(false);

	const [step, setStep] = useState<DomainPurchaseStep>("search");
	const [query, setQuery] = useState(() => normalizeDomainStem(suggestedStem));
	const normalizedSearch = normalizeDomainInput(query);
	const debouncedSearch = useDebouncedValue(
		normalizedSearch,
		DOMAIN_SEARCH_DEBOUNCE_MS,
	);
	const search = useDomainSearchQuery(
		debouncedSearch,
		open && step === "search" && debouncedSearch.length >= 2,
	);
	const searchMatchesInput = debouncedSearch === normalizedSearch;
	const searchResults = searchMatchesInput ? search.data?.results : undefined;

	const [selectedDomain, setSelectedDomain] =
		useState<SearchDomainsResult | null>(null);
	const [registrant, setRegistrant] = useState<RegistrantFlatFormValues>(() =>
		createRegistrantDefaults(session?.user),
	);
	const [registrantErrors, setRegistrantErrors] = useState<RegistrantErrors>(
		{},
	);
	const [submitError, setSubmitError] = useState<string | null>(null);

	useEffect(() => {
		if (open && !wasOpenRef.current) {
			setStep("search");
			setQuery(normalizeDomainStem(suggestedStem));
			setSelectedDomain(null);
			setRegistrant(createRegistrantDefaults(session?.user));
			setRegistrantErrors({});
			setSubmitError(null);
		}

		wasOpenRef.current = open;
	}, [open, session?.user, suggestedStem]);

	useEffect(() => {
		if (!open || step !== "search" || !searchResults) {
			return;
		}

		setSelectedDomain((current) => {
			const currentResult = searchResults.find(
				(result) => result.name === current?.name && canPurchaseResult(result),
			);

			return currentResult ?? searchResults.find(canPurchaseResult) ?? null;
		});
	}, [open, searchResults, step]);

	const handleQueryChange = (value: string) => {
		setQuery(value);
		setSelectedDomain(null);
		setSubmitError(null);
	};

	const handleRegistrantChange = (
		field: RegistrantFormField,
		value: string,
	) => {
		setRegistrant((current) => ({ ...current, [field]: value }));
		setRegistrantErrors((current) => ({ ...current, [field]: undefined }));
	};

	const handleRegistrantSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const parsed = registrantFormSchema.safeParse(toRegistrantBody(registrant));

		if (!parsed.success) {
			setRegistrantErrors(registrantErrorsFromIssues(parsed.error.issues, t));
			return;
		}

		setRegistrantErrors({});
		setSubmitError(null);
		setStep("checkout");
	};

	const submitOrder = async () => {
		if (!selectedDomain || !canPurchaseResult(selectedDomain)) {
			setStep("search");
			return;
		}

		const parsed = registrantFormSchema.safeParse(toRegistrantBody(registrant));

		if (!parsed.success) {
			setRegistrantErrors(registrantErrorsFromIssues(parsed.error.issues, t));
			setStep("details");
			return;
		}

		setSubmitError(null);

		try {
			const { checkoutUrl } = await createOrder.mutateAsync({
				domain: selectedDomain.name,
				projectId,
				registrant: parsed.data,
				// WHOIS privacy is a paid registrar add-on with no line item in
				// this charge, so it is never enabled implicitly.
				whoisPrivacy: false,
			});

			window.location.assign(checkoutUrl);
		} catch (error) {
			setSubmitError(getApiErrorMessage(error));
		}
	};

	const title =
		step === "search"
			? t("workspace.publish.domainPurchase.search.title")
			: step === "details"
				? t("workspace.publish.domainPurchase.details.title")
				: t("workspace.publish.domainPurchase.checkout.title");

	const description =
		step === "search"
			? t("workspace.publish.domainPurchase.search.description")
			: step === "details"
				? t("workspace.publish.domainPurchase.details.description")
				: t("workspace.publish.domainPurchase.checkout.description");

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton={false}
				closeLabel={t("workspace.publish.domainPurchase.common.close")}
				overlayClassName="bg-foreground/40 backdrop-blur-[2px]"
				className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[560px] flex-col gap-0 overflow-hidden rounded-[22px] p-0 shadow-[0_30px_60px_-28px_color-mix(in_oklab,var(--foreground)_45%,transparent)] sm:max-w-[560px]"
			>
				<DialogHeader className="flex h-16 shrink-0 flex-row items-center gap-2 border-b px-4 text-start sm:px-5">
					<span
						aria-hidden
						className="grid size-6 shrink-0 place-items-center rounded-full bg-primary font-semibold text-primary-foreground text-xs"
					>
						{STEP_INDEX[step]}
					</span>
					<div className="min-w-0 flex-1">
						<DialogTitle className="truncate font-semibold text-base tracking-[-0.4px]">
							{title}
						</DialogTitle>
						<DialogDescription className="sr-only">
							{description}
						</DialogDescription>
					</div>
					<span className="hidden shrink-0 text-[11.5px] text-muted-foreground sm:block">
						{t("workspace.publish.domainPurchase.common.stepCount", {
							current: STEP_INDEX[step],
							total: 3,
						})}
					</span>
					<DialogClose asChild>
						<RoundIconButton
							aria-label={t("workspace.publish.domainPurchase.common.close")}
							className="ms-1 bg-transparent text-muted-foreground"
						>
							<X className="size-[15px]" strokeWidth={2} />
						</RoundIconButton>
					</DialogClose>
				</DialogHeader>

				<div
					key={step}
					className="fade-in-0 flex min-h-0 flex-1 animate-in flex-col duration-200"
				>
					{step === "search" ? (
						<SearchStep
							query={query}
							onQueryChange={handleQueryChange}
							results={searchResults ?? []}
							selected={selectedDomain}
							onSelect={setSelectedDomain}
							searching={
								normalizedSearch.length >= 2 &&
								(!searchMatchesInput || search.isFetching)
							}
							error={
								searchMatchesInput && search.isError
									? getApiErrorMessage(search.error)
									: null
							}
							onRetry={() => void search.refetch()}
							onContinue={() => setStep("details")}
						/>
					) : null}

					{step === "details" && selectedDomain ? (
						<DetailsStep
							domain={selectedDomain}
							values={registrant}
							errors={registrantErrors}
							onChange={handleRegistrantChange}
							onBack={() => setStep("search")}
							onSubmit={handleRegistrantSubmit}
						/>
					) : null}

					{step === "checkout" && selectedDomain ? (
						<CheckoutStep
							domain={selectedDomain}
							error={submitError}
							pending={createOrder.isPending}
							onBack={() => setStep("details")}
							onSubmit={() => void submitOrder()}
						/>
					) : null}
				</div>
			</DialogContent>
		</Dialog>
	);
}

function SearchStep({
	query,
	onQueryChange,
	results,
	selected,
	onSelect,
	searching,
	error,
	onRetry,
	onContinue,
}: {
	query: string;
	onQueryChange: (value: string) => void;
	results: SearchDomainsResult[];
	selected: SearchDomainsResult | null;
	onSelect: (domain: SearchDomainsResult) => void;
	searching: boolean;
	error: string | null;
	onRetry: () => void;
	onContinue: () => void;
}) {
	const { locale, t } = useTranslation();
	const hasSearch = normalizeDomainInput(query).length >= 2;

	return (
		<>
			<ModalBody className="gap-4">
				<Field>
					<FieldLabel htmlFor="domain-purchase-search">
						{t("workspace.publish.domainPurchase.search.label")}
					</FieldLabel>
					<div className="relative">
						<Search
							aria-hidden
							className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
							strokeWidth={1.9}
						/>
						<Input
							id="domain-purchase-search"
							value={query}
							onChange={(event) => onQueryChange(event.target.value)}
							placeholder={t(
								"workspace.publish.domainPurchase.search.placeholder",
							)}
							autoComplete="off"
							spellCheck={false}
							dir="ltr"
							aria-busy={searching}
							className="h-11 rounded-[11px] bg-background ps-10 pe-4 font-medium text-[15px] shadow-none"
						/>
					</div>
					<FieldDescription>
						{t("workspace.publish.domainPurchase.search.hint")}
					</FieldDescription>
				</Field>

				<div className="min-h-[214px]" aria-live="polite" aria-busy={searching}>
					{searching ? <SearchSkeleton /> : null}

					{!searching && error ? (
						<div className="flex min-h-[214px] items-center justify-center rounded-[16px] border border-destructive/30 bg-destructive/5 p-6 text-center">
							<div className="flex max-w-[320px] flex-col items-center gap-3">
								<p role="alert" className="text-destructive text-sm">
									{error}
								</p>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={onRetry}
								>
									{t("settings.domains.searchRetry")}
								</Button>
							</div>
						</div>
					) : null}

					{!searching && !error && results.length > 0 ? (
						<div className="flex flex-col gap-2">
							{results.map((domain) => (
								<DomainResultButton
									key={domain.name}
									domain={domain}
									selected={selected?.name === domain.name}
									onSelect={() => onSelect(domain)}
								/>
							))}
						</div>
					) : null}

					{!searching && !error && results.length === 0 ? (
						<div className="grid min-h-[214px] place-items-center rounded-[16px] border border-dashed bg-secondary/40 p-6 text-center">
							<div className="flex max-w-[300px] flex-col items-center">
								<span className="grid size-10 place-items-center rounded-[12px] border bg-background text-primary shadow-xs">
									<Globe2 className="size-[19px]" strokeWidth={1.7} />
								</span>
								<p className="mt-3 font-medium text-sm">
									{t(
										hasSearch
											? "workspace.publish.domainPurchase.search.noResultsTitle"
											: "workspace.publish.domainPurchase.search.emptyTitle",
									)}
								</p>
								<p className="mt-1 text-[12.5px] text-muted-foreground leading-relaxed">
									{t(
										hasSearch
											? "workspace.publish.domainPurchase.search.noResultsDescription"
											: "workspace.publish.domainPurchase.search.emptyDescription",
									)}
								</p>
							</div>
						</div>
					) : null}
				</div>
			</ModalBody>

			<ModalFooter>
				<Button
					type="button"
					size="lg"
					disabled={!selected || !canPurchaseResult(selected)}
					onClick={onContinue}
					className="w-full min-w-0 overflow-hidden active:scale-[0.98]"
				>
					{selected ? (
						<>
							<span className="min-w-0 truncate">
								{t("workspace.publish.domainPurchase.search.continueWith", {
									domain: selected.name,
								})}
							</span>
							<span aria-hidden className="shrink-0 font-normal opacity-80">
								·
							</span>
							<span className="shrink-0" dir="ltr">
								{formatDomainPrice(selected, locale)}
							</span>
						</>
					) : (
						t("workspace.publish.domainPurchase.search.continue")
					)}
				</Button>
			</ModalFooter>
		</>
	);
}

function SearchSkeleton() {
	return (
		<div className="flex flex-col gap-2">
			{[0, 1, 2, 3, 4, 5].map((item) => (
				<div
					key={item}
					className="flex min-h-[62px] items-center gap-3 rounded-[13px] border px-3 py-2.5"
				>
					<div className="flex min-w-0 flex-1 flex-col gap-2">
						<Skeleton className="h-3.5 w-28" />
						<Skeleton className="h-3 w-20" />
					</div>
					<div className="flex w-20 shrink-0 flex-col items-end gap-1.5">
						<Skeleton className="h-3.5 w-16" />
						<Skeleton className="h-2.5 w-10" />
					</div>
					<Skeleton className="size-5 rounded-full" />
				</div>
			))}
		</div>
	);
}

function DomainResultButton({
	domain,
	selected,
	onSelect,
}: {
	domain: SearchDomainsResult;
	selected: boolean;
	onSelect: () => void;
}) {
	const { locale, t } = useTranslation();
	const selectable = canPurchaseResult(domain);
	// Four visible states: purchasable, premium-blocked, available-but-unpriced
	// (never purchasable — the server refused to quote it), and plain taken.
	const helper = selectable
		? t("workspace.publish.domainPurchase.search.liveAvailability")
		: domain.availability === "premium_blocked"
			? t("workspace.publish.domainPurchase.search.premiumUnavailable")
			: domain.availability === "available"
				? t("workspace.publish.domainPurchase.search.priceUnavailable")
				: t("workspace.publish.domainPurchase.search.unavailable");

	return (
		<button
			type="button"
			disabled={!selectable}
			aria-pressed={selected}
			onClick={onSelect}
			className={cn(
				"group flex min-h-[62px] items-center gap-3 rounded-[13px] border px-3 py-2.5 text-start outline-none transition-[border-color,background-color,transform,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/40",
				selectable
					? "hover:border-primary/35 hover:bg-primary/[0.025] active:scale-[0.985]"
					: "cursor-not-allowed bg-secondary/35 opacity-65",
				selected &&
					"border-primary/55 bg-primary/[0.055] shadow-[inset_0_0_0_0.5px_color-mix(in_oklab,var(--primary)_40%,transparent)]",
			)}
		>
			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 flex-wrap items-center gap-1.5">
					<span
						dir="ltr"
						className={cn(
							"truncate font-semibold text-sm tracking-[-0.2px]",
							!selectable && "text-muted-foreground",
							domain.availability === "unavailable" && "line-through",
						)}
					>
						{domain.name}
					</span>
					{domain.tld === "com" && selectable ? (
						<span className="rounded-full bg-primary px-1.5 py-0.5 font-medium text-[9.5px] text-primary-foreground">
							{t("workspace.publish.domainPurchase.search.recommended")}
						</span>
					) : null}
				</div>
				<p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
					{helper}
				</p>
			</div>

			{selectable ? (
				<>
					<div className="shrink-0 text-end">
						<p
							dir="ltr"
							className="whitespace-nowrap font-semibold text-[12.5px]"
						>
							{formatDomainPrice(domain, locale)}
							<span className="ms-0.5 font-normal text-[10px] text-muted-foreground">
								{t("workspace.publish.domainPurchase.common.perYear")}
							</span>
						</p>
					</div>
					<span
						aria-hidden
						className={cn(
							"grid size-5 shrink-0 place-items-center rounded-full border border-stone transition-colors",
							selected && "border-primary bg-primary",
						)}
					>
						{selected ? (
							<Check
								className="size-3 text-primary-foreground"
								strokeWidth={2.6}
							/>
						) : null}
					</span>
				</>
			) : (
				<span className="shrink-0 rounded-full border bg-background px-2.5 py-1 text-[10px] text-muted-foreground">
					{t("workspace.publish.domainPurchase.search.notSelectable")}
				</span>
			)}
		</button>
	);
}

function DetailsStep({
	domain,
	values,
	errors,
	onChange,
	onBack,
	onSubmit,
}: {
	domain: SearchDomainsResult;
	values: RegistrantFlatFormValues;
	errors: RegistrantErrors;
	onChange: (field: RegistrantFormField, value: string) => void;
	onBack: () => void;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
	const { t } = useTranslation();

	return (
		<form
			className="flex min-h-0 flex-1 flex-col"
			onSubmit={onSubmit}
			noValidate
		>
			<ModalBody className="gap-4">
				<SelectedDomainStrip domain={domain} />
				<div className="flex items-start gap-2 rounded-[12px] border border-success/25 bg-success/[0.055] px-3 py-2.5">
					<LockKeyhole
						aria-hidden
						className="mt-px size-4 shrink-0 text-success-text"
						strokeWidth={1.8}
					/>
					<div>
						<p className="font-medium text-[12.5px]">
							{t("workspace.publish.domainPurchase.details.privacyTitle")}
						</p>
						<p className="mt-0.5 text-[11.5px] text-muted-foreground leading-relaxed">
							{t("workspace.publish.domainPurchase.details.privacyDescription")}
						</p>
					</div>
				</div>

				<FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<RegistrantInput
						id="domain-purchase-first-name"
						label={t("settings.domains.firstNameLabel")}
						value={values.firstName}
						error={errors.firstName}
						autoComplete="given-name"
						onChange={(event) => onChange("firstName", event.target.value)}
					/>
					<RegistrantInput
						id="domain-purchase-last-name"
						label={t("settings.domains.lastNameLabel")}
						value={values.lastName}
						error={errors.lastName}
						autoComplete="family-name"
						onChange={(event) => onChange("lastName", event.target.value)}
					/>
					<RegistrantInput
						id="domain-purchase-email"
						label={t("workspace.publish.domainPurchase.details.emailLabel")}
						value={values.email}
						error={errors.email}
						type="email"
						autoComplete="email"
						onChange={(event) => onChange("email", event.target.value)}
					/>
					<RegistrantInput
						id="domain-purchase-phone"
						label={t("workspace.publish.domainPurchase.details.phoneLabel")}
						value={values.phone}
						error={errors.phone}
						type="tel"
						autoComplete="tel"
						placeholder="+213555123456"
						hint={t("settings.domains.phoneHint")}
						dir="ltr"
						onChange={(event) => onChange("phone", event.target.value)}
					/>
					<RegistrantInput
						id="domain-purchase-country"
						label={t("workspace.publish.domainPurchase.details.countryLabel")}
						value={values.countryCode}
						error={errors.countryCode}
						autoComplete="country"
						maxLength={2}
						dir="ltr"
						onChange={(event) =>
							onChange("countryCode", event.target.value.toUpperCase())
						}
					/>
					<RegistrantInput
						id="domain-purchase-region"
						label={t("workspace.publish.domainPurchase.details.regionLabel")}
						value={values.wilaya}
						error={errors.wilaya}
						autoComplete="address-level1"
						onChange={(event) => onChange("wilaya", event.target.value)}
					/>
					<RegistrantInput
						id="domain-purchase-address"
						label={t("workspace.publish.domainPurchase.details.addressLabel")}
						value={values.street}
						error={errors.street}
						autoComplete="street-address"
						className="sm:col-span-2"
						onChange={(event) => onChange("street", event.target.value)}
					/>
					<RegistrantInput
						id="domain-purchase-city"
						label={t("workspace.publish.domainPurchase.details.cityLabel")}
						value={values.city}
						error={errors.city}
						autoComplete="address-level2"
						onChange={(event) => onChange("city", event.target.value)}
					/>
					<RegistrantInput
						id="domain-purchase-postal-code"
						label={t(
							"workspace.publish.domainPurchase.details.postalCodeLabel",
						)}
						value={values.zip}
						error={errors.zip}
						autoComplete="postal-code"
						onChange={(event) => onChange("zip", event.target.value)}
					/>
				</FieldGroup>
			</ModalBody>

			<ModalFooter className="sm:flex-row sm:justify-end">
				<Button
					type="button"
					variant="outline"
					size="lg"
					onClick={onBack}
					className="active:scale-[0.98]"
				>
					<ArrowLeft className="size-4 rtl:rotate-180" strokeWidth={1.9} />
					{t("workspace.publish.domainPurchase.common.back")}
				</Button>
				<Button type="submit" size="lg" className="active:scale-[0.98]">
					{t("workspace.publish.domainPurchase.details.continue")}
					<ChevronRight className="size-4 rtl:rotate-180" strokeWidth={2} />
				</Button>
			</ModalFooter>
		</form>
	);
}

function RegistrantInput({
	id,
	label,
	error,
	hint,
	className,
	...inputProps
}: {
	id: string;
	label: string;
	error?: string;
	hint?: string;
	className?: string;
} & Omit<ComponentProps<typeof Input>, "id">) {
	const errorId = `${id}-error`;
	const hintId = `${id}-hint`;
	const describedBy = [hint ? hintId : null, error ? errorId : null]
		.filter(Boolean)
		.join(" ");

	return (
		<Field data-invalid={Boolean(error)} className={className}>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Input
				{...inputProps}
				id={id}
				aria-invalid={Boolean(error)}
				aria-describedby={describedBy || undefined}
				className="h-10 rounded-[10px] bg-background shadow-none"
			/>
			{hint ? <FieldDescription id={hintId}>{hint}</FieldDescription> : null}
			<FieldError id={errorId}>{error}</FieldError>
		</Field>
	);
}

function CheckoutStep({
	domain,
	error,
	pending,
	onBack,
	onSubmit,
}: {
	domain: SearchDomainsResult;
	error: string | null;
	pending: boolean;
	onBack: () => void;
	onSubmit: () => void;
}) {
	const { locale, t } = useTranslation();
	const formattedPrice = formatDomainPrice(domain, locale);

	return (
		<>
			<ModalBody className="gap-4">
				<div className="rounded-[16px] border bg-secondary p-4">
					<div className="flex items-start justify-between gap-4">
						<div className="min-w-0">
							<p dir="ltr" className="truncate font-semibold text-[15px]">
								{domain.name}
							</p>
							<p className="mt-1 text-[12px] text-muted-foreground">
								{t(
									"workspace.publish.domainPurchase.checkout.registrationTerm",
								)}
							</p>
						</div>
						<p dir="ltr" className="shrink-0 font-semibold text-sm">
							{formattedPrice}
						</p>
					</div>

					<Separator className="my-4" />

					<div className="flex items-baseline justify-between gap-4">
						<span className="font-medium text-sm">
							{t("workspace.publish.domainPurchase.checkout.totalToday")}
						</span>
						<p dir="ltr" className="font-semibold text-base">
							{formattedPrice}
						</p>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
					<CheckoutBenefit
						icon={<ShieldCheck className="size-4" strokeWidth={1.8} />}
						title={t("workspace.publish.domainPurchase.checkout.privacyTitle")}
						description={t(
							"workspace.publish.domainPurchase.checkout.privacyDescription",
						)}
					/>
					<CheckoutBenefit
						icon={<LockKeyhole className="size-4" strokeWidth={1.8} />}
						title={t("workspace.publish.domainPurchase.checkout.secureTitle")}
						description={t(
							"workspace.publish.domainPurchase.checkout.stripeCaption",
						)}
					/>
				</div>

				<p className="text-[11.5px] text-muted-foreground leading-relaxed">
					{t("workspace.publish.domainPurchase.checkout.legalNotice")}
				</p>

				{error ? (
					<p
						role="alert"
						className="rounded-[12px] border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-destructive text-sm"
					>
						{error}
					</p>
				) : null}
			</ModalBody>

			<ModalFooter className="sm:flex-row sm:items-center">
				<Button
					type="button"
					variant="outline"
					size="lg"
					onClick={onBack}
					disabled={pending}
					className="active:scale-[0.98]"
				>
					<ArrowLeft className="size-4 rtl:rotate-180" strokeWidth={1.9} />
					{t("workspace.publish.domainPurchase.common.back")}
				</Button>
				<div className="flex min-w-0 flex-1 flex-col items-stretch gap-1.5 sm:items-end">
					<Button
						type="button"
						size="lg"
						onClick={onSubmit}
						disabled={pending}
						className="w-full active:scale-[0.98] sm:w-auto"
					>
						{pending ? <Loader2 className="size-4 animate-spin" /> : null}
						{t("workspace.publish.domainPurchase.checkout.continueToStripe", {
							amount: formattedPrice,
						})}
					</Button>
					<span className="text-center text-[10.5px] text-muted-foreground sm:text-end">
						{t("workspace.publish.domainPurchase.checkout.stripeCaption")}
					</span>
				</div>
			</ModalFooter>
		</>
	);
}

function CheckoutBenefit({
	icon,
	title,
	description,
}: {
	icon: React.ReactNode;
	title: string;
	description: string;
}) {
	return (
		<div className="flex gap-2.5 rounded-[13px] border px-3 py-3">
			<span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-primary/10 text-primary">
				{icon}
			</span>
			<div>
				<p className="font-medium text-[12.5px]">{title}</p>
				<p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
					{description}
				</p>
			</div>
		</div>
	);
}

function SelectedDomainStrip({ domain }: { domain: SearchDomainsResult }) {
	const { locale, t } = useTranslation();

	return (
		<div className="flex items-center gap-3 rounded-[12px] border bg-secondary px-3 py-2.5">
			<span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-primary/10 text-primary">
				<Globe2 className="size-4" strokeWidth={1.8} />
			</span>
			<div className="min-w-0 flex-1">
				<p dir="ltr" className="truncate font-semibold text-[13.5px]">
					{domain.name}
				</p>
				<p className="text-[11px] text-muted-foreground">
					{t("workspace.publish.domainPurchase.details.registrationTerm")}
				</p>
			</div>
			<p dir="ltr" className="shrink-0 font-semibold text-[13px]">
				{formatDomainPrice(domain, locale)}
			</p>
		</div>
	);
}

function ModalBody({
	className,
	children,
}: {
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"scroll-warm flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-5 sm:py-[18px]",
				className,
			)}
		>
			{children}
		</div>
	);
}

function ModalFooter({
	className,
	children,
}: {
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"flex shrink-0 flex-col gap-2.5 border-t px-4 py-3.5 sm:px-5 sm:py-4",
				className,
			)}
		>
			{children}
		</div>
	);
}

function registrantErrorsFromIssues(
	issues: readonly { path: PropertyKey[] }[],
	t: ReturnType<typeof useTranslation>["t"],
) {
	const errors: RegistrantErrors = {};

	for (const issue of issues) {
		const field = registrantPathToField(issue.path);

		if (field && !errors[field]) {
			errors[field] = validationMessageForField(field, t);
		}
	}

	return errors;
}

function validationMessageForField(
	field: RegistrantFormField,
	t: ReturnType<typeof useTranslation>["t"],
) {
	if (field === "email") {
		return t("settings.domains.errorEmail");
	}

	if (field === "phone") {
		return t("settings.domains.errorPhone");
	}

	if (field === "countryCode") {
		return t("settings.domains.errorCountry");
	}

	return t("settings.domains.errorRequired");
}

function canPurchaseResult(
	result: SearchDomainsResult,
): result is SearchDomainsResult & { registrationPriceUsd: number } {
	return (
		result.availability === "available" && result.registrationPriceUsd !== null
	);
}

function formatDomainPrice(domain: SearchDomainsResult, locale: Locale) {
	// Price comes from the search wire; a null quote is never substituted
	// with a fallback — such results are not selectable in the first place.
	if (domain.registrationPriceUsd === null) {
		return "—";
	}

	return formatCurrency(domain.registrationPriceUsd, locale);
}

function formatCurrency(usd: number, locale: Locale) {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: Number.isInteger(usd) ? 0 : 2,
		maximumFractionDigits: 2,
	}).format(usd);
}

function normalizeDomainStem(value: string) {
	const withoutProtocol = value
		.trim()
		.toLowerCase()
		.replace(/^https?:\/\//, "")
		.replace(/^www\./, "");
	const stem = withoutProtocol.split(/[./\s]/)[0] ?? "";

	return stem
		.replace(/[^a-z0-9-]/g, "")
		.replace(/^-+|-+$/g, "")
		.slice(0, 42);
}
