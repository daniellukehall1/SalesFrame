import type * as React from "react"
import {
  BookOpenCheckIcon,
  LayoutDashboardIcon,
  MessageSquareTextIcon,
  TargetIcon,
} from "lucide-react"

import { getPlaybookIconComponent } from "@/data/playbook-icons"
import { NavMain, type NavMainItem } from "@/components/nav-main"
import { NavProjects, type AccountNavItem } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { WorkspaceSwitcher, type WorkspaceNavItem, type WorkspaceSavePayload } from "@/components/workspace-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuSkeleton,
  SidebarRail,
} from "@/components/ui/sidebar"

const sidebarPlaybookItems = [
  {
    id: "meddicc",
    title: "MEDDICC",
  },
  {
    id: "meddpicc",
    title: "MEDDPICC",
  },
  {
    id: "bant",
    title: "BANT",
  },
  {
    id: "force-management",
    title: "Force Management",
  },
  {
    id: "spin",
    title: "SPIN Selling",
  },
  {
    id: "sandler",
    title: "Sandler",
  },
  {
    id: "challenger",
    title: "The Challenger Sale",
  },
  {
    id: "gap-selling",
    title: "Gap Selling",
  },
  {
    id: "value-selling",
    title: "Value Selling",
  },
  {
    id: "strategic-selling",
    title: "Strategic Selling",
  },
  {
    id: "spiced",
    title: "SPICED",
  },
  {
    id: "custom",
    title: "Custom framework",
  },
]
  .sort((firstPlaybook, secondPlaybook) => firstPlaybook.title.localeCompare(secondPlaybook.title))
  .map((playbook) => {
    const Icon = getPlaybookIconComponent(playbook.id)

    return {
      ...playbook,
      icon: <Icon className="size-3.5 text-muted-foreground" />,
    }
  })

export function AppSidebar({
  accounts,
  activeAccountId,
  activeOpportunityId,
  activeWorkspaceId,
  activeView,
  workspaces,
  onAccountSelect,
  onCreateAccount,
  onCreateOpportunity,
  onCreateWorkspace,
  onDeleteAccount,
  onDeleteOpportunity,
  onDeleteWorkspace,
  onDuplicateWorkspace,
  onEditAccount,
  onEditOpportunity,
  onUpdateWorkspace,
  isWorkspaceLoading = false,
  onLogout,
  onNavigate,
  onOpportunitySelect,
  onWorkspaceChange,
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  accounts: AccountNavItem[]
  activeAccountId: string
  activeOpportunityId: string
  activeWorkspaceId: string
  activeView: string
  workspaces: WorkspaceNavItem[]
  onAccountSelect: (id: string) => void
  onCreateAccount: () => void
  onCreateOpportunity: (accountId: string) => void
  onCreateWorkspace: () => void
  onDeleteAccount: (id: string) => void
  onDeleteOpportunity: (id: string) => void
  onDeleteWorkspace: (workspaceId: string) => Promise<void>
  onDuplicateWorkspace: (workspace: WorkspaceNavItem) => Promise<WorkspaceNavItem>
  onEditAccount: (id: string) => void
  onEditOpportunity: (id: string) => void
  onUpdateWorkspace: (workspaceId: string, payload: WorkspaceSavePayload) => Promise<WorkspaceNavItem>
  isWorkspaceLoading?: boolean
  onLogout: () => void
  onNavigate: (id: string) => void
  onOpportunitySelect: (id: string) => void
  onWorkspaceChange: (workspace: WorkspaceNavItem) => void
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
  const navMain: NavMainItem[] = [
    {
      id: "home",
      title: "Home",
      icon: <LayoutDashboardIcon />,
      isActive: true,
    },
    {
      id: "opportunities",
      title: "Opportunities",
      icon: <TargetIcon />,
    },
    {
      id: "calls",
      title: "Calls",
      icon: <MessageSquareTextIcon />,
    },
    {
      id: "playbooks",
      title: "Playbooks",
      icon: <BookOpenCheckIcon />,
      items: sidebarPlaybookItems,
    },
  ]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <WorkspaceSwitcher
          activeWorkspaceId={activeWorkspaceId}
          workspaces={workspaces}
          onCreateWorkspace={onCreateWorkspace}
          onDeleteWorkspace={onDeleteWorkspace}
          onDuplicateWorkspace={onDuplicateWorkspace}
          onUpdateWorkspace={onUpdateWorkspace}
          onWorkspaceChange={onWorkspaceChange}
        />
      </SidebarHeader>
      <SidebarContent aria-busy={isWorkspaceLoading}>
        {isWorkspaceLoading ? (
          <SidebarWorkspaceSkeleton />
        ) : (
          <>
            <NavMain activeView={activeView} items={navMain} onNavigate={onNavigate} />
            <NavProjects
              accounts={accounts}
              activeAccountId={activeAccountId}
              activeOpportunityId={activeOpportunityId}
              onAccountSelect={onAccountSelect}
              onCreateAccount={onCreateAccount}
              onCreateOpportunity={onCreateOpportunity}
              onDeleteAccount={onDeleteAccount}
              onDeleteOpportunity={onDeleteOpportunity}
              onEditAccount={onEditAccount}
              onEditOpportunity={onEditOpportunity}
              onOpportunitySelect={onOpportunitySelect}
            />
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} onLogout={onLogout} onNavigate={onNavigate} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function SidebarWorkspaceSkeleton() {
  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Platform</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuSkeleton showIcon />
          <SidebarMenuSkeleton showIcon />
          <SidebarMenuSkeleton showIcon />
          <SidebarMenuSkeleton showIcon />
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Accounts</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuSkeleton showIcon className="h-10" />
          <div className="ml-6 grid gap-1 border-l px-2">
            <SidebarMenuSkeleton className="h-6" />
            <SidebarMenuSkeleton className="h-6" />
          </div>
          <SidebarMenuSkeleton showIcon className="h-10" />
          <div className="ml-6 grid gap-1 border-l px-2">
            <SidebarMenuSkeleton className="h-6" />
          </div>
          <SidebarMenuSkeleton showIcon className="h-10" />
        </SidebarMenu>
      </SidebarGroup>
    </>
  )
}
