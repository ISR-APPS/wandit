import { Button } from "@wandit/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@wandit/ui/components/dialog";
import { Input } from "@wandit/ui/components/input";
import { Label } from "@wandit/ui/components/label";
import { Separator } from "@wandit/ui/components/separator";
import { cn } from "@wandit/ui/lib/utils";
import {
	AlertTriangle,
	Check,
	Copy,
	ExternalLink,
	Loader2,
	RefreshCw,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import type { Domain, RequiredDomainRecord } from "../api/domains.dto";
import {
	useAttachExternalDomain,
	useVerifyDomain,
} from "../api/domains.mutations";
import {
	useDomainDnsStatusQuery,
	useDomainsQuery,
} from "../api/domains.queries";
import { domainLiveUrl, normalizeDomainInput } from "../lib/helpers";
import { useCopyToClipboard } from "../lib/hooks";
import { externalDomainFormSchema } from "../lib/schemas";
import type { ExternalDomainStep } from "../lib/store";
import { DomainPublishNotice } from "./domain-publish-notice";
import { DomainStatusChip } from "./domain-status-chip";
import { ExternalDomainSetupOptions } from "./external-domain-setup-options";

type PublishGuidanceProps = {
	isPublished?: boolean;
	canPublish?: boolean;
	onPublish?: () => void;
};

type ConnectExternalDomainProps = PublishGuidanceProps & {
	projectId: string;
	showIntro?: boolean;
	className?: string;
};

export function ConnectExternalDomain(props: ConnectExternalDomainProps) {
	return <ExternalDomainConnectWizard {...props} />;
}

export function ExternalDomainConnectDialog({
	open,
	onOpenChange,
	projectId,
	isPublished,
	canPublish,
	onPublish,
}: PublishGuidanceProps & {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectId: string;
}) {
	const { t } = useTranslation();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-h-[min(720px,calc(100dvh-2rem))] overflow-y-auto sm:max-w-3xl"
				closeLabel={t("common.close")}
			>
				<DialogHeader>
					<DialogTitle className="font-display tracking-tight">
						{t("settings.domains.externalTitle")}
					</DialogTitle>
					<DialogDescription>
						{t("settings.domains.externalDescription")}
					</DialogDescription>
				</DialogHeader>
				<ExternalDomainConnectWizard
					projectId={projectId}
					showIntro={false}
					className="border-0 bg-transparent p-0"
					isPublished={isPublished}
					canPublish={canPublish}
					onPublish={onPublish}
				/>
			</DialogContent>
		</Dialog>
	);
}

