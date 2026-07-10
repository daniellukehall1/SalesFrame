import * as React from "react"
import {
  ArchiveIcon,
  CheckIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  MailIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  UserRoundIcon,
  UsersRoundIcon,
  XIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DialogActions } from "@/components/ui/dialog-actions"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  contactBuyingRoles,
  type Contact,
  type ContactBuyingRole,
  type ContactDraft,
  type ContactEnrichmentStatus,
  type Opportunity,
  type OpportunityContact,
} from "@/lib/salesframe-core"
import { cn } from "@/lib/utils"

export type ContactSaveHandler = (
  contactId: string | null,
  draft: ContactDraft,
  enrichAfterSave: boolean
) => Promise<void>

export type OpportunityContactPatch = Partial<
  Pick<OpportunityContact, "buyingRoles" | "influence" | "relationshipStrength" | "stance" | "isPrimary" | "notes">
>

const emptyContactDraft: ContactDraft = {
  fullName: "",
  preferredName: "",
  jobTitle: "",
  department: "",
  seniority: "",
  workEmail: "",
  businessPhone: "",
  linkedinUrl: "",
  location: "",
  timezone: "",
  employmentStatus: "active",
  privateNotes: "",
  source: "manual",
}

export function createContactDraft(contact?: Contact | null): ContactDraft {
  if (!contact) return { ...emptyContactDraft }

  return {
    fullName: contact.fullName,
    preferredName: contact.preferredName,
    jobTitle: contact.jobTitle,
    department: contact.department,
    seniority: contact.seniority,
    workEmail: contact.workEmail,
    businessPhone: contact.businessPhone,
    linkedinUrl: contact.linkedinUrl,
    location: contact.location,
    timezone: contact.timezone,
    employmentStatus: contact.employmentStatus,
    privateNotes: contact.privateNotes,
    source: contact.source,
  }
}

function formatBuyingRole(role: string) {
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatStatusLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function contactInitials(contact: Pick<Contact, "fullName" | "preferredName">) {
  const name = contact.preferredName.trim() || contact.fullName.trim()

  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?"
}

function matchesContact(contact: Contact, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true

  return [
    contact.fullName,
    contact.preferredName,
    contact.jobTitle,
    contact.department,
    contact.workEmail,
    contact.businessPhone,
    contact.linkedinUrl,
  ].some((value) => value.toLowerCase().includes(normalizedQuery))
}

function getSafeProfessionalProfileUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""

  try {
    const url = new URL(trimmed)
    if (url.protocol !== "http:" && url.protocol !== "https:") return ""

    return url.toString()
  } catch {
    return ""
  }
}

function normalizeProfessionalProfileUrl(value: string) {
  const safeUrl = getSafeProfessionalProfileUrl(value)
  if (!safeUrl) return ""

  const url = new URL(safeUrl)
  const rawHost = url.hostname.toLowerCase().replace(/^www\./, "")
  const host = rawHost === "linkedin.com" || rawHost.endsWith(".linkedin.com") ? "linkedin.com" : rawHost
  const path = url.pathname.replace(/\/+$/, "").toLowerCase()

  return `${host}${path}`
}

function getEnrichmentStatus(contact: Contact): ContactEnrichmentStatus {
  return contact.enrichment?.status ?? "not_enriched"
}

