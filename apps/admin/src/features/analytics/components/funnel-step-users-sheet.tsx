import { Link } from "@tanstack/react-router";
import {
	DownloadIcon,
	Loader2Icon,
	RefreshCwIcon,
	UsersIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaginationControls } from "@/features/affiliates/components/affiliate-ui";
import type {
	AnalyticsFunnelStepUser,
	AnalyticsFunnelStepUsersResponse,
	AnalyticsFunnelUserStep,
	AnalyticsQuery,
} from "@/features/analytics/api/analytics.dto";
import { useSetFunnelContactMutation } from "@/features/analytics/api/analytics.mutations";
import { useAdminAnalyticsFunnelStepUsersQuery } from "@/features/analytics/api/analytics.queries";
import { downloadFunnelStepUsersCsv } from "@/features/analytics/api/analytics.services";
import { funnelStepMetadata } from "@/features/analytics/lib/analytics-data";
import { useAdminPermission } from "@/features/auth/lib/permissions";
import { formatOverviewWholeNumber } from "@/features/overview/lib/formatters";
import { getInitials } from "@/features/users/components/table/users-table-utils";
import {
	formatAdminDate,
	formatAdminDateTime,
} from "@/features/users/lib/formatters";
import { isApiClientError } from "@/lib/api-client";

type FunnelStepUsersFilter = "all" | "contacted" | "notContacted";

type FunnelStepUsersSheetProps = {
	open: boolean;
	step: AnalyticsFunnelUserStep | null;
	query: AnalyticsQuery;
	onOpenChange: (open: boolean) => void;
};

type FunnelStepUsersSheetContentProps = Omit<
	FunnelStepUsersSheetProps,
	"step"
> & {
	step: AnalyticsFunnelUserStep;
};

type FunnelStepUsersSheetBodyProps = {
	data: AnalyticsFunnelStepUsersResponse;
	filter: FunnelStepUsersFilter;
	pendingUserId: string | null;
	onFilterChange: (filter: FunnelStepUsersFilter) => void;
	onPageChange: (page: number) => void;
	onContactChange: (user: AnalyticsFunnelStepUser, contacted: boolean) => void;
	canManageContact?: boolean;
};

const PAGE_SIZE = 10;
const fallbackStep: AnalyticsFunnelUserStep = "pricingViewed";
const loadingRows = ["one", "two", "three", "four"] as const;

function FunnelStepUsersSheet(props: FunnelStepUsersSheetProps) {
	const [lastStep, setLastStep] = useState(props.step ?? fallbackStep);
	const displayStep = props.step ?? lastStep;

	useEffect(() => {
		if (props.step) {
			setLastStep(props.step);
		}
	}, [props.step]);

	return (
		<FunnelStepUsersSheetContent
			key={displayStep}
			{...props}
			step={displayStep}
		/>
	);
}

