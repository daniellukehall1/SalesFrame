import * as React from "react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import {
  Building2Icon,
  ChevronRightIcon,
  CircleDotIcon,
  ExternalLinkIcon,
  PencilIcon,
  PlusIcon,
  TargetIcon,
  Trash2Icon,
} from "lucide-react"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import type { CurrencyCode } from "@/lib/salesframe-core"

export type AccountNavItem = {
  id: string
  name: string
  description: string
  website: string
  currency: CurrencyCode
  icon: React.ReactNode
  opportunities: {
    id: string
    name: string
    stage: string
  }[]
}

export function NavProjects({
  accounts,
  activeAccountId,
  activeOpportunityId,
  onAccountSelect,
  onCreateAccount,
  onCreateOpportunity,
  onDeleteAccount,
  onDeleteOpportunity,
  onEditAccount,
  onEditOpportunity,
  onOpportunitySelect,
}: {
  accounts: AccountNavItem[]
  activeAccountId: string
  activeOpportunityId: string
  onAccountSelect: (id: string) => void
  onCreateAccount: () => void
  onCreateOpportunity: (accountId: string) => void
  onDeleteAccount: (id: string) => void
  onDeleteOpportunity: (id: string) => void
  onEditAccount: (id: string) => void
  onEditOpportunity: (id: string) => void
  onOpportunitySelect: (id: string) => void
}) {
  const sortedAccounts = React.useMemo(
    () =>
      [...accounts].sort((firstAccount, secondAccount) =>
        firstAccount.name.localeCompare(secondAccount.name, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      ),
    [accounts]
  )
  const opportunityCount = sortedAccounts.reduce(
    (total, account) => total + account.opportunities.length,
    0
  )
  const expandableAccountIds = React.useMemo(
    () => sortedAccounts.filter((account) => account.opportunities.length > 0).map((account) => account.id),
    [sortedAccounts]
  )
  const [expandedAccountIds, setExpandedAccountIds] = React.useState<Set<string>>(
    () => new Set(activeAccountId ? [activeAccountId] : [])
  )
  const allAccountsExpanded =
    expandableAccountIds.length > 0 &&
    expandableAccountIds.every((accountId) => expandedAccountIds.has(accountId))

  React.useEffect(() => {
    setExpandedAccountIds((currentIds) => {
      const validAccountIds = new Set(sortedAccounts.map((account) => account.id))
      const activeOpportunityAccount = sortedAccounts.find((account) =>
        account.opportunities.some((opportunity) => opportunity.id === activeOpportunityId)
      )
      const nextIds = new Set([...currentIds].filter((accountId) => validAccountIds.has(accountId)))

      if (activeAccountId) nextIds.add(activeAccountId)
      if (activeOpportunityAccount) nextIds.add(activeOpportunityAccount.id)

      if (nextIds.size === currentIds.size && [...nextIds].every((accountId) => currentIds.has(accountId))) {
        return currentIds
      }

      return nextIds
    })
  }, [sortedAccounts, activeAccountId, activeOpportunityId])

  const handleAccountExpandedChange = (accountId: string, isOpen: boolean) => {
    setExpandedAccountIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (isOpen) {
        nextIds.add(accountId)
      } else {
        nextIds.delete(accountId)
      }

      return nextIds
    })
  }

  const handleToggleAllAccounts = () => {
    setExpandedAccountIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (allAccountsExpanded) {
        expandableAccountIds.forEach((accountId) => nextIds.delete(accountId))
      } else {
        expandableAccountIds.forEach((accountId) => nextIds.add(accountId))
      }

      return nextIds
    })
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="justify-between gap-2 pr-1">
        <span>Accounts</span>
        <span className="flex items-center gap-1">
          {expandableAccountIds.length ? (
            <button
              type="button"
              className="rounded px-1.5 py-0.5 text-[11px] font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-hidden"
              onClick={handleToggleAllAccounts}
            >
              {allAccountsExpanded ? "Collapse all" : "Expand all"}
            </button>
          ) : null}
          <button
            type="button"
            className="flex size-5 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-hidden"
            title="Create account"
            onClick={onCreateAccount}
          >
            <PlusIcon className="size-4" />
            <span className="sr-only">Create account</span>
          </button>
        </span>
      </SidebarGroupLabel>
      <SidebarMenu>
        {sortedAccounts.map((account) => (
          <Collapsible
            key={account.id}
            asChild
            open={expandedAccountIds.has(account.id)}
            onOpenChange={(isOpen) => handleAccountExpandedChange(account.id, isOpen)}
            className="group/account"
          >
            <SidebarMenuItem className="py-0.5">
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <SidebarMenuButton
                    tooltip={account.name}
                    size="lg"
                    className="h-11 py-2"
                    isActive={account.id === activeAccountId}
                    onClick={() => onAccountSelect(account.id)}
                  >
                    {account.icon}
                    <div className="grid flex-1 gap-0.5 text-left">
                      <span className="truncate text-sm leading-4 font-medium">{account.name}</span>
                      <span className="truncate text-xs leading-3 text-muted-foreground">
                        {account.website || account.description}
                      </span>
                    </div>
                  </SidebarMenuButton>
                </ContextMenuTrigger>
                <CollapsibleTrigger asChild>
                  <SidebarMenuAction
                    aria-label={`Toggle ${account.name} opportunities`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <ChevronRightIcon className="transition-transform duration-200 group-data-[state=open]/account:rotate-90" />
                  </SidebarMenuAction>
                </CollapsibleTrigger>
                <ContextMenuContent className="w-56">
                  <ContextMenuLabel>{account.name}</ContextMenuLabel>
                  <ContextMenuItem onSelect={() => onAccountSelect(account.id)}>
                    <ExternalLinkIcon />
                    Open account
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => onEditAccount(account.id)}>
                    <PencilIcon />
                    Edit account fields
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => onCreateOpportunity(account.id)}>
                    <PlusIcon />
                    Add opportunity
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    variant="destructive"
                    onSelect={() => onDeleteAccount(account.id)}
                  >
                    <Trash2Icon />
                    Delete account
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {account.opportunities.map((opportunity) => (
                    <SidebarMenuSubItem key={opportunity.id}>
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <SidebarMenuSubButton
                            size="sm"
                            className="h-6 cursor-pointer text-muted-foreground data-[size=sm]:text-[11px] data-active:text-sidebar-accent-foreground [&>svg]:size-3 [&>svg]:text-muted-foreground"
                            isActive={opportunity.id === activeOpportunityId}
                            onClick={() => onOpportunitySelect(opportunity.id)}
                          >
                            <CircleDotIcon />
                            <span className="truncate">{opportunity.name}</span>
                          </SidebarMenuSubButton>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56">
                          <ContextMenuLabel>{opportunity.name}</ContextMenuLabel>
                          <ContextMenuItem onSelect={() => onOpportunitySelect(opportunity.id)}>
                            <TargetIcon />
                            Open opportunity
                          </ContextMenuItem>
                          <ContextMenuItem onSelect={() => onEditOpportunity(opportunity.id)}>
                            <PencilIcon />
                            Edit opportunity fields
                          </ContextMenuItem>
                          <ContextMenuItem onSelect={() => onAccountSelect(account.id)}>
                            <Building2Icon />
                            View account
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            variant="destructive"
                            onSelect={() => onDeleteOpportunity(opportunity.id)}
                          >
                            <Trash2Icon />
                            Delete opportunity
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
