import { MegaphoneIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { AdminProjectMarketingAsset } from "@/features/projects/api/projects.dto";
import {
	formatProjectDateTime,
	statusBadgeVariant,
	titleCase,
} from "@/features/projects/lib/project-detail-helpers";

import { ProjectSectionEmpty } from "./project-section-empty";

type ProjectMarketingAssetsCardProps = {
	assets: AdminProjectMarketingAsset[];
};

export function ProjectMarketingAssetsCard({
	assets,
}: ProjectMarketingAssetsCardProps) {
	return (
		<Card className="shadow-none">
			<CardHeader>
				<CardTitle>Marketing assets</CardTitle>
				<CardDescription>
					{assets.length > 0
						? `${assets.length} generated marketing deliverables.`
						: "Generated marketing deliverables for this project."}
				</CardDescription>
			</CardHeader>
			<CardContent className={assets.length > 0 ? "px-0" : undefined}>
				{assets.length > 0 ? (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="pl-6">Name</TableHead>
								<TableHead>Type</TableHead>
								<TableHead>Status</TableHead>
								<TableHead className="pr-6">Created</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{assets.map((asset) => (
								<TableRow key={asset.id}>
									<TableCell className="pl-6 font-medium">
										<span
											className="block max-w-80 truncate"
											title={asset.name}
										>
											{asset.name}
										</span>
									</TableCell>
									<TableCell>
										<Badge variant="outline">{titleCase(asset.type)}</Badge>
									</TableCell>
									<TableCell>
										<Badge variant={statusBadgeVariant(asset.status)}>
											{titleCase(asset.status)}
										</Badge>
									</TableCell>
									<TableCell className="pr-6">
										<time dateTime={asset.createdAt}>
											{formatProjectDateTime(asset.createdAt)}
										</time>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				) : (
					<ProjectSectionEmpty
						icon={<MegaphoneIcon aria-hidden="true" />}
						title="No marketing assets"
						description="Marketing deliverables will appear here after they are generated."
					/>
				)}
			</CardContent>
		</Card>
	);
}
