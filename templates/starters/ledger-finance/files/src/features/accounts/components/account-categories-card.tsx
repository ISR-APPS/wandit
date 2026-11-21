// The third card of the account page, in the kit tag card form: the largest expense categories as outline badges.
// AccountDetailPage renders it under the usage card. Each badge opens the transactions of that category.
import { Link } from "@tanstack/react-router";
import { centsToUnits, compactMoneyFormat } from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { CategorySpend } from "../lib/account-summary";

type AccountCategoriesCardProps = {
	/** The largest expense categories of the account in the last 30 days, the largest first. */
	categories: CategorySpend[];
};

/** No expense in 30 days: one muted sentence. */
export function AccountCategoriesCard({
	categories,
}: AccountCategoriesCardProps) {
	const { t, locale } = useT();
	const compact = compactMoneyFormat(locale);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("accounts.topCategories")}</CardTitle>
				{categories.length === 0 ? (
					<CardDescription>{t("accounts.noExpenses")}</CardDescription>
				) : null}
			</CardHeader>
			{categories.length === 0 ? null : (
				<CardContent className="flex flex-wrap gap-2">
					{categories.map((category) => (
						<Badge key={category.categoryId} asChild variant="outline">
							<Link
								to="/app/transactions"
								search={{ type: "expense", category: category.categoryId }}
							>
								{`${t(`categories.${category.categoryId}`)} · ${compact.format(centsToUnits(category.spentCents))}`}
							</Link>
						</Badge>
					))}
				</CardContent>
			)}
		</Card>
	);
}
