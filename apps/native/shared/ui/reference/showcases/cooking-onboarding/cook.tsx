import AntDesign from "@expo/vector-icons/AntDesign";
import {
	Button,
	Popover,
	type PopoverTriggerRef,
	useThemeColor,
} from "heroui-native";
import type { FC, RefObject } from "react";
import { withUniwind } from "uniwind";
import { simulatePress } from "../../../helpers/utils/simulate-press";
import { AppText } from "../../app-text";
import { className } from "./styles";

const StyledAntDesign = withUniwind(AntDesign);

type Props = {
	isOnboardingDone: boolean;
	triggerRef: RefObject<PopoverTriggerRef | null>;
};

export const Cook: FC<Props> = ({ isOnboardingDone, triggerRef }) => {
	const themeColorForeground = useThemeColor("foreground");

	return (
		<Popover>
			<Popover.Trigger ref={triggerRef}>
				<Button
					pressableFeedbackVariant="none"
					className="h-12 flex-row items-center gap-1 rounded-[14px] bg-orange-300 px-4"
					onPress={isOnboardingDone ? simulatePress : undefined}
				>
					<StyledAntDesign name="fire" size={16} className="text-black" />
					<AppText className="font-semibold text-black text-lg">Cook</AppText>
				</Button>
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Content
					presentation="popover"
					className={className.popoverContent}
					placement="top"
				>
					<Popover.Arrow
						stroke={themeColorForeground}
						fill={themeColorForeground}
					/>
					<AppText className={className.popoverText}>
						Start cooking with step-by-step instructions
					</AppText>
				</Popover.Content>
			</Popover.Portal>
		</Popover>
	);
};
