import type { FC } from "react";
import { View } from "react-native";
import { AppText } from "../../app-text";

type HighlightItemProps = {
	label: string;
	value: string;
};

const HighlightItem: FC<HighlightItemProps> = ({ label, value }) => {
	return (
		<View>
			<AppText className="text-base text-muted">{label}</AppText>
			<AppText className="font-semibold text-base text-foreground">
				{value}
			</AppText>
		</View>
	);
};

export const Highlights: FC = () => {
	return (
		<View className="mb-8 flex-row justify-between">
			<HighlightItem label="Level" value="Beginner" />
			<HighlightItem label="Cooking" value="15m" />
			<HighlightItem label="Overall" value="35m" />
			<HighlightItem label="Ready" value="3:03pm" />
		</View>
	);
};
