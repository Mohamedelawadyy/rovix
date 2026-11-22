import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-context';
import { contractKeys, salesContractsApi } from './api/sales-contracts-api';
import { labelOf, paymentMethodLabels } from './labels';

const STALE = 10 * 60 * 1000;

/**
 * Select options for the contract and payment forms. Each list needs its own permission;
 * `missing` names the ones the user cannot load, so the form can explain why it is blocked.
 */
export function useContractLookups({
  branchId,
  needsCashbox,
  needsBank,
}: {
  branchId: number | null;
  needsCashbox: boolean;
  needsBank: boolean;
}) {
  const { can } = useAuth();
  const canEmployees = can('employees.view');
  const canCashboxes = can('cashboxes.view');
  const canBanks = can('banks.view') || can('bank-financing.view');

  const lookups = useQuery({
    queryKey: contractKeys.lookups,
    queryFn: ({ signal }) => salesContractsApi.lookups(signal),
    staleTime: STALE,
  });
  const employees = useQuery({
    queryKey: contractKeys.employees(branchId ?? 0),
    queryFn: ({ signal }) => salesContractsApi.salesEmployees(branchId ?? 0, signal),
    enabled: canEmployees && branchId !== null,
    staleTime: STALE,
  });
  const cashboxes = useQuery({
    queryKey: contractKeys.cashboxes,
    queryFn: ({ signal }) => salesContractsApi.cashboxes(signal),
    enabled: canCashboxes && needsCashbox,
    staleTime: STALE,
  });
  const banks = useQuery({
    queryKey: contractKeys.banks,
    queryFn: ({ signal }) => salesContractsApi.banks(signal),
    enabled: canBanks && needsBank,
    staleTime: STALE,
  });

  return {
    canEmployees,
    canCashboxes,
    employees: employees.data?.items ?? [],
    employeeOptions: (employees.data?.items ?? []).map((e) => ({
      value: String(e.id),
      label: e.employee_code ? `${e.name} (${e.employee_code})` : e.name,
    })),
    cashboxOptions: (cashboxes.data?.items ?? []).map((c) => ({
      value: String(c.id),
      label: c.branch ? `${c.name} · ${c.branch.name}` : c.name,
    })),
    bankOptions: (banks.data ?? [])
      .filter((b) => b.is_active)
      .map((b) => ({ value: String(b.id), label: b.name })),
    methodOptions: (lookups.data?.payment_methods ?? []).map((method) => ({
      value: method,
      label: labelOf(paymentMethodLabels, method),
    })),
    frequencies: lookups.data?.installment_frequencies ?? [],
  };
}