function ContactIdentity({ contact, compact = false }: { contact: Contact; compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {contactInitials(contact)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{contact.fullName}</span>
        {!compact ? (
          <span className="block truncate text-xs text-muted-foreground">
            {[contact.jobTitle, contact.department].filter(Boolean).join(" · ") || "Role not captured"}
          </span>
        ) : null}
      </span>
    </div>
  )
}

export function ContactMultiSelect({
  contacts,
  disabled = false,
  id,
  label = "Contacts",
  onChange,
  preferredContactIds = [],
  value,
}: {
  contacts: Contact[]
  disabled?: boolean
  id: string
  label?: string
  onChange: (contactIds: string[]) => void
  preferredContactIds?: string[]
  value: string[]
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const listboxRef = React.useRef<HTMLDivElement | null>(null)
  const listboxId = `${id}-listbox`
  const activeContacts = React.useMemo(
    () => contacts.filter((contact) => !contact.archivedAtIso),
    [contacts]
  )
  const contactById = React.useMemo(
    () => new Map(contacts.map((contact) => [contact.id, contact])),
    [contacts]
  )
  const preferredSet = React.useMemo(() => new Set(preferredContactIds), [preferredContactIds])
  const visibleContacts = React.useMemo(
    () =>
      activeContacts
        .filter((contact) => matchesContact(contact, query))
        .sort((left, right) => {
          const preferredDelta = Number(preferredSet.has(right.id)) - Number(preferredSet.has(left.id))
          return preferredDelta || left.fullName.localeCompare(right.fullName)
        }),
    [activeContacts, preferredSet, query]
  )
  const selectedContacts = value.map((contactId) => contactById.get(contactId)).filter(Boolean) as Contact[]

  const toggleContact = (contactId: string) => {
    if (disabled) return
    onChange(value.includes(contactId) ? value.filter((idValue) => idValue !== contactId) : [...value, contactId])
  }

  const focusOption = (currentTarget: HTMLButtonElement, direction: "first" | "last" | "next" | "previous") => {
    const options = Array.from(
      listboxRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)') ?? []
    )
    if (!options.length) return

    const currentIndex = options.indexOf(currentTarget)
    const nextIndex = direction === "first"
      ? 0
      : direction === "last"
        ? options.length - 1
        : direction === "next"
          ? Math.min(options.length - 1, currentIndex + 1)
          : Math.max(0, currentIndex - 1)
    options[nextIndex]?.focus()
  }

  React.useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  return (
    <div className="grid min-w-0 gap-2">
      {selectedContacts.length ? (
        <div className="flex min-w-0 flex-wrap gap-2" aria-label={`Selected ${label.toLowerCase()}`}>
          {selectedContacts.map((contact) => (
            <Badge key={contact.id} variant="secondary" className="min-h-11 max-w-full gap-1.5 pr-1 md:min-h-8">
              <span className="truncate">{contact.preferredName || contact.fullName}</span>
              <button
                type="button"
                className="flex size-11 shrink-0 items-center justify-center rounded-full outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring md:size-7"
                aria-label={`Remove ${contact.fullName}`}
                disabled={disabled}
                onClick={() => toggleContact(contact.id)}
              >
                <XIcon className="size-3.5" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          if (disabled) return
          setOpen(nextOpen)
          if (!nextOpen) setQuery("")
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className="min-h-11 w-full min-w-0 justify-between gap-2 px-3 font-normal md:min-h-9"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-controls={listboxId}
            disabled={disabled}
          >
            <span className={cn("truncate", value.length === 0 && "text-muted-foreground")}>
              {value.length === 0
                ? `Select ${label.toLowerCase()} (optional)`
                : `${value.length} ${value.length === 1 ? "contact" : "contacts"} selected`}
            </span>
            <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(26rem,calc(100vw-2rem))] p-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              aria-label={`Search ${label.toLowerCase()}`}
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-expanded={open}
              role="combobox"
              value={query}
              className="h-11 pl-9 md:h-9"
              placeholder="Search contacts"
              onChange={(event) => setQuery(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault()
                  listboxRef.current?.querySelector<HTMLButtonElement>('[role="option"]:not(:disabled)')?.focus()
                } else if (event.key === "Escape") {
                  setOpen(false)
                }
              }}
            />
          </div>
          <div id={listboxId} ref={listboxRef} className="mt-2 grid max-h-72 gap-1 overflow-y-auto" role="listbox" aria-multiselectable="true">
            {visibleContacts.map((contact, index) => {
              const selected = value.includes(contact.id)
              const showPreferredHeading = preferredSet.has(contact.id) &&
                (index === 0 || !preferredSet.has(visibleContacts[index - 1]?.id ?? ""))
              const showOtherHeading = !preferredSet.has(contact.id) &&
                (index === 0 || preferredSet.has(visibleContacts[index - 1]?.id ?? ""))

              return (
                <React.Fragment key={contact.id}>
                  {showPreferredHeading ? (
                    <p role="presentation" className="px-2 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Opportunity contacts
                    </p>
                  ) : showOtherHeading && preferredContactIds.length ? (
                    <p role="presentation" className="px-2 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Other account contacts
                    </p>
                  ) : null}
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={disabled}
                    className="grid min-h-11 w-full grid-cols-[1fr_auto] items-center gap-3 rounded-md px-2 py-2 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => toggleContact(contact.id)}
                    onKeyDown={(event) => {
                      const direction = event.key === "ArrowDown"
                        ? "next"
                        : event.key === "ArrowUp"
                          ? "previous"
                          : event.key === "Home"
                            ? "first"
                            : event.key === "End"
                              ? "last"
                              : null
                      if (direction) {
                        event.preventDefault()
                        focusOption(event.currentTarget, direction)
                      } else if (event.key === "Escape") {
                        setOpen(false)
                      }
                    }}
                  >
                    <ContactIdentity contact={contact} />
                    <span
                      className={cn(
                        "flex size-5 items-center justify-center rounded border",
                        selected ? "border-primary bg-primary text-primary-foreground" : "border-input"
                      )}
                      aria-hidden="true"
                    >
                      {selected ? <CheckIcon className="size-3.5" /> : null}
                    </span>
                  </button>
                </React.Fragment>
              )
            })}
            {visibleContacts.length === 0 ? (
              <div role="presentation" className="rounded-md px-3 py-6 text-center text-sm text-muted-foreground">
                {activeContacts.length ? "No contacts match this search." : "No contacts yet."}
              </div>
            ) : null}
          </div>
          {value.length ? (
            <div className="mt-2 flex justify-between border-t pt-2">
              <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange([])}>
                Clear selection
              </Button>
              <Button type="button" size="sm" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function ContactEditor({
  accountWebsite,
  contact,
  contacts,
  onOpenChange,
  onSave,
  open,
}: {
  accountWebsite: string
  contact: Contact | null
  contacts: Contact[]
  onOpenChange: (open: boolean) => void
  onSave: ContactSaveHandler
  open: boolean
}) {
  const isMobile = useIsMobile()
  const [draft, setDraft] = React.useState<ContactDraft>(() => createContactDraft(contact))
  const [savedDraft, setSavedDraft] = React.useState<ContactDraft>(() => createContactDraft(contact))
  const [enrichAfterSave, setEnrichAfterSave] = React.useState(false)
  const [status, setStatus] = React.useState<"idle" | "saving" | "error">("idle")
  const [message, setMessage] = React.useState("")
  const [confirmDiscard, setConfirmDiscard] = React.useState(false)

  React.useEffect(() => {
    if (!open) return

    const nextDraft = createContactDraft(contact)
    setDraft(nextDraft)
    setSavedDraft(nextDraft)
    setEnrichAfterSave(false)
    setStatus("idle")
    setMessage("")
    setConfirmDiscard(false)
  }, [contact, open])

  const isDirty = JSON.stringify(draft) !== JSON.stringify(savedDraft) || enrichAfterSave
  const canEnrich = Boolean(draft.fullName.trim() && (accountWebsite.trim() || draft.linkedinUrl.trim()))
  const normalizedEmail = draft.workEmail.trim().toLowerCase()
  const invalidEmail = Boolean(normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail))
  const normalizedLinkedIn = normalizeProfessionalProfileUrl(draft.linkedinUrl)
  const invalidLinkedInUrl = Boolean(draft.linkedinUrl.trim() && !getSafeProfessionalProfileUrl(draft.linkedinUrl))
  const duplicateEmail = normalizedEmail
    ? contacts.find((item) => !item.archivedAtIso && item.id !== contact?.id && item.workEmail.trim().toLowerCase() === normalizedEmail)
    : null
  const duplicateLinkedIn = normalizedLinkedIn
    ? contacts.find(
        (item) => !item.archivedAtIso && item.id !== contact?.id && normalizeProfessionalProfileUrl(item.linkedinUrl) === normalizedLinkedIn
      )
    : null
  const possibleNameMatch = contacts.find(
    (item) =>
      !item.archivedAtIso &&
      item.id !== contact?.id &&
      item.fullName.trim().toLowerCase() === draft.fullName.trim().toLowerCase() &&
      item.jobTitle.trim().toLowerCase() === draft.jobTitle.trim().toLowerCase()
  )
  const blockingDuplicate = duplicateEmail || duplicateLinkedIn

  const updateDraft = <K extends keyof ContactDraft>(field: K, value: ContactDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setMessage("")
    setStatus("idle")
  }

  const requestClose = () => {
    if (status === "saving") return
    if (isDirty) {
      setConfirmDiscard(true)
      return
    }
    onOpenChange(false)
  }

  const handleSave = async () => {
    if (!draft.fullName.trim() || blockingDuplicate || invalidEmail || invalidLinkedInUrl || (enrichAfterSave && !canEnrich) || status === "saving") return

    setStatus("saving")
    setMessage("")
    try {
      await onSave(contact?.id ?? null, { ...draft, fullName: draft.fullName.trim() }, enrichAfterSave)
      setSavedDraft(draft)
      setStatus("idle")
      onOpenChange(false)
    } catch (error: unknown) {
      setStatus("error")
      setMessage(error instanceof Error ? error.message : "Contact needs another save attempt.")
    }
  }

  const editorBody = confirmDiscard ? (
    <div className="grid min-h-64 place-items-center px-2 py-8 text-center">
      <div className="grid max-w-sm justify-items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <PencilIcon className="size-5" />
        </span>
        <div>
          <p className="font-medium">Discard unsaved contact changes?</p>
          <p className="mt-1 text-sm text-muted-foreground">Your edits have not been saved to this account.</p>
        </div>
        <div className="grid w-full gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" onClick={() => setConfirmDiscard(false)}>
            Keep editing
          </Button>
          <Button type="button" variant="destructive" onClick={() => onOpenChange(false)}>
            Discard changes
          </Button>
        </div>
      </div>
    </div>
  ) : (
    <div className="grid min-h-0 gap-5 overflow-y-auto overscroll-contain pr-1">
      <section className="grid gap-4" aria-labelledby="contact-details-heading">
        <div>
          <h3 id="contact-details-heading" className="text-sm font-medium">Contact details</h3>
          <p className="mt-1 text-xs text-muted-foreground">Store professional details the seller can verify and reuse across opportunities.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="contact-full-name">Full name *</Label>
            <Input
              id="contact-full-name"
              autoFocus={!isMobile}
              aria-required="true"
              required
              value={draft.fullName}
              autoComplete="name"
              onChange={(event) => updateDraft("fullName", event.currentTarget.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contact-preferred-name">Preferred name</Label>
            <Input
              id="contact-preferred-name"
              value={draft.preferredName}
              onChange={(event) => updateDraft("preferredName", event.currentTarget.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contact-job-title">Job title</Label>
            <Input
              id="contact-job-title"
              value={draft.jobTitle}
              autoComplete="organization-title"
              onChange={(event) => updateDraft("jobTitle", event.currentTarget.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contact-department">Department or function</Label>
            <Input
              id="contact-department"
              value={draft.department}
              placeholder="e.g. Revenue Operations"
              onChange={(event) => updateDraft("department", event.currentTarget.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contact-seniority">Seniority</Label>
            <Input
              id="contact-seniority"
              value={draft.seniority}
              placeholder="e.g. VP, Director, Manager"
              onChange={(event) => updateDraft("seniority", event.currentTarget.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contact-employment-status">Employment status</Label>
            <Select
              value={draft.employmentStatus}
              onValueChange={(value) => updateDraft("employmentStatus", value as ContactDraft["employmentStatus"])}
            >
              <SelectTrigger id="contact-employment-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="former">Former employee</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contact-email">Work email</Label>
            <Input
              id="contact-email"
              type="email"
              value={draft.workEmail}
              aria-invalid={invalidEmail}
              autoComplete="email"
              onChange={(event) => updateDraft("workEmail", event.currentTarget.value)}
            />
            {invalidEmail ? (
              <p className="text-sm text-destructive" role="alert">Enter a valid work email address.</p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contact-phone">Business phone</Label>
            <Input
              id="contact-phone"
              type="tel"
              value={draft.businessPhone}
              autoComplete="tel"
              onChange={(event) => updateDraft("businessPhone", event.currentTarget.value)}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="contact-linkedin">LinkedIn or professional profile URL</Label>
            <Input
              id="contact-linkedin"
              type="url"
              value={draft.linkedinUrl}
              placeholder="https://www.linkedin.com/in/..."
              onChange={(event) => updateDraft("linkedinUrl", event.currentTarget.value)}
            />
            {invalidLinkedInUrl ? (
              <p className="text-sm text-destructive" role="alert">Use a full http:// or https:// professional profile URL.</p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contact-location">Location</Label>
            <Input
              id="contact-location"
              value={draft.location}
              autoComplete="address-level2"
              onChange={(event) => updateDraft("location", event.currentTarget.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contact-timezone">Timezone</Label>
            <Input
              id="contact-timezone"
              value={draft.timezone}
              placeholder="e.g. Australia/Sydney"
              onChange={(event) => updateDraft("timezone", event.currentTarget.value)}
            />
          </div>
          {contact ? (
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="contact-created-date">Created date</Label>
              <Input id="contact-created-date" value={contact.createdAt} readOnly />
            </div>
          ) : null}
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="contact-private-notes">Private seller notes</Label>
            <Textarea
              id="contact-private-notes"
              value={draft.privateNotes}
              className="min-h-24 resize-none"
              placeholder="Relationship context or preparation notes. Never shared with the buyer."
              onChange={(event) => updateDraft("privateNotes", event.currentTarget.value)}
            />
          </div>
        </div>
      </section>

      {blockingDuplicate ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          A contact with this {duplicateEmail ? "work email" : "profile URL"} already exists: {blockingDuplicate.fullName}.
        </div>
      ) : possibleNameMatch ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300" role="status">
          Possible match: {possibleNameMatch.fullName}, {possibleNameMatch.jobTitle || "title not captured"}. You can still save this contact.
        </div>
      ) : null}

      <Separator />
      <section className="grid gap-4" aria-labelledby="contact-ai-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 id="contact-ai-heading" className="flex items-center gap-2 text-sm font-medium">
              <SparklesIcon className="size-4 text-primary" />
              AI insights
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">Uses public professional sources and only fills blank, high-confidence fields.</p>
          </div>
          <div className="flex min-h-11 items-center justify-between gap-3 sm:min-h-0 sm:justify-end">
            <Label htmlFor="contact-enrich-after-save" className="text-sm text-muted-foreground">Enrich after saving</Label>
            <Switch
              id="contact-enrich-after-save"
              checked={enrichAfterSave}
              onCheckedChange={setEnrichAfterSave}
            />
          </div>
        </div>
        {enrichAfterSave && !canEnrich ? (
          <p className="text-sm text-amber-700 dark:text-amber-300" role="status">
            Add a full name plus either the account domain or a professional profile URL to enrich this contact.
          </p>
        ) : null}
        {contact?.enrichment?.status === "failed" || contact?.enrichment?.status === "ambiguous" ? (
          <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300" role="alert">
            {contact.enrichment.statusMessage || (contact.enrichment.status === "ambiguous"
              ? "SalesFrame needs more identifying detail before enrichment can finish."
              : "Enrichment needs another attempt. Use Retry from the contact actions.")}
          </p>
        ) : null}
        {contact?.enrichment?.professionalSummary ? (
          <div className="grid gap-3 rounded-lg bg-muted/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Professional summary</p>
              <Badge variant="outline">{Math.round((contact.enrichment.confidence ?? 0) * 100)}% confidence</Badge>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{contact.enrichment.professionalSummary}</p>
            {contact.enrichment.roleScope ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Role scope</p>
                <p className="mt-1 text-sm leading-relaxed">{contact.enrichment.roleScope}</p>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <ContactInsightList title="Likely priorities" items={contact.enrichment.priorities} />
              <ContactInsightList title="Likely KPIs" items={contact.enrichment.kpis} />
              <ContactInsightList title="Relevant experience" items={contact.enrichment.relevantExperience} />
              <ContactInsightList title="Recent professional signals" items={contact.enrichment.recentSignals} />
              <ContactInsightList title="Discovery angles" items={contact.enrichment.discoveryAngles} />
              <ContactInsightList title="Caveats" items={contact.enrichment.caveats} tone="caution" />
            </div>
            {contact.enrichment.sources.some((source) => getSafeProfessionalProfileUrl(source.url)) ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Public sources</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {contact.enrichment.sources.map((source) => {
                    const safeUrl = getSafeProfessionalProfileUrl(source.url)
                    return safeUrl ? (
                      <a
                        key={`${source.title}-${safeUrl}`}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-md border bg-background px-3 text-sm text-primary underline-offset-4 hover:underline md:min-h-8"
                        href={safeUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLinkIcon className="size-3.5" />
                        {source.title}
                      </a>
                    ) : null
                  })}
                </div>
              </div>
            ) : null}
            {contact.enrichment.lastEnrichedAt ? (
              <p className="text-xs text-muted-foreground">Last enriched {contact.enrichment.lastEnrichedAt}</p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg bg-muted/20 p-3 text-sm text-muted-foreground">
            No AI insights yet. Enrichment is always optional and never overwrites seller-entered contact data.
          </div>
        )}
      </section>
      {message ? (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{message}</p>
      ) : null}
    </div>
  )

  const actions = confirmDiscard ? null : (
    <DialogActions
      className="mt-2"
      cancelDisabled={status === "saving"}
      onCancel={requestClose}
      primaryAction={
        <Button
          type="submit"
          disabled={!draft.fullName.trim() || Boolean(blockingDuplicate) || invalidEmail || invalidLinkedInUrl || (enrichAfterSave && !canEnrich) || status === "saving"}
          className="gap-2"
        >
          <CheckIcon />
          {status === "saving" ? "Saving..." : contact ? "Save contact" : "Add contact"}
        </Button>
      }
    />
  )

  const title = contact ? `Edit ${contact.fullName}` : "Add contact"
  const description = contact
    ? "Update reusable contact details and review AI insights."
    : "Add a person to this account. Opportunity roles are managed separately."
  const editorForm = (
    <form
      className="contents"
      onSubmit={(event) => {
        event.preventDefault()
        void handleSave()
      }}
    >
      {editorBody}
      {actions}
    </form>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : requestClose())}>
        <DrawerContent className="grid max-h-[94svh] min-h-[min(680px,94svh)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&_[data-slot=button]]:min-h-11 [&_[data-slot=input]]:min-h-11 [&_[data-slot=select-trigger]]:min-h-11">
          <DrawerHeader className="px-0 text-left">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          {editorForm}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : requestClose())}>
      <DialogContent dismissible className="grid max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {editorForm}
      </DialogContent>
    </Dialog>
  )
}

function ContactInsightList({
  items,
  title,
  tone = "default",
}: {
  items: string[]
  title: string
  tone?: "default" | "caution"
}) {
  if (!items.length) return null

  return (
    <div className={cn("rounded-md bg-background/70 p-3", tone === "caution" && "bg-amber-500/10")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-2 grid gap-1.5 text-sm">
        {items.slice(0, 5).map((item) => (
          <li key={item} className="flex gap-2">
            <span className={cn("mt-2 size-1.5 shrink-0 rounded-full bg-primary", tone === "caution" && "bg-amber-600")} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function EnrichmentBadge({ status }: { status: ContactEnrichmentStatus }) {
  const className =
    status === "completed"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : status === "failed" || status === "ambiguous"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : status === "queued" || status === "running"
          ? "border-primary/30 bg-primary/10 text-primary"
          : "text-muted-foreground"

  return <Badge variant="outline" className={className} role="status" aria-live="polite">{formatStatusLabel(status)}</Badge>
}

export function ContactsPanel({
  accountWebsite,
  contacts,
  externalStatusMessage,
  externalStatusTone = "status",
  focusedContactId = "",
  onArchive,
  onEnrich,
  onFocusedContactHandled,
  onOpenOpportunity,
  onRestore,
  onSave,
  opportunities,
  opportunityContacts,
}: {
  accountWebsite: string
  contacts: Contact[]
  externalStatusMessage?: string
  externalStatusTone?: "status" | "error"
  focusedContactId?: string
  onArchive: (contact: Contact) => Promise<void>
  onEnrich: (contact: Contact) => Promise<void>
  onFocusedContactHandled?: () => void
  onOpenOpportunity: (opportunityId: string) => void
  onRestore: (contact: Contact) => Promise<void>
  onSave: ContactSaveHandler
  opportunities: Opportunity[]
  opportunityContacts: OpportunityContact[]
}) {
  const [query, setQuery] = React.useState("")
  const [employmentFilter, setEmploymentFilter] = React.useState<"all" | "active" | "former" | "unknown">("active")
  const [enrichmentFilter, setEnrichmentFilter] = React.useState<"all" | "enriched" | "needs-enrichment">("all")
  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editingContact, setEditingContact] = React.useState<Contact | null>(null)
  const [actionMessage, setActionMessage] = React.useState("")
  const [actionKind, setActionKind] = React.useState<"archive" | "enrich" | "">("")
  const [actionTone, setActionTone] = React.useState<"status" | "error">("status")
  const [lastArchivedContactId, setLastArchivedContactId] = React.useState("")
  const [pendingContactId, setPendingContactId] = React.useState("")
  const [revealedContactId, setRevealedContactId] = React.useState("")
  const activeContactCount = contacts.filter((contact) => !contact.archivedAtIso).length
  const opportunityById = React.useMemo(
    () => new Map(opportunities.map((opportunity) => [opportunity.id, opportunity])),
    [opportunities]
  )
  React.useEffect(() => {
    if (!focusedContactId || !contacts.some((contact) => contact.id === focusedContactId && !contact.archivedAtIso)) return
    setRevealedContactId(focusedContactId)
    setQuery("")
    setEmploymentFilter("all")
    setEnrichmentFilter("all")
    onFocusedContactHandled?.()
  }, [focusedContactId, onFocusedContactHandled])
  React.useEffect(() => {
    if (!externalStatusMessage || actionKind !== "enrich") return
    setActionMessage("")
    setActionKind("")
  }, [actionKind, externalStatusMessage, externalStatusTone])
  const highlightedContactId = focusedContactId || revealedContactId
  const visibleContacts = React.useMemo(
    () => contacts
      .filter((contact) => {
        if (contact.archivedAtIso) return false
        if (!matchesContact(contact, query)) return false
        if (employmentFilter !== "all" && contact.employmentStatus !== employmentFilter) return false
        const status = getEnrichmentStatus(contact)
        if (enrichmentFilter === "enriched" && status !== "completed") return false
        if (enrichmentFilter === "needs-enrichment" && status === "completed") return false
        return true
      })
      .sort((left, right) => Number(right.id === highlightedContactId) - Number(left.id === highlightedContactId)),
    [contacts, employmentFilter, enrichmentFilter, highlightedContactId, query]
  )

  const linkedOpportunityNames = (contactId: string) =>
    opportunityContacts
      .filter((relationship) => relationship.contactId === contactId)
      .map((relationship) => opportunityById.get(relationship.opportunityId)?.name)
      .filter(Boolean) as string[]

  const runContactAction = async (contact: Contact, action: "archive" | "enrich") => {
    setPendingContactId(contact.id)
    setActionMessage("")
    setActionKind(action)
    setActionTone("status")
    try {
      await (action === "archive" ? onArchive(contact) : onEnrich(contact))
      setActionKind(action)
      setLastArchivedContactId(action === "archive" ? contact.id : "")
      setActionMessage(
        action === "archive"
          ? `${contact.fullName} was archived. Historical opportunity and call links are preserved.`
          : `Enrichment for ${contact.fullName} is queued. You can keep working while it runs.`
      )
    } catch (error: unknown) {
      setActionTone("error")
      setActionMessage(error instanceof Error ? error.message : "Contact action needs another attempt.")
    } finally {
      setPendingContactId("")
    }
  }

  const undoLastArchive = async () => {
    const contact = contacts.find((item) => item.id === lastArchivedContactId)
    if (!contact) return
    setPendingContactId(contact.id)
    setActionTone("status")
    try {
      await onRestore(contact)
      setLastArchivedContactId("")
      setActionKind("")
      setActionMessage(`${contact.fullName} was restored.`)
    } catch (error: unknown) {
      setActionTone("error")
      setActionMessage(error instanceof Error ? error.message : "Contact restore needs another attempt.")
    } finally {
      setPendingContactId("")
    }
  }

  const openNewContact = () => {
    setEditingContact(null)
    setEditorOpen(true)
  }

  const openEditContact = (contact: Contact) => {
    setEditingContact(contact)
    setEditorOpen(true)
  }

  return (
    <Card className="w-full min-w-0">
      <CardHeader>
        <div>
          <CardTitle>Account contacts</CardTitle>
          <CardDescription>People linked to this account, with opportunity-specific buying roles managed separately.</CardDescription>
        </div>
        <CardAction>
          <Button type="button" size="sm" className="min-h-11 w-full gap-2 md:min-h-8 sm:w-auto" onClick={openNewContact}>
            <PlusIcon />
            Add contact
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_190px]">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search account contacts"
              value={query}
              className="h-11 pl-9 md:h-9"
              placeholder="Search name, title, email, phone or profile"
              onChange={(event) => {
                setRevealedContactId("")
                setQuery(event.currentTarget.value)
              }}
            />
          </div>
          <Select value={employmentFilter} onValueChange={(value) => {
            setRevealedContactId("")
            setEmploymentFilter(value as typeof employmentFilter)
          }}>
            <SelectTrigger className="h-11 w-full md:h-9" aria-label="Filter contacts by employment status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active contacts</SelectItem>
              <SelectItem value="former">Former contacts</SelectItem>
              <SelectItem value="unknown">Unknown employment</SelectItem>
              <SelectItem value="all">All contacts</SelectItem>
            </SelectContent>
          </Select>
          <Select value={enrichmentFilter} onValueChange={(value) => {
            setRevealedContactId("")
            setEnrichmentFilter(value as typeof enrichmentFilter)
          }}>
            <SelectTrigger className="h-11 w-full md:h-9" aria-label="Filter contacts by enrichment status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All enrichment</SelectItem>
              <SelectItem value="enriched">Enriched</SelectItem>
              <SelectItem value="needs-enrichment">Needs enrichment</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {actionMessage || externalStatusMessage ? (
          <div
            className={cn(
              "flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg p-3 text-sm",
              (actionMessage ? actionTone : externalStatusTone) === "error"
                ? "bg-destructive/10 text-destructive"
                : "bg-muted/30 text-muted-foreground"
            )}
            role={(actionMessage ? actionTone : externalStatusTone) === "error" ? "alert" : "status"}
          >
            <span>{actionMessage || externalStatusMessage}</span>
            {actionMessage && lastArchivedContactId ? (
              <Button type="button" variant="outline" size="sm" className="min-h-11 md:min-h-8" disabled={Boolean(pendingContactId)} onClick={() => void undoLastArchive()}>
                Undo archive
              </Button>
            ) : null}
          </div>
        ) : null}

        {visibleContacts.length ? (
          <div className="grid gap-3 md:hidden" data-testid="account-contacts-mobile-list">
            {visibleContacts.map((contact) => {
              const opportunityNames = linkedOpportunityNames(contact.id)
              const canEnrich = Boolean(contact.fullName && (accountWebsite || contact.linkedinUrl))

              return (
                <article
                  key={contact.id}
                  data-focused={contact.id === highlightedContactId || undefined}
                  className={cn("grid gap-3 rounded-lg border bg-background p-3", contact.id === highlightedContactId && "ring-2 ring-primary/30")}
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <ContactIdentity contact={contact} />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" aria-label={`Actions for ${contact.fullName}`}>
                          <MoreHorizontalIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => openEditContact(contact)}><PencilIcon />Edit</DropdownMenuItem>
                        {opportunityContacts
                          .filter((relationship) => relationship.contactId === contact.id)
                          .map((relationship) => opportunityById.get(relationship.opportunityId))
                          .filter(Boolean)
                          .map((opportunity) => (
                            <DropdownMenuItem key={opportunity!.id} onSelect={() => onOpenOpportunity(opportunity!.id)}>
                              <ExternalLinkIcon />Open {opportunity!.name}
                            </DropdownMenuItem>
                          ))}
                        <DropdownMenuItem disabled={!canEnrich || pendingContactId === contact.id} onSelect={() => void runContactAction(contact, "enrich")}>
                          <SparklesIcon />{getEnrichmentStatus(contact) === "completed" ? "Refresh enrichment" : "Enrich contact"}
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" disabled={pendingContactId === contact.id} onSelect={() => void runContactAction(contact, "archive")}>
                          <ArchiveIcon />Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="grid gap-2 text-sm text-muted-foreground">
                    {contact.workEmail ? <span className="flex items-center gap-2 break-all"><MailIcon className="size-4 shrink-0" />{contact.workEmail}</span> : null}
                    {contact.businessPhone ? <span className="flex items-center gap-2"><PhoneIcon className="size-4 shrink-0" />{contact.businessPhone}</span> : null}
                    {getSafeProfessionalProfileUrl(contact.linkedinUrl) ? (
                      <a className="flex min-h-11 items-center gap-2 text-primary underline-offset-4 hover:underline" href={getSafeProfessionalProfileUrl(contact.linkedinUrl)} target="_blank" rel="noreferrer">
                        <ExternalLinkIcon className="size-4 shrink-0" />Professional profile
                      </a>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <EnrichmentBadge status={getEnrichmentStatus(contact)} />
                    <Badge variant="outline">{formatStatusLabel(contact.employmentStatus)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {opportunityNames.length ? opportunityNames.join(" · ") : "Not linked to an opportunity"} · Created {contact.createdAt}
                  </p>
                </article>
              )
            })}
          </div>
        ) : null}

        {visibleContacts.length ? (
          <div className="hidden overflow-hidden rounded-lg border md:block" data-testid="account-contacts-table">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-[20%] pl-3">Contact</TableHead>
                  <TableHead className="w-[17%]">Title / function</TableHead>
                  <TableHead className="w-[19%]">Contact details</TableHead>
                  <TableHead className="w-[15%]">Linked opportunities</TableHead>
                  <TableHead className="w-[12%]">Enrichment status</TableHead>
                  <TableHead className="w-[9%]">Created date</TableHead>
                  <TableHead className="w-[8%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleContacts.map((contact) => {
                  const opportunityNames = linkedOpportunityNames(contact.id)
                  const canEnrich = Boolean(contact.fullName && (accountWebsite || contact.linkedinUrl))

                  return (
                    <TableRow key={contact.id} data-focused={contact.id === highlightedContactId || undefined} className={contact.id === highlightedContactId ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : undefined}>
                      <TableCell className="max-w-0 pl-3 whitespace-normal">
                        <ContactIdentity contact={contact} compact />
                      </TableCell>
                      <TableCell className="max-w-0 whitespace-normal">
                        <p className="truncate">{contact.jobTitle || "Not captured"}</p>
                        <p className="truncate text-xs text-muted-foreground">{contact.department || contact.seniority || "Function not captured"}</p>
                      </TableCell>
                      <TableCell className="max-w-0 whitespace-normal">
                        <p className="truncate text-sm">{contact.workEmail || contact.businessPhone || "Not captured"}</p>
                        {contact.linkedinUrl ? <p className="truncate text-xs text-muted-foreground">Professional profile saved</p> : null}
                      </TableCell>
                      <TableCell className="max-w-0 whitespace-normal">
                        <p className="line-clamp-2 text-sm">{opportunityNames.length ? opportunityNames.join(", ") : "None"}</p>
                      </TableCell>
                      <TableCell><EnrichmentBadge status={getEnrichmentStatus(contact)} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{contact.createdAt}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" size="icon-sm" variant="ghost" aria-label={`Actions for ${contact.fullName}`}>
                              <MoreHorizontalIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => openEditContact(contact)}><PencilIcon />Edit</DropdownMenuItem>
                            {opportunityContacts
                              .filter((relationship) => relationship.contactId === contact.id)
                              .map((relationship) => opportunityById.get(relationship.opportunityId))
                              .filter(Boolean)
                              .map((opportunity) => (
                                <DropdownMenuItem key={opportunity!.id} onSelect={() => onOpenOpportunity(opportunity!.id)}>
                                  <ExternalLinkIcon />Open {opportunity!.name}
                                </DropdownMenuItem>
                              ))}
                            <DropdownMenuItem disabled={!canEnrich || pendingContactId === contact.id} onSelect={() => void runContactAction(contact, "enrich")}>
                              <SparklesIcon />{getEnrichmentStatus(contact) === "completed" ? "Refresh enrichment" : "Enrich contact"}
                            </DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" disabled={pendingContactId === contact.id} onSelect={() => void runContactAction(contact, "archive")}>
                              <ArchiveIcon />Archive
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid min-h-56 place-items-center rounded-lg border border-dashed p-6 text-center">
            <div className="grid max-w-sm justify-items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"><UsersRoundIcon className="size-5" /></span>
              <div>
                <p className="font-medium">{activeContactCount ? "No contacts match these filters" : "No active contacts"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeContactCount ? "Try a broader search or filter." : "Add a contact, or use Undo immediately after archiving one."}
                </p>
              </div>
              {!activeContactCount ? <Button type="button" className="min-h-11 gap-2" onClick={openNewContact}><PlusIcon />Add contact</Button> : null}
            </div>
          </div>
        )}
      </CardContent>
      <ContactEditor
        accountWebsite={accountWebsite}
        contact={editingContact}
        contacts={contacts}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSave={onSave}
      />
    </Card>
  )
}

function BuyingRoleMultiSelect({
  contactName,
  disabled = false,
  onChange,
  value,
}: {
  contactName: string
  disabled?: boolean
  onChange: (roles: ContactBuyingRole[]) => void
  value: ContactBuyingRole[]
}) {
  const [open, setOpen] = React.useState(false)
  const listboxRef = React.useRef<HTMLDivElement | null>(null)
  const listboxId = React.useId()

  React.useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  const moveRoleFocus = (currentTarget: HTMLButtonElement, direction: "first" | "last" | "next" | "previous") => {
    const options = Array.from(
      listboxRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)') ?? []
    )
    if (!options.length) return
    const currentIndex = options.indexOf(currentTarget)
    const nextIndex = direction === "first"
      ? 0
      : direction === "last"
        ? options.length - 1
        : direction === "next"
          ? Math.min(options.length - 1, currentIndex + 1)
          : Math.max(0, currentIndex - 1)
    options[nextIndex]?.focus()
  }

  return (
    <Popover open={open} onOpenChange={(nextOpen) => !disabled && setOpen(nextOpen)}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="min-h-11 w-full justify-between gap-2 font-normal md:min-h-9" aria-label={`Buying roles for ${contactName}`} aria-controls={listboxId} aria-expanded={open} aria-haspopup="listbox" disabled={disabled} role="combobox">
          <span className="truncate">{value.length ? value.map(formatBuyingRole).join(", ") : "Add buying roles"}</span>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-2">
        <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">Buying roles for {contactName}</p>
        <div id={listboxId} ref={listboxRef} className="grid max-h-72 gap-1 overflow-y-auto" role="listbox" aria-multiselectable="true">
          {contactBuyingRoles.map((role) => {
            const selected = value.includes(role)
            return (
              <button
                key={role}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={disabled}
                className="flex min-h-11 items-center justify-between gap-3 rounded-md px-2 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onChange(selected ? value.filter((item) => item !== role) : [...value, role])}
                onKeyDown={(event) => {
                  const direction = event.key === "ArrowDown"
                    ? "next"
                    : event.key === "ArrowUp"
                      ? "previous"
                      : event.key === "Home"
                        ? "first"
                        : event.key === "End"
                          ? "last"
                          : null
                  if (direction) {
                    event.preventDefault()
                    moveRoleFocus(event.currentTarget, direction)
                  } else if (event.key === "Escape") {
                    setOpen(false)
                  }
                }}
              >
                <span className="text-sm">{formatBuyingRole(role)}</span>
                <span className={cn("flex size-5 items-center justify-center rounded border", selected && "border-primary bg-primary text-primary-foreground")}>
                  {selected ? <CheckIcon className="size-3.5" /> : null}
                </span>
              </button>
            )
          })}
        </div>
        <div className="mt-2 flex justify-end border-t pt-2"><Button type="button" size="sm" onClick={() => setOpen(false)}>Done</Button></div>
      </PopoverContent>
    </Popover>
  )
}

export function OpportunityContactsCard({
  contacts,
  onRelationshipChange,
  onSelectionChange,
  opportunityContacts,
}: {
  contacts: Contact[]
  onRelationshipChange: (contactId: string, patch: OpportunityContactPatch) => Promise<void>
  onSelectionChange: (contactIds: string[]) => Promise<void>
  opportunityContacts: OpportunityContact[]
}) {
  const [status, setStatus] = React.useState<"idle" | "saving" | "error">("idle")
  const [message, setMessage] = React.useState("")
  const savingRef = React.useRef(false)
  const isSaving = status === "saving"
  const selectedIds = opportunityContacts.map((relationship) => relationship.contactId)
  const contactById = React.useMemo(() => new Map(contacts.map((contact) => [contact.id, contact])), [contacts])

  const saveSelection = async (contactIds: string[]) => {
    if (savingRef.current) return
    savingRef.current = true
    setStatus("saving")
    setMessage("")
    try {
      await onSelectionChange(contactIds)
      setStatus("idle")
    } catch (error: unknown) {
      setStatus("error")
      setMessage(error instanceof Error ? error.message : "Opportunity contacts need another save attempt.")
    } finally {
      savingRef.current = false
    }
  }

  const updateRelationship = async (contactId: string, patch: OpportunityContactPatch) => {
    if (savingRef.current) return
    savingRef.current = true
    setStatus("saving")
    setMessage("")
    try {
      await onRelationshipChange(contactId, patch)
      setStatus("idle")
    } catch (error: unknown) {
      setStatus("error")
      setMessage(error instanceof Error ? error.message : "Contact role needs another save attempt.")
    } finally {
      savingRef.current = false
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Opportunity contacts</CardTitle>
          <CardDescription>Link account contacts and capture how each person participates in this deal.</CardDescription>
        </div>
        <CardAction>{status === "saving" ? <span className="text-xs text-muted-foreground" role="status">Saving contacts…</span> : null}</CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="opportunity-contacts">Contacts</Label>
          <ContactMultiSelect
            id="opportunity-contacts"
            contacts={contacts}
            disabled={isSaving}
            value={selectedIds}
            onChange={(contactIds) => void saveSelection(contactIds)}
          />
          <p className="text-xs text-muted-foreground">Removing a contact here does not delete the contact or their historical call participation.</p>
        </div>
        {message ? <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{message}</p> : null}
        {opportunityContacts.length ? <Separator /> : null}
        <div className="grid gap-3">
          {opportunityContacts.map((relationship) => {
            const contact = contactById.get(relationship.contactId)
            if (!contact) return null

            return (
              <article key={relationship.id || relationship.contactId} className="grid gap-3 rounded-lg bg-muted/20 p-3">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <ContactIdentity contact={contact} />
                    {contact.archivedAtIso ? <Badge variant="outline">Archived</Badge> : null}
                  </div>
                  <div className="flex min-h-11 items-center justify-between gap-3 sm:min-h-0 sm:justify-end">
                    <Label htmlFor={`primary-contact-${contact.id}`} className="text-sm text-muted-foreground">Primary</Label>
                    <Switch
                      id={`primary-contact-${contact.id}`}
                      checked={relationship.isPrimary}
                      disabled={isSaving}
                      onCheckedChange={(checked) => void updateRelationship(contact.id, { isPrimary: checked })}
                    />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="grid gap-2 xl:col-span-2">
                    <Label>Buying roles</Label>
                    <BuyingRoleMultiSelect
                      contactName={contact.fullName}
                      disabled={isSaving}
                      value={relationship.buyingRoles}
                      onChange={(buyingRoles) => void updateRelationship(contact.id, { buyingRoles })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`contact-influence-${contact.id}`}>Influence</Label>
                    <Select disabled={isSaving} value={relationship.influence} onValueChange={(influence) => void updateRelationship(contact.id, { influence: influence as OpportunityContact["influence"] })}>
                      <SelectTrigger id={`contact-influence-${contact.id}`} className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{["high", "medium", "low", "unknown"].map((value) => <SelectItem key={value} value={value}>{formatStatusLabel(value)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`contact-relationship-${contact.id}`}>Relationship</Label>
                    <Select disabled={isSaving} value={relationship.relationshipStrength} onValueChange={(relationshipStrength) => void updateRelationship(contact.id, { relationshipStrength: relationshipStrength as OpportunityContact["relationshipStrength"] })}>
                      <SelectTrigger id={`contact-relationship-${contact.id}`} className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{["strong", "developing", "weak", "unknown"].map((value) => <SelectItem key={value} value={value}>{formatStatusLabel(value)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`contact-stance-${contact.id}`}>Stance</Label>
                    <Select disabled={isSaving} value={relationship.stance} onValueChange={(stance) => void updateRelationship(contact.id, { stance: stance as OpportunityContact["stance"] })}>
                      <SelectTrigger id={`contact-stance-${contact.id}`} className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{["supportive", "neutral", "resistant", "unknown"].map((value) => <SelectItem key={value} value={value}>{formatStatusLabel(value)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2 md:col-span-2 xl:col-span-3">
                    <Label htmlFor={`contact-deal-notes-${contact.id}`}>Deal-specific notes</Label>
                    <Textarea
                      id={`contact-deal-notes-${contact.id}`}
                      defaultValue={relationship.notes}
                      className="min-h-20 resize-none"
                      disabled={isSaving}
                      onBlur={(event) => {
                        if (event.currentTarget.value === relationship.notes) return
                        void updateRelationship(contact.id, { notes: event.currentTarget.value })
                      }}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="button" variant="ghost" size="sm" className="min-h-11 gap-2 text-destructive hover:text-destructive md:min-h-8" disabled={isSaving} onClick={() => void saveSelection(selectedIds.filter((id) => id !== contact.id))}>
                    <XIcon />Remove from opportunity
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
        {!opportunityContacts.length ? (
          <div className="grid min-h-36 place-items-center rounded-lg border border-dashed p-5 text-center">
            <div className="grid max-w-sm justify-items-center gap-2">
              <UserRoundIcon className="size-5 text-muted-foreground" />
              <p className="text-sm font-medium">No contacts linked yet</p>
              <p className="text-xs text-muted-foreground">Select one or more account contacts to track buying roles, influence, relationship and stance.</p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
