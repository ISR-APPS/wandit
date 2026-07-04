import {
	type TranslationKey,
	type TranslationParams,
	translate,
} from "@wandit/internationalization";

import { getCurrentDictionary, getCurrentLocale } from "./locale-store";

export * from "@wandit/internationalization";
export * from "@wandit/internationalization/react";
export * from "./locale-store";
export * from "./provider";

export function pageTitle(key: TranslationKey, params?: TranslationParams) {
	return pageTitleDynamic(key, params);
}

export function pageTitleDynamic(key: string, params?: TranslationParams) {
	return translate(
		getCurrentDictionary(),
		key as TranslationKey,
		params,
		getCurrentLocale(),
	);
}
