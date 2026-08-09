import { Button } from "@wandit/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@wandit/ui/components/dialog";
import { Input } from "@wandit/ui/components/input";
import { Label } from "@wandit/ui/components/label";
import { Separator } from "@wandit/ui/components/separator";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import { Check, Loader2, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useSession } from "@/features/auth";
import { useCreateDomainOrder } from "@/features/orders/api/orders.mutations";
import { getApiErrorMessage } from "@/lib/api-client";
import { type Locale, useTranslation } from "@/lib/i18n";
import type { SearchDomainsResult } from "../api/domains.dto";
import { useDomainSearchQuery } from "../api/domains.queries";
import { DOMAIN_SEARCH_DEBOUNCE_MS } from "../lib/constants";
import {
	createRegistrantDefaults,
	normalizeDomainInput,
	type RegistrantFormField,
	registrantPathToField,
	toRegistrantBody,
} from "../lib/helpers";
import { useDebouncedValue } from "../lib/hooks";
import {
	type RegistrantFlatFormValues,
	registrantFormSchema,
} from "../lib/schemas";
import type { BuyDomainStep } from "../lib/store";

type BuyDomainDialogProps = {
	projectId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

type RegistrantErrors = Partial<Record<RegistrantFormField, string>>;

export function BuyDomainDialog({
	projectId,
	open,
	onOpenChange,
}: BuyDomainDialogProps) {
	const { t } = useTranslation();
	const { data: session } = useSession();
	const createOrder = useCreateDomainOrder();
	const wasOpen = useRef(false);

	const [step, setStep] = useState<BuyDomainStep>("search");
	const [searchValue, setSearchValue] = useState("");
	const normalizedSearch = normalizeDomainInput(searchValue);
	const debouncedSearch = useDebouncedValue(
		normalizedSearch,
		DOMAIN_SEARCH_DEBOUNCE_MS,
	);
	const searchEnabled = open && debouncedSearch.length >= 2;
	const search = useDomainSearchQuery(debouncedSearch, searchEnabled);
	// Results from a previous query must not render during the debounce window,
	// or a stale row can be clicked while the visible input says otherwise.
	const queryIsSettled = debouncedSearch === normalizedSearch;
	const settledResults = queryIsSettled ? search.data?.results : undefined;
	const [selected, setSelected] = useState<SearchDomainsResult | null>(null);
	const [registrant, setRegistrant] = useState<RegistrantFlatFormValues>(() =>
		createRegistrantDefaults(session?.user),
	);
	const [registrantErrors, setRegistrantErrors] = useState<RegistrantErrors>(
		{},
	);
	const [submitError, setSubmitError] = useState<string | null>(null);

	useEffect(() => {
		if (open && !wasOpen.current) {
			setRegistrant(createRegistrantDefaults(session?.user));
		}

		wasOpen.current = open;
	}, [open, session?.user]);

	const reset = () => {
		setStep("search");
		setSearchValue("");
		setSelected(null);
		setRegistrant(createRegistrantDefaults(session?.user));
		setRegistrantErrors({});
		setSubmitError(null);
	};

	const handleOpenChange = (nextOpen: boolean) => {
		onOpenChange(nextOpen);

		if (!nextOpen) {
			window.setTimeout(reset, 150);
		}
	};

	const continueToRegistrant = () => {
		if (!selected || !canPurchaseResult(selected)) {
			return;
		}

		setSubmitError(null);
		setStep("registrant");
	};

	const continueToConfirm = () => {
		const parsed = registrantFormSchema.safeParse(toRegistrantBody(registrant));

		if (!parsed.success) {
			const nextErrors: RegistrantErrors = {};

			for (const issue of parsed.error.issues) {
				const field = registrantPathToField(issue.path);

				if (field && !nextErrors[field]) {
					nextErrors[field] = validationMessageForField(field, t);
				}
			}

			setRegistrantErrors(nextErrors);
			return;
		}

		setRegistrantErrors({});
		setSubmitError(null);
		setStep("confirm");
	};

	const submitPurchase = async () => {
		if (!selected || !canPurchaseResult(selected)) {
			setStep("search");
			return;
		}

		const parsed = registrantFormSchema.safeParse(toRegistrantBody(registrant));

		if (!parsed.success) {
			setStep("registrant");
			continueToConfirm();
			return;
		}

		setSubmitError(null);

		try {
			const { checkoutUrl } = await createOrder.mutateAsync({
				domain: selected.name,
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

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"
				closeLabel={t("common.close")}
			>
				<DialogHeader>
					<DialogTitle className="font-display">
						{t(`settings.domains.buyStepTitle.${step}`)}
					</DialogTitle>
					<DialogDescription>
						{t(`settings.domains.buyStepDescription.${step}`)}
					</DialogDescription>
				</DialogHeader>

				{selected && step !== "search" ? (
					<SelectedDomainSummary selected={selected} />
				) : null}

				{step === "search" ? (
					<SearchStep
						value={searchValue}
						onChange={(value) => {
							setSearchValue(value);
							setSelected(null);
							setSubmitError(null);
						}}
						searching={
							normalizedSearch.length >= 2 &&
							(!queryIsSettled || search.isFetching)
						}
						error={
							queryIsSettled && search.isError
								? getApiErrorMessage(search.error)
								: null
						}
						onRetry={() => void search.refetch()}
						results={settledResults ?? []}
						selected={selected}
						onSelect={setSelected}
						showMinHint={
							normalizedSearch.length > 0 && normalizedSearch.length < 2
						}
					/>
				) : null}

				{step === "registrant" ? (
					<RegistrantStep
						values={registrant}
						errors={registrantErrors}
						onChange={(field, value) => {
							setRegistrant((current) => ({ ...current, [field]: value }));
							setRegistrantErrors((current) => ({
								...current,
								[field]: undefined,
							}));
						}}
					/>
				) : null}

				{step === "confirm" && selected ? (
					<ConfirmStep
						selected={selected}
						registrant={registrant}
						error={submitError}
					/>
				) : null}

				<DialogFooter>
					{step === "search" ? (
						<Button
							type="button"
							onClick={continueToRegistrant}
							disabled={!selected || !canPurchaseResult(selected)}
						>
							{t("settings.domains.continue")}
						</Button>
					) : null}
					{step === "registrant" ? (
						<>
							<Button
								type="button"
								variant="outline"
								onClick={() => setStep("search")}
							>
								{t("settings.domains.back")}
							</Button>
							<Button type="button" onClick={continueToConfirm}>
								{t("settings.domains.continue")}
							</Button>
						</>
					) : null}
					{step === "confirm" ? (
						<>
							<Button
								type="button"
								variant="outline"
								onClick={() => setStep("registrant")}
								disabled={createOrder.isPending}
							>
								{t("settings.domains.back")}
							</Button>
							<Button
								type="button"
								onClick={() => void submitPurchase()}
								disabled={createOrder.isPending}
							>
								{createOrder.isPending ? (
									<Loader2 className="animate-spin" />
								) : null}
								{t("settings.domains.checkoutCta")}
							</Button>
						</>
					) : null}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function SearchStep({
	value,
	onChange,
	searching,
	error,
	onRetry,
	results,
	selected,
	onSelect,
	showMinHint,
}: {
	value: string;
	onChange: (value: string) => void;
	searching: boolean;
	error: string | null;
	onRetry: () => void;
	results: SearchDomainsResult[];
	selected: SearchDomainsResult | null;
	onSelect: (result: SearchDomainsResult) => void;
	showMinHint: boolean;
}) {
	const { locale, t } = useTranslation();

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<Label htmlFor="domain-search">
					{t("settings.domains.searchLabel")}
				</Label>
				<div className="relative">
					<Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						id="domain-search"
						value={value}
						onChange={(event) => onChange(event.target.value)}
						className="ps-9 font-mono"
						placeholder={t("settings.domains.searchPlaceholder")}
						dir="ltr"
					/>
				</div>
				<p className="text-muted-foreground text-xs">
					{showMinHint
						? t("settings.domains.searchMinHint")
						: t("settings.domains.searchHint")}
				</p>
			</div>

			<div className="flex flex-col gap-2" aria-live="polite">
				{searching ? (
					<>
						<Skeleton className="h-14 rounded-lg" />
						<Skeleton className="h-14 rounded-lg" />
						<Skeleton className="h-14 rounded-lg" />
					</>
				) : null}
				{!searching && error ? (
					<div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
						<p className="text-destructive">{error}</p>
						<Button type="button" variant="outline" size="sm" onClick={onRetry}>
							{t("settings.domains.searchRetry")}
						</Button>
					</div>
				) : null}
				{!searching && !error && results.length > 0
					? results.map((result) => {
							const selectable = canPurchaseResult(result);
							const active = selected?.name === result.name;
							const helper = selectable
								? t("settings.domains.available")
								: result.availability === "premium_blocked"
									? t("settings.domains.premiumUnavailable")
									: result.availability === "available"
										? t("settings.domains.priceUnavailable")
										: t("settings.domains.unavailable");

							return (
								<button
									key={result.name}
									type="button"
									disabled={!selectable}
									onClick={() => onSelect(result)}
									className={cn(
										"flex items-center justify-between gap-4 rounded-lg border bg-background px-4 py-3 text-start transition-colors",
										selectable
											? "hover:bg-muted/50"
											: "cursor-not-allowed opacity-60",
										active && "border-primary bg-primary/5",
									)}
								>
									<div className="min-w-0">
										<p dir="ltr" className="truncate font-medium font-mono">
											{result.name}
										</p>
										<p className="text-muted-foreground text-xs">{helper}</p>
									</div>
									<div className="flex shrink-0 items-center gap-2">
										{selectable ? (
											<span dir="ltr" className="font-medium text-sm">
												{formatCurrency(result.registrationPriceUsd, locale)}
											</span>
										) : null}
										{active ? <Check className="size-4 text-primary" /> : null}
									</div>
								</button>
							);
						})
					: null}
				{!searching &&
				!error &&
				value.trim().length >= 2 &&
				results.length === 0 ? (
					<p className="rounded-lg border border-dashed px-4 py-6 text-center text-muted-foreground text-sm">
						{t("settings.domains.noSearchResults")}
					</p>
				) : null}
			</div>
		</div>
	);
}

function SelectedDomainSummary({
	selected,
}: {
	selected: SearchDomainsResult;
}) {
	const { locale } = useTranslation();

	return (
		<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
			<p dir="ltr" className="min-w-0 truncate font-medium font-mono text-sm">
				{selected.name}
			</p>
			{selected.registrationPriceUsd !== null ? (
				<span dir="ltr" className="font-medium text-sm">
					{formatCurrency(selected.registrationPriceUsd, locale)}
				</span>
			) : null}
		</div>
	);
}

function RegistrantStep({
	values,
	errors,
	onChange,
}: {
	values: RegistrantFlatFormValues;
	errors: RegistrantErrors;
	onChange: (field: RegistrantFormField, value: string) => void;
}) {
	const { t } = useTranslation();

	return (
		<div className="grid gap-4 sm:grid-cols-2">
			<RegistrantField
				id="domain-first-name"
				label={t("settings.domains.firstNameLabel")}
				value={values.firstName}
				error={errors.firstName}
				onChange={(value) => onChange("firstName", value)}
			/>
			<RegistrantField
				id="domain-last-name"
				label={t("settings.domains.lastNameLabel")}
				value={values.lastName}
				error={errors.lastName}
				onChange={(value) => onChange("lastName", value)}
			/>
			<RegistrantField
				id="domain-email"
				label={t("settings.domains.emailLabel")}
				type="email"
				value={values.email}
				error={errors.email}
				onChange={(value) => onChange("email", value)}
			/>
			<RegistrantField
				id="domain-phone"
				label={t("settings.domains.phoneLabel")}
				value={values.phone}
				error={errors.phone}
				placeholder="+213555123456"
				hint={t("settings.domains.phoneHint")}
				onChange={(value) => onChange("phone", value)}
			/>
			<RegistrantField
				id="domain-company"
				label={t("settings.domains.companyLabel")}
				value={values.companyName ?? ""}
				error={errors.companyName}
				onChange={(value) => onChange("companyName", value)}
			/>
			<RegistrantField
				id="domain-country"
				label={t("settings.domains.countryLabel")}
				value={values.countryCode}
				error={errors.countryCode}
				maxLength={2}
				onChange={(value) => onChange("countryCode", value.toUpperCase())}
			/>
			<div className="sm:col-span-2">
				<RegistrantField
					id="domain-street"
					label={t("settings.domains.streetLabel")}
					value={values.street}
					error={errors.street}
					onChange={(value) => onChange("street", value)}
				/>
			</div>
			<RegistrantField
				id="domain-city"
				label={t("settings.domains.cityLabel")}
				value={values.city}
				error={errors.city}
				onChange={(value) => onChange("city", value)}
			/>
			<RegistrantField
				id="domain-wilaya"
				label={t("settings.domains.wilayaLabel")}
				value={values.wilaya}
				error={errors.wilaya}
				placeholder={t("settings.domains.wilayaPlaceholder")}
				onChange={(value) => onChange("wilaya", value)}
			/>
			<RegistrantField
				id="domain-zip"
				label={t("settings.domains.zipLabel")}
				value={values.zip}
				error={errors.zip}
				onChange={(value) => onChange("zip", value)}
			/>
		</div>
	);
}

function RegistrantField({
	id,
	label,
	value,
	error,
	hint,
	type = "text",
	placeholder,
	maxLength,
	onChange,
}: {
	id: string;
	label: string;
	value: string;
	error?: string;
	hint?: string;
	type?: string;
	placeholder?: string;
	maxLength?: number;
	onChange: (value: string) => void;
}) {
	const errorId = `${id}-error`;
	const hintId = `${id}-hint`;
	const describedBy = [hint ? hintId : null, error ? errorId : null]
		.filter(Boolean)
		.join(" ");

	return (
		<div className="flex flex-col gap-2">
			<Label htmlFor={id}>{label}</Label>
			<Input
				id={id}
				type={type}
				value={value}
				placeholder={placeholder}
				maxLength={maxLength}
				aria-invalid={Boolean(error)}
				aria-describedby={describedBy || undefined}
				onChange={(event) => onChange(event.target.value)}
			/>
			{hint ? (
				<p id={hintId} className="text-muted-foreground text-xs">
					{hint}
				</p>
			) : null}
			{error ? (
				<p id={errorId} className="text-destructive text-xs">
					{error}
				</p>
			) : null}
		</div>
	);
}

function ConfirmStep({
	selected,
	registrant,
	error,
}: {
	selected: SearchDomainsResult;
	registrant: RegistrantFlatFormValues;
	error: string | null;
}) {
	const { locale, t } = useTranslation();
	const amount =
		selected.registrationPriceUsd === null
			? null
			: formatCurrency(selected.registrationPriceUsd, locale);

	return (
		<div className="flex flex-col gap-4">
			<div className="rounded-lg border bg-background px-4 py-3">
				<div className="flex items-center justify-between gap-4">
					<span className="text-muted-foreground text-sm">
						{t("settings.domains.confirmDomain")}
					</span>
					<span dir="ltr" className="font-medium font-mono text-sm">
						{selected.name}
					</span>
				</div>
				<Separator className="my-3" />
				<div className="flex items-center justify-between gap-4">
					<span className="text-muted-foreground text-sm">
						{t("settings.domains.confirmRegistrant")}
					</span>
					<span className="min-w-0 truncate text-sm" dir="auto">
						{registrant.firstName} {registrant.lastName} · {registrant.email}
					</span>
				</div>
			</div>
			{amount ? (
				<p className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 font-medium text-sm">
					{t("settings.domains.checkoutNote", { amount })}
				</p>
			) : null}
			{error ? <p className="text-destructive text-sm">{error}</p> : null}
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

function formatCurrency(usd: number, locale: Locale) {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: Number.isInteger(usd) ? 0 : 2,
		maximumFractionDigits: 2,
	}).format(usd);
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
