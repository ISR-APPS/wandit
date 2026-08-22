import { formatNumber } from "@wandit/internationalization";
import { Button } from "@wandit/ui/components/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useTranslation } from "@/lib/i18n";

type PortalPaginationProps = {
	disabled?: boolean;
	onPageChange: (page: number) => void;
	page: number;
	pageSize: number;
	total: number;
};

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
		<div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
			<p className="text-muted-foreground text-xs">
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
					disabled={disabled || visiblePage <= 1}
					onClick={() => onPageChange(Math.max(1, visiblePage - 1))}
				>
					<ChevronLeft
						data-icon="inline-start"
						className="rtl:rotate-180"
						aria-hidden
					/>
					{t("affiliates.pagination.previous")}
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={disabled || visiblePage >= totalPages}
					onClick={() => onPageChange(Math.min(totalPages, visiblePage + 1))}
				>
					{t("affiliates.pagination.next")}
					<ChevronRight
						data-icon="inline-end"
						className="rtl:rotate-180"
						aria-hidden
					/>
				</Button>
			</div>
		</div>
	);
}