export function ExternalDomainConnectWizard({
	projectId,
	showIntro = true,
	className,
	isPublished = true,
	canPublish = false,
	onPublish,
}: ConnectExternalDomainProps) {
	const { t } = useTranslation();
	const attach = useAttachExternalDomain(projectId);
	const verify = useVerifyDomain(projectId);
	const copy = useCopyToClipboard(t("settings.domains.copySuccess"));
	const [step, setStep] = useState<ExternalDomainStep>("input");
	const [domainInput, setDomainInput] = useState("");
	const [domainId, setDomainId] = useState<string | null>(null);
	const [records, setRecords] = useState<RequiredDomainRecord[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [resumePendingDomain, setResumePendingDomain] = useState(true);
	const attachInFlight = useRef(false);
	const verifyInFlight = useRef(false);
	const inputId = useId();

	const domains = useDomainsQuery(projectId, {
		pollWhileChecking: step === "checking",
	});
	const currentDomain = useMemo(
		() => (domains.data ?? []).find((domain) => domain.id === domainId) ?? null,
		[domainId, domains.data],
	);
	// Server records win once the domain is loaded: the configure task adds
	// nameservers after ownership verification and withdraws them if the zone is
	// lost. The freshest domain-list or DNS-status response wins, while
	// attach/verify records only bridge the gap before either has records.
	const persistedRecords = currentDomain?.dns?.records;
	const stalledVerification = currentDomain?.dns?.externalVerification;
	const showRecords =
		step === "records" || step === "checking" || step === "success";
	const dnsStatus = useDomainDnsStatusQuery(domainId, {
		enabled: showRecords,
		poll: showRecords && currentDomain?.status === "configuring",
	});
	const refreshedRecords = dnsStatus.data?.domain.dns?.records;
	const refreshedRecordsAreNewest =
		refreshedRecords !== undefined &&
		dnsStatus.dataUpdatedAt >= domains.dataUpdatedAt;
	const effectiveRecords = refreshedRecordsAreNewest
		? refreshedRecords
		: persistedRecords && persistedRecords.length > 0
			? persistedRecords
			: records;

	useEffect(() => {
		if (step !== "input") {
			return;
		}

		const entry = resolveExternalDomainEntry(domains.data, resumePendingDomain);

		if (entry.domain) {
			setDomainId(entry.domain.id);
			setStep(entry.step);
		}
	}, [domains.data, resumePendingDomain, step]);

	useEffect(() => {
		const nextStep = reconcileExternalDomainStep({
			currentStep: step,
			domainStatus: currentDomain?.status,
			stalled: Boolean(stalledVerification),
			verificationPending: verify.isPending,
		});

		if (nextStep !== step) {
			setStep(nextStep);
		}
	}, [currentDomain?.status, stalledVerification, step, verify.isPending]);

	const connect = async () => {
		if (attachInFlight.current) {
			return;
		}

		const name = normalizeDomainInput(domainInput);
		const parsed = externalDomainFormSchema.safeParse({ name });

		if (!parsed.success) {
			setError(t("settings.domains.externalInvalid"));
			return;
		}

		setError(null);
		attachInFlight.current = true;

		try {
			const response = await attach.mutateAsync(parsed.data);
			setDomainId(response.domain.id);
			setRecords(response.requiredRecords);
			setStep(response.domain.status === "active" ? "success" : "records");
			toast.success(t("settings.domains.externalConnected"));
		} catch (attachError) {
			setError(getApiErrorMessage(attachError));
		} finally {
			attachInFlight.current = false;
		}
	};

	const runVerify = async () => {
		if (!domainId || verifyInFlight.current) {
			return;
		}

		setError(null);
		setStep("checking");
		verifyInFlight.current = true;

		try {
			const response = await verify.mutateAsync(domainId);

			if (response.requiredRecords) {
				setRecords(response.requiredRecords);
			}

			void dnsStatus.refetch();

			if (response.domain.status === "active") {
				setStep("success");
				toast.success(t("settings.domains.verifySuccess"));
			} else if (stalledVerification) {
				toast.success(t("settings.domains.checkAgainStarted"));
			}
		} catch (verifyError) {
			setStep("records");
			setError(getApiErrorMessage(verifyError));
		} finally {
			verifyInFlight.current = false;
		}
	};

	const reset = () => {
		setResumePendingDomain(false);
		setStep("input");
		setDomainInput("");
		setDomainId(null);
		setRecords([]);
		setError(null);
	};

	return (
		<div
			className={cn(
				"flex flex-col gap-4 rounded-lg border bg-muted/20 px-4 py-4",
				className,
			)}
		>
			{showIntro ? (
				<div>
					<h3 className="font-medium text-sm">
						{t("settings.domains.externalTitle")}
					</h3>
					<p className="mt-1 text-muted-foreground text-xs">
						{t("settings.domains.externalDescription")}
					</p>
				</div>
			) : null}

			{step === "input" ? (
				<div className="flex flex-col gap-3">
					<div className="flex gap-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-3">
						<AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
						<div className="min-w-0 flex-1">
							<p className="font-medium text-amber-900 text-sm dark:text-amber-100">
								{t("settings.domains.externalOwnershipWarningTitle")}
							</p>
							<p className="mt-0.5 text-amber-800/80 text-xs dark:text-amber-200/80">
								{t("settings.domains.externalOwnershipWarningDescription")}
							</p>
						</div>
					</div>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-end">
						<div className="min-w-0 flex-1">
							<Label htmlFor={inputId}>
								{t("settings.domains.externalLabel")}
							</Label>
							<Input
								id={inputId}
								className="mt-2 font-mono"
								dir="ltr"
								value={domainInput}
								placeholder={t("settings.domains.externalPlaceholder")}
								onChange={(event) => setDomainInput(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === "Enter") void connect();
								}}
							/>
						</div>
						<Button
							type="button"
							onClick={() => void connect()}
							disabled={attach.isPending}
						>
							{attach.isPending ? <Loader2 className="animate-spin" /> : null}
							{t("settings.domains.externalConnect")}
						</Button>
					</div>
				</div>
			) : null}

			{currentDomain ? (
				<div className="flex flex-wrap items-center gap-2 text-sm">
					<span dir="ltr" className="font-medium font-mono">
						{currentDomain.name}
					</span>
					<DomainStatusChip status={currentDomain.status} />
				</div>
			) : null}

			{showRecords && currentDomain ? (
				<div className="flex flex-col gap-4">
					<Separator />
					<ExternalDomainSetupOptions
						name={currentDomain.name}
						records={effectiveRecords}
						diagnostics={dnsStatus.data?.records}
						isRefreshing={dnsStatus.isFetching}
						onRefresh={() => void dnsStatus.refetch()}
					/>
					{dnsStatus.isError ? (
						<p className="text-destructive text-xs">
							{t("settings.domains.dnsStatusError")}
						</p>
					) : null}

					{stalledVerification ? (
						<div className="flex flex-col gap-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-3 sm:flex-row sm:items-center">
							<AlertTriangle className="size-4 shrink-0 text-amber-700 dark:text-amber-300" />
							<p className="min-w-0 flex-1 text-amber-900 text-sm dark:text-amber-100">
								{t("settings.domains.verificationStalled")}
							</p>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={verify.isPending}
								onClick={() => void runVerify()}
							>
								{verify.isPending ? (
									<Loader2 className="animate-spin" />
								) : (
									<RefreshCw />
								)}
								{t("settings.domains.checkAgain")}
							</Button>
						</div>
					) : null}

					{step === "records" || step === "checking" ? (
						<div className="flex flex-wrap items-center gap-2">
							{!stalledVerification ? (
								<Button
									type="button"
									onClick={() => void runVerify()}
									disabled={verify.isPending || step === "checking"}
								>
									{verify.isPending || step === "checking" ? (
										<Loader2 className="animate-spin" />
									) : null}
									{step === "checking"
										? t("settings.domains.verifying")
										: t("settings.domains.verify")}
								</Button>
							) : null}
							<Button type="button" variant="ghost" onClick={reset}>
								{t("settings.domains.useAnotherDomain")}
							</Button>
						</div>
					) : null}

					{step === "checking" ? (
						<p className="text-muted-foreground text-xs">
							{t("settings.domains.verifyPolling")}
						</p>
					) : null}
				</div>
			) : null}

			{step === "success" && currentDomain ? (
				<ExternalDomainSuccess
					domain={currentDomain}
					onCopy={copy}
					onReset={reset}
					isPublished={isPublished}
					canPublish={canPublish}
					onPublish={onPublish}
				/>
			) : null}

			{error ? (
				<p className="text-destructive text-sm" role="alert">
					{error}
				</p>
			) : null}
		</div>
	);
}

