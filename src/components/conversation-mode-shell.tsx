import * as React from "react"

import { ConversationWorkspace } from "@/components/conversation-workspace"
import { createAssistantClient } from "@/lib/assistant-client"
import type {
  AssistantActionProposal,
  AssistantBriefing,
  AssistantContextualAction,
  AssistantMessage,
  AssistantMessageReference,
  AssistantRouteContext,
  AssistantStreamEvent,
  AssistantThreadSummary,
  AssistantVoiceInput,
} from "@/lib/assistant-types"
import {
  createSalesFrameAssistantTransport,
  saveAssistantWorkspacePreference,
} from "@/lib/server-functions"

type ConversationModeShellProps = {
  briefing: AssistantBriefing
  contextualActions: AssistantContextualAction[]
  routeContext: AssistantRouteContext
  userName: string
  voice: AssistantVoiceInput
  workspaceId: string
  workspaceName: string
  onActionCompleted: () => void
  onInvokeCapability: (capabilityId: string) => void
  onOpenReference: (reference: AssistantMessageReference) => void
  onOpenWorkspaceSwitcher: () => void
  onSwitchToWorkspaceView: () => void
}

export function ConversationModeShell({
  briefing,
  contextualActions,
  routeContext,
  userName,
  voice,
  workspaceId,
  workspaceName,
  onActionCompleted,
  onInvokeCapability,
  onOpenReference,
  onOpenWorkspaceSwitcher,
  onSwitchToWorkspaceView,
}: ConversationModeShellProps) {
  const client = React.useMemo(
    () => createAssistantClient(createSalesFrameAssistantTransport()),
    []
  )
  const [threads, setThreads] = React.useState<AssistantThreadSummary[]>([])
  const [activeThreadId, setActiveThreadId] = React.useState("")
  const [messages, setMessages] = React.useState<AssistantMessage[]>([])
  const [proposals, setProposals] = React.useState<AssistantActionProposal[]>([])
  const [isLoadingThreads, setIsLoadingThreads] = React.useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = React.useState(false)
  const [isResponding, setIsResponding] = React.useState(false)
  const [isResponseStoppable, setIsResponseStoppable] = React.useState(false)
  const [completedMessageId, setCompletedMessageId] = React.useState("")
  const [assistantStatus, setAssistantStatus] = React.useState("")
  const [assistantUnavailableMessage, setAssistantUnavailableMessage] = React.useState("")
  const requestGenerationRef = React.useRef(0)
  const messageRequestIdRef = React.useRef(0)
  const activeThreadIdRef = React.useRef("")
  const activeTurnRef = React.useRef<AbortController | null>(null)
  const userStoppedTurnsRef = React.useRef(new WeakSet<AbortController>())
  const preferenceSaveQueueRef = React.useRef<Promise<void>>(Promise.resolve())
  const preferenceSaveVersionRef = React.useRef(0)
  const messageMutationVersionRef = React.useRef(0)
  const proposalRevisionRef = React.useRef(0)
  const proposalMutationKeysRef = React.useRef(new Set<string>())
  const proposal = proposals[0] ?? null

  const loadThreads = React.useCallback(async () => {
    if (!workspaceId) return null
    const collection = await client.listThreads(workspaceId)
    let nextThreads = collection.threads.filter((thread) => !thread.archived)
    let nextActiveThreadId = collection.preference?.activeThreadId ?? ""

    if (nextThreads.length === 0) {
      const createdThread = await client.ensureDefaultThread(workspaceId)
      nextThreads = [createdThread]
      nextActiveThreadId = createdThread.id
    } else if (!nextThreads.some((thread) => thread.id === nextActiveThreadId)) {
      nextActiveThreadId = nextThreads[0].id
    }

    return { activeThreadId: nextActiveThreadId, threads: nextThreads }
  }, [client, workspaceId])

  React.useEffect(() => {
    const generation = requestGenerationRef.current + 1
    requestGenerationRef.current = generation
    preferenceSaveVersionRef.current += 1
    messageMutationVersionRef.current += 1
    proposalRevisionRef.current += 1
    proposalMutationKeysRef.current.clear()
    activeTurnRef.current?.abort()
    activeTurnRef.current = null
    messageRequestIdRef.current += 1
    activeThreadIdRef.current = ""
    setThreads([])
    setMessages([])
    setProposals([])
    setActiveThreadId("")
    setIsLoadingThreads(Boolean(workspaceId))
    setIsLoadingMessages(false)
    setIsResponding(false)
    setIsResponseStoppable(false)
    setCompletedMessageId("")
    setAssistantUnavailableMessage("")
    setAssistantStatus("")

    if (!workspaceId) return

    void loadThreads()
      .then((result) => {
        if (!result || requestGenerationRef.current !== generation) return
        activeThreadIdRef.current = result.activeThreadId
        setIsLoadingMessages(true)
        setThreads(result.threads)
        setActiveThreadId(result.activeThreadId)
      })
      .catch(() => {
        if (requestGenerationRef.current !== generation) return
        setAssistantUnavailableMessage(
          "Conversation mode needs another moment. Workspace view remains fully available."
        )
      })
      .finally(() => {
        if (requestGenerationRef.current === generation) setIsLoadingThreads(false)
      })

    return () => {
      if (requestGenerationRef.current === generation) requestGenerationRef.current += 1
      activeTurnRef.current?.abort()
      activeTurnRef.current = null
      messageRequestIdRef.current += 1
    }
  }, [loadThreads, workspaceId])

  const loadMessages = React.useCallback(async (threadId: string) => {
    if (!threadId) return
    const generation = requestGenerationRef.current
    const requestId = messageRequestIdRef.current + 1
    const proposalRevision = proposalRevisionRef.current
    messageRequestIdRef.current = requestId
    setIsLoadingMessages(true)
    try {
      const result = await client.listMessages(threadId)
      if (
        requestGenerationRef.current !== generation ||
        messageRequestIdRef.current !== requestId ||
        activeThreadIdRef.current !== threadId
      ) return
      setMessages(result.messages)
      if (
        proposalRevisionRef.current === proposalRevision &&
        !hasProposalMutationForThread(proposalMutationKeysRef.current, threadId)
      ) {
        setProposals(orderAssistantProposals(result.proposals))
      }
      setAssistantUnavailableMessage("")
    } catch {
      if (
        requestGenerationRef.current !== generation ||
        messageRequestIdRef.current !== requestId ||
        activeThreadIdRef.current !== threadId
      ) return
      setAssistantUnavailableMessage("SalesFrame couldn't open this conversation yet. Try another conversation or use Workspace view.")
    } finally {
      if (
        requestGenerationRef.current === generation &&
        messageRequestIdRef.current === requestId &&
        activeThreadIdRef.current === threadId
      ) setIsLoadingMessages(false)
    }
  }, [client])

  React.useEffect(() => {
    if (!activeThreadId) return
    void loadMessages(activeThreadId)
  }, [activeThreadId, loadMessages])

  const createThread = React.useCallback(async () => {
    const generation = requestGenerationRef.current
    const activationVersion = preferenceSaveVersionRef.current + 1
    preferenceSaveVersionRef.current = activationVersion
    try {
      const creation = preferenceSaveQueueRef.current
        .catch(() => undefined)
        .then(() => requestGenerationRef.current === generation
          ? client.createThread(workspaceId)
          : null
        )
      preferenceSaveQueueRef.current = creation.then(() => undefined, () => undefined)
      const thread = await creation
      if (!thread) return null
      if (requestGenerationRef.current !== generation) return null
      setThreads((items) => [thread, ...items.filter((item) => item.id !== thread.id)])
      if (preferenceSaveVersionRef.current !== activationVersion) return thread
      messageMutationVersionRef.current += 1
      proposalRevisionRef.current += 1
      activeTurnRef.current?.abort()
      activeTurnRef.current = null
      messageRequestIdRef.current += 1
      activeThreadIdRef.current = thread.id
      setIsResponding(false)
      setIsResponseStoppable(false)
      setCompletedMessageId("")
      setAssistantStatus("")
      setActiveThreadId(thread.id)
      setMessages([])
      setProposals([])
      setAssistantUnavailableMessage("")
      return thread
    } catch {
      if (requestGenerationRef.current !== generation) return null
      setAssistantUnavailableMessage("SalesFrame couldn't start a new conversation yet. Your current conversation is unchanged.")
      return null
    }
  }, [client, workspaceId])

  const selectThread = React.useCallback((threadId: string) => {
    if (!threadId || threadId === activeThreadIdRef.current) return
    const generation = requestGenerationRef.current
    const preferenceVersion = preferenceSaveVersionRef.current + 1
    preferenceSaveVersionRef.current = preferenceVersion
    messageMutationVersionRef.current += 1
    proposalRevisionRef.current += 1
    activeTurnRef.current?.abort()
    activeTurnRef.current = null
    messageRequestIdRef.current += 1
    activeThreadIdRef.current = threadId
    setIsResponding(false)
    setIsResponseStoppable(false)
    setCompletedMessageId("")
    setIsLoadingMessages(true)
    setAssistantStatus("")
    setAssistantUnavailableMessage("")
    setMessages([])
    setProposals([])
    setActiveThreadId(threadId)
    preferenceSaveQueueRef.current = preferenceSaveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (
          requestGenerationRef.current !== generation ||
          preferenceSaveVersionRef.current !== preferenceVersion ||
          activeThreadIdRef.current !== threadId
        ) return
        await saveAssistantWorkspacePreference(workspaceId, { activeThreadId: threadId })
      })
      .catch(() => {
        if (
          requestGenerationRef.current === generation &&
          preferenceSaveVersionRef.current === preferenceVersion &&
          activeThreadIdRef.current === threadId
        ) {
          setAssistantUnavailableMessage(
            "SalesFrame couldn't remember that conversation selection yet. This conversation remains open."
          )
        }
      })
  }, [workspaceId])

  const handleStreamEvent = React.useCallback((event: AssistantStreamEvent, pendingMessageId: string) => {
    if (event.type === "status") {
      setAssistantStatus(event.text)
      return
    }

    if (event.type === "text_delta") {
      setMessages((items) => appendAssistantDelta(items, pendingMessageId, event.text))
      return
    }

    if (event.type === "reference") {
      setMessages((items) => appendAssistantReference(items, pendingMessageId, event.reference))
      return
    }

    if (event.type === "proposal") {
      proposalRevisionRef.current += 1
      setProposals((items) => orderAssistantProposals([
        ...items.filter((item) => item.id !== event.proposal.id),
        event.proposal,
      ]))
      return
    }

    if (event.type === "canvas") {
      onInvokeCapability(event.capabilityId)
      return
    }

    if (event.type === "complete") {
      setMessages((items) => items.map((message) =>
        message.id === pendingMessageId ? { ...message, id: event.messageId } : message
      ))
      setCompletedMessageId(event.messageId)
      setIsResponseStoppable(false)
      setAssistantStatus("")
      return
    }

    setCompletedMessageId("")
    setIsResponseStoppable(false)
    setAssistantStatus("")
    setAssistantUnavailableMessage(event.message || "SalesFrame couldn't complete that request. Nothing was changed.")
  }, [onInvokeCapability])

  const submitTurn = React.useCallback(async (text: string) => {
    const threadId = activeThreadIdRef.current
    if (!threadId) {
      setAssistantUnavailableMessage("Conversation mode is still opening. Try again in a moment or use Workspace view.")
      return false
    }

    const generation = requestGenerationRef.current
    messageMutationVersionRef.current += 1
    activeTurnRef.current?.abort()
    const controller = new AbortController()
    activeTurnRef.current = controller
    const clientRequestId = crypto.randomUUID()
    const pendingUserMessageId = `pending-user-${clientRequestId}`
    const pendingMessageId = `pending-assistant-${clientRequestId}`
    const createdAtIso = new Date().toISOString()
    const wasStoppedByUserInCurrentContext = () =>
      userStoppedTurnsRef.current.has(controller) &&
      activeThreadIdRef.current === threadId &&
      requestGenerationRef.current === generation

    setMessages((items) => [
      ...items,
      { id: pendingUserMessageId, role: "user", text, createdAtIso },
      { id: pendingMessageId, role: "assistant", text: "", createdAtIso },
    ])
    setAssistantUnavailableMessage("")
    setAssistantStatus("Understanding what you need")
    setIsResponding(true)
    setIsResponseStoppable(false)
    setCompletedMessageId("")

    try {
      let streamedErrorMessage = ""
      await client.sendTurn(
        { threadId, text, clientRequestId, routeContext },
        (event) => {
          if (
            activeTurnRef.current !== controller ||
            activeThreadIdRef.current !== threadId ||
            requestGenerationRef.current !== generation
          ) return
          setIsResponseStoppable(true)
          if (event.type === "error") streamedErrorMessage = event.message
          handleStreamEvent(event, pendingMessageId)
        },
        controller.signal
      )
      if (streamedErrorMessage) throw new Error(streamedErrorMessage)
      if (
        controller.signal.aborted ||
        activeTurnRef.current !== controller ||
        activeThreadIdRef.current !== threadId ||
        requestGenerationRef.current !== generation
      ) return wasStoppedByUserInCurrentContext()

      try {
        const proposalRevision = proposalRevisionRef.current
        const messageMutationVersion = messageMutationVersionRef.current
        const result = await client.listMessages(threadId)
        if (
          activeTurnRef.current === controller &&
          activeThreadIdRef.current === threadId &&
          requestGenerationRef.current === generation &&
          messageMutationVersionRef.current === messageMutationVersion
        ) {
          setMessages(result.messages)
          if (
            proposalRevisionRef.current === proposalRevision &&
            !hasProposalMutationForThread(proposalMutationKeysRef.current, threadId)
          ) {
            setProposals(orderAssistantProposals(result.proposals))
          }
        }
      } catch {
        // The streamed response remains visible and the durable thread will reconcile on the next open.
      }

      if (
        activeTurnRef.current !== controller ||
        activeThreadIdRef.current !== threadId ||
        requestGenerationRef.current !== generation
      ) return false

      setAssistantUnavailableMessage("")
      setThreads((items) => items.map((thread) =>
        thread.id === threadId ? { ...thread, title: inferThreadTitle(thread.title, text), updatedAtIso: new Date().toISOString() } : thread
      ))
      return true
    } catch (error) {
      if (
        controller.signal.aborted ||
        activeTurnRef.current !== controller ||
        activeThreadIdRef.current !== threadId ||
        requestGenerationRef.current !== generation
      ) return wasStoppedByUserInCurrentContext()

      try {
        const proposalRevision = proposalRevisionRef.current
        const messageMutationVersion = messageMutationVersionRef.current
        const result = await client.listMessages(threadId)
        if (
          activeTurnRef.current === controller &&
          activeThreadIdRef.current === threadId &&
          messageMutationVersionRef.current === messageMutationVersion
        ) {
          setMessages(result.messages)
          if (
            proposalRevisionRef.current === proposalRevision &&
            !hasProposalMutationForThread(proposalMutationKeysRef.current, threadId)
          ) {
            setProposals(orderAssistantProposals(result.proposals))
          }
        }
      } catch {
        setMessages((items) => items.filter((message) =>
          message.id !== pendingUserMessageId && message.id !== pendingMessageId
        ))
      }
      if (
        activeTurnRef.current !== controller ||
        activeThreadIdRef.current !== threadId ||
        requestGenerationRef.current !== generation
      ) return false
      setAssistantUnavailableMessage(
        error instanceof Error && error.message.trim()
          ? error.message
          : "SalesFrame couldn't complete that request. Nothing was changed."
      )
      return false
    } finally {
      if (activeTurnRef.current === controller) {
        activeTurnRef.current = null
        setAssistantStatus("")
        setIsResponding(false)
        setIsResponseStoppable(false)
      }
    }
  }, [client, handleStreamEvent, routeContext])

  const stopResponse = React.useCallback(() => {
    const controller = activeTurnRef.current
    const threadId = activeThreadIdRef.current
    const generation = requestGenerationRef.current
    if (!controller || !threadId) return
    const reconciliationVersion = messageMutationVersionRef.current + 1
    messageMutationVersionRef.current = reconciliationVersion
    const proposalRevision = proposalRevisionRef.current

    userStoppedTurnsRef.current.add(controller)
    activeTurnRef.current = null
    controller.abort()
    setAssistantStatus("")
    setIsResponding(false)
    setIsResponseStoppable(false)
    setCompletedMessageId("")
    setAssistantUnavailableMessage("Response stopped. Your conversation is saved and ready when you are.")

    void client.listMessages(threadId)
      .then((result) => {
        if (
          requestGenerationRef.current !== generation ||
          activeThreadIdRef.current !== threadId ||
          messageMutationVersionRef.current !== reconciliationVersion
        ) return
        setMessages(result.messages)
        if (
          proposalRevisionRef.current === proposalRevision &&
          !hasProposalMutationForThread(proposalMutationKeysRef.current, threadId)
        ) {
          setProposals(orderAssistantProposals(result.proposals))
        }
      })
      .catch(() => {
        // The durable conversation will reconcile the next time it is opened.
      })
  }, [client])

  const confirmProposal = React.useCallback(async (proposalId: string) => {
    const proposalThreadId = activeThreadIdRef.current
    const proposalMutationKey = `${proposalThreadId}:${proposalId}`
    const generation = requestGenerationRef.current
    proposalMutationKeysRef.current.add(proposalMutationKey)
    proposalRevisionRef.current += 1
    messageMutationVersionRef.current += 1
    setProposals((items) => items.map((item) =>
      item.id === proposalId ? { ...item, state: "confirming" } : item
    ))
    try {
      await client.confirmProposal(proposalId)
      if (activeThreadIdRef.current === proposalThreadId) {
        proposalRevisionRef.current += 1
        messageMutationVersionRef.current += 1
        setProposals((items) => items.filter((item) => item.id !== proposalId))
        setMessages((items) => [
          ...items,
          {
            id: `confirmed-${proposalId}`,
            role: "status",
            text: "Change confirmed.",
            createdAtIso: new Date().toISOString(),
          },
        ])
      }
      if (requestGenerationRef.current === generation) onActionCompleted()
    } catch (error) {
      if (activeThreadIdRef.current !== proposalThreadId) return
      proposalRevisionRef.current += 1
      messageMutationVersionRef.current += 1
      setProposals((items) => items.map((item) => item.id === proposalId
        ? {
            ...item,
            state: "failed",
            errorMessage: error instanceof Error && error.message.trim()
              ? error.message
              : "SalesFrame couldn't confirm this change. Review it and try again.",
          }
        : item
      ))
    } finally {
      proposalMutationKeysRef.current.delete(proposalMutationKey)
    }
  }, [client, onActionCompleted])

  const cancelProposal = React.useCallback(async (proposalId: string) => {
    const proposalThreadId = activeThreadIdRef.current
    const proposalMutationKey = `${proposalThreadId}:${proposalId}`
    const generation = requestGenerationRef.current
    proposalMutationKeysRef.current.add(proposalMutationKey)
    proposalRevisionRef.current += 1
    messageMutationVersionRef.current += 1
    try {
      await client.cancelProposal(proposalId)
      if (
        requestGenerationRef.current !== generation ||
        activeThreadIdRef.current !== proposalThreadId
      ) return
      proposalRevisionRef.current += 1
      messageMutationVersionRef.current += 1
      setProposals((items) => items.filter((item) => item.id !== proposalId))
    } catch {
      if (
        requestGenerationRef.current !== generation ||
        activeThreadIdRef.current !== proposalThreadId
      ) return
      proposalRevisionRef.current += 1
      messageMutationVersionRef.current += 1
      setProposals((items) => items.map((item) => item.id === proposalId
        ? { ...item, state: "failed", errorMessage: "SalesFrame couldn't cancel this change yet. Nothing was changed." }
        : item
      ))
    } finally {
      proposalMutationKeysRef.current.delete(proposalMutationKey)
    }
  }, [client])

  const renameThread = React.useCallback(async (threadId: string, title: string) => {
    const generation = requestGenerationRef.current
    try {
      const updated = await client.updateThread(threadId, { title })
      if (requestGenerationRef.current !== generation) return
      setThreads((items) => items.map((thread) => thread.id === threadId ? updated : thread))
    } catch {
      if (requestGenerationRef.current !== generation) return
      setAssistantUnavailableMessage("SalesFrame couldn't rename that conversation. Its original name is unchanged.")
    }
  }, [client])

  const archiveThread = React.useCallback(async (threadId: string) => {
    const generation = requestGenerationRef.current
    try {
      const archive = preferenceSaveQueueRef.current
        .catch(() => undefined)
        .then(() => requestGenerationRef.current === generation
          ? client.archiveThread(threadId)
          : null
        )
      preferenceSaveQueueRef.current = archive.then(() => undefined, () => undefined)
      if (!await archive) return
      if (requestGenerationRef.current !== generation) return
      const remaining = threads.filter((thread) => thread.id !== threadId)
      setThreads(remaining)
      if (threadId !== activeThreadIdRef.current) return
      if (remaining[0]) selectThread(remaining[0].id)
      else await createThread()
    } catch {
      if (requestGenerationRef.current !== generation) return
      setAssistantUnavailableMessage("SalesFrame couldn't archive that conversation. Nothing was changed.")
    }
  }, [client, createThread, selectThread, threads])

  const deleteThread = React.useCallback(async (threadId: string) => {
    const generation = requestGenerationRef.current
    try {
      const deletion = preferenceSaveQueueRef.current
        .catch(() => undefined)
        .then(() => requestGenerationRef.current === generation
          ? client.deleteThread(threadId).then(() => true)
          : false
        )
      preferenceSaveQueueRef.current = deletion.then(() => undefined, () => undefined)
      if (!await deletion) return
      if (requestGenerationRef.current !== generation) return
      const remaining = threads.filter((thread) => thread.id !== threadId)
      setThreads(remaining)
      if (threadId !== activeThreadIdRef.current) return
      if (remaining[0]) selectThread(remaining[0].id)
      else await createThread()
    } catch {
      if (requestGenerationRef.current !== generation) return
      setAssistantUnavailableMessage("SalesFrame couldn't delete that conversation. Nothing was changed.")
    }
  }, [client, createThread, selectThread, threads])

  return (
    <ConversationWorkspace
      activeThreadId={activeThreadId}
      assistantStatus={assistantStatus}
      assistantUnavailableMessage={assistantUnavailableMessage}
      briefing={briefing}
      completedMessageId={completedMessageId}
      contextualActions={contextualActions}
      isComposerDisabled={isLoadingThreads || isLoadingMessages || !activeThreadId}
      isLoadingMessages={isLoadingMessages}
      isResponding={isResponding}
      messages={messages}
      proposal={proposal}
      routeContext={routeContext}
      threads={threads}
      userName={userName}
      voice={voice}
      workspaceName={workspaceName}
      onArchiveThread={archiveThread}
      onCancelProposal={cancelProposal}
      onConfirmProposal={confirmProposal}
      onDeleteThread={deleteThread}
      onInvokeCapability={(capabilityId) => onInvokeCapability(capabilityId)}
      onNewThread={async () => { await createThread() }}
      onOpenReference={onOpenReference}
      onOpenWorkspaceSwitcher={onOpenWorkspaceSwitcher}
      onRenameThread={renameThread}
      onSelectThread={selectThread}
      onStopResponse={isResponseStoppable ? stopResponse : undefined}
      onSubmit={submitTurn}
      onSwitchToWorkspaceView={onSwitchToWorkspaceView}
    />
  )
}

