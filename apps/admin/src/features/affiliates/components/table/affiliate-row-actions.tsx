import {
	CirclePauseIcon,
	CirclePlayIcon,
	CopyIcon,
	EllipsisIcon,
	ExternalLinkIcon,
	LinkIcon,
	PlusIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Affiliate } from "@/features/affiliates/api/affiliates.dto";
import { useSetAffiliateStatusMutation } from "@/features/affiliates/api/affiliates.mutations";

type AffiliateRowActionsProps = {
	affiliate: Affiliate;
	onOpenDetail: () => void;
	onAddCode: () => void;
};

function AffiliateRowActions({
	affiliate,
	onOpenDetail,
	onAddCode,
}: AffiliateRowActionsProps) {
	const statusMutation = useSetAffiliateStatusMutation();
	const nextStatus = affiliate.status === "active" ? "paused" : "active";
	const activeCode =
		affiliate.codes.find((code) => code.status === "active") ??
		affiliate.codes[0];

	async function copyValue(value: string, successMessage: string) {
		try {
			await navigator.clipboard.writeText(value);
			toast.success(successMessage);
		} catch {
			toast.error("The value could not be copied.");
		}
	}

	async function changeStatus() {
		try {
			await statusMutation.mutateAsync({
				affiliateId: affiliate.id,
				status: nextStatus,
			});
			toast.success(
				nextStatus === "active"
					? `${affiliate.name} is active.`
					: `${affiliate.name} has been paused.`,
			);
		} catch {
			toast.error("The affiliate status could not be changed.");
		}
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="data-[state=open]:bg-accent"
					title={`Actions for ${affiliate.name}`}
				>
					<EllipsisIcon />
					<span className="sr-only">Open actions for {affiliate.name}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuGroup>
					<DropdownMenuLabel className="truncate">
						{affiliate.name}
					</DropdownMenuLabel>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem onSelect={onOpenDetail}>
						<ExternalLinkIcon />
						View performance
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={onAddCode}>
						<PlusIcon />
						Add referral code
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={() =>
							void copyValue(affiliate.id, "Affiliate ID copied.")
						}
					>
						<CopyIcon />
						Copy affiliate ID
					</DropdownMenuItem>
					{activeCode ? (
						<DropdownMenuItem
							onSelect={() =>
								void copyValue(
									`https://wandit.ai${activeCode.landingPath}?ref=${activeCode.code}`,
									"Referral link copied.",
								)
							}
						>
							<LinkIcon />
							Copy referral link
						</DropdownMenuItem>
					) : null}
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem
						onSelect={() => void changeStatus()}
						disabled={statusMutation.isPending}
					>
						{nextStatus === "active" ? <CirclePlayIcon /> : <CirclePauseIcon />}
						{nextStatus === "active" ? "Activate affiliate" : "Pause affiliate"}
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export type { AffiliateRowActionsProps };
export { AffiliateRowActions };
