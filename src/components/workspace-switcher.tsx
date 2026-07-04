"use client"

import * as React from "react"
import {
  AudioLinesIcon,
  Building2Icon,
  CheckIcon,
  ChevronsUpDownIcon,
  CircleAlertIcon,
  CopyIcon,
  ExternalLinkIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DialogActions } from "@/components/ui/dialog-actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  currencyLabels,
  currencyOptions,
  defaultCurrencyCode,
  normalizeCurrencyCode,
  type CurrencyCode,
} from "@/lib/salesframe-core"
import { getUserFacingErrorMessage } from "@/lib/user-facing-errors"

export type WorkspaceNavItem = {
  id: string
  name: string
  description: string
  defaultCurrency: CurrencyCode
  onboardingCompletedAt?: string | null
  role: string
}

export type WorkspaceSavePayload = Pick<WorkspaceNavItem, "name" | "description" | "defaultCurrency">

function WorkspaceLogo({ workspace }: { workspace: WorkspaceNavItem }) {
  const Icon = workspace.name.toLowerCase() === "salesframe" ? AudioLinesIcon : Building2Icon

  return <Icon aria-hidden="true" className="size-4" />
}

function SalesFrameLogo() {
  return <AudioLinesIcon aria-hidden="true" className="size-4" />
}

