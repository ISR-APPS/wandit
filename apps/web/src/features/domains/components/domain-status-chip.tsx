import { Badge } from "@wandit/ui/components/badge";
import type { ComponentProps } from "react";

import { useTranslation } from "@/lib/i18n";
import type { DomainStatus } from "../api/domains.dto";

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

const statusVariant = {
	registering: "info",
	configuring: "warning",
	active: "success",
	failed: "destructive",
	expired: "secondary",
	transferred_out: "outline",
} as const satisfies Record<DomainStatus, BadgeVariant>;

type DomainStatusChipProps = {
	status: DomainStatus;
};

export function DomainStatusChip({ status }: DomainStatusChipProps) {
	const { t } = useTranslation();

	return (
		<Badge variant={statusVariant[status]} className="font-mono text-[10px]">
			{t(`settings.domains.status.${status}`)}
		</Badge>
	);
}