function FunnelStepUsersSheetContent({
	open,
	step,
	query,
	onOpenChange,
}: FunnelStepUsersSheetContentProps) {
	const [filter, setFilter] = useState<FunnelStepUsersFilter>("all");
	const [page, setPage] = useState(1);
	const [exporting, setExporting] = useState(false);
	const usersQuery = useAdminAnalyticsFunnelStepUsersQuery(
		step,
		{ ...query, page, pageSize: PAGE_SIZE, contacted: filter },
		{ enabled: open },
	);
	const contactMutation = useSetFunnelContactMutation();
	const canManageContact = useAdminPermission({ analytics: ["manage"] });
	const metadata = funnelStepMetadata[step];
	const pendingUserId = contactMutation.isPending
		? (contactMutation.variables?.userId ?? null)
		: null;

	useEffect(() => {
		if (open) {
			setFilter("all");
			setPage(1);
		}
	}, [open]);

	useEffect(() => {
		const data = usersQuery.data;
		if (
			usersQuery.isPlaceholderData ||
			!data ||
			data.page !== page ||
			data.items.length > 0 ||
			data.total === 0 ||
			page <= 1
		) {
			return;
		}

		setPage((currentPage) => Math.max(1, currentPage - 1));
	}, [page, usersQuery.data, usersQuery.isPlaceholderData]);

	async function exportCsv() {
		setExporting(true);
		try {
			const fileName = await downloadFunnelStepUsersCsv(step, {
				...query,
				contacted: filter,
			});
			toast.success(`${fileName} downloaded.`);
		} catch (error) {
			toast.error(
				errorMessage(error, "The funnel user export could not be downloaded."),
			);
		} finally {
			setExporting(false);
		}
	}

	async function changeContact(
		user: AnalyticsFunnelStepUser,
		contacted: boolean,
	) {
		try {
			await contactMutation.mutateAsync({ userId: user.id, contacted });
			toast.success(
				contacted
					? `${user.name} was marked as contacted.`
					: `${user.name} was marked as not contacted.`,
			);
		} catch (error) {
			toast.error(
				isApiClientError(error)
					? error.message
					: "The contacted state could not be changed. Please try again.",
			);
		}
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full gap-0 sm:max-w-[900px]">
				<SheetHeader className="border-b px-5 py-5 pr-14 sm:px-6">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
						<div className="min-w-0">
							<div className="flex flex-wrap items-center gap-2">
								<SheetTitle>{metadata.label} users</SheetTitle>
								{usersQuery.data ? (
									<Badge variant="secondary" className="tabular-nums">
										{formatOverviewWholeNumber(usersQuery.data.counts.all)}
									</Badge>
								) : null}
							</div>
							<SheetDescription className="mt-1">
								Signup-cohort users who reached this funnel milestone.
							</SheetDescription>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={exporting || !usersQuery.data}
							onClick={() => void exportCsv()}
						>
							{exporting ? (
								<Loader2Icon className="animate-spin" aria-hidden="true" />
							) : (
								<DownloadIcon aria-hidden="true" />
							)}
							{exporting ? "Exporting…" : "Export CSV"}
						</Button>
					</div>
				</SheetHeader>

				{usersQuery.isPending ? (
					<FunnelStepUsersLoading />
				) : usersQuery.isError || !usersQuery.data ? (
					<FunnelStepUsersMessage
						title="Funnel users could not be loaded"
						description={errorMessage(
							usersQuery.error,
							"Retry the request to restore this user list.",
						)}
						action={
							<Button type="button" onClick={() => void usersQuery.refetch()}>
								<RefreshCwIcon aria-hidden="true" />
								Retry
							</Button>
						}
					/>
				) : (
					<FunnelStepUsersSheetBody
						data={usersQuery.data}
						filter={filter}
						pendingUserId={pendingUserId}
						canManageContact={canManageContact}
						onFilterChange={(nextFilter) => {
							setFilter(nextFilter);
							setPage(1);
						}}
						onPageChange={setPage}
						onContactChange={(user, contacted) =>
							void changeContact(user, contacted)
						}
					/>
				)}
			</SheetContent>
		</Sheet>
	);
}