export function WorkspaceSwitcher({
  activeWorkspaceId,
  onCreateWorkspace,
  onDeleteWorkspace,
  onDuplicateWorkspace,
  onUpdateWorkspace,
  onWorkspaceChange,
  workspaces,
}: {
  activeWorkspaceId: string
  onCreateWorkspace: () => void
  onDeleteWorkspace: (workspaceId: string) => Promise<void>
  onDuplicateWorkspace: (workspace: WorkspaceNavItem) => Promise<WorkspaceNavItem>
  onUpdateWorkspace: (workspaceId: string, payload: WorkspaceSavePayload) => Promise<WorkspaceNavItem>
  onWorkspaceChange?: (workspace: WorkspaceNavItem) => void
  workspaces: WorkspaceNavItem[]
}) {
  const { isMobile } = useSidebar()
  const [editingWorkspaceId, setEditingWorkspaceId] = React.useState<string | null>(null)
  const [deletingWorkspaceId, setDeletingWorkspaceId] = React.useState<string | null>(null)
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = React.useState(false)
  const [statusMessage, setStatusMessage] = React.useState("")
  const [isSaving, setIsSaving] = React.useState(false)

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0]
  const editingWorkspace = workspaces.find((workspace) => workspace.id === editingWorkspaceId) ?? null
  const deletingWorkspace = workspaces.find((workspace) => workspace.id === deletingWorkspaceId) ?? null

  const openCreateDialog = () => {
    setStatusMessage("")
    setEditingWorkspaceId(null)
    setWorkspaceMenuOpen(false)
    onCreateWorkspace()
  }

  const openEditDialog = (workspaceId: string) => {
    setStatusMessage("")
    setWorkspaceMenuOpen(false)
    setEditingWorkspaceId(workspaceId)
  }

  const selectWorkspace = (workspace: WorkspaceNavItem) => {
    if (workspace.id === activeWorkspaceId) return

    setWorkspaceMenuOpen(false)
    onWorkspaceChange?.(workspace)
  }

  const handleSaveWorkspace = async (payload: WorkspaceSavePayload) => {
    if (!editingWorkspace) return

    setIsSaving(true)
    setStatusMessage("")

    try {
      await onUpdateWorkspace(editingWorkspace.id, payload)

      setEditingWorkspaceId(null)
    } catch (error: unknown) {
      setStatusMessage(getUserFacingErrorMessage(error, "Workspace could not be saved."))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDuplicateWorkspace = async (workspace: WorkspaceNavItem) => {
    setWorkspaceMenuOpen(false)

    try {
      const duplicatedWorkspace = await onDuplicateWorkspace(workspace)
      onWorkspaceChange?.(duplicatedWorkspace)
    } catch (error: unknown) {
      setStatusMessage(getUserFacingErrorMessage(error, "Workspace could not be duplicated."))
    }
  }

  const handleDeleteWorkspace = async () => {
    if (!deletingWorkspace || workspaces.length <= 1) return

    const nextWorkspaces = workspaces.filter((workspace) => workspace.id !== deletingWorkspace.id)

    try {
      await onDeleteWorkspace(deletingWorkspace.id)
      if (activeWorkspaceId === deletingWorkspace.id) {
        const nextWorkspace = nextWorkspaces[0]

        if (nextWorkspace) {
          onWorkspaceChange?.(nextWorkspace)
        }
      }
      setDeletingWorkspaceId(null)
    } catch (error: unknown) {
      const message = getUserFacingErrorMessage(error, "Workspace could not be deleted.")
      setStatusMessage(message)
      throw new Error(message)
    }
  }

  if (!activeWorkspace) {
    return null
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu open={workspaceMenuOpen} onOpenChange={setWorkspaceMenuOpen}>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                aria-label={`Switch workspace, current workspace ${activeWorkspace.name}`}
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <SalesFrameLogo />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">SalesFrame</span>
                  <span className="truncate text-xs">{activeWorkspace.name}</span>
                </div>
                <ChevronsUpDownIcon className="ml-auto" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-fit"
              align="start"
              side={isMobile ? "bottom" : "right"}
              sideOffset={4}
            >
              <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
              {workspaces.map((workspace, index) => {
                const isActive = workspace.id === activeWorkspaceId

                return (
                  <ContextMenu key={workspace.id}>
                    <ContextMenuTrigger asChild>
                      <DropdownMenuItem
                        onSelect={() => selectWorkspace(workspace)}
                        className="gap-2 p-2"
                      >
                        <div className="flex size-6 items-center justify-center rounded-md border">
                          <WorkspaceLogo workspace={workspace} />
                        </div>
                        <div className="grid min-w-0 flex-1">
                          <span className="truncate">{workspace.name}</span>
                          <span className="truncate text-xs text-muted-foreground">{workspace.role}</span>
                        </div>
                        {isActive ? <CheckIcon className="ml-auto size-4" /> : <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>}
                      </DropdownMenuItem>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56">
                      <ContextMenuLabel>{workspace.name}</ContextMenuLabel>
                      <ContextMenuItem onSelect={() => selectWorkspace(workspace)}>
                        <ExternalLinkIcon />
                        Open workspace
                      </ContextMenuItem>
                      <ContextMenuItem onSelect={() => openEditDialog(workspace.id)}>
                        <PencilIcon />
                        Edit workspace details
                      </ContextMenuItem>
                      <ContextMenuItem onSelect={() => handleDuplicateWorkspace(workspace)}>
                        <CopyIcon />
                        Duplicate workspace
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        variant="destructive"
                        onSelect={() => {
                          setWorkspaceMenuOpen(false)
                          setDeletingWorkspaceId(workspace.id)
                        }}
                      >
                        <Trash2Icon />
                        Delete workspace
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                )
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 p-2"
                onSelect={(event) => {
                  event.preventDefault()
                  openCreateDialog()
                }}
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <PlusIcon className="size-4" />
                </div>
                <div className="font-medium">Create workspace</div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <WorkspaceFormDialog
        open={editingWorkspace !== null}
        workspace={editingWorkspace}
        onOpenChange={(open) => {
          if (!open) {
            setEditingWorkspaceId(null)
          }
        }}
        onSave={handleSaveWorkspace}
        isSaving={isSaving}
        statusMessage={statusMessage}
      />
      <DeleteWorkspaceDialog
        workspace={deletingWorkspace}
        workspaceCount={workspaces.length}
        onCancel={() => setDeletingWorkspaceId(null)}
        onConfirm={handleDeleteWorkspace}
      />
    </>
  )
}

function WorkspaceFormDialog({
  isSaving,
  open,
  statusMessage,
  workspace,
  onOpenChange,
  onSave,
}: {
  isSaving: boolean
  open: boolean
  statusMessage: string
  workspace: WorkspaceNavItem | null
  onOpenChange: (open: boolean) => void
  onSave: (payload: WorkspaceSavePayload) => void | Promise<void>
}) {
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [defaultCurrency, setDefaultCurrency] = React.useState<CurrencyCode>(defaultCurrencyCode)

  React.useEffect(() => {
    if (!open) return

    setName(workspace?.name ?? "")
    setDescription(workspace?.description ?? "Seller workspace")
    setDefaultCurrency(normalizeCurrencyCode(workspace?.defaultCurrency))
  }, [open, workspace])

  const canSave = name.trim().length > 0

  const handleSubmit = () => {
    if (!canSave) return

    onSave({
      name: name.trim(),
      description: description.trim() || "Seller workspace",
      defaultCurrency,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-sm:max-w-[calc(100%-0.75rem)] max-sm:[&_[data-slot=button]]:min-h-11 max-sm:[&_[data-slot=button]]:px-4 max-sm:[&_[data-slot=input]]:min-h-11 max-sm:[&_[data-slot=select-trigger]]:min-h-11 sm:max-w-md"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Edit workspace</DialogTitle>
          <DialogDescription>
            Workspaces group the seller's accounts, opportunities, calls, settings, and data access.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="workspace-name">Workspace name</Label>
            <Input
              id="workspace-name"
              value={name}
              placeholder="e.g. ANZ Enterprise"
              onChange={(event) => setName(event.currentTarget.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="workspace-description">Description</Label>
            <Input
              id="workspace-description"
              value={description}
              placeholder="Seller workspace"
              onChange={(event) => setDescription(event.currentTarget.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="workspace-currency">Default currency</Label>
            <Select value={defaultCurrency} onValueChange={(value) => setDefaultCurrency(normalizeCurrencyCode(value))}>
              <SelectTrigger id="workspace-currency" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencyOptions.map((currency) => (
                  <SelectItem key={currency} value={currency}>
                    {currencyLabels[currency]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {statusMessage ? (
            <p className="text-sm text-destructive" aria-live="assertive" role="alert">
              {statusMessage}
            </p>
          ) : null}
        </div>
        <DialogActions
          onCancel={() => onOpenChange(false)}
          primaryAction={
            <Button className="gap-2" disabled={!canSave || isSaving} onClick={handleSubmit}>
              <Building2Icon />
              {isSaving ? "Saving..." : "Save workspace"}
            </Button>
          }
        />
      </DialogContent>
    </Dialog>
  )
}

function DeleteWorkspaceDialog({
  workspace,
  workspaceCount,
  onCancel,
  onConfirm,
}: {
  workspace: WorkspaceNavItem | null
  workspaceCount: number
  onCancel: () => void
  onConfirm: () => Promise<void> | void
}) {
  const [deleteError, setDeleteError] = React.useState("")
  const [deleteSubmitting, setDeleteSubmitting] = React.useState(false)

  React.useEffect(() => {
    setDeleteError("")
    setDeleteSubmitting(false)
  }, [workspace?.id])

  if (!workspace) return null
  const isLastWorkspace = workspaceCount <= 1

  const handleDelete = async () => {
    if (isLastWorkspace || deleteSubmitting) return

    setDeleteError("")
    setDeleteSubmitting(true)

    try {
      await onConfirm()
    } catch (error: unknown) {
      setDeleteError(getUserFacingErrorMessage(error, "Workspace could not be deleted."))
      setDeleteSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(nextOpen) => (!nextOpen && !deleteSubmitting ? onCancel() : undefined)}>
      <DialogContent
        className="max-sm:max-w-[calc(100%-0.75rem)] max-sm:[&_[data-slot=button]]:min-h-11 max-sm:[&_[data-slot=button]]:px-4 sm:max-w-md"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <CircleAlertIcon className="size-5" />
          </div>
          <DialogTitle>Delete workspace</DialogTitle>
          <DialogDescription>
            This removes the workspace from your account, including its accounts, opportunities, calls, and settings.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-sm font-medium">{workspace.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{workspace.description}</p>
        </div>
        {isLastWorkspace ? (
          <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
            Create another workspace before deleting this one. SalesFrame keeps one workspace so your account has somewhere to store accounts, calls, and settings.
          </p>
        ) : null}
        {deleteError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {deleteError}
          </div>
        ) : null}
        <DialogActions
          cancelDisabled={deleteSubmitting}
          onCancel={onCancel}
          primaryAction={
            <Button variant="destructive" disabled={isLastWorkspace || deleteSubmitting} onClick={handleDelete}>
              {deleteSubmitting ? "Deleting..." : "Delete workspace"}
            </Button>
          }
        />
      </DialogContent>
    </Dialog>
  )
}
