import * as React from "react"

import {
  AssistantArtifactCanvasActions,
  AssistantArtifactCanvasView,
  assistantArtifactNeedsCanvas,
} from "@/components/assistant-artifact"
import { ConversationWorkspace } from "@/components/conversation-workspace"
import { ASSISTANT_CAPABILITIES } from "@/lib/assistant-capabilities"
import {
  ASSISTANT_CAPABILITY_REGISTRY,
  getAssistantCapabilityDefinition,
} from "@/lib/assistant-capability-registry"
import { createAssistantClient } from "@/lib/assistant-client"
import type {
  AssistantActionProposal,
  AssistantArtifact,
  AssistantArtifactAction,
  AssistantActionTarget,
  AssistantBriefing,
  AssistantCapability,
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
  workingContextLabel?: string
  onActionCompleted: (artifact?: AssistantArtifact) => void
  onInvokeCapability: (capabilityId: string, target?: AssistantActionTarget) => void
  onOpenReference: (reference: AssistantMessageReference) => void
  onOpenWorkspaceSwitcher: () => void
  onSwitchToWorkspaceView: () => void
}

// These read capabilities have native collection artifacts. Route them through
// the deterministic assistant read lane so a click opens usable data in
// Conversation mode instead of inheriting whichever record tab is active.
const assistantCollectionPrompts: Readonly<Record<string, string>> = {
  "accounts.list": "Show all active accounts across the workspace",
  "contacts.list": "Show me contacts",
  "opportunities.list": "Show all active opportunities across the workspace",
  "calls.list": "Show all calls across the workspace",
}

