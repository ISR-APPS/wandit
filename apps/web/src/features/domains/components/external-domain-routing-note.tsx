import { ExternalLink } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { domainLiveUrl } from "../lib/helpers";

export function ExternalDomainRoutingNote({ name }: { name: string }) {
	const { t } = useTranslation();
	const hostname = `www.${name}`;
	const redirectTarget = domainLiveUrl({ name, source: "external" });

	return (
		<div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs">
			<ExternalLink className="mt-0.5 size-3.5 shrink-0 text-ember-text" />
			<div className="min-w-0 space-y-1">
				<p>
					{t("settings.domains.externalServedAt")}{" "}
					<bdi dir="ltr" className="font-mono">
						{hostname}
					</bdi>
					.
				</p>
				<p className="text-muted-foreground">
					{t("settings.domains.externalApexRedirect")}{" "}
					<bdi dir="ltr" className="font-mono">
						{name}
					</bdi>{" "}
					{t("settings.domains.externalApexRedirectTo")}{" "}
					<bdi dir="ltr" className="font-mono">
						{redirectTarget}
					</bdi>
					.
				</p>
			</div>
		</div>
	);
}
