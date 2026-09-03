import { AlertTriangle } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import type {
	DnsRecordDiagnostic,
	RequiredDomainRecord,
} from "../api/domains.dto";
import { domainLiveUrl, splitExternalDomainRecords } from "../lib/helpers";
import { DnsRecordsTable } from "./dns-records-table";
import { ExternalDomainRoutingNote } from "./external-domain-routing-note";

type ExternalDomainSetupOptionsProps = {
	name: string;
	records: RequiredDomainRecord[];
	diagnostics?: DnsRecordDiagnostic[];
	isRefreshing?: boolean;
	onRefresh?: () => void;
};

// Rows whose zone exists carry NS records: the user picks between delegating
// the nameservers (bare domain works) and adding the www records only. Rows
// without NS records render exactly the pre-zone UI.
export function ExternalDomainSetupOptions({
	name,
	records,
	diagnostics,
	isRefreshing = false,
	onRefresh,
}: ExternalDomainSetupOptionsProps) {
	const { t } = useTranslation();
	const { manualRecords, nameserverRecords } =
		splitExternalDomainRecords(records);
	const hasNameserverOption = nameserverRecords.length > 0;

	if (!hasNameserverOption) {
		return (
			<>
				<div className="space-y-1">
					<h4 className="font-medium text-sm">
						{t("settings.domains.externalOwnershipStepTitle")}
					</h4>
					<p className="text-muted-foreground text-xs">
						{t("settings.domains.externalOwnershipStepDescription")}
					</p>
					<p className="text-muted-foreground text-xs">
						{t("settings.domains.externalNameserverUnlockHint")}
					</p>
				</div>
				<ExternalDomainRoutingNote name={name} />
				<DnsRecordsTable
					records={records}
					diagnostics={diagnostics}
					isRefreshing={isRefreshing}
					onRefresh={onRefresh}
				/>
			</>
		);
	}

	const www = `www.${name}`;
	const target = domainLiveUrl({ name, source: "external" });
	// Both tables share one status column and one Refresh button (first table).
	const showStatus = diagnostics !== undefined || onRefresh !== undefined;

	return (
		<>
			<ExternalDomainRoutingNote name={name} hasNameserverOption />
			<section className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-3">
				<div className="space-y-1">
					<h4 className="font-medium text-sm">
						{t("settings.domains.externalOptionNsTitle")}
					</h4>
					<p className="text-muted-foreground text-xs">
						{t("settings.domains.externalOptionNsDescription", {
							domain: name,
							www,
						})}
					</p>
					<p className="text-muted-foreground text-xs">
						{t("settings.domains.externalOptionNsMail")}
					</p>
					<p className="text-muted-foreground text-xs">
						{t("settings.domains.externalOptionNsDnssec")}
					</p>
				</div>
				<div className="flex gap-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-3">
					<AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
					<div className="min-w-0 flex-1">
						<p className="font-medium text-amber-900 text-sm dark:text-amber-100">
							{t("settings.domains.externalOwnershipWarningTitle")}
						</p>
						<p className="mt-0.5 text-amber-800/80 text-xs dark:text-amber-200/80">
							{t("settings.domains.externalOwnershipWarningDescription")}
						</p>
						<p className="mt-1 text-amber-800/80 text-xs dark:text-amber-200/80">
							{t("settings.domains.externalNameserverChangeWarning")}
						</p>
					</div>
				</div>
				<DnsRecordsTable
					records={nameserverRecords}
					diagnostics={diagnostics}
					isRefreshing={isRefreshing}
					onRefresh={onRefresh}
					showStatus={showStatus}
				/>
			</section>
			<section className="flex flex-col gap-3 rounded-lg border px-3 py-3">
				<div className="space-y-1">
					<h4 className="font-medium text-sm">
						{t("settings.domains.externalOptionRecordsTitle")}
					</h4>
					<p className="text-muted-foreground text-xs">
						{t("settings.domains.externalOptionRecordsDescription", {
							domain: name,
							target,
							www,
						})}
					</p>
				</div>
				<DnsRecordsTable
					records={manualRecords}
					diagnostics={diagnostics}
					isRefreshing={isRefreshing}
					showStatus={showStatus}
				/>
			</section>
		</>
	);
}
