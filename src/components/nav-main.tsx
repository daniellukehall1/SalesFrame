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
  useSidebar,
} from "@/components/ui/sidebar"
import { ChevronRightIcon } from "lucide-react"

export type NavMainItem = {
  id: string
  title: string
  icon?: React.ReactNode
  isActive?: boolean
  items?: {
    id: string
    icon?: React.ReactNode
    title: string
  }[]
}

export function NavMain({
  activeView,
  items,
  onNavigate,
}: {
  activeView: string
  items: NavMainItem[]
  onNavigate: (id: string) => void
}) {
  const { isMobile, setOpenMobile } = useSidebar()
  const handleNavigate = React.useCallback(
    (id: string) => {
      onNavigate(id)
      if (isMobile) setOpenMobile(false)
    },
    [isMobile, onNavigate, setOpenMobile]
  )

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const subItems = item.items ?? []
          const hasSubItems = subItems.length > 0

          if (!hasSubItems) {
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={activeView === item.id}
                  onClick={() => handleNavigate(item.id)}
                >
                  {item.icon}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          }

          return (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={item.isActive || subItems.some((subItem) => subItem.id === activeView)}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={activeView === item.id}
                  onClick={() => handleNavigate(item.id)}
                >
                  {item.icon}
                  <span>{item.title}</span>
                </SidebarMenuButton>
                <CollapsibleTrigger asChild>
                  <SidebarMenuAction
                    aria-label={`Toggle ${item.title} submenu`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <ChevronRightIcon className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuAction>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {subItems.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton
                          isActive={activeView === subItem.id}
                          onClick={() => handleNavigate(subItem.id)}
                        >
                          {subItem.icon}
                          <span>{subItem.title}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
