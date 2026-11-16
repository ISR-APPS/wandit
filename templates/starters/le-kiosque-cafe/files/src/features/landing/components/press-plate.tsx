// The frame of a drawn press plate: the SVG drawing, then a hairline caption with the deadpan photo credit.
// The front page and the roast feature render it around their plates.
import type { ReactNode } from "react";
import type { TranslationKey } from "~/shared/i18n";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { CAPTION } from "../lib/type-styles";

/** A figure with its caption. The child is the plate SVG; it carries its own role="img" and label. */
export function PressPlate({
	captionKey,
	children,
	className,
}: {
	/** The caption text. The component adds the credit "Photo: the newsroom". */
	captionKey: TranslationKey;
	children: ReactNode;
	className?: string;
}) {
	const { t } = useT();
	return (
		<figure className={cn("m-0", className)}>
			{children}
			<figcaption className={CAPTION}>
				{t(captionKey)}{" "}
				<span className="whitespace-nowrap">{t("site.photoCredit")}</span>
			</figcaption>
		</figure>
	);
}
