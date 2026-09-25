/**
 * App input. Screens use AppInput, not the HeroUI Input, so the look of
 * every text input changes in this one file. Use AppTextField for a label.
 */
import { Input, type InputProps } from "heroui-native";

/** Same as the HeroUI Native InputProps, which extend the React Native TextInputProps. */
export type AppInputProps = InputProps;

/** HeroUI Native Input: a React Native TextInput with the field theme. */
export function AppInput(props: AppInputProps) {
	return <Input {...props} />;
}