export function ConversationModeShell({
  briefing,
  contextualActions,
  routeContext,
  userName,
  voice,
  workspaceId,
  workspaceName,
  workingContextLabel,
  onActionCompleted,
  onInvokeCapability,
  onOpenReference,
  onOpenWorkspaceSwitcher,
  onSwitchToWorkspaceView,
}: ConversationModeShellProps) {
  const client = React.useMemo(
    () => createAssistantClient(createSalesFrameAssistantTransport(), ASSISTANT_CAPABILITY_REGISTRY),
    []
  )
  const [threads, setThreads] = React.useState<AssistantThreadSummary[]>([])
  const [activeThreadId, setActiveThreadId] = React.useState("")
  const [messages, setMessages] = React.useState<AssistantMessage[]>([])
  const [proposals, setProposals] = React.useState<AssistantActionProposal[]>([])
  const [capabilities, setCapabilities] = React.useState<readonly AssistantCapability[]>(ASSISTANT_CAPABILITIES)
  const [isLoadingThreads, setIsLoadingThreads] = React.useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = React.useState(false)
  const [isResponding, setIsResponding] = React.useState(false)
  const [isResponseStoppable, setIsResponseStoppable] = React.useState(false)
  const [completedMessageId, setCompletedMessageId] = React.useState("")
  const [assistantStatus, setAssistantStatus] = React.useState("")
  const [assistantUnavailableMessage, setAssistantUnavailableMessage] = React.useState("")
  const [activeArtifact, setActiveArtifact] = React.useState<AssistantArtifact | null>(null)
  const [artifactActionError, setArtifactActionError] = React.useState<{
    artifactId: string
    message: string
  } | null>(null)
  const [isArtifactWorking, setIsArtifactWorking] = React.useState(false)
  const [artifactSearchValue, setArtifactSearchValue] = React.useState("")
  const requestGenerationRef = React.useRef(0)
  const messageRequestIdRef = React.useRef(0)
  const activeThreadIdRef = React.useRef("")
  const activeTurnRef = React.useRef<AbortController | null>(null)
  const activeArtifactRef = React.useRef<AssistantArtifact | null>(null)
  const artifactFocusReturnRef = React.useRef<HTMLElement | null>(null)
  const restoringArtifactIdRef = React.useRef("")
  const userStoppedTurnsRef = React.useRef(new WeakSet<AbortController>())
  const preferenceSaveQueueRef = React.useRef<Promise<void>>(Promise.resolve())
  const preferenceSaveVersionRef = React.useRef(0)
  const replacementThreadAfterDeleteRef = React.useRef("")
  const messageMutationVersionRef = React.useRef(0)
  const proposalRevisionRef = React.useRef(0)
  const proposalMutationKeysRef = React.useRef(new Set<string>())
  const pendingThreadCreationsRef = React.useRef(new Map<string, Promise<AssistantThreadSummary | null>>())
  const proposal = proposals[0] ?? null

  const loadThreads = React.useCallback(async () => {
    if (!workspaceId) return null
    const collection = await client.listThreads(workspaceId)
    let nextThreads = collection.threads.filter((thread) => !thread.archived)
    let nextActiveThreadId = collection.preference?.activeThreadId ?? ""
    const requestedThreadId = readAssistantQueryId("thread")

    if (requestedThreadId && nextThreads.some((thread) => thread.id === requestedThreadId)) {
      nextActiveThreadId = requestedThreadId
    }

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
    pendingThreadCreationsRef.current.clear()
    replacementThreadAfterDeleteRef.current = ""
    activeTurnRef.current?.abort()
    activeTurnRef.current = null
    messageRequestIdRef.current += 1
    activeThreadIdRef.current = ""
    setThreads([])
    setMessages([])
    setProposals([])
    setCapabilities(ASSISTANT_CAPABILITIES)
    setActiveThreadId("")
    setIsLoadingThreads(Boolean(workspaceId))
    setIsLoadingMessages(false)
    setIsResponding(false)
    setIsResponseStoppable(false)
    setCompletedMessageId("")
    setAssistantUnavailableMessage("")
    setAssistantStatus("")
    activeArtifactRef.current = null
    setActiveArtifact(null)
    setArtifactActionError(null)
    setIsArtifactWorking(false)
    setArtifactSearchValue("")

    if (!workspaceId) return

    void client.listCapabilities(workspaceId)
      .then((catalog) => {
        if (requestGenerationRef.current === generation) setCapabilities(catalog)
      })
      .catch(() => {
        // The reviewed local catalog remains available when the server catalog cannot be refreshed.
      })

    void loadThreads()
      .then((result) => {
        if (!result || requestGenerationRef.current !== generation) return
        activeThreadIdRef.current = result.activeThreadId
        setIsLoadingMessages(true)
        setThreads(result.threads)
        setActiveThreadId(result.activeThreadId)
        replaceAssistantQuery({ thread: result.activeThreadId })
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
  }, [client, loadThreads, workspaceId])

  const loadMessages = React.useCallback(async (threadId: string) => {
    if (!threadId) return
    if (pendingThreadCreationsRef.current.has(threadId)) {
      setIsLoadingMessages(false)
      return
    }
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

  const createThread = React.useCallback(() => {
    replacementThreadAfterDeleteRef.current = ""
    const generation = requestGenerationRef.current
    const activationVersion = preferenceSaveVersionRef.current + 1
    preferenceSaveVersionRef.current = activationVersion
    const previousThreadId = activeThreadIdRef.current
    const optimisticThreadId = crypto.randomUUID()
    const createdAtIso = new Date().toISOString()
    const optimisticThread: AssistantThreadSummary = {
      createdAtIso,
      id: optimisticThreadId,
      title: "New conversation",
      updatedAtIso: createdAtIso,
    }

    // Move first. The seller should never wait on network latency just to see
    // an empty conversation that already has its final opaque identifier.
    messageMutationVersionRef.current += 1
    proposalRevisionRef.current += 1
    activeTurnRef.current?.abort()
    activeTurnRef.current = null
    messageRequestIdRef.current += 1
    activeThreadIdRef.current = optimisticThreadId
    activeArtifactRef.current = null
    setThreads((items) => [optimisticThread, ...items.filter((item) => item.id !== optimisticThreadId)])
    setActiveThreadId(optimisticThreadId)
    setMessages([])
    setProposals([])
    setActiveArtifact(null)
    setArtifactActionError(null)
    setArtifactSearchValue("")
    setCompletedMessageId("")
    setAssistantStatus("")
    setAssistantUnavailableMessage("")
    setIsLoadingMessages(false)
    setIsResponding(false)
    setIsResponseStoppable(false)
    replaceAssistantQuery({ thread: optimisticThreadId, artifact: null })

    const creation = preferenceSaveQueueRef.current
      .catch(() => undefined)
      .then(() => requestGenerationRef.current === generation
        ? client.createThread(workspaceId, undefined, optimisticThreadId)
        : null
      )
      .then((thread) => {
        if (!thread || requestGenerationRef.current !== generation) return null
        setThreads((items) => [
          thread,
          ...items.filter((item) => item.id !== optimisticThreadId && item.id !== thread.id),
        ])
        if (
          activeThreadIdRef.current === optimisticThreadId &&
          preferenceSaveVersionRef.current === activationVersion
        ) {
          activeThreadIdRef.current = thread.id
          setActiveThreadId(thread.id)
          if (thread.id !== optimisticThreadId) replaceAssistantQuery({ thread: thread.id, artifact: null })
        }
        return thread
      })
      .catch(() => {
        if (requestGenerationRef.current !== generation) return null
        setThreads((items) => items.filter((item) => item.id !== optimisticThreadId))
        if (activeThreadIdRef.current === optimisticThreadId) {
          activeThreadIdRef.current = previousThreadId
          setActiveThreadId(previousThreadId)
          setMessages([])
          setProposals([])
          setIsLoadingMessages(Boolean(previousThreadId))
          replaceAssistantQuery({ thread: previousThreadId || null, artifact: null })
        }
        setAssistantUnavailableMessage("SalesFrame couldn't start a new conversation yet. Your previous conversation is unchanged.")
        return null
      })
      .finally(() => {
        pendingThreadCreationsRef.current.delete(optimisticThreadId)
      })

    pendingThreadCreationsRef.current.set(optimisticThreadId, creation)
    preferenceSaveQueueRef.current = creation.then(() => undefined, () => undefined)
    return creation
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
    activeArtifactRef.current = null
    setActiveArtifact(null)
    setArtifactActionError(null)
    setArtifactSearchValue("")
    setActiveThreadId(threadId)
    replaceAssistantQuery({ thread: threadId, artifact: null })
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

  const openArtifact = React.useCallback((artifact: AssistantArtifact, options: { updateHistory?: boolean } = {}) => {
    const previousArtifact = activeArtifactRef.current
    if (!previousArtifact && document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
      artifactFocusReturnRef.current = document.activeElement
    }
    activeArtifactRef.current = artifact
    if (previousArtifact?.id !== artifact.id) setArtifactSearchValue("")
    setActiveArtifact(artifact)
    setArtifactActionError(null)
    if (options.updateHistory === false) return
    if (previousArtifact || readAssistantQueryId("artifact")) {
      replaceAssistantQuery({ artifact: artifact.id })
    } else {
      pushAssistantQuery({ artifact: artifact.id })
    }
  }, [])

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

    if (event.type === "artifact" || event.type === "task") {
      setMessages((items) => appendAssistantArtifact(items, pendingMessageId, event.artifact))
      if (assistantArtifactNeedsCanvas(event.artifact)) openArtifact(event.artifact)
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
  }, [onInvokeCapability, openArtifact])

  const submitTurn = React.useCallback(async (text: string) => {
    let threadId = activeThreadIdRef.current
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
      const pendingCreation = pendingThreadCreationsRef.current.get(threadId)
      if (pendingCreation) {
        setAssistantStatus("Starting your conversation")
        const persistedThread = await pendingCreation
        if (!persistedThread) throw new Error("SalesFrame couldn't start that conversation yet.")
        threadId = persistedThread.id
        if (
          activeTurnRef.current !== controller ||
          activeThreadIdRef.current !== threadId ||
          requestGenerationRef.current !== generation
        ) return false
        setAssistantStatus("Understanding what you need")
      }

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

  const replaceArtifactWithWorkspaceSurface = React.useCallback(() => {
    activeArtifactRef.current = null
    setActiveArtifact(null)
    setArtifactActionError(null)
    replaceAssistantQuery({ artifact: null })
  }, [])

  const handleArtifactAction = React.useCallback(async (
    artifact: AssistantArtifact,
    action: AssistantArtifactAction
  ) => {
    if (action.disabled || isArtifactWorking) return
    const threadId = activeThreadIdRef.current
    const generation = requestGenerationRef.current
    setIsArtifactWorking(true)
    setArtifactActionError(null)
    try {
      if (action.behavior === "submit_prompt") {
        if (!action.prompt) throw new Error("That follow-up is no longer available.")
        const submitted = await submitTurn(action.prompt)
        if (!submitted) throw new Error("SalesFrame couldn't continue that request yet.")
        return
      }

      if (action.behavior === "open_artifact") {
        const artifactId = action.artifactId ?? artifact.id
        const nextArtifact = artifactId === artifact.id
          ? artifact
          : await client.getArtifact(artifactId)
        if (activeThreadIdRef.current !== threadId || requestGenerationRef.current !== generation) return
        openArtifact(nextArtifact)
        return
      }

      const capability = getAssistantCapabilityDefinition(action.capabilityId)
      const canOpenImmediately =
        action.behavior === "secure_handoff" &&
        action.risk === "none" &&
        Boolean(capability && ["read", "navigate"].includes(capability.executionMode))

      // Read-only record links are already immutable server-issued actions,
      // and replayed artifacts are reauthorised when messages are loaded.
      // Opening them must not wait for another network round-trip. The target
      // is validated again against the currently loaded workspace in App, and
      // the server action is revalidated asynchronously for audit continuity.
      if (canOpenImmediately) {
        replaceArtifactWithWorkspaceSurface()
        onInvokeCapability(action.capabilityId, action.target)
        void client.prepareArtifactAction(artifact.id, action.id).catch(() => {
          // The protected destination enforces current access and the local
          // workspace check prevents a stale cross-record handoff. A delayed
          // audit revalidation must never hold the navigation UI hostage.
        })
        return
      }

      const prepared = await client.prepareArtifactAction(artifact.id, action.id)
      if (activeThreadIdRef.current !== threadId || requestGenerationRef.current !== generation) return
      if (action.behavior === "secure_handoff") {
        if (!prepared.capability) throw new Error("That action is no longer available.")
        replaceArtifactWithWorkspaceSurface()
        onInvokeCapability(prepared.capability.id, prepared.capability.target)
        return
      }
      if (action.behavior === "open_form") {
        if (!prepared.capability) throw new Error("That action is no longer available.")
        replaceArtifactWithWorkspaceSurface()
        onInvokeCapability(prepared.capability.id, prepared.capability.target)
        return
      }
      if (prepared.proposal) {
        replaceArtifactWithWorkspaceSurface()
        proposalRevisionRef.current += 1
        setProposals((items) => orderAssistantProposals([
          ...items.filter((item) => item.id !== prepared.proposal?.id),
          prepared.proposal!,
        ]))
      }
      if (prepared.artifact) {
        setMessages((items) => upsertAssistantArtifact(items, prepared.artifact!))
        if (assistantArtifactNeedsCanvas(prepared.artifact)) openArtifact(prepared.artifact)
      }
      if (prepared.reference) onOpenReference(prepared.reference)
      if (!prepared.proposal && !prepared.artifact && !prepared.reference) {
        throw new Error("That action is no longer available. Refresh this result and try again.")
      }
    } catch (error) {
      if (activeThreadIdRef.current !== threadId || requestGenerationRef.current !== generation) return
      setArtifactActionError({
        artifactId: artifact.id,
        message: error instanceof Error && error.message.trim()
          ? error.message
          : "SalesFrame couldn't complete that action. Nothing was changed.",
      })
    } finally {
      if (activeThreadIdRef.current === threadId && requestGenerationRef.current === generation) {
        setIsArtifactWorking(false)
      }
    }
  }, [client, isArtifactWorking, onInvokeCapability, onOpenReference, openArtifact, replaceArtifactWithWorkspaceSurface, submitTurn])

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
      const result = await client.confirmProposal(proposalId)
      if (activeThreadIdRef.current === proposalThreadId) {
        proposalRevisionRef.current += 1
        messageMutationVersionRef.current += 1
        setProposals((items) => items.filter((item) => item.id !== proposalId))
        if (result.artifact) {
          setMessages((items) => upsertAssistantArtifact(items, result.artifact!))
          if (assistantArtifactNeedsCanvas(result.artifact)) openArtifact(result.artifact)
        }
        if (result.reference) onOpenReference(result.reference)
      }
      if (requestGenerationRef.current === generation) onActionCompleted(result.artifact)
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
  }, [client, onActionCompleted, onOpenReference, openArtifact])

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

  const deleteThread = React.useCallback((threadId: string) => {
    const generation = requestGenerationRef.current
    const deletedIndex = threads.findIndex((thread) => thread.id === threadId)
    if (deletedIndex < 0) return
    const deletedThread = threads[deletedIndex]
    if (!deletedThread) return
    const remaining = threads.filter((thread) => thread.id !== threadId)
    const wasActiveThread = threadId === activeThreadIdRef.current
    const needsReplacementThread = wasActiveThread && remaining.length === 0
    if (needsReplacementThread) replacementThreadAfterDeleteRef.current = threadId
    const deletion = preferenceSaveQueueRef.current
      .catch(() => undefined)
      .then(() => requestGenerationRef.current === generation
        ? client.deleteThread(threadId).then(() => true)
        : false
      )
    preferenceSaveQueueRef.current = deletion.then(() => undefined, () => undefined)

    // Remove first so the destructive confirmation feels immediate. The exact
    // server-owned thread continues deleting in the background and is restored
    // in its original position if that request fails.
    setAssistantUnavailableMessage("")
    setThreads(remaining)
    if (wasActiveThread) {
      if (remaining[0]) {
        selectThread(remaining[0].id)
      } else {
        preferenceSaveVersionRef.current += 1
        messageMutationVersionRef.current += 1
        proposalRevisionRef.current += 1
        activeTurnRef.current?.abort()
        activeTurnRef.current = null
        messageRequestIdRef.current += 1
        activeThreadIdRef.current = ""
        activeArtifactRef.current = null
        setActiveThreadId("")
        setMessages([])
        setProposals([])
        setActiveArtifact(null)
        setArtifactActionError(null)
        setArtifactSearchValue("")
        setCompletedMessageId("")
        setAssistantStatus("")
        setIsResponding(false)
        setIsResponseStoppable(false)
        setIsLoadingMessages(true)
        replaceAssistantQuery({ thread: null, artifact: null })
      }
    }

    void deletion.then(async (deleted) => {
      if (!deleted || requestGenerationRef.current !== generation) return
      if (
        !needsReplacementThread ||
        replacementThreadAfterDeleteRef.current !== threadId ||
        activeThreadIdRef.current
      ) return
      const replacement = await createThread()
      if (!replacement && requestGenerationRef.current === generation && !activeThreadIdRef.current) {
        setIsLoadingMessages(false)
      }
    }).catch(() => {
      if (requestGenerationRef.current !== generation) return
      if (replacementThreadAfterDeleteRef.current === threadId) {
        replacementThreadAfterDeleteRef.current = ""
      }
      setThreads((items) => restoreThreadAtIndex(items, deletedThread, deletedIndex))
      setAssistantUnavailableMessage("SalesFrame couldn't delete that conversation. It has been restored.")
      if (needsReplacementThread && !activeThreadIdRef.current) {
        setIsLoadingMessages(false)
        selectThread(deletedThread.id)
      }
    })
  }, [client, createThread, selectThread, threads])

  const restoreArtifactFromLocation = React.useCallback(() => {
    const artifactId = readAssistantQueryId("artifact")
    if (!artifactId) {
      restoringArtifactIdRef.current = ""
      activeArtifactRef.current = null
      setActiveArtifact(null)
      setArtifactActionError(null)
      restoreArtifactOriginFocus(artifactFocusReturnRef)
      return
    }
    const embeddedArtifact = messages
      .flatMap((message) => message.artifacts ?? [])
      .find((artifact) => artifact.id === artifactId)
    if (embeddedArtifact) {
      restoringArtifactIdRef.current = ""
      openArtifact(embeddedArtifact, { updateHistory: false })
      return
    }
    if (activeArtifact?.id === artifactId || restoringArtifactIdRef.current === artifactId) return

    const generation = requestGenerationRef.current
    const threadId = activeThreadIdRef.current
    restoringArtifactIdRef.current = artifactId
    void client.getArtifact(artifactId)
      .then((artifact) => {
        if (
          requestGenerationRef.current !== generation ||
          activeThreadIdRef.current !== threadId ||
          readAssistantQueryId("artifact") !== artifact.id
        ) return
        restoringArtifactIdRef.current = ""
        openArtifact(artifact, { updateHistory: false })
      })
      .catch(() => {
        if (
          requestGenerationRef.current !== generation ||
          activeThreadIdRef.current !== threadId ||
          readAssistantQueryId("artifact") !== artifactId
        ) return
        restoringArtifactIdRef.current = ""
        activeArtifactRef.current = null
        setActiveArtifact(null)
        replaceAssistantQuery({ artifact: null })
        setAssistantUnavailableMessage("That result is no longer available. The conversation remains unchanged.")
      })
  }, [activeArtifact?.id, client, messages, openArtifact])

  React.useEffect(() => {
    restoreArtifactFromLocation()
    const handlePopState = () => restoreArtifactFromLocation()
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [restoreArtifactFromLocation])

  const runningTaskIds = React.useMemo(() => Array.from(new Set(
    messages.flatMap((message) => message.artifacts ?? [])
      .filter((artifact) => artifact.task && ["queued", "running"].includes(artifact.task.status))
      .map((artifact) => artifact.id)
  )).slice(0, 3), [messages])

  React.useEffect(() => {
    if (!runningTaskIds.length) return
    const intervalId = window.setInterval(() => {
      for (const artifactId of runningTaskIds) {
        void client.getTask(artifactId)
          .then((artifact) => {
            setActiveArtifact((current) => current?.id === artifactId ? artifact : current)
            setMessages((items) => replaceAssistantArtifact(items, artifact))
          })
          .catch(() => undefined)
      }
    }, 4_000)
    return () => window.clearInterval(intervalId)
  }, [client, runningTaskIds])

  const closeArtifact = React.useCallback(() => {
    const artifactId = activeArtifactRef.current?.id
    activeArtifactRef.current = null
    setActiveArtifact(null)
    setArtifactActionError(null)
    restoreArtifactOriginFocus(artifactFocusReturnRef)
    if (
      artifactId &&
      readAssistantQueryId("artifact") === artifactId &&
      window.history.state?.salesframeConversationArtifactId === artifactId
    ) {
      window.history.back()
    } else {
      replaceAssistantQuery({ artifact: null })
    }
  }, [])

  const loadMoreArtifact = React.useCallback(async (artifact: AssistantArtifact) => {
    if (!artifact.cursor || isArtifactWorking) return
    setIsArtifactWorking(true)
    setArtifactActionError(null)
    try {
      const updated = await client.queryArtifact(artifact.id, { cursor: artifact.cursor })
      activeArtifactRef.current = updated
      setActiveArtifact(updated)
      setMessages((items) => replaceAssistantArtifact(items, updated))
    } catch (error) {
      setArtifactActionError({
        artifactId: artifact.id,
        message: error instanceof Error && error.message.trim()
          ? error.message
          : "SalesFrame couldn't load more results. Your current results remain available.",
      })
    } finally {
      setIsArtifactWorking(false)
    }
  }, [client, isArtifactWorking])

  const searchArtifact = React.useCallback(async (artifact: AssistantArtifact, value: string) => {
    if (isArtifactWorking) return
    const search = value
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160)
    setIsArtifactWorking(true)
    setArtifactActionError(null)
    try {
      const updated = await client.queryArtifact(artifact.id, { search })
      if (activeArtifactRef.current?.id !== artifact.id) return
      activeArtifactRef.current = updated
      setActiveArtifact(updated)
      setMessages((items) => replaceAssistantArtifact(items, updated))
      setArtifactSearchValue(search)
    } catch (error) {
      setArtifactActionError({
        artifactId: artifact.id,
        message: error instanceof Error && error.message.trim()
          ? error.message
          : "SalesFrame couldn't search these results. Your previous results remain available.",
      })
    } finally {
      setIsArtifactWorking(false)
    }
  }, [client, isArtifactWorking])

  const handleCapabilityInvocation = React.useCallback((
    capabilityId: string,
    _source: "briefing" | "contextual" | "all_actions" | "finding",
    target?: AssistantActionTarget
  ) => {
    const collectionPrompt = assistantCollectionPrompts[capabilityId]
    if (collectionPrompt && activeThreadIdRef.current) {
      void submitTurn(collectionPrompt)
      return
    }
    replaceArtifactWithWorkspaceSurface()
    onInvokeCapability(capabilityId, target)
  }, [onInvokeCapability, replaceArtifactWithWorkspaceSurface, submitTurn])

  const canvas = activeArtifact ? {
    id: activeArtifact.id,
    title: activeArtifact.title,
    description: activeArtifact.description,
    content: (
      <AssistantArtifactCanvasView
        artifact={activeArtifact}
        actionError={artifactActionError?.artifactId === activeArtifact.id ? artifactActionError.message : undefined}
        isWorking={isArtifactWorking}
        onAction={handleArtifactAction}
        onLoadMore={loadMoreArtifact}
        onSearch={searchArtifact}
        onSearchValueChange={setArtifactSearchValue}
        searchValue={artifactSearchValue}
      />
    ),
    footer: activeArtifact.actions.length ? (
      <AssistantArtifactCanvasActions
        artifact={activeArtifact}
        isWorking={isArtifactWorking}
        onAction={handleArtifactAction}
      />
    ) : undefined,
  } : null

  return (
    <ConversationWorkspace
      activeThreadId={activeThreadId}
      assistantStatus={assistantStatus}
      assistantUnavailableMessage={assistantUnavailableMessage}
      artifactActionError={artifactActionError}
      briefing={briefing}
      capabilities={capabilities}
      completedMessageId={completedMessageId}
      contextualActions={contextualActions}
      canvas={canvas}
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
      workingContextLabel={activeArtifact?.title ?? workingContextLabel}
      onArchiveThread={archiveThread}
      onCancelProposal={cancelProposal}
      onConfirmProposal={confirmProposal}
      onDeleteThread={deleteThread}
      onInvokeCapability={handleCapabilityInvocation}
      onNewThread={async () => { await createThread() }}
      onOpenReference={onOpenReference}
      onOpenArtifact={openArtifact}
      onArtifactAction={handleArtifactAction}
      onCloseCanvas={closeArtifact}
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

function restoreThreadAtIndex(
  threads: AssistantThreadSummary[],
  thread: AssistantThreadSummary,
  index: number
) {
  if (threads.some((item) => item.id === thread.id)) return threads
  const nextThreads = [...threads]
  nextThreads.splice(Math.min(Math.max(index, 0), nextThreads.length), 0, thread)
  return nextThreads
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

function appendAssistantArtifact(
  messages: AssistantMessage[],
  pendingMessageId: string,
  artifact: AssistantArtifact
) {
  return messages.map((message) => {
    if (message.id !== pendingMessageId) return message
    const artifacts = message.artifacts ?? []
    return {
      ...message,
      artifacts: [
        ...artifacts.filter((item) => item.id !== artifact.id),
        artifact,
      ],
    }
  })
}

function upsertAssistantArtifact(messages: AssistantMessage[], artifact: AssistantArtifact) {
  let replaced = false
  const nextMessages = messages.map((message) => {
    if (!message.artifacts?.some((item) => item.id === artifact.id)) return message
    replaced = true
    return {
      ...message,
      artifacts: message.artifacts.map((item) => item.id === artifact.id ? artifact : item),
    }
  })
  if (replaced) return nextMessages

  let lastAssistantIndex = -1
  for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
    if (nextMessages[index]?.role === "assistant") {
      lastAssistantIndex = index
      break
    }
  }
  if (lastAssistantIndex < 0) return nextMessages
  return nextMessages.map((message, index) => index === lastAssistantIndex
    ? { ...message, artifacts: [...(message.artifacts ?? []), artifact] }
    : message
  )
}

function replaceAssistantArtifact(messages: AssistantMessage[], artifact: AssistantArtifact) {
  return messages.map((message) => message.artifacts?.some((item) => item.id === artifact.id)
    ? {
        ...message,
        artifacts: message.artifacts.map((item) => item.id === artifact.id ? artifact : item),
      }
    : message
  )
}

function readAssistantQueryId(key: "thread" | "artifact") {
  if (typeof window === "undefined") return ""
  const value = new URL(window.location.href).searchParams.get(key)?.trim() ?? ""
  return /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,179}$/.test(value) ? value : ""
}

function replaceAssistantQuery(patch: { thread?: string | null; artifact?: string | null }) {
  updateAssistantQuery(patch, "replace")
}

function pushAssistantQuery(patch: { thread?: string | null; artifact?: string | null }) {
  updateAssistantQuery(patch, "push")
}

function updateAssistantQuery(
  patch: { thread?: string | null; artifact?: string | null },
  mode: "push" | "replace"
) {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  for (const [key, value] of Object.entries(patch)) {
    if (value) url.searchParams.set(key, value)
    else url.searchParams.delete(key)
  }
  const nextPath = `${url.pathname}${url.search}${url.hash}`
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (nextPath === currentPath) return
  const artifactId = Object.prototype.hasOwnProperty.call(patch, "artifact")
    ? patch.artifact ?? ""
    : readAssistantQueryId("artifact")
  const state = {
    ...window.history.state,
    salesframeConversationArtifactId: artifactId || undefined,
  }
  if (mode === "push") window.history.pushState(state, "", nextPath)
  else window.history.replaceState(state, "", nextPath)
}

function restoreArtifactOriginFocus(ref: React.RefObject<HTMLElement | null>) {
  const target = ref.current
  ref.current = null
  window.requestAnimationFrame(() => {
    if (target?.isConnected) target.focus({ preventScroll: true })
  })
}

function inferThreadTitle(currentTitle: string, firstMessage: string) {
  if (currentTitle !== "New conversation") return currentTitle
  const compact = firstMessage.replace(/\s+/g, " ").trim()
  return compact.length > 60 ? `${compact.slice(0, 57).trimEnd()}…` : compact
}
