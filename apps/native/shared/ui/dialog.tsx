import {
	type DialogCloseProps,
	type DialogContentProps,
	type DialogDescriptionProps,
	type DialogOverlayProps,
	type DialogPortalProps,
	type DialogRootProps,
	type DialogTitleProps,
	type DialogTriggerProps,
	Dialog as HeroDialog,
	useDialog as useHeroDialog,
	useDialogAnimation as useHeroDialogAnimation,
} from "heroui-native";
import { forwardRef } from "react";
import type { View } from "react-native";

export type AppDialogProps = DialogRootProps;
export type AppDialogTriggerProps = DialogTriggerProps;
export type AppDialogPortalProps = DialogPortalProps;
export type AppDialogOverlayProps = DialogOverlayProps;
export type AppDialogContentProps = DialogContentProps;
export type AppDialogCloseProps = DialogCloseProps;
export type AppDialogTitleProps = DialogTitleProps;
export type AppDialogDescriptionProps = DialogDescriptionProps;

const AppDialogRoot = forwardRef<View, AppDialogProps>((props, ref) => (
	<HeroDialog ref={ref} {...props} />
));

AppDialogRoot.displayName = "AppDialog";

export const AppDialog = Object.assign(AppDialogRoot, {
	Trigger: HeroDialog.Trigger,
	Portal: HeroDialog.Portal,
	Overlay: HeroDialog.Overlay,
	Content: HeroDialog.Content,
	Close: HeroDialog.Close,
	Title: HeroDialog.Title,
	Description: HeroDialog.Description,
});

export const useAppDialog = useHeroDialog;
export const useAppDialogAnimation = useHeroDialogAnimation;
