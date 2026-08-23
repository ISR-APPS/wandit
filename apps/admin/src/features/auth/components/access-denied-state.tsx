import { Link } from "@tanstack/react-router";
import { LockKeyholeIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";

export function AccessDeniedState() {
	return (
		<Empty className="min-h-(--content-full-height) border bg-background">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<LockKeyholeIcon aria-hidden="true" />
				</EmptyMedia>
				<EmptyTitle>You don&apos;t have access to this section</EmptyTitle>
				<EmptyDescription>
					Ask a Wandit admin to extend your permissions.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button asChild>
					<Link to="/dashboard">Back to overview</Link>
				</Button>
			</EmptyContent>
		</Empty>
	);
}
