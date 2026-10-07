/**
 * The pager row at the bottom of a portal table card: "Page 2 of 5" and
 * the previous and next pill buttons. The referrals, commissions, and
 * payouts tables render it. The page owns the page number.
 */
import { CaretLeftIcon } from "@phosphor-icons/react/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/CaretRight";
import { formatNumber } from "@wandit/internationalization";
import { Button } from "@wandit/ui/components/button";

import { useTranslation } from "@/lib/i18n";

type PortalPaginationProps = {
	disabled?: boolean;
	onPageChange: (page: number) => void;
	page: number;
	pageSize: number;
	total: number;
};

/** Previous and next buttons for a 1-based page. It shows nothing when the list is empty on page 1. */
export function PortalPagination({
	disabled = false,
	onPageChange,
	page,
	pageSize,
	total,
}: PortalPaginationProps) {
	const { locale, t } = useTranslation();
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const visiblePage = Math.min(page, totalPages);

	if (total === 0 && page === 1) {
		return null;
	}

	return (
		<div className="flex flex-wrap items-center justify-between gap-3 border-night/[0.06] border-t px-4 py-3 sm:px-6 dark:border-white/[0.06]">
			<p className="text-night/60 text-xs tabular-nums dark:text-foreground/60">
				{t("affiliates.pagination.pageOf", {
					page: formatNumber(visiblePage, locale),
					total: formatNumber(totalPages, locale),
				})}
			</p>
			<div className="flex items-center gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="rounded-full font-grotesk"
					disabled={disabled || visiblePage <= 1}
					onClick={() => onPageChange(Math.max(1, visiblePage - 1))}
				>
					<CaretLeftIcon
						aria-hidden
						weight="bold"
						className="size-3.5 rtl:-scale-x-100"
					/>
					{t("affiliates.pagination.previous")}
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="rounded-full font-grotesk"
					disabled={disabled || visiblePage >= totalPages}
					onClick={() => onPageChange(Math.min(totalPages, visiblePage + 1))}
				>
					{t("affiliates.pagination.next")}
					<CaretRightIcon
						aria-hidden
						weight="bold"
						className="size-3.5 rtl:-scale-x-100"
					/>
				</Button>
			</div>
		</div>
	);
}
