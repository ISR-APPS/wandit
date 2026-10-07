/**
 * App text field: a label, an input, a help text, and an error, in one group.
 * Screens use it for every form field, so the field look changes in this file.
 */
import {
	Description,
	FieldError,
	Label,
	TextField,
	type TextFieldRootProps,
} from "heroui-native";

import { AppInput } from "./input";

/** Same as the HeroUI Native TextFieldRootProps. The parts keep their HeroUI props. */
export type AppTextFieldProps = TextFieldRootProps;

function AppTextFieldRoot(props: AppTextFieldProps) {
	return <TextField {...props} />;
}

/**
 * HeroUI Native TextField. `isInvalid` and `isDisabled` on the root reach
 * the parts: Label, Input (the AppInput), Description, and FieldError.
 */
export const AppTextField = Object.assign(AppTextFieldRoot, {
	Label,
	Input: AppInput,
	Description,
	FieldError,
});
