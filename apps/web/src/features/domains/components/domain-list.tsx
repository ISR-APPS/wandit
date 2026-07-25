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
} from "@wandit/ui/components/alert-dialog";
import { Button } from "@wandit/ui/components/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@wandit/ui/components/empty";
import { Switch } from "@wandit/ui/components/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@wandit/ui/components/table";
import { cn } from "@wandit/ui/lib/utils";
import {
	Check,
	CircleDashed,
	Copy,
	KeyRound,
	Loader2,
	Trash2,
} from "lucide-react";
import { Fragment, useState } from "react";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import type { Domain } from "../api/domains.dto";
import {
	useDetachDomain,
	useSetPrimaryDomain,
	useTransferUnlockDomain,
	useVerifyDomain,
} from "../api/domains.mutations";
import { safeDomainErrorSummary } from "../lib/helpers";
import { useCopyToClipboard } from "../lib/hooks";
import { DnsRecordsTable } from "./dns-records-table";
import { DomainStatusChip } from "./domain-status-chip";

type DomainListProps = {
	projectId: string;
	domains: Domain[];
};

export function DomainList({ projectId, domains }: DomainListProps) {
	const { t } = useTranslation();

	if (domains.length === 0) {
		return (
			<Empty className="rounded-lg border">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<CircleDashed />
					</EmptyMedia>
					<EmptyTitle>{t("settings.domains.emptyTitle")}</EmptyTitle>
					<EmptyDescription>
						{t("settings.domains.emptyDescription")}
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>{t("settings.domains.domainColumn")}</TableHead>
					<TableHead>{t("settings.domains.primaryColumn")}</TableHead>
					<TableHead>{t("settings.domains.autoRenewColumn")}</TableHead>
					<TableHead>{t("settings.domains.expiryColumn")}</TableHead>
					<TableHead className="text-end">
						{t("settings.domains.actionsColumn")}
					</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{domains.map((domain) => (
					<DomainListRow
						key={domain.id}
						projectId={projectId}
						domain={domain}
					/>
				))}
			</TableBody>
		</Table>
	);
}

function DomainListRow({
	projectId,
	domain,
}: {
	projectId: string;
	domain: Domain;
}) {
	const { t, locale } = useTranslation();
	const verify = useVerifyDomain(projectId);
	const setPrimary = useSetPrimaryDomain(projectId);
	const transferUnlock = useTransferUnlockDomain();
	const detach = useDetachDomain(projectId);
	const copy = useCopyToClipboard(t("settings.domains.copySuccess"));
	const [detachOpen, setDetachOpen] = useState(false);
	const [transferResult, setTransferResult] = useState<{
		authCode: string;
		lockedUntil?: string;
	} | null>(null);
	const [transferError, setTransferError] = useState<string | null>(null);
	const [externalRecordsOpen, setExternalRecordsOpen] = useState(false);
	const [externalRecords, setExternalRecords] = useState(
		domain.dns?.records ?? [],
	);
	const [externalVerifyError, setExternalVerifyError] = useState<string | null>(
		null,
	);

	const expiresAt = domain.expiresAt
		? formatDate(domain.expiresAt, locale, { dateStyle: "medium" })
		: t("settings.domains.noExpiry");
	const failedSummary = safeDomainErrorSummary(domain.error);
	const isTransitioning =
		domain.status === "registering" || domain.status === "configuring";
	const canTransfer =
		domain.source === "purchased" &&
		!isTransitioning &&
		domain.status !== "failed" &&
		domain.status !== "transferred_out";
	const canSetPrimary = domain.status === "active" && !domain.isPrimary;
	const canVerifyExternal =
		domain.source === "external" &&
		domain.status !== "active" &&
		domain.status !== "failed";

	const handlePrimary = () => {
		if (!canSetPrimary) return;
		setPrimary.mutate(domain.id, {
			onSuccess: () => toast.success(t("settings.domains.primarySuccess")),
			onError: (error) => toast.error(getApiErrorMessage(error)),
		});
	};

	const handleTransferUnlock = () => {
		setTransferError(null);
		transferUnlock.mutate(domain.id, {
			onSuccess: (result) => setTransferResult(result),
			onError: (error) => setTransferError(getApiErrorMessage(error)),
		});
	};

	const handleVerifyExternal = () => {
		if (!canVerifyExternal) return;
		setExternalVerifyError(null);
		setExternalRecordsOpen(true);
		verify.mutate(domain.id, {
			onSuccess: (result) => {
				if (result.requiredRecords) {
					setExternalRecords(result.requiredRecords);
				}

				if (result.domain.status === "active") {
					toast.success(t("settings.domains.verifySuccess"));
				}
			},
			onError: (error) => setExternalVerifyError(getApiErrorMessage(error)),
		});
	};

	const handleDetach = () => {
		detach.mutate(domain.id, {
			onSuccess: () => {
				setDetachOpen(false);
				toast.success(t("settings.domains.detachSuccess"));
			},
			onError: (error) => toast.error(getApiErrorMessage(error)),
		});
	};

	return (
		<Fragment>
			<TableRow>
				<TableCell>
					<div className="flex min-w-44 flex-col gap-1">
						<div className="flex flex-wrap items-center gap-2">
							<span dir="ltr" className="font-medium font-mono text-sm">
								{domain.name}
							</span>
							<DomainStatusChip status={domain.status} />
						</div>
						{domain.status === "failed" ? (
							<div className="flex flex-col gap-1 text-xs">
								<p className="text-destructive">
									{failedSummary
										? t("settings.domains.failedSummaryWithReason", {
												reason: failedSummary,
											})
										: t("settings.domains.failedSummary")}
								</p>
								<p className="text-muted-foreground">
									{t("settings.domains.refundedNote")}
								</p>
							</div>
						) : null}
					</div>
				</TableCell>
				<TableCell>
					<label className="inline-flex items-center gap-2 text-sm">
						<input
							type="radio"
							name={`primary-domain-${projectId}`}
							className="size-4 accent-primary"
							checked={domain.isPrimary}
							disabled={!canSetPrimary && !domain.isPrimary}
							onChange={handlePrimary}
							aria-label={t("settings.domains.makePrimary")}
						/>
						<span className="text-muted-foreground text-xs">
							{domain.isPrimary
								? t("settings.domains.primary")
								: t("settings.domains.notPrimary")}
						</span>
					</label>
				</TableCell>
				<TableCell>
					<div className="flex items-center gap-2">
						{/* Enabling is rejected server-side until paid renewals exist. */}
						<Switch
							size="sm"
							checked={domain.autoRenew}
							disabled
							aria-label={t("settings.domains.autoRenew")}
						/>
						<span className="text-muted-foreground text-xs">
							{t("settings.domains.autoRenewComingSoon")}
						</span>
					</div>
				</TableCell>
				<TableCell className="font-mono text-xs">{expiresAt}</TableCell>
				<TableCell>
					<div className="flex justify-end gap-1">
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							aria-label={t("settings.domains.transferOut")}
							disabled={!canTransfer || transferUnlock.isPending}
							onClick={handleTransferUnlock}
						>
							{transferUnlock.isPending ? (
								<Loader2 className="animate-spin" />
							) : (
								<KeyRound />
							)}
						</Button>
						{canVerifyExternal ? (
							<Button
								type="button"
								variant="ghost"
								size="icon-xs"
								aria-label={t("settings.domains.verify")}
								disabled={verify.isPending}
								onClick={handleVerifyExternal}
							>
								{verify.isPending ? (
									<Loader2 className="animate-spin" />
								) : (
									<Check />
								)}
							</Button>
						) : null}
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							aria-label={t("settings.domains.detach")}
							disabled={detach.isPending}
							onClick={() => setDetachOpen(true)}
						>
							<Trash2 />
						</Button>
					</div>
				</TableCell>
			</TableRow>
			{transferResult || transferError ? (
				<TableRow>
					<TableCell colSpan={5} className="bg-muted/30">
						<div className="flex flex-col gap-3 py-2">
							{transferError ? (
								<p className="text-destructive text-sm">{transferError}</p>
							) : null}
							{transferResult ? (
								<div className="flex flex-col gap-2">
									<div className="flex flex-wrap items-center gap-2">
										<span className="text-muted-foreground text-xs">
											{t("settings.domains.authCodeLabel")}
										</span>
										<code
											dir="ltr"
											className="rounded-md border bg-background px-2 py-1 font-mono text-xs"
										>
											{transferResult.authCode}
										</code>
										<Button
											type="button"
											variant="outline"
											size="xs"
											onClick={() => void copy(transferResult.authCode)}
										>
											<Copy />
											{t("settings.domains.copy")}
										</Button>
									</div>
									<p className="max-w-xl text-muted-foreground text-xs">
										{t("settings.domains.icannNote")}
									</p>
									{transferResult.lockedUntil ? (
										<p className="font-mono text-muted-foreground text-xs">
											{t("settings.domains.lockedUntil", {
												date: formatDate(transferResult.lockedUntil, locale, {
													dateStyle: "medium",
												}),
											})}
										</p>
									) : null}
								</div>
							) : null}
						</div>
					</TableCell>
				</TableRow>
			) : null}
			{externalRecordsOpen || externalVerifyError ? (
				<TableRow>
					<TableCell colSpan={5} className="bg-muted/30">
						<div className="flex flex-col gap-3 py-2">
							{externalVerifyError ? (
								<p className="text-destructive text-sm">
									{externalVerifyError}
								</p>
							) : null}
							{externalRecords.length > 0 ? (
								<DnsRecordsTable records={externalRecords} />
							) : null}
						</div>
					</TableCell>
				</TableRow>
			) : null}
			<AlertDialog open={detachOpen} onOpenChange={setDetachOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle className="font-display">
							{t("settings.domains.detachTitle")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("settings.domains.detachDescription", { name: domain.name })}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							{t("settings.domains.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={(event) => {
								event.preventDefault();
								handleDetach();
							}}
							className={cn(detach.isPending && "pointer-events-none")}
						>
							{detach.isPending ? <Loader2 className="animate-spin" /> : null}
							{t("settings.domains.detachConfirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Fragment>
	);
}