function FunnelStepUsersSheetBody({
	data,
	filter,
	pendingUserId,
	onFilterChange,
	onPageChange,
	onContactChange,
	canManageContact = true,
}: FunnelStepUsersSheetBodyProps) {
	const notContactedTotal = data.counts.all - data.counts.contacted;

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="flex flex-wrap gap-2 border-b bg-muted/20 px-5 py-3 sm:px-6">
				<SummaryChip
					label="Total"
					value={formatOverviewWholeNumber(data.counts.all)}
				/>
				<SummaryChip
					label="Contacted"
					value={formatOverviewWholeNumber(data.counts.contacted)}
				/>
				<SummaryChip
					label="Converted"
					value={formatOverviewWholeNumber(data.counts.converted)}
				/>
			</div>

			<Tabs
				value={filter}
				onValueChange={(value) =>
					onFilterChange(value as FunnelStepUsersFilter)
				}
				className="min-h-0 flex-1 gap-0 overflow-hidden"
			>
				<div className="border-b px-5 sm:px-6">
					<TabsList variant="line" className="h-11">
						<TabsTrigger value="all">
							All
							<Badge variant="secondary" className="rounded-sm px-1.5">
								{formatOverviewWholeNumber(data.counts.all)}
							</Badge>
						</TabsTrigger>
						<TabsTrigger value="notContacted">
							Not contacted
							<Badge variant="secondary" className="rounded-sm px-1.5">
								{formatOverviewWholeNumber(notContactedTotal)}
							</Badge>
						</TabsTrigger>
						<TabsTrigger value="contacted">
							Contacted
							<Badge variant="secondary" className="rounded-sm px-1.5">
								{formatOverviewWholeNumber(data.counts.contacted)}
							</Badge>
						</TabsTrigger>
					</TabsList>
				</div>
				<TabsContent
					value={filter}
					className="min-h-0 overflow-y-auto p-5 sm:p-6"
				>
					{data.items.length === 0 ? (
						<FunnelStepUsersMessage
							title={emptyStateTitle(filter)}
							description={emptyStateDescription(filter)}
						/>
					) : (
						<FunnelStepUsersTable
							items={data.items}
							page={data.page}
							pageSize={data.pageSize}
							total={data.total}
							pendingUserId={pendingUserId}
							onPageChange={onPageChange}
							onContactChange={onContactChange}
							canManageContact={canManageContact}
						/>
					)}
				</TabsContent>
			</Tabs>
		</div>
	);
}

function FunnelStepUsersTable({
	items,
	page,
	pageSize,
	total,
	pendingUserId,
	onPageChange,
	onContactChange,
	canManageContact,
}: {
	items: AnalyticsFunnelStepUser[];
	page: number;
	pageSize: number;
	total: number;
	pendingUserId: string | null;
	onPageChange: (page: number) => void;
	onContactChange: (user: AnalyticsFunnelStepUser, contacted: boolean) => void;
	canManageContact: boolean;
}) {
	return (
		<div className="overflow-hidden rounded-lg border">
			<div className="overflow-x-auto">
				<Table className="min-w-[840px]">
					<TableHeader>
						<TableRow>
							<TableHead>User</TableHead>
							<TableHead>Signed up</TableHead>
							<TableHead>Last activity</TableHead>
							<TableHead>Converted</TableHead>
							<TableHead>Contacted</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{items.map((user) => (
							<FunnelStepUserRow
								key={user.id}
								user={user}
								mutationPending={pendingUserId === user.id}
								onContactChange={onContactChange}
								canManageContact={canManageContact}
							/>
						))}
					</TableBody>
				</Table>
			</div>
			<PaginationControls
				page={page}
				pageSize={pageSize}
				total={total}
				onPageChange={onPageChange}
			/>
		</div>
	);
}

