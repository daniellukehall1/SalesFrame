import * as React from "react"
import {
  ArchiveIcon,
  BookOpenCheckIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleStopIcon,
  ContactRoundIcon,
  FileTextIcon,
  FolderKanbanIcon,
  LayoutGridIcon,
  MessageSquareTextIcon,
  MicIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  Settings2Icon,
  TargetIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { AssistantActionChip } from "@/components/assistant-action-chip"
import { AssistantArtifactPreview } from "@/components/assistant-artifact"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Message,
  MessageContent,
  MessageFooter,
  MessageGroup,
} from "@/components/ui/message"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  ASSISTANT_CAPABILITIES,
  hasAssistantCapabilityContext,
} from "@/lib/assistant-capabilities"
import type {
  AssistantActionProposal,
  AssistantArtifact,
  AssistantArtifactAction,
  AssistantActionTarget,
  AssistantBriefing,
  AssistantCapability,
  AssistantCapabilityGroup,
  AssistantContextualAction,
  AssistantMessage as AssistantMessageRecord,
  AssistantMessageReference,
  AssistantRouteContext,
  AssistantThreadSummary,
  AssistantVoiceInput,
} from "@/lib/assistant-types"
import { cn } from "@/lib/utils"

export type ConversationCanvas = {
  id: string
  title: string
  description?: string
  content: React.ReactNode
  footer?: React.ReactNode
}

export type ConversationWorkspaceProps = {
  workspaceName: string
  workingContextLabel?: string
  userName?: string
  routeContext: AssistantRouteContext
  threads: AssistantThreadSummary[]
  activeThreadId: string
  messages: AssistantMessageRecord[]
  briefing: AssistantBriefing
  contextualActions?: AssistantContextualAction[]
  capabilities?: readonly AssistantCapability[]
  proposal?: AssistantActionProposal | null
  canvas?: ConversationCanvas | null
  completedMessageId?: string
  assistantStatus?: string
  assistantUnavailableMessage?: string
  artifactActionError?: { artifactId: string; message: string } | null
  isResponding?: boolean
  isLoadingMessages?: boolean
  isComposerDisabled?: boolean
  voice?: AssistantVoiceInput
  draftText?: string
  composerPlaceholder?: string
  onDraftTextChange?: (value: string) => void
  onSubmit: (text: string) => void | boolean | Promise<void | boolean>
  onInvokeCapability: (
    capabilityId: string,
    source: "briefing" | "contextual" | "all_actions" | "finding",
    target?: AssistantActionTarget
  ) => void
  onOpenReference?: (reference: AssistantMessageReference) => void
  onOpenArtifact?: (artifact: AssistantArtifact) => void
  onArtifactAction?: (
    artifact: AssistantArtifact,
    action: AssistantArtifactAction
  ) => void | Promise<void>
  onSelectThread: (threadId: string) => void
  onNewThread: () => void | Promise<void>
  onRenameThread?: (threadId: string, title: string) => void | Promise<void>
  onArchiveThread?: (threadId: string) => void | Promise<void>
  onDeleteThread?: (threadId: string) => void | Promise<void>
  onConfirmProposal?: (proposalId: string) => void | Promise<void>
  onCancelProposal?: (proposalId: string) => void | Promise<void>
  onStopResponse?: () => void
  onCloseCanvas?: () => void
  onOpenWorkspaceSwitcher?: () => void
  onSwitchToWorkspaceView: () => void
}

const capabilityGroupLabels: Record<AssistantCapabilityGroup, string> = {
  workspace: "Workspace",
  accounts: "Accounts",
  contacts: "Contacts",
  opportunities: "Opportunities",
  calls: "Calls",
  playbooks: "Playbooks",
  settings: "Settings",
}

const capabilityGroupIcons = {
  workspace: FolderKanbanIcon,
  accounts: LayoutGridIcon,
  contacts: ContactRoundIcon,
  opportunities: TargetIcon,
  calls: MessageSquareTextIcon,
  playbooks: BookOpenCheckIcon,
  settings: Settings2Icon,
} satisfies Record<AssistantCapabilityGroup, React.ComponentType<{ className?: string }>>

