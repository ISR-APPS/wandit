import { Button } from "@wandit/ui/components/button";
import { Input } from "@wandit/ui/components/input";
import { Label } from "@wandit/ui/components/label";
import { Separator } from "@wandit/ui/components/separator";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import type { RequiredDomainRecord } from "../api/domains.dto";
import {
	useAttachExternalDomain,
	useVerifyDomain,
} from "../api/domains.mutations";
import { useDomainsQuery } from "../api/domains.queries";
import { externalDomainLiveUrl, normalizeDomainInput } from "../lib/helpers";
import { useCopyToClipboard } from "../lib/hooks";
import { externalDomainFormSchema } from "../lib/schemas";
import type { ExternalDomainStep } from "../lib/store";
import { DnsRecordsTable } from "./dns-records-table";
import { DomainStatusChip } from "./domain-status-chip";

type ConnectExternalDomainProps = {
	projectId: string;
};

export function ConnectExternalDomain({
	projectId,
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

	const domains = useDomainsQuery(projectId, {
		enabled: step === "records" || step === "checking" || step === "success",
		pollWhileChecking: step === "checking",
	});
	const currentDomain = useMemo(
		() => (domains.data ?? []).find((domain) => domain.id === domainId) ?? null,
		[domainId, domains.data],
	);
	const liveUrl = currentDomain
		? externalDomainLiveUrl(currentDomain.name)
		: "";

	useEffect(() => {
		if (currentDomain?.status === "active") {
			setStep("success");
		}
	}, [currentDomain?.status]);

	const connect = async () => {
		const name = normalizeDomainInput(domainInput);
		const parsed = externalDomainFormSchema.safeParse({ name });

		if (!parsed.success) {
			setError(t("settings.domains.externalInvalid"));
			return;
		}

		setError(null);

		try {
			const response = await attach.mutateAsync(parsed.data);
			setDomainId(response.domain.id);
			setRecords(response.requiredRecords);
			setStep(response.domain.status === "active" ? "success" : "records");
			toast.success(t("settings.domains.externalConnected"));
		} catch (attachError) {
			setError(getApiErrorMessage(attachError));
		}
	};

	const runVerify = async () => {
		if (!domainId) {
			return;
		}

		setError(null);
		setStep("checking");

		try {
			const response = await verify.mutateAsync(domainId);

			if (response.requiredRecords) {
				setRecords(response.requiredRecords);
			}

			if (response.domain.status === "active") {
				setStep("success");
				toast.success(t("settings.domains.verifySuccess"));
			}
		} catch (verifyError) {
			setStep("records");
			setError(getApiErrorMessage(verifyError));
		}
	};

	const reset = () => {
		setStep("input");
		setDomainInput("");
		setDomainId(null);
		setRecords([]);
		setError(null);
	};

	return (
		<div className="flex flex-col gap-4 rounded-lg border bg-muted/20 px-4 py-4">
			<div>
				<h3 className="font-medium text-sm">
					{t("settings.domains.externalTitle")}
				</h3>
				<p className="mt-1 text-muted-foreground text-xs">
					{t("settings.domains.externalDescription")}
				</p>
			</div>

			{step === "input" ? (
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end">
					<div className="min-w-0 flex-1">
						<Label htmlFor="external-domain">
							{t("settings.domains.externalLabel")}
						</Label>
						<Input
							id="external-domain"
							className="mt-2 font-mono"
							dir="ltr"
							value={domainInput}
							placeholder={t("settings.domains.externalPlaceholder")}
							onChange={(event) => setDomainInput(event.target.value)}
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
			) : null}

			{currentDomain ? (
				<div className="flex flex-wrap items-center gap-2 text-sm">
					<span dir="ltr" className="font-medium font-mono">
						{currentDomain.name}
					</span>
					<DomainStatusChip status={currentDomain.status} />
				</div>
			) : null}

			{step === "records" || step === "checking" ? (
				<div className="flex flex-col gap-4">
					<Separator />
					<DnsRecordsTable records={records} />
					<div className="flex flex-wrap items-center gap-2">
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
						<Button type="button" variant="ghost" onClick={reset}>
							{t("settings.domains.useAnotherDomain")}
						</Button>
					</div>
					{step === "checking" ? (
						<p className="text-muted-foreground text-xs">
							{t("settings.domains.verifyPolling")}
						</p>
					) : null}
				</div>
			) : null}

			{step === "success" && currentDomain ? (
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
							onClick={() => void copy(liveUrl)}
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
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="self-start"
						onClick={reset}
					>
						{t("settings.domains.useAnotherDomain")}
					</Button>
				</div>
			) : null}

			{error ? <p className="text-destructive text-sm">{error}</p> : null}
		</div>
	);
}
