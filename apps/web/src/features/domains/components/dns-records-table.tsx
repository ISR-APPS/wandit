import { Button } from "@wandit/ui/components/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@wandit/ui/components/table";
import { Copy } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import type { RequiredDomainRecord } from "../api/domains.dto";
import { dnsPurposeKey } from "../lib/helpers";
import { useCopyToClipboard } from "../lib/hooks";

type DnsRecordsTableProps = {
	records: RequiredDomainRecord[];
};

export function DnsRecordsTable({ records }: DnsRecordsTableProps) {
	const { t } = useTranslation();
	const copy = useCopyToClipboard(t("settings.domains.copySuccess"));

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>{t("settings.domains.dnsType")}</TableHead>
					<TableHead>{t("settings.domains.dnsName")}</TableHead>
					<TableHead>{t("settings.domains.dnsValue")}</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{records.map((record) => (
					<TableRow key={`${record.type}:${record.name}:${record.value}`}>
						<TableCell className="font-mono text-xs">{record.type}</TableCell>
						<TableCell dir="ltr" className="font-mono text-xs">
							{record.name}
						</TableCell>
						<TableCell>
							<div className="flex min-w-72 items-start gap-2">
								<div className="min-w-0 flex-1">
									<p
										dir="ltr"
										className="break-all font-mono text-xs text-foreground"
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
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
