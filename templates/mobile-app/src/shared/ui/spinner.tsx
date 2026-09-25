/**
 * App spinner for a loading state. Screens use AppSpinner, not the HeroUI
 * Spinner, so the loading look changes in this one file.
 */
import { Spinner, type SpinnerProps } from "heroui-native";

/** Same as the HeroUI Native SpinnerProps. Add an app-wide spinner prop here. */
export type AppSpinnerProps = SpinnerProps;

/** HeroUI Native Spinner. `size` is `sm`, `md` (default), or `lg`. */
export function AppSpinner(props: AppSpinnerProps) {
	return <Spinner {...props} />;
}
