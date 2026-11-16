// The controls above the file rows: the search box, the type filter, the sort, and the list or grid switch.
// FilesPage renders it and owns the state: the search text stays in the page, the rest sits in the URL.
import { ListIcon, SquaresFourIcon } from "@phosphor-icons/react";
import { FILE_CATEGORIES, type FileCategory } from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { MagnifyingGlassIcon } from "~/shared/ui/icons";
import { Input } from "~/shared/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { FILE_SORTS, FILE_VIEWS, type FileSort } from "../lib/files-search";

type FilesToolbarProps = {
	query: string;
	onQueryChange: (query: string) => void;
	/** The type filter, or undefined for every type. */
	category: FileCategory | undefined;
	onCategoryChange: (category: FileCategory | undefined) => void;
	sort: FileSort;
	onSortChange: (sort: FileSort) => void;
	view: (typeof FILE_VIEWS)[number];
	onViewChange: (view: (typeof FILE_VIEWS)[number]) => void;
};

/** One wrapping row. At 375 px the search takes the full width and the three controls share the next line. */
export function FilesToolbar({
	query,
	onQueryChange,
	category,
	onCategoryChange,
	sort,
	onSortChange,
	view,
	onViewChange,
}: FilesToolbarProps) {
	const { t } = useT();
	return (
		<div className="flex min-w-0 flex-wrap items-center gap-2">
			{/* From sm, the search shrinks to 12rem first, so the layout buttons stay on the row at 1024 px. */}
			<div className="relative w-full sm:w-auto sm:min-w-48 sm:max-w-xs sm:flex-1">
				<MagnifyingGlassIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					type="search"
					value={query}
					onChange={(event) => onQueryChange(event.target.value)}
					placeholder={t("files.searchPlaceholder")}
					aria-label={t("files.searchPlaceholder")}
					className="ps-8"
				/>
			</div>
			<Select
				value={category ?? "all"}
				onValueChange={(value) =>
					onCategoryChange(FILE_CATEGORIES.find((option) => option === value))
				}
			>
				<SelectTrigger
					className="w-auto min-w-32"
					aria-label={t("files.typeFilter")}
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">{t("files.allTypes")}</SelectItem>
					{FILE_CATEGORIES.map((option) => (
						<SelectItem key={option} value={option}>
							{t(`fileCategories.${option}`)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Select
				value={sort}
				onValueChange={(value) =>
					onSortChange(
						FILE_SORTS.find((option) => option === value) ?? "modified",
					)
				}
			>
				<SelectTrigger className="w-auto min-w-36" aria-label={t("files.sort")}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{FILE_SORTS.map((option) => (
						<SelectItem key={option} value={option}>
							{t(`files.sorts.${option}`)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<fieldset
				aria-label={t("files.layout")}
				className="ms-auto flex items-center gap-1"
			>
				{FILE_VIEWS.map((option) => {
					const OptionIcon = option === "list" ? ListIcon : SquaresFourIcon;
					return (
						<Button
							key={option}
							type="button"
							size="sm"
							variant={option === view ? "secondary" : "ghost"}
							className="max-sm:h-11"
							aria-pressed={option === view}
							onClick={() => onViewChange(option)}
						>
							<OptionIcon />
							{t(`files.views.${option}`)}
						</Button>
					);
				})}
			</fieldset>
		</div>
	);
}
