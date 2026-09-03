import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
	CreateMonthlyCostRequest,
	UpdateMonthlyCostRequest,
} from "@wandit/contracts";

import { monthlyCostsKeys } from "./costs.queries";
import {
	createMonthlyCost,
	deleteMonthlyCost,
	updateMonthlyCost,
} from "./costs.services";

function useInvalidateMonthlyCosts() {
	const queryClient = useQueryClient();

	return async () => {
		await queryClient.invalidateQueries({ queryKey: monthlyCostsKeys.lists() });
	};
}

export function useCreateMonthlyCostMutation() {
	const invalidateMonthlyCosts = useInvalidateMonthlyCosts();

	return useMutation({
		mutationKey: [...monthlyCostsKeys.all, "create"],
		mutationFn: (input: CreateMonthlyCostRequest) => createMonthlyCost(input),
		onSuccess: invalidateMonthlyCosts,
	});
}

export function useUpdateMonthlyCostMutation() {
	const invalidateMonthlyCosts = useInvalidateMonthlyCosts();

	return useMutation({
		mutationKey: [...monthlyCostsKeys.all, "update"],
		mutationFn: (input: { month: string; data: UpdateMonthlyCostRequest }) =>
			updateMonthlyCost(input),
		onSuccess: invalidateMonthlyCosts,
	});
}

export function useDeleteMonthlyCostMutation() {
	const invalidateMonthlyCosts = useInvalidateMonthlyCosts();

	return useMutation({
		mutationKey: [...monthlyCostsKeys.all, "delete"],
		mutationFn: (month: string) => deleteMonthlyCost(month),
		onSuccess: invalidateMonthlyCosts,
	});
}
