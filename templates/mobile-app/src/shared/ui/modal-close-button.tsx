/**
 * The close button of a modal header. The root layout puts it in the header
 * of each modal route: the web preview has no swipe-down to close a modal.
 */
import { router } from "expo-router";

import { AppButton } from "./button";
import { AppIcon } from "./icon";

function closeModal() {
	// A web visitor can open the modal route first; then no screen is behind it.
	if (router.canGoBack()) {
		router.back();
	} else {
		router.replace("/");
	}
}

type ModalCloseButtonProps = {
	/** The translated word for "Close". Screen readers read it. */
	label: string;
};

/** An icon-only ghost button with an X. It closes the modal, or opens home when nothing is behind it. */
export function ModalCloseButton({ label }: ModalCloseButtonProps) {
	return (
		<AppButton
			accessibilityLabel={label}
			// 40 pt button plus 4 pt on each side: a 48 pt touch target, above the 44 pt minimum.
			hitSlop={4}
			isIconOnly
			onPress={closeModal}
			size="sm"
			variant="ghost"
		>
			<AppIcon colorClassName="accent-foreground" name="close" size={22} />
		</AppButton>
	);
}
