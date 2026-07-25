import {
	FileAudioIcon,
	FileIcon,
	FileImageIcon,
	FilesIcon,
	FileVideoIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { AdminUserDetail } from "@/features/users/api/users.dto";
import { formatAdminDate } from "@/features/users/lib/formatters";
import { titleCase } from "./user-detail-helpers";

type UserAssetsTabProps = {
	assets: AdminUserDetail["assets"];
};

const assetIcons = {
	image: FileImageIcon,
	video: FileVideoIcon,
	document: FileIcon,
	audio: FileAudioIcon,
} satisfies Record<AdminUserDetail["assets"][number]["type"], typeof FileIcon>;

export function UserAssetsTab({ assets }: UserAssetsTabProps) {
	return (
		<Card className="shadow-none">
			<CardHeader>
				<CardTitle>Assets</CardTitle>
				<CardDescription>
					Generated and uploaded media associated with this user.
				</CardDescription>
			</CardHeader>
			<CardContent className={assets.length > 0 ? "px-0" : undefined}>
				{assets.length > 0 ? (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="pl-6">Asset</TableHead>
								<TableHead>Type</TableHead>
								<TableHead>Source</TableHead>
								<TableHead>Model</TableHead>
								<TableHead>Size</TableHead>
								<TableHead className="pr-6">Created</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{assets.map((asset) => {
								const Icon = assetIcons[asset.type];

								return (
									<TableRow key={asset.id}>
										<TableCell className="pl-6">
											<div className="flex min-w-52 items-center gap-3">
												<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
													<Icon aria-hidden="true" />
												</div>
												<span
													className="truncate font-medium"
													title={asset.name}
												>
													{asset.name}
												</span>
											</div>
										</TableCell>
										<TableCell>
											<Badge variant="secondary">{titleCase(asset.type)}</Badge>
										</TableCell>
										<TableCell>{asset.source}</TableCell>
										<TableCell>{asset.model ?? "—"}</TableCell>
										<TableCell className="tabular-nums">
											{asset.sizeLabel}
										</TableCell>
										<TableCell className="pr-6">
											<time dateTime={asset.createdAt}>
												{formatAdminDate(asset.createdAt)}
											</time>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				) : (
					<Empty className="min-h-64 border-0">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<FilesIcon aria-hidden="true" />
							</EmptyMedia>
							<EmptyTitle>No assets</EmptyTitle>
							<EmptyDescription>
								Generated and uploaded files will appear here.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				)}
			</CardContent>
		</Card>
	);
}
