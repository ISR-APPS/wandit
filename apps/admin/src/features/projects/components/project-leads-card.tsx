import { ContactRoundIcon } from "lucide-react";

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
import type { AdminProjectLeads } from "@/features/projects/api/projects.dto";
import {
	formatProjectDateTime,
	formatWholeNumber,
	statusBadgeVariant,
	titleCase,
} from "@/features/projects/lib/project-detail-helpers";

import { ProjectSectionEmpty } from "./project-section-empty";

type ProjectLeadsCardProps = {
	leads: AdminProjectLeads;
};

export function ProjectLeadsCard({ leads }: ProjectLeadsCardProps) {
	return (
		<Card className="shadow-none">
			<CardHeader>
				<CardTitle>Leads</CardTitle>
				<CardDescription>
					{leads.total > 0
						? `Showing ${formatWholeNumber(leads.recent.length)} recent leads of ${formatWholeNumber(leads.total)} total.`
						: "Recent form submissions captured by this project."}
				</CardDescription>
			</CardHeader>
			<CardContent className={leads.recent.length > 0 ? "px-0" : undefined}>
				{leads.recent.length > 0 ? (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="pl-6">Name</TableHead>
								<TableHead>Phone</TableHead>
								<TableHead>Location</TableHead>
								<TableHead>Status</TableHead>
								<TableHead className="pr-6">Created</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{leads.recent.map((lead) => (
								<TableRow key={lead.id}>
									<TableCell className="pl-6 font-medium">
										<span className="block max-w-64 truncate" title={lead.name}>
											{lead.name}
										</span>
									</TableCell>
									<TableCell>
										<span dir="ltr" className="font-mono text-xs">
											{lead.phone}
										</span>
									</TableCell>
									<TableCell>
										<span
											className="block max-w-64 truncate"
											title={formatLeadLocation(lead.wilaya, lead.commune)}
										>
											{formatLeadLocation(lead.wilaya, lead.commune)}
										</span>
									</TableCell>
									<TableCell>
										<Badge variant={statusBadgeVariant(lead.status)}>
											{titleCase(lead.status)}
										</Badge>
									</TableCell>
									<TableCell className="pr-6">
										<time dateTime={lead.createdAt}>
											{formatProjectDateTime(lead.createdAt)}
										</time>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				) : (
					<ProjectSectionEmpty
						icon={<ContactRoundIcon aria-hidden="true" />}
						title="No leads yet"
						description="Leads will appear here when visitors submit the project's form."
					/>
				)}
			</CardContent>
		</Card>
	);
}

function formatLeadLocation(wilaya: string | null, commune: string | null) {
	const location = [wilaya, commune].filter(Boolean).join(" / ");

	return location || "—";
}
