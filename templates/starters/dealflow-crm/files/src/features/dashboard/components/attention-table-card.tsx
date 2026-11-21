// The table card of the home: the open deals that are stalled or past their expected close date.
// DashboardPage renders it under the middle grid and passes the rows. The /app loader fills the deal list.
// It follows the full-width table card of the kit system, with owner and stage filters.
import { useState } from "react";
import { fillMessage, OPEN_STAGES } from "~/features/crm";
import { type Deal, DealTable } from "~/features/deals";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { RecordFilter } from "~/shared/ui/record-table";

// Eight rows keep the card near one screen high. The pages show the rest.
const ATTENTION_PAGE_SIZE = 8;

type AttentionTableCardProps = {
	/** The open deals that need attention, the longest in their stage first. */
	deals: Deal[];
};

/** The owner and stage filters cut the rows; then the deal table filters, sorts, and pages them. */
export function AttentionTableCard({ deals }: AttentionTableCardProps) {
	const { t, locale } = useT();
	const [owner, setOwner] = useState<string | null>(null);
	const [stage, setStage] = useState<string | null>(null);
	const owners = [...new Set(deals.map((deal) => deal.ownerName))].sort(
		(first, second) => first.localeCompare(second, locale),
	);
	const rows = deals.filter(
		(deal) =>
			(owner === null || deal.ownerName === owner) &&
			(stage === null || deal.stage === stage),
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("dashboard.attentionTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("dashboard.attentionDescription"), {
						count: new Intl.NumberFormat(locale).format(deals.length),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<DealTable
					deals={rows}
					variant="attention"
					pageSize={ATTENTION_PAGE_SIZE}
					searchable
					noResults={t("dashboard.noAttention")}
					toolbar={
						<>
							<RecordFilter
								label={t("deals.owner")}
								options={owners.map((name) => ({ value: name, label: name }))}
								value={owner}
								onValueChange={setOwner}
							/>
							<RecordFilter
								label={t("deals.stage")}
								options={OPEN_STAGES.map((value) => ({
									value,
									label: t(`stages.${value}`),
								}))}
								value={stage}
								onValueChange={setStage}
							/>
						</>
					}
				/>
			</CardContent>
		</Card>
	);
}
