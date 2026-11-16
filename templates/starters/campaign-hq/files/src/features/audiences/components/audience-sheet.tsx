// The side sheet that holds the panel of one audience.
// AudiencesPage opens it when the URL names an audience: after a click on a name, or from a link of the campaign page.
import { useRef } from "react";
import { Sheet, SheetContent } from "~/shared/ui/sheet";
import type { Audience } from "../api/audiences.queries";
import { AudiencePanel } from "./audience-panel";

type AudienceSheetProps = {
	/** The audience to show. It stays set while the sheet closes, so the content does not empty during the slide. */
	audience: Audience | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/** A controlled sheet at the end side. It renders no panel before an audience is named. */
export function AudienceSheet({
	audience,
	open,
	onOpenChange,
}: AudienceSheetProps) {
	const contentRef = useRef<HTMLDivElement>(null);
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				ref={contentRef}
				// Radix focuses the first focusable part, which is the size chart, and the chart then opens its tooltip.
				// The sheet itself takes the focus instead, so Tab still starts inside the sheet.
				onOpenAutoFocus={(event) => {
					event.preventDefault();
					contentRef.current?.focus();
				}}
				className="w-full gap-0 overflow-y-auto outline-none sm:max-w-md"
			>
				{audience ? (
					<AudiencePanel key={audience.id} audience={audience} />
				) : null}
			</SheetContent>
		</Sheet>
	);
}
