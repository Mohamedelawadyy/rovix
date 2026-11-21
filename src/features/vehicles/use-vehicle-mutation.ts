import { useMutation, useQueryClient } from '@tanstack/react-query';
import { vehicleKeys } from './api/vehicles-api';

/**
 * Mutation for any vehicle action. On success it refreshes everything the action can change:
 * the vehicle, its history, the inventory lists and the transfers list.
 */
export function useVehicleMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  onSuccess?: (result: TResult, variables: TVariables) => void,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: async (result, variables) => {
      await queryClient.invalidateQueries({ queryKey: vehicleKeys.all });
      onSuccess?.(result, variables);
    },
  });
}