export function ConversationWorkspace({
  workspaceName,
  workingContextLabel,
  userName,
  routeContext,
  threads,
  activeThreadId,
  messages,
  briefing,
  contextualActions = [],
  capabilities = ASSISTANT_CAPABILITIES,
  proposal,
  canvas,
  completedMessageId,
  assistantStatus,
  assistantUnavailableMessage,
  artifactActionError,
  isResponding = false,
  isLoadingMessages = false,
  isComposerDisabled = false,
  voice,
  draftText,
  composerPlaceholder = "Ask SalesFrame anything…",
  onDraftTextChange,
  onSubmit,
  onInvokeCapability,
  onOpenReference,
  onOpenArtifact,
  onArtifactAction,
  onSelectThread,
  onNewThread,
  onRenameThread,
  onArchiveThread,
  onDeleteThread,
  onConfirmProposal,
  onCancelProposal,
  onStopResponse,
  onCloseCanvas,
  onOpenWorkspaceSwitcher,
  onSwitchToWorkspaceView,
}: ConversationWorkspaceProps) {
  const isMobile = useIsMobile()
  const useCanvasOverlay = useCompactConversationSurface()
  const [internalDrafts, setInternalDrafts] = React.useState<Record<string, string>>({})
  const [threadsOpen, setThreadsOpen] = React.useState(false)
  const [actionsOpen, setActionsOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [dismissedContextLabel, setDismissedContextLabel] = React.useState("")
  const lastAppliedVoiceTranscriptRef = React.useRef("")
  const conversationEndRef = React.useRef<HTMLDivElement | null>(null)
  const threadsTriggerRef = React.useRef<HTMLButtonElement | null>(null)
  const actionsTriggerRef = React.useRef<HTMLButtonElement | null>(null)
  const actionsShouldRestoreFocusRef = React.useRef(true)
  const draftContextKey = `${routeContext.workspaceId ?? "workspace"}:${activeThreadId || "opening"}`
  const draftContextKeyRef = React.useRef(draftContextKey)
  const previousDraftContextKeyRef = React.useRef(draftContextKey)
  const draft = draftText ?? internalDrafts[draftContextKey] ?? ""
  draftContextKeyRef.current = draftContextKey

  const setDraft = React.useCallback(
    (value: string) => {
      if (draftText === undefined) {
        setInternalDrafts((current) => {
          if (!value) {
            if (!(draftContextKey in current)) return current
            const next = { ...current }
            delete next[draftContextKey]
            return next
          }
          return current[draftContextKey] === value
            ? current
            : { ...current, [draftContextKey]: value }
        })
      }
      onDraftTextChange?.(value)
    },
    [draftContextKey, draftText, onDraftTextChange]
  )

  React.useEffect(() => {
    if (previousDraftContextKeyRef.current === draftContextKey) return
    previousDraftContextKeyRef.current = draftContextKey
    lastAppliedVoiceTranscriptRef.current = voice?.transcript?.trim() ?? ""
    if (voice && (voice.state !== "idle" || voice.transcript?.trim())) voice.onDiscard?.()
  }, [draftContextKey, voice?.onDiscard, voice?.state, voice?.transcript])

  React.useEffect(() => {
    const finalTranscript = voice?.state === "idle" ? voice.transcript?.trim() : ""
    if (!finalTranscript || lastAppliedVoiceTranscriptRef.current === finalTranscript) return
    lastAppliedVoiceTranscriptRef.current = finalTranscript
    setDraft([draft.trim(), finalTranscript].filter(Boolean).join(" "))
  }, [draft, setDraft, voice?.state, voice?.transcript])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || isResponding || isSubmitting) return
    const submittedDraftContextKey = draftContextKeyRef.current

    setIsSubmitting(true)
    setDraft("")
    try {
      const submitted = await onSubmit(text)
      if (submitted === false) {
        if (draftContextKeyRef.current === submittedDraftContextKey) setDraft(text)
        return
      }
      lastAppliedVoiceTranscriptRef.current = ""
      voice?.onDiscard?.()
    } catch {
      if (draftContextKeyRef.current === submittedDraftContextKey) setDraft(text)
    } finally {
      setIsSubmitting(false)
    }
  }

  const visibleContextualActions = contextualActions.slice(0, 4)
  const showContextualActions =
    visibleContextualActions.length > 0 &&
    !proposal &&
    !isResponding &&
    !artifactActionError &&
    (messages.length > 0 || briefing.actions.length === 0)
  const isBusy = isResponding || isSubmitting || isComposerDisabled
  const canvasIsInline = Boolean(canvas && !useCanvasOverlay)
  const visibleWorkingContextLabel =
    workingContextLabel && dismissedContextLabel !== workingContextLabel ? workingContextLabel : undefined

  const latestMessageId = messages.at(-1)?.id ?? ""
  React.useEffect(() => {
    if (isLoadingMessages) return
    conversationEndRef.current?.scrollIntoView({ block: "end" })
  }, [activeThreadId, isLoadingMessages, latestMessageId, messages.length])

  return (
    <div
      className={cn(
        "grid h-full min-h-0 w-full min-w-0 overflow-hidden bg-background",
        canvasIsInline ? "grid-cols-[minmax(280px,320px)_minmax(0,1fr)]" : "grid-cols-1"
      )}
      data-interface-mode="conversation"
      data-testid="conversation-workspace"
    >
      <h1 className="sr-only">SalesFrame conversation mode</h1>
      <main
        id="salesframe-conversation"
        className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        aria-label="SalesFrame conversation"
        tabIndex={-1}
      >
        <ConversationHeader
          workspaceName={workspaceName}
          onOpenWorkspaceSwitcher={onOpenWorkspaceSwitcher}
          actionsTriggerRef={actionsTriggerRef}
          threadsTriggerRef={threadsTriggerRef}
          onOpenThreads={() => setThreadsOpen(true)}
          onOpenActions={() => {
            actionsShouldRestoreFocusRef.current = true
            setActionsOpen(true)
          }}
          onSwitchToWorkspaceView={onSwitchToWorkspaceView}
        />

        <ScrollArea className="min-h-0 flex-1" data-testid="conversation-scroll-area">
          <div className={cn(
            "mx-auto flex w-full min-w-0 flex-col px-4",
            canvasIsInline ? "max-w-none gap-4 py-4" : "max-w-4xl gap-5 py-5 sm:px-6 sm:py-6"
          )}>
            {messages.length === 0 && !isLoadingMessages ? (
              <ConversationBriefingView
                briefing={briefing}
                userName={userName}
                onInvokeCapability={onInvokeCapability}
              />
            ) : null}

            <ConversationMessages
              key={activeThreadId}
              completedMessageId={completedMessageId}
              messages={messages}
              isLoading={isLoadingMessages}
              isResponding={isResponding}
              onOpenReference={onOpenReference}
              onOpenArtifact={onOpenArtifact}
              onArtifactAction={onArtifactAction}
              artifactActionError={artifactActionError}
            />

            {showContextualActions ? (
              <ContextualActions
                actions={visibleContextualActions}
                onInvokeCapability={onInvokeCapability}
              />
            ) : null}

            {assistantUnavailableMessage ? (
              <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground" role="status">
                {assistantUnavailableMessage}
              </div>
            ) : null}

            <div ref={conversationEndRef} aria-hidden="true" />
          </div>
        </ScrollArea>

        {proposal ? (
          <div className="max-h-[42dvh] shrink-0 overflow-x-hidden overflow-y-auto border-t bg-background px-3 py-2.5 sm:px-4">
            <div className="mx-auto w-full max-w-4xl min-w-0">
              <ProposalPreview
                key={proposal.id}
                proposal={proposal}
                onCancel={onCancelProposal}
                onConfirm={onConfirmProposal}
              />
            </div>
          </div>
        ) : null}

        <ConversationComposer
          draft={draft}
          placeholder={composerPlaceholder}
          status={assistantStatus}
          isBusy={isBusy}
          isResponding={isResponding}
          workingContextLabel={visibleWorkingContextLabel}
          voice={voice}
          onDismissWorkingContext={visibleWorkingContextLabel
            ? () => setDismissedContextLabel(visibleWorkingContextLabel)
            : undefined}
          onDraftChange={setDraft}
          onStopResponse={onStopResponse}
          onSubmit={handleSubmit}
        />
      </main>

      {canvas && canvasIsInline ? (
        <DesktopCanvas canvas={canvas} onClose={onCloseCanvas} />
      ) : null}

      <ThreadsOverlay
        open={threadsOpen}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          threadsTriggerRef.current?.focus({ preventScroll: true })
        }}
        onOpenChange={setThreadsOpen}
        isMobile={isMobile}
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={onSelectThread}
        onNewThread={onNewThread}
        onRenameThread={onRenameThread}
        onArchiveThread={onArchiveThread}
        onDeleteThread={onDeleteThread}
      />

      <AllActionsOverlay
        open={actionsOpen}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (actionsShouldRestoreFocusRef.current) {
            actionsTriggerRef.current?.focus({ preventScroll: true })
          }
          actionsShouldRestoreFocusRef.current = true
        }}
        onOpenChange={setActionsOpen}
        isMobile={isMobile}
        capabilities={capabilities}
        routeContext={routeContext}
        onInvoke={(capabilityId) => {
          actionsShouldRestoreFocusRef.current = capabilityId === "settings.theme"
          setActionsOpen(false)
          onInvokeCapability(capabilityId, "all_actions")
        }}
      />

      {canvas && useCanvasOverlay ? (
        <MobileCanvas canvas={canvas} onClose={onCloseCanvas} />
      ) : null}
    </div>
  )
}

