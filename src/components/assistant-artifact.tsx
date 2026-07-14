import * as React from "react"
import {
  AlertCircleIcon,
  Building2Icon,
  CheckCircle2Icon,
  ChevronRightIcon,
  CircleIcon,
  Clock3Icon,
  ContactRoundIcon,
  FileTextIcon,
  MessageSquareTextIcon,
  MoreHorizontalIcon,
  SearchIcon,
  SparklesIcon,
  TargetIcon,
} from "lucide-react"

import { AssistantActionChip } from "@/components/assistant-action-chip"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import type {
  AssistantArtifact,
  AssistantArtifactAction,
  AssistantArtifactField,
  AssistantArtifactRecord,
  AssistantArtifactStep,
} from "@/lib/assistant-types"
import { cn } from "@/lib/utils"

type AssistantArtifactInteraction = (
  artifact: AssistantArtifact,
  action: AssistantArtifactAction
) => void | Promise<void>

export function assistantArtifactNeedsCanvas(artifact: AssistantArtifact) {
  if (artifact.kind === "collection") return artifact.records.length > 2 || artifact.sections.length > 0
  if (["relationship", "evidence", "workflow", "form"].includes(artifact.kind)) return true
  return artifact.sections.length > 1 || artifact.fields.length > 4
}

export function AssistantArtifactPreview({
  actionError,
  artifact,
  onAction,
  onOpen,
}: {
  actionError?: string
  artifact: AssistantArtifact
  onAction?: AssistantArtifactInteraction
  onOpen?: (artifact: AssistantArtifact) => void
}) {
  const records = artifact.records.slice(0, 2)
  const fields = artifact.fields.slice(0, 2)
  const shouldOpen = assistantArtifactNeedsCanvas(artifact)

  return (
    <section
      className="mt-2 min-w-0 overflow-hidden rounded-lg border bg-background"
      aria-labelledby={`assistant-artifact-preview-${artifact.id}`}
      data-assistant-artifact-kind={artifact.kind}
    >
      <div className="min-w-0 px-3 py-2.5">
        <div className="flex min-w-0 items-start gap-2.5">
          <ArtifactIcon artifact={artifact} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <h3 id={`assistant-artifact-preview-${artifact.id}`} className="break-words text-sm font-medium">
              {artifact.title}
            </h3>
            {artifact.description ? (
              <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-muted-foreground">
                {artifact.description}
              </p>
            ) : null}
          </div>
          <ArtifactStateText artifact={artifact} />
        </div>

        {artifact.summary ? (
          <p className="mt-2 line-clamp-2 break-words text-sm leading-5 text-foreground/90">{artifact.summary}</p>
        ) : null}

        {artifact.task ? <TaskProgress artifact={artifact} compact /> : null}

        {fields.length ? (
          <dl className="mt-2 grid min-w-0 grid-cols-1 divide-y border-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            {fields.map((field) => <ArtifactField key={field.id} field={field} compact />)}
          </dl>
        ) : null}

        {records.length ? (
          <div className="mt-2 grid min-w-0 divide-y border-y">
            {records.map((record) => (
              <ArtifactRecordRow
                key={record.id}
                artifact={artifact}
                record={record}
                compact
                onAction={onAction}
              />
            ))}
          </div>
        ) : null}

        {!artifact.summary && !artifact.task && !fields.length && !records.length ? (
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {artifact.emptyState ?? "There is nothing to show here yet."}
          </p>
        ) : null}
        {actionError ? (
          <p className="mt-3 border-t pt-3 text-sm leading-5 text-muted-foreground" role="status">
            {actionError}
          </p>
        ) : null}
      </div>

      {(artifact.actions.length > 0 || shouldOpen) ? (
        <ArtifactActions
          artifact={artifact}
          actions={artifact.actions}
          className="border-t px-2.5 py-1.5"
          includeOpen={shouldOpen}
          onAction={onAction}
          onOpen={onOpen}
        />
      ) : null}
    </section>
  )
}