function orderAssistantProposals(proposals: AssistantActionProposal[]) {
  return [...proposals].sort((left, right) => {
    const leftFailed = left.state === "failed" ? 1 : 0
    const rightFailed = right.state === "failed" ? 1 : 0
    if (leftFailed !== rightFailed) return leftFailed - rightFailed
    return left.expiresAt.localeCompare(right.expiresAt)
  })
}

function hasProposalMutationForThread(keys: Set<string>, threadId: string) {
  const prefix = `${threadId}:`
  for (const key of keys) {
    if (key.startsWith(prefix)) return true
  }
  return false
}

function appendAssistantDelta(
  messages: AssistantMessage[],
  pendingMessageId: string,
  delta: string
) {
  return messages.map((message) => message.id === pendingMessageId
    ? { ...message, text: `${message.text}${delta}` }
    : message
  )
}

function appendAssistantReference(
  messages: AssistantMessage[],
  pendingMessageId: string,
  reference: AssistantMessageReference
) {
  return messages.map((message) => {
    if (message.id !== pendingMessageId) return message
    const references = message.references ?? []
    if (references.some((item) => item.id === reference.id && item.kind === reference.kind)) return message
    return { ...message, references: [...references, reference] }
  })
}

function inferThreadTitle(currentTitle: string, firstMessage: string) {
  if (currentTitle !== "New conversation") return currentTitle
  const compact = firstMessage.replace(/\s+/g, " ").trim()
  return compact.length > 60 ? `${compact.slice(0, 57).trimEnd()}…` : compact
}