function FunnelStepUserRow({
	user,
	mutationPending,
	onContactChange,
	canManageContact,
}: {
	user: AnalyticsFunnelStepUser;
	mutationPending: boolean;
	onContactChange: (user: AnalyticsFunnelStepUser, contacted: boolean) => void;
	canManageContact: boolean;
}) {
	const contacted = user.contact !== null;

	return (
		<TableRow>
			<TableCell className="py-4 align-top">
				<div className="flex min-w-0 items-center gap-3">
					<Avatar size="lg" className="border">
						<AvatarImage src={user.image ?? undefined} alt="" />
						<AvatarFallback className="font-medium">
							{getInitials(user.name)}
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0">
						<Link
							to="/users/$userId"
							params={{ userId: user.id }}
							className="block max-w-52 truncate font-medium text-foreground outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
						>
							{user.name}
						</Link>
						<p className="max-w-52 truncate text-muted-foreground text-xs">
							{user.email}
						</p>
						<p className="mt-0.5 max-w-52 truncate font-mono text-[10px] text-muted-foreground/75">
							{user.id}
						</p>
					</div>
				</div>
			</TableCell>
			<TableCell className="py-4 align-top text-sm">
				{formatAdminDate(user.signedUpAt)}
			</TableCell>
			<TableCell className="py-4 align-top">
				<p className="text-sm">{formatAdminDateTime(user.lastEventAt)}</p>
				<p className="mt-1 text-muted-foreground text-xs">
					First {formatAdminDateTime(user.firstEventAt)} ·{" "}
					{formatOverviewWholeNumber(user.eventCount)}{" "}
					{user.eventCount === 1 ? "event" : "events"}
				</p>
			</TableCell>
			<TableCell className="py-4 align-top">
				{user.converted ? (
					<Badge
						variant="outline"
						className="border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300"
					>
						Paid
					</Badge>
				) : (
					<span className="text-muted-foreground text-xs">Not yet</span>
				)}
			</TableCell>
			<TableCell className="py-4 align-top">
				<div className="flex min-w-36 flex-col items-start gap-1.5">
					<Switch
						checked={contacted}
						disabled={mutationPending || !canManageContact}
						onCheckedChange={(checked) => onContactChange(user, checked)}
						aria-label={`Mark ${user.name} as ${contacted ? "not contacted" : "contacted"}`}
					/>
					{user.contact ? (
						<p className="text-muted-foreground text-xs">
							by {user.contact.contactedBy.name} ·{" "}
							{formatAdminDateTime(user.contact.contactedAt)}
						</p>
					) : (
						<p className="text-muted-foreground text-xs">Not contacted</p>
					)}
				</div>
			</TableCell>
		</TableRow>
	);
}

function SummaryChip({ label, value }: { label: string; value: string }) {
	return (
		<Badge variant="outline" className="bg-background tabular-nums">
			{label}
			<span className="font-semibold text-foreground">{value}</span>
		</Badge>
	);
}

function FunnelStepUsersLoading() {
	return (
		<div className="space-y-4 p-5 sm:p-6">
			<div className="flex gap-2">
				<Skeleton className="h-6 w-20" />
				<Skeleton className="h-6 w-24" />
				<Skeleton className="h-6 w-24" />
			</div>
			<Skeleton className="h-10 w-72" />
			<div className="overflow-hidden rounded-lg border p-4">
				{loadingRows.map((row) => (
					<div
						key={row}
						className="flex items-center gap-4 border-b py-4 last:border-b-0"
					>
						<Skeleton className="size-10 rounded-full" />
						<div className="flex-1 space-y-2">
							<Skeleton className="h-4 w-44" />
							<Skeleton className="h-3 w-64" />
						</div>
						<Skeleton className="h-5 w-28" />
						<Skeleton className="h-5 w-20" />
					</div>
				))}
			</div>
		</div>
	);
}

function FunnelStepUsersMessage({
	title,
	description,
	action,
}: {
	title: string;
	description: string;
	action?: ReactNode;
}) {
	return (
		<div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
			<span className="flex size-10 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
				<UsersIcon aria-hidden="true" className="size-5" />
			</span>
			<p className="mt-3 font-medium text-sm">{title}</p>
			<p className="mt-1 max-w-sm text-muted-foreground text-xs">
				{description}
			</p>
			{action ? <div className="mt-4">{action}</div> : null}
		</div>
	);
}

function emptyStateTitle(filter: FunnelStepUsersFilter) {
	if (filter === "contacted") {
		return "No contacted users";
	}
	if (filter === "notContacted") {
		return "Everyone has been contacted";
	}
	return "No users in this funnel step";
}

function emptyStateDescription(filter: FunnelStepUsersFilter) {
	if (filter === "contacted") {
		return "Contacted users will appear here after outreach is recorded.";
	}
	if (filter === "notContacted") {
		return "There are no users waiting for outreach in this list.";
	}
	return "No signup-cohort users reached this milestone for the selected filters.";
}

function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error && error.message ? error.message : fallback;
}

export type {
	FunnelStepUsersFilter,
	FunnelStepUsersSheetBodyProps,
	FunnelStepUsersSheetProps,
};
export { FunnelStepUsersSheet, FunnelStepUsersSheetBody };
