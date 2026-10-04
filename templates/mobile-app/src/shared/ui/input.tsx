/**
 * App input. Screens use AppInput, not the HeroUI Input, so the look of
 * every text input changes in this one file. Use AppTextField for a label.
 */
import { Input, type InputProps } from "heroui-native";
import type { Ref } from "react";
import type { TextInput } from "react-native";

/** The HeroUI Native InputProps, plus `ref` so a form can move the focus to the next field. */
export type AppInputProps = InputProps & { ref?: Ref<TextInput> };

/** HeroUI Native Input: a React Native TextInput with the field theme. */
export function AppInput(props: AppInputProps) {
	return <Input {...props} />;
}