export function resolveExternalDomainEntry(
	domains: Domain[] | undefined,
	resumePendingDomain: boolean,
): { step: "input"; domain: null } | { step: "records"; domain: Domain } {
	if (!resumePendingDomain) {
		return { step: "input", domain: null };
	}

	const pendingDomain = (domains ?? []).reduce<Domain | null>(
		(latest, domain) => {
			if (domain.source !== "external" || domain.status !== "configuring") {
				return latest;
			}

			return !latest || domain.createdAt > latest.createdAt ? domain : latest;
		},
		null,
	);

	return pendingDomain
		? { step: "records", domain: pendingDomain }
		: { step: "input", domain: null };
}

export function reconcileExternalDomainStep({
	currentStep,
	domainStatus,
	stalled,
	verificationPending,
}: {
	currentStep: ExternalDomainStep;
	domainStatus: Domain["status"] | undefined;
	stalled: boolean;
	verificationPending: boolean;
}): ExternalDomainStep {
	if (domainStatus === "active") {
		return "success";
	}

	if (stalled && currentStep === "checking" && !verificationPending) {
		return "records";
	}

	if (
		currentStep === "checking" &&
		domainStatus !== undefined &&
		domainStatus !== "registering" &&
		domainStatus !== "configuring"
	) {
		return "records";
	}

	return currentStep;
}

export function ExternalDomainSuccess({
	domain,
	onCopy,
	onReset,
	isPublished = true,
	canPublish = false,
	onPublish,
}: {
	domain: Pick<Domain, "name" | "source">;
	onCopy: (url: string) => Promise<void>;
	onReset: () => void;
} & PublishGuidanceProps) {
	const { t } = useTranslation();
	const liveUrl = domainLiveUrl(domain);

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-col gap-3 rounded-lg border border-success/40 bg-success/5 px-4 py-3">
				<div className="flex items-center gap-2 text-sm text-success">
					<Check className="size-4" />
					{t("settings.domains.externalSuccess")}
				</div>
				<div className="flex items-center gap-2">
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
						onClick={() => void onCopy(liveUrl)}
					>
						<Copy />
					</Button>
					<Button type="button" variant="ghost" size="icon-xs" asChild>
						<a
							href={liveUrl}
							target="_blank"
							rel="noreferrer"
							aria-label={t("settings.domains.openLiveUrl")}
						>
							<ExternalLink />
						</a>
					</Button>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="self-start"
					onClick={onReset}
				>
					{t("settings.domains.useAnotherDomain")}
				</Button>
			</div>
			{!isPublished && onPublish ? (
				<DomainPublishNotice canPublish={canPublish} onPublish={onPublish} />
			) : null}
		</div>
	);
}
