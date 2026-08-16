import { Button } from "@wandit/ui/components/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@wandit/ui/components/empty";
import { cn } from "@wandit/ui/lib/utils";
import { AlertTriangle, GraduationCap, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { DashboardShell } from "@/features/projects/components/shell/dashboard-shell";
import { useTranslation } from "@/lib/i18n";
import { useAcademyGuidesQuery } from "../api/academy.queries";
import { GuideCard, GuideCardSkeleton } from "../components/guide-card";
import {
	academyCategoryLabel,
	deriveCategories,
	filterGuidesByCategory,
} from "../lib/academy-helpers";

const SKELETON_KEYS = ["a", "b", "c", "d", "e", "f", "g", "h"];

export default function AcademyPage() {
	const { t } = useTranslation();
	const guidesQuery = useAcademyGuidesQuery();
	const [category, setCategory] = useState<string | null>(null);
	const guides = guidesQuery.data ?? [];
	const categories = useMemo(() => deriveCategories(guides), [guides]);
	const filteredGuides = useMemo(
		() => filterGuidesByCategory(guides, category),
		[guides, category],
	);

	return (
		<DashboardShell titleKey="academy.title">
			<div className="mx-auto w-full max-w-6xl px-4 pb-16 md:px-6">
				<div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-start">
					<p className="max-w-2xl text-muted-foreground text-sm leading-relaxed">
						{t("academy.intro")}
					</p>
					{guidesQuery.data ? (
						<span className="shrink-0 font-mono text-muted-foreground text-xs sm:ms-auto sm:pt-0.5">
							{t("academy.guideCount", { count: guides.length })}
						</span>
					) : null}
				</div>

				{categories.length > 0 ? (
					<div className="-mx-4 mt-5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
						<div className="flex min-w-max items-center gap-2">
							<CategoryChip
								active={category === null}
								label={t("academy.filters.all")}
								onClick={() => setCategory(null)}
							/>
							{categories.map((item) => (
								<CategoryChip
									key={item}
									active={category === item}
									label={academyCategoryLabel(item, t)}
									onClick={() => setCategory(item)}
								/>
							))}
						</div>
					</div>
				) : null}

				<div className="mt-6">
					{guidesQuery.isPending ? (
						<GuideGrid>
							{SKELETON_KEYS.map((key) => (
								<GuideCardSkeleton key={key} />
							))}
						</GuideGrid>
					) : guidesQuery.isError ? (
						<AcademyError
							retrying={guidesQuery.isFetching}
							onRetry={() => void guidesQuery.refetch()}
						/>
					) : guides.length === 0 ? (
						<Empty className="rounded-xl border border-dashed">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<GraduationCap aria-hidden />
								</EmptyMedia>
								<EmptyTitle>{t("academy.empty.title")}</EmptyTitle>
								<EmptyDescription>{t("academy.empty.body")}</EmptyDescription>
							</EmptyHeader>
						</Empty>
					) : filteredGuides.length === 0 ? (
						<div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center">
							<p className="text-muted-foreground text-sm">
								{t("academy.filters.noneInCategory")}
							</p>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="mt-2"
								onClick={() => setCategory(null)}
							>
								{t("academy.filters.showAll")}
							</Button>
						</div>
					) : (
						<GuideGrid>
							{filteredGuides.map((guide) => (
								<GuideCard key={guide.id} guide={guide} />
							))}
						</GuideGrid>
					)}
				</div>
			</div>
		</DashboardShell>
	);
}

function GuideGrid({ children }: { children: React.ReactNode }) {
	return (
		<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
			{children}
		</div>
	);
}

function CategoryChip({
	active,
	label,
	onClick,
}: {
	active: boolean;
	label: string;
	onClick: () => void;
}) {
	return (
		<Button
			type="button"
			variant={active ? "secondary" : "outline"}
			size="sm"
			aria-pressed={active}
			className={cn(
				"h-8 transition-colors duration-150",
				active &&
					"border border-primary/20 bg-primary/10 text-primary hover:bg-primary/15",
			)}
			onClick={onClick}
		>
			<span dir="auto">{label}</span>
		</Button>
	);
}

function AcademyError({
	onRetry,
	retrying,
}: {
	onRetry: () => void;
	retrying: boolean;
}) {
	const { t } = useTranslation();

	return (
		<div className="flex flex-col items-center justify-center rounded-xl border border-destructive/25 bg-destructive/[0.035] px-6 py-12 text-center">
			<span className="grid size-9 place-items-center rounded-full bg-destructive/10 text-destructive">
				<AlertTriangle className="size-4" aria-hidden />
			</span>
			<p className="mt-3 font-medium text-sm">{t("academy.error.title")}</p>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="mt-2"
				disabled={retrying}
				onClick={onRetry}
			>
				<RefreshCw
					aria-hidden
					className={cn("size-3.5", retrying && "animate-spin")}
				/>
				{t("academy.error.retry")}
			</Button>
		</div>
	);
}