export function AssistantArtifactCanvasView({
  artifact,
  actionError,
  isWorking = false,
  onAction,
  onLoadMore,
  onSearch,
  onSearchValueChange,
  searchValue = "",
}: {
  artifact: AssistantArtifact
  actionError?: string
  isWorking?: boolean
  onAction?: AssistantArtifactInteraction
  onLoadMore?: (artifact: AssistantArtifact) => void | Promise<void>
  onSearch?: (artifact: AssistantArtifact, value: string) => void | Promise<void>
  onSearchValueChange?: (value: string) => void
  searchValue?: string
}) {
  return (
    <div className="mx-auto grid w-full max-w-6xl min-w-0 gap-4" data-testid="assistant-artifact-canvas">
      {artifact.summary ? (
        <p className="max-w-3xl break-words text-sm leading-5 text-foreground/90">
          {artifact.summary}
        </p>
      ) : null}

      {artifact.kind === "collection" && onSearch && onSearchValueChange ? (
        <form
          className="flex min-w-0 flex-col gap-1.5 sm:flex-row"
          role="search"
          onSubmit={(event) => {
            event.preventDefault()
            void onSearch(artifact, searchValue)
          }}
        >
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search {artifact.title}</span>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              className="min-h-11 !pl-10"
              value={searchValue}
              maxLength={160}
              disabled={isWorking}
              placeholder="Search these results"
              onChange={(event) => onSearchValueChange(event.target.value)}
            />
          </label>
          <Button type="submit" variant="outline" className="min-h-11 sm:w-auto" disabled={isWorking}>
            {isWorking ? "Searching…" : "Search"}
          </Button>
        </form>
      ) : null}

      {artifact.task ? <TaskProgress artifact={artifact} /> : null}

      {artifact.fields.length ? (
        <section className="min-w-0" aria-label="Details">
          <dl className="grid min-w-0 grid-cols-1 divide-y border-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3">
            {artifact.fields.map((field) => <ArtifactField key={field.id} field={field} />)}
          </dl>
        </section>
      ) : null}

      {artifact.steps.length ? (
        <section className="min-w-0" aria-labelledby={`assistant-artifact-steps-${artifact.id}`}>
          <h3 id={`assistant-artifact-steps-${artifact.id}`} className="text-sm font-medium">What will happen</h3>
          <ol className="mt-2 grid min-w-0 divide-y border-y">
            {artifact.steps.map((step) => <ArtifactStep key={step.id} step={step} />)}
          </ol>
        </section>
      ) : null}

      {artifact.records.length ? (
        <section className="min-w-0" aria-labelledby={`assistant-artifact-records-${artifact.id}`}>
          {artifact.kind !== "record" ? (
            <h3 id={`assistant-artifact-records-${artifact.id}`} className="mb-1.5 text-sm font-medium">
              {artifact.kind === "evidence" ? "Evidence" : "Results"}
            </h3>
          ) : null}
          <div className="grid min-w-0 divide-y border-y">
            {artifact.records.map((record) => (
              <ArtifactRecordRow
                key={record.id}
                artifact={artifact}
                record={record}
                onAction={onAction}
              />
            ))}
          </div>
        </section>
      ) : null}

      {artifact.sections.map((section) => (
        <section key={section.id} className="min-w-0" aria-labelledby={section.title ? `assistant-artifact-section-${section.id}` : undefined}>
          {section.title ? (
            <h3 id={`assistant-artifact-section-${section.id}`} className="text-sm font-medium">{section.title}</h3>
          ) : null}
          {section.description ? (
            <p className="mt-1 max-w-3xl break-words text-sm leading-5 text-muted-foreground">{section.description}</p>
          ) : null}
          {section.fields.length ? (
            <dl className="mt-2 grid min-w-0 grid-cols-1 divide-y border-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3">
              {section.fields.map((field) => <ArtifactField key={field.id} field={field} />)}
            </dl>
          ) : null}
          {section.records.length ? (
            <div className="mt-2 grid min-w-0 divide-y border-y">
              {section.records.map((record) => (
                <ArtifactRecordRow
                  key={record.id}
                  artifact={artifact}
                  record={record}
                  onAction={onAction}
                />
              ))}
            </div>
          ) : null}
        </section>
      ))}

      {!artifact.summary && !artifact.task && !artifact.fields.length && !artifact.steps.length && !artifact.records.length && !artifact.sections.length ? (
        <div className="py-8 text-center text-sm leading-6 text-muted-foreground">
          {artifact.emptyState ?? "There is nothing to show here yet."}
        </div>
      ) : null}

      {artifact.cursor && onLoadMore ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:w-auto"
          disabled={isWorking}
          onClick={() => void onLoadMore(artifact)}
        >
          {isWorking ? "Loading more…" : "Load more"}
        </Button>
      ) : null}

      {actionError ? (
        <p className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground" role="status">
          {actionError}
        </p>
      ) : null}
    </div>
  )
}

