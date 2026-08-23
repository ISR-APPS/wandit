import {
	pushTokenRoutes,
	type RegisterPushTokenBody,
	registerPushTokenResponseSchema,
	type UnregisterPushTokenBody,
	unregisterPushTokenResponseSchema,
} from "@wandit/contracts";
import Constants, { AppOwnership } from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

import { apiClient } from "@/shared/lib/api-client";

const EAS_PROJECT_ID = "41f71bec-8c56-43dc-b99a-1f0ec4faef40";
const handledNotificationResponseIds = new Set<string>();
const PUSH_TOKEN_REQUEST_TIMEOUT_MS = 2_000;

let currentExpoPushToken: string | null = null;
let currentRegistrationGeneration = 0;
let pushTokenMutation: Promise<void> = Promise.resolve();
let unregistrationMutation: Promise<void> | null = null;

setForegroundNotificationHandler();

export function usePushNotifications(enabled: boolean) {
	useEffect(() => {
		if (!enabled || !Device.isDevice) {
			return;
		}

		// StoreClient also includes development clients; appOwnership is the
		// exact Expo Go guard, where remote push is unsupported on SDK 53+.
		if (Constants.appOwnership === AppOwnership.Expo) {
			return;
		}
		if (!getPushPlatform()) {
			return;
		}

		const registrationGeneration = ++currentRegistrationGeneration;
		let active = true;
		let pushTokenSubscription: Notifications.EventSubscription | undefined;
		const isActive = () =>
			active && registrationGeneration === currentRegistrationGeneration;

		let notificationResponseSubscription:
			| Notifications.EventSubscription
			| undefined;
		try {
			notificationResponseSubscription =
				Notifications.addNotificationResponseReceivedListener((response) => {
					if (isActive()) {
						openLeadNotification(response);
					}
				});
		} catch {
			return;
		}

		void Notifications.getLastNotificationResponseAsync()
			.then((response) => {
				if (isActive() && response) {
					openLeadNotification(response);
				}
			})
			.catch(() => undefined);

		void configurePushNotifications(isActive, registrationGeneration)
			.then((subscription) => {
				if (!isActive()) {
					removeSubscription(subscription);
					return;
				}
				pushTokenSubscription = subscription;
			})
			.catch(() => undefined);

		return () => {
			active = false;
			if (registrationGeneration === currentRegistrationGeneration) {
				currentRegistrationGeneration += 1;
			}
			removeSubscription(pushTokenSubscription);
			removeSubscription(notificationResponseSubscription);
		};
	}, [enabled]);
}

export async function unregisterCurrentPushToken(): Promise<void> {
	if (unregistrationMutation) {
		return unregistrationMutation;
	}

	currentRegistrationGeneration += 1;
	const token = currentExpoPushToken;
	currentExpoPushToken = null;

	const unregister = async () => {
		await pushTokenMutation.catch(() => undefined);
		if (!token) {
			return;
		}

		const body: UnregisterPushTokenBody = { token };
		const data = await apiClient.request<unknown, UnregisterPushTokenBody>({
			data: body,
			method: "DELETE",
			timeout: PUSH_TOKEN_REQUEST_TIMEOUT_MS,
			url: pushTokenRoutes.unregister,
		});
		unregisterPushTokenResponseSchema.parse(data);
	};

	unregistrationMutation = unregister().finally(() => {
		unregistrationMutation = null;
	});
	return unregistrationMutation;
}

