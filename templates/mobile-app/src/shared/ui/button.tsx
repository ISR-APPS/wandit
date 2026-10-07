/**
 * App button. Screens use AppButton, not the HeroUI Button, so the look of
 * every button changes in this one file. String children render as the label.
 */
import { Button, type ButtonRootProps } from "heroui-native";

/** Same as the HeroUI Native ButtonRootProps. Add an app-wide button prop here. */
export type AppButtonProps = ButtonRootProps;

/** HeroUI Native Button. `variant` is `primary` (default), `secondary`, `ghost`, and more. */
export function AppButton(props: AppButtonProps) {
	return <Button {...props} />;
}
