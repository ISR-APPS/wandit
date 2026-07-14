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
import { Check, Copy, ExternalLink, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useSession } from "@/features/auth";
import { InsufficientCreditsDialog, PriceTag } from "@/features/credits";
import { getApiErrorMessage } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import type { Domain, SearchDomainsResult } from "../api/domains.dto";
import { usePurchaseDomain } from "../api/domains.mutations";
import {
	useDomainSearchQuery,
	useDomainsQuery,
} from "../api/domains.queries";
import { DOMAIN_SEARCH_DEBOUNCE_MS } from "../lib/constants";
import {
	createRegistrantDefaults,
	isInsufficientCreditsError,
	isAvailableSearchResult,
	normalizeDomainInput,
	purchasedDomainLiveUrl,
	registrantPathToField,
	safeDomainErrorSummary,
	toRegistrantBody,
	type RegistrantFormField,
} from "../lib/helpers";
import { useCopyToClipboard, useDebouncedValue } from "../lib/hooks";
import { registrantFormSchema, type RegistrantFlatFormValues } from "../lib/schemas";
import type { BuyDomainStep } from "../lib/store";
import { DomainStatusChip } from "./domain-status-chip";

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
	const purchase = usePurchaseDomain(projectId);
	const copy = useCopyToClipboard(t("settings.domains.copySuccess"));
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
	const [selected, setSelected] = useState<SearchDomainsResult | null>(null);
	const [registrant, setRegistrant] = useState<RegistrantFlatFormValues>(() =>
		createRegistrantDefaults(session?.user),
	);
	const [registrantErrors, setRegistrantErrors] = useState<RegistrantErrors>({});
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [purchasedDomainId, setPurchasedDomainId] = useState<string | null>(null);
	const [insufficientOpen, setInsufficientOpen] = useState(false);

	const domains = useDomainsQuery(projectId, {
		enabled: open && ["progress", "success", "failed"].includes(step),
	});

	const purchasedDomain = useMemo(() => {
		const list = domains.data ?? [];
		return (
			list.find((domain) => domain.id === purchasedDomainId) ??
			list.find((domain) => domain.name === selected?.name) ??
			null
		);
	}, [domains.data, purchasedDomainId, selected?.name]);

	useEffect(() => {
		if (open && !wasOpen.current) {
			setRegistrant(createRegistrantDefaults(session?.user));
		}

		wasOpen.current = open;
	}, [open, session?.user]);

	useEffect(() => {
		if (step !== "progress" || !purchasedDomain) {
			return;
		}

		if (purchasedDomain.status === "active") {
			setStep("success");
		}

		if (purchasedDomain.status === "failed") {
			setStep("failed");
		}
	}, [purchasedDomain, step]);

	const reset = () => {
		setStep("search");
		setSearchValue("");
		setSelected(null);
		setRegistrant(createRegistrantDefaults(session?.user));
		setRegistrantErrors({});
		setSubmitError(null);
		setPurchasedDomainId(null);
	};

	const handleOpenChange = (nextOpen: boolean) => {
		onOpenChange(nextOpen);

		if (!nextOpen) {
			window.setTimeout(reset, 150);
		}
	};

	const continueToRegistrant = () => {
		if (!selected || !isAvailableSearchResult(selected)) {
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
		if (!selected) {
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
			const response = await purchase.mutateAsync({
				name: selected.name,
				registrant: parsed.data,
			});
			setPurchasedDomainId(response.domain.id);

			if (response.domain.status === "active") {
				setStep("success");
			} else if (response.domain.status === "failed") {
				setStep("failed");
			} else {
				setStep("progress");
			}
		} catch (error) {
			if (isInsufficientCreditsError(error)) {
				setInsufficientOpen(true);
				return;
			}

			setSubmitError(getApiErrorMessage(error));
		}
	};

	const selectedCost = selected?.registrationCredits ?? 0;
	const liveUrl = selected ? purchasedDomainLiveUrl(selected.name) : "";
	const currentDomain = purchasedDomain ?? selectedToDomain(selected);

	return (
		<>
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
						<SelectedDomainSummary selected={selected} domain={currentDomain} />
					) : null}

					{step === "search" ? (
						<SearchStep
							value={searchValue}
							onChange={setSearchValue}
							searching={search.isFetching}
							error={search.isError ? getApiErrorMessage(search.error) : null}
							onRetry={() => void search.refetch()}
							results={search.data?.results ?? []}
							selected={selected}
							onSelect={setSelected}
							showMinHint={normalizedSearch.length > 0 && normalizedSearch.length < 2}
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

					{step === "progress" ? (
						<ProgressStep domain={purchasedDomain} isFetching={domains.isFetching} />
					) : null}

					{step === "success" && selected ? (
						<SuccessStep
							liveUrl={liveUrl}
							onCopy={() => void copy(liveUrl)}
						/>
					) : null}

					{step === "failed" ? (
						<FailedStep domain={purchasedDomain} />
					) : null}

					<DialogFooter>
						{step === "search" ? (
							<Button
								type="button"
								onClick={continueToRegistrant}
								disabled={!selected || !isAvailableSearchResult(selected)}
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
									disabled={purchase.isPending}
								>
									{t("settings.domains.back")}
								</Button>
								<Button
									type="button"
									onClick={() => void submitPurchase()}
									disabled={purchase.isPending}
								>
									{purchase.isPending ? <Loader2 className="animate-spin" /> : null}
									{t("settings.domains.buyConfirmCta", {
										count: selectedCost,
									})}
								</Button>
							</>
						) : null}
						{step === "success" || step === "failed" ? (
							<Button type="button" onClick={() => handleOpenChange(false)}>
								{t("settings.domains.close")}
							</Button>
						) : null}
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<InsufficientCreditsDialog
				open={insufficientOpen}
				onOpenChange={setInsufficientOpen}
				cost={selectedCost}
			/>
		</>
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
	const { t } = useTranslation();

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<Label htmlFor="domain-search">{t("settings.domains.searchLabel")}</Label>
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

			<div className="flex flex-col gap-2">
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
				{!searching && results.length > 0
					? results.map((result) => {
							const available = isAvailableSearchResult(result);
							const active = selected?.name === result.name;

							return (
								<button
									key={result.name}
									type="button"
									disabled={!available}
									onClick={() => onSelect(result)}
									className={cn(
										"flex items-center justify-between gap-4 rounded-lg border bg-background px-4 py-3 text-start transition-colors",
										available
											? "hover:bg-muted/50"
											: "cursor-not-allowed opacity-60",
										active && "border-primary bg-primary/5",
									)}
								>
									<div className="min-w-0">
										<p dir="ltr" className="truncate font-medium font-mono">
											{result.name}
										</p>
										<p className="text-muted-foreground text-xs">
											{available
												? t("settings.domains.available")
												: t("settings.domains.unavailable")}
										</p>
									</div>
									<div className="flex shrink-0 items-center gap-2">
										<PriceTag cost={result.registrationCredits} />
										{active ? <Check className="size-4 text-primary" /> : null}
									</div>
								</button>
							);
						})
					: null}
				{!searching && !error && value.trim().length >= 2 && results.length === 0 ? (
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
	domain,
}: {
	selected: SearchDomainsResult;
	domain: Domain | null;
}) {
	const { t } = useTranslation();

	return (
		<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
			<div className="min-w-0">
				<p dir="ltr" className="truncate font-medium font-mono text-sm">
					{selected.name}
				</p>
				<p className="text-muted-foreground text-xs">
					{t("settings.domains.priceAlwaysVisible")}
				</p>
			</div>
			<div className="flex items-center gap-2">
				{domain ? <DomainStatusChip status={domain.status} /> : null}
				<PriceTag cost={selected.registrationCredits} withIcon />
			</div>
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
				onChange={(event) => onChange(event.target.value)}
			/>
			{hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
			{error ? <p className="text-destructive text-xs">{error}</p> : null}
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
	const { t } = useTranslation();

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
			<p className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 font-medium text-sm">
				{t("settings.domains.confirmBurn", {
					count: selected.registrationCredits,
				})}
			</p>
			{error ? <p className="text-destructive text-sm">{error}</p> : null}
		</div>
	);
}

function ProgressStep({
	domain,
	isFetching,
}: {
	domain: Domain | null;
	isFetching: boolean;
}) {
	const { t } = useTranslation();
	const status = domain?.status ?? "registering";

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
				<Loader2 className="size-4 animate-spin text-muted-foreground" />
				<span>
					{isFetching
						? t("settings.domains.polling")
						: t("settings.domains.waiting")}
				</span>
			</div>
			<div className="grid gap-3 sm:grid-cols-3">
				<ProgressPill
					active={status === "registering"}
					done={status === "configuring" || status === "active"}
					label={t("settings.domains.progressRegistering")}
				/>
				<ProgressPill
					active={status === "configuring"}
					done={status === "active"}
					label={t("settings.domains.progressConfiguring")}
				/>
				<ProgressPill
					active={status === "active"}
					done={status === "active"}
					label={t("settings.domains.progressLive")}
				/>
			</div>
		</div>
	);
}

function ProgressPill({
	active,
	done,
	label,
}: {
	active: boolean;
	done: boolean;
	label: string;
}) {
	return (
		<div
			className={cn(
				"rounded-lg border px-3 py-2 text-sm",
				active && "border-primary bg-primary/5 text-primary",
				done && "border-success/40 bg-success/5 text-success",
			)}
		>
			{label}
		</div>
	);
}

function SuccessStep({
	liveUrl,
	onCopy,
}: {
	liveUrl: string;
	onCopy: () => void;
}) {
	const { t } = useTranslation();

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/5 px-4 py-3 text-success text-sm">
				<Check className="size-4" />
				{t("settings.domains.buySuccess")}
			</div>
			<div className="flex items-center gap-2 rounded-lg border px-3 py-2">
				<a
					href={liveUrl}
					target="_blank"
					rel="noreferrer"
					dir="ltr"
					className="min-w-0 flex-1 truncate font-mono text-primary text-sm hover:underline"
				>
					{liveUrl}
				</a>
				<Button
					type="button"
					variant="ghost"
					size="icon-xs"
					aria-label={t("settings.domains.copy")}
					onClick={onCopy}
				>
					<Copy />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon-xs"
					aria-label={t("settings.domains.openLiveUrl")}
					asChild
				>
					<a href={liveUrl} target="_blank" rel="noreferrer">
						<ExternalLink />
					</a>
				</Button>
			</div>
		</div>
	);
}

function FailedStep({ domain }: { domain: Domain | null }) {
	const { t } = useTranslation();
	const summary = safeDomainErrorSummary(domain?.error);

	return (
		<div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
			<p className="font-medium text-destructive text-sm">
				{summary
					? t("settings.domains.failedSummaryWithReason", { reason: summary })
					: t("settings.domains.failedSummary")}
			</p>
			<p className="text-muted-foreground text-sm">
				{t("settings.domains.refundedNote")}
			</p>
		</div>
	);
}

function selectedToDomain(selected: SearchDomainsResult | null): Domain | null {
	if (!selected) {
		return null;
	}

	return null;
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