function ConversationHeader({
  workspaceName,
  actionsTriggerRef,
  threadsTriggerRef,
  onOpenWorkspaceSwitcher,
  onOpenThreads,
  onOpenActions,
  onSwitchToWorkspaceView,
}: {
  workspaceName: string
  actionsTriggerRef: React.RefObject<HTMLButtonElement | null>
  threadsTriggerRef: React.RefObject<HTMLButtonElement | null>
  onOpenWorkspaceSwitcher?: () => void
  onOpenThreads: () => void
  onOpenActions: () => void
  onSwitchToWorkspaceView: () => void
}) {
  return (
    <header className="flex min-h-14 min-w-0 shrink-0 items-center gap-1.5 border-b px-2 sm:gap-2 sm:px-4">
      <Button
        variant="ghost"
        className="min-w-0 flex-1 !shrink justify-start px-2"
        aria-label={`Current workspace: ${workspaceName}`}
        aria-haspopup={onOpenWorkspaceSwitcher ? "dialog" : undefined}
        onClick={onOpenWorkspaceSwitcher}
        disabled={!onOpenWorkspaceSwitcher}
      >
        <span className="truncate">{workspaceName}</span>
        {onOpenWorkspaceSwitcher ? <ChevronDownIcon aria-hidden="true" /> : null}
      </Button>

      <Button ref={threadsTriggerRef} variant="ghost" size="icon" onClick={onOpenThreads} aria-label="Open conversations">
        <MessageSquareTextIcon />
      </Button>

      <Button ref={actionsTriggerRef} variant="ghost" size="icon" onClick={onOpenActions} aria-label="Open all actions">
        <SearchIcon />
      </Button>
      <Button variant="outline" size="icon" onClick={onSwitchToWorkspaceView} aria-label="Switch to workspace view">
        <LayoutGridIcon />
      </Button>
    </header>
  )
}

