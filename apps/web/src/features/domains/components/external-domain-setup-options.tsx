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
