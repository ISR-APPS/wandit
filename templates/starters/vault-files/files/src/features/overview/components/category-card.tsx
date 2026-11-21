// One type card of the home band: the file count of a type, its share of the live storage as a bar, and a link to its files.
// OverviewPage renders four of them, one per file category, from overviewQueryOptions.
// The footer link opens /app/files with the type filter of the card.
import {
	ArrowRightIcon,
	FileIcon,
	FileTextIcon,
	ImageIcon,
	VideoCameraIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { type FileCategory, formatBytes } from "~/features/workspace";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardAction,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import { Progress } from "~/shared/ui/progress";
import type { CategoryUsage } from "../lib/series";

// The icon and the colors of each type. The chart token matches the file tiles of the tables.
// chart-3 is too light for a line icon, so the video icon uses primary, the same hue.
const CATEGORY_LOOK = {
	documents: {
		icon: FileTextIcon,
		iconClass: "text-chart-1",
		barClass: "[&>[data-slot=progress-indicator]]:bg-chart-1",
	},
	images: {
		icon: ImageIcon,
		iconClass: "text-chart-2",
		barClass: "[&>[data-slot=progress-indicator]]:bg-chart-2",
	},
	video: {
		icon: VideoCameraIcon,
		iconClass: "text-primary",
		barClass: "[&>[data-slot=progress-indicator]]:bg-chart-3",
	},
	other: {
		icon: FileIcon,
		iconClass: "text-chart-4",
		barClass: "[&>[data-slot=progress-indicator]]:bg-chart-4",
	},
} satisfies Record<
	FileCategory,
	{ icon: KitIcon; iconClass: string; barClass: string }
>;

type CategoryCardProps = {
	usage: CategoryUsage;
	/** Bytes of all live files. The bar shows the share of the type in it. */
	liveBytes: number;
};

/** The count is the big number. The bar and the line under it give the bytes and the share. */
export function CategoryCard({ usage, liveBytes }: CategoryCardProps) {
	const { t, locale } = useT();
	const look = CATEGORY_LOOK[usage.category];
	const share = liveBytes > 0 ? usage.bytes / liveBytes : 0;
	const label = t(`fileCategories.${usage.category}`);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
	});

	return (
		<Card className="pb-0">
			<CardHeader>
				<CardTitle>{label}</CardTitle>
				<CardAction>
					<look.icon className={`size-6 ${look.iconClass}`} />
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-4">
				<p className="font-numeric @4xl/main:text-3xl text-2xl tabular-nums">
					{new Intl.NumberFormat(locale).format(usage.fileCount)}
				</p>
				<div className="grid gap-2">
					<Progress
						value={share * 100}
						className={look.barClass}
						aria-label={t("overview.shareOfStorage")
							.replace("{type}", label)
							.replace("{share}", percent.format(share))}
					/>
					<div className="flex items-center justify-between gap-2 text-muted-foreground text-sm">
						<span>
							{t("overview.bytesUsed").replace(
								"{size}",
								formatBytes(usage.bytes, locale),
							)}
						</span>
						<span className="tabular-nums">{percent.format(share)}</span>
					</div>
				</div>
			</CardContent>
			<CardFooter className="justify-end border-t p-0">
				<Link
					to="/app/files"
					search={{ type: usage.category }}
					className="flex items-center gap-1 px-6 py-3 font-medium text-sm hover:text-primary"
				>
					{t("overview.viewMore")}
					<span className="sr-only">{label}</span>
					<ArrowRightIcon className="size-4 rtl:rotate-180" />
				</Link>
			</CardFooter>
		</Card>
	);
}
