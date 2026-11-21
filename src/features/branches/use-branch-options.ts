import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-context';
import { api, type Paginated } from '@/lib/api';

const LOOKUP_PAGE_SIZE = 100; // backend maximum

/** Same key as the vehicles feature, so the branch list is fetched once per session. */
export const branchOptionsKey = ['branches', 'options'] as const;

/** GET /branches (needs `branches.view`); the backend returns only branches the user can access. */
export function fetchBranchOptions(signal?: AbortSignal) {
  return api.get<Paginated<{ id: number; name: string }>>('/branches', {
    query: { per_page: LOOKUP_PAGE_SIZE, sort: 'name', filter: { status: 'active' } },
    ...(signal ? { signal } : {}),
  });
}

/**
 * Branches the user can pick: /branches when they have `branches.view`, otherwise their own
 * branches from /auth/me. `defaultValue` is the only branch when there is exactly one.
 */
export function useBranchOptions({ enabled = true }: { enabled?: boolean } = {}) {
  const { user, can } = useAuth();
  const canList = can('branches.view');
  const query = useQuery({
    queryKey: branchOptionsKey,
    queryFn: ({ signal }) => fetchBranchOptions(signal),
    enabled: enabled && canList,
    staleTime: 10 * 60 * 1000,
  });

  const branches = canList ? (query.data?.items ?? []) : (user?.branches ?? []);
  const options = branches.map((branch) => ({ value: String(branch.id), label: branch.name }));

  return {
    options,
    isLoading: canList && query.isPending,
    defaultValue: options.length === 1 ? (options[0]?.value ?? '') : '',
  };
}