export function AssistantArtifactCanvasActions({
  artifact,
  isWorking = false,
  onAction,
}: {
  artifact: AssistantArtifact
  isWorking?: boolean
  onAction?: AssistantArtifactInteraction
}) {
  if (!artifact.actions.length) return null
  return (
    <ArtifactActions
      artifact={artifact}
      actions={artifact.actions}
      className="justify-end"
      disabled={isWorking}
      onAction={onAction}
    />
  )
}

function ArtifactField({ field, compact = false }: { field: AssistantArtifactField; compact?: boolean }) {
  return (
    <div className={cn("min-w-0 px-3 py-2.5", compact ? "sm:px-3" : "sm:px-3.5 sm:py-3")}>
      <dt className="break-words text-xs font-medium uppercase tracking-wide text-muted-foreground">{field.label}</dt>
      <dd className={cn(
        "mt-1 min-w-0 whitespace-pre-wrap break-words text-sm leading-5",
        field.tone === "critical" && "text-destructive",
        field.tone === "attention" && "text-amber-700 dark:text-amber-300"
      )}>
        {field.value}
      </dd>
      {field.detail ? <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{field.detail}</p> : null}
    </div>
  )
}

function ArtifactRecordRow({
  artifact,
  record,
  compact = false,
  onAction,
}: {
  artifact: AssistantArtifact
  record: AssistantArtifactRecord
  compact?: boolean
  onAction?: AssistantArtifactInteraction
}) {
  const primaryAction = record.actions.find((action) =>
    action.behavior === "secure_handoff" || action.behavior === "open_artifact"
  )
  const secondaryActions = record.actions.filter((action) => action !== primaryAction).slice(0, 3)
  const content = (
    <>
      <RecordIcon kind={record.kind} />
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-medium">{record.label}</span>
        {record.description ? (
          <span className="mt-0.5 block break-words text-sm leading-5 text-muted-foreground">{record.description}</span>
        ) : null}
        {record.fields.length ? (
          <span className="mt-2 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs leading-5 text-muted-foreground">
            {record.fields.slice(0, compact ? 2 : 4).map((field) => (
              <span key={field.id} className="min-w-0 break-words">
                <span className="sr-only">{field.label}: </span>{field.value}
              </span>
            ))}
          </span>
        ) : null}
      </span>
      {primaryAction ? <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
    </>
  )

  return (
    <div className="flex min-w-0 items-center gap-1 py-1.5">
      {primaryAction ? (
        <button
          type="button"
          className="flex min-h-11 min-w-0 flex-1 items-start gap-2.5 rounded-lg px-3 py-2 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          disabled={primaryAction.disabled}
          onClick={() => void onAction?.(artifact, primaryAction)}
        >
          {content}
        </button>
      ) : (
        <div className="flex min-h-11 min-w-0 flex-1 items-start gap-3 px-3 py-2">{content}</div>
      )}
      {secondaryActions.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="mr-1 shrink-0"
              aria-label={`Actions for ${record.label}`}
            >
              <MoreHorizontalIcon aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {secondaryActions.map((action) => (
              <DropdownMenuItem
                key={action.id}
                disabled={action.disabled}
                onSelect={() => void onAction?.(artifact, action)}
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

function ArtifactStep({ step }: { step: AssistantArtifactStep }) {
  const StepIcon = step.status === "completed"
    ? CheckCircle2Icon
    : step.status === "failed"
      ? AlertCircleIcon
      : step.status === "active"
        ? Clock3Icon
        : CircleIcon
  return (
    <li className="flex min-w-0 gap-3 px-3 py-3 sm:px-4">
      <StepIcon className={cn(
        "mt-0.5 size-4 shrink-0 text-muted-foreground",
        step.status === "completed" && "text-emerald-600",
        step.status === "failed" && "text-destructive"
      )} aria-hidden="true" />
      <span className="min-w-0">
        <span className="block break-words text-sm font-medium">{step.label}</span>
        {step.description ? <span className="mt-0.5 block break-words text-sm leading-5 text-muted-foreground">{step.description}</span> : null}
      </span>
    </li>
  )
}

function TaskProgress({ artifact, compact = false }: { artifact: AssistantArtifact; compact?: boolean }) {
  if (!artifact.task) return null
  const { detail, progress, status } = artifact.task
  const label = status === "queued"
    ? "Waiting to begin"
    : status === "running"
      ? "In progress"
      : status === "completed"
        ? "Complete"
        : "Needs attention"
  return (
    <div className={cn("min-w-0", compact ? "mt-3" : "rounded-xl border px-4 py-4")} role="status" aria-live="polite">
      <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        {progress !== undefined ? <span className="shrink-0 text-muted-foreground">{progress}%</span> : null}
      </div>
      {progress !== undefined ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full rounded-full bg-foreground transition-[width] motion-reduce:transition-none" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
      {detail ? <p className="mt-2 break-words text-sm leading-5 text-muted-foreground">{detail}</p> : null}
    </div>
  )
}

function ArtifactActions({
  artifact,
  actions,
  className,
  disabled = false,
  includeOpen = false,
  onAction,
  onOpen,
}: {
  artifact: AssistantArtifact
  actions: AssistantArtifactAction[]
  className?: string
  disabled?: boolean
  includeOpen?: boolean
  onAction?: AssistantArtifactInteraction
  onOpen?: (artifact: AssistantArtifact) => void
}) {
  const primaryAction = includeOpen ? undefined : actions[0]
  const remainingActions = includeOpen ? actions.slice(0, 4) : actions.slice(1, 4)

  return (
    <div
      className={cn("flex min-h-11 min-w-0 flex-wrap items-center gap-x-1.5 gap-y-3", className)}
      aria-label={`Actions for ${artifact.title}`}
    >
      {includeOpen ? (
        <AssistantActionChip icon="details" tone="primary" onClick={() => onOpen?.(artifact)} disabled={!onOpen}>
          View details
        </AssistantActionChip>
      ) : primaryAction ? (
        <AssistantActionChip
          icon={artifactActionChipIcon(primaryAction)}
          tone={primaryAction.risk === "destructive" ? "secondary" : "primary"}
          disabled={disabled || primaryAction.disabled}
          onClick={() => void onAction?.(artifact, primaryAction)}
        >
          {primaryAction.label}
        </AssistantActionChip>
      ) : null}
      {remainingActions.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <AssistantActionChip icon="more" tone="quiet" disabled={disabled} aria-label={`More actions for ${artifact.title}`}>
              More
            </AssistantActionChip>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {remainingActions.map((action) => (
              <DropdownMenuItem
                key={action.id}
                disabled={disabled || action.disabled}
                onSelect={() => void onAction?.(artifact, action)}
              >
                <SparklesIcon aria-hidden="true" />
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

function artifactActionChipIcon(action: AssistantArtifactAction) {
  return action.behavior === "secure_handoff" || action.behavior === "open_artifact"
    ? "open" as const
    : action.behavior === "open_form"
      ? "details" as const
      : "ai" as const
}

function ArtifactStateText({ artifact }: { artifact: AssistantArtifact }) {
  const state = artifact.status
  if (!state || state === "ready") return null
  const label = state === "loading"
    ? "Loading"
    : state === "stale"
      ? "Newer information available"
      : state === "queued"
        ? "Queued"
        : state === "running"
          ? "In progress"
          : state === "completed"
            ? "Complete"
            : "Needs attention"
  return <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
}

function ArtifactIcon({ artifact, className }: { artifact: AssistantArtifact; className?: string }) {
  const Icon = artifact.kind === "evidence"
    ? FileTextIcon
    : artifact.kind === "workflow" || artifact.kind === "task"
      ? SparklesIcon
      : artifact.kind === "relationship"
        ? ContactRoundIcon
        : TargetIcon
  return <Icon className={className} aria-hidden="true" />
}

function RecordIcon({ kind }: { kind: AssistantArtifactRecord["kind"] }) {
  const Icon = kind === "account"
    ? Building2Icon
    : kind === "opportunity"
      ? TargetIcon
      : kind === "contact"
        ? ContactRoundIcon
        : kind === "call"
          ? MessageSquareTextIcon
          : FileTextIcon
  return <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
}
