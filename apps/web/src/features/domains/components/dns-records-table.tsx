import { Button } from "@wandit/ui/components/button";
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
	AlertTriangle,
	CheckCircle2,
	CircleHelp,
	Copy,
	Loader2,
	RefreshCw,
	XCircle,
} from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import type {
	DnsRecordDiagnostic,
	DnsRecordDiagnosticStatus,
	RequiredDomainRecord,
} from "../api/domains.dto";
import { dnsPurposeKey } from "../lib/helpers";
import { useCopyToClipboard } from "../lib/hooks";

type DnsRecordsTableProps = {
	records: RequiredDomainRecord[];
	diagnostics?: DnsRecordDiagnostic[];
	isRefreshing?: boolean;
	onRefresh?: () => void;
	// Forces the status column on (or off) for a table that shares its
	// diagnostics and Refresh button with a sibling table.
	showStatus?: boolean;
};

export function DnsRecordsTable({
	records,
	diagnostics,
	isRefreshing = false,
	onRefresh,
	showStatus: forcedShowStatus,
}: DnsRecordsTableProps) {
	const { t } = useTranslation();
	const copy = useCopyToClipboard(t("settings.domains.copySuccess"));
	const showStatus =
		forcedShowStatus ?? (diagnostics !== undefined || onRefresh !== undefined);
	const diagnosticFor = indexDiagnostics(diagnostics);

	return (
		<div className="flex flex-col gap-2">
			{onRefresh ? (
				<div className="flex items-center justify-between gap-3">
					<p className="text-muted-foreground text-xs">
						{t("settings.domains.dnsStatusHint")}
					</p>
					<Button
						type="button"
						variant="outline"
						size="xs"
						disabled={isRefreshing}
						onClick={onRefresh}
					>
						{isRefreshing ? (
							<Loader2 className="animate-spin" />
						) : (
							<RefreshCw />
						)}
						{t("settings.domains.refreshDns")}
					</Button>
				</div>
			) : null}

			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>{t("settings.domains.dnsType")}</TableHead>
						<TableHead>{t("settings.domains.dnsName")}</TableHead>
						<TableHead>{t("settings.domains.dnsValue")}</TableHead>
						{showStatus ? (
							<TableHead>{t("settings.domains.dnsStatus")}</TableHead>
						) : null}
					</TableRow>
				</TableHeader>
				<TableBody>
					{records.map((record) => (
						<TableRow key={recordKey(record)}>
							<TableCell className="font-mono text-xs">{record.type}</TableCell>
							<TableCell dir="ltr" className="font-mono text-xs">
								{record.name}
							</TableCell>
							<TableCell>
								<div className="flex min-w-72 items-start gap-2">
									<div className="min-w-0 flex-1">
										<p
											dir="ltr"
											className="break-all font-mono text-foreground text-xs"
										>
											{record.value}
										</p>
										<p className="mt-1 text-muted-foreground text-xs">
											{t(dnsPurposeKey(record))}
										</p>
									</div>
									<Button
										type="button"
										variant="ghost"
										size="icon-xs"
										aria-label={t("settings.domains.copyDnsValue")}
										onClick={() => void copy(record.value)}
									>
										<Copy />
									</Button>
								</div>
							</TableCell>
							{showStatus ? (
								<TableCell>
									<RecordStatus
										diagnostic={diagnosticFor(record)}
										isRefreshing={isRefreshing}
									/>
								</TableCell>
							) : null}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

function recordKey(record: RequiredDomainRecord) {
	return `${diagnosticKey(record)}:${record.value}`;
}

function diagnosticKey(record: RequiredDomainRecord) {
	return `${record.type}:${record.name}`;
}

// A diagnostic belongs to the record with the same type, name AND value: the
// two nameserver rows share `NS:@`, each with its own status. The type:name
// fallback only serves a record whose expected value rotated (a fresh
// validation token) and is skipped when several diagnostics share that name.
function indexDiagnostics(diagnostics: DnsRecordDiagnostic[] | undefined) {
	const byRecord = new Map<string, DnsRecordDiagnostic>();
	const byName = new Map<string, DnsRecordDiagnostic>();
	const ambiguousNames = new Set<string>();

	for (const diagnostic of diagnostics ?? []) {
		byRecord.set(recordKey(diagnostic), diagnostic);
		const nameKey = diagnosticKey(diagnostic);

		if (byName.has(nameKey)) {
			ambiguousNames.add(nameKey);
		} else {
			byName.set(nameKey, diagnostic);
		}
	}

	return (record: RequiredDomainRecord) => {
		const exact = byRecord.get(recordKey(record));

		if (exact) {
			return exact;
		}

		const nameKey = diagnosticKey(record);

		return ambiguousNames.has(nameKey) ? undefined : byName.get(nameKey);
	};
}

function RecordStatus({
	diagnostic,
	isRefreshing,
}: {
	diagnostic?: DnsRecordDiagnostic;
	isRefreshing: boolean;
}) {
	const { t } = useTranslation();

	if (!diagnostic) {
		const StatusIcon = isRefreshing ? Loader2 : CircleHelp;

		return (
			<span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
				<StatusIcon
					className={cn("size-3.5", isRefreshing && "animate-spin")}
				/>
				{t(
					isRefreshing
						? "settings.domains.dnsChecking"
						: "settings.domains.dnsUnknown",
				)}
			</span>
		);
	}

	const config: Record<
		DnsRecordDiagnosticStatus,
		{ className: string; icon: typeof CheckCircle2; label: string }
	> = {
		found: {
			className: "text-success",
			icon: CheckCircle2,
			label: t("settings.domains.dnsFound"),
		},
		missing: {
			className: "text-amber-700 dark:text-amber-300",
			icon: XCircle,
			label: t("settings.domains.dnsMissing"),
		},
		mismatch: {
			className: "text-destructive",
			icon: AlertTriangle,
			label: t("settings.domains.dnsMismatch"),
		},
		unknown: {
			className: "text-muted-foreground",
			icon: CircleHelp,
			label: t("settings.domains.dnsUnknown"),
		},
	};
	const status = config[diagnostic.status];
	const StatusIcon = status.icon;

	return (
		<div className="min-w-32 text-xs">
			<span
				className={cn("inline-flex items-center gap-1.5", status.className)}
			>
				<StatusIcon className="size-3.5" />
				{status.label}
			</span>
			{diagnostic.status === "mismatch" &&
			diagnostic.observedValues.length > 0 ? (
				<p className="mt-1 break-all text-[11px] text-muted-foreground">
					{t("settings.domains.dnsObserved")}{" "}
					<bdi dir="ltr" className="font-mono">
						{diagnostic.observedValues.join(", ")}
					</bdi>
				</p>
			) : null}
		</div>
	);
}
