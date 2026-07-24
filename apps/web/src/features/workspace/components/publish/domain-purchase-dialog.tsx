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
import { Switch } from "@wandit/ui/components/switch";
import { cn } from "@wandit/ui/lib/utils";
import {
	ArrowLeft,
	Check,
	ChevronRight,
	ExternalLink,
	Globe2,
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

import { formatNumber, useTranslation } from "@/lib/i18n";
import {
	CheckCircle,
	ChecklistRow,
	EmberOrb,
	LiveUrlRow,
	MockQr,
	PulseBar,
	RoundIconButton,
	SpinnerArc,
} from "./publish-bits";

const STRIPE_CHECKOUT_URL = "https://stripe.com/payments/checkout";
const SEARCH_DELAY_MS = 620;
const STRIPE_RETURN_DELAY_MS = 1_400;
const PROVISIONING_DELAYS_MS = [850, 1_750, 2_850, 4_050] as const;

type DomainPurchaseStep =
	| "search"
	| "details"
	| "checkout"
	| "stripe"
	| "connecting"
	| "connected";

type SearchState = "idle" | "loading" | "ready" | "empty";

type DomainOption = {
	name: string;
	priceDzd: number;
	priceUsd: number;
	available: boolean;
	kind: "recommended" | "store" | "deal" | "standard" | "taken";
	period: "year" | "firstYear";
};

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

const INITIAL_REGISTRANT_DETAILS: RegistrantDetails = {
	fullName: "Yacine Benali",
	email: "yacine@auroravoid.dz",
	phone: "+213 661 20 34 88",
	streetAddress: "14 Rue Didouche Mourad",
	city: "Sidi M'Hamed",
	region: "16 — Alger",
	postalCode: "16000",
	countryCode: "DZ",
};

const STEP_INDEX: Record<DomainPurchaseStep, number> = {
	search: 1,
	details: 2,
	checkout: 3,
	stripe: 3,
	connecting: 4,
	connected: 5,
};

export function DomainPurchaseDialog({
	open,
	onOpenChange,
	suggestedStem,
	subdomainUrl,
	onConnected,
}: DomainPurchaseDialogProps) {
	const { t } = useTranslation();
	const [step, setStep] = useState<DomainPurchaseStep>("search");
	const [query, setQuery] = useState(() => normalizeDomainStem(suggestedStem));
	const [searchState, setSearchState] = useState<SearchState>("idle");
	const [results, setResults] = useState<DomainOption[]>([]);
	const [selectedDomain, setSelectedDomain] = useState<DomainOption | null>(
		null,
	);
	const [registrant, setRegistrant] = useState<RegistrantDetails>(() => ({
		...INITIAL_REGISTRANT_DETAILS,
	}));
	const [registrantErrors, setRegistrantErrors] = useState<RegistrantErrors>(
		{},
	);
	const [autoRenew, setAutoRenew] = useState(true);
	const [stripeReturned, setStripeReturned] = useState(false);
	const [provisioningStage, setProvisioningStage] = useState(0);
	const [primaryDomain, setPrimaryDomain] = useState(true);

	const wasOpenRef = useRef(false);
	const connectedDomainRef = useRef<string | null>(null);
	const onConnectedRef = useRef(onConnected);
	onConnectedRef.current = onConnected;

	useEffect(() => {
		if (open && !wasOpenRef.current) {
			const initialStem = normalizeDomainStem(suggestedStem);
			setStep("search");
			setQuery(initialStem);
			setSearchState(initialStem.length >= 2 ? "loading" : "idle");
			setResults([]);
			setSelectedDomain(null);
			setRegistrant({ ...INITIAL_REGISTRANT_DETAILS });
			setRegistrantErrors({});
			setAutoRenew(true);
			setStripeReturned(false);
			setProvisioningStage(0);
			setPrimaryDomain(true);
			connectedDomainRef.current = null;
		}

		wasOpenRef.current = open;
	}, [open, suggestedStem]);

	useEffect(() => {
		if (!open || step !== "search") {
			return;
		}

		const stem = normalizeDomainStem(query);
		setSelectedDomain(null);
		setResults([]);

		if (stem.length < 2) {
			setSearchState("idle");
			return;
		}

		setSearchState("loading");
		const timer = window.setTimeout(() => {
			const nextResults = createMockDomainResults(stem);
			setResults(nextResults);
			setSelectedDomain(nextResults.find((result) => result.available) ?? null);
			setSearchState(nextResults.length > 0 ? "ready" : "empty");
		}, SEARCH_DELAY_MS);

		return () => window.clearTimeout(timer);
	}, [open, query, step]);

	useEffect(() => {
		if (!open || step !== "stripe") {
			return;
		}

		setStripeReturned(false);
		const markReturned = () => setStripeReturned(true);
		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				markReturned();
			}
		};
		const fallbackTimer = window.setTimeout(
			markReturned,
			STRIPE_RETURN_DELAY_MS,
		);

		window.addEventListener("focus", markReturned);
		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			window.clearTimeout(fallbackTimer);
			window.removeEventListener("focus", markReturned);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [open, step]);

	useEffect(() => {
		if (!open || step !== "connecting") {
			return;
		}

		setProvisioningStage(0);
		const timers = PROVISIONING_DELAYS_MS.map((delay, index) =>
			window.setTimeout(() => {
				if (index === PROVISIONING_DELAYS_MS.length - 1) {
					setStep("connected");
					return;
				}

				setProvisioningStage(index + 1);
			}, delay),
		);

		return () => {
			for (const timer of timers) {
				window.clearTimeout(timer);
			}
		};
	}, [open, step]);

	const commitConnectedDomain = () => {
		if (
			step !== "connected" ||
			!selectedDomain ||
			connectedDomainRef.current === selectedDomain.name
		) {
			return;
		}

		connectedDomainRef.current = selectedDomain.name;
		onConnectedRef.current(selectedDomain.name, primaryDomain);
	};

	const handleDialogOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) {
			commitConnectedDomain();
		}
		onOpenChange(nextOpen);
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
		if (registrant.phone.replace(/\D/g, "").length < 9) {
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

	const title =
		step === "search"
			? t("workspace.publish.domainPurchase.search.title")
			: step === "details"
				? t("workspace.publish.domainPurchase.details.title")
				: step === "checkout"
					? t("workspace.publish.domainPurchase.checkout.title")
					: step === "stripe"
						? t("workspace.publish.domainPurchase.stripe.title")
						: step === "connecting"
							? t("workspace.publish.domainPurchase.connecting.title")
							: t("workspace.publish.domainPurchase.connected.title");

	const description =
		step === "search"
			? t("workspace.publish.domainPurchase.search.description")
			: step === "details"
				? t("workspace.publish.domainPurchase.details.description")
				: step === "checkout"
					? t("workspace.publish.domainPurchase.checkout.description")
					: step === "stripe"
						? t("workspace.publish.domainPurchase.stripe.description")
						: step === "connecting"
							? t("workspace.publish.domainPurchase.connecting.description")
							: t("workspace.publish.domainPurchase.connected.description");

	return (
		<Dialog open={open} onOpenChange={handleDialogOpenChange}>
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
							total: 5,
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
							onQueryChange={setQuery}
							state={searchState}
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
							autoRenew={autoRenew}
							onAutoRenewChange={setAutoRenew}
							onBack={() => setStep("details")}
							onStripeHandoff={() => setStep("stripe")}
						/>
					) : null}

					{step === "stripe" && selectedDomain ? (
						<StripeWaitingStep
							domain={selectedDomain}
							returned={stripeReturned}
							onBack={() => setStep("checkout")}
							onPrototypeComplete={() => setStep("connecting")}
						/>
					) : null}

					{step === "connecting" && selectedDomain ? (
						<ConnectingStep
							domainName={selectedDomain.name}
							stage={provisioningStage}
						/>
					) : null}

					{step === "connected" && selectedDomain ? (
						<ConnectedStep
							domainName={selectedDomain.name}
							subdomainUrl={subdomainUrl}
							primary={primaryDomain}
							onPrimaryChange={setPrimaryDomain}
							onDone={() => handleDialogOpenChange(false)}
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
	results,
	selected,
	onSelect,
	onContinue,
}: {
	query: string;
	onQueryChange: (value: string) => void;
	state: SearchState;
	results: DomainOption[];
	selected: DomainOption | null;
	onSelect: (domain: DomainOption) => void;
	onContinue: () => void;
}) {
	const { t, locale } = useTranslation();

	return (
		<>
			<ModalBody className="gap-4">
				<div>
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
				</div>

				<div
					className="min-h-[214px]"
					aria-live="polite"
					aria-busy={state === "loading"}
				>
					{state === "loading" ? <SearchSkeleton /> : null}

					{state === "idle" || state === "empty" ? (
						<div className="grid min-h-[214px] place-items-center rounded-[16px] border border-dashed bg-secondary/40 p-6 text-center">
							<div className="flex max-w-[300px] flex-col items-center">
								<span className="grid size-10 place-items-center rounded-[12px] border bg-background text-primary shadow-xs">
									<Globe2 className="size-[19px]" strokeWidth={1.7} />
								</span>
								<p className="mt-3 font-medium text-sm">
									{t(
										state === "empty"
											? "workspace.publish.domainPurchase.search.noResultsTitle"
											: "workspace.publish.domainPurchase.search.emptyTitle",
									)}
								</p>
								<p className="mt-1 text-[12.5px] text-muted-foreground leading-relaxed">
									{t(
										state === "empty"
											? "workspace.publish.domainPurchase.search.noResultsDescription"
											: "workspace.publish.domainPurchase.search.emptyDescription",
									)}
								</p>
							</div>
						</div>
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
								{t("workspace.publish.domainPurchase.common.priceDzd", {
									amount: formatNumber(selected.priceDzd, locale),
								})}
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
	domain: DomainOption;
	selected: boolean;
	onSelect: () => void;
}) {
	const { t, locale } = useTranslation();
	const helper =
		domain.kind === "recommended"
			? t("workspace.publish.domainPurchase.search.privateRegistration")
			: domain.kind === "store"
				? t("workspace.publish.domainPurchase.search.storeHelper")
				: domain.kind === "deal"
					? t("workspace.publish.domainPurchase.search.dealHelper")
					: domain.kind === "standard"
						? t("workspace.publish.domainPurchase.search.standardHelper")
						: t("workspace.publish.domainPurchase.search.unavailable");

	return (
		<button
			type="button"
			disabled={!domain.available}
			aria-pressed={selected}
			onClick={onSelect}
			className={cn(
				"group flex min-h-[62px] items-center gap-3 rounded-[13px] border px-3 py-2.5 text-start outline-none transition-[border-color,background-color,transform,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/40",
				domain.available
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
							!domain.available && "text-muted-foreground line-through",
						)}
					>
						{domain.name}
					</span>
					{domain.kind === "recommended" ? (
						<span className="rounded-full bg-primary px-1.5 py-0.5 font-medium text-[9.5px] text-primary-foreground">
							{t("workspace.publish.domainPurchase.search.recommended")}
						</span>
					) : null}
					{domain.kind === "deal" ? (
						<span className="rounded-full border border-primary/35 px-1.5 py-0.5 font-medium text-[9.5px] text-primary">
							{t("workspace.publish.domainPurchase.search.firstYearDeal")}
						</span>
					) : null}
				</div>
				{domain.available ? (
					<p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
						{helper}
					</p>
				) : null}
			</div>
			{domain.available ? (
				<>
					<div className="shrink-0 text-end">
						<p className="whitespace-nowrap font-semibold text-[12.5px]">
							{t("workspace.publish.domainPurchase.common.priceDzd", {
								amount: formatNumber(domain.priceDzd, locale),
							})}
							<span className="ms-0.5 hidden font-normal text-[10px] text-muted-foreground min-[420px]:inline">
								{domain.period === "firstYear"
									? t("workspace.publish.domainPurchase.common.perFirstYear")
									: t("workspace.publish.domainPurchase.common.perYear")}
							</span>
						</p>
						<p className="mt-0.5 whitespace-nowrap text-[10px] text-muted-foreground">
							<span className="min-[420px]:hidden">
								{domain.period === "firstYear"
									? t("workspace.publish.domainPurchase.common.perFirstYear")
									: t("workspace.publish.domainPurchase.common.perYear")}{" "}
								·{" "}
							</span>
							{t("workspace.publish.domainPurchase.common.approxUsd", {
								amount: domain.priceUsd,
							})}
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
					{helper}
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
	domain: DomainOption;
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
						inputMode="numeric"
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
	autoRenew,
	onAutoRenewChange,
	onBack,
	onStripeHandoff,
}: {
	domain: DomainOption;
	autoRenew: boolean;
	onAutoRenewChange: (checked: boolean) => void;
	onBack: () => void;
	onStripeHandoff: () => void;
}) {
	const { t, locale } = useTranslation();
	const formattedPrice = t("workspace.publish.domainPurchase.common.priceDzd", {
		amount: formatNumber(domain.priceDzd, locale),
	});

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

					<div className="flex items-center gap-3">
						<div className="min-w-0 flex-1">
							<label
								htmlFor="domain-purchase-auto-renew"
								className="cursor-pointer font-medium text-[13px]"
							>
								{t("workspace.publish.domainPurchase.checkout.autoRenewTitle")}
							</label>
							<p className="mt-0.5 text-[11.5px] text-muted-foreground">
								{t(
									"workspace.publish.domainPurchase.checkout.autoRenewDescription",
									{ amount: formattedPrice },
								)}
							</p>
						</div>
						<Switch
							id="domain-purchase-auto-renew"
							checked={autoRenew}
							onCheckedChange={onAutoRenewChange}
							aria-label={t(
								"workspace.publish.domainPurchase.checkout.autoRenewTitle",
							)}
						/>
					</div>

					<Separator className="my-4" />

					<div className="flex items-baseline justify-between gap-4">
						<span className="font-medium text-sm">
							{t("workspace.publish.domainPurchase.checkout.totalToday")}
						</span>
						<div className="text-end">
							<p className="font-semibold text-base">{formattedPrice}</p>
							<p className="text-[11px] text-muted-foreground">
								{t("workspace.publish.domainPurchase.common.approxUsd", {
									amount: domain.priceUsd,
								})}
							</p>
						</div>
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
							"workspace.publish.domainPurchase.checkout.secureDescription",
						)}
					/>
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
					<Button
						asChild
						size="lg"
						className="w-full active:scale-[0.98] sm:w-auto"
					>
						<a
							href={STRIPE_CHECKOUT_URL}
							target="_blank"
							rel="noreferrer"
							onClick={onStripeHandoff}
						>
							{t("workspace.publish.domainPurchase.checkout.continueToStripe", {
								amount: formattedPrice,
							})}
							<ExternalLink className="size-4" strokeWidth={1.9} />
						</a>
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

function StripeWaitingStep({
	domain,
	returned,
	onBack,
	onPrototypeComplete,
}: {
	domain: DomainOption;
	returned: boolean;
	onBack: () => void;
	onPrototypeComplete: () => void;
}) {
	const { t } = useTranslation();

	return (
		<>
			<ModalBody className="justify-center">
				<div className="mx-auto flex w-full max-w-[390px] flex-col items-center text-center">
					<div className="relative">
						<EmberOrb className="size-[68px]">
							{returned ? (
								<Check
									className="size-7 text-primary-foreground"
									strokeWidth={2.4}
								/>
							) : (
								<SpinnerArc className="size-7" onEmber />
							)}
						</EmberOrb>
						<span className="absolute -end-3 -bottom-2 rounded-md border bg-background px-2 py-1 font-bold text-[10px] tracking-[-0.2px] shadow-sm">
							Stripe
						</span>
					</div>
					<h3 className="mt-6 font-medium text-xl tracking-[-0.55px]">
						{returned
							? t("workspace.publish.domainPurchase.stripe.returnedTitle")
							: t("workspace.publish.domainPurchase.stripe.waitingTitle")}
					</h3>
					<p className="mt-2 max-w-[340px] text-[13px] text-muted-foreground leading-relaxed">
						{returned
							? t(
									"workspace.publish.domainPurchase.stripe.returnedDescription",
									{ domain: domain.name },
								)
							: t("workspace.publish.domainPurchase.stripe.waitingDescription")}
					</p>

					<div className="mt-5 flex items-center gap-2 rounded-full border bg-secondary px-3 py-1.5 text-[11.5px] text-muted-foreground">
						<span
							aria-hidden
							className={cn(
								"size-1.5 rounded-full",
								returned ? "bg-success" : "animate-pulse bg-primary",
							)}
						/>
						{t("workspace.publish.domainPurchase.stripe.domainPending", {
							domain: domain.name,
						})}
					</div>

					<p className="mt-5 rounded-[12px] border border-primary/20 bg-primary/[0.045] px-3 py-2.5 text-[11.5px] text-muted-foreground leading-relaxed">
						{t("workspace.publish.domainPurchase.stripe.prototypeNotice")}
					</p>
				</div>
			</ModalBody>

			<ModalFooter className="sm:flex-row sm:justify-end">
				<Button type="button" variant="outline" size="lg" onClick={onBack}>
					<ArrowLeft className="size-4 rtl:rotate-180" strokeWidth={1.9} />
					{t("workspace.publish.domainPurchase.common.back")}
				</Button>
				<Button asChild variant="outline" size="lg">
					<a href={STRIPE_CHECKOUT_URL} target="_blank" rel="noreferrer">
						{t("workspace.publish.domainPurchase.stripe.openAgain")}
						<ExternalLink className="size-4" strokeWidth={1.9} />
					</a>
				</Button>
				<Button
					type="button"
					size="lg"
					onClick={onPrototypeComplete}
					className="active:scale-[0.98]"
				>
					{t("workspace.publish.domainPurchase.stripe.completePrototype")}
					<ChevronRight className="size-4 rtl:rotate-180" strokeWidth={2} />
				</Button>
			</ModalFooter>
		</>
	);
}

function ConnectingStep({
	domainName,
	stage,
}: {
	domainName: string;
	stage: number;
}) {
	const { t } = useTranslation();
	const stateFor = (index: number): "done" | "active" | "pending" => {
		if (index < stage) return "done";
		if (index === stage) return "active";
		return "pending";
	};
	const progress = [18, 42, 68, 91][stage] ?? 91;

	return (
		<ModalBody className="justify-center">
			<div className="mx-auto w-full max-w-[390px]">
				<div className="flex flex-col items-center text-center">
					<EmberOrb className="size-[68px]">
						<SpinnerArc className="size-7" onEmber />
					</EmberOrb>
					<h3 className="mt-5 font-medium text-xl tracking-[-0.55px]">
						{t("workspace.publish.domainPurchase.connecting.connectingDomain", {
							domain: domainName,
						})}
					</h3>
					<p className="mt-1.5 text-[13px] text-muted-foreground">
						{t("workspace.publish.domainPurchase.connecting.estimate")}
					</p>
				</div>

				<div className="mt-6">
					<PulseBar value={progress} />
					<div className="mt-5 flex flex-col gap-3.5 rounded-[15px] border bg-secondary/55 p-4">
						<ChecklistRow state={stateFor(0)}>
							{t(
								"workspace.publish.domainPurchase.connecting.paymentConfirmed",
							)}
						</ChecklistRow>
						<ChecklistRow state={stateFor(1)}>
							{t(
								"workspace.publish.domainPurchase.connecting.domainRegistered",
							)}
						</ChecklistRow>
						<ChecklistRow state={stateFor(2)}>
							{t("workspace.publish.domainPurchase.connecting.dnsConfigured")}
						</ChecklistRow>
						<ChecklistRow state={stateFor(3)}>
							{t("workspace.publish.domainPurchase.connecting.sslActivated")}
						</ChecklistRow>
					</div>
				</div>
			</div>
		</ModalBody>
	);
}

function ConnectedStep({
	domainName,
	subdomainUrl,
	primary,
	onPrimaryChange,
	onDone,
}: {
	domainName: string;
	subdomainUrl: string;
	primary: boolean;
	onPrimaryChange: (checked: boolean) => void;
	onDone: () => void;
}) {
	const { t } = useTranslation();
	const liveUrl = ensureHttps(domainName);
	const displayedSubdomain = displayUrl(subdomainUrl);

	return (
		<>
			<ModalBody className="gap-4">
				<div className="flex flex-col items-center py-1 text-center">
					<EmberOrb className="size-[68px]">
						<Check
							className="size-7 text-primary-foreground"
							strokeWidth={2.4}
						/>
					</EmberOrb>
					<h3 className="mt-4 font-medium text-xl tracking-[-0.55px]">
						{t("workspace.publish.domainPurchase.connected.successTitle")}
					</h3>
					<p className="mt-1.5 max-w-[360px] text-[13px] text-muted-foreground leading-relaxed">
						{t(
							"workspace.publish.domainPurchase.connected.successDescription",
							{ domain: domainName },
						)}
					</p>
				</div>

				<LiveUrlRow url={domainName} href={liveUrl} />

				<div className="flex items-center gap-3 rounded-[13px] border px-3.5 py-3">
					<CheckCircle className="size-[18px]" />
					<div className="min-w-0 flex-1">
						<label
							htmlFor="domain-purchase-primary"
							className="cursor-pointer font-medium text-[13.5px]"
						>
							{t("workspace.publish.domainPurchase.connected.primaryTitle")}
						</label>
						<p className="mt-0.5 text-[11.5px] text-muted-foreground">
							{t(
								"workspace.publish.domainPurchase.connected.primaryDescription",
							)}
						</p>
					</div>
					<Switch
						id="domain-purchase-primary"
						checked={primary}
						onCheckedChange={onPrimaryChange}
						aria-label={t(
							"workspace.publish.domainPurchase.connected.primaryTitle",
						)}
					/>
				</div>

				<div className="grid grid-cols-1 items-center gap-4 rounded-[16px] border p-3.5 sm:grid-cols-[88px_1fr]">
					<div className="mx-auto rounded-[11px] border bg-background p-1.5 shadow-[inset_0_1px_0_color-mix(in_oklab,var(--background)_60%,white)] sm:mx-0">
						<MockQr className="size-[74px]" />
					</div>
					<div className="min-w-0 text-center sm:text-start">
						<p className="font-medium text-sm">
							{t("workspace.publish.domainPurchase.connected.qrTitle")}
						</p>
						<p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">
							{t("workspace.publish.domainPurchase.connected.qrDescription")}
						</p>
					</div>
				</div>

				<p className="text-center text-[11.5px] text-muted-foreground">
					{t("workspace.publish.domainPurchase.connected.subdomainContinues", {
						url: displayedSubdomain,
					})}
				</p>
			</ModalBody>

			<ModalFooter className="sm:flex-row sm:justify-end">
				<Button type="button" variant="outline" size="lg" onClick={onDone}>
					{t("workspace.publish.domainPurchase.connected.done")}
				</Button>
				<Button asChild size="lg" className="active:scale-[0.98]">
					<a href={liveUrl} target="_blank" rel="noreferrer">
						<ExternalLink className="size-4" strokeWidth={1.9} />
						{t("workspace.publish.domainPurchase.connected.openDomain")}
					</a>
				</Button>
			</ModalFooter>
		</>
	);
}

function SelectedDomainStrip({ domain }: { domain: DomainOption }) {
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
				{t("workspace.publish.domainPurchase.common.priceDzd", {
					amount: formatNumber(domain.priceDzd, locale),
				})}
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

function createMockDomainResults(stem: string): DomainOption[] {
	if (stem.length < 2 || stem.includes("no-results")) {
		return [];
	}

	return [
		{
			name: `${stem}.com`,
			priceDzd: 2_400,
			priceUsd: 18,
			available: true,
			kind: "recommended",
			period: "year",
		},
		{
			name: `${stem}.store`,
			priceDzd: 6_900,
			priceUsd: 52,
			available: true,
			kind: "store",
			period: "year",
		},
		{
			name: `${stem}.shop`,
			priceDzd: 990,
			priceUsd: 7,
			available: true,
			kind: "deal",
			period: "firstYear",
		},
		{
			name: `${stem}.online`,
			priceDzd: 5_400,
			priceUsd: 41,
			available: true,
			kind: "standard",
			period: "year",
		},
		{
			name: `${stem}.net`,
			priceDzd: 2_900,
			priceUsd: 22,
			available: true,
			kind: "standard",
			period: "year",
		},
		{
			name: `${stem}.site`,
			priceDzd: 0,
			priceUsd: 0,
			available: false,
			kind: "taken",
			period: "year",
		},
	];
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

function ensureHttps(value: string): string {
	const normalized = value.trim();
	if (/^https?:\/\//i.test(normalized)) {
		return normalized;
	}

	return `https://${normalized}`;
}

function displayUrl(value: string): string {
	return value
		.trim()
		.replace(/^https?:\/\//i, "")
		.replace(/\/+$/, "");
}