async function configurePushNotifications(
	isActive: () => boolean,
	registrationGeneration: number,
) {
	if (!isActive()) {
		return;
	}

	const platform = getPushPlatform();
	if (!platform) {
		return;
	}

	if (platform === "android") {
		await Notifications.setNotificationChannelAsync("default", {
			importance: Notifications.AndroidImportance.HIGH,
			name: "Default",
		});
	}
	if (!isActive()) {
		return;
	}

	let permissions = await Notifications.getPermissionsAsync();
	if (!isActive()) {
		return;
	}
	if (!permissions.granted && permissions.canAskAgain) {
		permissions = await Notifications.requestPermissionsAsync();
	}
	if (!permissions.granted || !isActive()) {
		return;
	}

	const projectId = getEasProjectId();
	const expoPushToken = await Notifications.getExpoPushTokenAsync({
		projectId,
	});
	if (!isActive()) {
		return;
	}

	await registerPushToken(expoPushToken.data, platform, registrationGeneration);
	if (!isActive()) {
		return;
	}

	return Notifications.addPushTokenListener((devicePushToken) => {
		void refreshRotatedPushToken({
			devicePushToken,
			isActive,
			platform,
			projectId,
			registrationGeneration,
		}).catch(() => undefined);
	});
}

async function refreshRotatedPushToken({
	devicePushToken,
	isActive,
	platform,
	projectId,
	registrationGeneration,
}: {
	devicePushToken: Notifications.DevicePushToken;
	isActive: () => boolean;
	platform: RegisterPushTokenBody["platform"];
	projectId: string;
	registrationGeneration: number;
}) {
	// The listener emits an APNs/FCM token; pass it through so fetching the Expo
	// token does not request another device token and re-trigger the listener.
	const expoPushToken = await Notifications.getExpoPushTokenAsync({
		devicePushToken,
		projectId,
	});
	if (isActive()) {
		await registerPushToken(
			expoPushToken.data,
			platform,
			registrationGeneration,
		);
	}
}

async function registerPushToken(
	token: string,
	platform: RegisterPushTokenBody["platform"],
	registrationGeneration: number,
) {
	if (registrationGeneration !== currentRegistrationGeneration) {
		return;
	}

	currentExpoPushToken = token;
	const registration = pushTokenMutation
		.catch(() => undefined)
		.then(async () => {
			if (registrationGeneration !== currentRegistrationGeneration) {
				return;
			}

			const body: RegisterPushTokenBody = { platform, token };
			const data = await apiClient.post<unknown, RegisterPushTokenBody>(
				pushTokenRoutes.register,
				body,
				{ timeout: PUSH_TOKEN_REQUEST_TIMEOUT_MS },
			);
			registerPushTokenResponseSchema.parse(data);
		});
	pushTokenMutation = registration.catch(() => undefined);
	await registration;
}

function openLeadNotification(response: Notifications.NotificationResponse) {
	const responseId = response.notification.request.identifier;
	const data = response.notification.request.content.data;
	const projectId = data?.projectId;

	if (
		data?.type !== "lead.captured" ||
		typeof projectId !== "string" ||
		projectId.length === 0 ||
		handledNotificationResponseIds.has(responseId)
	) {
		return;
	}

	try {
		router.push(`/project/${projectId}/leads`);
		handledNotificationResponseIds.add(responseId);
	} catch {
		return;
	}
}

function setForegroundNotificationHandler() {
	if (!getPushPlatform()) {
		return;
	}

	try {
		Notifications.setNotificationHandler({
			handleNotification: async () => ({
				shouldPlaySound: true,
				shouldSetBadge: false,
				shouldShowBanner: true,
				shouldShowList: true,
			}),
		});
	} catch {
		return;
	}
}

function removeSubscription(
	subscription: Notifications.EventSubscription | undefined,
) {
	try {
		subscription?.remove();
	} catch {
		return;
	}
}

function getPushPlatform(): RegisterPushTokenBody["platform"] | null {
	if (Platform.OS === "ios" || Platform.OS === "android") {
		return Platform.OS;
	}
	return null;
}

function getEasProjectId() {
	const configuredProjectId = Constants.expoConfig?.extra?.eas?.projectId;
	return typeof configuredProjectId === "string" && configuredProjectId.trim()
		? configuredProjectId
		: EAS_PROJECT_ID;
}
