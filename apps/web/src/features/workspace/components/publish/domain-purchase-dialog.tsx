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
	LockKeyhole,
	RefreshCw,
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
import {
	DOMAIN_SEARCH_DEBOUNCE_MS,
	type SearchDomainsResult,
	useDebouncedValue,
	useDomainSearchQuery,
} from "@/features/domains";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatNumber, useTranslation } from "@/lib/i18n";
import { RoundIconButton } from "./publish-bits";

type DomainPurchaseStep = "search" | "details" | "checkout";
type SearchState = "idle" | "loading" | "ready" | "empty" | "error";

type RegistrantDetails = {
	fullName: string;
	email: string;
	phone: string;
	streetAddress: string;
	city: string;
	region: string;
	postalCode: string;
	countryCode: string;
};

type RegistrantField = keyof RegistrantDetails;
type RegistrantErrors = Partial<Record<RegistrantField, string>>;

export type DomainPurchaseDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	suggestedStem: string;
	subdomainUrl: string;
	onConnected: (domainName: string, primary: boolean) => void;
};

const STEP_INDEX: Record<DomainPurchaseStep, number> = {
	search: 1,
	details: 2,
	checkout: 3,
};

export function DomainPurchaseDialog({
	open,
	onOpenChange,
	suggestedStem,
}: DomainPurchaseDialogProps) {
	const { t } = useTranslation();
	const { data: session } = useSession();
	const [step, setStep] = useState<DomainPurchaseStep>("search");
	const [query, setQuery] = useState(() => normalizeDomainStem(suggestedStem));
	const normalizedQuery = normalizeDomainStem(query);
	const debouncedQuery = useDebouncedValue(
		normalizedQuery,
		DOMAIN_SEARCH_DEBOUNCE_MS,
	);
	const searchEnabled = open && step === "search" && debouncedQuery.length >= 2;
	const search = useDomainSearchQuery(debouncedQuery, searchEnabled);
	const queryIsSettled = normalizedQuery === debouncedQuery;
	const results = queryIsSettled ? (search.data?.results ?? []) : [];

	const [selectedDomain, setSelectedDomain] =
		useState<SearchDomainsResult | null>(null);
	const [registrant, setRegistrant] = useState<RegistrantDetails>(() =>
		createRegistrantDefaults(),
	);
	const [registrantErrors, setRegistrantErrors] = useState<RegistrantErrors>(
		{},
	);
	const wasOpenRef = useRef(false);

	/*
	 * REAL SEARCH FLOW — this is intentionally short:
	 * 1. Normalize the text so Name.com receives a safe domain stem.
	 * 2. Debounce typing so we stay well below Name.com's request limit.
	 * 3. useDomainSearchQuery calls our backend; the backend calls Name.com.
	 *
	 * There is no local availability or price fallback. If Name.com fails, the
	 * user sees an error instead of believable-looking mock results.
	 */
	const searchState: SearchState =
		normalizedQuery.length < 2
			? "idle"
			: !queryIsSettled || search.isFetching
				? "loading"
				: search.isError
					? "error"
					: results.length > 0
						? "ready"
						: "empty";

	useEffect(() => {
		if (open && !wasOpenRef.current) {
			const initialStem = normalizeDomainStem(suggestedStem);
			setStep("search");
			setQuery(initialStem);
			setSelectedDomain(null);
			setRegistrant(createRegistrantDefaults(session?.user));
			setRegistrantErrors({});
		}

		wasOpenRef.current = open;
	}, [open, session?.user, suggestedStem]);

	useEffect(() => {
		if (!queryIsSettled || !search.data) {
			return;
		}

		setSelectedDomain((current) => {
			const currentResult = search.data.results.find(
				(result) => result.name === current?.name,
			);

			if (currentResult && canPurchaseResult(currentResult)) {
				return currentResult;
			}

			return (
				search.data.results.find((result) => canPurchaseResult(result)) ?? null
			);
		});
	}, [queryIsSettled, search.data]);

	const handleQueryChange = (value: string) => {
		setQuery(value);
		setSelectedDomain(null);
	};

	const handleRegistrantChange = (field: RegistrantField, value: string) => {
		setRegistrant((current) => ({ ...current, [field]: value }));
		setRegistrantErrors((current) => ({ ...current, [field]: undefined }));
	};

	const handleRegistrantSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const errors: RegistrantErrors = {};

		if (registrant.fullName.trim().length < 3) {
			errors.fullName = t(
				"workspace.publish.domainPurchase.validation.fullName",
			);
		}
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registrant.email.trim())) {
			errors.email = t("workspace.publish.domainPurchase.validation.email");
		}

		const normalizedPhone = registrant.phone.replace(/[\s()-]/g, "");
		if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
			errors.phone = t("workspace.publish.domainPurchase.validation.phone");
		}
		if (registrant.streetAddress.trim().length < 5) {
			errors.streetAddress = t(
				"workspace.publish.domainPurchase.validation.address",
			);
		}
		if (registrant.city.trim().length < 2) {
			errors.city = t("workspace.publish.domainPurchase.validation.city");
		}
		if (registrant.region.trim().length < 2) {
			errors.region = t("workspace.publish.domainPurchase.validation.region");
		}
		if (registrant.postalCode.trim().length < 3) {
			errors.postalCode = t(
				"workspace.publish.domainPurchase.validation.postalCode",
			);
		}
		if (!/^[A-Za-z]{2}$/.test(registrant.countryCode.trim())) {
			errors.countryCode = t(
				"workspace.publish.domainPurchase.validation.countryCode",
			);
		}

		setRegistrantErrors(errors);
		if (Object.keys(errors).length === 0) {
			setStep("checkout");
		}
	};

	const title = t(`workspace.publish.domainPurchase.${step}.title` as const);
	const description = t(
		`workspace.publish.domainPurchase.${step}.description` as const,
	);

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
							state={searchState}
							error={search.isError ? getApiErrorMessage(search.error) : null}
							onRetry={() => void search.refetch()}
							results={results}
							selected={selectedDomain}
							onSelect={setSelectedDomain}
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
							onBack={() => setStep("details")}
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
	state,
	error,
	onRetry,
	results,
	selected,
	onSelect,
	onContinue,
}: {
	query: string;
	onQueryChange: (value: string) => void;
	state: SearchState;
	error: string | null;
	onRetry: () => void;
	results: SearchDomainsResult[];
	selected: SearchDomainsResult | null;
	onSelect: (domain: SearchDomainsResult) => void;
	onContinue: () => void;
}) {
	const { t, locale } = useTranslation();

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
							aria-busy={state === "loading"}
							className="h-11 rounded-[11px] bg-background ps-10 pe-4 font-medium text-[15px] shadow-none"
						/>
					</div>
					<FieldDescription>
						{t("workspace.publish.domainPurchase.search.hint")}
					</FieldDescription>
				</Field>

				<div
					className="min-h-[214px]"
					aria-live="polite"
					aria-busy={state === "loading"}
				>
					{state === "loading" ? <SearchSkeleton /> : null}

					{state === "idle" || state === "empty" ? (
						<SearchMessage
							title={t(
								state === "empty"
									? "workspace.publish.domainPurchase.search.noResultsTitle"
									: "workspace.publish.domainPurchase.search.emptyTitle",
							)}
							description={t(
								state === "empty"
									? "workspace.publish.domainPurchase.search.noResultsDescription"
									: "workspace.publish.domainPurchase.search.emptyDescription",
							)}
						/>
					) : null}

					{state === "error" ? (
						<SearchMessage
							title={t("workspace.publish.domainPurchase.search.errorTitle")}
							description={
								error ??
								t("workspace.publish.domainPurchase.search.errorDescription")
							}
							action={
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={onRetry}
									className="mt-3"
								>
									<RefreshCw className="size-3.5" />
									{t("workspace.publish.domainPurchase.search.retry")}
								</Button>
							}
						/>
					) : null}

					{state === "ready" ? (
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
				</div>
			</ModalBody>

			<ModalFooter>
				<Button
					type="button"
					size="lg"
					disabled={!selected}
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
							<span className="shrink-0">
								{formatUsd(selected.registrationPriceUsd, locale)}
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

function SearchMessage({
	title,
	description,
	action,
}: {
	title: string;
	description: string;
	action?: React.ReactNode;
}) {
	return (
		<div className="grid min-h-[214px] place-items-center rounded-[16px] border border-dashed bg-secondary/40 p-6 text-center">
			<div className="flex max-w-[320px] flex-col items-center">
				<span className="grid size-10 place-items-center rounded-[12px] border bg-background text-primary shadow-xs">
					<Globe2 className="size-[19px]" strokeWidth={1.7} />
				</span>
				<p className="mt-3 font-medium text-sm">{title}</p>
				<p className="mt-1 text-[12.5px] text-muted-foreground leading-relaxed">
					{description}
				</p>
				{action}
			</div>
		</div>
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
	const { t, locale } = useTranslation();
	const selectable = canPurchaseResult(domain);
	const isPremium = domain.availability === "premium_blocked";
	const helper = selectable
		? t("workspace.publish.domainPurchase.search.liveAvailability")
		: isPremium
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
				<p
					dir="ltr"
					className={cn(
						"truncate font-semibold text-sm tracking-[-0.2px]",
						!selectable && "text-muted-foreground",
					)}
				>
					{domain.name}
				</p>
				<p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
					{helper}
				</p>
			</div>

			{selectable ? (
				<>
					<div className="shrink-0 text-end">
						<p className="whitespace-nowrap font-semibold text-[12.5px]">
							{formatUsd(domain.registrationPriceUsd, locale)}
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
	values: RegistrantDetails;
	errors: RegistrantErrors;
	onChange: (field: RegistrantField, value: string) => void;
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
				<div className="flex items-start gap-2 rounded-[12px] border border-primary/20 bg-primary/[0.045] px-3 py-2.5">
					<ShieldCheck
						aria-hidden
						className="mt-px size-4 shrink-0 text-primary"
						strokeWidth={1.8}
					/>
					<div>
						<p className="font-medium text-[12.5px]">
							{t("workspace.publish.domainPurchase.details.registrantTitle")}
						</p>
						<p className="mt-0.5 text-[11.5px] text-muted-foreground leading-relaxed">
							{t(
								"workspace.publish.domainPurchase.details.registrantDescription",
							)}
						</p>
					</div>
				</div>

				<FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<RegistrantInput
						id="domain-purchase-full-name"
						label={t("workspace.publish.domainPurchase.details.fullNameLabel")}
						value={values.fullName}
						error={errors.fullName}
						autoComplete="name"
						onChange={(event) => onChange("fullName", event.target.value)}
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
						hint={t("workspace.publish.domainPurchase.details.phoneHint")}
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
						id="domain-purchase-address"
						label={t("workspace.publish.domainPurchase.details.addressLabel")}
						value={values.streetAddress}
						error={errors.streetAddress}
						autoComplete="street-address"
						className="sm:col-span-2"
						onChange={(event) => onChange("streetAddress", event.target.value)}
					/>
					<RegistrantInput
						id="domain-purchase-region"
						label={t("workspace.publish.domainPurchase.details.regionLabel")}
						value={values.region}
						error={errors.region}
						autoComplete="address-level1"
						onChange={(event) => onChange("region", event.target.value)}
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
						value={values.postalCode}
						error={errors.postalCode}
						autoComplete="postal-code"
						onChange={(event) => onChange("postalCode", event.target.value)}
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
	onBack,
}: {
	domain: SearchDomainsResult;
	onBack: () => void;
}) {
	const { t, locale } = useTranslation();
	const formattedPrice = formatUsd(domain.registrationPriceUsd, locale);

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
						<p className="shrink-0 font-semibold text-sm">{formattedPrice}</p>
					</div>

					<Separator className="my-4" />

					<div className="flex items-baseline justify-between gap-4">
						<span className="font-medium text-sm">
							{t("workspace.publish.domainPurchase.checkout.estimatedTotal")}
						</span>
						<p className="font-semibold text-base">{formattedPrice}</p>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
					<CheckoutBenefit
						icon={<Globe2 className="size-4" strokeWidth={1.8} />}
						title={t(
							"workspace.publish.domainPurchase.checkout.liveQuoteTitle",
						)}
						description={t(
							"workspace.publish.domainPurchase.checkout.liveQuoteDescription",
						)}
					/>
					<CheckoutBenefit
						icon={<ShieldCheck className="size-4" strokeWidth={1.8} />}
						title={t("workspace.publish.domainPurchase.checkout.privacyTitle")}
						description={t(
							"workspace.publish.domainPurchase.checkout.privacyDescription",
						)}
					/>
				</div>

				<div className="flex items-start gap-3 rounded-[14px] border border-primary/25 bg-primary/[0.055] p-3.5">
					<span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-primary/10 text-primary">
						<LockKeyhole className="size-[17px]" strokeWidth={1.8} />
					</span>
					<div>
						<p className="font-medium text-[13px]">
							{t(
								"workspace.publish.domainPurchase.checkout.paymentUnavailableTitle",
							)}
						</p>
						<p className="mt-1 text-[11.5px] text-muted-foreground leading-relaxed">
							{t(
								"workspace.publish.domainPurchase.checkout.paymentUnavailableDescription",
							)}
						</p>
					</div>
				</div>

				<p className="text-[11.5px] text-muted-foreground leading-relaxed">
					{t("workspace.publish.domainPurchase.checkout.legalNotice")}
				</p>
			</ModalBody>

			<ModalFooter className="sm:flex-row sm:items-center">
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
				<div className="flex min-w-0 flex-1 flex-col items-stretch gap-1.5 sm:items-end">
					{/*
					 * PAYMENTS MODULE HANDOFF — intentionally disabled.
					 *
					 * 1. Create a durable domain order using this domain, registrant
					 *    data, and a fresh server-side Name.com quote.
					 * 2. Ask PaymentsModule for a Stripe checkout URL using only the
					 *    order ID and its USD amount.
					 * 3. Move forward only after PaymentsModule verifies Stripe's
					 *    webhook. Never trust a browser redirect as proof of payment.
					 *
					 * Until those three pieces exist, this button must not call the
					 * purchase endpoint or show a fake success state.
					 */}
					<Button type="button" size="lg" disabled className="w-full sm:w-auto">
						<LockKeyhole className="size-4" strokeWidth={1.9} />
						{t(
							"workspace.publish.domainPurchase.checkout.paymentUnavailableCta",
						)}
					</Button>
					<span className="text-center text-[10.5px] text-muted-foreground sm:text-end">
						{t("workspace.publish.domainPurchase.checkout.nothingCharged")}
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
	const { t, locale } = useTranslation();

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
			<p className="shrink-0 font-semibold text-[13px]">
				{formatUsd(domain.registrationPriceUsd, locale)}
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

function canPurchaseResult(
	result: SearchDomainsResult,
): result is SearchDomainsResult & { registrationPriceUsd: number } {
	return (
		result.availability === "available" && result.registrationPriceUsd !== null
	);
}

function formatUsd(
	value: number | null,
	locale: Parameters<typeof formatNumber>[1],
) {
	return value === null ? "—" : `USD ${formatNumber(value, locale)}`;
}

function createRegistrantDefaults(user?: {
	name?: string | null;
	email?: string | null;
}): RegistrantDetails {
	return {
		fullName: user?.name?.trim() ?? "",
		email: user?.email?.trim() ?? "",
		phone: "",
		streetAddress: "",
		city: "",
		region: "",
		postalCode: "",
		countryCode: "DZ",
	};
}

function normalizeDomainStem(value: string): string {
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