function ConversationBriefingView({
  briefing,
  userName,
  onInvokeCapability,
}: {
  briefing: AssistantBriefing
  userName?: string
  onInvokeCapability: ConversationWorkspaceProps["onInvokeCapability"]
}) {
  return (
    <section className="grid min-w-0 gap-4" aria-labelledby="conversation-briefing-title">
      <div className="grid gap-1.5">
        <p className="text-sm text-muted-foreground">{userName ? `Good ${getDayPeriod()}, ${firstName(userName)}.` : "Welcome back."}</p>
        <h2 id="conversation-briefing-title" className="text-balance text-xl font-medium tracking-tight sm:text-2xl">
          {briefing.title}
        </h2>
        <p className="max-w-2xl text-pretty text-sm leading-5 text-muted-foreground">
          {briefing.description}
        </p>
      </div>

      {briefing.findings.length > 0 ? (
        <div className="grid divide-y rounded-lg border" aria-label="Workspace briefing">
          {briefing.findings.slice(0, 3).map((finding) => {
            const content = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-foreground">{finding.title}</span>
                  {finding.detail ? <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">{finding.detail}</span> : null}
                </span>
                {finding.capabilityId ? <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
              </>
            )

            return finding.capabilityId ? (
              <button
                key={finding.id}
                type="button"
                className="flex min-h-12 w-full min-w-0 items-center gap-2.5 px-3 py-2.5 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
                onClick={() => onInvokeCapability(finding.capabilityId!, "finding")}
              >
                {content}
              </button>
            ) : (
              <div key={finding.id} className="flex min-h-12 min-w-0 items-center gap-2.5 px-3 py-2.5">
                {content}
              </div>
            )
          })}
        </div>
      ) : null}

      {briefing.actions.length > 0 ? (
        <ConversationActionStrip
          actions={briefing.actions.slice(0, 4)}
          label="Suggested actions"
          onInvoke={(action) => onInvokeCapability(action.capabilityId, "briefing")}
        />
      ) : null}
    </section>
  )
}

function ConversationMessages({
  artifactActionError,
  completedMessageId,
  messages,
  isLoading,
  isResponding,
  onOpenReference,
  onOpenArtifact,
  onArtifactAction,
}: {
  artifactActionError?: { artifactId: string; message: string } | null
  completedMessageId?: string
  messages: AssistantMessageRecord[]
  isLoading: boolean
  isResponding: boolean
  onOpenReference?: (reference: AssistantMessageReference) => void
  onOpenArtifact?: (artifact: AssistantArtifact) => void
  onArtifactAction?: (
    artifact: AssistantArtifact,
    action: AssistantArtifactAction
  ) => void | Promise<void>
}) {
  const announcedCompletionIdRef = React.useRef("")
  const [completionAnnouncement, setCompletionAnnouncement] = React.useState<{
    id: string
    text: string
  } | null>(null)
  React.useEffect(() => {
    if (!completedMessageId) {
      announcedCompletionIdRef.current = ""
      setCompletionAnnouncement(null)
      return
    }
    if (announcedCompletionIdRef.current === completedMessageId) return
    const completedMessage = messages.find((message) =>
      message.id === completedMessageId && message.role === "assistant" && message.text.trim()
    )
    if (!completedMessage) return

    announcedCompletionIdRef.current = completedMessageId
    setCompletionAnnouncement({
      id: completedMessage.id,
      text: completedMessage.text,
    })
  }, [completedMessageId, messages])

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
        Opening this conversation…
      </p>
    )
  }

  if (messages.length === 0 && !isResponding) return null

  return (
    <>
      <MessageGroup
        className="gap-4"
        aria-label="Conversation messages"
        aria-live="off"
        role="log"
      >
        {messages.map((message) => {
          if (message.role === "status") {
            return (
              <p key={message.id} className="text-sm text-muted-foreground" role="status">
                {message.text}
              </p>
            )
          }

          const fromSeller = message.role === "user"
          return (
            <Message key={message.id} align={fromSeller ? "end" : "start"}>
              <MessageContent className={fromSeller ? "max-w-[88%] sm:max-w-[75%]" : "max-w-full"}>
                <span className="sr-only">{fromSeller ? "You said:" : "SalesFrame replied:"}</span>
                <Bubble variant={fromSeller ? "secondary" : "ghost"} align={fromSeller ? "end" : "start"}>
                  <BubbleContent className={fromSeller ? "whitespace-pre-wrap" : "whitespace-pre-wrap text-[0.925rem] leading-6"}>
                    {message.text}
                  </BubbleContent>
                </Bubble>
                {message.references?.length ? (
                  <MessageFooter className="flex-wrap gap-1.5 px-0" aria-label="Sources and related records">
                    {message.references.map((reference) => (
                      <Button
                        key={reference.id}
                        variant="ghost"
                        size="xs"
                        className="max-w-full text-muted-foreground"
                        onClick={() => onOpenReference?.(reference)}
                        disabled={!onOpenReference}
                      >
                        <FileTextIcon data-icon="inline-start" />
                        <span className="truncate">{reference.label}</span>
                      </Button>
                    ))}
                  </MessageFooter>
                ) : null}
                {message.artifacts?.map((artifact) => (
                  <AssistantArtifactPreview
                    key={artifact.id}
                    actionError={artifactActionError?.artifactId === artifact.id ? artifactActionError.message : undefined}
                    artifact={artifact}
                    onAction={onArtifactAction}
                    onOpen={onOpenArtifact}
                  />
                ))}
              </MessageContent>
            </Message>
          )
        })}
        {isResponding ? (
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
            SalesFrame is thinking…
          </p>
        ) : null}
      </MessageGroup>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {completionAnnouncement ? (
          <span key={completionAnnouncement.id}>
            SalesFrame replied: {completionAnnouncement.text}
          </span>
        ) : null}
      </p>
    </>
  )
}

function ContextualActions({
  actions,
  onInvokeCapability,
}: {
  actions: AssistantContextualAction[]
  onInvokeCapability: ConversationWorkspaceProps["onInvokeCapability"]
}) {
  return (
    <ConversationActionStrip
      actions={actions}
      label="Relevant actions"
      testId="conversation-contextual-actions"
      onInvoke={(action) => onInvokeCapability(action.capabilityId, "contextual")}
    />
  )
}

