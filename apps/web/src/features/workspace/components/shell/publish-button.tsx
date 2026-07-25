// Header entry point for the lightweight publish popover (dc 13a).
// The custom-domain purchase journey opens as a focused modal from there.

import { PublishPopover } from "../publish/publish-popover";

export function PublishButton() {
	return <PublishPopover />;
}
