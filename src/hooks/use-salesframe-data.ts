import * as React from "react"

import {
  getSellerResearchProfile,
  listWorkspaceAccounts,
  listWorkspaceCalls,
  listWorkspaceOpportunities,
  listWorkspacePlaybooks,
  listWorkspaces,
  type AccountRow,
  type CallRow,
  type OpportunityRow,
  type PlaybookRow,
  type SellerResearchProfileRow,
  type WorkspaceRow,
} from "@/lib/supabase/salesframe-data"

type QueryState<T> = {
  data: T | null
  error: string | null
  isLoading: boolean
  refetch: () => void
}

function useSupabaseQuery<T>(
  load: () => Promise<T>,
  dependencies: React.DependencyList,
  options: { enabled?: boolean } = {}
): QueryState<T> {
  const enabled = options.enabled ?? true
  const [data, setData] = React.useState<T | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(enabled)
  const [reloadToken, setReloadToken] = React.useState(0)

  React.useEffect(() => {
    if (!enabled) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    setIsLoading(true)
    setError(null)

    load()
      .then((nextData) => {
        if (cancelled) return

        setData(nextData)
      })
      .catch((caughtError: unknown) => {
        if (cancelled) return

        setError(caughtError instanceof Error ? caughtError.message : "Something went wrong.")
      })
      .finally(() => {
        if (cancelled) return

        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [enabled, reloadToken, ...dependencies])

  return {
    data,
    error,
    isLoading,
    refetch: () => setReloadToken((value) => value + 1),
  }
}

export function useWorkspaces() {
  return useSupabaseQuery<WorkspaceRow[]>(() => listWorkspaces(), [])
}

export function useWorkspaceAccounts(workspaceId: string | null | undefined) {
  return useSupabaseQuery<AccountRow[]>(
    () => listWorkspaceAccounts(workspaceId ?? ""),
    [workspaceId],
    { enabled: Boolean(workspaceId) }
  )
}

export function useWorkspaceOpportunities(
  workspaceId: string | null | undefined,
  accountId?: string | null
) {
  return useSupabaseQuery<OpportunityRow[]>(
    () => listWorkspaceOpportunities(workspaceId ?? "", accountId ?? undefined),
    [workspaceId, accountId],
    { enabled: Boolean(workspaceId) }
  )
}

export function useWorkspaceCalls(workspaceId: string | null | undefined) {
  return useSupabaseQuery<CallRow[]>(
    () => listWorkspaceCalls(workspaceId ?? ""),
    [workspaceId],
    { enabled: Boolean(workspaceId) }
  )
}

export function useWorkspacePlaybooks(workspaceId: string | null | undefined) {
  return useSupabaseQuery<PlaybookRow[]>(
    () => listWorkspacePlaybooks(workspaceId ?? undefined),
    [workspaceId],
    { enabled: Boolean(workspaceId) }
  )
}

export function useSellerResearchProfile(workspaceId: string | null | undefined) {
  return useSupabaseQuery<SellerResearchProfileRow | null>(
    () => getSellerResearchProfile(workspaceId ?? ""),
    [workspaceId],
    { enabled: Boolean(workspaceId) }
  )
}

export function useWorkspaceData(workspaceId: string | null | undefined) {
  return useSupabaseQuery<{
    accounts: AccountRow[]
    calls: CallRow[]
    opportunities: OpportunityRow[]
    playbooks: PlaybookRow[]
    sellerResearchProfile: SellerResearchProfileRow | null
  }>(
    async () => {
      const [accounts, calls, opportunities, playbooks, sellerResearchProfile] = await Promise.all([
        listWorkspaceAccounts(workspaceId ?? ""),
        listWorkspaceCalls(workspaceId ?? ""),
        listWorkspaceOpportunities(workspaceId ?? ""),
        listWorkspacePlaybooks(workspaceId ?? undefined),
        getSellerResearchProfile(workspaceId ?? ""),
      ])

      return {
        accounts,
        calls,
        opportunities,
        playbooks,
        sellerResearchProfile,
      }
    },
    [workspaceId],
    { enabled: Boolean(workspaceId) }
  )
}