function ConversationActionStrip({
  actions,
  label,
  onInvoke,
  testId,
}: {
  actions: AssistantContextualAction[]
  label: string
  onInvoke: (action: AssistantContextualAction) => void
  testId?: string
}) {
  const primaryAction = actions[0]
  const remainingActions = actions.slice(1)
  if (!primaryAction) return null

  return (
    <div
      className="flex min-h-11 min-w-0 flex-wrap items-center gap-x-1.5 gap-y-3"
      aria-label={label}
      data-testid={testId}
    >
      <AssistantActionChip
        tone={primaryAction.emphasis === "quiet" ? "secondary" : "primary"}
        disabled={primaryAction.disabled}
        onClick={() => onInvoke(primaryAction)}
      >
        {primaryAction.label}
      </AssistantActionChip>
      {remainingActions.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <AssistantActionChip icon="more" tone="quiet" aria-label={`More ${label.toLocaleLowerCase()}`}>
              More
            </AssistantActionChip>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {remainingActions.map((action) => (
              <DropdownMenuItem
                key={action.id}
                disabled={action.disabled}
                onSelect={() => onInvoke(action)}
              >
                <span className="min-w-0 flex-1 truncate">{action.label}</span>
                <ChevronRightIcon className="text-muted-foreground" aria-hidden="true" />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}

function ProposalPreview({
  proposal,
  onConfirm,
  onCancel,
}: {
  proposal: AssistantActionProposal
  onConfirm?: (proposalId: string) => void | Promise<void>
  onCancel?: (proposalId: string) => void | Promise<void>
}) {
  const isConfirming = proposal.state === "confirming"
  const expiresAtMs = new Date(proposal.expiresAt).getTime()
  const [isExpired, setIsExpired] = React.useState(() =>
    !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()
  )

  React.useEffect(() => {
    if (!Number.isFinite(expiresAtMs)) {
      setIsExpired(true)
      return
    }

    const remainingMs = expiresAtMs - Date.now()
    if (remainingMs <= 0) {
      setIsExpired(true)
      return
    }

    setIsExpired(false)
    const timerId = window.setTimeout(() => setIsExpired(true), Math.min(remainingMs, 2_147_000_000))
    return () => window.clearTimeout(timerId)
  }, [expiresAtMs])

  const riskCopy = proposal.risk === "destructive"
    ? "This cannot be undone. Review the details before confirming."
    : proposal.risk === "costed"
      ? "This starts a paid background action. Nothing will happen until you confirm."
      : "Nothing will change until you confirm."

  return (
    <section className="min-w-0 rounded-lg border bg-muted/20 p-3" aria-labelledby={`proposal-${proposal.id}`} role="region">
      <div className="grid gap-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Review change</p>
        <h2 id={`proposal-${proposal.id}`} className="text-base font-medium">{proposal.summary}</h2>
        <p className="text-sm leading-5 text-muted-foreground">{riskCopy}</p>
      </div>

      {proposal.fields.length > 0 ? (
        <dl className="mt-3 grid min-w-0 gap-x-5 gap-y-2.5 border-y py-3 sm:grid-cols-2">
          {proposal.fields.map((field, index) => (
            <div key={`${field.label}-${index}`} className="min-w-0">
              <dt className="text-xs font-medium text-muted-foreground">{field.label}</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {proposal.errorMessage ? (
        <p className="mt-3 text-sm text-destructive" role="alert">{proposal.errorMessage}</p>
      ) : null}

      {isExpired ? (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          This change expired. Ask SalesFrame to prepare it again.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => onCancel?.(proposal.id)} disabled={isConfirming || !onCancel}>
          {isExpired ? "Dismiss" : "Cancel"}
        </Button>
        <Button
          variant={proposal.risk === "destructive" ? "destructive" : "default"}
          onClick={() => onConfirm?.(proposal.id)}
          disabled={isConfirming || isExpired || !onConfirm}
        >
          <CheckIcon data-icon="inline-start" />
          {isConfirming ? "Confirming…" : "Confirm"}
        </Button>
      </div>
    </section>
  )
}

function ConversationComposer({
  draft,
  placeholder,
  status,
  isBusy,
  isResponding,
  workingContextLabel,
  voice,
  onDismissWorkingContext,
  onDraftChange,
  onStopResponse,
  onSubmit,
}: {
  draft: string
  placeholder: string
  status?: string
  isBusy: boolean
  isResponding: boolean
  workingContextLabel?: string
  voice?: AssistantVoiceInput
  onDismissWorkingContext?: () => void
  onDraftChange: (value: string) => void
  onStopResponse?: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  const statusId = React.useId()
  const composerInputRef = React.useRef<HTMLInputElement | null>(null)
  const restoreComposerFocusRef = React.useRef(false)
  const voiceActive = voice?.state === "listening"
  const voiceRequesting = voice?.state === "requesting"
  const voiceBusy = voice?.state === "transcribing"
  const visibleStatus = voice?.state === "error"
    ? voice.errorMessage ?? "Voice input is unavailable. You can keep typing."
    : voice?.statusText ?? status

  React.useEffect(() => {
    if (isResponding || !restoreComposerFocusRef.current) return
    restoreComposerFocusRef.current = false
    composerInputRef.current?.focus({ preventScroll: true })
  }, [isResponding])

  return (
    <div className="shrink-0 border-t bg-background px-3 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] sm:px-5 sm:pb-3">
      <form className="mx-auto w-full max-w-4xl min-w-0" onSubmit={onSubmit}>
        {workingContextLabel ? (
          <div className="mb-2 flex min-h-8 min-w-0 items-center" data-testid="conversation-working-context">
            <div className="inline-flex min-w-0 max-w-full items-center rounded-full bg-muted/60 pl-2.5 text-xs text-muted-foreground">
              <span className="shrink-0">Working in</span>
              <span className="ml-1 min-w-0 truncate font-medium text-foreground" title={workingContextLabel}>
                {workingContextLabel}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="relative ml-0.5 !size-7 shrink-0 rounded-full after:absolute after:-inset-2 after:content-[''] sm:after:inset-0"
                aria-label={`Dismiss working context: ${workingContextLabel}`}
                onClick={onDismissWorkingContext}
              >
                <XIcon />
              </Button>
            </div>
          </div>
        ) : null}
        <div className="flex min-w-0 items-center gap-1 rounded-2xl border bg-background p-2 shadow-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30 sm:gap-2">
          <Input
            ref={composerInputRef}
            type="text"
            value={draft}
            readOnly={isBusy}
            aria-busy={isBusy}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.nativeEvent.isComposing) return
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }}
            placeholder={placeholder}
            aria-label="Message SalesFrame"
            aria-describedby={statusId}
            autoComplete="off"
            enterKeyHint="send"
            className="h-11 min-h-11 min-w-0 flex-1 truncate border-0 bg-transparent px-2.5 text-base shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
          />

          {voice ? (
            <Button
              type="button"
              variant={voiceActive ? "secondary" : "ghost"}
              size="icon"
              className="h-11 min-h-11 w-11 min-w-11 shrink-0"
              disabled={voiceBusy || isBusy || (voiceRequesting && !voice.onDiscard)}
              aria-label={voiceActive ? "Stop voice input" : voiceRequesting ? "Cancel voice input" : "Start voice input"}
              aria-pressed={voiceActive}
              onClick={() => {
                if (voiceActive) void voice.onStop()
                else if (voiceRequesting) voice.onDiscard?.()
                else void voice.onStart()
              }}
            >
              {voiceActive ? <CircleStopIcon aria-hidden="true" /> : voiceRequesting ? <XIcon aria-hidden="true" /> : <MicIcon aria-hidden="true" />}
            </Button>
          ) : null}

          {isResponding && onStopResponse ? (
            <Button
              type="button"
              variant="ghost"
              className="h-11 min-h-11 w-11 min-w-11 shrink-0 px-0 sm:w-auto sm:px-3"
              aria-label="Stop response"
              title="Stop response"
              onClick={() => {
                restoreComposerFocusRef.current = true
                onStopResponse()
              }}
            >
              <CircleStopIcon aria-hidden="true" />
              <span className="hidden sm:inline">Stop response</span>
            </Button>
          ) : (
            <Button type="submit" size="icon" className="h-11 min-h-11 w-11 min-w-11 shrink-0" disabled={!draft.trim() || isBusy} aria-label="Send message">
              <SendIcon aria-hidden="true" />
            </Button>
          )}
        </div>
        <div
          id={statusId}
          className={cn(visibleStatus ? "mt-1.5 min-h-5 px-1 text-xs text-muted-foreground" : "sr-only")}
          role="status"
          aria-live="polite"
        >
          {visibleStatus ?? "SalesFrame will ask before it changes anything."}
        </div>
      </form>
    </div>
  )
}

function ThreadsOverlay({
  open,
  onCloseAutoFocus,
  onOpenChange,
  isMobile,
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
  onRenameThread,
  onArchiveThread,
  onDeleteThread,
}: {
  open: boolean
  onCloseAutoFocus: NonNullable<React.ComponentProps<typeof DrawerContent>["onCloseAutoFocus"]>
  onOpenChange: (open: boolean) => void
  isMobile: boolean
  threads: AssistantThreadSummary[]
  activeThreadId: string
  onSelectThread: (threadId: string) => void
  onNewThread: () => void | Promise<void>
  onRenameThread?: (threadId: string, title: string) => void | Promise<void>
  onArchiveThread?: (threadId: string) => void | Promise<void>
  onDeleteThread?: (threadId: string) => void | Promise<void>
}) {
  const content = (
    <ThreadsPanel
      titleKind={isMobile ? "drawer" : "sheet"}
      threads={threads}
      activeThreadId={activeThreadId}
      onClose={() => onOpenChange(false)}
      onSelectThread={onSelectThread}
      onNewThread={onNewThread}
      onRenameThread={onRenameThread}
      onArchiveThread={onArchiveThread}
      onDeleteThread={onDeleteThread}
    />
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
        <DrawerContent onCloseAutoFocus={onCloseAutoFocus} className="h-[min(620px,92dvh)] max-h-[92dvh] overflow-hidden text-left">
          <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] overflow-hidden">{content}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent onCloseAutoFocus={onCloseAutoFocus} side="left" className="w-[360px] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0" showCloseButton={false}>
        {content}
      </SheetContent>
    </Sheet>
  )
}

function ThreadsPanel({
  titleKind,
  threads,
  activeThreadId,
  onClose,
  onSelectThread,
  onNewThread,
  onRenameThread,
  onArchiveThread,
  onDeleteThread,
}: {
  titleKind: "drawer" | "sheet"
  threads: AssistantThreadSummary[]
  activeThreadId: string
  onClose: () => void
  onSelectThread: (threadId: string) => void
  onNewThread: () => void | Promise<void>
  onRenameThread?: (threadId: string, title: string) => void | Promise<void>
  onArchiveThread?: (threadId: string) => void | Promise<void>
  onDeleteThread?: (threadId: string) => void | Promise<void>
}) {
  const [query, setQuery] = React.useState("")
  const [renamingThreadId, setRenamingThreadId] = React.useState("")
  const [renameDraft, setRenameDraft] = React.useState("")
  const [deletingThread, setDeletingThread] = React.useState<AssistantThreadSummary | null>(null)
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleThreads = threads.filter((thread) => !normalizedQuery || thread.title.toLocaleLowerCase().includes(normalizedQuery))
  const title = titleKind === "drawer"
    ? <DrawerTitle asChild><h2 className="font-medium">Conversations</h2></DrawerTitle>
    : <SheetTitle asChild><h2 className="font-medium">Conversations</h2></SheetTitle>
  const description = titleKind === "drawer"
    ? <DrawerDescription asChild><p className="text-xs text-muted-foreground">Private to you in this workspace.</p></DrawerDescription>
    : <SheetDescription asChild><p className="text-xs text-muted-foreground">Private to you in this workspace.</p></SheetDescription>

  return (
    <div className="grid h-full min-h-0 min-w-0 flex-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <div className="grid gap-3 border-b p-4">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            {title}
            {description}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close conversations">
            <XIcon />
          </Button>
        </div>
        <Button
          className="w-full"
          onClick={() => {
            void onNewThread()
            onClose()
          }}
        >
          <PlusIcon data-icon="inline-start" />
          New conversation
        </Button>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversations" aria-label="Search conversations" className="!pl-10" />
        </div>
      </div>

      <ScrollArea className="h-full min-h-0 overflow-hidden overscroll-contain touch-pan-y" data-vaul-no-drag="">
        <div className="grid gap-1 p-2">
          {visibleThreads.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">No conversations found.</p>
          ) : visibleThreads.map((thread) => (
            <div key={thread.id} className="group flex min-w-0 items-center rounded-lg hover:bg-muted/50 focus-within:bg-muted/50">
              {renamingThreadId === thread.id ? (
                <form
                  className="flex min-w-0 flex-1 items-center gap-2 p-1"
                  onSubmit={(event) => {
                    event.preventDefault()
                    const nextTitle = renameDraft.trim()
                    if (!nextTitle) return
                    void onRenameThread?.(thread.id, nextTitle)
                    setRenamingThreadId("")
                  }}
                >
                  <Input autoFocus value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} aria-label="Conversation name" />
                  <Button type="submit" size="icon" variant="ghost" aria-label="Save conversation name"><CheckIcon /></Button>
                  <Button type="button" size="icon" variant="ghost" aria-label="Cancel rename" onClick={() => setRenamingThreadId("")}><XIcon /></Button>
                </form>
              ) : (
                <>
                  <button
                    type="button"
                    className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
                    aria-current={thread.id === activeThreadId ? "page" : undefined}
                    onClick={() => {
                      onSelectThread(thread.id)
                      onClose()
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{thread.title}</span>
                    {thread.id === activeThreadId ? <CheckIcon className="size-4 shrink-0" aria-hidden="true" /> : null}
                  </button>
                  {onRenameThread || onArchiveThread || onDeleteThread ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="mr-1" aria-label={`Manage ${thread.title}`}>
                          <MoreHorizontalIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-44">
                        {onRenameThread ? (
                          <DropdownMenuItem onSelect={() => {
                            setRenamingThreadId(thread.id)
                            setRenameDraft(thread.title)
                          }}>
                            <PencilIcon /> Rename
                          </DropdownMenuItem>
                        ) : null}
                        {onArchiveThread ? (
                          <DropdownMenuItem onSelect={() => void onArchiveThread(thread.id)}>
                            <ArchiveIcon /> Archive
                          </DropdownMenuItem>
                        ) : null}
                        {onDeleteThread ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => setDeletingThread(thread)}>
                              <Trash2Icon /> Delete
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      <Dialog open={Boolean(deletingThread)} onOpenChange={(nextOpen) => { if (!nextOpen) setDeletingThread(null) }}>
        <DialogContent className="max-sm:max-w-[calc(100%-1.5rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this conversation?</DialogTitle>
            <DialogDescription>
              Its messages will be permanently removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setDeletingThread(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deletingThread) void onDeleteThread?.(deletingThread.id)
                setDeletingThread(null)
              }}
            >
              Delete conversation
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AllActionsOverlay({
  open,
  onCloseAutoFocus,
  onOpenChange,
  isMobile,
  capabilities,
  routeContext,
  onInvoke,
}: {
  open: boolean
  onCloseAutoFocus: NonNullable<React.ComponentProps<typeof DrawerContent>["onCloseAutoFocus"]>
  onOpenChange: (open: boolean) => void
  isMobile: boolean
  capabilities: readonly AssistantCapability[]
  routeContext: AssistantRouteContext
  onInvoke: (capabilityId: string) => void
}) {
  const [query, setQuery] = React.useState("")
  React.useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleCapabilities = capabilities.filter((item) => {
    if (!normalizedQuery) return true
    return [item.title, item.description, item.group, ...item.keywords]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalizedQuery)
  })

  const content = (
    <AllActionsPanel
      titleKind={isMobile ? "drawer" : "dialog"}
      query={query}
      onQueryChange={setQuery}
      capabilities={visibleCapabilities}
      routeContext={routeContext}
      onInvoke={onInvoke}
    />
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
        <DrawerContent onCloseAutoFocus={onCloseAutoFocus} className="h-[min(660px,92dvh)] max-h-[92dvh] overflow-hidden text-left">
          <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] overflow-hidden">{content}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus} dismissible className="h-[min(760px,calc(100dvh-3rem))] grid-rows-[minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {content}
      </DialogContent>
    </Dialog>
  )
}

function AllActionsPanel({
  titleKind,
  query,
  onQueryChange,
  capabilities,
  routeContext,
  onInvoke,
}: {
  titleKind: "dialog" | "drawer"
  query: string
  onQueryChange: (query: string) => void
  capabilities: AssistantCapability[] | readonly AssistantCapability[]
  routeContext: AssistantRouteContext
  onInvoke: (capabilityId: string) => void
}) {
  const groups = Object.keys(capabilityGroupLabels) as AssistantCapabilityGroup[]
  const title = titleKind === "drawer"
    ? <DrawerTitle asChild><h2 className="text-base font-medium">All actions</h2></DrawerTitle>
    : <DialogTitle asChild><h2 className="text-base font-medium">All actions</h2></DialogTitle>
  const description = titleKind === "drawer"
    ? <DrawerDescription asChild><p className="text-sm text-muted-foreground">Everything in SalesFrame remains within reach.</p></DrawerDescription>
    : <DialogDescription asChild><p className="text-sm text-muted-foreground">Everything in SalesFrame remains within reach.</p></DialogDescription>

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <div className="grid gap-3 border-b p-4 sm:p-5">
        <div>
          {title}
          {description}
        </div>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input autoFocus={titleKind === "dialog"} value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search actions" aria-label="Search all actions" className="!pl-10" />
        </div>
      </div>

      <ScrollArea
        className="h-full min-h-0 overflow-hidden overscroll-contain touch-pan-y"
        data-vaul-no-drag=""
        data-testid="all-actions-scroll-area"
      >
        <div className="grid gap-5 p-3 sm:p-5">
          {capabilities.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No actions match that search.</p>
          ) : groups.map((group) => {
            const items = capabilities.filter((item) => item.group === group)
            if (items.length === 0) return null
            const GroupIcon = capabilityGroupIcons[group]

            return (
              <section key={group} aria-labelledby={`assistant-action-group-${group}`}>
                <h3 id={`assistant-action-group-${group}`} className="mb-1.5 flex items-center gap-2 px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <GroupIcon className="size-3.5" aria-hidden="true" />
                  {capabilityGroupLabels[group]}
                </h3>
                <div className="grid gap-0.5">
                  {items.map((item) => {
                    const hasContext = hasAssistantCapabilityContext(item, routeContext)
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="flex min-h-14 min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
                        onClick={() => onInvoke(item.id)}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{item.title}</span>
                          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                            {hasContext ? item.description : `${item.description} SalesFrame will help you choose the right record.`}
                          </span>
                        </span>
                        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}

function DesktopCanvas({ canvas, onClose }: { canvas: ConversationCanvas; onClose?: () => void }) {
  return (
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden border-l bg-background" aria-labelledby={`conversation-canvas-${canvas.id}`} data-testid="conversation-desktop-canvas">
      <div className="flex min-h-12 min-w-0 shrink-0 items-center gap-3 border-b px-3.5">
        <div className="min-w-0 flex-1">
          <h2 id={`conversation-canvas-${canvas.id}`} className="truncate text-sm font-medium">{canvas.title}</h2>
          {canvas.description ? <p className="truncate text-xs text-muted-foreground">{canvas.description}</p> : null}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} disabled={!onClose} aria-label={`Close ${canvas.title}`}>
          <XIcon />
        </Button>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4">
        {canvas.content}
      </div>
      {canvas.footer ? <div className="shrink-0 border-t px-3.5 py-2">{canvas.footer}</div> : null}
    </section>
  )
}

function MobileCanvas({ canvas, onClose }: { canvas: ConversationCanvas; onClose?: () => void }) {
  return (
    <Sheet open onOpenChange={(nextOpen) => { if (!nextOpen) onClose?.() }}>
      <SheetContent side="right" className="grid w-full max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0" showCloseButton={false}>
        <SheetHeader className="flex min-h-12 flex-row items-center gap-3 border-b px-3 py-1.5 text-left">
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate">{canvas.title}</SheetTitle>
            {canvas.description ? <SheetDescription className="truncate">{canvas.description}</SheetDescription> : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={!onClose} aria-label={`Close ${canvas.title}`}>
            <XIcon />
          </Button>
        </SheetHeader>
        <div className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain p-3">
          {canvas.content}
        </div>
        {canvas.footer ? <div className="shrink-0 border-t px-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">{canvas.footer}</div> : <div />}
      </SheetContent>
    </Sheet>
  )
}

function useCompactConversationSurface() {
  const [isCompact, setIsCompact] = React.useState(() =>
    typeof window === "undefined" ? true : window.innerWidth < 1120
  )

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1119px)")
    const update = () => setIsCompact(mediaQuery.matches)
    update()
    mediaQuery.addEventListener("change", update)
    return () => mediaQuery.removeEventListener("change", update)
  }, [])

  return isCompact
}

function getDayPeriod() {
  const hour = new Date().getHours()
  if (hour < 12) return "morning"
  if (hour < 18) return "afternoon"
  return "evening"
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name
}
