import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatWholeNumber } from "@/features/users/lib/formatters";

type DetailPaginationProps = {
	page: number;
	pageSize: number;
	total: number;
	onPageChange: (page: number) => void;
};

export function DetailPagination({
	page,
	pageSize,
	total,
	onPageChange,
}: DetailPaginationProps) {
	if (total <= pageSize) {
		return null;
	}

	const pageCount = Math.max(1, Math.ceil(total / pageSize));
	const from = (page - 1) * pageSize + 1;
	const to = Math.min(page * pageSize, total);

	return (
		<div className="flex flex-col gap-2 border-t px-0 pt-3 text-muted-foreground text-xs sm:flex-row sm:items-center sm:justify-between">
			<span>
				{formatWholeNumber(from)}–{formatWholeNumber(to)} of{" "}
				{formatWholeNumber(total)}
			</span>
			<div className="flex items-center gap-2">
				<span>
					Page {formatWholeNumber(page)} of {formatWholeNumber(pageCount)}
				</span>
				<Button
					type="button"
					variant="outline"
					size="icon-sm"
					disabled={page <= 1}
					onClick={() => onPageChange(page - 1)}
				>
					<ChevronLeftIcon aria-hidden="true" />
					<span className="sr-only">Previous page</span>
				</Button>
				<Button
					type="button"
					variant="outline"
					size="icon-sm"
					disabled={page >= pageCount}
					onClick={() => onPageChange(page + 1)}
				>
					<ChevronRightIcon aria-hidden="true" />
					<span className="sr-only">Next page</span>
				</Button>
			</div>
		</div>
	);
}
