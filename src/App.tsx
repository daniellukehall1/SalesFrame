import * as React from "react"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import {
  ArrowLeftIcon,
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ArchiveIcon,
  AudioLinesIcon,
  BookOpenCheckIcon,
  BotIcon,
  Building2Icon,
  ChartNoAxesColumnIncreasingIcon,
  ChevronDownIcon,
  CheckCircle2Icon,
  CheckIcon,
  CircleAlertIcon,
  CircleDotIcon,
  ClipboardCheckIcon,
  Clock3Icon,
  DatabaseIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileAudioIcon,
  FileTextIcon,
  FilterIcon,
  ImageIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  Mic2Icon,
  MoonIcon,
  PhoneCallIcon,
  PlusIcon,
  RadioIcon,
  SearchIcon,
  SendIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SquareIcon,
  SquarePenIcon,
  SunIcon,
  Table2Icon,
  TargetIcon,
  Trash2Icon,
  Undo2Icon,
  UserRoundCheckIcon,
  UsersRoundIcon,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { AccountLogoAvatar } from "@/components/account-logo-avatar"
import type { AuthMode } from "@/components/auth-page"
import type { LoginFormValues } from "@/components/login-form"
import { type AccountNavItem } from "@/components/nav-projects"
import type { SignupFormValues } from "@/components/signup-form"
import type { WorkspaceNavItem, WorkspaceSavePayload } from "@/components/workspace-switcher"
import { WorkspaceIconPicker } from "@/components/workspace-icon-picker"
import { buildAccountLogoMetadata } from "@/lib/account-logo"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { DialogActions } from "@/components/ui/dialog-actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageGroup,
  MessageHeader,
} from "@/components/ui/message"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PlaybookIcon } from "@/data/playbook-icons"
import { playbooks } from "@/data/playbook-reference-data"
import type { LegalPageId } from "@/data/legal-documents"
import { calculateAudioMeterPercent, smoothAudioMeterLevel } from "@/lib/audio-level-meter"
import {
  useCallCapture,
  type CallCapturePermissionState,
  type CallCaptureStatus,
} from "@/hooks/use-call-capture"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  calculateAudioRms,
  getMeetingAudioDisplayOptions,
  getMicrophoneAudioConstraints,
  type AudioPreflightResult,
} from "@/lib/call-audio-preflight"
import {
  enumerateAudioDevices,
  getDefaultAudioDeviceId,
  getPreferredAudioInputDeviceId,
  getSharedAudioBrowserGuidance,
  getSharedAudioNoTrackMessage,
  getSharedAudioUnsupportedMessage,
  readPreferredAudioInputDeviceId,
  writePreferredAudioInputDeviceId,
  type AudioDeviceOption,
} from "@/lib/audio-device-setup"
import { sectionCards, viewLabels } from "@/data/navigation-content"
import { formatCurrencyAmount } from "@/lib/currency-utils"
import { makeFailedRowsCsv, type CsvImportType } from "@/lib/csv-import"
import { reportClientError } from "@/lib/client-error-reporting"
import { normalizeCloseDateForPersistence } from "@/lib/date-utils"
import { getUserFacingErrorMessage, isPermissionDeniedError } from "@/lib/user-facing-errors"
import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/lib/supabase/database.types"
import {
  appendErrorReference,
  checkDeepgramTranscriptionHealth,
  checkOpenAiWorkspaceHealth,
  deleteOpenAiKey,
  getBulkImportStatus,
  getOpenAiKeyStatus,
  getWorkspaceSessionPolicy,
  getWorkspaceSessionStatus,
  recordWorkspaceSessionActivity,
  retryFailedBulkEnrichment,
  requestAccountEnrichment,
  requestCustomerResearch,
  requestLiveGuidance,
  requestLiveQuestion,
  requestLiveState,
  requestPostCallOutputs,
  requestSellerDomainResearch,
  saveOpenAiKey,
  saveWorkspaceSessionPolicy,
  type BulkImportStatusResponse,
  type OpenAiKeyStatus,
  type WorkspaceSessionPolicy,
  type WorkspaceSessionStatusResponse,
} from "@/lib/server-functions"
import {
  getPlaybookIdsForSelection,
  mapAccountRowsToDrafts,
  mapAccountRowToDraft,
  mapAccountRowsToNavItems,
  mapCallRowsToSummaries,
  mapCustomerResearchRunsToAccountConfig,
  mapOpportunityRowToDraft,
  mapOpportunityRowToUi,
  mapOpportunityRowsToDrafts,
  mapOpportunityRowsToUi,
  mapSellerResearchProfileRow,
  mapWorkspaceRowToNavItem,
} from "@/lib/supabase/salesframe-adapters"
import {
  archiveAccount as archiveSupabaseAccount,
  archiveOpportunity as archiveSupabaseOpportunity,
  createAccount as createSupabaseAccount,
  createCall as createSupabaseCall,
  createCallRecordingSignedUrl,
  createOpportunity as createSupabaseOpportunity,
  createWorkspace as createSupabaseWorkspace,
  deleteAccount as deleteSupabaseAccount,
  deleteCall as deleteSupabaseCall,
  deleteOpportunity as deleteSupabaseOpportunity,
  deleteWorkspace as deleteSupabaseWorkspace,
  getCurrentUserProfile,
  getSellerResearchProfile,
  insertLiveGuidanceFeedback,
  listAccountEnrichmentProfiles,
  listArchivedAccounts,
  listArchivedOpportunities,
  listCallNotes,
  listCallSpeakers,
  listCustomerResearchRunsForAccounts,
  listNextCallBriefs,
  listOpportunityFieldEvidence,
  listOpportunityPlaybookAssignments,
  listPlaybookFields,
  listPostCallOutputs,
  listTranscriptSegments,
  listWorkspaceAccounts,
  listWorkspaceCalls,
  listWorkspaceOpportunities,
  listWorkspacePlaybooks,
  listWorkspaces,
  markWorkspaceOnboardingComplete,
  replaceCallPlaybooks,
  replaceOpportunityPlaybooks,
  replacePlaybookFields,
  updateAccount as updateSupabaseAccount,
  updateCall as updateSupabaseCall,
  updateCurrentUserProfile,
  updateOpportunity as updateSupabaseOpportunity,
  updateTranscriptSegment,
  updateWorkspace as updateSupabaseWorkspace,
  unarchiveAccount as unarchiveSupabaseAccount,
  unarchiveOpportunity as unarchiveSupabaseOpportunity,
  upsertAccountEnrichmentProfile,
  upsertWorkspaceCustomPlaybook,
  upsertCallSpeaker,
  upsertSellerResearchProfile,
  type AccountEnrichmentProfileRow,
  type AccountRow,
  type CallSpeakerRow,
  type OpportunityRow,
  type PlaybookFieldRow,
  type PlaybookRow,
  type PostCallOutputRow,
  type TranscriptSegmentRow,
} from "@/lib/supabase/salesframe-data"
import {
  getAccountSearchText,
  getCallSearchText,
  getFuzzyMatches,
  getOpportunitySearchText,
  matchesCoverageFilter,
  normalizeSearchText,
  parseOpportunityAmount,
  sortOpportunities,
} from "@/lib/fuzzy-search"
import {
  createManualQuestionId,
  createManualQuestionFromGuidance,
  getDisplayedLiveCoachQuestion,
} from "@/lib/manual-coach"
import {
  createLiveCoachPopoutSourceId,
  getLiveCoachPopoutCommandKey,
  isFreshLiveCoachPopoutCommand,
  isLiveCoachPopoutCommand,
  isLiveCoachPopoutRoute,
  liveCoachPopoutChannelName,
  liveCoachPopoutCommandStorageKey,
  liveCoachPopoutRoute,
  liveCoachPopoutVersion,
  writeStoredLiveCoachPopoutAcknowledgement,
  writeStoredLiveCoachPopoutSnapshot,
  type LiveCoachPopoutCommandAcknowledgement,
  type LiveCoachPopoutCallStatus,
  type LiveCoachPopoutCommand,
  type LiveCoachPopoutSnapshot,
} from "@/lib/live-coach-popout"
import { formatSavedAt } from "@/lib/openai-key-storage"
import { formatPlaybooks, normalizePlaybooks, parsePlaybookSelection } from "@/lib/playbook-utils"
import {
  createStarterOpportunity,
  hasStarterOpportunityGuidance,
} from "@/lib/record-factories"
import {
  areSellerResearchProfilesEqual,
  inferCompanyNameFromDomain,
  inferSellerResearchProfile,
  normalizeComparableText,
  normalizeSellerDomain,
} from "@/lib/research-profile"
import {
  defaultWorkspaceIconId,
  normalizeWorkspaceIconId,
  type WorkspaceIconId,
} from "@/lib/workspace-icons"
import {
  callPlaybookDescriptions,
  callPlaybookOptions,
  currencyLabels,
  currencyOptions,
  defaultCurrencyCode,
  defaultCallPlaybooks,
  defaultCustomerResearch,
  defaultSellerResearchProfile,
  LIVE_CALL_FINAL_WARNING_SECONDS,
  LIVE_CALL_WARNING_SECONDS,
  MAX_LIVE_CALL_SECONDS,
  normalizeCurrencyCode,
  workspaceDataStateOptions,
  type AccountDraft,
  type CallEndedReason,
  type CallSummary,
  type CallAudioCaptureMode,
  type CallPlaybook,
  type CurrencyCode,
  type CreateAccountPayload,
  type CreateOpportunityPayload,
  type CustomerResearchConfig,
  type EditAccountPayload,
  type EditOpportunityPayload,
  type LiveGuidance,
  type LiveSellerFeedbackAction,
  type ManualCoachState,
  type ManualQuestion,
  type NextCallBrief,
  type Opportunity,
  type OpportunityCoverageFilter,
  type OpportunityDraft,
  type OpportunitySort,
  type PendingArchiveRecord,
  type PendingDeleteRecord,
  type RecordingLifecycleStatus,
  type SavedOpenAiKeyState,
  type SellerResearchProfile,
  type StartCallPreparationStepId,
  type StartRecordingHandler,
  type StartRecordingPayload,
  type TranscriptSpeaker,
  type WorkspaceDataState,
} from "@/lib/salesframe-core"
import { cn } from "@/lib/utils"

const AuthPage = React.lazy(() =>
  import("@/components/auth-page").then((module) => ({ default: module.AuthPage }))
)
const LegalDocumentPage = React.lazy(() =>
  import("@/components/legal-document-page").then((module) => ({ default: module.LegalDocumentPage }))
)
const MarketingLandingPage = React.lazy(() =>
  import("@/components/marketing-landing-page").then((module) => ({ default: module.MarketingLandingPage }))
)
const LiveCoachPopoutWindow = React.lazy(() => import("@/components/live-coach-popout-window"))
const CsvImportDialog = React.lazy(() =>
  import("@/components/csv-import-dialog").then((module) => ({ default: module.CsvImportDialog }))
)

type PersonalAccountProfile = {
  avatarUrl: string
  fullName: string
  email: string
  title: string
  company: string
  role: string
  region: string
  timezone: string
  phone: string
  linkedin: string
  bio: string
}

type AuthSession = {
  userId: string
  email: string
  name: string
  signedInAt: string
}

type RecordMutationResult =
  | {
      ok: true
    }
  | {
      message: string
      ok: false
    }

type CallSpeakerIdentity = {
  displayName: string
  isMe?: boolean
  label: TranscriptSpeaker
}

type CallSpeakerIdentityMap = Partial<Record<TranscriptSpeaker, CallSpeakerIdentity>>

type SpeakerIdentityChangePayload = {
  displayName: string
  isMe?: boolean
  label: TranscriptSpeaker
}

type SpeakerIdentityChangeResult = {
  message: string
  persistence: "saved" | "local"
}

type PublicAuthRoute = "landing" | "login" | "signup"

const initialPersonalAccountProfile: PersonalAccountProfile = {
  avatarUrl: "",
  fullName: "SalesFrame Seller",
  email: "",
  title: "Seller",
  company: "",
  role: "Individual seller",
  region: "Australia",
  timezone: "Australia/Sydney",
  phone: "",
  linkedin: "",
  bio: "",
}

const timezoneOptions = [
  { value: "Australia/Sydney", label: "Australia/Sydney" },
  { value: "Australia/Melbourne", label: "Australia/Melbourne" },
  { value: "Australia/Brisbane", label: "Australia/Brisbane" },
  { value: "Australia/Adelaide", label: "Australia/Adelaide" },
  { value: "Australia/Perth", label: "Australia/Perth" },
  { value: "Australia/Darwin", label: "Australia/Darwin" },
  { value: "Pacific/Auckland", label: "Pacific/Auckland" },
  { value: "Asia/Singapore", label: "Asia/Singapore" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Europe/Paris", label: "Europe/Paris" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "America/Chicago", label: "America/Chicago" },
  { value: "America/Denver", label: "America/Denver" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles" },
] as const

const workspaceSessionTimeoutOptions = [
  { label: "1 hour", value: "3600" },
  { label: "4 hours", value: "14400" },
  { label: "8 hours", value: "28800" },
  { label: "24 hours", value: "86400" },
  { label: "1 week", value: "604800" },
  { label: "Never", value: "never" },
] as const

const workspaceSessionExpiredMessage = "We signed you out to keep your workspace safe."
const workspaceSessionActivityThrottleMs = 60_000
const workspaceSessionLiveHeartbeatMs = 60_000

const profileRouteIds = ["profile-account"]
const settingsRouteIds = ["settings", "capture", "retention", "ai"]
const breadcrumbOpportunityViews = [
  "methodology",
  "opportunity-record",
  "opportunity-intelligence",
]
const breadcrumbCallViews = ["workspace", "post-call"]
const breadcrumbLibraryViews = ["calls"]
const breadcrumbPlaybookDetailViews = [
  "meddicc",
  "meddpicc",
  "bant",
  "force-management",
  "spin",
  "sandler",
  "challenger",
  "gap-selling",
  "value-selling",
  "strategic-selling",
  "spiced",
  "custom",
]
const breadcrumbSettingsDetailViews = ["capture", "retention", "ai"]
const mobileStartCallInlineActionViews = [
  "home",
  "calls",
  "account-detail",
  "workspace",
  "post-call",
  "methodology",
  "opportunity-record",
  "opportunity-intelligence",
]
const mobileStartCallViews = [
  ...mobileStartCallInlineActionViews,
  "opportunities",
  ...profileRouteIds,
  ...settingsRouteIds,
  "playbooks",
  ...breadcrumbPlaybookDetailViews,
]
const minimumWorkspaceLoadMs = 3000
const minimumPageLoadMs = 700
const sellerDomainLookupDebounceMs = 2000
const colorModeStorageKey = "salesframe.color-mode"
const captureSettingsStorageKey = "salesframe.capture-settings"

type CaptureSettings = {
  browserTab: boolean
  inPersonMic: boolean
}

type AudioSourceChoice = "one_channel" | "two_channels" | "meeting_bot"

const defaultCaptureSettings: CaptureSettings = {
  browserTab: true,
  inPersonMic: true,
}

function getInitialDarkMode() {
  if (typeof window === "undefined") return false

  try {
    return window.localStorage.getItem(colorModeStorageKey) === "dark"
  } catch {
    return false
  }
}

function getCaptureSettingsStorageKey(workspaceId: string) {
  return `${captureSettingsStorageKey}.${workspaceId || "default"}`
}

function readCaptureSettings(workspaceId: string): CaptureSettings {
  if (typeof window === "undefined") return defaultCaptureSettings

  try {
    const stored = window.localStorage.getItem(getCaptureSettingsStorageKey(workspaceId))
    if (!stored) return defaultCaptureSettings

    const parsed = JSON.parse(stored) as Partial<CaptureSettings>

    return {
      browserTab: typeof parsed.browserTab === "boolean" ? parsed.browserTab : defaultCaptureSettings.browserTab,
      inPersonMic: typeof parsed.inPersonMic === "boolean" ? parsed.inPersonMic : defaultCaptureSettings.inPersonMic,
    }
  } catch {
    return defaultCaptureSettings
  }
}

function saveCaptureSettings(workspaceId: string, settings: CaptureSettings) {
  if (typeof window === "undefined") return false

  try {
    window.localStorage.setItem(getCaptureSettingsStorageKey(workspaceId), JSON.stringify(settings))
    return true
  } catch {
    return false
  }
}

function getPreferredAudioCaptureMode(settings: CaptureSettings): CallAudioCaptureMode {
  if (settings.browserTab) return "meeting_audio"
  if (settings.inPersonMic) return "in_person_microphone"

  return "microphone"
}

function isAudioCaptureModeEnabled(settings: CaptureSettings, mode: CallAudioCaptureMode) {
  if (mode === "meeting_audio") return settings.browserTab
  if (mode === "in_person_microphone") return settings.inPersonMic

  return true
}

function getAudioSourceChoice(mode: CallAudioCaptureMode): AudioSourceChoice {
  return mode === "meeting_audio" ? "two_channels" : "one_channel"
}

function getAudioCaptureModeForChoice(choice: AudioSourceChoice, settings: CaptureSettings): CallAudioCaptureMode {
  if (choice === "two_channels") return "meeting_audio"
  if (choice === "one_channel") return settings.inPersonMic ? "in_person_microphone" : "microphone"

  return getPreferredAudioCaptureMode(settings)
}

function getLegalPageFromPath(): LegalPageId | null {
  if (typeof window === "undefined") return null
  if (window.location.pathname === "/terms") return "terms"
  if (window.location.pathname === "/privacy") return "privacy"

  return null
}

function getPublicAuthRouteFromPath(): PublicAuthRoute {
  if (typeof window === "undefined") return "landing"
  if (window.location.pathname === "/login") return "login"
  if (window.location.pathname === "/signup") return "signup"

  return "landing"
}

function isDevPublicLandingPreviewRoute() {
  if (!import.meta.env.DEV || typeof window === "undefined") return false

  return new URLSearchParams(window.location.search).has("salesframe_public_preview")
}

function getAuthRedirectUrl(path: "/login" | "/signup" = "/login") {
  if (typeof window === "undefined") return path

  return new URL(path, window.location.origin).toString()
}

function isAuthRoutePath(pathname: string) {
  return pathname === "/login" || pathname === "/signup"
}

function PublicRouteFallback({
  darkMode,
  surface = "app",
}: {
  darkMode: boolean
  surface?: "app" | "landing"
}) {
  const isLanding = surface === "landing"

  return (
    <main
      className={cn(
        "grid min-h-svh place-items-center px-6 text-center",
        isLanding
          ? "bg-black text-white"
          : "bg-background text-foreground"
      )}
    >
      <div className="grid justify-items-center gap-3">
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-xl",
            isLanding || darkMode ? "bg-white text-black" : "bg-black text-white"
          )}
          aria-hidden="true"
        >
          <AudioLinesIcon aria-hidden="true" className="size-5" />
        </span>
        <p className={cn("text-sm", isLanding ? "text-white/70" : "text-muted-foreground")}>
          SalesFrame is getting things ready.
        </p>
      </div>
    </main>
  )
}

function CsvImportDialogFallback({
  mode,
  onOpenChange,
  open,
}: {
  mode: CsvImportType
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const title = mode === "accounts" ? "Import accounts" : "Import opportunities"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[calc(100svh-2rem)] min-w-0 overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>SalesFrame is getting the importer ready.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-4">
          <Progress value={35} aria-label="Importer loading progress" />
          <p className="text-sm text-muted-foreground">
            Your workspace stays in place while the upload tools wake up.
          </p>
        </div>
        <DialogActions
          cancelAction={
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          }
          primaryAction={
            <Button type="button" disabled>
              Next
            </Button>
          }
        />
      </DialogContent>
    </Dialog>
  )
}

type HeaderBreadcrumbItem = {
  label: string
  onSelect?: () => void
}

const emptyAccount: AccountNavItem = {
  id: "",
  name: "No account selected",
  description: "Create an account to begin",
  website: "",
  createdAt: "Not set",
  createdAtIso: null,
  currency: defaultCurrencyCode,
  logoDomain: "",
  logoStatus: "missing",
  logoUrl: "",
  logoCheckedAt: "",
  icon: <Building2Icon />,
  opportunities: [],
}
const emptyOpportunity: Opportunity = createStarterOpportunity({
  id: "",
  accountId: "",
  name: "No opportunity selected",
  callType: "Discovery",
})

function getOpportunityGuidancePreview(opportunity: Opportunity) {
  if (hasStarterOpportunityGuidance(opportunity)) {
    return "Start a call when you are ready. SalesFrame will prepare the first live question from the account, opportunity, and playbooks."
  }

  return opportunity.nextQuestion
}

function getSupabaseUserName(user: User) {
  const fullName = user.user_metadata?.full_name
  const name = user.user_metadata?.name

  if (typeof fullName === "string" && fullName.trim()) return fullName.trim()
  if (typeof name === "string" && name.trim()) return name.trim()

  return user.email?.split("@")[0] || "SalesFrame Seller"
}

function createAuthSessionFromUser(user: User): AuthSession {
  return {
    userId: user.id,
    email: user.email ?? "",
    name: getSupabaseUserName(user),
    signedInAt: user.last_sign_in_at ?? user.created_at ?? new Date().toISOString(),
  }
}

const supportedAvatarImageTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"])
const maxAvatarFileSizeBytes = 5 * 1024 * 1024
const maxAvatarSourcePixels = 16_000_000
const salesFrameSupportEmail = "hello@salesframe.ai"

function isSupportedAvatarImage(file: File) {
  return supportedAvatarImageTypes.has(file.type)
}

function createAvatarDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (!isSupportedAvatarImage(file)) {
      reject(new Error("Choose a PNG, JPEG, WebP, or GIF image."))
      return
    }

    if (file.size > maxAvatarFileSizeBytes) {
      reject(new Error("Choose an image smaller than 5MB."))
      return
    }

    const imageUrl = URL.createObjectURL(file)
    const image = new Image()

    image.decoding = "async"

    image.onload = () => {
      const size = 256
      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")

      URL.revokeObjectURL(imageUrl)

      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error("Choose a valid image file."))
        return
      }

      if (image.naturalWidth * image.naturalHeight > maxAvatarSourcePixels) {
        reject(new Error("Choose a smaller profile photo."))
        return
      }

      if (!context) {
        reject(new Error("Choose a different profile photo."))
        return
      }

      const sourceSize = Math.min(image.naturalWidth, image.naturalHeight)
      const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2)
      const sourceY = Math.max(0, (image.naturalHeight - sourceSize) / 2)

      canvas.width = size
      canvas.height = size
      context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size)

      resolve(canvas.toDataURL("image/jpeg", 0.88))
    }

    image.onerror = () => {
      URL.revokeObjectURL(imageUrl)
      reject(new Error("Choose a valid image file."))
    }

    image.src = imageUrl
  })
}

function createRetentionExpiry(days = 90) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

function normalizeEmployeeCountInput(value: string) {
  return value.replace(/\D/g, "")
}

function createAccountDraftFromRecord(account: AccountNavItem): AccountDraft {
  return {
    accountName: account.name,
    website: account.website,
    industry: account.description,
    employeeCount: "",
    region: "Australia",
    currency: normalizeCurrencyCode(account.currency),
    currentTools: "",
    strategicInitiatives: "",
    competitors: "",
    accountNotes: "",
  }
}

function createOpportunityDraftFromRecord(opportunity: Opportunity): OpportunityDraft {
  return {
    opportunityName: opportunity.name,
    stage: opportunity.stage,
    amount: opportunity.amount,
    closeDate: opportunity.closeDate,
    source: "",
    frameworks: formatPlaybooks(defaultCallPlaybooks),
    nextStep: "",
    pain: "",
    decisionProcess: "",
    manualNotes: "",
  }
}

function areAccountDraftsEqual(left: AccountDraft, right: AccountDraft) {
  return (Object.keys(left) as (keyof AccountDraft)[]).every((field) => left[field] === right[field])
}

function areOpportunityDraftsEqual(left: OpportunityDraft, right: OpportunityDraft) {
  return (Object.keys(left) as (keyof OpportunityDraft)[]).every((field) => left[field] === right[field])
}

function arePlaybookSelectionsEqual(left: CallPlaybook[], right: CallPlaybook[]) {
  const normalizedLeft = normalizePlaybooks(left)
  const normalizedRight = normalizePlaybooks(right)

  return normalizedLeft.length === normalizedRight.length && normalizedLeft.every((playbook, index) => playbook === normalizedRight[index])
}

type PostCallOutputView = {
  accountUpdates: Record<string, string>
  followUpEmail: string
  missingInfo: string[]
  nextCallPlan: string
  opportunityUpdates: Record<string, string>
}

type AccountEnrichmentDraft = {
  businessSummary: string
  confidence: string
  currentTechStack: string
  discoveryAngles: string
  hiringGrowthSignals: string
  likelyBuyingTriggers: string
  likelyStakeholders: string
  procurementSignals: string
  recentNewsSignals: string
  reviewSentimentSignals: string
  riskFlags: string
  sourceNotes: string
  strategicPriorities: string
}

function mapAccountEnrichmentProfileToDraft(profile: AccountEnrichmentProfileRow | null): AccountEnrichmentDraft {
  return {
    businessSummary: profile?.business_summary ?? "",
    confidence: profile?.confidence ?? "",
    currentTechStack: profile?.current_tech_stack ?? "",
    discoveryAngles: profile?.discovery_angles ?? "",
    hiringGrowthSignals: profile?.hiring_growth_signals ?? "",
    likelyBuyingTriggers: profile?.likely_buying_triggers ?? "",
    likelyStakeholders: profile?.likely_stakeholders ?? "",
    procurementSignals: profile?.procurement_signals ?? "",
    recentNewsSignals: profile?.recent_news_signals ?? "",
    reviewSentimentSignals: profile?.review_sentiment_signals ?? "",
    riskFlags: profile?.risk_flags ?? "",
    sourceNotes: profile?.source_notes ?? "",
    strategicPriorities: profile?.strategic_priorities ?? "",
  }
}

function areAccountEnrichmentDraftsEqual(left: AccountEnrichmentDraft, right: AccountEnrichmentDraft) {
  return (Object.keys(left) as (keyof AccountEnrichmentDraft)[]).every((field) => left[field] === right[field])
}

function mapPostCallOutputsByCallId(rows: PostCallOutputRow[]) {
  return rows.reduce<Record<string, PostCallOutputView>>((items, row) => {
    if (items[row.call_id]) return items

    items[row.call_id] = {
      accountUpdates: jsonRecord(row.account_updates),
      followUpEmail: row.follow_up_email ?? "",
      missingInfo: jsonStringArray(row.missing_info),
      nextCallPlan: row.next_call_plan ?? "",
      opportunityUpdates: jsonRecord(row.opportunity_updates),
    }

    return items
  }, {})
}

function mapPostCallOutputResponse(value: unknown): PostCallOutputView {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  const postCallOutput =
    record.postCallOutput && typeof record.postCallOutput === "object"
      ? (record.postCallOutput as Record<string, unknown>)
      : {}
  const result =
    record.result && typeof record.result === "object"
      ? (record.result as Record<string, unknown>)
      : {}

  return {
    accountUpdates: jsonRecord(postCallOutput.account_updates ?? result.accountUpdates),
    followUpEmail: String(postCallOutput.follow_up_email ?? result.followUpEmail ?? ""),
    missingInfo: jsonStringArray(postCallOutput.missing_info ?? result.missingInfo),
    nextCallPlan: String(postCallOutput.next_call_plan ?? result.nextCallPlan ?? ""),
    opportunityUpdates: jsonRecord(postCallOutput.opportunity_updates ?? result.opportunityUpdates),
  }
}

function mapCustomerResearchResponse(value: unknown) {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  const result =
    record.result && typeof record.result === "object"
      ? (record.result as Record<string, unknown>)
      : {}
  const researchSummary = result.researchSummary
  const questionAngle = result.questionAngle

  if (typeof researchSummary !== "string" || typeof questionAngle !== "string") return null
  if (!researchSummary.trim() || !questionAngle.trim()) return null

  return {
    questionAngle: questionAngle.trim(),
    researchSummary: researchSummary.trim(),
  }
}

function jsonRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  )
}

function jsonStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

type LiveCoachStatus = "idle" | "checking" | "thinking" | "ready" | "error"
type RecordSaveStatus = "idle" | "saving" | "saved" | "error"

const LIVE_COACH_AI_RECHECK_SECONDS = 30
const LIVE_COACH_AI_RECHECK_MS = LIVE_COACH_AI_RECHECK_SECONDS * 1000
const LIVE_COACH_FAST_CHECK_MS = 10 * 1000
const LIVE_COACH_FORCE_REFRESH_TURNS = 1

function mapAiLiveGuidanceResponse(value: unknown): LiveGuidance | null {
  const root = asRecord(value)
  const guidance = asRecord(root.guidance ?? value)
  const displayRecommendation = mapAiDisplayRecommendation(guidance.displayRecommendation)
  const nextQuestion = displayRecommendation?.question || stringValue(guidance.nextQuestion)
  const questionReason = displayRecommendation?.reason || stringValue(guidance.questionReason)
  const target = displayRecommendation?.target || stringValue(guidance.target)
  const playbookLabel = displayRecommendation?.playbookLabel || stringValue(guidance.playbookLabel)
  const conversationState = mapAiConversationState(guidance.conversationState)
  const flow = mapAiFlow(guidance.flow)
  const coveredCount = typeof guidance.coveredCount === "number" && Number.isFinite(guidance.coveredCount)
    ? Math.max(0, Math.round(guidance.coveredCount))
    : null
  const activeIntentStatus = isLiveIntentStatus(guidance.activeIntentStatus)
    ? guidance.activeIntentStatus
    : null

  if (
    !nextQuestion ||
    !questionReason ||
    !target ||
    !playbookLabel ||
    !conversationState ||
    coveredCount === null ||
    !activeIntentStatus
  ) {
    return null
  }

  return {
    nextQuestion,
    questionReason,
    target,
    playbookLabel,
    displayRecommendation,
    alternatives: mapAiAlternatives(guidance.alternatives),
    conversationState,
    coveredCount,
    activeIntentStatus,
    candidateScores: mapAiCandidateScores(guidance.candidateScores),
    evidenceUpdates: mapAiEvidenceUpdates(guidance.evidenceUpdates),
    evidence: mapAiEvidence(guidance.evidence),
    gaps: mapAiGaps(guidance.gaps),
    questionLifecycle: mapAiQuestionLifecycle(guidance.questionLifecycle),
    parkedIntents: mapAiParkedIntents(guidance.parkedIntents),
    evidenceCommit: mapAiEvidenceCommit(guidance.evidenceCommit),
    sellerFeedbackRequest: mapAiSellerFeedbackRequest(guidance.sellerFeedbackRequest),
    contextUsed: mapAiContextUsed(guidance.contextUsed),
    uiMode: isLiveUiMode(guidance.uiMode) ? guidance.uiMode : displayRecommendation?.uiMode,
    flow,
  }
}

function mapAiLiveStateResponse(value: unknown): {
  conversationState: NonNullable<LiveGuidance["conversationState"]>
  shouldRefreshQuestion: boolean
  refreshReason: string
  uiMode?: NonNullable<LiveGuidance["uiMode"]>
} | null {
  const root = asRecord(value)
  const stateRecord = asRecord(root.state ?? value)
  const conversationState = mapAiConversationState(stateRecord)

  if (!conversationState) return null

  return {
    conversationState,
    shouldRefreshQuestion: conversationState.shouldRefreshQuestion === true,
    refreshReason: conversationState.refreshReason ?? "",
    uiMode: isLiveUiMode(stateRecord.uiMode) ? stateRecord.uiMode : undefined,
  }
}

function mapAiConversationState(value: unknown): LiveGuidance["conversationState"] | null {
  const record = asRecord(value)
  const conversationStage = stringValue(record.conversationStage) || stringValue(record.flowStage)
  const buyerMood = stringValue(record.buyerMood) || stringValue(record.mood)
  const flowStage = stringValue(record.flowStage) || conversationStage
  const mood = stringValue(record.mood) || buyerMood
  const sentiment = stringValue(record.sentiment)
  const pace = stringValue(record.pace)
  const sellerMove = stringValue(record.sellerMove)
  const customerSignal = stringValue(record.customerSignal)
  const naturalnessGuidance = stringValue(record.naturalnessGuidance)
  const activeIntent = stringValue(record.activeIntent)
  const intentStatus = isLiveIntentStatus(record.intentStatus) ? record.intentStatus : "missing"
  const questionTiming = isLiveQuestionTiming(record.questionTiming) ? record.questionTiming : "now"
  const riskLevel = isLiveRiskLevel(record.riskLevel) ? record.riskLevel : "low"
  const confidence = clampScore(record.confidence)
  const activeIntentStatus = isLiveIntentStatus(record.activeIntentStatus)
    ? record.activeIntentStatus
    : undefined
  const shouldRefreshQuestion =
    typeof record.shouldRefreshQuestion === "boolean" ? record.shouldRefreshQuestion : undefined
  const refreshReason = stringValue(record.refreshReason) || undefined
  const topicShiftConfidence =
    typeof record.topicShiftConfidence === "number" && Number.isFinite(record.topicShiftConfidence)
      ? clampScore(record.topicShiftConfidence)
      : undefined

  if (
    !conversationStage ||
    !buyerMood ||
    !flowStage ||
    !mood ||
    !sentiment ||
    !pace ||
    !sellerMove ||
    !customerSignal ||
    typeof record.shouldAskNow !== "boolean" ||
    !naturalnessGuidance
  ) {
    return null
  }

  return {
    conversationStage,
    buyerMood,
    flowStage,
    mood,
    sentiment,
    pace,
    sellerMove,
    customerSignal,
    shouldAskNow: record.shouldAskNow,
    naturalnessGuidance,
    activeIntent: activeIntent || "Current best intent",
    intentStatus,
    questionTiming,
    riskLevel,
    confidence,
    topicShiftConfidence,
    activeIntentStatus,
    shouldRefreshQuestion,
    refreshReason,
  }
}

function mapAiDisplayRecommendation(value: unknown): LiveGuidance["displayRecommendation"] | undefined {
  const record = asRecord(value)
  const question = stringValue(record.question)
  const reason = stringValue(record.reason)
  const target = stringValue(record.target)
  const playbookLabel = stringValue(record.playbookLabel)
  const primaryIntentClusterId = stringValue(record.primaryIntentClusterId)
  const primaryIntentLabel = stringValue(record.primaryIntentLabel)
  const uiMode = isLiveUiMode(record.uiMode) ? record.uiMode : "ask_now"

  if (!question || !reason || !target || !playbookLabel) return undefined

  return {
    question,
    reason,
    target,
    playbookLabel,
    primaryIntentClusterId,
    primaryIntentLabel,
    alsoCovers: mapAiIntentCoverage(record.alsoCovers),
    uiMode,
    confidence: clampScore(record.confidence),
    softerAlternative: stringValue(record.softerAlternative) || undefined,
  }
}

function mapAiIntentCoverage(value: unknown): NonNullable<LiveGuidance["displayRecommendation"]>["alsoCovers"] {
  if (!Array.isArray(value)) return []

  return value.slice(0, 8).flatMap((item) => {
    const record = asRecord(item)
    const playbookFieldId = stringValue(record.playbookFieldId)
    const playbookLabel = stringValue(record.playbookLabel)
    const fieldLabel = stringValue(record.fieldLabel)
    const intentClusterId = stringValue(record.intentClusterId)

    return playbookFieldId && playbookLabel && fieldLabel && intentClusterId
      ? [{ playbookFieldId, playbookLabel, fieldLabel, intentClusterId }]
      : []
  })
}

function mapAiEvidence(value: unknown): LiveGuidance["evidence"] {
  if (!Array.isArray(value) || value.length === 0) return []

  return value.slice(0, 12).flatMap((item) => {
    const record = asRecord(item)
    const label = stringValue(record.label)
    const framework = stringValue(record.framework)
    const status = isLiveIntentStatus(record.status) ? record.status : null
    const detail = stringValue(record.detail)

    return label && callPlaybookOptions.includes(framework as CallPlaybook) && status && detail
      ? [{
        label,
        framework: framework as CallPlaybook,
        status,
        detail,
        confidence: typeof record.confidence === "number" ? clampScore(record.confidence) : undefined,
      }]
      : []
  })
}

function mapAiCandidateScores(value: unknown): LiveGuidance["candidateScores"] {
  if (!Array.isArray(value)) return undefined

  const scores = value.slice(0, 3).flatMap((item) => {
    const record = asRecord(item)
    const question = stringValue(record.question)
    const target = stringValue(record.target)
    const playbookLabel = stringValue(record.playbookLabel)
    const intentClusterId = stringValue(record.intentClusterId)
    const reason = stringValue(record.reason)
    const risk = isLiveRiskLevel(record.risk) ? record.risk : "low"

    return question && target && playbookLabel && intentClusterId && reason
      ? [{
          question,
          target,
          playbookLabel,
          intentClusterId,
          methodologyValue: clampScore(record.methodologyValue),
          askNowFit: clampScore(record.askNowFit),
          currentTopicFit: clampScore(record.currentTopicFit),
          stageFit: clampScore(record.stageFit),
          naturalness: clampScore(record.naturalness),
          timingFit: clampScore(record.timingFit),
          timingRisk: isLiveRiskLevel(record.timingRisk) ? record.timingRisk : "low",
          buyerMoodFit: clampScore(record.buyerMoodFit),
          informationGain: clampScore(record.informationGain),
          reentryPotential: clampScore(record.reentryPotential),
          risk,
          overallScore: clampScore(record.overallScore),
          reason,
        }]
      : []
  })

  return scores.length ? scores : undefined
}

function mapAiEvidenceUpdates(value: unknown): LiveGuidance["evidenceUpdates"] {
  if (!Array.isArray(value)) return undefined

  const updates = value.slice(0, 8).flatMap((item) => {
    const record = asRecord(item)
    const playbookFieldId = stringValue(record.playbookFieldId)
    const intentClusterId = stringValue(record.intentClusterId)
    const label = stringValue(record.label)
    const framework = stringValue(record.framework)
    const status = isLiveIntentStatus(record.status) ? record.status : null
    const summary = stringValue(record.summary)

    return playbookFieldId && intentClusterId && label && framework && status && summary
      ? [{
          playbookFieldId,
          intentClusterId,
          label,
          framework,
          status,
          confidence: clampScore(record.confidence),
          summary,
          value: stringValue(record.value) || undefined,
        }]
      : []
  })

  return updates.length ? updates : undefined
}

function mapAiContextUsed(value: unknown): LiveGuidance["contextUsed"] {
  if (!Array.isArray(value)) return undefined

  const contextUsed = value.slice(0, 8).flatMap((item) => {
    const record = asRecord(item)
    const source: "account" | "opportunity" | null = record.source === "account" || record.source === "opportunity"
      ? record.source
      : null
    const field = stringValue(record.field)
    const influence = stringValue(record.influence)

    return source && field && influence
      ? [{ source, field, influence }]
      : []
  })

  return contextUsed.length ? contextUsed : undefined
}

function mapAiEvidenceCommit(value: unknown): LiveGuidance["evidenceCommit"] | undefined {
  const record = asRecord(value)
  const summary = stringValue(record.summary)
  const bankedIntentNote = stringValue(record.bankedIntentNote)
  const sourceTurnIds = Array.isArray(record.sourceTurnIds)
    ? record.sourceTurnIds
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .slice(0, 12)
    : []

  if (!summary && !bankedIntentNote && sourceTurnIds.length === 0 && record.answeredCurrentIntent !== true) {
    return undefined
  }

  return {
    answeredCurrentIntent: record.answeredCurrentIntent === true,
    bankedIntentNote,
    sourceTurnIds,
    summary,
  }
}

function mapAiQuestionLifecycle(value: unknown): LiveGuidance["questionLifecycle"] | undefined {
  const record = asRecord(value)
  const currentQuestionState = isLiveQuestionLifecycleState(record.currentQuestionState)
    ? record.currentQuestionState
    : null
  const awkwardnessRisk = isLiveRiskLevel(record.awkwardnessRisk) ? record.awkwardnessRisk : null
  const stabilityRecommendation = isLiveStabilityRecommendation(record.stabilityRecommendation)
    ? record.stabilityRecommendation
    : null
  const replacementReason = stringValue(record.replacementReason)

  if (
    !currentQuestionState ||
    typeof record.shouldReplaceQuestion !== "boolean" ||
    !replacementReason ||
    !awkwardnessRisk ||
    !stabilityRecommendation
  ) {
    return undefined
  }

  return {
    currentQuestionState,
    shouldReplaceQuestion: record.shouldReplaceQuestion,
    replacementReason,
    awkwardnessRisk,
    topicShiftConfidence: clampScore(record.topicShiftConfidence),
    stabilityRecommendation,
  }
}

function mapAiParkedIntents(value: unknown): LiveGuidance["parkedIntents"] {
  if (!Array.isArray(value)) return undefined

  const parkedIntents = value.slice(0, 4).flatMap((item) => {
    const record = asRecord(item)
    const intentClusterId = stringValue(record.intentClusterId)
    const intentLabel = stringValue(record.intentLabel)
    const priority = isLiveRiskLevel(record.priority) ? record.priority : null
    const reasonParked = stringValue(record.reasonParked)
    const reentryCue = stringValue(record.reentryCue)
    const bridgeQuestion = stringValue(record.bridgeQuestion)
    const latestRevisitMoment = isLiveRevisitMoment(record.latestRevisitMoment)
      ? record.latestRevisitMoment
      : null
    const relatedPlaybookFields = Array.isArray(record.relatedPlaybookFields)
      ? record.relatedPlaybookFields.slice(0, 8).filter((field): field is string => typeof field === "string" && field.trim().length > 0)
      : []

    return intentClusterId && intentLabel && priority && reasonParked && reentryCue && bridgeQuestion && latestRevisitMoment
      ? [{
          intentClusterId,
          intentLabel,
          priority,
          reasonParked,
          reentryCue,
          bridgeQuestion,
          latestRevisitMoment,
          relatedPlaybookFields,
        }]
      : []
  })

  return parkedIntents.length ? parkedIntents : undefined
}

function mapAiSellerFeedbackRequest(value: unknown): LiveGuidance["sellerFeedbackRequest"] | undefined {
  const record = asRecord(value)
  const prompt = stringValue(record.prompt)
  const preferredActions = Array.isArray(record.preferredActions)
    ? record.preferredActions.filter(isLiveSellerFeedbackAction)
    : []

  return prompt && preferredActions.length ? { prompt, preferredActions } : undefined
}

function mapAiGaps(value: unknown): LiveGuidance["gaps"] {
  if (!Array.isArray(value)) return []

  return value.slice(0, 5).flatMap((item) => {
    const record = asRecord(item)
    const label = stringValue(record.label)
    const status = isGapStatus(record.status) ? record.status : null
    const detail = stringValue(record.detail)

    return label && status && detail ? [{ label, status, detail }] : []
  })
}

function mapAiFlow(value: unknown): LiveGuidance["flow"] {
  if (!Array.isArray(value)) return []

  return value.slice(0, 4).flatMap((item) => {
    const record = asRecord(item)
    const label = stringValue(record.label)
    const detail = stringValue(record.detail)

    return label && detail ? [{ label, detail }] : []
  })
}

function mapAiAlternatives(value: unknown): LiveGuidance["alternatives"] {
  if (!Array.isArray(value)) return undefined

  const alternatives = value
    .slice(0, 3)
    .flatMap((item) => {
      const record = asRecord(item)
      const question = stringValue(record.question)
      const target = stringValue(record.target)
      const reason = stringValue(record.reason)

      return question && target && reason ? [{ question, target, reason }] : []
    })

  return alternatives.length ? alternatives : undefined
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function isLiveIntentStatus(value: unknown): value is LiveGuidance["activeIntentStatus"] {
  return value === "confirmed" || value === "answered" || value === "asked" || value === "weak" || value === "missing"
}

function isGapStatus(value: unknown): value is "confirmed" | "weak" | "missing" {
  return value === "confirmed" || value === "weak" || value === "missing"
}

function isLiveUiMode(value: unknown): value is NonNullable<LiveGuidance["uiMode"]> {
  return (
    value === "ask_now" ||
    value === "listen" ||
    value === "acknowledge" ||
    value === "clarify" ||
    value === "wrap_up" ||
    value === "park_and_follow_flow" ||
    value === "recover_before_close" ||
    value === "error"
  )
}

function isLiveQuestionTiming(value: unknown): value is NonNullable<LiveGuidance["conversationState"]>["questionTiming"] {
  return value === "now" || value === "wait" || value === "too_early" || value === "follow_up_only"
}

function isLiveRiskLevel(value: unknown): value is NonNullable<LiveGuidance["conversationState"]>["riskLevel"] {
  return value === "low" || value === "medium" || value === "high"
}

function isLiveQuestionLifecycleState(value: unknown): value is NonNullable<LiveGuidance["questionLifecycle"]>["currentQuestionState"] {
  return (
    value === "active" ||
    value === "asked" ||
    value === "answered" ||
    value === "stale" ||
    value === "parked" ||
    value === "revisit_before_close" ||
    value === "dropped"
  )
}

function isLiveStabilityRecommendation(value: unknown): value is NonNullable<LiveGuidance["questionLifecycle"]>["stabilityRecommendation"] {
  return value === "hold" || value === "replace" || value === "park" || value === "recover"
}

function isLiveRevisitMoment(value: unknown): value is NonNullable<NonNullable<LiveGuidance["parkedIntents"]>[number]>["latestRevisitMoment"] {
  return value === "mid_call" || value === "before_wrap" || value === "next_call"
}

function isLiveSellerFeedbackAction(value: unknown): value is LiveSellerFeedbackAction {
  return value === "asked" || value === "too_soon" || value === "softer" || value === "skip" || value === "use_next"
}

function clampScore(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : 0
}

function buildLiveGuidanceSignature({
  activeCallId,
  accountDraft,
  callPlaybooks,
  callType,
  customerResearch,
  sellerFeedback,
  opportunityId,
  transcript,
}: {
  activeCallId: string
  accountDraft: AccountDraft
  callPlaybooks: CallPlaybook[]
  callType: string
  customerResearch: CustomerResearchConfig
  sellerFeedback: ManualCoachState["feedbackSignals"]
  opportunityId: string
  transcript: Opportunity["transcript"]
}) {
  const transcriptWindow = transcript
    .slice(-8)
    .map((line) => [
      getTranscriptSpeakerDisplayName(line),
      getTranscriptSpeakerLabel(line),
      line.speakerSource ?? "",
      line.isPartial ? "partial" : "final",
      line.time,
      line.text,
    ].join(":"))
    .join("|")

  return JSON.stringify({
    activeCallId,
    accountProfileContext: {
      accountNotes: accountDraft.accountNotes,
      competitors: accountDraft.competitors,
      currentTools: accountDraft.currentTools,
      strategicInitiatives: accountDraft.strategicInitiatives,
    },
    callPlaybooks,
    callType,
    customerResearchEnabled: customerResearch.enabled,
    opportunityId,
    sellerFeedback: sellerFeedback.slice(-6).map((signal) => `${signal.action}:${signal.target}:${signal.createdAt}`),
    transcriptWindow,
  })
}

function getSpeakerRoleForLabel(speaker: TranscriptSpeaker) {
  if (speaker === "Seller") return "seller"
  if (speaker === "Customer 2") return "customer_2"
  if (speaker === "Customer 3") return "customer_3"
  if (speaker === "Unknown" || speaker.startsWith("Speaker ")) return "unknown"

  return "customer"
}

function normalizeTranscriptSpeakerLabel(value: string): TranscriptSpeaker {
  if (
    value === "Seller" ||
    value === "Customer" ||
    value === "Customer 2" ||
    value === "Customer 3" ||
    value === "Speaker 1" ||
    value === "Speaker 2" ||
    value === "Speaker 3" ||
    value === "Unknown"
  ) {
    return value
  }

  return "Unknown"
}

function getTranscriptSpeakerLabel(line: Opportunity["transcript"][number]) {
  return getCanonicalTranscriptSpeakerLabel(line.speakerLabel ?? normalizeTranscriptSpeakerLabel(line.speaker))
}

function getTranscriptSpeakerDisplayName(line: Opportunity["transcript"][number]) {
  const label = getTranscriptSpeakerLabel(line)
  const displayName = line.speakerDisplayName?.trim()
  if (!displayName) return label

  const normalizedDisplayName = normalizeTranscriptSpeakerLabel(displayName)
  if (
    normalizedDisplayName !== "Unknown" &&
    getCanonicalTranscriptSpeakerLabel(normalizedDisplayName) === label
  ) {
    return label
  }

  return displayName
}

function getCanonicalTranscriptSpeakerLabel(label: TranscriptSpeaker): TranscriptSpeaker {
  if (label === "Speaker 1") return "Seller"
  if (label === "Speaker 2") return "Customer"
  if (label === "Speaker 3") return "Customer 2"

  return label
}

function getTranscriptAvatarInitial(line: Opportunity["transcript"][number]) {
  const displayName = getTranscriptSpeakerDisplayName(line)
  const label = getTranscriptSpeakerLabel(line)
  const preferredName = displayName && displayName !== label ? displayName : label
  const initials = preferredName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")

  return initials || "?"
}

function getTranscriptAvatarClassName(label: TranscriptSpeaker) {
  if (label === "Seller") return "bg-muted text-foreground ring-border"
  if (label === "Customer") return "bg-blue-500/10 text-blue-700 ring-blue-500/20 dark:text-blue-300"
  if (label === "Customer 2") return "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300"
  if (label === "Customer 3") return "bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300"
  if (label === "Unknown") return "bg-muted text-muted-foreground ring-border"

  return "bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300"
}

function buildSpeakerIdentityMapFromTranscript(transcript: Opportunity["transcript"]): CallSpeakerIdentityMap {
  return transcript.reduce<CallSpeakerIdentityMap>((items, line) => {
    const label = getTranscriptSpeakerLabel(line)
    const displayName = getTranscriptSpeakerDisplayName(line)

    if (!items[label] && displayName && displayName !== label) {
      items[label] = {
        displayName,
        label,
      }
    }

    return items
  }, {})
}

function applySpeakerIdentitiesToLine(
  line: Opportunity["transcript"][number],
  identities: CallSpeakerIdentityMap
): Opportunity["transcript"][number] {
  const label = getTranscriptSpeakerLabel(line)
  const identity = identities[label]
  const displayName = getTranscriptSpeakerDisplayName(line)

  return {
    ...line,
    speaker: label,
    speakerDisplayName: identity?.displayName || displayName || label,
    speakerLabel: label,
  }
}

function applySpeakerIdentitiesToTranscript(
  transcript: Opportunity["transcript"],
  identities: CallSpeakerIdentityMap
) {
  return transcript.map((line) => applySpeakerIdentitiesToLine(line, identities))
}

function upsertTranscriptLine(
  transcript: Opportunity["transcript"],
  nextLine: Opportunity["transcript"][number]
) {
  const dedupedLine = {
    ...nextLine,
    text: nextLine.text.trim(),
  }
  if (!dedupedLine.text) return transcript

  let didUpdate = false
  const nextItems = transcript.map((item) => {
    if (!isSameTranscriptLine(item, dedupedLine)) return item

    didUpdate = true
    return mergeTranscriptLine(item, dedupedLine)
  })

  if (didUpdate) return nextItems
  if (transcript.some((item) => isDuplicateTranscriptLine(item, dedupedLine))) return transcript

  return [...transcript, dedupedLine]
}

function mergeTranscriptLine(
  currentLine: Opportunity["transcript"][number],
  nextLine: Opportunity["transcript"][number]
) {
  return {
    ...currentLine,
    ...nextLine,
    clientId: nextLine.clientId ?? currentLine.clientId,
    id: isPersistedTranscriptSegmentId(nextLine.id) ? nextLine.id : currentLine.id ?? nextLine.id,
    isPartial: nextLine.isPartial === true,
    speakerDisplayName: nextLine.speakerDisplayName || currentLine.speakerDisplayName,
    speakerId: nextLine.speakerId || currentLine.speakerId,
    speakerLabel: nextLine.speakerLabel ?? currentLine.speakerLabel,
    text: chooseBestTranscriptText(currentLine.text, nextLine.text),
    time: currentLine.time || nextLine.time,
  }
}

function isSameTranscriptLine(
  currentLine: Opportunity["transcript"][number],
  nextLine: Opportunity["transcript"][number]
) {
  const currentPersistedId = isPersistedTranscriptSegmentId(currentLine.id)
  const nextPersistedId = isPersistedTranscriptSegmentId(nextLine.id)

  if (nextPersistedId && currentPersistedId && currentLine.id === nextLine.id) return true

  if (currentLine.isPartial || nextLine.isPartial) {
    if (nextLine.clientId && currentLine.clientId === nextLine.clientId) return true
    if (!currentPersistedId && nextLine.clientId && currentLine.id === nextLine.clientId) return true
    if (!nextPersistedId && nextLine.id && currentLine.clientId === nextLine.id) return true
  }

  if (
    !currentLine.isPartial &&
    !nextLine.isPartial &&
    !currentPersistedId &&
    !nextPersistedId &&
    nextLine.clientId &&
    currentLine.clientId === nextLine.clientId
  ) {
    return true
  }

  return false
}

function isDuplicateTranscriptLine(
  currentLine: Opportunity["transcript"][number],
  nextLine: Opportunity["transcript"][number]
) {
  const currentText = normalizeTranscriptForDisplayComparison(currentLine.text)
  const nextText = normalizeTranscriptForDisplayComparison(nextLine.text)
  if (!currentText || !nextText) return false

  const exactLongDuplicate = currentText === nextText && currentText.length >= 24
  if (exactLongDuplicate && areTranscriptTimesClose(currentLine.time, nextLine.time, 90)) return true

  if (!areTranscriptTimesClose(currentLine.time, nextLine.time, 4)) return false
  if (getTranscriptSpeakerLabel(currentLine) !== getTranscriptSpeakerLabel(nextLine)) return false
  if (currentText === nextText) return true

  const longer = currentText.length >= nextText.length ? currentText : nextText
  const shorter = currentText.length < nextText.length ? currentText : nextText
  if (shorter.length < 14) return false

  return longer.includes(shorter)
}

function chooseBestTranscriptText(currentText: string, nextText: string) {
  const current = currentText.trim()
  const next = nextText.trim()
  if (!current) return next
  if (!next) return current
  if (next.length >= current.length) return next

  return current
}

function isPersistedTranscriptSegmentId(value: string | undefined) {
  if (!value) return false

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function normalizeTranscriptForDisplayComparison(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function areTranscriptTimesClose(firstTime: string, secondTime: string, seconds: number) {
  const first = parseTranscriptTime(firstTime)
  const second = parseTranscriptTime(secondTime)
  if (first === null || second === null) return false

  return Math.abs(first - second) <= seconds
}

function buildTranscriptForAi(transcript: Opportunity["transcript"]) {
  return transcript
    .filter((line) => !line.isPartial)
    .filter((line) => line.text.trim().split(/\s+/).length >= 4)
    .slice(-28)
    .map((line) => ({
      ...line,
      speakerDisplayName: getTranscriptSpeakerDisplayName(line),
      speakerLabel: getTranscriptSpeakerLabel(line),
    }))
}

function formatPersistedTranscriptTime(value: number | null) {
  if (value === null) return "live"

  const totalSeconds = Math.max(0, Math.round(value / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

function mapTranscriptSegmentsByCallId({
  callSpeakers,
  transcriptSegments,
}: {
  callSpeakers: CallSpeakerRow[]
  transcriptSegments: TranscriptSegmentRow[]
}) {
  const speakerByCallId = new Map<string, Map<string, CallSpeakerRow>>()
  const transcriptByCallId: Record<string, Opportunity["transcript"]> = {}

  callSpeakers.forEach((speaker) => {
    const speakers = speakerByCallId.get(speaker.call_id) ?? new Map<string, CallSpeakerRow>()
    speakers.set(speaker.id, speaker)
    speakerByCallId.set(speaker.call_id, speakers)
  })

  transcriptSegments
    .slice()
    .sort((left, right) => (left.start_ms ?? 0) - (right.start_ms ?? 0))
    .forEach((segment) => {
      const speaker = segment.speaker_id
        ? speakerByCallId.get(segment.call_id)?.get(segment.speaker_id) ?? null
        : null
      const speakerLabel = getCanonicalTranscriptSpeakerLabel(normalizeTranscriptSpeakerLabel(speaker?.label ?? "Unknown"))
      const transcript = transcriptByCallId[segment.call_id] ?? []

      transcript.push({
        audioSourceKind: segment.audio_source_kind ?? undefined,
        id: segment.id,
        diarizationSpeaker: segment.diarization_speaker ?? undefined,
        endOfTurnConfidence: segment.end_of_turn_confidence ?? undefined,
        languageDetected: segment.language_detected ?? undefined,
        providerEventId: segment.provider_event_id ?? undefined,
        providerSessionId: segment.provider_session_id ?? undefined,
        providerTurnIndex: segment.provider_turn_index ?? undefined,
        speaker: speakerLabel,
        speakerAttributionReason: segment.speaker_attribution_reason ?? undefined,
        speakerConfidence: segment.speaker_confidence ?? undefined,
        speakerDisplayName: speaker?.display_name || speaker?.label || speakerLabel,
        speakerId: speaker?.id,
        speakerLabel,
        speakerNeedsReview: segment.speaker_needs_review,
        speakerSource: segment.speaker_source ?? segment.speaker_attribution ?? undefined,
        time: formatPersistedTranscriptTime(segment.start_ms),
        text: segment.text,
        wordConfidence: segment.word_confidence ?? undefined,
      })

      transcriptByCallId[segment.call_id] = transcript
    })

  return transcriptByCallId
}

function mapOpenAiKeyStatusToSavedState(status: OpenAiKeyStatus): SavedOpenAiKeyState | null {
  if (!status.connected || !status.fingerprint || !status.savedAt) return null

  return {
    maskedKey: status.maskedKey ?? "Saved key",
    fingerprint: status.fingerprint,
    savedAt: status.savedAt,
    storageMode: "server-encrypted",
  }
}

function canReplayCall(call: CallSummary | null | undefined): call is CallSummary {
  return Boolean(call?.recordingStoragePath || call?.recordingUrl)
}

function getCallDisplayStatus(call: CallSummary, liveCallId: string) {
  if (call.status === "Active" && call.id === liveCallId) return "Recording"
  if (call.status === "Active") return "Interrupted"

  return call.status
}

function getCallDisplayDuration(call: CallSummary, liveCallId: string) {
  if (call.duration !== "Live") return call.duration
  if (call.id === liveCallId) return "Live"

  return "Interrupted"
}

function getCallStatusTextClassName(status: string) {
  if (status === "Interrupted" || status === "Needs Attention") return "text-destructive"
  if (status === "Recording" || status === "Processing") return "text-muted-foreground"

  return "text-muted-foreground"
}

function parseTranscriptTime(value: string) {
  const parts = value.split(":").map((part) => Number(part))
  if (parts.some((part) => !Number.isFinite(part))) return null
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]

  return null
}

function sanitizeTranscriptDownloadFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "call"
}

function buildTranscriptDownloadText({
  call,
  transcript,
}: {
  call: CallSummary
  transcript: Opportunity["transcript"]
}) {
  const transcriptLines = transcript.filter((line) => line.text.trim())
  const header = [
    "SalesFrame call transcript",
    `Call: ${call.title}`,
    `Date: ${call.date}`,
    `Type: ${call.type}`,
    `Duration: ${call.duration}`,
    "",
    "Transcript",
    "----------",
  ]

  if (transcriptLines.length === 0) {
    return [...header, "No transcript lines are available for this call.", ""].join("\n")
  }

  return [
    ...header,
    ...transcriptLines.map((line) => {
      const timestamp = line.time ? `[${line.time}] ` : ""
      return `${timestamp}${getTranscriptSpeakerDisplayName(line)}: ${line.text.trim()}`
    }),
    "",
  ].join("\n")
}

function downloadTranscriptFile(call: CallSummary, transcript: Opportunity["transcript"]) {
  const text = buildTranscriptDownloadText({ call, transcript })
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = `salesframe-transcript-${sanitizeTranscriptDownloadFileName(call.title)}.txt`
  link.style.display = "none"
  document.body.appendChild(link)
  try {
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

function getLatestReplayableCallForOpportunity({
  calls,
  opportunityId,
  preferredCallId,
}: {
  calls: CallSummary[]
  opportunityId: string
  preferredCallId?: string
}) {
  const opportunityCalls = calls.filter((call) => call.opportunityId === opportunityId)
  const preferredCall = opportunityCalls.find((call) => call.id === preferredCallId)

  if (canReplayCall(preferredCall)) return preferredCall

  return opportunityCalls.find(canReplayCall) ?? null
}

function getLatestCallForOpportunity({
  calls,
  opportunityId,
  preferredCallId,
}: {
  calls: CallSummary[]
  opportunityId: string
  preferredCallId?: string
}) {
  const opportunityCalls = calls.filter((call) => call.opportunityId === opportunityId)
  const preferredCall = opportunityCalls.find((call) => call.id === preferredCallId)

  return preferredCall ?? opportunityCalls[0] ?? null
}

function createOptionalSupabaseClient(): SupabaseClient<Database> | null {
  try {
    return createClient()
  } catch {
    return null
  }
}

const authConnectionUnavailableMessage =
  "SalesFrame cannot reach sign-in right now. Try again in a moment."
const callCaptureStartupTimeoutMs = 30000

function getLiveCallRemainingSeconds(elapsedSeconds: number, durationLimitSeconds = MAX_LIVE_CALL_SECONDS) {
  return Math.max(0, durationLimitSeconds - Math.max(0, elapsedSeconds))
}

function getLiveCallLimitNotice(elapsedSeconds: number, durationLimitSeconds = MAX_LIVE_CALL_SECONDS) {
  const remainingSeconds = getLiveCallRemainingSeconds(elapsedSeconds, durationLimitSeconds)

  if (remainingSeconds <= LIVE_CALL_FINAL_WARNING_SECONDS) return "Wrapping up soon"
  if (remainingSeconds <= LIVE_CALL_WARNING_SECONDS) return `${Math.ceil(remainingSeconds / 60)} min left`

  return ""
}

function App() {
  const supabase = React.useMemo(() => createOptionalSupabaseClient(), [])
  const [activeView, setActiveView] = React.useState("home")
  const [navigationScrollResetNonce, setNavigationScrollResetNonce] = React.useState(0)
  const [workspaceNavItems, setWorkspaceNavItems] = React.useState<WorkspaceNavItem[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = React.useState("")
  const [workspacePlaybooks, setWorkspacePlaybooks] = React.useState<PlaybookRow[]>([])
  const [workspacePlaybookFields, setWorkspacePlaybookFields] = React.useState<PlaybookFieldRow[]>([])
  const [workspaceCalls, setWorkspaceCalls] = React.useState<CallSummary[]>([])
  const [postCallOutputsByCallId, setPostCallOutputsByCallId] = React.useState<Record<string, PostCallOutputView>>({})
  const [transcriptsByCallId, setTranscriptsByCallId] = React.useState<Record<string, Opportunity["transcript"]>>({})
  const [workspaceAccounts, setWorkspaceAccounts] = React.useState<AccountNavItem[]>([])
  const [workspaceOpportunities, setWorkspaceOpportunities] = React.useState<Opportunity[]>([])
  const [archivedAccountRows, setArchivedAccountRows] = React.useState<AccountRow[]>([])
  const [archivedOpportunityRows, setArchivedOpportunityRows] = React.useState<OpportunityRow[]>([])
  const [activeAccountId, setActiveAccountId] = React.useState("")
  const [activeOpportunityId, setActiveOpportunityId] = React.useState("")
  const [activeCallId, setActiveCallId] = React.useState("")
  const [postCallFocusCallId, setPostCallFocusCallId] = React.useState("")
  const [activeCallStartedAt, setActiveCallStartedAt] = React.useState("")
  const [createAccountOpen, setCreateAccountOpen] = React.useState(false)
  const [createOpportunityOpen, setCreateOpportunityOpen] = React.useState(false)
  const [createOpportunityAccountId, setCreateOpportunityAccountId] = React.useState(activeAccountId)
  const [editAccountId, setEditAccountId] = React.useState<string | null>(null)
  const [editOpportunityId, setEditOpportunityId] = React.useState<string | null>(null)
  const [pendingArchiveRecord, setPendingArchiveRecord] = React.useState<PendingArchiveRecord | null>(null)
  const [pendingDeleteRecord, setPendingDeleteRecord] = React.useState<PendingDeleteRecord | null>(null)
  const [callType, setCallType] = React.useState("Discovery")
  const [isRecording, setIsRecording] = React.useState(false)
  const [elapsed, setElapsed] = React.useState(0)
  const [darkMode, setDarkMode] = React.useState(getInitialDarkMode)
  const [publicAuthRoute, setPublicAuthRoute] = React.useState<PublicAuthRoute>(() => getPublicAuthRouteFromPath())
  const [authMode, setAuthMode] = React.useState<AuthMode>(() =>
    getPublicAuthRouteFromPath() === "signup" ? "signup" : "login"
  )
  const [authSession, setAuthSession] = React.useState<AuthSession | null>(null)
  const [authLoading, setAuthLoading] = React.useState(true)
  const [authSubmitting, setAuthSubmitting] = React.useState(false)
  const [authStatusMessage, setAuthStatusMessage] = React.useState("")
  const [authStatusTone, setAuthStatusTone] = React.useState<"success" | "error" | "info">("info")
  const [savedOpenAiKeyState, setSavedOpenAiKeyState] = React.useState<SavedOpenAiKeyState | null>(null)
  const [openAiKeyStatusMessage, setOpenAiKeyStatusMessage] = React.useState("")
  const [workspaceSessionStatus, setWorkspaceSessionStatus] =
    React.useState<WorkspaceSessionStatusResponse | null>(null)
  const [workspaceSessionWarningOpen, setWorkspaceSessionWarningOpen] = React.useState(false)
  const [bulkImportStatus, setBulkImportStatus] = React.useState<BulkImportStatusResponse | null>(null)
  const [bulkImportStatusMessage, setBulkImportStatusMessage] = React.useState("")
  const [bulkImportStatusLoading, setBulkImportStatusLoading] = React.useState(false)
  const [bulkImportStatusRefreshToken, setBulkImportStatusRefreshToken] = React.useState(0)
  const [legalPage, setLegalPage] = React.useState<LegalPageId | null>(() => getLegalPageFromPath())
  const [loadingWorkspace, setLoadingWorkspace] = React.useState<WorkspaceNavItem | null>(null)
  const [onboardingOpen, setOnboardingOpen] = React.useState(false)
  const [workspaceSetupDraft, setWorkspaceSetupDraft] = React.useState<WorkspaceNavItem | null>(null)
  const [onboardingInitialStep, setOnboardingInitialStep] = React.useState<1 | 2 | 3 | 4>(1)
  const [onboardingCsvImportActive, setOnboardingCsvImportActive] = React.useState(false)
  const [onboardingCompletedImports, setOnboardingCompletedImports] = React.useState<CsvImportType[]>([])
  const [csvImportMode, setCsvImportMode] = React.useState<CsvImportType>("accounts")
  const [csvImportOpen, setCsvImportOpen] = React.useState(false)
  const [pendingCsvImportMode, setPendingCsvImportMode] = React.useState<CsvImportType | null>(null)
  const [personalAccountProfile, setPersonalAccountProfile] =
    React.useState<PersonalAccountProfile>(initialPersonalAccountProfile)
  const [workspaceDataState, setWorkspaceDataState] = React.useState<WorkspaceDataState>("loading")
  const [pageLoadingView, setPageLoadingView] = React.useState<string | null>(null)
  const [workspaceErrorMessage, setWorkspaceErrorMessage] = React.useState("")
  const [workspaceRefreshToken, setWorkspaceRefreshToken] = React.useState(0)
  const [mobileStartCallScrolledPastPrimaryAction, setMobileStartCallScrolledPastPrimaryAction] = React.useState(false)
  const [transcript, setTranscript] = React.useState<Opportunity["transcript"]>([])
  const [speakerIdentities, setSpeakerIdentities] = React.useState<CallSpeakerIdentityMap>({})
  const [notes, setNotes] = React.useState<string[]>([])
  const [accountDrafts, setAccountDrafts] = React.useState<Record<string, AccountDraft>>({})
  const [savedAccountDrafts, setSavedAccountDrafts] = React.useState<Record<string, AccountDraft>>({})
  const [accountEnrichmentById, setAccountEnrichmentById] =
    React.useState<Record<string, AccountEnrichmentProfileRow>>({})
  const [accountEnrichmentSaveStatus, setAccountEnrichmentSaveStatus] =
    React.useState<RecordSaveStatus>("idle")
  const [accountEnrichmentSaveMessage, setAccountEnrichmentSaveMessage] = React.useState("")
  const [accountEnrichmentRunStatus, setAccountEnrichmentRunStatus] =
    React.useState<RecordSaveStatus>("idle")
  const [accountEnrichmentRunMessage, setAccountEnrichmentRunMessage] = React.useState("")
  const [opportunityDrafts, setOpportunityDrafts] = React.useState<Record<string, OpportunityDraft>>({})
  const [savedOpportunityDrafts, setSavedOpportunityDrafts] = React.useState<Record<string, OpportunityDraft>>({})
  const [accountRecordSaveStatus, setAccountRecordSaveStatus] =
    React.useState<RecordSaveStatus>("idle")
  const [accountRecordSaveMessage, setAccountRecordSaveMessage] = React.useState("")
  const [opportunityRecordSaveStatus, setOpportunityRecordSaveStatus] =
    React.useState<RecordSaveStatus>("idle")
  const [opportunityRecordSaveMessage, setOpportunityRecordSaveMessage] = React.useState("")
  const [manualCoachState, setManualCoachState] = React.useState<ManualCoachState>({
    activeQuestion: null,
    askedQuestionIds: [],
    deferredQuestionIds: [],
    feedbackSignals: [],
    lastAction: "No manual coaching actions yet.",
  })
  const [callPlaybooks, setCallPlaybooks] = React.useState<CallPlaybook[]>(() =>
    [...defaultCallPlaybooks]
  )
  const [sellerResearchProfile, setSellerResearchProfile] =
    React.useState<SellerResearchProfile>(defaultSellerResearchProfile)
  const [customerResearch, setCustomerResearch] =
    React.useState<CustomerResearchConfig>(defaultCustomerResearch)
  const [accountResearchById, setAccountResearchById] = React.useState<Record<string, CustomerResearchConfig>>({})
  const [liveGuidanceByCallId, setLiveGuidanceByCallId] = React.useState<Record<string, LiveGuidance>>({})
  const [postCallGenerating, setPostCallGenerating] = React.useState(false)
  const [postCallError, setPostCallError] = React.useState("")
  const callCapture = useCallCapture()
  const [isStoppingCall, setIsStoppingCall] = React.useState(false)
  const isCallLive =
    Boolean(callCapture.activeCallId) ||
    isRecording ||
    ["requesting-permission", "connecting", "recording", "paused", "stopping"].includes(callCapture.status)
  const canStopActiveCall =
    Boolean(activeCallId || callCapture.activeCallId) &&
    (isStoppingCall ||
      isRecording ||
      ["requesting-permission", "connecting", "recording", "paused", "stopping"].includes(callCapture.status))
  const startingRecordingRef = React.useRef(false)
  const workspaceLoadTimeoutRef = React.useRef<number | null>(null)
  const pageLoadTimeoutRef = React.useRef<number | null>(null)
  const activeAccountIdRef = React.useRef(activeAccountId)
  const activeOpportunityIdRef = React.useRef(activeOpportunityId)
  const activeCallIdRef = React.useRef(activeCallId)
  const isCallLiveRef = React.useRef(isCallLive)
  const callLimitAutoStopRef = React.useRef(false)
  const stopActiveCallRef = React.useRef<((endedReason: CallEndedReason) => void) | null>(null)
  const speakerIdentitiesRef = React.useRef(speakerIdentities)
  const transcriptRef = React.useRef(transcript)
  const workspaceDataStateRef = React.useRef(workspaceDataState)
  const loadedWorkspaceIdRef = React.useRef<string | null>(null)
  const appMainScrollRef = React.useRef<HTMLElement | null>(null)
  const pendingNavigationScrollResetRef = React.useRef(false)
  const lastScrolledNavigationKeyRef = React.useRef("")
  const navigationScrollResetTokenRef = React.useRef(0)
  const workspaceSessionActivitySentAtRef = React.useRef(0)
  const workspaceSessionStatusRef = React.useRef<WorkspaceSessionStatusResponse | null>(null)
  const handleWorkspaceSessionExpiredRef = React.useRef<((message?: string) => void) | null>(null)

  const activeOpportunity =
    workspaceOpportunities.find((opportunity) => opportunity.id === activeOpportunityId) ??
    workspaceOpportunities[0] ??
    emptyOpportunity
  const activeAccount =
    workspaceAccounts.find((account) => account.id === activeAccountId) ??
    workspaceAccounts.find((account) => account.id === activeOpportunity.accountId) ??
    workspaceAccounts[0] ??
    emptyAccount
  const editingOpportunity = editOpportunityId
    ? workspaceOpportunities.find((opportunity) => opportunity.id === editOpportunityId)
    : undefined
  const editingAccount = editAccountId
    ? workspaceAccounts.find((account) => account.id === editAccountId)
    : undefined
  const activeAccountDraft = accountDrafts[activeAccount.id] ?? createAccountDraftFromRecord(activeAccount)
  const activeSavedAccountDraft =
    savedAccountDrafts[activeAccount.id] ?? createAccountDraftFromRecord(activeAccount)
  const activeAccountEnrichment = accountEnrichmentById[activeAccount.id] ?? null
  const activeOpportunityDraft =
    opportunityDrafts[activeOpportunity.id] ?? createOpportunityDraftFromRecord(activeOpportunity)
  const activeSavedOpportunityDraft =
    savedOpportunityDrafts[activeOpportunity.id] ?? createOpportunityDraftFromRecord(activeOpportunity)
  const activeWorkspace = workspaceNavItems.find((workspace) => workspace.id === activeWorkspaceId) ?? null
  const setupWorkspace = workspaceSetupDraft ?? activeWorkspace
  const hasCompletedWorkspace = workspaceNavItems.some((workspace) => Boolean(workspace.onboardingCompletedAt))
  const activePostCallCallId =
    activeCallId ||
    postCallFocusCallId ||
    workspaceCalls
      .filter((call) => call.opportunityId === activeOpportunity.id)
      .sort((left, right) => {
        const leftTime = new Date(left.startedAt ?? 0).getTime()
        const rightTime = new Date(right.startedAt ?? 0).getTime()

        return rightTime - leftTime
      })[0]?.id ||
    ""
  const activePostCallOutput = activePostCallCallId ? postCallOutputsByCallId[activePostCallCallId] ?? null : null
  const activePostCallTranscript =
    activePostCallCallId && activePostCallCallId === activeCallId && transcript.length > 0
      ? transcript
      : activePostCallCallId
        ? transcriptsByCallId[activePostCallCallId] ?? []
        : activeOpportunity.transcript
  const activeNavigationKey = [
    activeWorkspaceId || "workspace",
    activeView,
    activeAccount.id || "account",
    activeOpportunity.id || "opportunity",
    activePostCallCallId || activeCallId || "call",
  ].join(":")

  const scrollAppContentToTop = React.useCallback(() => {
    const resetToken = navigationScrollResetTokenRef.current + 1
    navigationScrollResetTokenRef.current = resetToken
    let userScrolledAfterNavigation = false
    let cleanupUserScrollListeners: (() => void) | null = null

    const markUserScrolledAfterNavigation = () => {
      userScrolledAfterNavigation = true
      cleanupUserScrollListeners?.()
      cleanupUserScrollListeners = null
    }

    const attachUserScrollListeners = () => {
      const appContent = appMainScrollRef.current
      if (!appContent || cleanupUserScrollListeners || navigationScrollResetTokenRef.current !== resetToken) return

      appContent.addEventListener("scroll", markUserScrolledAfterNavigation, { passive: true })
      window.addEventListener("wheel", markUserScrolledAfterNavigation, { passive: true })
      window.addEventListener("touchmove", markUserScrolledAfterNavigation, { passive: true })

      cleanupUserScrollListeners = () => {
        appContent.removeEventListener("scroll", markUserScrolledAfterNavigation)
        window.removeEventListener("wheel", markUserScrolledAfterNavigation)
        window.removeEventListener("touchmove", markUserScrolledAfterNavigation)
      }
    }

    const resetScrollPosition = () => {
      if (navigationScrollResetTokenRef.current !== resetToken || userScrolledAfterNavigation) return

      const appContent = appMainScrollRef.current

      appContent?.scrollTo({ left: 0, top: 0, behavior: "auto" })
      window.scrollTo({ left: 0, top: 0, behavior: "auto" })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }

    resetScrollPosition()
    window.requestAnimationFrame(() => {
      resetScrollPosition()
      attachUserScrollListeners()
      window.requestAnimationFrame(resetScrollPosition)
    })
    window.setTimeout(resetScrollPosition, 80)
    window.setTimeout(() => {
      resetScrollPosition()
      cleanupUserScrollListeners?.()
      cleanupUserScrollListeners = null
    }, 180)
  }, [])

  const requestNavigationScrollReset = React.useCallback(() => {
    pendingNavigationScrollResetRef.current = true
    setNavigationScrollResetNonce((value) => value + 1)
    scrollAppContentToTop()
  }, [scrollAppContentToTop])

  React.useEffect(() => {
    if (!("scrollRestoration" in window.history)) return

    const previousScrollRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = "manual"

    return () => {
      window.history.scrollRestoration = previousScrollRestoration
    }
  }, [])

  const blurFocusedNavigationElement = React.useCallback(() => {
    const activeElement = document.activeElement

    if (!(activeElement instanceof HTMLElement)) return
    if (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA" || activeElement.tagName === "SELECT") return

    activeElement.blur()
  }, [])

  const ensureAuthenticatedAppRoute = React.useCallback(() => {
    if (!isAuthRoutePath(window.location.pathname)) return

    setLegalPage(null)
    setPublicAuthRoute("landing")
    setAuthMode("login")
    window.history.replaceState(null, "", "/")
  }, [])

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode)

    try {
      window.localStorage.setItem(colorModeStorageKey, darkMode ? "dark" : "light")
    } catch {
      // Storage can be unavailable in restricted browser modes. The in-memory toggle still works.
    }
  }, [darkMode])

  React.useEffect(() => {
    workspaceDataStateRef.current = workspaceDataState
  }, [workspaceDataState])

  React.useEffect(() => {
    const handlePopState = () => {
      setLegalPage(getLegalPageFromPath())
      const nextRoute = getPublicAuthRouteFromPath()
      setPublicAuthRoute(nextRoute)
      if (nextRoute !== "landing") setAuthMode(nextRoute)
    }

    window.addEventListener("popstate", handlePopState)

    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  React.useEffect(() => {
    if (!supabase) {
      setAuthSession(null)
      setAuthLoading(false)
      setAuthStatusTone("info")
      setAuthStatusMessage("")
      return
    }

    let mounted = true

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return

      if (error) {
        setAuthStatusTone("error")
        setAuthStatusMessage(getUserFacingErrorMessage(error, "SalesFrame needs a fresh sign-in to continue."))
      }

      setAuthSession(data.session?.user ? createAuthSessionFromUser(data.session.user) : null)
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthSession(session?.user ? createAuthSessionFromUser(session.user) : null)
      setAuthLoading(false)
      if (session?.user) {
        setAuthStatusTone("info")
        setAuthStatusMessage("")
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  React.useEffect(() => {
    if (!authSession) return

    ensureAuthenticatedAppRoute()
  }, [authSession, ensureAuthenticatedAppRoute])

  React.useEffect(() => {
    if (!authSession) return

    let cancelled = false

    setPersonalAccountProfile((profile) => ({
      ...profile,
      email: authSession.email,
      fullName: authSession.name || profile.fullName,
    }))

    getCurrentUserProfile()
      .then((profileRow) => {
        if (cancelled || !profileRow) return

        setPersonalAccountProfile((profile) => ({
          ...profile,
          avatarUrl: profileRow.avatar_url ?? profile.avatarUrl,
          company: profileRow.company_name ?? profile.company,
          email: profileRow.email || authSession.email,
          fullName: profileRow.full_name || authSession.name || profile.fullName,
          title: profileRow.role_title ?? profile.title,
          timezone: profileRow.timezone || profile.timezone,
        }))
      })
      .catch(() => {
        // Profile details are editable in-app; a failed profile read should not block workspace loading.
      })

    return () => {
      cancelled = true
    }
  }, [authSession])

  React.useEffect(() => {
    if (!authSession || !activeWorkspaceId) {
      setSavedOpenAiKeyState(null)
      setOpenAiKeyStatusMessage("")
      return
    }

    let cancelled = false

    setSavedOpenAiKeyState(null)
    setOpenAiKeyStatusMessage("")

    getOpenAiKeyStatus(activeWorkspaceId)
      .then((status) => {
        if (cancelled) return

        setSavedOpenAiKeyState(mapOpenAiKeyStatusToSavedState(status))
        setOpenAiKeyStatusMessage("")
      })
      .catch((caughtError: unknown) => {
        if (cancelled) return

        setSavedOpenAiKeyState(null)
        setOpenAiKeyStatusMessage(
          getUserFacingErrorMessage(caughtError, "OpenAI key status needs another check.")
        )
      })

    return () => {
      cancelled = true
    }
  }, [activeWorkspaceId, authSession])

  const saveRequiredOpenAiKey = React.useCallback(async (apiKey: string) => {
    if (!activeWorkspaceId) throw new Error("Select a workspace before saving an OpenAI key.")

    const status = await saveOpenAiKey(apiKey, activeWorkspaceId)
    const nextState = mapOpenAiKeyStatusToSavedState(status)

    setSavedOpenAiKeyState(nextState)
    setOpenAiKeyStatusMessage("")
    setBulkImportStatusRefreshToken((value) => value + 1)

    return nextState
  }, [activeWorkspaceId])

  const refreshBulkImportStatus = React.useCallback(async () => {
    if (!authSession || !activeWorkspaceId) {
      setBulkImportStatus(null)
      setBulkImportStatusMessage("")
      return
    }

    setBulkImportStatusLoading(true)
    setBulkImportStatusMessage("")

    try {
      const status = await getBulkImportStatus(activeWorkspaceId)
      setBulkImportStatus(status)
    } catch (caughtError: unknown) {
      setBulkImportStatus(null)
      setBulkImportStatusMessage(
        getUserFacingErrorMessage(caughtError, "Import enrichment status needs another check.")
      )
    } finally {
      setBulkImportStatusLoading(false)
    }
  }, [activeWorkspaceId, authSession])

  React.useEffect(() => {
    refreshBulkImportStatus()
  }, [bulkImportStatusRefreshToken, refreshBulkImportStatus])

  const handleRetryFailedBulkEnrichment = React.useCallback(async () => {
    if (!activeWorkspaceId) return

    setBulkImportStatusLoading(true)
    setBulkImportStatusMessage("")

    try {
      const status = await retryFailedBulkEnrichment(activeWorkspaceId)
      setBulkImportStatus(status)
      setBulkImportStatusMessage("SalesFrame put failed enrichment jobs back in the queue.")
    } catch (caughtError: unknown) {
      setBulkImportStatusMessage(
        getUserFacingErrorMessage(caughtError, "SalesFrame needs another try before it can retry enrichment.")
      )
    } finally {
      setBulkImportStatusLoading(false)
    }
  }, [activeWorkspaceId])

  const handleOpenCsvImport = React.useCallback((mode: CsvImportType) => {
    setCsvImportMode(mode)
    setCsvImportOpen(true)
  }, [])

  const handleStartOnboardingImport = React.useCallback((mode: CsvImportType) => {
    setOnboardingCsvImportActive(true)
    setOnboardingInitialStep(4)
    setPendingCsvImportMode(mode)
  }, [])

  const handleCsvImportOpenChange = React.useCallback((open: boolean) => {
    setCsvImportOpen(open)

    if (!open && onboardingCsvImportActive) {
      setOnboardingCsvImportActive(false)
      setOnboardingInitialStep(4)
      setOnboardingOpen(true)
    }
  }, [onboardingCsvImportActive])

  React.useEffect(() => {
    if (!pendingCsvImportMode || onboardingOpen || !activeWorkspace) return

    handleOpenCsvImport(pendingCsvImportMode)
    setPendingCsvImportMode(null)
  }, [activeWorkspace, handleOpenCsvImport, onboardingOpen, pendingCsvImportMode])

  React.useEffect(() => {
    activeAccountIdRef.current = activeAccountId
  }, [activeAccountId])

  React.useEffect(() => {
    activeOpportunityIdRef.current = activeOpportunityId
  }, [activeOpportunityId])

  React.useEffect(() => {
    activeCallIdRef.current = activeCallId
  }, [activeCallId])

  React.useEffect(() => {
    isCallLiveRef.current = isCallLive
  }, [isCallLive])

  React.useEffect(() => {
    speakerIdentitiesRef.current = speakerIdentities
  }, [speakerIdentities])

  React.useEffect(() => {
    transcriptRef.current = transcript
  }, [transcript])

  React.useEffect(() => {
    workspaceSessionStatusRef.current = workspaceSessionStatus
  }, [workspaceSessionStatus])

  const handleWorkspaceSessionStatus = React.useCallback((status: WorkspaceSessionStatusResponse) => {
    setWorkspaceSessionStatus(status)

    if (status.state === "expired") {
      handleWorkspaceSessionExpiredRef.current?.(workspaceSessionExpiredMessage)
      return
    }

    if (status.state !== "warning" || isCallLiveRef.current) {
      setWorkspaceSessionWarningOpen(false)
    }
  }, [])

  const sendWorkspaceSessionActivity = React.useCallback(async (
    activityType: Parameters<typeof recordWorkspaceSessionActivity>[0]["activityType"] = "user_activity",
    options: { force?: boolean } = {}
  ) => {
    if (!authSession || !activeWorkspaceId) return null

    const now = Date.now()
    const activeCallForHeartbeat = isCallLiveRef.current ? activeCallIdRef.current || callCapture.activeCallId || null : null

    if (
      !options.force &&
      !activeCallForHeartbeat &&
      now - workspaceSessionActivitySentAtRef.current < workspaceSessionActivityThrottleMs
    ) {
      return workspaceSessionStatusRef.current
    }

    workspaceSessionActivitySentAtRef.current = now

    try {
      const status = await recordWorkspaceSessionActivity({
        activeCallId: activeCallForHeartbeat,
        activityType,
        workspaceId: activeWorkspaceId,
      })

      handleWorkspaceSessionStatus(status)

      return status
    } catch (caughtError: unknown) {
      const message = getUserFacingErrorMessage(caughtError, workspaceSessionExpiredMessage)

      if (message === workspaceSessionExpiredMessage || /session/i.test(message)) {
        handleWorkspaceSessionExpiredRef.current?.(message)
      }

      throw caughtError
    }
  }, [activeWorkspaceId, authSession, callCapture.activeCallId, handleWorkspaceSessionStatus])

  React.useEffect(() => {
    if (!authSession || !activeWorkspaceId) {
      setWorkspaceSessionStatus(null)
      setWorkspaceSessionWarningOpen(false)
      return
    }

    let cancelled = false

    getWorkspaceSessionStatus(activeWorkspaceId)
      .then((status) => {
        if (cancelled) return
        handleWorkspaceSessionStatus(status)
      })
      .catch((caughtError: unknown) => {
        const message = getUserFacingErrorMessage(caughtError, workspaceSessionExpiredMessage)

        if (!cancelled && (message === workspaceSessionExpiredMessage || /session/i.test(message))) {
          handleWorkspaceSessionExpiredRef.current?.(message)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeWorkspaceId, authSession, handleWorkspaceSessionStatus])

  React.useEffect(() => {
    if (!authSession || !activeWorkspaceId) return

    const broadcastChannel =
      "BroadcastChannel" in window ? new BroadcastChannel("salesframe-session-activity") : null
    const recordActivity = () => {
      broadcastChannel?.postMessage({ activeWorkspaceId, type: "activity" })
      void sendWorkspaceSessionActivity("user_activity").catch(() => undefined)
    }
    const recordBroadcastActivity = () => {
      void sendWorkspaceSessionActivity("user_activity").catch(() => undefined)
    }
    const activityEvents: Array<keyof WindowEventMap> = [
      "keydown",
      "pointerdown",
      "touchstart",
    ]

    activityEvents.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }))
    window.addEventListener("focus", recordActivity)
    window.addEventListener("visibilitychange", recordActivity)
    broadcastChannel?.addEventListener("message", recordBroadcastActivity)

    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, recordActivity))
      window.removeEventListener("focus", recordActivity)
      window.removeEventListener("visibilitychange", recordActivity)
      broadcastChannel?.removeEventListener("message", recordBroadcastActivity)
      broadcastChannel?.close()
    }
  }, [activeWorkspaceId, authSession, sendWorkspaceSessionActivity])

  React.useEffect(() => {
    if (!authSession || !activeWorkspaceId) return

    const intervalId = window.setInterval(() => {
      if (isCallLiveRef.current) {
        void sendWorkspaceSessionActivity("live_call_heartbeat", { force: true }).catch(() => undefined)
        return
      }

      getWorkspaceSessionStatus(activeWorkspaceId)
        .then(handleWorkspaceSessionStatus)
        .catch((caughtError: unknown) => {
          const message = getUserFacingErrorMessage(caughtError, workspaceSessionExpiredMessage)

          if (message === workspaceSessionExpiredMessage || /session/i.test(message)) {
            handleWorkspaceSessionExpiredRef.current?.(message)
          }
        })
    }, workspaceSessionLiveHeartbeatMs)

    return () => window.clearInterval(intervalId)
  }, [activeWorkspaceId, authSession, handleWorkspaceSessionStatus, sendWorkspaceSessionActivity])

  React.useEffect(() => {
    if (!workspaceSessionStatus || !authSession || !activeWorkspaceId || isCallLive) {
      setWorkspaceSessionWarningOpen(false)
      return
    }

    const now = Date.now()
    const warningTime = workspaceSessionStatus.warningAt ? new Date(workspaceSessionStatus.warningAt).getTime() : null
    const expiryTime = new Date(workspaceSessionStatus.expiresAt).getTime()
    const timeoutIds: number[] = []

    if (workspaceSessionStatus.state === "warning" || (warningTime !== null && now >= warningTime)) {
      setWorkspaceSessionWarningOpen(workspaceSessionStatus.state !== "expired")
    } else if (warningTime !== null) {
      timeoutIds.push(window.setTimeout(() => setWorkspaceSessionWarningOpen(true), Math.max(0, warningTime - now)))
    }

    if (now >= expiryTime) {
      handleWorkspaceSessionExpiredRef.current?.(workspaceSessionExpiredMessage)
    } else {
      timeoutIds.push(
        window.setTimeout(() => {
          handleWorkspaceSessionExpiredRef.current?.(workspaceSessionExpiredMessage)
        }, Math.max(0, expiryTime - now))
      )
    }

    return () => timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId))
  }, [activeWorkspaceId, authSession, isCallLive, workspaceSessionStatus])

  React.useLayoutEffect(() => {
    if (pageLoadingView || loadingWorkspace || workspaceDataState === "loading") return
    if (!pendingNavigationScrollResetRef.current && lastScrolledNavigationKeyRef.current === activeNavigationKey) return

    scrollAppContentToTop()
    pendingNavigationScrollResetRef.current = false
    lastScrolledNavigationKeyRef.current = activeNavigationKey
  }, [
    activeNavigationKey,
    loadingWorkspace,
    navigationScrollResetNonce,
    pageLoadingView,
    scrollAppContentToTop,
    workspaceDataState,
  ])

  React.useEffect(() => {
    if (
      !authSession ||
      !activeWorkspace ||
      workspaceSetupDraft ||
      onboardingCsvImportActive ||
      pendingCsvImportMode ||
      csvImportOpen
    ) {
      return
    }

    const isComplete = Boolean(activeWorkspace.onboardingCompletedAt)

    if (!isComplete) {
      setOnboardingOpen(true)
    }
  }, [activeWorkspace, authSession, csvImportOpen, onboardingCsvImportActive, pendingCsvImportMode, workspaceSetupDraft])

  React.useEffect(() => {
    if (!authSession) return

    let cancelled = false

    const loadWorkspaceList = async () => {
      setWorkspaceDataState("loading")
      setWorkspaceErrorMessage("")

      try {
        let workspaceRows = await listWorkspaces()

        if (workspaceRows.length === 0) {
          const createdWorkspace = await createSupabaseWorkspace({
            name: "SalesFrame",
            description: "Seller workspace",
            default_currency: defaultCurrencyCode,
            workspace_icon: defaultWorkspaceIconId,
          })

          workspaceRows = [createdWorkspace]
        }

        if (cancelled) return

        const navItems = workspaceRows.map(mapWorkspaceRowToNavItem)

        setWorkspaceNavItems(navItems)
        setActiveWorkspaceId((currentWorkspaceId) =>
          currentWorkspaceId && navItems.some((workspace) => workspace.id === currentWorkspaceId)
            ? currentWorkspaceId
            : navItems[0]?.id ?? ""
        )
      } catch (caughtError: unknown) {
        if (cancelled) return

        setWorkspaceErrorMessage(getUserFacingErrorMessage(caughtError, "SalesFrame needs another moment to load your workspaces."))
        setWorkspaceDataState("error")
      }
    }

    loadWorkspaceList()

    return () => {
      cancelled = true
    }
  }, [authSession])

  const refreshWorkspaceData = React.useCallback(async () => {
    if (!authSession || !activeWorkspaceId) return

    const previousDataState = workspaceDataStateRef.current
    const canPreserveCurrentWorkspace =
      loadedWorkspaceIdRef.current === activeWorkspaceId &&
      (previousDataState === "ready" || previousDataState === "empty")

    setWorkspaceDataState("loading")
    setWorkspaceErrorMessage("")

    try {
      await sendWorkspaceSessionActivity("workspace_load", { force: true })

      const [
        accountRows,
        opportunityRows,
        callRows,
        playbookRows,
        sellerResearchProfileRow,
        archivedAccounts,
        archivedOpportunities,
      ] = await Promise.all([
        listWorkspaceAccounts(activeWorkspaceId),
        listWorkspaceOpportunities(activeWorkspaceId),
        listWorkspaceCalls(activeWorkspaceId),
        listWorkspacePlaybooks(activeWorkspaceId),
        getSellerResearchProfile(activeWorkspaceId),
        listArchivedAccounts(activeWorkspaceId),
        listArchivedOpportunities(activeWorkspaceId),
      ])
      const activeAccountIds = new Set(accountRows.map((account) => account.id))
      const activeOpportunityRows = opportunityRows.filter((opportunity) => activeAccountIds.has(opportunity.account_id))
      const activeOpportunityIds = new Set(activeOpportunityRows.map((opportunity) => opportunity.id))
      const activeCallRows = callRows.filter(
        (call) => !call.opportunity_id || activeOpportunityIds.has(call.opportunity_id)
      )
      const [playbookAssignments, customerResearchRuns, playbookFieldRows, enrichmentProfiles] = await Promise.all([
        listOpportunityPlaybookAssignments(activeOpportunityRows.map((opportunity) => opportunity.id)),
        listCustomerResearchRunsForAccounts(accountRows.map((account) => account.id)),
        listPlaybookFields(playbookRows.map((playbook) => playbook.id)),
        listAccountEnrichmentProfiles(accountRows.map((account) => account.id)),
      ])
      const callIds = activeCallRows.map((call) => call.id)
      const opportunityIds = activeOpportunityRows.map((opportunity) => opportunity.id)
      const [
        callNotes,
        callSpeakers,
        nextCallBriefs,
        opportunityFieldEvidence,
        postCallOutputs,
        transcriptSegments,
      ] = await Promise.all([
        listCallNotes(callIds),
        listCallSpeakers(callIds),
        listNextCallBriefs(opportunityIds),
        listOpportunityFieldEvidence(opportunityIds),
        listPostCallOutputs(callIds),
        listTranscriptSegments(callIds),
      ])

      const nextOpportunities = mapOpportunityRowsToUi({
        calls: activeCallRows,
        callNotes,
        callSpeakers,
        nextCallBriefs,
        opportunityFieldEvidence,
        opportunities: activeOpportunityRows,
        playbookFields: playbookFieldRows,
        playbooks: playbookRows,
        playbookAssignments,
        transcriptSegments,
      })
      const nextAccounts = mapAccountRowsToNavItems(accountRows, activeOpportunityRows)
      const currentActiveAccountId = activeAccountIdRef.current
      const currentActiveOpportunityId = activeOpportunityIdRef.current

      setWorkspacePlaybooks(playbookRows)
      setWorkspacePlaybookFields(playbookFieldRows)
      setWorkspaceCalls(mapCallRowsToSummaries(activeCallRows))
      setPostCallOutputsByCallId(mapPostCallOutputsByCallId(postCallOutputs))
      setTranscriptsByCallId(mapTranscriptSegmentsByCallId({ callSpeakers, transcriptSegments }))
      setWorkspaceAccounts(nextAccounts)
      setWorkspaceOpportunities(nextOpportunities)
      setArchivedAccountRows(archivedAccounts)
      setArchivedOpportunityRows(archivedOpportunities)
      const nextAccountDrafts = mapAccountRowsToDrafts(accountRows)
      const nextOpportunityDrafts = mapOpportunityRowsToDrafts({
        accounts: accountRows,
        opportunities: activeOpportunityRows,
        playbooks: playbookRows,
        playbookAssignments,
      })

      setAccountDrafts(nextAccountDrafts)
      setSavedAccountDrafts(nextAccountDrafts)
      setOpportunityDrafts(nextOpportunityDrafts)
      setSavedOpportunityDrafts(nextOpportunityDrafts)
      setAccountEnrichmentById(
        Object.fromEntries(enrichmentProfiles.map((profile) => [profile.account_id, profile]))
      )
      setSellerResearchProfile(mapSellerResearchProfileRow(sellerResearchProfileRow))
      setAccountResearchById(mapCustomerResearchRunsToAccountConfig(customerResearchRuns))

      const nextActiveOpportunity =
        nextOpportunities.find((opportunity) => opportunity.id === currentActiveOpportunityId) ?? nextOpportunities[0]
      const nextActiveAccount =
        nextAccounts.find((account) => account.id === currentActiveAccountId) ??
        nextAccounts.find((account) => account.id === nextActiveOpportunity?.accountId) ??
        nextAccounts[0]

      if (!isCallLiveRef.current) {
        setActiveOpportunityId(nextActiveOpportunity?.id ?? "")
        setActiveAccountId(nextActiveAccount?.id ?? nextActiveOpportunity?.accountId ?? "")
      }
      const nextDataState =
        nextAccounts.length === 0 && nextOpportunities.length === 0 && activeCallRows.length === 0 ? "empty" : "ready"

      loadedWorkspaceIdRef.current = activeWorkspaceId
      workspaceDataStateRef.current = nextDataState
      setWorkspaceDataState(nextDataState)
    } catch (caughtError: unknown) {
      const isPermissionDenied = isPermissionDeniedError(caughtError)
      const message = getUserFacingErrorMessage(caughtError, "SalesFrame needs another moment to load this workspace.")

      setWorkspaceErrorMessage(message)
      if (canPreserveCurrentWorkspace) {
        setWorkspaceDataState(previousDataState)
        return
      }

      setWorkspaceDataState(isPermissionDenied ? "permission-denied" : "error")
    }
  }, [
    activeWorkspaceId,
    authSession,
    sendWorkspaceSessionActivity,
  ])

  React.useEffect(() => {
    refreshWorkspaceData()
  }, [refreshWorkspaceData, workspaceRefreshToken])

  React.useEffect(() => {
    if (!authSession || !activeWorkspaceId) return

    upsertSellerResearchProfile({
      workspace_id: activeWorkspaceId,
      seller_company: sellerResearchProfile.sellerCompany,
      seller_domain: sellerResearchProfile.sellerDomain,
      product_context: sellerResearchProfile.productContext,
    }).catch(() => undefined)
  }, [activeWorkspaceId, authSession, sellerResearchProfile])

  React.useEffect(() => {
    return () => {
      if (workspaceLoadTimeoutRef.current !== null) {
        window.clearTimeout(workspaceLoadTimeoutRef.current)
      }
    }
  }, [])

  React.useEffect(() => {
    setAccountRecordSaveStatus("idle")
    setAccountRecordSaveMessage("")
    setAccountEnrichmentSaveStatus("idle")
    setAccountEnrichmentSaveMessage("")
    setAccountEnrichmentRunStatus("idle")
    setAccountEnrichmentRunMessage("")
  }, [activeAccount.id])

  React.useEffect(() => {
    setOpportunityRecordSaveStatus("idle")
    setOpportunityRecordSaveMessage("")
  }, [activeOpportunity.id])

  React.useEffect(() => {
    if (startingRecordingRef.current) {
      startingRecordingRef.current = false
      return
    }

    setCallType(activeOpportunity.callType)
    setCallPlaybooks(parsePlaybookSelection(opportunityDrafts[activeOpportunity.id]?.frameworks))
    setCustomerResearch(accountResearchById[activeOpportunity.accountId] ?? defaultCustomerResearch)
    const nextSpeakerIdentities = buildSpeakerIdentityMapFromTranscript(activeOpportunity.transcript)
    const nextTranscript = applySpeakerIdentitiesToTranscript(activeOpportunity.transcript, nextSpeakerIdentities)
    setSpeakerIdentities(nextSpeakerIdentities)
    transcriptRef.current = nextTranscript
    setTranscript(nextTranscript)
    setNotes(activeOpportunity.notes)
    setElapsed(0)
    setIsRecording(false)
    setActiveCallId("")
    setActiveCallStartedAt("")
  }, [activeOpportunityId])

  React.useEffect(() => {
    if (!isCallLive) return
    const startedAtMs = Date.parse(activeCallStartedAt)
    const refreshElapsed = () => {
      if (Number.isFinite(startedAtMs)) {
        setElapsed(Math.max(0, Math.round((Date.now() - startedAtMs) / 1000)))
        return
      }

      setElapsed((value) => value + 1)
    }

    const interval = window.setInterval(() => {
      refreshElapsed()
    }, 1000)

    refreshElapsed()

    return () => window.clearInterval(interval)
  }, [activeCallStartedAt, isCallLive])

  React.useEffect(() => {
    setManualCoachState({
      activeQuestion: null,
      askedQuestionIds: [],
      deferredQuestionIds: [],
      feedbackSignals: [],
      lastAction: "No manual coaching actions yet.",
    })
  }, [activeOpportunityId])

  const handleNavigate = React.useCallback((view: string) => {
    blurFocusedNavigationElement()

    if (view === activeView) {
      requestNavigationScrollReset()
      return
    }

    if (pageLoadTimeoutRef.current !== null) {
      window.clearTimeout(pageLoadTimeoutRef.current)
      pageLoadTimeoutRef.current = null
    }

    if (workspaceDataState === "ready" && !loadingWorkspace) {
      setPageLoadingView(view)
      pageLoadTimeoutRef.current = window.setTimeout(() => {
        setPageLoadingView(null)
        pageLoadTimeoutRef.current = null
      }, minimumPageLoadMs)
    } else {
      setPageLoadingView(null)
    }

    setActiveView(view)
    requestNavigationScrollReset()
  }, [activeView, blurFocusedNavigationElement, loadingWorkspace, requestNavigationScrollReset, workspaceDataState])

  const handleAccountSelect = (accountId: string) => {
    requestNavigationScrollReset()
    setActiveAccountId(accountId)
    setPostCallFocusCallId("")
    const firstOpportunity = workspaceOpportunities.find((opportunity) => opportunity.accountId === accountId)
    if (firstOpportunity) {
      setActiveOpportunityId(firstOpportunity.id)
    }
    handleNavigate("account-detail")
  }

  const handleOpportunitySelect = (opportunityId: string) => {
    const selectedOpportunity = workspaceOpportunities.find((opportunity) => opportunity.id === opportunityId)
    if (selectedOpportunity) {
      requestNavigationScrollReset()
      setActiveAccountId(selectedOpportunity.accountId)
      setActiveOpportunityId(opportunityId)
      setPostCallFocusCallId("")
      handleNavigate("opportunity-record")
    }
  }

  const persistLiveCoachFeedback = React.useCallback((signal: ManualCoachState["feedbackSignals"][number]) => {
    const callId = activeCallIdRef.current
    const opportunityId = activeOpportunityIdRef.current
    if (!callId || !opportunityId) return

    void insertLiveGuidanceFeedback({
      action: signal.action,
      call_id: callId,
      opportunity_id: opportunityId,
      playbook_label: signal.playbookLabel,
      question: signal.question,
      reason: signal.reason,
      target: signal.target,
    }).catch(() => undefined)
  }, [])

  const createLiveCoachFeedbackSignal = React.useCallback((
    action: LiveSellerFeedbackAction,
    question: ManualQuestion
  ): ManualCoachState["feedbackSignals"][number] => ({
    action,
    createdAt: new Date().toISOString(),
    playbookLabel: question.framework,
    question: question.question,
    reason: question.reason,
    target: question.target,
  }), [])

  const handleUseManualQuestion = (question: ManualQuestion) => {
    const signal = createLiveCoachFeedbackSignal("use_next", question)
    setManualCoachState((state) => ({
      ...state,
      activeQuestion: question,
      deferredQuestionIds: state.deferredQuestionIds.filter((id) => id !== question.id),
      feedbackSignals: [...state.feedbackSignals.slice(-19), signal],
      lastAction: `Selected next question: "${question.question}"`,
    }))
    persistLiveCoachFeedback(signal)
  }

  const handleMarkManualQuestionAsked = (question: ManualQuestion) => {
    const signal = createLiveCoachFeedbackSignal("asked", question)
    setManualCoachState((state) => ({
      ...state,
      activeQuestion: state.activeQuestion?.id === question.id ? null : state.activeQuestion,
      askedQuestionIds: state.askedQuestionIds.includes(question.id)
        ? state.askedQuestionIds
        : [...state.askedQuestionIds, question.id],
      deferredQuestionIds: state.deferredQuestionIds.filter((id) => id !== question.id),
      feedbackSignals: [...state.feedbackSignals.slice(-19), signal],
      lastAction: `Listening for the answer to: "${question.question}"`,
    }))
    persistLiveCoachFeedback(signal)
  }

  const handleLiveCoachFeedback = (action: LiveSellerFeedbackAction, question: ManualQuestion) => {
    const signal = createLiveCoachFeedbackSignal(action, question)
    setManualCoachState((state) => ({
      ...state,
      activeQuestion:
        action === "softer"
          ? state.activeQuestion
          : state.activeQuestion?.id === question.id
            ? null
            : state.activeQuestion,
      deferredQuestionIds:
        action === "skip" || action === "too_soon"
          ? state.deferredQuestionIds.includes(question.id)
            ? state.deferredQuestionIds
            : [...state.deferredQuestionIds, question.id]
          : state.deferredQuestionIds,
      feedbackSignals: [...state.feedbackSignals.slice(-19), signal],
      lastAction:
        action === "too_soon"
          ? `Marked too soon: "${question.question}"`
          : action === "softer"
            ? `Asked for softer wording: "${question.question}"`
            : action === "skip"
              ? `Skipped: "${question.question}"`
              : `Coach feedback saved: "${question.question}"`,
    }))
    persistLiveCoachFeedback(signal)
  }

  const handleCallSelect = (callId: string) => {
    const selectedCall = workspaceCalls.find((call) => call.id === callId)
    if (!selectedCall) return

    const selectedOpportunity = workspaceOpportunities.find(
      (opportunity) => opportunity.id === selectedCall.opportunityId
    )
    if (!selectedOpportunity) return

    requestNavigationScrollReset()
    setActiveAccountId(selectedOpportunity.accountId)
    setActiveOpportunityId(selectedOpportunity.id)
    setPostCallFocusCallId(callId)

    handleNavigate("post-call")
  }

  const handleOpenCreateOpportunity = (accountId = activeAccount.id) => {
    setCreateOpportunityAccountId(accountId)
    setCreateOpportunityOpen(true)
  }

  const handleOpenEditAccount = (accountId: string) => {
    if (!workspaceAccounts.some((account) => account.id === accountId)) return

    setEditAccountId(accountId)
  }

  const handleOpenEditOpportunity = (opportunityId: string) => {
    if (!workspaceOpportunities.some((opportunity) => opportunity.id === opportunityId)) return

    setEditOpportunityId(opportunityId)
  }

  const handleRequestDeleteAccount = (accountId: string) => {
    const account = workspaceAccounts.find((item) => item.id === accountId)
    if (!account) return

    const relatedOpportunities = workspaceOpportunities.filter(
      (opportunity) => opportunity.accountId === accountId
    )

    setPendingDeleteRecord({
      type: "account",
      id: account.id,
      name: account.name,
      detail: relatedOpportunities.length
        ? `This removes the account and ${relatedOpportunities.length} linked ${
            relatedOpportunities.length === 1 ? "opportunity" : "opportunities"
          } from this workspace.`
        : "This removes the account from this workspace.",
    })
  }

  const handleRequestDeleteOpportunity = (opportunityId: string) => {
    const opportunity = workspaceOpportunities.find((item) => item.id === opportunityId)
    if (!opportunity) return

    setPendingDeleteRecord({
      type: "opportunity",
      id: opportunity.id,
      name: opportunity.name,
      detail: "This removes the opportunity, its editable record, and its sidebar link from this workspace.",
    })
  }

  const isActiveCallRecordingOpportunity = (opportunityId: string) => {
    if (!activeCallIdRef.current || callCapture.status === "idle") return false

    return workspaceCalls.some(
      (call) => call.id === activeCallIdRef.current && call.opportunityId === opportunityId
    )
  }

  const isActiveCallRecordingAccount = (accountId: string) => {
    if (!activeCallIdRef.current || callCapture.status === "idle") return false

    const opportunityIds = new Set(
      workspaceOpportunities
        .filter((opportunity) => opportunity.accountId === accountId)
        .map((opportunity) => opportunity.id)
    )

    return workspaceCalls.some(
      (call) => call.id === activeCallIdRef.current && opportunityIds.has(call.opportunityId)
    )
  }

  const handleRequestArchiveAccount = (accountId: string) => {
    const account = workspaceAccounts.find((item) => item.id === accountId)
    if (!account) return

    const relatedOpportunities = workspaceOpportunities.filter(
      (opportunity) => opportunity.accountId === accountId
    )

    setPendingArchiveRecord({
      type: "account",
      id: account.id,
      name: account.name,
      detail: relatedOpportunities.length
        ? `This hides the account and ${relatedOpportunities.length} linked ${
            relatedOpportunities.length === 1 ? "opportunity" : "opportunities"
          } from active workspace views. You can restore it from your Account page.`
        : "This hides the account from active workspace views. You can restore it from your Account page.",
    })
  }

  const handleRequestArchiveOpportunity = (opportunityId: string) => {
    const opportunity = workspaceOpportunities.find((item) => item.id === opportunityId)
    if (!opportunity) return

    setPendingArchiveRecord({
      type: "opportunity",
      id: opportunity.id,
      name: opportunity.name,
      detail: "This hides the opportunity from active workspace views. Calls, recordings, evidence, and notes stay attached if you restore it later.",
    })
  }

  const handleRequestDeleteCall = (callId: string) => {
    const call = workspaceCalls.find((item) => item.id === callId)
    if (!call) return

    const relatedOpportunity = workspaceOpportunities.find((opportunity) => opportunity.id === call.opportunityId)
    const relatedAccount = relatedOpportunity
      ? workspaceAccounts.find((account) => account.id === relatedOpportunity.accountId)
      : undefined

    setPendingDeleteRecord({
      type: "call",
      id: call.id,
      name: call.title,
      detail: [
        `This removes the ${call.date} ${call.type} call from this workspace.`,
        relatedAccount && relatedOpportunity
          ? `It belongs to ${relatedAccount.name} / ${relatedOpportunity.name}.`
          : "",
        "Transcript, notes, speaker labels, AI outputs, and recording links tied to this call are removed.",
      ]
        .filter(Boolean)
        .join(" "),
    })
  }

  const handleConfirmArchiveRecord = async (): Promise<RecordMutationResult> => {
    if (!pendingArchiveRecord) {
      return {
        message: "Choose a record before archiving.",
        ok: false,
      }
    }

    const archiveRecord = pendingArchiveRecord

    if (archiveRecord.type === "account" && isActiveCallRecordingAccount(archiveRecord.id)) {
      return {
        message: "Stop the active call before archiving this account.",
        ok: false,
      }
    }

    if (archiveRecord.type === "opportunity" && isActiveCallRecordingOpportunity(archiveRecord.id)) {
      return {
        message: "Stop the active call before archiving this opportunity.",
        ok: false,
      }
    }

    try {
      if (archiveRecord.type === "account") {
        await archiveSupabaseAccount(archiveRecord.id)
      } else {
        await archiveSupabaseOpportunity(archiveRecord.id)
      }

      setPendingArchiveRecord(null)

      if (archiveRecord.type === "account") {
        const archivedOpportunityIds = new Set(
          workspaceOpportunities
            .filter((opportunity) => opportunity.accountId === archiveRecord.id)
            .map((opportunity) => opportunity.id)
        )

        setWorkspaceAccounts((items) => items.filter((account) => account.id !== archiveRecord.id))
        setWorkspaceOpportunities((items) => items.filter((opportunity) => opportunity.accountId !== archiveRecord.id))
        setWorkspaceCalls((items) => items.filter((call) => !archivedOpportunityIds.has(call.opportunityId)))
        if (
          activeAccountIdRef.current === archiveRecord.id ||
          archivedOpportunityIds.has(activeOpportunityIdRef.current)
        ) {
          setActiveAccountId("")
          setActiveOpportunityId("")
          setPostCallFocusCallId("")
          handleNavigate("home")
        }
      } else {
        setWorkspaceOpportunities((items) => items.filter((opportunity) => opportunity.id !== archiveRecord.id))
        setWorkspaceCalls((items) => items.filter((call) => call.opportunityId !== archiveRecord.id))
        if (activeOpportunityIdRef.current === archiveRecord.id) {
          setActiveOpportunityId("")
          setPostCallFocusCallId("")
          handleNavigate("home")
        }
      }

      setWorkspaceRefreshToken((value) => value + 1)

      return {
        ok: true,
      }
    } catch (caughtError: unknown) {
      return {
        message: getUserFacingErrorMessage(caughtError, "Record needs another archive attempt."),
        ok: false,
      }
    }
  }

  const handleRestoreArchivedAccount = async (accountId: string): Promise<RecordMutationResult> => {
    try {
      await unarchiveSupabaseAccount(accountId)
      setWorkspaceRefreshToken((value) => value + 1)

      return { ok: true }
    } catch (caughtError: unknown) {
      return {
        message: getUserFacingErrorMessage(caughtError, "Account needs another restore attempt."),
        ok: false,
      }
    }
  }

  const handleRestoreArchivedOpportunity = async (opportunityId: string): Promise<RecordMutationResult> => {
    const archivedOpportunity = archivedOpportunityRows.find((opportunity) => opportunity.id === opportunityId)
    const parentAccountArchived = archivedOpportunity
      ? archivedAccountRows.some((account) => account.id === archivedOpportunity.account_id)
      : false

    if (parentAccountArchived) {
      return {
        message: "Restore the account before restoring this opportunity.",
        ok: false,
      }
    }

    try {
      await unarchiveSupabaseOpportunity(opportunityId)
      setWorkspaceRefreshToken((value) => value + 1)

      return { ok: true }
    } catch (caughtError: unknown) {
      return {
        message: getUserFacingErrorMessage(caughtError, "Opportunity needs another restore attempt."),
        ok: false,
      }
    }
  }

  const handleConfirmDeleteRecord = async (): Promise<RecordMutationResult> => {
    if (!pendingDeleteRecord) {
      return {
        message: "Choose a record before deleting.",
        ok: false,
      }
    }

    try {
      const deletingActiveOpportunity =
        pendingDeleteRecord.type === "opportunity" &&
        workspaceCalls.some(
          (call) => call.id === activeCallIdRef.current && call.opportunityId === pendingDeleteRecord.id
        )

      if (pendingDeleteRecord.type === "account") {
        await deleteSupabaseAccount(pendingDeleteRecord.id)
      } else if (pendingDeleteRecord.type === "call") {
        if (pendingDeleteRecord.id === activeCallIdRef.current && callCapture.status !== "idle") {
          await callCapture.stopCall()
        }
        await deleteSupabaseCall(pendingDeleteRecord.id)
      } else {
        if (deletingActiveOpportunity && callCapture.status !== "idle") {
          await callCapture.stopCall()
        }
        await deleteSupabaseOpportunity(pendingDeleteRecord.id)
      }

      setPendingDeleteRecord(null)
      if (
        (pendingDeleteRecord.type === "call" && pendingDeleteRecord.id === postCallFocusCallId) ||
        (pendingDeleteRecord.type === "opportunity" && pendingDeleteRecord.id === activeOpportunityId)
      ) {
        setPostCallFocusCallId("")
      }
      if (
        (pendingDeleteRecord.type === "call" && pendingDeleteRecord.id === activeCallIdRef.current) ||
        deletingActiveOpportunity
      ) {
        setActiveCallId("")
        setActiveCallStartedAt("")
        setIsRecording(false)
      }
      handleNavigate(
        pendingDeleteRecord.type === "account"
          ? "home"
          : pendingDeleteRecord.type === "call"
            ? "calls"
            : "opportunities"
      )
      setWorkspaceRefreshToken((value) => value + 1)

      return {
        ok: true,
      }
    } catch (caughtError: unknown) {
      return {
        message: getUserFacingErrorMessage(caughtError, "Record needs another delete attempt."),
        ok: false,
      }
    }
  }

  const handleRecordingChange = async (
    recording: boolean,
    options: { endedReason?: CallEndedReason } = {}
  ) => {
    if (recording) {
      return
    }

    if (isStoppingCall) return

    const stoppingCallId = activeCallId || callCapture.activeCallId || activeCallIdRef.current

    if (!stoppingCallId) {
      setIsRecording(false)
      if (elapsed > 0) handleNavigate("post-call")
      return
    }

    let stoppedCallId = stoppingCallId

    try {
      setIsStoppingCall(true)
      setPostCallError("")
      const stoppedCall = await callCapture.stopCall({
        endedReason: options.endedReason ?? "seller_stopped",
      })
      stoppedCallId = stoppedCall?.callId ?? stoppingCallId
      setPostCallFocusCallId(stoppedCallId)
      if (stoppedCall) {
        setWorkspaceCalls((items) =>
          items.map((call) =>
            call.id === stoppedCallId
              ? {
                  ...call,
                  duration: formatTime(stoppedCall.durationSeconds),
                  durationLimitSeconds: call.durationLimitSeconds || MAX_LIVE_CALL_SECONDS,
                  durationSeconds: stoppedCall.durationSeconds,
                  endedReason: stoppedCall.endedReason,
                  recordingError: stoppedCall.recordingError ?? call.recordingError,
                  recordingMimeType: stoppedCall.recordingMimeType ?? call.recordingMimeType,
                  recordingReadyAt: stoppedCall.recordingReadyAt ?? call.recordingReadyAt,
                  recordingSizeBytes: stoppedCall.recordingSizeBytes ?? call.recordingSizeBytes,
                  recordingStatus: stoppedCall.recordingStatus,
                  recordingStoragePath: stoppedCall.recordingStoragePath ?? call.recordingStoragePath,
                  recordingUrl: stoppedCall.recordingUrl ?? call.recordingUrl,
                  status: "Processing",
                }
              : call
          )
        )
      }
      setIsRecording(false)
      setActiveCallId("")
      activeCallIdRef.current = ""
      setActiveCallStartedAt("")
      handleNavigate("post-call")
    } catch (caughtError: unknown) {
      setPostCallFocusCallId(stoppedCallId)
      setIsRecording(false)
      setActiveCallId("")
      activeCallIdRef.current = ""
      setActiveCallStartedAt("")
      handleNavigate("post-call")
      setPostCallError(getUserFacingErrorMessage(caughtError, "The call ended, and a few post-call items need another save attempt."))
    } finally {
      setIsStoppingCall(false)
    }

    try {
      setPostCallGenerating(true)
      const output = await requestPostCallOutputs(stoppedCallId)
      setPostCallOutputsByCallId((items) => ({
        ...items,
        [stoppedCallId]: mapPostCallOutputResponse(output),
      }))
      setWorkspaceRefreshToken((value) => value + 1)
    } catch (caughtError: unknown) {
      setPostCallError(getUserFacingErrorMessage(caughtError, "Post-call brief needs another pass."))
    } finally {
      setPostCallGenerating(false)
    }
  }

  React.useEffect(() => {
    stopActiveCallRef.current = (endedReason: CallEndedReason) => {
      void handleRecordingChange(false, { endedReason })
    }
  })

  React.useEffect(() => {
    if (!isCallLive || !activeCallId || !activeCallStartedAt) {
      callLimitAutoStopRef.current = false
      return
    }

    const startedAtMs = Date.parse(activeCallStartedAt)
    if (!Number.isFinite(startedAtMs)) return

    const deadlineMs = startedAtMs + MAX_LIVE_CALL_SECONDS * 1000
    const checkDeadline = () => {
      if (Date.now() < deadlineMs) return
      if (callLimitAutoStopRef.current) return

      callLimitAutoStopRef.current = true
      stopActiveCallRef.current?.("time_limit_reached")
    }
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "hidden") return
      checkDeadline()
    }
    const interval = window.setInterval(checkDeadline, 1000)

    checkDeadline()
    document.addEventListener("visibilitychange", handleVisibilityOrFocus)
    window.addEventListener("focus", handleVisibilityOrFocus)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus)
      window.removeEventListener("focus", handleVisibilityOrFocus)
    }
  }, [activeCallId, activeCallStartedAt, isCallLive])

  const handleTranscriptSpeakerChange = async (segmentId: string, speaker: TranscriptSpeaker) => {
    if (!activeCallId || !segmentId) return
    if (!isPersistedTranscriptSegmentId(segmentId)) {
      setTranscript((items) => {
        const nextItems = items.map((line) =>
          line.id === segmentId || line.clientId === segmentId
            ? {
                ...line,
                speaker,
                speakerAttributionReason: "Seller corrected the provisional speaker label.",
                speakerConfidence: 1,
                speakerDisplayName: speakerIdentitiesRef.current[speaker]?.displayName || speaker,
                speakerLabel: speaker,
                speakerNeedsReview: false,
                speakerSource: "manual",
              }
            : line
        )

        transcriptRef.current = nextItems

        return nextItems
      })
      return
    }

    try {
      const speakerIdentity = speakerIdentitiesRef.current[speaker]
      const savedSpeaker = await upsertCallSpeaker({
        call_id: activeCallId,
        label: speaker,
        display_name: speakerIdentity?.displayName || speaker,
        role: getSpeakerRoleForLabel(speaker),
      })

      await updateTranscriptSegment(segmentId, {
        speaker_id: savedSpeaker.id,
        speaker_attribution: "manual",
        speaker_attribution_reason: "Seller corrected the speaker label.",
        speaker_confidence: 1,
        speaker_needs_review: false,
        speaker_source: "manual",
      })

      setTranscript((items) => {
        const nextItems = items.map((line) =>
          line.id === segmentId
            ? {
                ...line,
                speaker,
                speakerAttributionReason: "Seller corrected the speaker label.",
                speakerConfidence: 1,
                speakerDisplayName: savedSpeaker.display_name || savedSpeaker.label,
                speakerId: savedSpeaker.id,
                speakerLabel: speaker,
                speakerNeedsReview: false,
                speakerSource: "manual",
              }
            : line
        )

        transcriptRef.current = nextItems

        return nextItems
      })
    } catch (caughtError: unknown) {
      setPostCallError(getUserFacingErrorMessage(caughtError, "Speaker label needs another save attempt."))
    }
  }

  const handleSpeakerIdentityChange = async ({ displayName, isMe, label }: SpeakerIdentityChangePayload): Promise<SpeakerIdentityChangeResult> => {
    const speakerLabel = getCanonicalTranscriptSpeakerLabel(normalizeTranscriptSpeakerLabel(label))
    if (speakerLabel === "Unknown") {
      return {
        message: "Choose Seller or Customer before naming this speaker.",
        persistence: "local",
      }
    }

    const nextDisplayName = (isMe ? personalAccountProfile.fullName || "Me" : displayName).trim() || speakerLabel
    const applySpeakerIdentity = (identity: CallSpeakerIdentity, speakerId?: string) => {
      const normalizedIdentity: CallSpeakerIdentity = {
        ...identity,
        displayName: identity.displayName.trim() || identity.label,
        label: getCanonicalTranscriptSpeakerLabel(normalizeTranscriptSpeakerLabel(identity.label)),
      }
      if (normalizedIdentity.label === "Unknown") return

      setSpeakerIdentities((items) => {
        const nextItems: CallSpeakerIdentityMap = {}

        Object.entries(items).forEach(([rawItemLabel, item]) => {
          if (!item) return

          const itemLabel = getCanonicalTranscriptSpeakerLabel(normalizeTranscriptSpeakerLabel(rawItemLabel))
          if (itemLabel === "Unknown") return

          nextItems[itemLabel] =
            normalizedIdentity.isMe && itemLabel !== normalizedIdentity.label
              ? {
                  ...item,
                  isMe: false,
                  label: itemLabel,
                }
              : {
                  ...item,
                  label: itemLabel,
                }
        })

        nextItems[normalizedIdentity.label] = normalizedIdentity
        speakerIdentitiesRef.current = nextItems

        return nextItems
      })
      setTranscript((items) => {
        const nextItems = items.map((line) => {
          const lineLabel = getTranscriptSpeakerLabel(line)
          const matchesLabel = lineLabel === normalizedIdentity.label
          const matchesSpeaker = Boolean(speakerId && line.speakerId === speakerId)

          if (!matchesLabel && !matchesSpeaker) return line

          return {
            ...line,
            speaker: normalizedIdentity.label,
            speakerDisplayName: normalizedIdentity.displayName,
            speakerId: speakerId ?? line.speakerId,
            speakerLabel: normalizedIdentity.label,
            speakerSource: "manual",
          }
        })

        transcriptRef.current = nextItems

        return nextItems
      })
    }

    const nextIdentity: CallSpeakerIdentity = {
      displayName: nextDisplayName,
      isMe: Boolean(isMe),
      label: speakerLabel,
    }

    applySpeakerIdentity(nextIdentity)

    if (!activeCallId) {
      return {
        message: "Speaker name applied for this call.",
        persistence: "local",
      }
    }

    try {
      const savedSpeaker = await upsertCallSpeaker({
        call_id: activeCallId,
        label: speakerLabel,
        display_name: nextDisplayName,
        role: isMe ? "seller" : getSpeakerRoleForLabel(speakerLabel),
      })

      const savedIdentity: CallSpeakerIdentity = {
        displayName: savedSpeaker.display_name || savedSpeaker.label,
        isMe: Boolean(isMe),
        label: speakerLabel,
      }

      applySpeakerIdentity(savedIdentity, savedSpeaker.id)

      return {
        message: "Speaker name saved.",
        persistence: "saved",
      }
    } catch (caughtError: unknown) {
      const message = getUserFacingErrorMessage(caughtError, "Speaker identity needs another save attempt.")

      return {
        message: `Speaker name applied. SalesFrame will save it when the connection settles: ${message}`,
        persistence: "local",
      }
    }
  }

  const handleStartRecording = async (payload: StartRecordingPayload) => {
    if (!activeWorkspaceId) {
      return {
        message: "Choose or create a workspace before starting a call.",
        ok: false as const,
      }
    }

    const getStartCancelledResult = () => ({
      message: "Call start was cancelled.",
      ok: false as const,
    })
    const updatePreparationStep = (step: StartCallPreparationStepId, detail?: string) => {
      payload.onPreparationStep?.({ detail, step })
    }
    const throwIfStartCancelled = () => {
      if (!payload.abortSignal?.aborted) return

      throw new Error(getStartCancelledResult().message)
    }
    const selectedPlaybooks = normalizePlaybooks(payload.playbooks)
    const providedOpenAiKey = payload.openAiApiKey.trim()
    const previousActiveAccountId = activeAccountIdRef.current
    const previousActiveOpportunityId = activeOpportunityIdRef.current
    const isNewAccount = payload.accountMode === "new"
    let accountId = isNewAccount ? "" : payload.accountId
    const accountName = isNewAccount
      ? payload.accountName.trim()
      : workspaceAccounts.find((account) => account.id === accountId)?.name ?? "Selected account"
    const accountWebsite = isNewAccount
      ? normalizeSellerDomain(payload.accountWebsite)
      : workspaceAccounts.find((account) => account.id === accountId)?.website ?? ""
    const accountIndustry = isNewAccount
      ? payload.accountIndustry.trim()
      : workspaceAccounts.find((account) => account.id === accountId)?.description ?? ""
    let createdCallId = ""
    let createdAccountRow: Awaited<ReturnType<typeof createSupabaseAccount>> | null = null
    let createdOpportunityRow: Awaited<ReturnType<typeof createSupabaseOpportunity>> | null = null
    let captureStarted = false

    try {
      if (isNewAccount && !accountName) {
        throw new Error("Add an account name before starting the call.")
      }
      if (!isNewAccount && !accountId) {
        throw new Error("Choose an account before starting the call.")
      }

      const sessionStatus = await sendWorkspaceSessionActivity("start_call_check", { force: true })
      const absoluteDeadlineMs = sessionStatus?.absoluteDeadline
        ? new Date(sessionStatus.absoluteDeadline).getTime()
        : Number.POSITIVE_INFINITY
      const callBufferSeconds = 5 * 60

      if (sessionStatus?.state === "expired") {
        throw new Error(workspaceSessionExpiredMessage)
      }
      if (absoluteDeadlineMs - Date.now() < (MAX_LIVE_CALL_SECONDS + callBufferSeconds) * 1000) {
        const message = "Sign in again before starting this call so SalesFrame can safely save the whole recording."
        handleWorkspaceSessionExpiredRef.current?.(message)

        return {
          message,
          ok: false as const,
        }
      }

      updatePreparationStep("ai_access", "Checking that this workspace has the AI key it needs.")

      if (providedOpenAiKey) {
        await saveRequiredOpenAiKey(providedOpenAiKey)
        throwIfStartCancelled()
      } else if (!savedOpenAiKeyState) {
        throw new Error("OpenAI API key is required before starting a call.")
      }

      await checkOpenAiWorkspaceHealth(activeWorkspaceId)
      throwIfStartCancelled()

      updatePreparationStep("transcription", "Checking live transcript is ready.")
      await checkDeepgramTranscriptionHealth()
      throwIfStartCancelled()

      updatePreparationStep("records", "Attaching the call to the account, opportunity, and selected playbooks.")

      if (isNewAccount) {
        const account = await createSupabaseAccount({
          workspace_id: activeWorkspaceId,
          name: accountName,
          website: accountWebsite || null,
          industry: accountIndustry || null,
          region: "Australia",
          currency: normalizeCurrencyCode(payload.accountCurrency),
          notes: "",
          ...buildAccountLogoMetadata(accountWebsite),
        })
        throwIfStartCancelled()

        accountId = account.id
        createdAccountRow = account
      }

      const isNewOpportunity = isNewAccount || payload.opportunityMode === "new"
      let opportunityId = isNewOpportunity ? "" : payload.opportunityId
      const opportunityName = isNewOpportunity
        ? payload.opportunityName.trim()
        : workspaceOpportunities.find((opportunity) => opportunity.id === opportunityId)?.name ?? "Selected opportunity"

      if (isNewOpportunity && !opportunityName) {
        throw new Error("Add an opportunity name before starting the call.")
      }
      if (!isNewOpportunity && !opportunityId) {
        throw new Error("Choose an opportunity before starting the call.")
      }

      if (isNewOpportunity) {
        const opportunity = await createSupabaseOpportunity({
          workspace_id: activeWorkspaceId,
          account_id: accountId,
          name: opportunityName,
          stage: "Discovery",
          amount: "Unqualified",
          close_date: null,
          close_date_note: "Not set",
          source: "Call recording",
          pain: "",
          decision_process: "",
          next_step: "",
          manual_notes: "",
          call_type: payload.callType,
        })
        throwIfStartCancelled()

        opportunityId = opportunity.id
        createdOpportunityRow = opportunity
      }

      const playbookIds = getPlaybookIdsForSelection(workspacePlaybooks, selectedPlaybooks)
      const playbookAssignments = await replaceOpportunityPlaybooks(opportunityId, playbookIds)
      throwIfStartCancelled()

      const startedAt = new Date().toISOString()
      const call = await createSupabaseCall({
        workspace_id: activeWorkspaceId,
        account_id: accountId,
        opportunity_id: opportunityId,
        title: `${payload.callType} call`,
        call_type: payload.callType,
        duration_limit_seconds: MAX_LIVE_CALL_SECONDS,
        ended_reason: "seller_stopped",
        status: "active",
        started_at: startedAt,
        retention_expires_at: createRetentionExpiry(),
      })
      createdCallId = call.id
      throwIfStartCancelled()

      await replaceCallPlaybooks(call.id, playbookIds)
      throwIfStartCancelled()

      updatePreparationStep("context", "Reading the account, opportunity, history, and playbook context.")

      const selectedAccountRecord = workspaceAccounts.find((account) => account.id === accountId)
      const selectedOpportunityRecord = workspaceOpportunities.find((opportunity) => opportunity.id === opportunityId)
      const initialAccountProfile = createdAccountRow
        ? mapAccountRowToDraft(createdAccountRow)
        : accountDrafts[accountId] ?? createAccountDraftFromRecord(selectedAccountRecord ?? {
            ...emptyAccount,
            id: accountId,
            name: accountName,
            description: accountIndustry,
          })
      updatePreparationStep(
        "coach",
        "SalesFrame is writing the first live-coach question from your account, opportunity, and playbooks."
      )
      const initialGuidanceResponse = await requestLiveQuestion({
        accountProfile: initialAccountProfile,
        accountId,
        callId: call.id,
        callType: payload.callType,
        customerResearch: payload.customerResearch,
        currentGuidance: null,
        refreshContext: {
          reason: "pre_call_first_question",
          accountName,
          opportunityName,
          opportunityStage: createdOpportunityRow?.stage ?? selectedOpportunityRecord?.stage ?? "Discovery",
          opportunityAmount: createdOpportunityRow?.amount ?? selectedOpportunityRecord?.amount ?? "Unqualified",
          opportunityCloseDate: selectedOpportunityRecord?.closeDate ?? "Not set",
        },
        opportunityId,
        playbooks: selectedPlaybooks,
        sellerFeedback: manualCoachState.feedbackSignals,
        transcript: [],
      }, {
        signal: payload.abortSignal,
        timeoutMs: 14000,
      })
      throwIfStartCancelled()
      const initialGuidance = mapAiLiveGuidanceResponse(initialGuidanceResponse)
      if (!initialGuidance) {
        throw new Error("SalesFrame needs another moment to prepare the first question. Try again in a moment.")
      }
      await updateSupabaseCall(call.id, {
        guidance_readiness: {
          checkedAt: new Date().toISOString(),
          confidence:
            initialGuidance.displayRecommendation?.confidence ??
            initialGuidance.conversationState?.confidence ??
            null,
          ok: true,
          playbookLabel:
            initialGuidance.displayRecommendation?.playbookLabel ??
            initialGuidance.playbookLabel ??
            null,
          target:
            initialGuidance.displayRecommendation?.target ??
            initialGuidance.target ??
            null,
          uiMode:
            initialGuidance.uiMode ??
            initialGuidance.displayRecommendation?.uiMode ??
            null,
          },
      })
      throwIfStartCancelled()

      updatePreparationStep("audio", "Ready for the selected channel setup.")
      const captureAbortController = new AbortController()
      const handleParentStartAbort = () => captureAbortController.abort()
      let captureStartupTimeoutId: number | null = null
      let captureStartupTimedOut = false

      payload.abortSignal?.addEventListener("abort", handleParentStartAbort, { once: true })

      const captureStartPromise = callCapture.startCall({
        abortSignal: captureAbortController.signal,
        audioCaptureMode: payload.audioCaptureMode,
        audioInputDeviceId: payload.audioInputDeviceId,
        audioInputDeviceLabel: payload.audioInputDeviceLabel,
        audioOutputDeviceId: payload.audioOutputDeviceId,
        audioOutputDeviceLabel: payload.audioOutputDeviceLabel,
        callId: call.id,
        preparedMeetingAudio: payload.preparedMeetingAudio,
        startedAt,
        workspaceId: activeWorkspaceId,
        onTranscript: (line) =>
          setTranscript((items) => {
            const nextItems = upsertTranscriptLine(
              items,
              applySpeakerIdentitiesToLine(line, speakerIdentitiesRef.current)
            )
            transcriptRef.current = nextItems

            return nextItems
          }),
        onTranscriptUpdate: (line) =>
          setTranscript((items) => {
            const aliasedLine = applySpeakerIdentitiesToLine(line, speakerIdentitiesRef.current)
            const nextItems = upsertTranscriptLine(items, aliasedLine)
            transcriptRef.current = nextItems

            return nextItems
          }),
      })

      try {
        await Promise.race([
          captureStartPromise,
          new Promise<never>((_resolve, reject) => {
            captureStartupTimeoutId = window.setTimeout(() => {
              captureStartupTimedOut = true
              captureAbortController.abort()
              reject(new Error("SalesFrame needs another attempt to finish microphone setup. Check browser microphone permissions, then try again."))
            }, callCaptureStartupTimeoutMs)
          }),
        ])
      } catch (caughtError: unknown) {
        if (captureStartupTimedOut) {
          void captureStartPromise.catch(() => undefined)
          await callCapture.cancelCallStart(call.id).catch(() => undefined)
        }

        throw caughtError
      } finally {
        if (captureStartupTimeoutId !== null) {
          window.clearTimeout(captureStartupTimeoutId)
        }
        payload.abortSignal?.removeEventListener("abort", handleParentStartAbort)
      }
      throwIfStartCancelled()
      captureStarted = true

      if (payload.customerResearch.enabled) {
        setAccountResearchById((items) => ({
          ...items,
          [accountId]: payload.customerResearch,
        }))
      }
      setSellerResearchProfile((currentProfile) => {
        const nextProfile = {
          sellerCompany: payload.customerResearch.sellerCompany || currentProfile.sellerCompany,
          sellerDomain: payload.customerResearch.sellerDomain || currentProfile.sellerDomain,
          productContext: payload.customerResearch.productContext || currentProfile.productContext,
        }

        return areSellerResearchProfilesEqual(currentProfile, nextProfile) ? currentProfile : nextProfile
      })
      setCustomerResearch(payload.customerResearch)
      setSpeakerIdentities({})
      speakerIdentitiesRef.current = {}
      transcriptRef.current = []
      setTranscript([])
      setNotes([])
      setElapsed(0)
      callLimitAutoStopRef.current = false

      if (payload.customerResearch.enabled) {
        void requestCustomerResearch({
          accountId,
          callId: call.id,
          customerContact: payload.customerResearch.customerContact,
          customerRole: payload.customerResearch.customerRole,
          opportunityId,
          productContext: payload.customerResearch.productContext,
          sellerCompany: payload.customerResearch.sellerCompany,
          sellerDomain: payload.customerResearch.sellerDomain,
        })
          .then((response) => {
            const research = mapCustomerResearchResponse(response)
            if (!research) {
              throw new Error("Research context needs another pass. Try again, or continue without research.")
            }
          })
          .catch(() => undefined)
      }

      if (createdAccountRow) {
        const accountRow = createdAccountRow
        const opportunityRow = createdOpportunityRow
        const createdAccountNav = mapAccountRowsToNavItems(
          [accountRow],
          opportunityRow ? [opportunityRow] : []
        )[0]

        setWorkspaceAccounts((items) =>
          items.some((account) => account.id === createdAccountNav.id)
            ? items.map((account) => (account.id === createdAccountNav.id ? createdAccountNav : account))
            : [...items, createdAccountNav]
        )
        const createdAccountDraft = mapAccountRowToDraft(accountRow)

        setAccountDrafts((drafts) => ({
          ...drafts,
          [accountRow.id]: createdAccountDraft,
        }))
        setSavedAccountDrafts((drafts) => ({
          ...drafts,
          [accountRow.id]: createdAccountDraft,
        }))
      } else if (createdOpportunityRow) {
        const opportunityRow = createdOpportunityRow

        setWorkspaceAccounts((items) =>
          items.map((account) =>
            account.id === accountId
              ? {
                  ...account,
                  opportunities: [
                    ...account.opportunities.filter((opportunity) => opportunity.id !== opportunityRow.id),
                    {
                      id: opportunityRow.id,
                      name: opportunityRow.name,
                      stage: opportunityRow.stage,
                    },
                  ],
                }
              : account
          )
        )
      }

      if (createdOpportunityRow) {
        const opportunityRow = createdOpportunityRow
        const createdOpportunityUi = mapOpportunityRowToUi({
          calls: [call],
          opportunity: opportunityRow,
          selectedPlaybooks,
        })

        setWorkspaceOpportunities((items) =>
          items.some((opportunity) => opportunity.id === createdOpportunityUi.id)
            ? items.map((opportunity) => (opportunity.id === createdOpportunityUi.id ? createdOpportunityUi : opportunity))
            : [...items, createdOpportunityUi]
        )
        const createdOpportunityDraft = mapOpportunityRowToDraft({
          accountCurrency: normalizeCurrencyCode(payload.accountCurrency),
          opportunity: opportunityRow,
          playbooks: workspacePlaybooks,
          playbookAssignments,
        })

        setOpportunityDrafts((drafts) => ({
          ...drafts,
          [opportunityRow.id]: createdOpportunityDraft,
        }))
        setSavedOpportunityDrafts((drafts) => ({
          ...drafts,
          [opportunityRow.id]: createdOpportunityDraft,
        }))
      }

      startingRecordingRef.current = true
      if (pageLoadTimeoutRef.current !== null) {
        window.clearTimeout(pageLoadTimeoutRef.current)
        pageLoadTimeoutRef.current = null
      }
      setActiveAccountId(accountId)
      setActiveOpportunityId(opportunityId)
      setActiveCallId(call.id)
      activeAccountIdRef.current = accountId
      activeOpportunityIdRef.current = opportunityId
      activeCallIdRef.current = call.id
      setActiveCallStartedAt(startedAt)
      setCallType(payload.callType)
      setCallPlaybooks(selectedPlaybooks)
      setPageLoadingView(null)
      blurFocusedNavigationElement()
      setActiveView("workspace")
      requestNavigationScrollReset()
      setLiveGuidanceByCallId((items) => ({
        ...items,
        [call.id]: initialGuidance,
      }))
      setWorkspaceCalls((items) => {
        const callSummary = mapCallRowsToSummaries([{ ...call, status: "active" }])[0]
        return [callSummary, ...items.filter((item) => item.id !== callSummary.id)]
      })
      setIsRecording(true)

      return {
        ok: true as const,
      }
    } catch (caughtError: unknown) {
      if (payload.abortSignal?.aborted) {
        await callCapture.cancelCallStart(createdCallId).catch(() => undefined)

        if (createdAccountRow) {
          await deleteSupabaseAccount(createdAccountRow.id).catch(() => undefined)
        } else if (createdOpportunityRow) {
          await deleteSupabaseOpportunity(createdOpportunityRow.id).catch(() => undefined)
        }

        if (createdCallId) {
          try {
            await updateSupabaseCall(createdCallId, {
              ended_at: new Date().toISOString(),
              ended_reason: "start_cancelled",
              status: "archived",
            })
          } catch {
            // Cancellation should stay calm even if the status cleanup cannot finish.
          }
        }

        setWorkspaceCalls((items) => items.filter((call) => call.id !== createdCallId))
        setLiveGuidanceByCallId((items) => {
          if (!createdCallId || !(createdCallId in items)) return items

          const { [createdCallId]: _removedGuidance, ...remainingGuidance } = items
          return remainingGuidance
        })

        if (createdAccountRow) {
          const cancelledAccountId = createdAccountRow.id

          setWorkspaceAccounts((items) => items.filter((account) => account.id !== cancelledAccountId))
          setWorkspaceOpportunities((items) => items.filter((opportunity) => opportunity.accountId !== cancelledAccountId))
          setAccountDrafts((drafts) => {
            const { [cancelledAccountId]: _removedDraft, ...remainingDrafts } = drafts
            return remainingDrafts
          })
          setSavedAccountDrafts((drafts) => {
            const { [cancelledAccountId]: _removedDraft, ...remainingDrafts } = drafts
            return remainingDrafts
          })
          setAccountResearchById((items) => {
            const { [cancelledAccountId]: _removedResearch, ...remainingResearch } = items
            return remainingResearch
          })
        } else if (createdOpportunityRow) {
          const cancelledOpportunityAccountId = createdOpportunityRow.account_id
          const cancelledOpportunityId = createdOpportunityRow.id

          setWorkspaceAccounts((items) =>
            items.map((account) =>
              account.id === cancelledOpportunityAccountId
                ? {
                    ...account,
                    opportunities: account.opportunities.filter((opportunity) => opportunity.id !== cancelledOpportunityId),
                  }
                : account
            )
          )
          setWorkspaceOpportunities((items) => items.filter((opportunity) => opportunity.id !== cancelledOpportunityId))
        }

        if (createdOpportunityRow) {
          const cancelledOpportunityId = createdOpportunityRow.id

          setOpportunityDrafts((drafts) => {
            const { [cancelledOpportunityId]: _removedDraft, ...remainingDrafts } = drafts
            return remainingDrafts
          })
          setSavedOpportunityDrafts((drafts) => {
            const { [cancelledOpportunityId]: _removedDraft, ...remainingDrafts } = drafts
            return remainingDrafts
          })
        }

        setIsRecording(false)
        setActiveAccountId(previousActiveAccountId)
        setActiveOpportunityId(previousActiveOpportunityId)
        activeAccountIdRef.current = previousActiveAccountId
        activeOpportunityIdRef.current = previousActiveOpportunityId
        setActiveCallId("")
        activeCallIdRef.current = ""
        setActiveCallStartedAt("")

        return getStartCancelledResult()
      }

      const message = appendErrorReference(getUserFacingErrorMessage(caughtError, "Call start needs another try."), caughtError)

      void reportClientError({
        error: caughtError,
        eventName: "start_call_failed",
        metadata: {
          audioCaptureMode: payload.audioCaptureMode,
          callId: createdCallId,
          callType: payload.callType,
          createdAccount: Boolean(createdAccountRow),
          createdOpportunity: Boolean(createdOpportunityRow),
          playbookCount: selectedPlaybooks.length,
        },
      })

      if (createdCallId) {
        try {
          await updateSupabaseCall(createdCallId, {
            ended_at: new Date().toISOString(),
            ended_reason: captureStarted ? "seller_stopped" : "start_failed",
            status: captureStarted ? "needs_attention" : "archived",
          })
        } catch {
          // Preserve the original AI/capture error for the seller.
        }
      }

      if (!captureStarted) {
        if (createdAccountRow) {
          await deleteSupabaseAccount(createdAccountRow.id).catch(() => undefined)
        } else if (createdOpportunityRow) {
          await deleteSupabaseOpportunity(createdOpportunityRow.id).catch(() => undefined)
        }
      }

      setIsRecording(false)
      setActiveCallId("")
      activeCallIdRef.current = ""
      setActiveCallStartedAt("")

      return {
        message,
        ok: false as const,
      }
    }
  }

  const handleCreateAccount = async (payload: CreateAccountPayload) => {
    if (!activeWorkspaceId) {
      return {
        message: "Choose or create a workspace before creating an account.",
        ok: false as const,
      }
    }

    const accountName = payload.accountName.trim()
    const accountIndustry = payload.industry.trim()
    const selectedPlaybooks = normalizePlaybooks(payload.playbooks)
    const shouldCreateOpportunity = payload.createOpportunity && payload.opportunityName.trim().length > 0
    const providedOpenAiKey = payload.openAiApiKey.trim()

    try {
      if (providedOpenAiKey) {
        await saveRequiredOpenAiKey(providedOpenAiKey)
      } else if (!savedOpenAiKeyState) {
        throw new Error("OpenAI API key is required before creating an account.")
      }

      const normalizedWebsite = normalizeSellerDomain(payload.website)
      const account = await createSupabaseAccount({
        workspace_id: activeWorkspaceId,
        name: accountName,
        website: normalizedWebsite,
        industry: accountIndustry || null,
        employee_count: normalizeEmployeeCountInput(payload.employeeCount),
        region: payload.region.trim() || "Australia",
        currency: normalizeCurrencyCode(payload.currency),
        current_tools: payload.currentTools.trim(),
        strategic_initiatives: payload.strategicInitiatives.trim(),
        competitors: payload.competitors.trim(),
        notes: payload.accountNotes.trim(),
        ...buildAccountLogoMetadata(normalizedWebsite),
      })

      let opportunityId = ""

      if (shouldCreateOpportunity) {
        const closeDateValue = normalizeCloseDateForPersistence(payload.closeDate)
        const formattedAmount = formatCurrencyAmount(payload.amount.trim() || "Unqualified", normalizeCurrencyCode(payload.currency))
        const opportunity = await createSupabaseOpportunity({
          workspace_id: activeWorkspaceId,
          account_id: account.id,
          name: payload.opportunityName.trim(),
          stage: payload.stage,
          amount: formattedAmount,
          close_date: closeDateValue.date,
          close_date_note: closeDateValue.note,
          source: "Manual account creation",
          pain: payload.pain.trim(),
          decision_process: "",
          next_step: payload.nextStep.trim(),
          manual_notes: "",
          call_type: "Discovery",
        })

        opportunityId = opportunity.id
        await replaceOpportunityPlaybooks(opportunity.id, getPlaybookIdsForSelection(workspacePlaybooks, selectedPlaybooks))
      }

      if (payload.customerResearch.enabled) {
        setAccountResearchById((items) => ({
          ...items,
          [account.id]: payload.customerResearch,
        }))
        setSellerResearchProfile((currentProfile) => {
          const nextProfile = {
            sellerCompany: payload.customerResearch.sellerCompany || currentProfile.sellerCompany,
            sellerDomain: payload.customerResearch.sellerDomain || currentProfile.sellerDomain,
            productContext: payload.customerResearch.productContext || currentProfile.productContext,
          }

          return areSellerResearchProfilesEqual(currentProfile, nextProfile) ? currentProfile : nextProfile
        })

        void requestCustomerResearch({
          accountId: account.id,
          customerContact: payload.customerResearch.customerContact,
          customerRole: payload.customerResearch.customerRole,
          opportunityId: opportunityId || null,
          productContext: payload.customerResearch.productContext,
          sellerCompany: payload.customerResearch.sellerCompany,
          sellerDomain: payload.customerResearch.sellerDomain,
        })
          .then((response) => {
            const research = mapCustomerResearchResponse(response)
            if (!research) {
              throw new Error("Research context needs another pass. Try again from the account page.")
            }
          })
          .catch(() => undefined)
      }

      setActiveAccountId(account.id)
      if (opportunityId) setActiveOpportunityId(opportunityId)
      handleNavigate("account-detail")
      setCreateAccountOpen(false)
      setWorkspaceRefreshToken((value) => value + 1)
      setWorkspaceErrorMessage("")

      if (payload.aiEnrichmentEnabled) {
        void (async () => {
          try {
            const enrichment = await requestAccountEnrichment(account.id)

            const enrichedAccountNav = mapAccountRowsToNavItems([enrichment.account], [])[0]
            setWorkspaceAccounts((accounts) =>
              accounts.map((item) =>
                item.id === enrichment.account.id
                  ? {
                      ...enrichedAccountNav,
                      opportunities: item.opportunities,
                    }
                  : item
              )
            )
            const enrichedAccountDraft = mapAccountRowToDraft(enrichment.account)

            setAccountDrafts((drafts) => ({
              ...drafts,
              [enrichment.account.id]: enrichedAccountDraft,
            }))
            setSavedAccountDrafts((drafts) => ({
              ...drafts,
              [enrichment.account.id]: enrichedAccountDraft,
            }))
            setAccountEnrichmentById((profiles) => ({
              ...profiles,
              [enrichment.profile.account_id]: enrichment.profile,
            }))
            setWorkspaceRefreshToken((value) => value + 1)
          } catch (caughtError: unknown) {
            const message = getUserFacingErrorMessage(caughtError, "Enrichment needs another try. The account is still saved.")

            setAccountEnrichmentRunStatus("error")
            setAccountEnrichmentRunMessage(message)
          }
        })()
      }

      return {
        ok: true as const,
      }
    } catch (caughtError: unknown) {
      const message = getUserFacingErrorMessage(caughtError, "Account setup needs another try.")

      return {
        message,
        ok: false as const,
      }
    }
  }

  const handleCreateOpportunity = async (payload: CreateOpportunityPayload) => {
    if (!activeWorkspaceId) {
      return {
        message: "Choose or create a workspace before creating an opportunity.",
        ok: false as const,
      }
    }

    const selectedPlaybooks = normalizePlaybooks(payload.playbooks)
    const opportunityName = payload.opportunityName.trim()
    const closeDateValue = normalizeCloseDateForPersistence(payload.closeDate)
    const selectedAccount = workspaceAccounts.find((account) => account.id === payload.accountId)
    const accountCurrency = normalizeCurrencyCode(selectedAccount?.currency)
    const formattedAmount = formatCurrencyAmount(payload.amount.trim() || "Unqualified", accountCurrency)

    try {
      const opportunity = await createSupabaseOpportunity({
        workspace_id: activeWorkspaceId,
        account_id: payload.accountId,
        name: opportunityName,
        stage: payload.stage,
        amount: formattedAmount,
        close_date: closeDateValue.date,
        close_date_note: closeDateValue.note,
        source: "Manual opportunity creation",
        pain: payload.pain.trim(),
        decision_process: payload.decisionProcess.trim(),
        next_step: payload.nextStep.trim(),
        manual_notes: payload.manualNotes.trim(),
        call_type: "Discovery",
      })

      await replaceOpportunityPlaybooks(opportunity.id, getPlaybookIdsForSelection(workspacePlaybooks, selectedPlaybooks))
      setActiveAccountId(payload.accountId)
      setActiveOpportunityId(opportunity.id)
      handleNavigate("opportunity-record")
      setCreateOpportunityOpen(false)
      setWorkspaceRefreshToken((value) => value + 1)
      setWorkspaceErrorMessage("")

      return {
        ok: true as const,
      }
    } catch (caughtError: unknown) {
      const message = getUserFacingErrorMessage(caughtError, "Opportunity setup needs another try.")

      return {
        message,
        ok: false as const,
      }
    }
  }

  const handleEditAccount = async (payload: EditAccountPayload): Promise<RecordMutationResult> => {
    const currentAccount = workspaceAccounts.find((account) => account.id === payload.accountId)
    if (!currentAccount) {
      return {
        message: "This account is not in the current workspace.",
        ok: false,
      }
    }

    const accountName = payload.accountName.trim() || currentAccount.name
    const industry = payload.industry.trim()
    const normalizedWebsite = normalizeSellerDomain(payload.website)

    try {
      await updateSupabaseAccount(payload.accountId, {
        name: accountName,
        website: normalizedWebsite,
        industry: industry || null,
        employee_count: normalizeEmployeeCountInput(payload.employeeCount),
        region: payload.region.trim() || "Australia",
        currency: normalizeCurrencyCode(payload.currency),
        current_tools: payload.currentTools.trim(),
        strategic_initiatives: payload.strategicInitiatives.trim(),
        competitors: payload.competitors.trim(),
        notes: payload.accountNotes.trim(),
        ...buildAccountLogoMetadata(normalizedWebsite),
      })

      setEditAccountId(null)
      setWorkspaceRefreshToken((value) => value + 1)

      return {
        ok: true,
      }
    } catch (caughtError: unknown) {
      return {
        message: getUserFacingErrorMessage(caughtError, "Account update needs another try."),
        ok: false,
      }
    }
  }

  const handleEditOpportunity = async (payload: EditOpportunityPayload): Promise<RecordMutationResult> => {
    const currentOpportunity = workspaceOpportunities.find(
      (opportunity) => opportunity.id === payload.opportunityId
    )
    if (!currentOpportunity) {
      return {
        message: "This opportunity is not in the current workspace.",
        ok: false,
      }
    }

    const opportunityName = payload.opportunityName.trim() || currentOpportunity.name
    const stage = payload.stage.trim() || currentOpportunity.stage
    const amount = payload.amount.trim() || currentOpportunity.amount
    const closeDateValue = normalizeCloseDateForPersistence(payload.closeDate, currentOpportunity.closeDate)

    try {
      await updateSupabaseOpportunity(payload.opportunityId, {
        account_id: payload.accountId,
        name: opportunityName,
        stage,
        amount,
        close_date: closeDateValue.date,
        close_date_note: closeDateValue.note,
        source: payload.source.trim(),
        pain: payload.pain.trim(),
        decision_process: payload.decisionProcess.trim(),
        next_step: payload.nextStep.trim(),
        manual_notes: payload.manualNotes.trim(),
      })

      await replaceOpportunityPlaybooks(
        payload.opportunityId,
        getPlaybookIdsForSelection(workspacePlaybooks, payload.playbooks)
      )

      if (activeOpportunityId === payload.opportunityId) {
        setActiveAccountId(payload.accountId)
        setCallPlaybooks(normalizePlaybooks(payload.playbooks))
      }

      setEditOpportunityId(null)
      setWorkspaceRefreshToken((value) => value + 1)

      return {
        ok: true,
      }
    } catch (caughtError: unknown) {
      return {
        message: getUserFacingErrorMessage(caughtError, "Opportunity update needs another try."),
        ok: false,
      }
    }
  }

  const updateAccountDraft = <K extends keyof AccountDraft>(accountId: string, field: K, value: AccountDraft[K]) => {
    setAccountRecordSaveStatus("idle")
    setAccountRecordSaveMessage("")
    const nextValue = field === "employeeCount" ? normalizeEmployeeCountInput(String(value)) : value
    setAccountDrafts((drafts) => ({
      ...drafts,
      [accountId]: (() => {
        const account = workspaceAccounts.find((item) => item.id === accountId) ?? emptyAccount
        const baseDraft = drafts[accountId] ?? createAccountDraftFromRecord(account)
        return {
          ...baseDraft,
          [field]: nextValue,
        }
      })(),
    }))
  }

  const updateOpportunityDraft = (opportunityId: string, field: keyof OpportunityDraft, value: string) => {
    setOpportunityRecordSaveStatus("idle")
    setOpportunityRecordSaveMessage("")
    setOpportunityDrafts((drafts) => ({
      ...drafts,
      [opportunityId]: (() => {
        const opportunity = workspaceOpportunities.find((item) => item.id === opportunityId) ?? emptyOpportunity
        const baseDraft = drafts[opportunityId] ?? createOpportunityDraftFromRecord(opportunity)
        return {
          ...baseDraft,
          [field]: value,
        }
      })(),
    }))
  }

  const handleSaveActiveAccountDraft = async () => {
    if (!activeAccount.id) return false

    const draft = accountDrafts[activeAccount.id] ?? createAccountDraftFromRecord(activeAccount)
    if (!draft.accountName.trim()) {
      setAccountRecordSaveStatus("error")
      setAccountRecordSaveMessage("Add an account name before saving.")
      return false
    }

    setAccountRecordSaveStatus("saving")
    setAccountRecordSaveMessage("")

    try {
      const normalizedWebsite = normalizeSellerDomain(draft.website)
      const updatedAccount = await updateSupabaseAccount(activeAccount.id, {
        name: draft.accountName.trim(),
        website: normalizedWebsite,
        industry: draft.industry.trim() || null,
        employee_count: normalizeEmployeeCountInput(draft.employeeCount),
        region: draft.region.trim() || "Australia",
        currency: normalizeCurrencyCode(draft.currency),
        current_tools: draft.currentTools.trim(),
        strategic_initiatives: draft.strategicInitiatives.trim(),
        competitors: draft.competitors.trim(),
        notes: draft.accountNotes.trim(),
        ...buildAccountLogoMetadata(normalizedWebsite),
      })
      const updatedAccountNav = mapAccountRowsToNavItems([updatedAccount], [])[0]

      setWorkspaceAccounts((accounts) =>
        accounts.map((account) =>
          account.id === updatedAccount.id
            ? {
                ...updatedAccountNav,
                opportunities: account.opportunities,
              }
            : account
        )
      )
      const updatedAccountDraft = mapAccountRowToDraft(updatedAccount)

      setAccountDrafts((drafts) => ({
        ...drafts,
        [updatedAccount.id]: updatedAccountDraft,
      }))
      setSavedAccountDrafts((drafts) => ({
        ...drafts,
        [updatedAccount.id]: updatedAccountDraft,
      }))
      setWorkspaceErrorMessage("")
      setAccountRecordSaveStatus("saved")
      setAccountRecordSaveMessage("Account saved.")
      return true
    } catch (caughtError: unknown) {
      const message = getUserFacingErrorMessage(caughtError, "Account fields need another save attempt.")

      setAccountRecordSaveStatus("error")
      setAccountRecordSaveMessage(message)
      return false
    }
  }

  const handleRunActiveAccountEnrichment = async () => {
    if (!activeAccount.id) return

    if (!savedOpenAiKeyState) {
      setAccountEnrichmentRunStatus("error")
      setAccountEnrichmentRunMessage("Add an OpenAI key in Settings before enriching account fields.")
      return
    }

    const draft = accountDrafts[activeAccount.id] ?? createAccountDraftFromRecord(activeAccount)
    if (!draft.accountName.trim() || !normalizeSellerDomain(draft.website)) {
      setAccountEnrichmentRunStatus("error")
      setAccountEnrichmentRunMessage("Account name and website or domain are required before enrichment.")
      return
    }

    setAccountEnrichmentSaveStatus("idle")
    setAccountEnrichmentSaveMessage("")
    setAccountEnrichmentRunStatus("saving")
    setAccountEnrichmentRunMessage("Researching account, filling blank fields, and preparing sales signals.")

    try {
      const accountSaved = await handleSaveActiveAccountDraft()
      if (!accountSaved) {
        setAccountEnrichmentRunStatus("error")
        setAccountEnrichmentRunMessage("Save the latest account name and domain before running enrichment.")
        return
      }

      const response = await requestAccountEnrichment(activeAccount.id)
      const enrichedAccountNav = mapAccountRowsToNavItems([response.account], [])[0]

      setWorkspaceAccounts((accounts) =>
        accounts.map((account) =>
          account.id === response.account.id
            ? {
                ...enrichedAccountNav,
                opportunities: account.opportunities,
              }
            : account
        )
      )
      const enrichedAccountDraft = mapAccountRowToDraft(response.account)

      setAccountDrafts((drafts) => ({
        ...drafts,
        [response.account.id]: enrichedAccountDraft,
      }))
      setSavedAccountDrafts((drafts) => ({
        ...drafts,
        [response.account.id]: enrichedAccountDraft,
      }))
      setAccountEnrichmentById((profiles) => ({
        ...profiles,
        [response.profile.account_id]: response.profile,
      }))
      setWorkspaceErrorMessage("")
      setAccountEnrichmentRunStatus("saved")
      setAccountEnrichmentRunMessage("")
    } catch (caughtError: unknown) {
      const message = getUserFacingErrorMessage(caughtError, "Enrichment needs another try. The account is still saved.")

      setAccountEnrichmentRunStatus("error")
      setAccountEnrichmentRunMessage(message)
    }
  }

  const handleSaveActiveAccountEnrichment = async (draft: AccountEnrichmentDraft): Promise<RecordMutationResult> => {
    if (!activeWorkspaceId || !activeAccount.id) {
      return {
        message: "Choose an account before saving intelligence.",
        ok: false,
      }
    }

    setAccountEnrichmentSaveStatus("saving")
    setAccountEnrichmentSaveMessage("")
    setAccountEnrichmentRunStatus("idle")
    setAccountEnrichmentRunMessage("")

    try {
      const profile = await upsertAccountEnrichmentProfile({
        account_id: activeAccount.id,
        business_summary: draft.businessSummary.trim(),
        confidence: draft.confidence.trim(),
        current_tech_stack: draft.currentTechStack.trim(),
        discovery_angles: draft.discoveryAngles.trim(),
        hiring_growth_signals: draft.hiringGrowthSignals.trim(),
        last_enriched_at: accountEnrichmentById[activeAccount.id]?.last_enriched_at ?? null,
        likely_buying_triggers: draft.likelyBuyingTriggers.trim(),
        likely_stakeholders: draft.likelyStakeholders.trim(),
        procurement_signals: draft.procurementSignals.trim(),
        recent_news_signals: draft.recentNewsSignals.trim(),
        review_sentiment_signals: draft.reviewSentimentSignals.trim(),
        risk_flags: draft.riskFlags.trim(),
        source_notes: draft.sourceNotes.trim(),
        strategic_priorities: draft.strategicPriorities.trim(),
        workspace_id: activeWorkspaceId,
      })

      setAccountEnrichmentById((profiles) => ({
        ...profiles,
        [profile.account_id]: profile,
      }))
      setAccountEnrichmentSaveStatus("saved")
      setAccountEnrichmentSaveMessage("Account intelligence saved.")

      return {
        ok: true,
      }
    } catch (caughtError: unknown) {
      const message = getUserFacingErrorMessage(caughtError, "Account intelligence needs another save attempt.")

      setAccountEnrichmentSaveStatus("error")
      setAccountEnrichmentSaveMessage(message)

      return {
        message,
        ok: false,
      }
    }
  }

  const handleSaveActiveOpportunityDraft = async () => {
    if (!activeOpportunity.id) return

    const draft = opportunityDrafts[activeOpportunity.id] ?? createOpportunityDraftFromRecord(activeOpportunity)
    if (!draft.opportunityName.trim()) {
      setOpportunityRecordSaveStatus("error")
      setOpportunityRecordSaveMessage("Add an opportunity name before saving.")
      return
    }

    const selectedPlaybooks = normalizePlaybooks(parsePlaybookSelection(draft.frameworks))
    const closeDateValue = normalizeCloseDateForPersistence(draft.closeDate, activeOpportunity.closeDate)
    const formattedAmount = formatCurrencyAmount(draft.amount.trim() || "Unqualified", activeAccount.currency)
    setOpportunityRecordSaveStatus("saving")
    setOpportunityRecordSaveMessage("")

    try {
      const updatedOpportunity = await updateSupabaseOpportunity(activeOpportunity.id, {
        name: draft.opportunityName.trim(),
        stage: draft.stage.trim() || "Discovery",
        amount: formattedAmount,
        close_date: closeDateValue.date,
        close_date_note: closeDateValue.note,
        source: draft.source.trim(),
        pain: draft.pain.trim(),
        decision_process: draft.decisionProcess.trim(),
        next_step: draft.nextStep.trim(),
        manual_notes: draft.manualNotes.trim(),
      })

      const selectedPlaybookIds = getPlaybookIdsForSelection(workspacePlaybooks, selectedPlaybooks)

      await replaceOpportunityPlaybooks(updatedOpportunity.id, selectedPlaybookIds)

      setWorkspaceOpportunities((opportunities) =>
        opportunities.map((opportunity) =>
          opportunity.id === updatedOpportunity.id
            ? {
                ...opportunity,
                amount: updatedOpportunity.amount ?? opportunity.amount,
                closeDate: closeDateValue.display,
                coverage: updatedOpportunity.coverage_score ?? opportunity.coverage,
                missing: updatedOpportunity.missing_count ?? opportunity.missing,
                name: updatedOpportunity.name,
                nextQuestion: updatedOpportunity.next_question ?? opportunity.nextQuestion,
                notes: [
                  updatedOpportunity.pain ? `Known pain: ${updatedOpportunity.pain}` : "",
                  updatedOpportunity.next_step ? `Next step: ${updatedOpportunity.next_step}` : "",
                  updatedOpportunity.manual_notes ?? "",
                ].filter(Boolean),
                questionReason: updatedOpportunity.question_reason ?? opportunity.questionReason,
                stage: updatedOpportunity.stage,
                weak: updatedOpportunity.weak_count ?? opportunity.weak,
              }
            : opportunity
        )
      )
      setWorkspaceAccounts((accounts) =>
        accounts.map((account) => ({
          ...account,
          opportunities: account.opportunities.map((opportunity) =>
            opportunity.id === updatedOpportunity.id
              ? {
                  ...opportunity,
                  name: updatedOpportunity.name,
                  stage: updatedOpportunity.stage,
                }
              : opportunity
          ),
        }))
      )
      const updatedOpportunityDraft = {
        ...mapOpportunityRowToDraft({
          accountCurrency: activeAccount.currency,
          opportunity: updatedOpportunity,
          playbookAssignments: selectedPlaybookIds.map((playbookId) => ({
            id: `${updatedOpportunity.id}-${playbookId}`,
            opportunity_id: updatedOpportunity.id,
            playbook_id: playbookId,
            created_at: new Date().toISOString(),
          })),
          playbooks: workspacePlaybooks,
        }),
        amount: formattedAmount,
      }

      setOpportunityDrafts((drafts) => ({
        ...drafts,
        [updatedOpportunity.id]: updatedOpportunityDraft,
      }))
      setSavedOpportunityDrafts((drafts) => ({
        ...drafts,
        [updatedOpportunity.id]: updatedOpportunityDraft,
      }))
      setCallPlaybooks(selectedPlaybooks)
      setWorkspaceErrorMessage("")
      setOpportunityRecordSaveStatus("saved")
      setOpportunityRecordSaveMessage("Opportunity saved.")
    } catch (caughtError: unknown) {
      const message = getUserFacingErrorMessage(caughtError, "Opportunity fields need another save attempt.")

      setOpportunityRecordSaveStatus("error")
      setOpportunityRecordSaveMessage(message)
    }
  }

  const handleAuthModeChange = (mode: AuthMode) => {
    setAuthMode(mode)
    setPublicAuthRoute(mode)
    setAuthStatusTone("info")
    setAuthStatusMessage("")
    const nextPath = `/${mode}`
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, "", nextPath)
    }
  }

  const handleLandingLogin = () => {
    setLegalPage(null)
    setAuthMode("login")
    setPublicAuthRoute("login")
    setAuthStatusTone("info")
    setAuthStatusMessage("")
    if (window.location.pathname !== "/login") {
      window.history.pushState(null, "", "/login")
    }
  }

  const handleLandingSignup = () => {
    setLegalPage(null)
    setAuthMode("signup")
    setPublicAuthRoute("signup")
    setAuthStatusTone("info")
    setAuthStatusMessage("")
    if (window.location.pathname !== "/signup") {
      window.history.pushState(null, "", "/signup")
    }
  }

  const handleAuthBackHome = () => {
    setLegalPage(null)
    setPublicAuthRoute("landing")
    setAuthStatusTone("info")
    setAuthStatusMessage("")
    if (window.location.pathname !== "/") {
      window.history.pushState(null, "", "/")
    }
  }

  const handleAuthFieldChange = () => {
    if (!authStatusMessage) return

    setAuthStatusTone("info")
    setAuthStatusMessage("")
  }

  const handleAuthLogin = async (values: LoginFormValues) => {
    if (!values.email.trim()) {
      setAuthStatusTone("error")
      setAuthStatusMessage("Enter an email address to continue.")
      return
    }

    if (values.password.length < 8) {
      setAuthStatusTone("error")
      setAuthStatusMessage("Password must be at least 8 characters.")
      return
    }

    if (!supabase) {
      setAuthStatusTone("error")
      setAuthStatusMessage(authConnectionUnavailableMessage)
      return
    }

    setAuthSubmitting(true)
    setAuthStatusTone("info")
    setAuthStatusMessage("")

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email.trim(),
        password: values.password,
      })

      if (error) {
        setAuthStatusTone("error")
        setAuthStatusMessage(getUserFacingErrorMessage(error, "Sign-in needs another try."))
        return
      }

      if (data.user) {
        setAuthSession(createAuthSessionFromUser(data.user))
        if (window.location.pathname !== "/") {
          window.history.pushState(null, "", "/")
        }
      }
    } catch (caughtError: unknown) {
      setAuthStatusTone("error")
      setAuthStatusMessage(getUserFacingErrorMessage(caughtError, "Sign-in needs another try."))
    } finally {
      setAuthSubmitting(false)
    }
  }

  const handleAuthSignup = async (values: SignupFormValues) => {
    if (!values.name.trim() || !values.email.trim()) {
      setAuthStatusTone("error")
      setAuthStatusMessage("Enter your name and email to create your account.")
      return
    }

    if (values.password.length < 8) {
      setAuthStatusTone("error")
      setAuthStatusMessage("Password must be at least 8 characters.")
      return
    }

    if (values.password !== values.confirmPassword) {
      setAuthStatusTone("error")
      setAuthStatusMessage("Passwords do not match.")
      return
    }

    if (!supabase) {
      setAuthStatusTone("error")
      setAuthStatusMessage(authConnectionUnavailableMessage)
      return
    }

    setAuthSubmitting(true)
    setAuthStatusTone("info")
    setAuthStatusMessage("")

    try {
      const { data, error } = await supabase.auth.signUp({
        email: values.email.trim(),
        password: values.password,
        options: {
          data: {
            full_name: values.name.trim(),
          },
          emailRedirectTo: getAuthRedirectUrl("/login"),
        },
      })

      if (error) {
        setAuthStatusTone("error")
        setAuthStatusMessage(getUserFacingErrorMessage(error, "Account setup needs another try."))
        return
      }

      if (data.session?.user) {
        setAuthSession(createAuthSessionFromUser(data.session.user))
        if (window.location.pathname !== "/") {
          window.history.pushState(null, "", "/")
        }
      } else {
        setAuthMode("login")
        setPublicAuthRoute("login")
        if (window.location.pathname !== "/login") {
          window.history.pushState(null, "", "/login")
        }
        setAuthStatusTone("success")
        setAuthStatusMessage("Account created. Check your email to confirm your account before signing in.")
      }
    } catch (caughtError: unknown) {
      setAuthStatusTone("error")
      setAuthStatusMessage(getUserFacingErrorMessage(caughtError, "Account setup needs another try."))
    } finally {
      setAuthSubmitting(false)
    }
  }

  const handleForgotPassword = async (email: string) => {
    if (!email.trim()) {
      setAuthStatusTone("error")
      setAuthStatusMessage("Enter your email first, then request a password reset.")
      return
    }

    if (!supabase) {
      setAuthStatusTone("error")
      setAuthStatusMessage(authConnectionUnavailableMessage)
      return
    }

    setAuthSubmitting(true)
    setAuthStatusTone("info")
    setAuthStatusMessage("")
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: getAuthRedirectUrl("/login"),
      })

      setAuthStatusTone(error ? "error" : "success")
      setAuthStatusMessage(
        error
          ? getUserFacingErrorMessage(error, "Password reset needs another try.")
          : `Password reset email requested for ${email.trim()}.`
      )
    } catch (caughtError: unknown) {
      setAuthStatusTone("error")
      setAuthStatusMessage(getUserFacingErrorMessage(caughtError, "Password reset needs another try."))
    } finally {
      setAuthSubmitting(false)
    }
  }

  const handleAuthLegalClick = (document: "terms" | "privacy") => {
    window.history.pushState(null, "", `/${document}`)
    setLegalPage(document)
  }

  const handleSaveCustomFramework = React.useCallback(
    async (draft: EditableCustomFramework) => {
      const normalized = normalizeCustomFramework(draft)

      if (!activeWorkspaceId) {
        return saveCustomFramework(normalized)
      }

      const savedPlaybook = await upsertWorkspaceCustomPlaybook(activeWorkspaceId, {
        best_for: normalized.bestFor,
        description: normalized.description,
        evidence_standard: normalized.evidenceStandard,
        live_guidance: encodeCustomFrameworkLiveGuidance(
          normalized.liveGuidance,
          normalized.exitCriteria.map((criterion) => criterion.text)
        ),
        name: normalized.frameworkName,
      })
      const savedFields = await replacePlaybookFields(
        savedPlaybook.id,
        normalized.fields.map((field, index) => ({
          description: field.detail,
          evidence_standard: field.detail,
          label: field.label,
          sort_order: (index + 1) * 10,
        }))
      )
      const savedFramework = createEditableCustomFrameworkFromRows(savedPlaybook, savedFields) ?? normalized

      setWorkspacePlaybooks((currentPlaybooks) => [
        ...currentPlaybooks.filter((playbook) => !(playbook.slug === "custom" && !playbook.is_system)),
        savedPlaybook,
      ])
      setWorkspacePlaybookFields((currentFields) => [
        ...currentFields.filter((field) => field.playbook_id !== savedPlaybook.id),
        ...savedFields,
      ])
      saveCustomFramework(savedFramework)

      return savedFramework
    },
    [activeWorkspaceId]
  )

  const signOutAndResetAuthState = async (
    destination: "landing" | "login" = "landing",
    options: { message?: string; tone?: "success" | "error" | "info" } = {}
  ) => {
    setIsRecording(false)
    setLoadingWorkspace(null)
    if (workspaceLoadTimeoutRef.current !== null) {
      window.clearTimeout(workspaceLoadTimeoutRef.current)
      workspaceLoadTimeoutRef.current = null
    }
    if (pageLoadTimeoutRef.current !== null) {
      window.clearTimeout(pageLoadTimeoutRef.current)
      pageLoadTimeoutRef.current = null
    }

    const { error } = supabase ? await supabase.auth.signOut() : { error: null }

    setAuthSession(null)
    setWorkspaceNavItems([])
    setActiveWorkspaceId("")
    setWorkspaceAccounts([])
    setWorkspaceOpportunities([])
    setWorkspaceCalls([])
    setWorkspacePlaybooks([])
    setWorkspacePlaybookFields([])
    setWorkspaceSetupDraft(null)
    setOnboardingInitialStep(1)
    setOnboardingCsvImportActive(false)
    setOnboardingCompletedImports([])
    setPendingCsvImportMode(null)
    setSavedOpenAiKeyState(null)
    setOpenAiKeyStatusMessage("")
    setWorkspaceSessionStatus(null)
    setWorkspaceSessionWarningOpen(false)
    setAccountDrafts({})
    setSavedAccountDrafts({})
    setOpportunityDrafts({})
    setSavedOpportunityDrafts({})
    setLiveGuidanceByCallId({})
    setActiveAccountId("")
    setActiveOpportunityId("")
    setWorkspaceDataState("loading")
    setAuthMode("login")
    setPublicAuthRoute(destination)
    const nextPath = destination === "login" ? "/login" : "/"
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, "", nextPath)
    }
    setAuthStatusTone(error ? "error" : options.tone ?? "success")
    setAuthStatusMessage(error ? getUserFacingErrorMessage(error, "Sign-out needs another try.") : options.message ?? "Signed out.")
  }

  const handleWorkspaceSessionExpired = React.useCallback(async (message = workspaceSessionExpiredMessage) => {
    setWorkspaceSessionWarningOpen(false)

    if (isCallLiveRef.current && (activeCallIdRef.current || callCapture.activeCallId)) {
      try {
        await handleRecordingChange(false)
      } catch {
        // The sign-out still needs to happen; call capture will have already attempted to save what it can.
      }
    }

    await signOutAndResetAuthState("login", {
      message,
      tone: "info",
    })
  }, [callCapture.activeCallId])

  React.useEffect(() => {
    handleWorkspaceSessionExpiredRef.current = (message?: string) => {
      void handleWorkspaceSessionExpired(message)
    }

    return () => {
      handleWorkspaceSessionExpiredRef.current = null
    }
  }, [handleWorkspaceSessionExpired])

  const handleAuthLogout = async () => {
    await signOutAndResetAuthState("landing")
  }

  const handleOnboardingBackToLogin = async () => {
    await signOutAndResetAuthState("login")
  }

  const handleCancelWorkspaceSetup = async () => {
    const draft = workspaceSetupDraft

    setOnboardingOpen(false)
    setWorkspaceSetupDraft(null)
    setOnboardingInitialStep(1)
    setOnboardingCsvImportActive(false)
    setOnboardingCompletedImports([])
    setPendingCsvImportMode(null)

    if (!draft) {
      const fallbackWorkspace =
        workspaceNavItems.find((workspace) => workspace.id !== activeWorkspaceId && Boolean(workspace.onboardingCompletedAt)) ??
        workspaceNavItems.find((workspace) => workspace.id !== activeWorkspaceId)

      if (fallbackWorkspace) {
        handleWorkspaceChange(fallbackWorkspace)
      }

      return
    }

    if (draft.id.startsWith("new-workspace-")) return

    try {
      await deleteSupabaseWorkspace(draft.id)
      setWorkspaceNavItems((items) => {
        const nextItems = items.filter((workspace) => workspace.id !== draft.id)

        if (activeWorkspaceId === draft.id) {
          setActiveWorkspaceId(nextItems[0]?.id ?? "")
        }

        return nextItems
      })
    } catch {
      setWorkspaceErrorMessage("Workspace setup was cancelled. SalesFrame needs another try to remove the draft workspace.")
    }
  }

  const handleWorkspaceChange = (workspace: WorkspaceNavItem) => {
    if (isCallLive) {
      setWorkspaceErrorMessage("Stop the active call before changing workspaces.")
      return
    }

    ensureAuthenticatedAppRoute()
    if (workspaceLoadTimeoutRef.current !== null) {
      window.clearTimeout(workspaceLoadTimeoutRef.current)
    }
    if (pageLoadTimeoutRef.current !== null) {
      window.clearTimeout(pageLoadTimeoutRef.current)
      pageLoadTimeoutRef.current = null
    }

    setIsRecording(false)
    setElapsed(0)
    setPageLoadingView(null)
    setOnboardingOpen(false)
    setWorkspaceSetupDraft(null)
    setOnboardingInitialStep(1)
    setOnboardingCsvImportActive(false)
    setOnboardingCompletedImports([])
    setPendingCsvImportMode(null)
    setCsvImportOpen(false)
    loadedWorkspaceIdRef.current = null
    blurFocusedNavigationElement()
    setActiveView("home")
    requestNavigationScrollReset()
    setActiveWorkspaceId(workspace.id)
    void recordWorkspaceSessionActivity({
      activityType: "workspace_switch",
      workspaceId: workspace.id,
    })
      .then(handleWorkspaceSessionStatus)
      .catch(() => undefined)
    setWorkspaceDataState("loading")
    setLoadingWorkspace(workspace)
    workspaceLoadTimeoutRef.current = window.setTimeout(() => {
      setLoadingWorkspace(null)
      workspaceLoadTimeoutRef.current = null
    }, minimumWorkspaceLoadMs)
  }

  const handleOpenCreateWorkspaceSetup = () => {
    ensureAuthenticatedAppRoute()
    setOnboardingInitialStep(1)
    setOnboardingCsvImportActive(false)
    setOnboardingCompletedImports([])
    setPendingCsvImportMode(null)
    setWorkspaceSetupDraft({
      id: `new-workspace-${Date.now()}`,
      name: "New workspace",
      description: "Seller workspace",
      defaultCurrency: activeWorkspace?.defaultCurrency ?? defaultCurrencyCode,
      workspaceIcon: defaultWorkspaceIconId,
      onboardingCompletedAt: null,
      role: "Owner",
    })
    setOnboardingOpen(true)
  }

  const handleUpdateWorkspace = async (
    workspaceId: string,
    payload: WorkspaceSavePayload
  ) => {
    const updatedWorkspace = await updateSupabaseWorkspace(workspaceId, {
      name: payload.name,
      description: payload.description,
      default_currency: normalizeCurrencyCode(payload.defaultCurrency),
      workspace_icon: normalizeWorkspaceIconId(payload.workspaceIcon),
    })
    const navItem = mapWorkspaceRowToNavItem(updatedWorkspace)

    setWorkspaceNavItems((items) =>
      items.map((workspace) => (workspace.id === workspaceId ? navItem : workspace))
    )

    return navItem
  }

  const handleDuplicateWorkspace = async (workspace: WorkspaceNavItem) => {
    ensureAuthenticatedAppRoute()
    const duplicatedWorkspace = await createSupabaseWorkspace({
      name: `${workspace.name} Copy`,
      description: workspace.description || "Seller workspace",
      default_currency: workspace.defaultCurrency,
      workspace_icon: normalizeWorkspaceIconId(workspace.workspaceIcon),
    })
    const navItem = mapWorkspaceRowToNavItem(duplicatedWorkspace)

    setWorkspaceNavItems((items) => [...items, navItem])
    setSavedOpenAiKeyState(null)
    setOpenAiKeyStatusMessage("")
    setActiveWorkspaceId(navItem.id)

    return navItem
  }

  const handleDeleteWorkspace = async (workspaceId: string) => {
    await deleteSupabaseWorkspace(workspaceId)

    setWorkspaceNavItems((items) => {
      const nextItems = items.filter((workspace) => workspace.id !== workspaceId)

      if (activeWorkspaceId === workspaceId) {
        setActiveWorkspaceId(nextItems[0]?.id ?? "")
      }

      return nextItems
    })
  }

  const handleCompleteWorkspaceOnboarding = async ({
    apiKey,
    profile,
    workspaceCurrency,
    workspaceDescription,
    workspaceIcon,
    workspaceName,
  }: {
    apiKey: string
    profile: SellerResearchProfile
    workspaceCurrency: CurrencyCode
    workspaceDescription: string
    workspaceIcon: WorkspaceIconId
    workspaceName: string
  }) => {
    ensureAuthenticatedAppRoute()
    let targetWorkspaceId = activeWorkspaceId
    let createdWorkspaceNavItem: WorkspaceNavItem | null = null

    const isUnsavedWorkspaceDraft = workspaceSetupDraft?.id.startsWith("new-workspace-") ?? false

    if (workspaceSetupDraft && !workspaceName.trim()) {
      throw new Error("Add a workspace name before finishing setup.")
    }

    if (workspaceSetupDraft && isUnsavedWorkspaceDraft) {
      const createdWorkspace = await createSupabaseWorkspace({
        name: workspaceName.trim(),
        description: workspaceDescription.trim() || "Seller workspace",
        default_currency: normalizeCurrencyCode(workspaceCurrency),
        workspace_icon: normalizeWorkspaceIconId(workspaceIcon),
      })

      createdWorkspaceNavItem = mapWorkspaceRowToNavItem(createdWorkspace)
      targetWorkspaceId = createdWorkspaceNavItem.id
      setWorkspaceNavItems((items) => [...items, createdWorkspaceNavItem as WorkspaceNavItem])
      setActiveWorkspaceId(targetWorkspaceId)
      setWorkspaceSetupDraft(createdWorkspaceNavItem)
      setSavedOpenAiKeyState(null)
      setOpenAiKeyStatusMessage("")
    } else if (workspaceSetupDraft) {
      targetWorkspaceId = workspaceSetupDraft.id
      await updateSupabaseWorkspace(targetWorkspaceId, {
        name: workspaceName.trim(),
        description: workspaceDescription.trim() || "Seller workspace",
        default_currency: normalizeCurrencyCode(workspaceCurrency),
        workspace_icon: normalizeWorkspaceIconId(workspaceIcon),
      })
    } else if (!targetWorkspaceId) {
      return
    }

    await recordWorkspaceSessionActivity({
      activityType: "workspace_switch",
      workspaceId: targetWorkspaceId,
    }).then(handleWorkspaceSessionStatus)

    if (apiKey.trim()) {
      const status = await saveOpenAiKey(apiKey, targetWorkspaceId)
      setSavedOpenAiKeyState(mapOpenAiKeyStatusToSavedState(status))
      setOpenAiKeyStatusMessage("")
    } else if (!savedOpenAiKeyState) {
      throw new Error("OpenAI API key is required to finish workspace setup.")
    }

    if (!workspaceSetupDraft) {
      await updateSupabaseWorkspace(targetWorkspaceId, {
        name: workspaceName.trim(),
        description: workspaceDescription.trim() || "Seller workspace",
        default_currency: normalizeCurrencyCode(workspaceCurrency),
        workspace_icon: normalizeWorkspaceIconId(workspaceIcon),
      })
    }

    await upsertSellerResearchProfile({
      workspace_id: targetWorkspaceId,
      seller_company: profile.sellerCompany,
      seller_domain: profile.sellerDomain,
      product_context: profile.productContext,
    })

    const updatedWorkspace = await markWorkspaceOnboardingComplete(targetWorkspaceId)
    const nextWorkspace = mapWorkspaceRowToNavItem(updatedWorkspace)

    setSellerResearchProfile(profile)
    setWorkspaceNavItems((items) =>
      items.some((workspace) => workspace.id === nextWorkspace.id)
        ? items.map((workspace) => (workspace.id === nextWorkspace.id ? nextWorkspace : workspace))
        : [...items, createdWorkspaceNavItem ?? nextWorkspace]
    )
    setActiveWorkspaceId(nextWorkspace.id)
    setWorkspaceSetupDraft(null)
    setOnboardingOpen(false)
    loadedWorkspaceIdRef.current = null
    setActiveView("home")
    requestNavigationScrollReset()
    setWorkspaceDataState("loading")
    setWorkspaceRefreshToken((value) => value + 1)
  }

  const workspaceViews = ["workspace", "post-call", "methodology", "opportunity-record", "opportunity-intelligence"]
  const accountViews = ["account-detail"]
  const opportunityViews = ["opportunities"]
  const callViews = ["calls"]
  const playbookViews = [
    "playbooks",
    "meddicc",
    "meddpicc",
    "bant",
    "force-management",
    "spin",
    "sandler",
    "challenger",
    "gap-selling",
    "value-selling",
    "strategic-selling",
    "spiced",
    "custom",
  ]
  const profileViews = profileRouteIds
  const settingsViews = settingsRouteIds
  const callSurfaceViews = ["workspace", "post-call"]
  const isWorkspaceIndependentView =
    settingsViews.includes(activeView) || profileViews.includes(activeView) || playbookViews.includes(activeView)
  const shouldShowWorkspaceState = workspaceDataState !== "ready" && !isWorkspaceIndependentView && !isCallLive
  const shouldShowPageTransition = Boolean(pageLoadingView) && !loadingWorkspace && !shouldShowWorkspaceState
  const shouldShowMobileStartCall =
    !loadingWorkspace &&
    !shouldShowWorkspaceState &&
    !shouldShowPageTransition &&
    !isCallLive &&
    mobileStartCallViews.includes(activeView)
  const mobileStartCallHasVisiblePrimaryAction = mobileStartCallInlineActionViews.includes(activeView)
  const shouldRenderMobileStartCall =
    shouldShowMobileStartCall &&
    (!mobileStartCallHasVisiblePrimaryAction || mobileStartCallScrolledPastPrimaryAction)
  const isWorkspaceSetupFlow =
    Boolean(workspaceSetupDraft) ||
    onboardingInitialStep === 4 ||
    (Boolean(activeWorkspace) && !activeWorkspace?.onboardingCompletedAt && hasCompletedWorkspace)

  const handleStaySignedIn = async () => {
    setWorkspaceSessionWarningOpen(false)

    try {
      await sendWorkspaceSessionActivity("stay_signed_in", { force: true })
    } catch (caughtError: unknown) {
      const message = getUserFacingErrorMessage(caughtError, workspaceSessionExpiredMessage)

      if (message === workspaceSessionExpiredMessage || /session/i.test(message)) {
        handleWorkspaceSessionExpiredRef.current?.(message)
      }
    }
  }

  const handleSessionWarningSignOut = async () => {
    setWorkspaceSessionWarningOpen(false)
    await signOutAndResetAuthState("login", {
      message: "Signed out.",
      tone: "success",
    })
  }

  React.useEffect(() => {
    if (!shouldShowMobileStartCall || !mobileStartCallHasVisiblePrimaryAction) {
      setMobileStartCallScrolledPastPrimaryAction(false)
      return
    }

    const appContent = appMainScrollRef.current
    if (!appContent) return

    const updateMobileStartCallVisibility = () => {
      setMobileStartCallScrolledPastPrimaryAction(appContent.scrollTop > 180)
    }

    updateMobileStartCallVisibility()
    appContent.addEventListener("scroll", updateMobileStartCallVisibility, { passive: true })

    return () => appContent.removeEventListener("scroll", updateMobileStartCallVisibility)
  }, [activeNavigationKey, mobileStartCallHasVisiblePrimaryAction, shouldShowMobileStartCall])

  const handleRetryWorkspaceState = () => {
    setWorkspaceDataState("loading")
    setWorkspaceRefreshToken((value) => value + 1)
  }

  if (isLiveCoachPopoutRoute()) {
    return (
      <React.Suspense fallback={<PublicRouteFallback darkMode={darkMode} />}>
        <LiveCoachPopoutWindow darkMode={darkMode} />
      </React.Suspense>
    )
  }

  if (isDevPublicLandingPreviewRoute()) {
    return (
      <React.Suspense fallback={<PublicRouteFallback darkMode={darkMode} surface="landing" />}>
        <MarketingLandingPage onLogin={handleLandingLogin} onSignup={handleLandingSignup} />
      </React.Suspense>
    )
  }

  if (legalPage) {
    return (
      <React.Suspense fallback={<PublicRouteFallback darkMode={darkMode} />}>
        <LegalDocumentPage
          darkMode={darkMode}
          document={legalPage}
          onBack={() => {
            window.history.pushState(null, "", "/")
            setLegalPage(null)
          }}
          onDarkModeChange={setDarkMode}
        />
      </React.Suspense>
    )
  }

  if (authLoading && publicAuthRoute === "landing") {
    return (
      <React.Suspense fallback={<PublicRouteFallback darkMode={darkMode} surface="landing" />}>
        <MarketingLandingPage onLogin={handleLandingLogin} onSignup={handleLandingSignup} />
      </React.Suspense>
    )
  }

  if (authLoading) {
    return <AuthLoadingView darkMode={darkMode} onDarkModeChange={setDarkMode} />
  }

  if (!authSession) {
    if (publicAuthRoute === "landing") {
      return (
        <React.Suspense fallback={<PublicRouteFallback darkMode={darkMode} surface="landing" />}>
          <MarketingLandingPage onLogin={handleLandingLogin} onSignup={handleLandingSignup} />
        </React.Suspense>
      )
    }

    const renderedAuthMode: AuthMode = publicAuthRoute === "signup" ? "signup" : authMode

    return (
      <React.Suspense fallback={<PublicRouteFallback darkMode={darkMode} />}>
      <AuthPage
        darkMode={darkMode}
        isSubmitting={authSubmitting}
        mode={renderedAuthMode}
        statusMessage={authStatusMessage}
        statusTone={authStatusTone}
        onDarkModeChange={setDarkMode}
        onBackHome={handleAuthBackHome}
        onFieldChange={handleAuthFieldChange}
        onForgotPassword={handleForgotPassword}
        onLegalClick={handleAuthLegalClick}
        onLogin={handleAuthLogin}
        onModeChange={handleAuthModeChange}
        onSignup={handleAuthSignup}
      />
      </React.Suspense>
    )
  }

  return (
    <TooltipProvider>
      <SidebarProvider className="h-svh min-h-0 overflow-hidden">
        <Dialog open={workspaceSessionWarningOpen && !isCallLive} onOpenChange={setWorkspaceSessionWarningOpen}>
          <DialogContent className="max-sm:max-w-[calc(100%-0.75rem)] sm:max-w-md">
            <DialogHeader>
              <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ShieldCheckIcon className="size-5" />
              </div>
              <DialogTitle>Still here?</DialogTitle>
              <DialogDescription>
                SalesFrame will sign you out soon to keep this workspace safe.
              </DialogDescription>
            </DialogHeader>
            <DialogActions
              cancelLabel="Sign out"
              onCancel={handleSessionWarningSignOut}
              primaryAction={
                <Button className="gap-2" onClick={handleStaySignedIn}>
                  <CheckCircle2Icon />
                  Stay signed in
                </Button>
              }
            />
          </DialogContent>
        </Dialog>
        <AppSidebar
          activeAccountId={activeAccount.id}
          activeOpportunityId={activeOpportunity.id}
          activeWorkspaceId={activeWorkspaceId}
          activeView={activeView}
          accounts={workspaceAccounts}
          workspaces={workspaceNavItems}
          onAccountSelect={handleAccountSelect}
          onArchiveAccount={handleRequestArchiveAccount}
          onArchiveOpportunity={handleRequestArchiveOpportunity}
          onCreateAccount={() => setCreateAccountOpen(true)}
          onCreateOpportunity={handleOpenCreateOpportunity}
          onCreateWorkspace={handleOpenCreateWorkspaceSetup}
          onDeleteAccount={handleRequestDeleteAccount}
          onDeleteOpportunity={handleRequestDeleteOpportunity}
          onDeleteWorkspace={handleDeleteWorkspace}
          onDuplicateWorkspace={handleDuplicateWorkspace}
          onEditAccount={handleOpenEditAccount}
          onEditOpportunity={handleOpenEditOpportunity}
          onUpdateWorkspace={handleUpdateWorkspace}
          isWorkspaceLoading={Boolean(loadingWorkspace)}
          onLogout={handleAuthLogout}
          onNavigate={handleNavigate}
          onOpportunitySelect={handleOpportunitySelect}
          onWorkspaceChange={handleWorkspaceChange}
          user={{
            name: personalAccountProfile.fullName,
            email: personalAccountProfile.email,
            avatar: personalAccountProfile.avatarUrl,
          }}
          variant="inset"
        />
        <SidebarInset className="h-svh min-h-0 overflow-hidden md:h-[calc(100svh-1rem)]">
          <AppHeader
            account={activeAccount}
            accountDrafts={accountDrafts}
            accounts={workspaceAccounts}
            activeView={activeView}
            calls={workspaceCalls}
            darkMode={darkMode}
            isRecording={isCallLive}
            opportunity={activeOpportunity}
            opportunityDrafts={opportunityDrafts}
            opportunities={workspaceOpportunities}
            transcriptsByCallId={transcriptsByCallId}
            onDarkModeChange={setDarkMode}
            onAccountSelect={handleAccountSelect}
            onCallSelect={handleCallSelect}
            onNavigate={handleNavigate}
            onOpportunitySelect={handleOpportunitySelect}
          />
          <main
            ref={appMainScrollRef}
            data-navigation-key={activeNavigationKey}
            data-navigation-reset={navigationScrollResetNonce}
            className={cn(
              "sf-navigation-scroll-root flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4 pt-0 md:gap-6 md:p-6 md:pb-6 md:pt-0",
              shouldRenderMobileStartCall
                ? "pb-[calc(6.5rem+env(safe-area-inset-bottom))]"
                : "pb-[calc(1rem+env(safe-area-inset-bottom))]"
            )}
          >
            {loadingWorkspace || shouldShowWorkspaceState || shouldShowPageTransition || activeView === "home" ? null : callSurfaceViews.includes(activeView) ? (
              <CommandBar
                account={activeAccount}
                callType={callType}
                durationLimitSeconds={MAX_LIVE_CALL_SECONDS}
                elapsed={elapsed}
                isRecording={canStopActiveCall}
                isStopping={isStoppingCall || callCapture.status === "stopping"}
                opportunity={activeOpportunity}
                opportunityDraft={activeOpportunityDraft}
                startCallAction={
                  activeAccount.id && activeOpportunity.id ? (
                    <StartRecordingDialog
                      accounts={[activeAccount]}
                      accountResearchById={accountResearchById}
                      defaultAccountId={activeAccount.id}
                      defaultOpportunityId={activeOpportunity.id}
                      opportunityDrafts={opportunityDrafts}
                      opportunities={[activeOpportunity]}
                      savedOpenAiKeyState={savedOpenAiKeyState}
                      sellerResearchProfile={sellerResearchProfile}
                      workspaceId={activeWorkspaceId}
                      onOpenSettings={() => handleNavigate("ai")}
                      onStartRecording={handleStartRecording}
                    />
                  ) : null
                }
                onCallTypeChange={setCallType}
                onRecordingChange={handleRecordingChange}
                onViewChange={handleNavigate}
              />
            ) : null}
            {loadingWorkspace ? (
              <WorkspaceSwitchSkeleton workspace={loadingWorkspace} />
            ) : shouldShowWorkspaceState ? (
              workspaceDataState === "loading" ? (
                <PageTransitionSkeleton activeView={activeView} />
              ) : (
                <WorkspaceStateView
                  activeView={activeView}
                  message={workspaceErrorMessage}
                  state={workspaceDataState}
                  onCreateAccount={() => {
                    setCreateAccountOpen(true)
                  }}
                  onNavigate={handleNavigate}
                  onRetry={handleRetryWorkspaceState}
                />
              )
            ) : shouldShowPageTransition ? (
              <PageTransitionSkeleton activeView={pageLoadingView ?? activeView} />
            ) : activeView === "home" ? (
              <HomeDashboard
                accounts={workspaceAccounts}
                accountResearchById={accountResearchById}
                defaultCurrency={activeWorkspace?.defaultCurrency ?? defaultCurrencyCode}
                opportunities={workspaceOpportunities}
                opportunityDrafts={opportunityDrafts}
                playbookFields={workspacePlaybookFields}
                playbookRows={workspacePlaybooks}
                savedOpenAiKeyState={savedOpenAiKeyState}
                sellerResearchProfile={sellerResearchProfile}
                workspaceId={activeWorkspaceId}
                onOpportunitySelect={handleOpportunitySelect}
                onOpenOpportunities={() => handleNavigate("opportunities")}
                onOpenSettings={() => handleNavigate("ai")}
                onStartRecording={handleStartRecording}
              />
            ) : workspaceViews.includes(activeView) ? (
              <WorkspaceView
                activeCallId={activeCallId}
                activeView={activeView}
                account={activeAccount}
                accountDraft={activeAccountDraft}
                accountResearchById={accountResearchById}
                calls={workspaceCalls}
                callType={callType}
                callPlaybooks={callPlaybooks}
                captureError={callCapture.error}
                audioPreflight={callCapture.audioPreflight}
                capturePermissionState={callCapture.permissionState}
                captureStatus={callCapture.status}
                customerResearch={customerResearch}
                elapsed={elapsed}
                isRecording={canStopActiveCall}
                isStoppingCall={isStoppingCall || callCapture.status === "stopping"}
                initialLiveGuidance={activeCallId ? liveGuidanceByCallId[activeCallId] ?? null : null}
                manualCoach={manualCoachState}
                notes={notes}
                opportunity={activeOpportunity}
                opportunityDraft={activeOpportunityDraft}
                opportunityDrafts={opportunityDrafts}
                playbookFields={workspacePlaybookFields}
                playbookRows={workspacePlaybooks}
                postCallFocusCallId={postCallFocusCallId}
                postCallGenerating={postCallGenerating}
                postCallError={postCallError}
                postCallOutput={activePostCallOutput}
                postCallTranscript={activePostCallTranscript}
                savedOpenAiKeyState={savedOpenAiKeyState}
                savedOpportunityDraft={activeSavedOpportunityDraft}
                sellerResearchProfile={sellerResearchProfile}
                sellerName={personalAccountProfile.fullName}
                speakerIdentities={speakerIdentities}
                transcript={transcript}
                workspaceId={activeWorkspaceId}
                onCoachFeedback={handleLiveCoachFeedback}
                onMarkQuestionAsked={handleMarkManualQuestionAsked}
                onNavigate={handleNavigate}
                onOpenSettings={() => handleNavigate("ai")}
                onOpportunityDraftChange={(field, value) =>
                  updateOpportunityDraft(activeOpportunity.id, field, value)
                }
                onArchiveOpportunity={handleRequestArchiveOpportunity}
                onDeleteOpportunity={handleRequestDeleteOpportunity}
                onSaveOpportunityDraft={handleSaveActiveOpportunityDraft}
                onScrollToTop={requestNavigationScrollReset}
                onStartRecording={handleStartRecording}
                onStopRecording={() => handleRecordingChange(false)}
                onSpeakerIdentityChange={handleSpeakerIdentityChange}
                onTranscriptSpeakerChange={handleTranscriptSpeakerChange}
                onDeleteCall={handleRequestDeleteCall}
                onUseManualQuestion={handleUseManualQuestion}
                opportunitySaveMessage={opportunityRecordSaveMessage}
                opportunitySaveStatus={opportunityRecordSaveStatus}
              />
            ) : accountViews.includes(activeView) ? (
              <AccountView
                account={activeAccount}
                accountDraft={activeAccountDraft}
                accountEnrichment={activeAccountEnrichment}
                accountEnrichmentRunMessage={accountEnrichmentRunMessage}
                accountEnrichmentRunStatus={accountEnrichmentRunStatus}
                accountEnrichmentSaveMessage={accountEnrichmentSaveMessage}
                accountEnrichmentSaveStatus={accountEnrichmentSaveStatus}
                accountResearchById={accountResearchById}
                opportunityDrafts={opportunityDrafts}
                opportunities={workspaceOpportunities.filter((opportunity) => opportunity.accountId === activeAccount.id)}
                playbookFields={workspacePlaybookFields}
                playbookRows={workspacePlaybooks}
                savedAccountDraft={activeSavedAccountDraft}
                savedOpenAiKeyState={savedOpenAiKeyState}
                sellerResearchProfile={sellerResearchProfile}
                workspaceId={activeWorkspaceId}
                onAccountDraftChange={(field, value) => updateAccountDraft(activeAccount.id, field, value)}
                onArchiveAccount={handleRequestArchiveAccount}
                onArchiveOpportunity={handleRequestArchiveOpportunity}
                onCreateOpportunity={() => handleOpenCreateOpportunity(activeAccount.id)}
                onDeleteOpportunity={handleRequestDeleteOpportunity}
                onOpportunitySelect={handleOpportunitySelect}
                onOpenSettings={() => handleNavigate("ai")}
                onRunAccountEnrichment={handleRunActiveAccountEnrichment}
                onSaveAccountDraft={handleSaveActiveAccountDraft}
                onSaveAccountEnrichment={handleSaveActiveAccountEnrichment}
                onScrollToTop={requestNavigationScrollReset}
                onStartRecording={handleStartRecording}
                saveMessage={accountRecordSaveMessage}
                saveStatus={accountRecordSaveStatus}
              />
            ) : profileViews.includes(activeView) ? (
              <PersonalAccountView
                accounts={workspaceAccounts}
                archivedAccounts={archivedAccountRows}
                archivedOpportunities={archivedOpportunityRows}
                bulkImportStatus={bulkImportStatus}
                bulkImportStatusLoading={bulkImportStatusLoading}
                bulkImportStatusMessage={bulkImportStatusMessage}
                profile={personalAccountProfile}
                savedOpenAiKeyState={savedOpenAiKeyState}
                sellerResearchProfile={sellerResearchProfile}
                workspaceId={activeWorkspaceId}
                onOpenCsvImport={handleOpenCsvImport}
                onRefreshBulkImportStatus={refreshBulkImportStatus}
                onRestoreArchivedAccount={handleRestoreArchivedAccount}
                onRestoreArchivedOpportunity={handleRestoreArchivedOpportunity}
                onRetryFailedBulkEnrichment={handleRetryFailedBulkEnrichment}
                onProfileChange={setPersonalAccountProfile}
                onSellerResearchProfileChange={setSellerResearchProfile}
                onOpenSettings={() => handleNavigate("ai")}
              />
            ) : opportunityViews.includes(activeView) ? (
              <OpportunitiesView
                accounts={workspaceAccounts}
                opportunities={workspaceOpportunities}
                opportunityDrafts={opportunityDrafts}
                playbookFields={workspacePlaybookFields}
                playbookRows={workspacePlaybooks}
                onArchiveOpportunity={handleRequestArchiveOpportunity}
                onCreateOpportunity={() => handleOpenCreateOpportunity(activeAccount.id)}
                onDeleteOpportunity={handleRequestDeleteOpportunity}
                onOpportunitySelect={handleOpportunitySelect}
              />
            ) : callViews.includes(activeView) ? (
              <CallsView
                accounts={workspaceAccounts}
                accountResearchById={accountResearchById}
                activeCallId={activeCallId}
                calls={workspaceCalls}
                opportunityDrafts={opportunityDrafts}
                opportunities={workspaceOpportunities}
                savedOpenAiKeyState={savedOpenAiKeyState}
                sellerResearchProfile={sellerResearchProfile}
                transcriptsByCallId={transcriptsByCallId}
                workspaceId={activeWorkspaceId}
                onCallSelect={handleCallSelect}
                onDeleteCall={handleRequestDeleteCall}
                onOpenSettings={() => handleNavigate("ai")}
                onStartRecording={handleStartRecording}
              />
            ) : playbookViews.includes(activeView) ? (
              <PlaybooksView
                activeView={activeView}
                playbookFields={workspacePlaybookFields}
                playbookRows={workspacePlaybooks}
                onNavigate={handleNavigate}
                onSaveCustomFramework={handleSaveCustomFramework}
              />
            ) : settingsViews.includes(activeView) ? (
              <SettingsView
                activeView={activeView}
                bulkImportStatus={bulkImportStatus}
                isWorkspaceOwner={(activeWorkspace?.role ?? "").toLowerCase() === "owner"}
                workspaceId={activeWorkspaceId}
                keyStatusMessage={openAiKeyStatusMessage}
                savedKeyState={savedOpenAiKeyState}
                onKeySaved={() => setBulkImportStatusRefreshToken((value) => value + 1)}
                onSavedKeyStateChange={setSavedOpenAiKeyState}
                onViewImportStatus={() => handleNavigate("profile-account")}
              />
            ) : (
              <SectionView
                activeView={activeView}
                onNavigate={handleNavigate}
              />
            )}
          </main>
          {shouldRenderMobileStartCall ? (
            <MobileStartCallBar
              account={activeAccount}
              accounts={workspaceAccounts}
              accountResearchById={accountResearchById}
              defaultCurrency={activeWorkspace?.defaultCurrency ?? defaultCurrencyCode}
              opportunity={activeOpportunity}
              opportunityDrafts={opportunityDrafts}
              opportunities={workspaceOpportunities}
              savedOpenAiKeyState={savedOpenAiKeyState}
              sellerResearchProfile={sellerResearchProfile}
              workspaceId={activeWorkspaceId}
              onOpenSettings={() => handleNavigate("ai")}
              onStartRecording={handleStartRecording}
            />
          ) : null}
        </SidebarInset>
        <CreateAccountDialog
          accountDrafts={accountDrafts}
          accounts={workspaceAccounts}
          defaultCurrency={activeWorkspace?.defaultCurrency ?? defaultCurrencyCode}
          open={createAccountOpen}
          savedOpenAiKeyState={savedOpenAiKeyState}
          sellerResearchProfile={sellerResearchProfile}
          workspaceId={activeWorkspaceId}
          onCreateAccount={handleCreateAccount}
          onOpenSettings={() => handleNavigate("ai")}
          onOpenChange={setCreateAccountOpen}
          onOpenExistingAccount={handleAccountSelect}
        />
        <EditAccountDialog
          account={editingAccount}
          draft={editingAccount ? accountDrafts[editingAccount.id] ?? createAccountDraftFromRecord(editingAccount) : undefined}
          open={Boolean(editingAccount)}
          savedDraft={editingAccount ? savedAccountDrafts[editingAccount.id] ?? createAccountDraftFromRecord(editingAccount) : undefined}
          onEditAccount={handleEditAccount}
          onOpenChange={(open) => {
            if (!open) {
              setEditAccountId(null)
            }
          }}
        />
        <CreateOpportunityDialog
          accounts={workspaceAccounts}
          defaultAccountId={createOpportunityAccountId}
          open={createOpportunityOpen}
          onCreateOpportunity={handleCreateOpportunity}
          onOpenChange={setCreateOpportunityOpen}
        />
        <EditOpportunityDialog
          accounts={workspaceAccounts}
          draft={
            editingOpportunity
              ? opportunityDrafts[editingOpportunity.id] ?? createOpportunityDraftFromRecord(editingOpportunity)
              : undefined
          }
          opportunity={editingOpportunity}
          open={Boolean(editingOpportunity)}
          savedDraft={
            editingOpportunity
              ? savedOpportunityDrafts[editingOpportunity.id] ?? createOpportunityDraftFromRecord(editingOpportunity)
              : undefined
          }
          onEditOpportunity={handleEditOpportunity}
          onOpenChange={(open) => {
            if (!open) {
              setEditOpportunityId(null)
            }
          }}
        />
        <DeleteRecordDialog
          record={pendingDeleteRecord}
          onCancel={() => setPendingDeleteRecord(null)}
          onConfirm={handleConfirmDeleteRecord}
        />
        <ArchiveRecordDialog
          record={pendingArchiveRecord}
          onCancel={() => setPendingArchiveRecord(null)}
          onConfirm={handleConfirmArchiveRecord}
        />
        {activeWorkspace && csvImportOpen ? (
          <React.Suspense
            fallback={
              <CsvImportDialogFallback
                mode={csvImportMode}
                onOpenChange={handleCsvImportOpenChange}
                open={csvImportOpen}
              />
            }
          >
            <CsvImportDialog
              accounts={workspaceAccounts}
              defaultCurrency={activeWorkspace.defaultCurrency}
              mode={csvImportMode}
              onImportComplete={() => {
                setWorkspaceRefreshToken((value) => value + 1)
                setBulkImportStatusRefreshToken((value) => value + 1)
                if (onboardingCsvImportActive) {
                  setOnboardingCompletedImports((items) =>
                    items.includes(csvImportMode) ? items : [...items, csvImportMode]
                  )
                }
              }}
              onOpenChange={handleCsvImportOpenChange}
              open={csvImportOpen}
              opportunities={workspaceOpportunities}
              playbooks={workspacePlaybooks}
              workspaceId={activeWorkspaceId}
              workspaceName={activeWorkspace.name}
            />
          </React.Suspense>
        ) : null}
        {setupWorkspace ? (
          <WorkspaceOnboardingDialog
            completedImportModes={onboardingCompletedImports}
            initialStep={onboardingInitialStep}
            open={onboardingOpen}
            backActionLabel={isWorkspaceSetupFlow ? "Cancel" : "Back to login"}
            savedOpenAiKeyState={workspaceSetupDraft ? null : savedOpenAiKeyState}
            sellerResearchProfile={sellerResearchProfile}
            workspace={setupWorkspace}
            onBackToLogin={isWorkspaceSetupFlow ? handleCancelWorkspaceSetup : handleOnboardingBackToLogin}
            onComplete={handleCompleteWorkspaceOnboarding}
            onOpenChange={(open) => {
              if (open) {
                setOnboardingOpen(true)
              }
            }}
            onStartImport={handleStartOnboardingImport}
          />
        ) : null}
      </SidebarProvider>
    </TooltipProvider>
  )
}

function AuthLoadingView({
  darkMode,
  onDarkModeChange,
}: {
  darkMode: boolean
  onDarkModeChange: (value: boolean) => void
}) {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <AudioLinesIcon aria-hidden="true" className="size-5" />
            </div>
            <CardTitle>Getting SalesFrame ready</CardTitle>
            <CardDescription>Checking your session so we can drop you back into the right workspace.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-11 md:size-7"
                aria-label="Toggle theme"
                onClick={() => onDarkModeChange(!darkMode)}
              >
                {darkMode ? <SunIcon /> : <MoonIcon />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function WorkspaceOnboardingDialog({
  backActionLabel = "Back to login",
  completedImportModes = [],
  initialStep = 1,
  open,
  savedOpenAiKeyState,
  sellerResearchProfile,
  workspace,
  onBackToLogin,
  onComplete,
  onOpenChange,
  onStartImport,
}: {
  backActionLabel?: string
  completedImportModes?: CsvImportType[]
  initialStep?: 1 | 2 | 3 | 4
  open: boolean
  savedOpenAiKeyState: SavedOpenAiKeyState | null
  sellerResearchProfile: SellerResearchProfile
  workspace: WorkspaceNavItem
  onBackToLogin: () => Promise<void> | void
  onComplete: (payload: {
    apiKey: string
    profile: SellerResearchProfile
    workspaceCurrency: CurrencyCode
    workspaceDescription: string
    workspaceIcon: WorkspaceIconId
    workspaceName: string
  }) => Promise<void>
  onOpenChange: (open: boolean) => void
  onStartImport: (mode: CsvImportType) => void
}) {
  const [workspaceName, setWorkspaceName] = React.useState(workspace.name)
  const [workspaceDescription, setWorkspaceDescription] = React.useState(workspace.description)
  const [workspaceCurrency, setWorkspaceCurrency] = React.useState<CurrencyCode>(workspace.defaultCurrency)
  const [workspaceIcon, setWorkspaceIcon] = React.useState<WorkspaceIconId>(normalizeWorkspaceIconId(workspace.workspaceIcon))
  const [sellerCompany, setSellerCompany] = React.useState(sellerResearchProfile.sellerCompany)
  const [sellerDomain, setSellerDomain] = React.useState(sellerResearchProfile.sellerDomain)
  const [productContext, setProductContext] = React.useState(sellerResearchProfile.productContext)
  const [apiKey, setApiKey] = React.useState("")
  const [productContextTouched, setProductContextTouched] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [statusMessage, setStatusMessage] = React.useState("")
  const [step, setStep] = React.useState<1 | 2 | 3 | 4>(1)
  const initializedWorkspaceIdRef = React.useRef<string | null>(null)
  const hasSavedOpenAiKey = Boolean(savedOpenAiKeyState)
  const hasWorkspaceDetails = workspaceName.trim().length > 0 && Boolean(workspaceCurrency)
  const hasCompanyContext =
    sellerCompany.trim().length > 0 &&
    normalizeSellerDomain(sellerDomain).length > 0 &&
    productContext.trim().length > 0
  const hasImportedAccounts = completedImportModes.includes("accounts")
  const hasImportedOpportunities = completedImportModes.includes("opportunities")
  const canUseOpenAi = hasSavedOpenAiKey || apiKey.trim().length > 0
  const canComplete =
    hasWorkspaceDetails &&
    hasCompanyContext &&
    canUseOpenAi
  const canContinue = step === 1 ? hasWorkspaceDetails : step === 2 ? hasCompanyContext : step === 3 ? canComplete : true
  const isNewWorkspaceSetup = workspace.id.startsWith("new-workspace-")
  const dialogTitle = isNewWorkspaceSetup ? "Set up workspace" : `Set up ${workspaceName.trim() || workspace.name}`
  const stepItems = [
    { id: 1, label: "Workspace" },
    { id: 2, label: "Company" },
    { id: 3, label: "OpenAI" },
    { id: 4, label: "Import" },
  ] as const
  const currentStepItem = stepItems.find((item) => item.id === step) ?? stepItems[0]

  React.useEffect(() => {
    if (!open) {
      initializedWorkspaceIdRef.current = null
      return
    }

    if (initializedWorkspaceIdRef.current === workspace.id) return
    initializedWorkspaceIdRef.current = workspace.id

    setStep(initialStep)
    setWorkspaceName(workspace.name)
    setWorkspaceDescription(workspace.description)
    setWorkspaceCurrency(workspace.defaultCurrency)
    setWorkspaceIcon(normalizeWorkspaceIconId(workspace.workspaceIcon))
    setSellerCompany(sellerResearchProfile.sellerCompany)
    setSellerDomain(sellerResearchProfile.sellerDomain)
    setProductContext(sellerResearchProfile.productContext)
    setProductContextTouched(false)
    setApiKey("")
    setStatusMessage("")
  }, [open, workspace.id])

  const handleDomainChange = (value: string) => {
    setSellerDomain(value)
    setStatusMessage("")

    const inferredProfile = inferSellerResearchProfile(value)
    setSellerCompany(inferredProfile.sellerCompany)

    if (!productContextTouched) {
      setProductContext(inferredProfile.productContext)
    }
  }

  const handleComplete = async (nextImportMode?: CsvImportType) => {
    if (!canComplete) return

    setIsSaving(true)
    setStatusMessage("")

    try {
      await onComplete({
        apiKey,
        workspaceName,
        workspaceDescription,
        workspaceCurrency,
        workspaceIcon,
        profile: {
          sellerCompany: sellerCompany.trim(),
          sellerDomain: normalizeSellerDomain(sellerDomain),
          productContext: productContext.trim(),
        },
      })
      if (nextImportMode) {
        onStartImport(nextImportMode)
      }
    } catch (caughtError: unknown) {
      setStatusMessage(
        getUserFacingErrorMessage(caughtError, "Workspace setup needs another save attempt.")
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(92svh,760px)] overflow-hidden max-sm:max-h-[calc(100svh-0.75rem)] max-sm:max-w-[calc(100%-0.75rem)] max-sm:[&_[data-slot=button]]:min-h-11 max-sm:[&_[data-slot=button]]:px-4 max-sm:[&_[data-slot=input]]:min-h-11 max-sm:[&_[data-slot=select-trigger]]:min-h-11 sm:max-w-xl"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-[#0f0f10] text-white">
            <AudioLinesIcon aria-hidden="true" className="size-5" />
          </div>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            Add the selling context and OpenAI connection SalesFrame uses for research, guidance, and post-call outputs. Live transcription runs through SalesFrame's Deepgram connection.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <p className="sr-only" aria-live="polite">
            Step {step} of {stepItems.length}: {currentStepItem.label}
          </p>
          <div className="grid min-w-0 grid-cols-4 gap-2" aria-hidden="true">
            {stepItems.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "h-1.5 rounded-full",
                  step >= item.id ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>

          {step === 1 ? (
          <div className="grid gap-3">
            <div>
              <p className="text-sm font-medium">Workspace details</p>
              <p className="text-sm text-muted-foreground">
                Name the workspace sellers will use for its accounts, opportunities, calls, and settings.
              </p>
            </div>
            <WorkspaceIconPicker
              value={workspaceIcon}
              onChange={(nextIcon) => {
                setWorkspaceIcon(nextIcon)
                setStatusMessage("")
              }}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="onboarding-workspace-name">Workspace name</Label>
                <Input
                  id="onboarding-workspace-name"
                  value={workspaceName}
                  placeholder="ANZ Enterprise"
                  onChange={(event) => {
                    setWorkspaceName(event.currentTarget.value)
                    setStatusMessage("")
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="onboarding-workspace-description">Description</Label>
                <Input
                  id="onboarding-workspace-description"
                  value={workspaceDescription}
                  placeholder="Seller workspace"
                  onChange={(event) => {
                    setWorkspaceDescription(event.currentTarget.value)
                    setStatusMessage("")
                  }}
                />
              </div>
              <CurrencySelect
                id="onboarding-workspace-currency"
                label="Default currency"
                value={workspaceCurrency}
                onChange={setWorkspaceCurrency}
              />
            </div>
          </div>
          ) : null}

          {step === 2 ? (
          <div className="grid gap-3">
            <div>
              <p className="text-sm font-medium">Company context</p>
              <p className="text-sm text-muted-foreground">
                This helps Seller Research and live questions connect the buyer's world to what you sell.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="onboarding-seller-domain">Your company domain</Label>
                <Input
                  id="onboarding-seller-domain"
                  value={sellerDomain}
                  placeholder="salesframe.ai"
                  onChange={(event) => handleDomainChange(event.currentTarget.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="onboarding-seller-company">Your company</Label>
                <Input
                  id="onboarding-seller-company"
                  value={sellerCompany}
                  placeholder="SalesFrame"
                  onChange={(event) => {
                    setSellerCompany(event.currentTarget.value)
                    setStatusMessage("")
                  }}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="onboarding-product-context">What you sell</Label>
              <Textarea
                id="onboarding-product-context"
                value={productContext}
                placeholder="Describe your product, service, and why customers buy it."
                rows={3}
                onChange={(event) => {
                  setProductContextTouched(true)
                  setProductContext(event.currentTarget.value)
                  setStatusMessage("")
                }}
              />
            </div>
          </div>
          ) : null}

          {step === 3 ? (
          <div className="grid gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium">OpenAI API key</p>
                  <p className="text-sm text-muted-foreground">
                    {hasSavedOpenAiKey
                    ? "Your workspace key is connected. SalesFrame uses it for notes, live guidance, research, and post-call outputs."
                    : "Add a workspace key so SalesFrame can create notes, live guidance, research, and post-call outputs."}
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
                  <ExternalLinkIcon />
                  OpenAI keys
                </a>
              </Button>
            </div>
            {hasSavedOpenAiKey && savedOpenAiKeyState ? (
              <div className="grid gap-2 rounded-lg bg-muted/50 p-3 text-sm md:grid-cols-3">
                <ContextRow label="Masked key" value={savedOpenAiKeyState.maskedKey} />
                <ContextRow label="Fingerprint" value={savedOpenAiKeyState.fingerprint} />
                <ContextRow label="Saved" value={formatSavedAt(savedOpenAiKeyState.savedAt)} />
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="onboarding-openai-key">
                {hasSavedOpenAiKey ? "Replace OpenAI API key" : "OpenAI API key (required)"}
              </Label>
              <Input
                id="onboarding-openai-key"
                type="password"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={apiKey}
                placeholder="sk-proj-..."
                aria-invalid={!hasSavedOpenAiKey && apiKey.trim().length === 0}
                onChange={(event) => {
                  setApiKey(event.currentTarget.value)
                  setStatusMessage("")
                }}
              />
              <p className="text-sm text-muted-foreground">
                {hasSavedOpenAiKey
                  ? "Leave blank to keep the encrypted key already connected, or paste a new key to replace it."
                  : "Your key is sent securely to SalesFrame and stored encrypted."}
              </p>
            </div>
          </div>
          ) : null}

          {step === 4 ? (
          <div className="grid gap-3">
            <div>
              <p className="text-sm font-medium">Import data</p>
              <p className="text-sm text-muted-foreground">
                Add customer accounts or opportunities now, or import from your Account page whenever the workspace needs more data.
              </p>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <Button
                variant="outline"
                className="h-auto justify-start gap-3 p-3 text-left"
                disabled={isSaving || !canComplete}
                onClick={() => void handleComplete("accounts")}
              >
                <Building2Icon className="size-4" />
                <span className="grid gap-0.5">
                  <span className="font-medium">Import accounts</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {hasImportedAccounts ? "Accounts imported. Upload another file if needed." : "Upload customer account records."}
                  </span>
                </span>
              </Button>
              <Button
                variant="outline"
                className="h-auto justify-start gap-3 p-3 text-left"
                disabled={isSaving || !canComplete}
                onClick={() => void handleComplete("opportunities")}
              >
                <TargetIcon className="size-4" />
                <span className="grid gap-0.5">
                  <span className="font-medium">Import opportunities</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {hasImportedOpportunities ? "Opportunities imported. Upload another file if needed." : "Upload pipeline rows for this workspace."}
                  </span>
                </span>
              </Button>
            </div>
            {completedImportModes.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                {completedImportModes
                  .map((mode) => (mode === "accounts" ? "Accounts" : "Opportunities"))
                  .join(" and ")} imported. You can import more data now or finish setup.
              </p>
            ) : null}
          </div>
          ) : null}

          {statusMessage ? (
            <p className="text-sm text-destructive" aria-live="assertive" role="alert">
              {statusMessage}
            </p>
          ) : null}
        </div>

        <DialogActions
          cancelDisabled={isSaving}
          cancelLabel={backActionLabel}
          onCancel={() => void onBackToLogin()}
          primaryAction={
            step < 4 ? (
              <Button
                className="gap-2"
                disabled={!canContinue || isSaving}
                onClick={() => setStep((currentStep) => (currentStep === 1 ? 2 : currentStep === 2 ? 3 : 4))}
              >
                Next
                <ArrowRightIcon />
              </Button>
            ) : (
              <Button className="gap-2" disabled={!canComplete || isSaving} onClick={() => void handleComplete()}>
                <CheckCircle2Icon />
                {isSaving ? "Saving..." : "Finish setup"}
              </Button>
            )
          }
        >
          {step > 1 ? (
            <Button
              variant="outline"
              disabled={isSaving}
              onClick={() => setStep((currentStep) => (currentStep === 4 ? 3 : currentStep === 3 ? 2 : 1))}
            >
              Back
            </Button>
          ) : null}
        </DialogActions>
      </DialogContent>
    </Dialog>
  )
}

function AppHeader({
  account,
  accountDrafts,
  accounts,
  activeView,
  calls,
  darkMode,
  isRecording,
  opportunity,
  opportunityDrafts,
  opportunities,
  transcriptsByCallId,
  onAccountSelect,
  onCallSelect,
  onDarkModeChange,
  onNavigate,
  onOpportunitySelect,
}: {
  account: AccountNavItem
  accountDrafts: Record<string, AccountDraft>
  accounts: AccountNavItem[]
  activeView: string
  calls: CallSummary[]
  darkMode: boolean
  isRecording: boolean
  opportunity: Opportunity
  opportunityDrafts: Record<string, OpportunityDraft>
  opportunities: Opportunity[]
  transcriptsByCallId: Record<string, Opportunity["transcript"]>
  onAccountSelect: (id: string) => void
  onCallSelect: (id: string) => void
  onDarkModeChange: (value: boolean) => void
  onNavigate: (value: string) => void
  onOpportunitySelect: (id: string) => void
}) {
  const breadcrumbItems = getHeaderBreadcrumbItems({
    account,
    activeView,
    onAccountSelect,
    onNavigate,
    onOpportunitySelect,
    opportunity,
  })

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 px-4 md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap overflow-hidden">
          {breadcrumbItems.map((item, index) => {
            const isCurrent = index === breadcrumbItems.length - 1
            const isFirst = index === 0
            const isVisibleOnMobile = isFirst || isCurrent

            return (
              <React.Fragment key={`${item.label}-${index}`}>
                {index > 0 ? (
                  <BreadcrumbSeparator className={cn("hidden sm:flex", isCurrent && "flex")} />
                ) : null}
                <BreadcrumbItem className={cn("min-w-0", !isVisibleOnMobile && "hidden sm:inline-flex")}>
                  {isCurrent || !item.onSelect ? (
                    <BreadcrumbPage className="max-w-[11rem] truncate sm:max-w-[15rem]">
                      {item.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      className="max-w-[11rem] cursor-pointer truncate sm:max-w-[15rem]"
                      onClick={item.onSelect}
                    >
                      {item.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-2">
        <GlobalSearch
          accountDrafts={accountDrafts}
          accounts={accounts}
          calls={calls}
          opportunityDrafts={opportunityDrafts}
          opportunities={opportunities}
          transcriptsByCallId={transcriptsByCallId}
          onAccountSelect={onAccountSelect}
          onCallSelect={onCallSelect}
          onNavigate={onNavigate}
          onOpportunitySelect={onOpportunitySelect}
        />
        {isRecording ? (
          <Button
            variant="outline"
            size="sm"
            className="hidden h-8 gap-1.5 md:inline-flex"
            onClick={() => onNavigate("workspace")}
          >
            <RadioIcon className="size-3" />
            Active call
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          className="size-11 md:size-8"
          aria-label="Toggle theme"
          onClick={() => onDarkModeChange(!darkMode)}
        >
          {darkMode ? <SunIcon /> : <MoonIcon />}
        </Button>
      </div>
    </header>
  )
}

function getHeaderBreadcrumbItems({
  account,
  activeView,
  onAccountSelect,
  onNavigate,
  onOpportunitySelect,
  opportunity,
}: {
  account: AccountNavItem
  activeView: string
  onAccountSelect: (id: string) => void
  onNavigate: (value: string) => void
  onOpportunitySelect: (id: string) => void
  opportunity: Opportunity
}): HeaderBreadcrumbItem[] {
  if (activeView === "home") {
    return [{ label: "Home" }]
  }

  const pageLabel = viewLabels[activeView] ?? "Home"
  const homeCrumb = { label: "Home", onSelect: () => onNavigate("home") }
  const accountCrumb = {
    label: account.name,
    onSelect: () => onAccountSelect(account.id),
  }
  const opportunityCrumb = {
    label: opportunity.name,
    onSelect: () => onOpportunitySelect(opportunity.id),
  }

  if (activeView === "account-detail") {
    return [homeCrumb, { label: account.name }]
  }

  if (breadcrumbOpportunityViews.includes(activeView)) {
    if (activeView === "opportunity-record") {
      return [homeCrumb, accountCrumb, { label: opportunity.name }]
    }

    return [homeCrumb, accountCrumb, opportunityCrumb, { label: pageLabel }]
  }

  if (breadcrumbCallViews.includes(activeView)) {
    return [homeCrumb, accountCrumb, opportunityCrumb, { label: pageLabel }]
  }

  if (breadcrumbLibraryViews.includes(activeView)) {
    return [homeCrumb, { label: pageLabel }]
  }

  if (activeView === "playbooks") {
    return [homeCrumb, { label: pageLabel }]
  }

  if (breadcrumbPlaybookDetailViews.includes(activeView)) {
    return [homeCrumb, { label: "Playbooks", onSelect: () => onNavigate("playbooks") }, { label: pageLabel }]
  }

  if (activeView === "settings") {
    return [homeCrumb, { label: pageLabel }]
  }

  if (breadcrumbSettingsDetailViews.includes(activeView)) {
    return [homeCrumb, { label: "Settings", onSelect: () => onNavigate("settings") }, { label: pageLabel }]
  }

  if (activeView === "profile-account") {
    return [homeCrumb, { label: "Account" }]
  }

  return [homeCrumb, { label: pageLabel }]
}

function GlobalSearch({
  accountDrafts,
  accounts,
  calls,
  opportunityDrafts,
  opportunities,
  transcriptsByCallId,
  onAccountSelect,
  onCallSelect,
  onNavigate,
  onOpportunitySelect,
}: {
  accountDrafts: Record<string, AccountDraft>
  accounts: AccountNavItem[]
  calls: CallSummary[]
  opportunityDrafts: Record<string, OpportunityDraft>
  opportunities: Opportunity[]
  transcriptsByCallId: Record<string, Opportunity["transcript"]>
  onAccountSelect: (id: string) => void
  onCallSelect: (id: string) => void
  onNavigate: (value: string) => void
  onOpportunitySelect: (id: string) => void
}) {
  const [query, setQuery] = React.useState("")
  const [focused, setFocused] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const accountById = React.useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts])
  const opportunityById = React.useMemo(
    () => new Map(opportunities.map((opportunity) => [opportunity.id, opportunity])),
    [opportunities]
  )

  const results = React.useMemo(() => {
    const entries = [
      ...accounts.map((account) => ({
        id: account.id,
        type: "Account",
        label: account.name,
        meta: account.description,
        icon: account.icon,
        searchText: getAccountSearchText(account, accountDrafts[account.id]),
        onSelect: () => onAccountSelect(account.id),
      })),
      ...opportunities.map((item) => {
        const account = accountById.get(item.accountId)

        return {
          id: item.id,
          type: "Opportunity",
          label: item.name,
          meta: `${account?.name ?? "No account linked"} / ${item.stage} / ${item.coverage}% covered`,
          icon: <TargetIcon />,
          searchText: getOpportunitySearchText(item, account, opportunityDrafts[item.id]),
          onSelect: () => onOpportunitySelect(item.id),
        }
      }),
      ...calls.map((call) => {
        const item = opportunityById.get(call.opportunityId)
        const account = item ? accountById.get(item.accountId) : undefined

        return {
          id: call.id,
          type: "Call",
          label: call.title,
          meta: `${account?.name ?? "No account linked"} / ${item?.name ?? "No opportunity linked"} / ${call.status}`,
          icon: <FileAudioIcon />,
          searchText: getCallSearchText({
            account,
            call,
            opportunity: item,
            opportunityDraft: item ? opportunityDrafts[item.id] : undefined,
            transcript: transcriptsByCallId[call.id] ?? item?.transcript ?? [],
          }),
          onSelect: () => onCallSelect(call.id),
        }
      }),
      ...playbooks.map((playbook) => ({
        id: playbook.id,
        type: "Playbook",
        label: playbook.name,
        meta: playbook.description,
        icon: <BookOpenCheckIcon />,
        searchText: [
          playbook.name,
          playbook.description,
          playbook.bestFor,
          playbook.evidenceStandard,
          playbook.liveGuidance,
          ...playbook.fields.flatMap(([field, detail]) => [field, detail]),
          ...playbook.exitCriteria,
        ].join(" "),
        onSelect: () => onNavigate(playbook.id),
      })),
    ]

    return getFuzzyMatches(entries, query, (entry) => entry.searchText).slice(0, 8)
  }, [
    accountById,
    accountDrafts,
    accounts,
    calls,
    onAccountSelect,
    onCallSelect,
    onNavigate,
    onOpportunitySelect,
    opportunities,
    opportunityById,
    opportunityDrafts,
    query,
    transcriptsByCallId,
  ])

  const showResults = focused && normalizeSearchText(query).length > 0

  const handleSelect = (selectResult: (typeof results)[number]) => {
    selectResult.onSelect()
    setQuery("")
    setFocused(false)
    setMobileOpen(false)
  }

  const renderResults = (mode: "desktop" | "mobile") => {
    const hasQuery = normalizeSearchText(query).length > 0

    if (!hasQuery) {
      return (
        <div className="grid grid-cols-[28px_1fr] items-start gap-3 rounded-md px-2 py-3">
          <span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <SearchIcon className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">Search the workspace</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
              Try an account, opportunity, call, or playbook name.
            </span>
          </span>
        </div>
      )
    }

    if (!results.length) {
      return (
        <div className="grid grid-cols-[28px_1fr] items-start gap-3 rounded-md px-2 py-3">
          <span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <SearchIcon className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">Nothing matches that search</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
              Try an account, opportunity, call, or playbook name.
            </span>
          </span>
        </div>
      )
    }

    return results.map((result) => (
      <button
        key={`${mode}-${result.type}-${result.id}`}
        type="button"
        className="grid grid-cols-[28px_1fr_auto] items-center gap-3 rounded-md px-2 py-2 text-left transition-[background-color,color,box-shadow,opacity] duration-150 hover:bg-accent"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => handleSelect(result)}
      >
        <span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-4">
          {result.icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{result.label}</span>
          <span className="block truncate text-xs text-muted-foreground">{result.meta}</span>
        </span>
        <span className="text-xs text-muted-foreground">{result.type}</span>
      </button>
    ))
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="size-11 lg:hidden"
        aria-label="Search workspace"
        onClick={() => setMobileOpen(true)}
      >
        <SearchIcon />
      </Button>
      <div className="relative hidden w-72 lg:block">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search workspace"
          value={query}
          className="h-8 pl-9"
          placeholder="Search workspace"
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          onChange={(event) => {
            setQuery(event.currentTarget.value)
            setFocused(true)
          }}
          onFocus={() => setFocused(true)}
        />
        {showResults ? (
          <div className="absolute right-0 z-40 mt-2 grid w-[420px] max-w-[calc(100vw-2rem)] gap-1 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
            {renderResults("desktop")}
          </div>
        ) : null}
      </div>
      <Dialog
        open={mobileOpen}
        onOpenChange={(open) => {
          setMobileOpen(open)
          setFocused(open)
          if (!open) setQuery("")
        }}
      >
        <DialogContent
          dismissible
          className="grid max-h-[calc(100svh-1rem)] overflow-hidden max-sm:max-w-[calc(100%-0.75rem)] max-sm:[&_[data-slot=button]]:min-h-11 max-sm:[&_[data-slot=input]]:min-h-11 sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle>Search workspace</DialogTitle>
            <DialogDescription>Find accounts, opportunities, calls, and playbooks.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              aria-label="Search workspace"
              value={query}
              className="h-11 pl-9"
              placeholder="Search workspace"
              onChange={(event) => {
                setQuery(event.currentTarget.value)
                setFocused(true)
              }}
            />
          </div>
          <div className="grid max-h-[min(24rem,calc(100svh-14rem))] gap-1 overflow-y-auto overscroll-contain rounded-lg bg-muted/30 p-1">
            {renderResults("mobile")}
          </div>
          <DialogActions
            cancelAction={
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
            }
            primaryAction={null}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CommandBar({
  account,
  callType,
  durationLimitSeconds,
  elapsed,
  isRecording,
  isStopping,
  opportunity,
  opportunityDraft,
  startCallAction,
  onCallTypeChange,
  onRecordingChange,
  onViewChange,
}: {
  account: AccountNavItem
  callType: string
  durationLimitSeconds: number
  elapsed: number
  isRecording: boolean
  isStopping: boolean
  opportunity: Opportunity
  opportunityDraft: OpportunityDraft
  startCallAction?: React.ReactNode
  onCallTypeChange: (value: string) => void
  onRecordingChange: (value: boolean) => void
  onViewChange: (value: string) => void
}) {
  const limitNotice = isRecording ? getLiveCallLimitNotice(elapsed, durationLimitSeconds) : ""
  const isFinalLimitNotice = getLiveCallRemainingSeconds(elapsed, durationLimitSeconds) <= LIVE_CALL_FINAL_WARNING_SECONDS

  return (
    <div className="grid gap-3 rounded-lg bg-muted/30 px-3 py-2 lg:grid-cols-[1fr_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm text-muted-foreground">{account.name}</span>
          <span className="text-sm text-muted-foreground">/</span>
          <span className="truncate text-sm font-medium">{opportunity.name}</span>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[580px] lg:grid-cols-4">
        <Select value={callType} onValueChange={onCallTypeChange}>
          <SelectTrigger className="h-9 w-full" aria-label="Call type">
            <SelectValue placeholder="Call type" />
          </SelectTrigger>
          <SelectContent>
            {["Discovery", "Cold", "Inbound", "Outbound", "Demo", "Renewal", "Negotiation"].map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <CallPrepDialog opportunity={opportunity} opportunityDraft={opportunityDraft} onViewChange={onViewChange} />
        <div className="grid min-w-0 gap-1">
          <div
            className="inline-flex h-8 min-w-0 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-sm font-medium text-muted-foreground"
            aria-label={`Elapsed call time ${formatTime(elapsed)}`}
          >
            <Clock3Icon className="size-4" />
            <span>{formatTime(elapsed)}</span>
          </div>
          {limitNotice ? (
            <p className={cn(
              "px-1 text-xs font-medium",
              isFinalLimitNotice ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"
            )}>
              {limitNotice}
            </p>
          ) : null}
        </div>
        {isRecording ? (
          <Button
            className="gap-2"
            disabled={isStopping}
            variant="destructive"
            onClick={() => onRecordingChange(false)}
          >
            <SquareIcon />
            {isStopping ? "Stopping call" : "Stop call"}
          </Button>
        ) : startCallAction ? (
          <div className="[&_[data-slot=button]]:w-full [&_[data-slot=button]]:justify-start">
            {startCallAction}
          </div>
        ) : null}
      </div>
    </div>
  )
}

type CallPrepBriefItem = {
  detail: string
  status: "ready" | "needs-evidence"
  title: string
}

function buildCallPrepBriefItems(opportunity: Opportunity, opportunityDraft: OpportunityDraft): CallPrepBriefItem[] {
  const methodologyDebt = opportunity.missing + opportunity.weak
  const selectedPlaybooks = formatPlaybooks(parsePlaybookSelection(opportunityDraft.frameworks))

  return [
    {
      title: "Known pain",
      detail: opportunityDraft.pain.trim()
        ? opportunityDraft.pain.trim()
        : "Capture the customer-stated problem before moving into deeper methodology questions.",
      status: opportunityDraft.pain.trim() ? "ready" : "needs-evidence",
    },
    {
      title: "Decision path",
      detail: opportunityDraft.decisionProcess.trim()
        ? opportunityDraft.decisionProcess.trim()
        : "Listen for who is involved, how the decision happens, and what could slow it down.",
      status: opportunityDraft.decisionProcess.trim() ? "ready" : "needs-evidence",
    },
    {
      title: "Next step",
      detail: opportunityDraft.nextStep.trim()
        ? opportunityDraft.nextStep.trim()
        : "Leave the call with a clear owner, action, and timing for the next move.",
      status: opportunityDraft.nextStep.trim() ? "ready" : "needs-evidence",
    },
    {
      title: "Selected playbooks",
      detail: methodologyDebt > 0
        ? `${selectedPlaybooks} has ${methodologyDebt} field${methodologyDebt === 1 ? "" : "s"} that still need stronger evidence.`
        : `${selectedPlaybooks} is currently fully covered for this opportunity.`,
      status: methodologyDebt > 0 ? "needs-evidence" : "ready",
    },
  ]
}

function CallPrepDialog({
  opportunity,
  opportunityDraft,
  onViewChange,
}: {
  opportunity: Opportunity
  opportunityDraft: OpportunityDraft
  onViewChange: (value: string) => void
}) {
  const prepItems = buildCallPrepBriefItems(opportunity, opportunityDraft)
  const suggestedOpening = opportunity.nextCallBrief?.opening.trim()

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="justify-start gap-2">
          <ClipboardCheckIcon />
          Prep brief
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[calc(100svh-2rem)] overflow-y-auto max-sm:max-h-[calc(100svh-0.75rem)] max-sm:max-w-[calc(100%-0.75rem)] max-sm:[&_[data-slot=button]]:min-h-11 max-sm:[&_[data-slot=button]]:px-4 sm:max-w-2xl"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Call prep brief</DialogTitle>
          <DialogDescription>
            Keep this compact before the call. Detailed methodology stays in the Opportunity tab.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {prepItems.map((item) => (
            <div key={item.title} className="grid grid-cols-[32px_1fr] gap-3 rounded-lg bg-muted/35 p-3">
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg",
                  item.status === "ready" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                )}
              >
                {item.status === "ready" ? <CheckIcon className="size-4" /> : <CircleAlertIcon className="size-4" />}
              </div>
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
              </div>
            </div>
          ))}
          <div className="rounded-lg bg-muted/35 p-3">
            <p className="text-sm font-medium">
              {suggestedOpening ? "Suggested opening from next-call brief" : "First live question"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {suggestedOpening ||
                "Start the call when ready. SalesFrame will generate the opener from the account context, opportunity record, call type, selected playbooks, and previous evidence before recording begins."}
            </p>
          </div>
        </div>
        <DialogActions
          cancelAction={
            <DialogClose asChild>
              <Button variant="outline">
                Cancel
              </Button>
            </DialogClose>
          }
          primaryAction={
            <DialogClose asChild>
              <Button onClick={() => onViewChange("methodology")}>
                Open methodology
              </Button>
            </DialogClose>
          }
        />
      </DialogContent>
    </Dialog>
  )
}

type StartCallPreparationStep = {
  description: string
  icon: React.ElementType
  id: StartCallPreparationStepId
  label: string
  progress: number
}

function StartCallPreparingView({
  activeIndex,
  detail,
  progress,
  steps,
}: {
  activeIndex: number
  detail?: string
  progress: number
  steps: StartCallPreparationStep[]
}) {
  const activeStep = steps[Math.min(activeIndex, steps.length - 1)] ?? steps[0]
  const currentDescription = detail || activeStep?.description || "Preparing the call workspace."
  const ActiveIcon = activeStep?.icon ?? SparklesIcon

  return (
    <div className="grid min-w-0 gap-4 py-1">
      <div className="flex min-w-0 items-center gap-2">
        <SparklesIcon className="size-4 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Preparing</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            SalesFrame is getting the transcript and first question ready before the cockpit opens.
          </p>
        </div>
      </div>

      <div className="grid min-w-0 gap-3">
        <div className="grid min-w-0 gap-2 rounded-lg bg-muted/40 p-3" aria-live="polite">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-background text-primary">
                <ActiveIcon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{activeStep?.label ?? "Preparing call"}</p>
                <p className="text-xs text-muted-foreground">
                  Step {Math.min(activeIndex + 1, steps.length)} of {steps.length}
                </p>
              </div>
            </div>
            <p className="shrink-0 text-sm tabular-nums text-muted-foreground">{Math.round(progress)}%</p>
          </div>
          <Progress
            aria-label="Start call preparation progress"
            aria-valuetext={`${Math.round(progress)}% complete. ${
              activeStep?.label ?? "Preparing call"
            }.`}
            className="h-2"
            value={progress}
          />
          <p className="text-sm leading-relaxed text-muted-foreground">{currentDescription}</p>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Nothing is recording yet. If this step needs another try, the draft call is cleaned up and you can start again.
        </p>
      </div>
    </div>
  )
}

type AudioSetupStatus = "idle" | "checking" | "listening" | "quiet" | "blocked" | "unsupported"

function useMediaStreamLevel(stream: MediaStream | null) {
  const [level, setLevel] = React.useState(0)

  React.useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) {
      setLevel(0)
      return
    }

    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

    if (!AudioContextCtor) {
      setLevel(0)
      return
    }

    let active = true
    let audioContext: AudioContext | null = null
    let animationFrameId = 0

    const startMeter = async () => {
      audioContext = new AudioContextCtor()
      if (audioContext.state === "suspended") {
        await audioContext.resume().catch(() => undefined)
      }
      if (!active || !audioContext) return

      const sourceNode = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 1024
      const samples = new Uint8Array(analyser.fftSize)

      sourceNode.connect(analyser)

      const tick = () => {
        if (!active) return

        analyser.getByteTimeDomainData(samples)
        const nextLevel = calculateAudioRms(samples)
        setLevel((previousLevel) => Number(smoothAudioMeterLevel(nextLevel, previousLevel).toFixed(4)))
        animationFrameId = window.requestAnimationFrame(tick)
      }

      tick()
    }

    void startMeter()

    return () => {
      active = false
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId)
      void audioContext?.close().catch(() => undefined)
    }
  }, [stream])

  return level
}

function AudioSetupMeter({
  detail,
  label,
  level,
  status,
}: {
  detail: string
  label: string
  level: number
  status: AudioSetupStatus
}) {
  const meterValue = calculateAudioMeterPercent(level)
  const isBlocked = status === "blocked" || status === "unsupported"

  return (
    <div className="grid min-w-0 gap-1.5">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        <span className="sr-only">{status}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-[width,background-color] duration-100 ease-out",
            isBlocked ? "bg-destructive" : status === "idle" || status === "checking" ? "bg-muted-foreground/30" : "bg-foreground"
          )}
          aria-hidden="true"
          style={{ width: `${meterValue}%` }}
        />
      </div>
      <p className="truncate text-xs text-muted-foreground" title={`${detail} · input level ${meterValue}%`}>
        {detail}
      </p>
    </div>
  )
}

function getAudioSetupStatus({
  error,
  isChecking,
  level,
  stream,
  unsupported,
}: {
  error?: string
  isChecking: boolean
  level: number
  stream: MediaStream | null
  unsupported?: boolean
}): AudioSetupStatus {
  if (unsupported) return "unsupported"
  if (error) return "blocked"
  if (isChecking) return "checking"
  if (!stream) return "idle"

  return level >= 0.018 ? "listening" : "quiet"
}

function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

function getAudioDeviceDisplayName(deviceId: string, devices: AudioDeviceOption[], fallback: string) {
  const device = devices.find((item) => item.deviceId === deviceId)

  return device?.label || fallback
}

function StartRecordingDialog({
  accounts,
  accountResearchById,
  defaultCurrency = defaultCurrencyCode,
  defaultAccountId,
  defaultOpportunityId,
  opportunityDrafts,
  opportunities,
  savedOpenAiKeyState,
  sellerResearchProfile,
  workspaceId,
  onOpenSettings,
  onStartRecording,
  triggerIcon = <Mic2Icon />,
  triggerLabel = "Start call",
  triggerVariant = "destructive",
}: {
  accounts: AccountNavItem[]
  accountResearchById: Record<string, CustomerResearchConfig>
  defaultCurrency?: CurrencyCode
  defaultAccountId?: string
  defaultOpportunityId?: string
  opportunityDrafts: Record<string, OpportunityDraft>
  opportunities: Opportunity[]
  savedOpenAiKeyState: SavedOpenAiKeyState | null
  sellerResearchProfile: SellerResearchProfile
  workspaceId: string
  onOpenSettings?: () => void
  onStartRecording: StartRecordingHandler
  triggerIcon?: React.ReactNode
  triggerLabel?: string
  triggerVariant?: React.ComponentProps<typeof Button>["variant"]
}) {
  const isMobile = useIsMobile()
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState<1 | 2 | 3 | 4>(1)
  const [accountMode, setAccountMode] = React.useState<"existing" | "new">("existing")
  const initialAccountId =
    defaultAccountId && accounts.some((account) => account.id === defaultAccountId)
      ? defaultAccountId
      : accounts[0]?.id ?? ""
  const initialOpportunityId =
    defaultOpportunityId &&
    opportunities.some((opportunity) => opportunity.id === defaultOpportunityId && opportunity.accountId === initialAccountId)
      ? defaultOpportunityId
      : opportunities.find((opportunity) => opportunity.accountId === initialAccountId)?.id ?? ""
  const [accountId, setAccountId] = React.useState(initialAccountId)
  const [accountName, setAccountName] = React.useState("")
  const [accountWebsite, setAccountWebsite] = React.useState("")
  const [accountIndustry, setAccountIndustry] = React.useState("")
  const [accountCurrency, setAccountCurrency] = React.useState<CurrencyCode>(
    accounts.find((account) => account.id === initialAccountId)?.currency ?? defaultCurrency
  )
  const [opportunityMode, setOpportunityMode] = React.useState<"existing" | "new">("existing")
  const [opportunityId, setOpportunityId] = React.useState(initialOpportunityId)
  const [opportunityName, setOpportunityName] = React.useState("")
  const [callType, setCallType] = React.useState("Discovery")
  const [capturePreferences, setCapturePreferences] = React.useState<CaptureSettings>(() => readCaptureSettings(workspaceId))
  const [audioCaptureMode, setAudioCaptureMode] = React.useState<CallAudioCaptureMode>(() =>
    getPreferredAudioCaptureMode(readCaptureSettings(workspaceId))
  )
  const [selectedPlaybooks, setSelectedPlaybooks] = React.useState<CallPlaybook[]>(() =>
    parsePlaybookSelection(opportunityDrafts[opportunityId]?.frameworks)
  )
  const [customerResearchEnabled, setCustomerResearchEnabled] = React.useState(false)
  const [sellerCompany, setSellerCompany] = React.useState(sellerResearchProfile.sellerCompany)
  const [sellerDomain, setSellerDomain] = React.useState(sellerResearchProfile.sellerDomain)
  const [productContext, setProductContext] = React.useState(sellerResearchProfile.productContext)
  const [startError, setStartError] = React.useState("")
  const [startSubmitting, setStartSubmitting] = React.useState(false)
  const [startProgress, setStartProgress] = React.useState(0)
  const [startPhaseIndex, setStartPhaseIndex] = React.useState(0)
  const [startPreparationDetail, setStartPreparationDetail] = React.useState("")
  const [researchProfileMessage, setResearchProfileMessage] = React.useState("")
  const [researchProfileStatus, setResearchProfileStatus] =
    React.useState<"idle" | "loading" | "success" | "error">("idle")
  const [customerContact, setCustomerContact] = React.useState("")
  const [customerRole, setCustomerRole] = React.useState("")
  const [audioInputDevices, setAudioInputDevices] = React.useState<AudioDeviceOption[]>([])
  const [selectedAudioInputDeviceId, setSelectedAudioInputDeviceId] = React.useState(() =>
    readPreferredAudioInputDeviceId(workspaceId)
  )
  const [microphonePreviewStream, setMicrophonePreviewStream] = React.useState<MediaStream | null>(null)
  const [microphonePreviewError, setMicrophonePreviewError] = React.useState("")
  const [microphonePreviewChecking, setMicrophonePreviewChecking] = React.useState(false)
  const [meetingAudioPreviewStream, setMeetingAudioPreviewStream] = React.useState<MediaStream | null>(null)
  const [meetingAudioPreviewError, setMeetingAudioPreviewError] = React.useState("")
  const [meetingAudioSurface, setMeetingAudioSurface] = React.useState<string | undefined>()
  const [meetingAudioSelecting, setMeetingAudioSelecting] = React.useState(false)
  const sellerDomainLookupSequenceRef = React.useRef(0)
  const sellerDomainLookupTimeoutRef = React.useRef<number | null>(null)
  const startProgressTimerRef = React.useRef<number | null>(null)
  const startProgressTargetRef = React.useRef(0)
  const startAbortControllerRef = React.useRef<AbortController | null>(null)
  const microphonePreviewStreamRef = React.useRef<MediaStream | null>(null)
  const meetingAudioPreviewStreamRef = React.useRef<MediaStream | null>(null)

  const selectedAccount = accounts.find((account) => account.id === accountId)
  const selectedOpportunity = opportunities.find((opportunity) => opportunity.id === opportunityId)
  const accountOpportunities = opportunities.filter((opportunity) => opportunity.accountId === accountId)
  const canUseExistingOpportunity = accountMode === "existing" && accountOpportunities.length > 0
  const canContinueAccount = accountMode === "new" ? accountName.trim().length > 0 : Boolean(accountId)
  const canContinueOpportunity =
    accountMode === "new" || opportunityMode === "new"
      ? opportunityName.trim().length > 0
      : Boolean(opportunityId)
  const canContinueCall = Boolean(callType) && selectedPlaybooks.length > 0
  const canUseResearch =
    !customerResearchEnabled ||
    (sellerCompany.trim().length > 0 && sellerDomain.trim().length > 0 && productContext.trim().length > 0)
  const hasSavedOpenAiKey = Boolean(savedOpenAiKeyState)
  const canUseOpenAi = hasSavedOpenAiKey
  const canStart = canContinueAccount && canContinueOpportunity && canContinueCall && canUseResearch && canUseOpenAi
  const canContinue = step === 1 ? canContinueAccount : step === 2 ? canContinueOpportunity : canContinueCall
  const selectedAudioSourceChoice = getAudioSourceChoice(audioCaptureMode)
  const microphonePreviewLevel = useMediaStreamLevel(microphonePreviewStream)
  const meetingAudioPreviewLevel = useMediaStreamLevel(meetingAudioPreviewStream)
  const selectedAudioInputLabel = getAudioDeviceDisplayName(
    selectedAudioInputDeviceId,
    audioInputDevices,
    "Default microphone"
  )
  const microphoneSetupStatus = getAudioSetupStatus({
    error: microphonePreviewError,
    isChecking: microphonePreviewChecking,
    level: microphonePreviewLevel,
    stream: microphonePreviewStream,
    unsupported: typeof navigator !== "undefined" && !navigator.mediaDevices?.getUserMedia,
  })
  const sharedAudioSetupStatus = getAudioSetupStatus({
    error: meetingAudioPreviewError,
    isChecking: meetingAudioSelecting,
    level: meetingAudioPreviewLevel,
    stream: meetingAudioPreviewStream,
    unsupported: typeof navigator !== "undefined" && !navigator.mediaDevices?.getDisplayMedia,
  })
  const sharedAudioBrowserGuidance = getSharedAudioBrowserGuidance()
  const accountSummary =
    accountMode === "new" ? accountName.trim() || "New account" : selectedAccount?.name ?? "Selected account"
  const opportunitySummary =
    accountMode === "new" || opportunityMode === "new"
      ? opportunityName.trim() || "New opportunity"
      : selectedOpportunity?.name ?? "Selected opportunity"
  const recordingSteps: { label: string; icon: React.ElementType }[] = [
    { label: "Account", icon: Building2Icon },
    { label: "Opportunity", icon: TargetIcon },
    { label: "Call", icon: PhoneCallIcon },
    { label: "Seller Research", icon: SearchIcon },
  ]
  const preparationStepItem = { label: "Preparing", icon: SparklesIcon }
  const currentRecordingStepLabel = recordingSteps[step - 1]?.label ?? recordingSteps[0].label
  const canNavigateToRecordingStep = (targetStep: 1 | 2 | 3 | 4) => {
    if (targetStep === 1) return true
    if (targetStep === 2) return canContinueAccount
    if (targetStep === 3) return canContinueAccount && canContinueOpportunity
    return canContinueAccount && canContinueOpportunity && canContinueCall
  }
  const startPreparationSteps: StartCallPreparationStep[] = [
    {
      id: "ai_access",
      label: "Checking your AI key",
      description: "SalesFrame is making sure the workspace can ask OpenAI for a real recommendation.",
      icon: KeyRoundIcon,
      progress: 16,
    },
    {
      id: "transcription",
      label: "Checking live transcript",
      description: "SalesFrame is making sure Deepgram is ready before audio capture begins.",
      icon: Mic2Icon,
      progress: 30,
    },
    {
      id: "records",
      label: "Putting this call in the right place",
      description: "We are linking the account, opportunity, playbooks, and call record.",
      icon: DatabaseIcon,
      progress: 44,
    },
    {
      id: "context",
      label: customerResearchEnabled ? "Adding seller research context" : "Reading what SalesFrame already knows",
      description: customerResearchEnabled
        ? "Your seller research and account context are being folded into the first question."
        : "SalesFrame is checking the saved account, opportunity, and evidence so it does not ask twice.",
      icon: SearchIcon,
      progress: 58,
    },
    {
      id: "coach",
      label: "Writing your first live question",
      description: "SalesFrame is choosing a question that fits the call, not just the next empty field.",
      icon: SparklesIcon,
      progress: 78,
    },
    {
      id: "audio",
      label: "Getting ready to listen",
      description:
        audioCaptureMode === "meeting_audio"
          ? "Next up: two-channel capture with your mic plus buyer-side app, tab, or system audio."
          : "Next up: one-channel capture through this device microphone.",
      icon: Mic2Icon,
      progress: 94,
    },
  ]

  const refreshAudioDevices = React.useCallback(async () => {
    try {
      const inventory = await enumerateAudioDevices()
      const preferredInputDeviceId = getPreferredAudioInputDeviceId(selectedAudioInputDeviceId, inventory.audioInputs)

      setAudioInputDevices(inventory.audioInputs)

      if (preferredInputDeviceId !== selectedAudioInputDeviceId) {
        setSelectedAudioInputDeviceId(preferredInputDeviceId)
      }
    } catch {
      setAudioInputDevices([])
    }
  }, [selectedAudioInputDeviceId])

  const clearMicrophonePreview = React.useCallback(() => {
    stopMediaStream(microphonePreviewStreamRef.current)
    microphonePreviewStreamRef.current = null
    setMicrophonePreviewStream(null)
    setMicrophonePreviewChecking(false)
  }, [])

  const clearMeetingAudioPreview = React.useCallback((options: { stop?: boolean } = {}) => {
    if (options.stop ?? true) {
      stopMediaStream(meetingAudioPreviewStreamRef.current)
    }
    meetingAudioPreviewStreamRef.current = null
    setMeetingAudioPreviewStream(null)
    setMeetingAudioSurface(undefined)
    setMeetingAudioSelecting(false)
  }, [])

  const handleAudioInputDeviceChange = (deviceId: string) => {
    setSelectedAudioInputDeviceId(deviceId)
    writePreferredAudioInputDeviceId(workspaceId, deviceId)
    setMicrophonePreviewError("")
  }

  const handleChooseMeetingAudio = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setMeetingAudioPreviewError(getSharedAudioUnsupportedMessage())
      return
    }

    setMeetingAudioSelecting(true)
    setMeetingAudioPreviewError("")

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia(getMeetingAudioDisplayOptions())
      const surface = stream.getVideoTracks()[0]?.getSettings?.().displaySurface

      if (stream.getAudioTracks().length === 0) {
        stopMediaStream(stream)
        setMeetingAudioPreviewError(getSharedAudioNoTrackMessage())
        return
      }

      clearMeetingAudioPreview()
      meetingAudioPreviewStreamRef.current = stream
      setMeetingAudioPreviewStream(stream)
      setMeetingAudioSurface(surface)
    } catch (error: unknown) {
      setMeetingAudioPreviewError(
        getUserFacingErrorMessage(error, "Shared audio needs another connection attempt. Try the browser picker again.")
      )
    } finally {
      setMeetingAudioSelecting(false)
    }
  }

  const applyResearchDefaults = (nextAccountId: string) => {
    const accountResearch = accountResearchById[nextAccountId]

    setCustomerResearchEnabled(accountResearch?.enabled ?? false)
    setSellerCompany(accountResearch?.sellerCompany ?? sellerResearchProfile.sellerCompany)
    setSellerDomain(accountResearch?.sellerDomain ?? sellerResearchProfile.sellerDomain)
    setProductContext(accountResearch?.productContext ?? sellerResearchProfile.productContext)
    setResearchProfileMessage("")
    setResearchProfileStatus("idle")
    setCustomerContact(accountResearch?.customerContact ?? "")
    setCustomerRole(accountResearch?.customerRole ?? "")
  }

  React.useEffect(() => {
    const nextPreferences = readCaptureSettings(workspaceId)

    setCapturePreferences(nextPreferences)
    setSelectedAudioInputDeviceId(readPreferredAudioInputDeviceId(workspaceId))
    setAudioCaptureMode((currentMode) =>
      isAudioCaptureModeEnabled(nextPreferences, currentMode)
        ? currentMode
        : getPreferredAudioCaptureMode(nextPreferences)
    )
    clearMicrophonePreview()
    clearMeetingAudioPreview()
  }, [clearMeetingAudioPreview, clearMicrophonePreview, workspaceId])

  React.useEffect(() => {
    return () => {
      if (sellerDomainLookupTimeoutRef.current) {
        window.clearTimeout(sellerDomainLookupTimeoutRef.current)
      }
      if (startProgressTimerRef.current) {
        window.clearInterval(startProgressTimerRef.current)
      }
      startAbortControllerRef.current?.abort()
      clearMicrophonePreview()
      clearMeetingAudioPreview()
    }
  }, [clearMeetingAudioPreview, clearMicrophonePreview])

  React.useEffect(() => {
    if (!open || step !== 3) return

    void refreshAudioDevices()
  }, [open, refreshAudioDevices, step])

  React.useEffect(() => {
    if (!open || step !== 3 || startSubmitting) {
      clearMicrophonePreview()
      return
    }

    let cancelled = false
    let previewStream: MediaStream | null = null

    const startMicrophonePreview = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMicrophonePreviewError("This browser cannot access the microphone.")
        return
      }

      setMicrophonePreviewChecking(true)
      setMicrophonePreviewError("")

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: getMicrophoneAudioConstraints({
            deviceId: selectedAudioInputDeviceId,
            hasMeetingAudio: selectedAudioSourceChoice === "two_channels",
            mode: audioCaptureMode,
          }),
        })

        if (cancelled) {
          stopMediaStream(stream)
          return
        }

        previewStream = stream
        stopMediaStream(microphonePreviewStreamRef.current)
        microphonePreviewStreamRef.current = stream
        setMicrophonePreviewStream(stream)
        await refreshAudioDevices()
      } catch (error: unknown) {
        if (cancelled) return

        setMicrophonePreviewError(
          getUserFacingErrorMessage(error, "SalesFrame cannot access that microphone. Choose another input or check browser permissions.")
        )
        stopMediaStream(microphonePreviewStreamRef.current)
        microphonePreviewStreamRef.current = null
        setMicrophonePreviewStream(null)
      } finally {
        if (!cancelled) setMicrophonePreviewChecking(false)
      }
    }

    void startMicrophonePreview()

    return () => {
      cancelled = true
      stopMediaStream(previewStream)
      if (microphonePreviewStreamRef.current === previewStream) {
        microphonePreviewStreamRef.current = null
        setMicrophonePreviewStream(null)
      }
    }
  }, [
    audioCaptureMode,
    clearMicrophonePreview,
    open,
    refreshAudioDevices,
    selectedAudioInputDeviceId,
    selectedAudioSourceChoice,
    startSubmitting,
    step,
  ])

  React.useEffect(() => {
    if (selectedAudioSourceChoice !== "two_channels") {
      clearMeetingAudioPreview()
    }
  }, [clearMeetingAudioPreview, selectedAudioSourceChoice])

  const clearStartProgressTimer = () => {
    if (startProgressTimerRef.current) {
      window.clearInterval(startProgressTimerRef.current)
      startProgressTimerRef.current = null
    }
  }

  const resetStartProgress = () => {
    clearStartProgressTimer()
    setStartProgress(0)
    setStartPhaseIndex(0)
    setStartPreparationDetail("")
    startProgressTargetRef.current = 0
  }

  const applyStartPreparationStep = (step: StartCallPreparationStepId, detail?: string) => {
    const nextIndex = Math.max(
      0,
      startPreparationSteps.findIndex((item) => item.id === step)
    )
    const targetProgress = startPreparationSteps[nextIndex]?.progress ?? 94

    startProgressTargetRef.current = targetProgress
    setStartPhaseIndex(nextIndex)
    setStartPreparationDetail(detail ?? "")
    setStartProgress((currentProgress) =>
      Math.max(currentProgress, Math.max(8, targetProgress - 12))
    )
  }

  const runStartProgress = () => {
    clearStartProgressTimer()
    setStartProgress(8)
    setStartPhaseIndex(0)
    setStartPreparationDetail("")
    startProgressTargetRef.current = startPreparationSteps[0]?.progress ?? 16

    startProgressTimerRef.current = window.setInterval(() => {
      setStartProgress((currentProgress) => {
        const targetProgress = startProgressTargetRef.current || 94
        const stepCeiling = Math.max(8, targetProgress - 1)
        const nextProgress = currentProgress + Math.max(0.35, (stepCeiling - currentProgress) * 0.08)

        return Math.min(stepCeiling, Math.max(currentProgress, nextProgress))
      })
    }, 250)
  }

  const handleOpenChange = (value: boolean) => {
    if (!value && startSubmitting) return

    setOpen(value)
    setStep(1)
    if (value) {
      const nextAccountId =
        defaultAccountId && accounts.some((account) => account.id === defaultAccountId)
          ? defaultAccountId
          : accountId || accounts[0]?.id || ""
      const nextOpportunityId =
        defaultOpportunityId &&
        opportunities.some((opportunity) => opportunity.id === defaultOpportunityId && opportunity.accountId === nextAccountId)
          ? defaultOpportunityId
          : opportunities.find((opportunity) => opportunity.accountId === nextAccountId)?.id ?? ""

      setAccountMode("existing")
      setAccountId(nextAccountId)
      setAccountWebsite("")
      setAccountCurrency(accounts.find((account) => account.id === nextAccountId)?.currency ?? defaultCurrency)
      setOpportunityId(nextOpportunityId)
      setOpportunityMode(nextOpportunityId ? "existing" : "new")
      const nextCapturePreferences = readCaptureSettings(workspaceId)
      setCapturePreferences(nextCapturePreferences)
      setAudioCaptureMode(getPreferredAudioCaptureMode(nextCapturePreferences))
      setStartError("")
      setStartSubmitting(false)
      resetStartProgress()
      setResearchProfileMessage("")
      setResearchProfileStatus("idle")
      setMicrophonePreviewError("")
      setMeetingAudioPreviewError("")
      applyResearchDefaults(nextAccountId)
    } else {
      resetStartProgress()
      clearMicrophonePreview()
      clearMeetingAudioPreview()
    }
  }

  React.useEffect(() => {
    if (accountMode === "new" || opportunityMode === "new" || !opportunityId) {
      setSelectedPlaybooks(defaultCallPlaybooks)
      return
    }

    setSelectedPlaybooks(parsePlaybookSelection(opportunityDrafts[opportunityId]?.frameworks))
  }, [accountMode, opportunityMode, opportunityId, opportunityDrafts])

  const handleAccountModeChange = (value: string) => {
    const mode = value as "existing" | "new"
    setAccountMode(mode)
    if (mode === "new") {
      setOpportunityMode("new")
      setAccountWebsite("")
      setAccountCurrency(defaultCurrency)
      setCustomerResearchEnabled(false)
      setSellerCompany(sellerResearchProfile.sellerCompany)
      setSellerDomain(sellerResearchProfile.sellerDomain)
      setProductContext(sellerResearchProfile.productContext)
      setResearchProfileMessage("")
      setResearchProfileStatus("idle")
      setCustomerContact("")
      setCustomerRole("")
      return
    }
    const firstAccountId = accountId || accounts[0]?.id || ""
    const firstOpportunityId = opportunities.find((opportunity) => opportunity.accountId === firstAccountId)?.id ?? ""
    setAccountId(firstAccountId)
    setAccountCurrency(accounts.find((account) => account.id === firstAccountId)?.currency ?? defaultCurrency)
    setOpportunityMode(firstOpportunityId ? "existing" : "new")
    setOpportunityId(firstOpportunityId)
    applyResearchDefaults(firstAccountId)
  }

  const handleAccountChange = (value: string) => {
    setAccountId(value)
    setAccountCurrency(accounts.find((account) => account.id === value)?.currency ?? defaultCurrency)
    const firstOpportunityId = opportunities.find((opportunity) => opportunity.accountId === value)?.id ?? ""
    setOpportunityId(firstOpportunityId)
    setOpportunityMode(firstOpportunityId ? "existing" : "new")
    applyResearchDefaults(value)
  }

  const handleNewAccountWebsiteChange = (value: string) => {
    setAccountWebsite(value)
    if (!accountName.trim() && normalizeSellerDomain(value).includes(".")) {
      setAccountName(inferCompanyNameFromDomain(value))
    }
  }

  const handleNext = () => {
    if (!canContinue) return
    setStep((value) => (value === 1 ? 2 : value === 2 ? 3 : 4))
  }

  const handleBack = () => {
    setStep((value) => (value === 4 ? 3 : value === 3 ? 2 : 1))
  }

  const handleSellerDomainChange = (value: string) => {
    setSellerDomain(value)

    if (sellerDomainLookupTimeoutRef.current) {
      window.clearTimeout(sellerDomainLookupTimeoutRef.current)
      sellerDomainLookupTimeoutRef.current = null
    }

    const lookupSequence = sellerDomainLookupSequenceRef.current + 1
    sellerDomainLookupSequenceRef.current = lookupSequence
    const normalizedDomain = normalizeSellerDomain(value)
    setProductContext("")

    if (!normalizedDomain) {
      setResearchProfileMessage("")
      setResearchProfileStatus("idle")
      return
    }

    setSellerCompany("")

    if (!normalizedDomain.includes(".")) {
      setResearchProfileMessage("Enter a full company domain to research what you sell.")
      setResearchProfileStatus("idle")
      return
    }

    if (!hasSavedOpenAiKey) {
      setResearchProfileMessage("Add an OpenAI API key in Settings before running seller domain research.")
      setResearchProfileStatus("error")
      return
    }

    setResearchProfileStatus("loading")
    setResearchProfileMessage(`Looking up ${normalizedDomain} after you stop typing...`)

    sellerDomainLookupTimeoutRef.current = window.setTimeout(() => {
      setResearchProfileMessage(`Reading public information for ${normalizedDomain}...`)

      void requestSellerDomainResearch({
        domain: normalizedDomain,
        workspaceId,
      })
        .then((result) => {
          if (sellerDomainLookupSequenceRef.current !== lookupSequence) return

          setSellerCompany(result.sellerCompany)
          setSellerDomain(result.sellerDomain || normalizedDomain)
          setProductContext(result.productContext)
          setResearchProfileStatus("success")
          setResearchProfileMessage(
            `What you sell is ready for ${result.sellerDomain || normalizedDomain}.`
          )
        })
        .catch((error: unknown) => {
          if (sellerDomainLookupSequenceRef.current !== lookupSequence) return

          setResearchProfileStatus("error")
          setResearchProfileMessage(
            getUserFacingErrorMessage(error, "SalesFrame needs another moment to research this domain. You can type what you sell manually.")
          )
        })
    }, sellerDomainLookupDebounceMs)
  }

  const handleCancelStart = () => {
    startAbortControllerRef.current?.abort()
    startAbortControllerRef.current = null
    resetStartProgress()
    setStartSubmitting(false)
    setStartError("")
    clearMicrophonePreview()
    clearMeetingAudioPreview()
    setOpen(false)
    setStep(1)
  }

  const getStartCallErrorMessage = (error: unknown) => {
    const message =
      typeof error === "string"
        ? error
        : getUserFacingErrorMessage(error, "Call start needs another try.")

    if (/OpenAI key did not work/i.test(message)) {
      return appendErrorReference(
        "OpenAI rejected this workspace key. Paste a valid key in Settings, then try again.",
        error
      )
    }

    if (/key needs billing|quota attention/i.test(message)) {
      return appendErrorReference(
        "This workspace OpenAI key needs billing or quota attention. Check it in Settings, then try again.",
        error
      )
    }

    if (/live AI model is not available|model is not available|unsupported model|model .* unavailable/i.test(message)) {
      return appendErrorReference(
        "SalesFrame cannot use the selected OpenAI live-question model with this key. Contact support if this keeps happening.",
        error
      )
    }

    if (/Deepgram key|transcription is not configured|deepgram_key_missing/i.test(message)) {
      return appendErrorReference(
        "SalesFrame transcription is not configured yet. Add the Deepgram key in Netlify.",
        error
      )
    }

    if (/authenticate with Deepgram|deepgram_auth_failed/i.test(message)) {
      return appendErrorReference(
        "SalesFrame cannot authenticate with Deepgram. Check the Deepgram key in Netlify.",
        error
      )
    }

    if (/browser or network blocked|live transcript connection was blocked|deepgram socket|not allowed by csp|content security policy/i.test(message)) {
      return appendErrorReference(
        "This browser, content blocker, or network blocked the live transcript connection. Allow Deepgram live transcript traffic for SalesFrame, then try again.",
        error
      )
    }

    if (/Deepgram|live transcription|transcription setup|transcription needs/i.test(message)) {
      return appendErrorReference(
        "Deepgram needs another moment. Try again shortly.",
        error
      )
    }

    if (/timed out|taking longer|rate.?limit|too many requests/i.test(message)) {
      return appendErrorReference(
        "SalesFrame is taking longer than expected to write the first question. Your call has not started yet. Try again in a moment.",
        error
      )
    }

    if (
      /SalesFrame needs another moment to prepare this/i.test(message) ||
      /prepare the first question/i.test(message) ||
      /Live guidance did not return/i.test(message)
    ) {
      return appendErrorReference(
        "SalesFrame needs another moment to write the first question. Your call has not started yet. Try again in a moment.",
        error
      )
    }

    return appendErrorReference(message, error)
  }

  const handleStart = async () => {
    if (!canStart || startSubmitting) return

    const startAbortController = new AbortController()
    const preparedMeetingAudioStream =
      selectedAudioSourceChoice === "two_channels" ? meetingAudioPreviewStreamRef.current : null
    const preparedMeetingAudio = preparedMeetingAudioStream
      ? {
          level: meetingAudioPreviewLevel,
          stream: preparedMeetingAudioStream,
          surface: meetingAudioSurface,
        }
      : undefined
    let startSucceeded = false

    clearMicrophonePreview()
    if (preparedMeetingAudioStream) {
      clearMeetingAudioPreview({ stop: false })
    }

    startAbortControllerRef.current = startAbortController
    setStartError("")
    setStartSubmitting(true)
    runStartProgress()

    try {
      const result = await onStartRecording({
        accountMode,
        accountId,
        accountName,
        accountWebsite,
        accountIndustry,
        accountCurrency,
        audioCaptureMode,
        audioInputDeviceId: selectedAudioInputDeviceId,
        audioInputDeviceLabel: selectedAudioInputLabel,
        preparedMeetingAudio,
        opportunityMode,
        opportunityId,
        opportunityName,
        callType,
        playbooks: selectedPlaybooks,
        customerResearch: {
          enabled: customerResearchEnabled,
          sellerCompany: sellerCompany.trim(),
          sellerDomain: normalizeSellerDomain(sellerDomain),
          productContext: productContext.trim(),
          customerContact: customerContact.trim(),
          customerRole: customerRole.trim(),
        },
        openAiApiKey: "",
        abortSignal: startAbortController.signal,
        onPreparationStep: ({ detail, step }) => applyStartPreparationStep(step, detail),
      })

      if (startAbortController.signal.aborted) return

      if (!result.ok) {
        resetStartProgress()
        void reportClientError({
          error: result.message,
          eventName: "start_call_modal_failed",
          metadata: {
            accountMode,
            audioCaptureMode,
            opportunityMode,
            step,
          },
        })
        setStartError(getStartCallErrorMessage(result.message))
        stopMediaStream(preparedMeetingAudio?.stream ?? null)
        return
      }

      clearStartProgressTimer()
      setStartPhaseIndex(startPreparationSteps.length - 1)
      startProgressTargetRef.current = 100
      setStartProgress(100)
      await new Promise((resolve) => window.setTimeout(resolve, 250))
      startSucceeded = true
      setOpen(false)
      setStep(1)
    } catch (caughtError: unknown) {
      if (startAbortController.signal.aborted) return

      resetStartProgress()
      void reportClientError({
        error: caughtError,
        eventName: "start_call_modal_exception",
        metadata: {
          accountMode,
          audioCaptureMode,
          opportunityMode,
          step,
        },
      })
      setStartError(getStartCallErrorMessage(caughtError))
      stopMediaStream(preparedMeetingAudio?.stream ?? null)
    } finally {
      if (startAbortControllerRef.current === startAbortController) {
        startAbortControllerRef.current = null
      }
      if (!startSucceeded && startAbortController.signal.aborted) {
        stopMediaStream(preparedMeetingAudio?.stream ?? null)
      }
      if (!startAbortController.signal.aborted) {
        setStartSubmitting(false)
      }
    }
  }

  const startCallTrigger = (
    <Button size="sm" variant={triggerVariant} className="h-11 min-h-11 gap-2 px-4 md:h-7 md:min-h-7 md:px-2.5">
      {triggerIcon}
      {triggerLabel}
    </Button>
  )
  const startCallDescription = startSubmitting
    ? "SalesFrame is preparing the live coach before opening the cockpit."
    : "Attach the call to the right context before live guidance begins."
  const renderStartCallSteps = (isPreparing = false) => {
    const visibleSteps = isPreparing ? [...recordingSteps, preparationStepItem] : recordingSteps
    const activeStep = isPreparing ? visibleSteps.length : step
    const activeLabel = visibleSteps[activeStep - 1]?.label ?? currentRecordingStepLabel

    return (
      <>
        <p className="sr-only" aria-live="polite">
          Step {activeStep} of {visibleSteps.length}: {activeLabel}
        </p>
        <ol
          className={cn(
            "grid min-w-0 grid-cols-2 gap-2",
            isPreparing ? "sm:grid-cols-5" : "sm:grid-cols-4"
          )}
          aria-label={isPreparing ? "Start call progress" : "Start call steps"}
        >
          {visibleSteps.map(({ label, icon: Icon }, index) => {
            const itemStep = (index + 1) as 1 | 2 | 3 | 4
            const isActive = activeStep === index + 1
            const isComplete = activeStep > index + 1
            const canNavigate = !isPreparing && index < recordingSteps.length && canNavigateToRecordingStep(itemStep)

            return (
              <li
                key={label}
                className="min-w-0"
              >
                <button
                  type="button"
                  aria-current={isActive ? "step" : undefined}
                  aria-label={isPreparing ? label : `Go to ${label} step`}
                  disabled={!canNavigate}
                  onClick={() => {
                    if (!canNavigate) return
                    setStep(itemStep)
                  }}
                  className={cn(
                    "flex min-h-12 w-full min-w-0 items-center gap-2 rounded-lg border px-2 py-2 text-left text-sm transition-colors duration-150 sm:px-3",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    canNavigate && "hover:bg-muted/50",
                    !canNavigate && "cursor-not-allowed opacity-55",
                    isActive && "border-primary bg-primary/5 opacity-100",
                    isComplete && "bg-muted/50 opacity-100"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-md border bg-background",
                      isActive && "border-primary text-primary"
                    )}
                  >
                    {isComplete ? <CheckIcon className="size-4" /> : <Icon className="size-4" />}
                  </span>
                  <span className="truncate font-medium">{label}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </>
    )
  }
  const startCallContent = (
    <>
        {startSubmitting ? (
          <>
            {renderStartCallSteps(true)}
            <div className="min-h-0 overflow-y-auto overflow-x-hidden pr-1 max-sm:pr-0">
              <StartCallPreparingView
                activeIndex={startPhaseIndex}
                detail={startPreparationDetail}
                progress={startProgress}
                steps={startPreparationSteps}
              />
            </div>
            <DialogActions
              className="min-w-0 overflow-hidden max-sm:-mx-3 max-sm:-mb-3"
              onCancel={handleCancelStart}
              primaryAction={
                <Button disabled className="gap-2">
                  <SparklesIcon />
                  Starting call
                </Button>
              }
            />
          </>
        ) : (
          <>
            {renderStartCallSteps(false)}

            <div className="min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain pr-1 max-sm:pr-0">
              {step === 1 ? (
                <div className="grid min-w-0 gap-4">
                  <div className="flex items-center gap-2">
                    <Building2Icon className="size-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Account</p>
                  </div>
                  <div className="grid gap-3">
                    <Label htmlFor="recording-account-mode">How should this call be attached?</Label>
                    <Select value={accountMode} onValueChange={handleAccountModeChange}>
                      <SelectTrigger id="recording-account-mode" className="w-full min-w-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="existing">Existing account</SelectItem>
                        <SelectItem value="new">New account</SelectItem>
                      </SelectContent>
                    </Select>

                    {accountMode === "existing" ? (
                      <div className="grid gap-2">
                        <Label htmlFor="recording-account">Account</Label>
                        <Select value={accountId} onValueChange={handleAccountChange}>
                          <SelectTrigger id="recording-account" className="w-full min-w-0">
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label htmlFor="recording-account-name">Account name</Label>
                          <Input
                            id="recording-account-name"
                            value={accountName}
                            placeholder="e.g. Southern Cross Energy"
                            onChange={(event) => setAccountName(event.currentTarget.value)}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="recording-account-website">Website or domain</Label>
                          <Input
                            id="recording-account-website"
                            value={accountWebsite}
                            placeholder="e.g. usemultiplier.com"
                            onChange={(event) => handleNewAccountWebsiteChange(event.currentTarget.value)}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="recording-account-industry">Industry</Label>
                          <Input
                            id="recording-account-industry"
                            value={accountIndustry}
                            placeholder="e.g. Energy"
                            onChange={(event) => setAccountIndustry(event.currentTarget.value)}
                          />
                        </div>
                        <CurrencySelect
                          id="recording-account-currency"
                          value={accountCurrency}
                          onChange={setAccountCurrency}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="grid min-w-0 gap-4">
                  <div className="flex items-center gap-2">
                    <TargetIcon className="size-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Opportunity</p>
                  </div>
                  <div className="grid gap-3">
                    <Label htmlFor="recording-opportunity-mode">What opportunity should receive the recording?</Label>
                    <Select
                      value={accountMode === "new" ? "new" : opportunityMode}
                      onValueChange={(value) => setOpportunityMode(value as "existing" | "new")}
                      disabled={accountMode === "new" || !canUseExistingOpportunity}
                    >
                      <SelectTrigger id="recording-opportunity-mode" className="w-full min-w-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="existing">Existing opportunity</SelectItem>
                        <SelectItem value="new">New opportunity</SelectItem>
                      </SelectContent>
                    </Select>

                    {accountMode === "existing" && opportunityMode === "existing" && canUseExistingOpportunity ? (
                      <div className="grid gap-2">
                        <Label htmlFor="recording-opportunity">Opportunity</Label>
                        <Select value={opportunityId} onValueChange={setOpportunityId}>
                          <SelectTrigger id="recording-opportunity" className="w-full min-w-0">
                            <SelectValue placeholder="Select opportunity" />
                          </SelectTrigger>
                          <SelectContent>
                            {accountOpportunities.map((opportunity) => (
                              <SelectItem key={opportunity.id} value={opportunity.id}>
                                {opportunity.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        <Label htmlFor="recording-opportunity-name">Opportunity name</Label>
                        <Input
                          id="recording-opportunity-name"
                          value={opportunityName}
                          placeholder="e.g. Field Service Modernisation"
                          onChange={(event) => setOpportunityName(event.currentTarget.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="grid min-w-0 gap-4">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <PhoneCallIcon className="size-4 text-muted-foreground" />
                      <p className="text-sm font-medium">Call setup</p>
                    </div>
                    <p className="text-xs leading-snug text-muted-foreground">
                      {accountSummary} · {opportunitySummary}
                    </p>
                  </div>

                  <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(8rem,0.8fr)_minmax(9rem,0.8fr)_minmax(0,1.4fr)]">
                    <div className="grid min-w-0 gap-2">
                      <Label htmlFor="recording-call-type">Call type</Label>
                      <Select value={callType} onValueChange={setCallType}>
                        <SelectTrigger id="recording-call-type" className="w-full min-w-0 [&>span]:truncate">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["Discovery", "Cold", "Inbound", "Outbound", "Demo", "Renewal", "Negotiation"].map(
                            (item) => (
                              <SelectItem key={item} value={item}>
                                {item}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid min-w-0 gap-2">
                      <Label htmlFor="recording-audio-source">Audio source</Label>
                      <Select
                        value={selectedAudioSourceChoice}
                        onValueChange={(value) => {
                          const nextChoice = value as AudioSourceChoice

                          if (nextChoice === "meeting_bot") return
                          setAudioCaptureMode(getAudioCaptureModeForChoice(nextChoice, capturePreferences))
                          setMeetingAudioPreviewError("")
                        }}
                      >
                        <SelectTrigger id="recording-audio-source" className="w-full min-w-0 [&>span]:truncate">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="one_channel">One channel</SelectItem>
                          <SelectItem value="two_channels" disabled={!capturePreferences.browserTab}>
                            Two channels
                          </SelectItem>
                          <SelectItem value="meeting_bot" disabled>
                            Meeting bot
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid min-w-0 gap-2">
                      <Label htmlFor="recording-playbooks">Playbooks</Label>
                      <PlaybookMultiSelect
                        id="recording-playbooks"
                        value={selectedPlaybooks}
                        onChange={setSelectedPlaybooks}
                      />
                    </div>
                  </div>

                  <div className="grid min-w-0 gap-3 rounded-lg border bg-background p-3">
                    <div className="grid min-w-0 gap-1">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Audio check</p>
                        <p className="text-xs leading-snug text-muted-foreground">
                          Choose what SalesFrame listens to and use the meters as a signal check.
                        </p>
                      </div>
                    </div>

                    {selectedAudioSourceChoice === "two_channels" ? (
                      <div className="grid min-w-0 gap-3 md:grid-cols-2">
                        <div className="grid min-w-0 gap-2.5 rounded-lg bg-muted/30 p-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
                              <Mic2Icon className="size-4" />
                            </span>
                            <div className="min-w-0">
                              <Label htmlFor="recording-audio-input">Seller microphone</Label>
                              <p className="text-xs text-muted-foreground">Labelled Seller</p>
                            </div>
                          </div>
                          <Select value={selectedAudioInputDeviceId} onValueChange={handleAudioInputDeviceChange}>
                            <SelectTrigger id="recording-audio-input" className="w-full min-w-0 [&>span]:truncate">
                              <SelectValue placeholder="Choose microphone" />
                            </SelectTrigger>
                            <SelectContent>
                              {audioInputDevices.length > 0 ? (
                                audioInputDevices.map((device) => (
                                  <SelectItem key={device.deviceId} value={device.deviceId}>
                                    {device.label}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value={getDefaultAudioDeviceId()}>
                                  Default microphone
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <AudioSetupMeter
                            detail={selectedAudioInputLabel}
                            label="Seller mic"
                            level={microphonePreviewLevel}
                            status={microphoneSetupStatus}
                          />
                          {microphonePreviewError ? (
                            <p className="text-xs leading-snug text-destructive">{microphonePreviewError}</p>
                          ) : null}
                        </div>

                        <div className="grid min-w-0 gap-2.5 rounded-lg bg-muted/30 p-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
                              <AudioLinesIcon className="size-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium">Shared meeting audio</p>
                              <p className="text-xs text-muted-foreground">Labelled Customer</p>
                            </div>
                          </div>
                          <div className="grid min-w-0 gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full justify-center gap-2 sm:w-fit sm:justify-start"
                              disabled={meetingAudioSelecting}
                              onClick={handleChooseMeetingAudio}
                            >
                              <AudioLinesIcon />
                              {meetingAudioPreviewStream ? "Change share" : "Choose share"}
                            </Button>
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                              <p className="text-xs leading-snug text-muted-foreground">{sharedAudioBrowserGuidance}</p>
                            </div>
                          </div>
                          <AudioSetupMeter
                            detail={meetingAudioSurface ? `Shared ${meetingAudioSurface}` : "Choose a tab, window, or screen with audio"}
                            label="Shared audio"
                            level={meetingAudioPreviewLevel}
                            status={sharedAudioSetupStatus}
                          />
                          {meetingAudioPreviewError ? (
                            <p className="text-xs leading-snug text-destructive">{meetingAudioPreviewError}</p>
                          ) : (
                            <p className="text-xs leading-snug text-muted-foreground">
                              Your mic is Seller; shared app, tab, or system audio is Customer.
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="grid min-w-0 gap-3">
                        <div className="grid min-w-0 gap-2.5 rounded-lg bg-muted/30 p-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
                              <Mic2Icon className="size-4" />
                            </span>
                            <div className="min-w-0">
                              <Label htmlFor="recording-audio-input">Microphone input</Label>
                              <p className="text-xs text-muted-foreground">Room or call audio</p>
                            </div>
                          </div>
                          <Select value={selectedAudioInputDeviceId} onValueChange={handleAudioInputDeviceChange}>
                            <SelectTrigger id="recording-audio-input" className="w-full min-w-0 [&>span]:truncate">
                              <SelectValue placeholder="Choose microphone" />
                            </SelectTrigger>
                            <SelectContent>
                              {audioInputDevices.length > 0 ? (
                                audioInputDevices.map((device) => (
                                  <SelectItem key={device.deviceId} value={device.deviceId}>
                                    {device.label}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value={getDefaultAudioDeviceId()}>
                                  Default microphone
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <AudioSetupMeter
                            detail={selectedAudioInputLabel}
                            label="Room/call audio"
                            level={microphonePreviewLevel}
                            status={microphoneSetupStatus}
                          />
                          {microphonePreviewError ? (
                            <p className="text-xs leading-snug text-destructive">{microphonePreviewError}</p>
                          ) : (
                            <p className="text-xs leading-snug text-muted-foreground">
                              One-channel mode can only transcribe the buyer if this microphone can hear them clearly. Switch to Two channels when shared audio is available.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

                  {step === 4 ? (
                    <div className="grid min-w-0 max-w-full gap-4 overflow-x-hidden">
                      {!hasSavedOpenAiKey ? (
                    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3" role="alert">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <CircleAlertIcon className="size-4 text-destructive" />
                          <p className="text-sm font-medium text-destructive">OpenAI key required</p>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Add the workspace OpenAI key in Settings before starting a call.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-2">
                      <SearchIcon className="size-4 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Seller Research</p>
                        <p className="text-xs text-muted-foreground">
                          Add context that helps SalesFrame make the first question sound like you.
                        </p>
                      </div>
                    </div>
                    <div className="flex min-w-0 items-center gap-2 sm:shrink-0">
                      <Label htmlFor="customer-research-toggle" className="text-sm text-muted-foreground">
                        Use research
                      </Label>
                      <Switch
                        id="customer-research-toggle"
                        checked={customerResearchEnabled}
                        onCheckedChange={setCustomerResearchEnabled}
                      />
                    </div>
                  </div>

                  <div className="grid min-w-0 max-w-full gap-3 overflow-x-hidden">
                    <div className="grid min-w-0 max-w-full gap-3 overflow-x-hidden">
                      <div className="grid gap-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Seller context</p>
                        <p className="text-xs text-muted-foreground">Your company and offer shape how SalesFrame frames the opener.</p>
                      </div>
                      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <div className="grid min-w-0 gap-2">
                          <Label htmlFor="seller-domain">Your company domain</Label>
                          <Input
                            id="seller-domain"
                            value={sellerDomain}
                            disabled={!customerResearchEnabled}
                            className="min-w-0"
                            placeholder="e.g. salesframe.ai"
                            onChange={(event) => handleSellerDomainChange(event.currentTarget.value)}
                          />
                        </div>
                        <div className="grid min-w-0 gap-2">
                          <Label htmlFor="seller-company">Your company</Label>
                          <Input
                            id="seller-company"
                            value={sellerCompany}
                            disabled={!customerResearchEnabled}
                            className="min-w-0"
                            placeholder="e.g. SalesFrame"
                            onChange={(event) => setSellerCompany(event.currentTarget.value)}
                          />
                        </div>
                      </div>

                      <div className="grid gap-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Buyer context</p>
                        <p className="text-xs text-muted-foreground">Optional details help the question fit the person you are meeting.</p>
                      </div>
                      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <div className="grid min-w-0 gap-2">
                          <Label htmlFor="customer-contact">Customer contact</Label>
                          <Input
                            id="customer-contact"
                            value={customerContact}
                            disabled={!customerResearchEnabled}
                            className="min-w-0"
                            placeholder="Optional"
                            onChange={(event) => setCustomerContact(event.currentTarget.value)}
                          />
                        </div>
                        <div className="grid min-w-0 gap-2">
                          <Label htmlFor="customer-role">Customer role</Label>
                          <Input
                            id="customer-role"
                            value={customerRole}
                            disabled={!customerResearchEnabled}
                            className="min-w-0"
                            placeholder="Optional"
                            onChange={(event) => setCustomerRole(event.currentTarget.value)}
                          />
                        </div>
                      </div>

                      <div className="grid min-w-0 gap-2">
                        <Label htmlFor="product-context">What you sell</Label>
                        <Textarea
                          id="product-context"
                          value={productContext}
                          disabled={!customerResearchEnabled || researchProfileStatus === "loading"}
                          className="field-sizing-fixed min-h-28 min-w-0 max-w-full resize-none overflow-x-hidden whitespace-pre-wrap break-words"
                          wrap="soft"
                          placeholder={
                            researchProfileStatus === "loading"
                              ? "Looking up your company..."
                              : "Describe the product or offer SalesFrame should connect to buyer research and live questions."
                          }
                          onChange={(event) => setProductContext(event.currentTarget.value)}
                        />
                        <p
                          className={cn(
                            "text-xs text-muted-foreground",
                            researchProfileStatus === "loading" && "text-primary",
                            researchProfileStatus === "error" && "text-destructive",
                            researchProfileStatus === "success" && "text-emerald-600"
                          )}
                          aria-live={researchProfileStatus === "error" ? "assertive" : "polite"}
                          role={researchProfileStatus === "error" ? "alert" : "status"}
                        >
                          {researchProfileMessage ||
                            "Auto-filled from the domain and saved for this workspace once the call starts."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {startError ? (
                <div className="min-w-0 max-w-full whitespace-normal break-words rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                  {startError}
                </div>
              ) : null}
            </div>

        <DialogActions
          className="min-w-0 overflow-hidden max-sm:-mx-3 max-sm:-mb-3"
          leftActions={
            <div className="grid gap-2 sm:flex sm:flex-row">
              <Button variant="outline" onClick={handleCancelStart}>
                Cancel
              </Button>
              {step > 1 ? (
                <Button variant="outline" className="gap-2" onClick={handleBack}>
                  <ArrowLeftIcon />
                  Back
                </Button>
              ) : null}
            </div>
          }
          primaryAction={
            step === 4 ? (
              hasSavedOpenAiKey ? (
                <Button
                  variant="destructive"
                  className="gap-2"
                  disabled={!canStart || startSubmitting}
                  onClick={handleStart}
                >
                  <Mic2Icon />
                  {startSubmitting ? "Starting..." : "Start call"}
                </Button>
              ) : (
                <Button
                  className="gap-2"
                  onClick={() => {
                    setOpen(false)
                    onOpenSettings?.()
                  }}
                >
                  <KeyRoundIcon />
                  Open settings
                </Button>
              )
            ) : (
              <Button className="gap-2" disabled={!canContinue} onClick={handleNext}>
                Continue
                <ArrowRightIcon />
              </Button>
            )
          }
        />
          </>
        )}
    </>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange} showSwipeHandle>
        <DrawerTrigger asChild>{startCallTrigger}</DrawerTrigger>
        <DrawerContent className="grid max-h-[92svh] min-h-[min(640px,92svh)] min-w-0 grid-rows-[auto_auto_auto_minmax(0,1fr)_auto] overflow-hidden px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-0 text-left data-[vaul-drawer-direction=bottom]:max-h-[92svh] [&_[data-slot=button]]:min-h-11 [&_[data-slot=button]]:px-4 [&_[data-slot=input]]:min-h-11 [&_[data-slot=select-trigger]]:min-h-11">
          <DrawerHeader className="px-0 pb-0 pt-3 text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
            <DrawerTitle>Start call</DrawerTitle>
            <DrawerDescription>{startCallDescription}</DrawerDescription>
          </DrawerHeader>
          {startCallContent}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{startCallTrigger}</DialogTrigger>
      <DialogContent
        className="grid max-h-[calc(100svh-2rem)] min-w-0 overflow-hidden max-sm:max-h-[calc(100svh-0.75rem)] max-sm:max-w-[calc(100%-0.75rem)] max-sm:gap-3 max-sm:p-3 max-sm:[&_[data-slot=button]]:min-h-11 max-sm:[&_[data-slot=button]]:px-4 max-sm:[&_[data-slot=input]]:min-h-11 max-sm:[&_[data-slot=select-trigger]]:min-h-11 sm:h-[760px] sm:max-w-3xl sm:grid-rows-[auto_auto_minmax(0,1fr)_auto]"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Start call</DialogTitle>
          <DialogDescription>{startCallDescription}</DialogDescription>
        </DialogHeader>
        {startCallContent}
      </DialogContent>
    </Dialog>
  )
}

function MobileStartCallBar({
  account,
  accounts,
  accountResearchById,
  defaultCurrency,
  opportunity,
  opportunityDrafts,
  opportunities,
  savedOpenAiKeyState,
  sellerResearchProfile,
  workspaceId,
  onOpenSettings,
  onStartRecording,
}: {
  account: AccountNavItem
  accounts: AccountNavItem[]
  accountResearchById: Record<string, CustomerResearchConfig>
  defaultCurrency: CurrencyCode
  opportunity: Opportunity
  opportunityDrafts: Record<string, OpportunityDraft>
  opportunities: Opportunity[]
  savedOpenAiKeyState: SavedOpenAiKeyState | null
  sellerResearchProfile: SellerResearchProfile
  workspaceId: string
  onOpenSettings: () => void
  onStartRecording: StartRecordingHandler
}) {
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 md:hidden">
      <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-xl bg-popover/95 p-2 text-popover-foreground shadow-lg ring-1 ring-foreground/10 backdrop-blur">
        <div className="min-w-0 pl-2">
          <p className="truncate text-sm font-medium">Ready for a call?</p>
          <p className="truncate text-xs text-muted-foreground">
            {account.id && opportunity.id ? `${account.name} with ${opportunity.name}` : "Attach account and opportunity first"}
          </p>
        </div>
        <StartRecordingDialog
          accounts={accounts}
          accountResearchById={accountResearchById}
          defaultCurrency={defaultCurrency}
          defaultAccountId={account.id}
          defaultOpportunityId={opportunity.id}
          opportunityDrafts={opportunityDrafts}
          opportunities={opportunities}
          savedOpenAiKeyState={savedOpenAiKeyState}
          sellerResearchProfile={sellerResearchProfile}
          workspaceId={workspaceId}
          onOpenSettings={onOpenSettings}
          onStartRecording={onStartRecording}
        />
      </div>
    </div>
  )
}

function CreateAccountDialog({
  accountDrafts,
  accounts,
  defaultCurrency,
  open,
  savedOpenAiKeyState,
  sellerResearchProfile,
  workspaceId,
  onCreateAccount,
  onOpenSettings,
  onOpenChange,
  onOpenExistingAccount,
}: {
  accountDrafts: Record<string, AccountDraft>
  accounts: AccountNavItem[]
  defaultCurrency: CurrencyCode
  open: boolean
  savedOpenAiKeyState: SavedOpenAiKeyState | null
  sellerResearchProfile: SellerResearchProfile
  workspaceId: string
  onCreateAccount: (payload: CreateAccountPayload) => Promise<RecordMutationResult> | RecordMutationResult
  onOpenSettings: () => void
  onOpenChange: (open: boolean) => void
  onOpenExistingAccount: (accountId: string) => void
}) {
  const [step, setStep] = React.useState<1 | 2 | 3 | 4>(1)
  const [accountName, setAccountName] = React.useState("")
  const [website, setWebsite] = React.useState("")
  const [industry, setIndustry] = React.useState("")
  const [employeeCount, setEmployeeCount] = React.useState("")
  const [region, setRegion] = React.useState("Australia")
  const [currency, setCurrency] = React.useState<CurrencyCode>(defaultCurrency)
  const [currentTools, setCurrentTools] = React.useState("")
  const [strategicInitiatives, setStrategicInitiatives] = React.useState("")
  const [competitors, setCompetitors] = React.useState("")
  const [accountNotes, setAccountNotes] = React.useState("")
  const [aiEnrichmentEnabled, setAiEnrichmentEnabled] = React.useState(false)
  const [customerResearchEnabled, setCustomerResearchEnabled] = React.useState(false)
  const [sellerCompany, setSellerCompany] = React.useState(sellerResearchProfile.sellerCompany)
  const [sellerDomain, setSellerDomain] = React.useState(sellerResearchProfile.sellerDomain)
  const [productContext, setProductContext] = React.useState(sellerResearchProfile.productContext)
  const [researchProfileMessage, setResearchProfileMessage] = React.useState("")
  const [researchProfileStatus, setResearchProfileStatus] =
    React.useState<"idle" | "loading" | "success" | "error">("idle")
  const [createError, setCreateError] = React.useState("")
  const [createSubmitting, setCreateSubmitting] = React.useState(false)
  const [createProgressMessage, setCreateProgressMessage] = React.useState("")
  const [createOpportunity, setCreateOpportunity] = React.useState(true)
  const [opportunityName, setOpportunityName] = React.useState("")
  const [showOpportunityFields, setShowOpportunityFields] = React.useState(false)
  const [stage, setStage] = React.useState("Qualification")
  const [amount, setAmount] = React.useState("")
  const [closeDate, setCloseDate] = React.useState("")
  const [selectedPlaybooks, setSelectedPlaybooks] = React.useState<CallPlaybook[]>(defaultCallPlaybooks)
  const [nextStep, setNextStep] = React.useState("")
  const [pain, setPain] = React.useState("")
  const wasOpenRef = React.useRef(open)
  const sellerDomainLookupSequenceRef = React.useRef(0)
  const sellerDomainLookupTimeoutRef = React.useRef<number | null>(null)

  const normalizedAccountName = normalizeComparableText(accountName)
  const normalizedWebsite = normalizeSellerDomain(website)
  const duplicateAccount = accounts.find((account) => {
    const draft = accountDrafts[account.id]
    const sameName = normalizedAccountName && normalizeComparableText(account.name) === normalizedAccountName
    const sameWebsite = normalizedWebsite && normalizeSellerDomain(draft?.website ?? "") === normalizedWebsite

    return sameName || sameWebsite
  })
  const canContinueBasics = accountName.trim().length > 0 && !duplicateAccount
  const hasSavedOpenAiKey = Boolean(savedOpenAiKeyState)
  const canUseOpenAi = hasSavedOpenAiKey
  const canUseEnrichment = !aiEnrichmentEnabled || (hasSavedOpenAiKey && normalizedWebsite.includes("."))
  const canUseResearch =
    !customerResearchEnabled ||
    (sellerCompany.trim().length > 0 && sellerDomain.trim().length > 0 && productContext.trim().length > 0)
  const canUseOpportunity = !createOpportunity || opportunityName.trim().length > 0
  const canContinue =
    step === 1 ? canContinueBasics : step === 2 ? true : step === 3 ? canUseResearch && canUseEnrichment && canUseOpenAi : canUseOpportunity
  const canCreate = canContinueBasics && canUseEnrichment && canUseResearch && canUseOpenAi && canUseOpportunity
  const accountSteps: { label: string; icon: React.ElementType }[] = [
    { label: "Basics", icon: Building2Icon },
    { label: "Context", icon: ListChecksIcon },
    { label: "Research", icon: SearchIcon },
    { label: "Opportunity", icon: TargetIcon },
  ]
  const currentAccountStepLabel = accountSteps[step - 1]?.label ?? accountSteps[0].label
  const canNavigateToAccountStep = (targetStep: 1 | 2 | 3 | 4) => {
    if (targetStep === 1) return true
    if (targetStep === 2 || targetStep === 3) return canContinueBasics
    return canContinueBasics && canUseResearch && canUseEnrichment && canUseOpenAi
  }

  const reset = () => {
    if (sellerDomainLookupTimeoutRef.current) {
      window.clearTimeout(sellerDomainLookupTimeoutRef.current)
      sellerDomainLookupTimeoutRef.current = null
    }
    sellerDomainLookupSequenceRef.current += 1

    setStep(1)
    setAccountName("")
    setWebsite("")
    setIndustry("")
    setEmployeeCount("")
    setRegion("Australia")
    setCurrency(defaultCurrency)
    setCurrentTools("")
    setStrategicInitiatives("")
    setCompetitors("")
    setAccountNotes("")
    setAiEnrichmentEnabled(false)
    setCustomerResearchEnabled(false)
    setSellerCompany(sellerResearchProfile.sellerCompany)
    setSellerDomain(sellerResearchProfile.sellerDomain)
    setProductContext(sellerResearchProfile.productContext)
    setResearchProfileMessage("")
    setResearchProfileStatus("idle")
    setCreateError("")
    setCreateSubmitting(false)
    setCreateProgressMessage("")
    setCreateOpportunity(true)
    setOpportunityName("")
    setShowOpportunityFields(false)
    setStage("Qualification")
    setAmount("")
    setCloseDate("")
    setSelectedPlaybooks(defaultCallPlaybooks)
    setNextStep("")
    setPain("")
  }

  React.useEffect(() => {
    return () => {
      if (sellerDomainLookupTimeoutRef.current) {
        window.clearTimeout(sellerDomainLookupTimeoutRef.current)
      }
    }
  }, [])

  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      reset()
    }

    wasOpenRef.current = open
  }, [open])

  const handleOpenChange = (value: boolean) => {
    if (!value && createSubmitting) return
    onOpenChange(value)
  }

  const handleWebsiteChange = (value: string) => {
    setWebsite(value)
    if (!accountName.trim() && normalizeSellerDomain(value).includes(".")) {
      setAccountName(inferCompanyNameFromDomain(value))
    }
  }

  const handleSellerDomainChange = (value: string) => {
    setSellerDomain(value)

    if (sellerDomainLookupTimeoutRef.current) {
      window.clearTimeout(sellerDomainLookupTimeoutRef.current)
      sellerDomainLookupTimeoutRef.current = null
    }

    const lookupSequence = sellerDomainLookupSequenceRef.current + 1
    sellerDomainLookupSequenceRef.current = lookupSequence
    const normalizedDomain = normalizeSellerDomain(value)
    setProductContext("")

    if (!normalizedDomain) {
      setResearchProfileMessage("")
      setResearchProfileStatus("idle")
      return
    }

    setSellerCompany("")

    if (!normalizedDomain.includes(".")) {
      setResearchProfileMessage("Enter a full company domain to research what you sell.")
      setResearchProfileStatus("idle")
      return
    }

    if (!hasSavedOpenAiKey) {
      setResearchProfileMessage("Add an OpenAI API key in Settings before running seller domain research.")
      setResearchProfileStatus("error")
      return
    }

    setResearchProfileStatus("loading")
    setResearchProfileMessage(`Looking up ${normalizedDomain} after you stop typing...`)

    sellerDomainLookupTimeoutRef.current = window.setTimeout(() => {
      setResearchProfileMessage(`Reading public information for ${normalizedDomain}...`)

      void requestSellerDomainResearch({
        domain: normalizedDomain,
        workspaceId,
      })
        .then((result) => {
          if (sellerDomainLookupSequenceRef.current !== lookupSequence) return

          setSellerCompany(result.sellerCompany)
          setSellerDomain(result.sellerDomain || normalizedDomain)
          setProductContext(result.productContext)
          setResearchProfileStatus("success")
          setResearchProfileMessage(
            `What you sell is ready for ${result.sellerDomain || normalizedDomain}.`
          )
        })
        .catch((error: unknown) => {
          if (sellerDomainLookupSequenceRef.current !== lookupSequence) return

          setResearchProfileStatus("error")
          setResearchProfileMessage(
            getUserFacingErrorMessage(error, "SalesFrame needs another moment to research this domain. You can type what you sell manually.")
          )
        })
    }, sellerDomainLookupDebounceMs)
  }

  const handleNext = () => {
    setCreateError("")
    if (!canContinue) return
    setStep((value) => (value === 1 ? 2 : value === 2 ? 3 : 4))
  }

  const handleBack = () => {
    setCreateError("")
    setStep((value) => (value === 4 ? 3 : value === 3 ? 2 : 1))
  }

  const handleCreate = async () => {
    if (!canCreate || createSubmitting) return

    setCreateSubmitting(true)
    setCreateError("")
    setCreateProgressMessage(
      aiEnrichmentEnabled
        ? "Creating account. Customer research will continue in the background."
        : "Creating account and saving the account record."
    )

    try {
      const result = await onCreateAccount({
        accountName,
        website: normalizedWebsite,
        aiEnrichmentEnabled,
        industry,
        employeeCount,
        region,
        currency,
        currentTools,
        strategicInitiatives,
        competitors,
        accountNotes,
        customerResearch: {
          enabled: customerResearchEnabled,
          sellerCompany: sellerCompany.trim(),
          sellerDomain: normalizeSellerDomain(sellerDomain),
          productContext: productContext.trim(),
          customerContact: "",
          customerRole: "",
        },
        createOpportunity,
        opportunityName,
        stage,
        amount,
        closeDate,
        playbooks: selectedPlaybooks,
        nextStep,
        pain,
        openAiApiKey: "",
      })

      if (!result.ok) {
        setCreateError(result.message)
        return
      }

      onOpenChange(false)
      setStep(1)
    } catch (caughtError: unknown) {
      setCreateError(getUserFacingErrorMessage(caughtError, "Account setup needs another try."))
    } finally {
      setCreateSubmitting(false)
      setCreateProgressMessage("")
    }
  }

  const handleOpenExisting = () => {
    if (!duplicateAccount) return
    onOpenChange(false)
    onOpenExistingAccount(duplicateAccount.id)
  }

  const handleOpenSettings = () => {
    onOpenChange(false)
    onOpenSettings()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="grid max-h-[calc(100svh-2rem)] overflow-hidden max-sm:max-h-[calc(100svh-0.75rem)] max-sm:max-w-[calc(100%-0.75rem)] max-sm:[&_[data-slot=button]]:min-h-11 max-sm:[&_[data-slot=button]]:px-4 max-sm:[&_[data-slot=input]]:min-h-11 max-sm:[&_[data-slot=select-trigger]]:min-h-11 sm:h-[760px] sm:max-w-2xl sm:grid-rows-[auto_auto_minmax(0,1fr)_auto]"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Create account</DialogTitle>
          <DialogDescription>
            Add the customer record, optional research defaults, and the first opportunity.
          </DialogDescription>
        </DialogHeader>

        <p className="sr-only" aria-live="polite">
          Step {step} of {accountSteps.length}: {currentAccountStepLabel}
        </p>
        <ol className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Create account steps">
          {accountSteps.map(({ label, icon: Icon }, index) => {
            const itemStep = (index + 1) as 1 | 2 | 3 | 4
            const isActive = step === itemStep
            const isComplete = step > itemStep
            const canNavigate = canNavigateToAccountStep(itemStep)

            return (
              <li
                key={label}
                className="min-w-0"
              >
                <button
                  type="button"
                  aria-current={isActive ? "step" : undefined}
                  aria-label={`Go to ${label} step`}
                  disabled={!canNavigate}
                  onClick={() => setStep(itemStep)}
                  className={cn(
                    "flex min-h-12 w-full min-w-0 items-center gap-2 rounded-lg border px-2 py-2 text-left text-sm transition-colors duration-150 sm:px-3",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    canNavigate && "hover:bg-muted/50",
                    !canNavigate && "cursor-not-allowed opacity-55",
                    isActive && "border-primary bg-primary/5",
                    isComplete && "bg-muted/50"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-md border bg-background",
                      isActive && "border-primary text-primary"
                    )}
                  >
                    {isComplete ? <CheckIcon className="size-4" /> : <Icon className="size-4" />}
                  </span>
                  <span className="truncate font-medium">{label}</span>
                </button>
              </li>
            )
          })}
        </ol>

        <div className="min-h-0 overflow-y-auto pr-1">
        {step === 1 ? (
          <div className="grid gap-4">
            <div className="flex items-center gap-2">
              <Building2Icon className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium">Account basics</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="create-account-name">Account name</Label>
                <Input
                  id="create-account-name"
                  value={accountName}
                  placeholder="e.g. Southern Cross Energy"
                  onChange={(event) => setAccountName(event.currentTarget.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-account-website">Website or domain</Label>
                <Input
                  id="create-account-website"
                  value={website}
                  placeholder="e.g. southerncrossenergy.com.au"
                  onChange={(event) => handleWebsiteChange(event.currentTarget.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-account-industry">Industry</Label>
                <Input
                  id="create-account-industry"
                  value={industry}
                  placeholder="Optional"
                  onChange={(event) => setIndustry(event.currentTarget.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-account-region">Location</Label>
                <Input
                  id="create-account-region"
                  value={region}
                  placeholder="Australia"
                  onChange={(event) => setRegion(event.currentTarget.value)}
                />
              </div>
              <CurrencySelect
                id="create-account-currency"
                value={currency}
                onChange={setCurrency}
              />
            </div>
            {duplicateAccount ? (
              <div className="grid gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                <div className="flex items-start gap-2">
                  <CircleAlertIcon className="mt-0.5 size-4" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Possible duplicate account</p>
                    <p className="mt-1 text-sm">
                      {duplicateAccount.name} already looks like this account. Open the existing record instead of creating a duplicate.
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="w-full gap-2 sm:w-fit" onClick={handleOpenExisting}>
                  <Building2Icon />
                  Open existing
                </Button>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">Only account name is required. Add what you know now; SalesFrame can help fill the rest from the account record.</p>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-4">
            <div className="flex items-center gap-2">
              <ListChecksIcon className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium">Account context</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="create-account-employees">Employee size</Label>
                <Input
                  id="create-account-employees"
                  value={employeeCount}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Optional"
                  onChange={(event) => setEmployeeCount(normalizeEmployeeCountInput(event.currentTarget.value))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-account-tools">Current tools</Label>
                <Input
                  id="create-account-tools"
                  value={currentTools}
                  placeholder="Optional"
                  onChange={(event) => setCurrentTools(event.currentTarget.value)}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="create-account-initiatives">Strategic initiatives</Label>
                <Textarea
                  id="create-account-initiatives"
                  value={strategicInitiatives}
                  className="min-h-20 resize-none"
                  placeholder="Optional"
                  onChange={(event) => setStrategicInitiatives(event.currentTarget.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-account-competitors">Competitors</Label>
                <Textarea
                  id="create-account-competitors"
                  value={competitors}
                  className="min-h-20 resize-none"
                  placeholder="Optional"
                  onChange={(event) => setCompetitors(event.currentTarget.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-account-notes">Account notes</Label>
              <Textarea
                id="create-account-notes"
                value={accountNotes}
                className="min-h-20 resize-none"
                placeholder="Free text notes"
                onChange={(event) => setAccountNotes(event.currentTarget.value)}
              />
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-3">
            <div
              className={cn(
                "flex flex-col gap-3 rounded-lg p-3 sm:flex-row sm:items-center sm:justify-between",
                hasSavedOpenAiKey ? "bg-emerald-500/10" : "border border-destructive/40 bg-destructive/10"
              )}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <KeyRoundIcon className="size-4 text-muted-foreground" />
                  <p className="text-sm font-medium">OpenAI connection</p>
                  {hasSavedOpenAiKey && savedOpenAiKeyState ? (
                    <span className="truncate text-xs text-muted-foreground">{savedOpenAiKeyState.maskedKey}</span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hasSavedOpenAiKey
                    ? "Research and AI workflows will use the saved workspace key."
                    : "Add a key in Settings before creating accounts or running research."}
                </p>
              </div>
              {!hasSavedOpenAiKey ? (
                <Button type="button" size="sm" variant="outline" className="w-full gap-2 sm:w-fit" onClick={handleOpenSettings}>
                  <KeyRoundIcon />
                  Open settings
                </Button>
              ) : null}
            </div>

            <div
              className={cn(
                "grid gap-3 rounded-lg bg-muted/30 p-3",
                aiEnrichmentEnabled && !canUseEnrichment && "bg-destructive/10"
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-2">
                  <SparklesIcon className="mt-0.5 size-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Customer Research</p>
                    <p className="text-xs text-muted-foreground">
                      Research this account, fill blank fields, and prepare sales signals from trusted public sources.
                    </p>
                    {aiEnrichmentEnabled && !hasSavedOpenAiKey ? (
                      <p className="mt-1 text-xs text-destructive">Add an OpenAI key in Settings before customer research.</p>
                    ) : aiEnrichmentEnabled && !normalizedWebsite.includes(".") ? (
                      <p className="mt-1 text-xs text-destructive">Enter a website or domain before customer research.</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Label htmlFor="create-account-ai-enrichment" className="text-sm text-muted-foreground">
                    Use customer research
                  </Label>
                  <Switch
                    id="create-account-ai-enrichment"
                    checked={aiEnrichmentEnabled}
                    disabled={!hasSavedOpenAiKey}
                    onCheckedChange={setAiEnrichmentEnabled}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 rounded-lg bg-muted/30 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <SearchIcon className="size-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Seller Research</p>
                    <p className="text-xs text-muted-foreground">
                      {customerResearchEnabled ? "Used to shape live questions for this account." : "Optional context about what you sell."}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Label htmlFor="create-account-research-toggle" className="text-sm text-muted-foreground">
                    Use research
                  </Label>
                  <Switch
                    id="create-account-research-toggle"
                    checked={customerResearchEnabled}
                    disabled={!hasSavedOpenAiKey}
                    onCheckedChange={setCustomerResearchEnabled}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="create-account-seller-domain">Your company domain</Label>
                  <Input
                    id="create-account-seller-domain"
                    value={sellerDomain}
                    disabled={!customerResearchEnabled || !hasSavedOpenAiKey}
                    placeholder="e.g. salesframe.ai"
                    onChange={(event) => handleSellerDomainChange(event.currentTarget.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-account-seller-company">Your company</Label>
                  <Input
                    id="create-account-seller-company"
                    value={sellerCompany}
                    disabled={!customerResearchEnabled || !hasSavedOpenAiKey}
                    placeholder="e.g. SalesFrame"
                    onChange={(event) => setSellerCompany(event.currentTarget.value)}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="create-account-product-context">What you sell</Label>
                <Textarea
                  id="create-account-product-context"
                  value={productContext}
                  disabled={!customerResearchEnabled || !hasSavedOpenAiKey || researchProfileStatus === "loading"}
                  className="min-h-20 resize-none"
                  placeholder={
                    researchProfileStatus === "loading"
                      ? "Looking up your company..."
                      : "Describe the product or offer SalesFrame should connect to buyer research and live questions."
                  }
                  onChange={(event) => setProductContext(event.currentTarget.value)}
                />
                <p
                  className={cn(
                    "text-xs text-muted-foreground",
                    researchProfileStatus === "loading" && "text-primary",
                    researchProfileStatus === "error" && "text-destructive",
                    researchProfileStatus === "success" && "text-emerald-600"
                  )}
                  aria-live={researchProfileStatus === "error" ? "assertive" : "polite"}
                  role={researchProfileStatus === "error" ? "alert" : "status"}
                >
                  {researchProfileMessage ||
                    (customerResearchEnabled
                      ? "Auto-filled from the domain and saved with this account."
                      : "Turn on seller research to save product context for this account.")}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="grid gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <TargetIcon className="size-4 text-muted-foreground" />
                <p className="text-sm font-medium">First opportunity</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Label htmlFor="create-first-opportunity" className="text-sm text-muted-foreground">
                  Create
                </Label>
                <Switch
                  id="create-first-opportunity"
                  checked={createOpportunity}
                  onCheckedChange={setCreateOpportunity}
                />
              </div>
            </div>
            {createOpportunity ? (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="create-opportunity-name">Opportunity name</Label>
                  <Input
                    id="create-opportunity-name"
                    value={opportunityName}
                    placeholder="e.g. Digital Service Modernisation"
                    onChange={(event) => setOpportunityName(event.currentTarget.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 sm:w-fit"
                  onClick={() => setShowOpportunityFields((value) => !value)}
                >
                  <SquarePenIcon />
                  {showOpportunityFields ? "Hide optional fields" : "Show optional fields"}
                </Button>
                {showOpportunityFields ? (
                  <div className="grid gap-4 rounded-lg bg-muted/40 p-3">
                    <div className="grid gap-3 sm:grid-cols-3 sm:items-start">
                      <div className="grid min-w-0 gap-2">
                        <Label htmlFor="create-opportunity-stage">Stage</Label>
                        <Select value={stage} onValueChange={setStage}>
                          <SelectTrigger id="create-opportunity-stage" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["Qualification", "Discovery", "Validation", "Proposal", "Negotiation"].map((item) => (
                              <SelectItem key={item} value={item}>
                                {item}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid min-w-0 gap-2">
                        <Label htmlFor="create-opportunity-amount">Amount</Label>
                        <Input
                          id="create-opportunity-amount"
                          value={amount}
                          placeholder={`Optional (${currency})`}
                          onChange={(event) => setAmount(event.currentTarget.value)}
                          onBlur={() =>
                            setAmount((value) => value.trim() ? formatCurrencyAmount(value, currency) : "")
                          }
                        />
                      </div>
                      <div className="grid min-w-0 gap-2">
                        <Label htmlFor="create-opportunity-close-date">Close date</Label>
                        <DatePicker
                          id="create-opportunity-close-date"
                          className="w-full"
                          value={closeDate}
                          placeholder="Optional"
                          onChange={setCloseDate}
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="create-opportunity-playbooks">Playbooks</Label>
                      <PlaybookMultiSelect
                        id="create-opportunity-playbooks"
                        value={selectedPlaybooks}
                        onChange={setSelectedPlaybooks}
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="create-opportunity-next-step">Next step</Label>
                        <Textarea
                          id="create-opportunity-next-step"
                          value={nextStep}
                          className="min-h-20 resize-none"
                          placeholder="Optional"
                          onChange={(event) => setNextStep(event.currentTarget.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="create-opportunity-pain">Known pain</Label>
                        <Textarea
                          id="create-opportunity-pain"
                          value={pain}
                          className="min-h-20 resize-none"
                          placeholder="Optional"
                          onChange={(event) => setPain(event.currentTarget.value)}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                The account will be created without an opportunity. Add the first opportunity from the account page or Start Call flow when you are ready.
              </div>
            )}
          </div>
        ) : null}

        {createError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {createError}
          </div>
        ) : null}

        {createSubmitting && createProgressMessage ? (
          <div className="grid gap-2 rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground" aria-live="polite">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <SparklesIcon className="size-4" />
              Preparing account
            </div>
            <p>{createProgressMessage}</p>
            {aiEnrichmentEnabled ? (
              <div className="grid gap-1 text-xs">
                <span>Researching account</span>
                <span>Filling blank fields</span>
                <span>Preparing sales signals</span>
              </div>
            ) : null}
          </div>
        ) : null}
        </div>

        <DialogActions
          cancelAction={
            <Button
              variant="outline"
              className="gap-2"
              disabled={createSubmitting}
              onClick={step === 1 ? () => handleOpenChange(false) : handleBack}
            >
              {step === 1 ? null : <ArrowLeftIcon />}
              {step === 1 ? "Cancel" : "Back"}
            </Button>
          }
          primaryAction={step === 4 ? (
            <Button className="gap-2" disabled={!canCreate || createSubmitting} onClick={handleCreate}>
              <Building2Icon />
              {createSubmitting ? "Creating..." : "Create account"}
            </Button>
          ) : (
            <Button className="gap-2" disabled={!canContinue || createSubmitting} onClick={handleNext}>
              Continue
              <ArrowRightIcon />
            </Button>
          )}
        />
      </DialogContent>
    </Dialog>
  )
}

function EditAccountDialog({
  account,
  draft,
  open,
  savedDraft,
  onEditAccount,
  onOpenChange,
}: {
  account?: AccountNavItem
  draft?: AccountDraft
  open: boolean
  savedDraft?: AccountDraft
  onEditAccount: (payload: EditAccountPayload) => Promise<RecordMutationResult> | RecordMutationResult
  onOpenChange: (open: boolean) => void
}) {
  const [accountName, setAccountName] = React.useState("")
  const [website, setWebsite] = React.useState("")
  const [industry, setIndustry] = React.useState("")
  const [employeeCount, setEmployeeCount] = React.useState("")
  const [region, setRegion] = React.useState("")
  const [currency, setCurrency] = React.useState<CurrencyCode>(defaultCurrencyCode)
  const [currentTools, setCurrentTools] = React.useState("")
  const [strategicInitiatives, setStrategicInitiatives] = React.useState("")
  const [competitors, setCompetitors] = React.useState("")
  const [accountNotes, setAccountNotes] = React.useState("")
  const [editError, setEditError] = React.useState("")
  const [editSubmitting, setEditSubmitting] = React.useState(false)
  const [savedEditDraft, setSavedEditDraft] = React.useState<AccountDraft | null>(null)

  React.useEffect(() => {
    if (!open || !account) return

    const nextDraft: AccountDraft = {
      accountName: draft?.accountName ?? account.name,
      website: draft?.website ?? "",
      industry: draft?.industry ?? account.description,
      employeeCount: draft?.employeeCount ?? "",
      region: draft?.region ?? "Australia",
      currency: draft?.currency ?? account.currency,
      currentTools: draft?.currentTools ?? "",
      strategicInitiatives: draft?.strategicInitiatives ?? "",
      competitors: draft?.competitors ?? "",
      accountNotes: draft?.accountNotes ?? "",
    }
    const nextSavedDraft = savedDraft ?? nextDraft

    setAccountName(nextDraft.accountName)
    setWebsite(nextDraft.website)
    setIndustry(nextDraft.industry)
    setEmployeeCount(nextDraft.employeeCount)
    setRegion(nextDraft.region)
    setCurrency(nextDraft.currency)
    setCurrentTools(nextDraft.currentTools)
    setStrategicInitiatives(nextDraft.strategicInitiatives)
    setCompetitors(nextDraft.competitors)
    setAccountNotes(nextDraft.accountNotes)
    setSavedEditDraft(nextSavedDraft)
    setEditError("")
    setEditSubmitting(false)
  }, [account, draft, open, savedDraft])

  const currentEditDraft = React.useMemo<AccountDraft>(() => ({
    accountName,
    website,
    industry,
    employeeCount,
    region,
    currency,
    currentTools,
    strategicInitiatives,
    competitors,
    accountNotes,
  }), [accountName, website, industry, employeeCount, region, currency, currentTools, strategicInitiatives, competitors, accountNotes])
  const hasEditChanges = savedEditDraft ? !areAccountDraftsEqual(currentEditDraft, savedEditDraft) : false
  const canSave = Boolean(account) && accountName.trim().length > 0 && hasEditChanges

  const handleSave = async () => {
    if (!canSave || !account) return

    setEditError("")
    setEditSubmitting(true)
    const result = await onEditAccount({
      accountId: account.id,
      accountName,
      website,
      industry,
      employeeCount,
      region,
      currency,
      currentTools,
      strategicInitiatives,
      competitors,
      accountNotes,
    })

    if (!result.ok) {
      setEditError(result.message)
      setEditSubmitting(false)
      return
    }

    setEditSubmitting(false)
  }

  return (
    <Dialog open={open && Boolean(account)} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100svh-2rem)] overflow-y-auto max-sm:max-h-[calc(100svh-0.75rem)] max-sm:max-w-[calc(100%-0.75rem)] max-sm:[&_[data-slot=button]]:min-h-11 max-sm:[&_[data-slot=button]]:px-4 max-sm:[&_[data-slot=input]]:min-h-11 max-sm:[&_[data-slot=select-trigger]]:min-h-11 sm:max-w-2xl"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Edit account fields</DialogTitle>
          <DialogDescription>
            Update the seller-owned account record. Opportunity and call intelligence stay on their own records.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="flex items-center gap-2">
            <Building2Icon className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium">Account basics</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-account-name">Account name</Label>
              <Input
                id="edit-account-name"
                value={accountName}
                placeholder="Account name"
                onChange={(event) => setAccountName(event.currentTarget.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-account-website">Website or domain</Label>
              <Input
                id="edit-account-website"
                value={website}
                placeholder="company.com.au"
                onChange={(event) => setWebsite(event.currentTarget.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-account-industry">Industry</Label>
              <Input
                id="edit-account-industry"
                value={industry}
                placeholder="Industry"
                onChange={(event) => setIndustry(event.currentTarget.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-account-employees">Employees</Label>
              <Input
                id="edit-account-employees"
                value={employeeCount}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Employee size"
                onChange={(event) => setEmployeeCount(normalizeEmployeeCountInput(event.currentTarget.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-account-region">Location</Label>
              <Input
                id="edit-account-region"
                value={region}
                placeholder="Australia"
                onChange={(event) => setRegion(event.currentTarget.value)}
              />
            </div>
            <CurrencySelect
              id="edit-account-currency"
              value={currency}
              onChange={setCurrency}
            />
          </div>
        </div>

        <div className="grid gap-4">
          <div className="flex items-center gap-2">
            <SquarePenIcon className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium">Account context</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-account-tools">Current tools</Label>
              <Textarea
                id="edit-account-tools"
                value={currentTools}
                className="min-h-20 resize-none"
                placeholder="Known systems or tools"
                onChange={(event) => setCurrentTools(event.currentTarget.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-account-initiatives">Strategic initiatives</Label>
              <Textarea
                id="edit-account-initiatives"
                value={strategicInitiatives}
                className="min-h-20 resize-none"
                placeholder="Current business priorities"
                onChange={(event) => setStrategicInitiatives(event.currentTarget.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-account-competitors">Competitors</Label>
              <Textarea
                id="edit-account-competitors"
                value={competitors}
                className="min-h-20 resize-none"
                placeholder="Known competitive context"
                onChange={(event) => setCompetitors(event.currentTarget.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-account-notes">Account notes</Label>
              <Textarea
                id="edit-account-notes"
                value={accountNotes}
                className="min-h-20 resize-none"
                placeholder="Free text notes"
                onChange={(event) => setAccountNotes(event.currentTarget.value)}
              />
            </div>
          </div>
        </div>

        {editError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {editError}
          </div>
        ) : null}

        <DialogActions
          cancelDisabled={editSubmitting}
          onCancel={() => onOpenChange(false)}
          primaryAction={
            <Button className="gap-2" disabled={!canSave || editSubmitting} onClick={handleSave}>
              <Building2Icon />
              {editSubmitting ? "Saving..." : "Save account"}
            </Button>
          }
        />
      </DialogContent>
    </Dialog>
  )
}

function CreateOpportunityDialog({
  accounts,
  defaultAccountId,
  open,
  onCreateOpportunity,
  onOpenChange,
}: {
  accounts: AccountNavItem[]
  defaultAccountId: string
  open: boolean
  onCreateOpportunity: (payload: CreateOpportunityPayload) => Promise<RecordMutationResult> | RecordMutationResult
  onOpenChange: (open: boolean) => void
}) {
  const [accountId, setAccountId] = React.useState(defaultAccountId)
  const [opportunityName, setOpportunityName] = React.useState("")
  const [stage, setStage] = React.useState("Qualification")
  const [amount, setAmount] = React.useState("")
  const [closeDate, setCloseDate] = React.useState("")
  const [selectedPlaybooks, setSelectedPlaybooks] = React.useState<CallPlaybook[]>(defaultCallPlaybooks)
  const [showOptionalFields, setShowOptionalFields] = React.useState(false)
  const [nextStep, setNextStep] = React.useState("")
  const [pain, setPain] = React.useState("")
  const [decisionProcess, setDecisionProcess] = React.useState("")
  const [manualNotes, setManualNotes] = React.useState("")
  const [createError, setCreateError] = React.useState("")
  const [createSubmitting, setCreateSubmitting] = React.useState(false)

  const selectedAccount = accounts.find((account) => account.id === accountId)
  const canCreate = Boolean(accountId) && opportunityName.trim().length > 0

  const reset = React.useCallback(() => {
    setAccountId(defaultAccountId || accounts[0]?.id || "")
    setOpportunityName("")
    setStage("Qualification")
    setAmount("")
    setCloseDate("")
    setSelectedPlaybooks(defaultCallPlaybooks)
    setShowOptionalFields(false)
    setNextStep("")
    setPain("")
    setDecisionProcess("")
    setManualNotes("")
    setCreateError("")
    setCreateSubmitting(false)
  }, [accounts, defaultAccountId])

  React.useEffect(() => {
    if (open) {
      reset()
    }
  }, [open, reset])

  const handleOpenChange = (value: boolean) => {
    if (!value && createSubmitting) return
    onOpenChange(value)
  }

  const handleCreate = async () => {
    if (!canCreate || createSubmitting) return

    setCreateSubmitting(true)
    setCreateError("")

    try {
      const result = await onCreateOpportunity({
        accountId,
        opportunityName,
        stage,
        amount,
        closeDate,
        playbooks: selectedPlaybooks,
        nextStep,
        pain,
        decisionProcess,
        manualNotes,
      })

      if (!result.ok) {
        setCreateError(result.message)
        return
      }

      onOpenChange(false)
    } catch (caughtError: unknown) {
      setCreateError(getUserFacingErrorMessage(caughtError, "Opportunity setup needs another try."))
    } finally {
      setCreateSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[calc(100svh-2rem)] overflow-y-auto max-sm:max-h-[calc(100svh-0.75rem)] max-sm:max-w-[calc(100%-0.75rem)] max-sm:[&_[data-slot=button]]:min-h-11 max-sm:[&_[data-slot=button]]:px-4 max-sm:[&_[data-slot=input]]:min-h-11 max-sm:[&_[data-slot=select-trigger]]:min-h-11 sm:max-w-2xl"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Add opportunity</DialogTitle>
          <DialogDescription>
            Create a deal record under an account and choose the playbooks the live coach should enforce.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="flex items-center gap-2">
            <TargetIcon className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium">Opportunity basics</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1.1fr]">
            <div className="grid gap-2">
              <Label htmlFor="add-opportunity-account">Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger id="add-opportunity-account" className="w-full">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-opportunity-name">Opportunity name</Label>
              <Input
                id="add-opportunity-name"
                value={opportunityName}
                placeholder="e.g. Customer Service Modernisation"
                onChange={(event) => setOpportunityName(event.currentTarget.value)}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1.1fr]">
            <div className="grid gap-2">
              <Label htmlFor="add-opportunity-stage">Stage</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger id="add-opportunity-stage" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Qualification", "Discovery", "Validation", "Demo", "Business case", "Proposal", "Negotiation"].map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-opportunity-playbooks">Playbooks</Label>
              <PlaybookMultiSelect
                id="add-opportunity-playbooks"
                value={selectedPlaybooks}
                onChange={setSelectedPlaybooks}
              />
            </div>
          </div>
          <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
            {selectedAccount
              ? `This opportunity will appear under ${selectedAccount.name} and use these playbooks for live guidance.`
              : "Select an account before creating the opportunity."}
          </div>
        </div>

        <div className="grid gap-3 rounded-lg bg-muted/40 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <SquarePenIcon className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium">Optional fields</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2 sm:w-auto"
              disabled={createSubmitting}
              onClick={() => setShowOptionalFields((value) => !value)}
            >
              {showOptionalFields ? "Hide fields" : "Show fields"}
            </Button>
          </div>

          {showOptionalFields ? (
            <div className="grid gap-3">
              <div className="grid items-start gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="add-opportunity-amount">Amount</Label>
                  <Input
                    id="add-opportunity-amount"
                    value={amount}
                    placeholder={`Optional (${selectedAccount?.currency ?? defaultCurrencyCode})`}
                    onChange={(event) => setAmount(event.currentTarget.value)}
                    onBlur={() =>
                      setAmount((value) =>
                        value.trim() ? formatCurrencyAmount(value, selectedAccount?.currency) : ""
                      )
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="add-opportunity-close-date">Close date</Label>
                  <DatePicker
                    id="add-opportunity-close-date"
                    value={closeDate}
                    placeholder="Optional"
                    onChange={setCloseDate}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="add-opportunity-next-step">Next step</Label>
                  <Textarea
                    id="add-opportunity-next-step"
                    value={nextStep}
                    className="min-h-16 resize-none"
                    placeholder="Optional"
                    onChange={(event) => setNextStep(event.currentTarget.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="add-opportunity-pain">Known pain</Label>
                  <Textarea
                    id="add-opportunity-pain"
                    value={pain}
                    className="min-h-16 resize-none"
                    placeholder="Optional"
                    onChange={(event) => setPain(event.currentTarget.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="add-opportunity-decision-process">Decision process</Label>
                  <Textarea
                    id="add-opportunity-decision-process"
                    value={decisionProcess}
                    className="min-h-16 resize-none"
                    placeholder="Optional"
                    onChange={(event) => setDecisionProcess(event.currentTarget.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="add-opportunity-notes">Manual notes</Label>
                  <Textarea
                    id="add-opportunity-notes"
                    value={manualNotes}
                    className="min-h-16 resize-none"
                    placeholder="Optional"
                    onChange={(event) => setManualNotes(event.currentTarget.value)}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Only opportunity name is required. Add commercial context now, or complete it from the opportunity record.
            </p>
          )}
        </div>

        {createError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {createError}
          </div>
        ) : null}

        <DialogActions
          cancelDisabled={createSubmitting}
          onCancel={() => handleOpenChange(false)}
          primaryAction={
            <Button className="gap-2" disabled={!canCreate || createSubmitting} onClick={handleCreate}>
              <TargetIcon />
              {createSubmitting ? "Creating..." : "Create opportunity"}
            </Button>
          }
        />
      </DialogContent>
    </Dialog>
  )
}

function EditOpportunityDialog({
  accounts,
  draft,
  opportunity,
  open,
  savedDraft,
  onEditOpportunity,
  onOpenChange,
}: {
  accounts: AccountNavItem[]
  draft?: OpportunityDraft
  opportunity?: Opportunity
  open: boolean
  savedDraft?: OpportunityDraft
  onEditOpportunity: (payload: EditOpportunityPayload) => Promise<RecordMutationResult> | RecordMutationResult
  onOpenChange: (open: boolean) => void
}) {
  const [accountId, setAccountId] = React.useState("")
  const [opportunityName, setOpportunityName] = React.useState("")
  const [stage, setStage] = React.useState("Discovery")
  const [amount, setAmount] = React.useState("")
  const [closeDate, setCloseDate] = React.useState("")
  const [source, setSource] = React.useState("")
  const [selectedPlaybooks, setSelectedPlaybooks] = React.useState<CallPlaybook[]>(defaultCallPlaybooks)
  const [nextStep, setNextStep] = React.useState("")
  const [pain, setPain] = React.useState("")
  const [decisionProcess, setDecisionProcess] = React.useState("")
  const [manualNotes, setManualNotes] = React.useState("")
  const [editError, setEditError] = React.useState("")
  const [editSubmitting, setEditSubmitting] = React.useState(false)
  const [savedEditAccountId, setSavedEditAccountId] = React.useState("")
  const [savedEditDraft, setSavedEditDraft] = React.useState<OpportunityDraft | null>(null)

  React.useEffect(() => {
    if (!open || !opportunity) return

    const nextDraft: OpportunityDraft = {
      opportunityName: draft?.opportunityName ?? opportunity.name,
      stage: draft?.stage ?? opportunity.stage,
      amount: draft?.amount ?? opportunity.amount,
      closeDate: draft?.closeDate ?? opportunity.closeDate,
      source: draft?.source ?? "",
      frameworks: formatPlaybooks(parsePlaybookSelection(draft?.frameworks)),
      nextStep: draft?.nextStep ?? "",
      pain: draft?.pain ?? "",
      decisionProcess: draft?.decisionProcess ?? "",
      manualNotes: draft?.manualNotes ?? "",
    }
    const nextAccountId = opportunity.accountId
    const nextSavedDraft = savedDraft ?? nextDraft

    setAccountId(nextAccountId)
    setOpportunityName(nextDraft.opportunityName)
    setStage(nextDraft.stage)
    setAmount(nextDraft.amount)
    setCloseDate(nextDraft.closeDate)
    setSource(nextDraft.source)
    setSelectedPlaybooks(parsePlaybookSelection(nextDraft.frameworks))
    setNextStep(nextDraft.nextStep)
    setPain(nextDraft.pain)
    setDecisionProcess(nextDraft.decisionProcess)
    setManualNotes(nextDraft.manualNotes)
    setSavedEditAccountId(nextAccountId)
    setSavedEditDraft(nextSavedDraft)
    setEditError("")
    setEditSubmitting(false)
  }, [draft, open, opportunity, savedDraft])

  const selectedAccount = accounts.find((account) => account.id === accountId)
  const currentEditDraft = React.useMemo<OpportunityDraft>(() => ({
    opportunityName,
    stage,
    amount,
    closeDate,
    source,
    frameworks: formatPlaybooks(selectedPlaybooks),
    nextStep,
    pain,
    decisionProcess,
    manualNotes,
  }), [opportunityName, stage, amount, closeDate, source, selectedPlaybooks, nextStep, pain, decisionProcess, manualNotes])
  const hasEditChanges = savedEditDraft
    ? accountId !== savedEditAccountId || !areOpportunityDraftsEqual(currentEditDraft, savedEditDraft)
    : false
  const canSave = Boolean(opportunity) && Boolean(accountId) && opportunityName.trim().length > 0 && hasEditChanges

  const handleSave = async () => {
    if (!canSave || !opportunity) return

    setEditError("")
    setEditSubmitting(true)
    const result = await onEditOpportunity({
      opportunityId: opportunity.id,
      accountId,
      opportunityName,
      stage,
      amount,
      closeDate,
      source,
      playbooks: selectedPlaybooks,
      nextStep,
      pain,
      decisionProcess,
      manualNotes,
    })

    if (!result.ok) {
      setEditError(result.message)
      setEditSubmitting(false)
      return
    }

    setEditSubmitting(false)
  }

  return (
    <Dialog open={open && Boolean(opportunity)} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100svh-2rem)] overflow-y-auto max-sm:max-h-[calc(100svh-0.75rem)] max-sm:max-w-[calc(100%-0.75rem)] max-sm:[&_[data-slot=button]]:min-h-11 max-sm:[&_[data-slot=button]]:px-4 max-sm:[&_[data-slot=input]]:min-h-11 max-sm:[&_[data-slot=select-trigger]]:min-h-11 sm:max-w-2xl"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Edit opportunity fields</DialogTitle>
          <DialogDescription>
            Update the seller-owned opportunity record. Intelligence fields stay separate and are updated by calls and AI outputs.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="flex items-center gap-2">
            <TargetIcon className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium">Opportunity basics</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1.1fr]">
            <div className="grid gap-2">
              <Label htmlFor="edit-opportunity-account">Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger id="edit-opportunity-account" className="w-full">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-opportunity-name">Opportunity name</Label>
              <Input
                id="edit-opportunity-name"
                value={opportunityName}
                placeholder="Opportunity name"
                onChange={(event) => setOpportunityName(event.currentTarget.value)}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-opportunity-stage">Stage</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger id="edit-opportunity-stage" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Qualification", "Discovery", "Validation", "Demo", "Business case", "Proposal", "Negotiation", "Closed won"].map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-opportunity-playbooks">Playbooks</Label>
              <PlaybookMultiSelect
                id="edit-opportunity-playbooks"
                value={selectedPlaybooks}
                onChange={setSelectedPlaybooks}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-opportunity-amount">Amount</Label>
              <Input
                id="edit-opportunity-amount"
                value={amount}
                placeholder={`Amount (${selectedAccount?.currency ?? defaultCurrencyCode})`}
                onChange={(event) => setAmount(event.currentTarget.value)}
                onBlur={() =>
                  setAmount((value) =>
                    value.trim() ? formatCurrencyAmount(value, selectedAccount?.currency) : ""
                  )
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-opportunity-close-date">Close date</Label>
              <DatePicker
                id="edit-opportunity-close-date"
                value={closeDate}
                placeholder="Close date"
                onChange={setCloseDate}
              />
            </div>
          </div>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="edit-opportunity-source">Source</Label>
              <Input
                id="edit-opportunity-source"
                value={source}
                placeholder="Source"
                onChange={(event) => setSource(event.currentTarget.value)}
              />
            </div>
          </div>
          <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
            {selectedAccount
              ? `Saving will keep this opportunity under ${selectedAccount.name}.`
              : "Select an account before saving."}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="flex items-center gap-2">
            <SquarePenIcon className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium">Seller notes</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-opportunity-next-step">Next step</Label>
              <Textarea
                id="edit-opportunity-next-step"
                value={nextStep}
                className="min-h-20 resize-none"
                onChange={(event) => setNextStep(event.currentTarget.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-opportunity-pain">Pain</Label>
              <Textarea
                id="edit-opportunity-pain"
                value={pain}
                className="min-h-20 resize-none"
                onChange={(event) => setPain(event.currentTarget.value)}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-opportunity-decision-process">Decision process</Label>
              <Textarea
                id="edit-opportunity-decision-process"
                value={decisionProcess}
                className="min-h-20 resize-none"
                onChange={(event) => setDecisionProcess(event.currentTarget.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-opportunity-notes">Manual notes</Label>
              <Textarea
                id="edit-opportunity-notes"
                value={manualNotes}
                className="min-h-20 resize-none"
                onChange={(event) => setManualNotes(event.currentTarget.value)}
              />
            </div>
          </div>
        </div>

        {editError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {editError}
          </div>
        ) : null}

        <DialogActions
          cancelDisabled={editSubmitting}
          onCancel={() => onOpenChange(false)}
          primaryAction={
            <Button className="gap-2" disabled={!canSave || editSubmitting} onClick={handleSave}>
              <CheckCircle2Icon />
              {editSubmitting ? "Saving..." : "Save changes"}
            </Button>
          }
        />
      </DialogContent>
    </Dialog>
  )
}

function DeleteRecordDialog({
  record,
  onCancel,
  onConfirm,
}: {
  record: PendingDeleteRecord | null
  onCancel: () => void
  onConfirm: () => Promise<RecordMutationResult> | RecordMutationResult
}) {
  const [deleteError, setDeleteError] = React.useState("")
  const [deleteSubmitting, setDeleteSubmitting] = React.useState(false)

  React.useEffect(() => {
    setDeleteError("")
    setDeleteSubmitting(false)
  }, [record?.id])

  if (!record) return null

  const recordLabel =
    record.type === "account" ? "account" : record.type === "call" ? "call" : "opportunity"
  const handleDelete = async () => {
    setDeleteError("")
    setDeleteSubmitting(true)
    const result = await onConfirm()

    if (!result.ok) {
      setDeleteError(result.message)
      setDeleteSubmitting(false)
      return
    }

    setDeleteSubmitting(false)
    onCancel()
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
          <DialogTitle>Delete {recordLabel}</DialogTitle>
          <DialogDescription>
            This action removes the selected record from this workspace. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg bg-muted/30 p-3">
          <p className="text-sm font-medium">{record.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{record.detail}</p>
        </div>
        {deleteError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {deleteError}
          </div>
        ) : null}
        <DialogActions
          cancelDisabled={deleteSubmitting}
          onCancel={onCancel}
          primaryAction={
            <Button variant="destructive" disabled={deleteSubmitting} onClick={handleDelete}>
              {deleteSubmitting ? "Deleting..." : `Delete ${recordLabel}`}
            </Button>
          }
        />
      </DialogContent>
    </Dialog>
  )
}

function ArchiveRecordDialog({
  record,
  onCancel,
  onConfirm,
}: {
  record: PendingArchiveRecord | null
  onCancel: () => void
  onConfirm: () => Promise<RecordMutationResult> | RecordMutationResult
}) {
  const [archiveError, setArchiveError] = React.useState("")
  const [archiveSubmitting, setArchiveSubmitting] = React.useState(false)

  React.useEffect(() => {
    setArchiveError("")
    setArchiveSubmitting(false)
  }, [record?.id])

  if (!record) return null

  const recordLabel = record.type === "account" ? "account" : "opportunity"
  const handleArchive = async () => {
    setArchiveError("")
    setArchiveSubmitting(true)
    const result = await onConfirm()

    if (!result.ok) {
      setArchiveError(result.message)
      setArchiveSubmitting(false)
      return
    }

    setArchiveSubmitting(false)
    onCancel()
  }

  return (
    <Dialog open onOpenChange={(nextOpen) => (!nextOpen && !archiveSubmitting ? onCancel() : undefined)}>
      <DialogContent
        className="max-sm:max-w-[calc(100%-0.75rem)] max-sm:[&_[data-slot=button]]:min-h-11 max-sm:[&_[data-slot=button]]:px-4 sm:max-w-md"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <ArchiveIcon className="size-5" />
          </div>
          <DialogTitle>Archive {recordLabel}</DialogTitle>
          <DialogDescription>
            This hides the record from active workspace views. You can restore it from your Account page.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg bg-muted/30 p-3">
          <p className="text-sm font-medium">{record.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{record.detail}</p>
        </div>
        {archiveError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {archiveError}
          </div>
        ) : null}
        <DialogActions
          cancelDisabled={archiveSubmitting}
          onCancel={onCancel}
          primaryAction={
            <Button className="gap-2" disabled={archiveSubmitting} onClick={handleArchive}>
              <ArchiveIcon />
              {archiveSubmitting ? "Archiving..." : `Archive ${recordLabel}`}
            </Button>
          }
        />
      </DialogContent>
    </Dialog>
  )
}

function PlaybookMultiSelect({
  id,
  value,
  onChange,
}: {
  id: string
  value: CallPlaybook[]
  onChange: (value: CallPlaybook[]) => void
}) {
  const [open, setOpen] = React.useState(false)
  const selectedPlaybooks = normalizePlaybooks(value)
  const visiblePlaybooks = selectedPlaybooks.slice(0, 2)
  const hiddenPlaybookCount = Math.max(0, selectedPlaybooks.length - visiblePlaybooks.length)
  const selectedPlaybookLabel = selectedPlaybooks.length ? formatPlaybooks(selectedPlaybooks) : "Select playbooks"

  const togglePlaybook = (playbook: CallPlaybook) => {
    const nextValue = selectedPlaybooks.includes(playbook)
      ? selectedPlaybooks.filter((item) => item !== playbook)
      : [...selectedPlaybooks, playbook]

    onChange(nextValue.length ? nextValue : selectedPlaybooks)
  }
  const handleOptionsWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const container = event.currentTarget
    const maxScrollTop = container.scrollHeight - container.clientHeight

    event.stopPropagation()

    if (maxScrollTop <= 0) return

    const isScrollingDown = event.deltaY > 0
    const isScrollingUp = event.deltaY < 0
    const canScrollDown = isScrollingDown && container.scrollTop < maxScrollTop
    const canScrollUp = isScrollingUp && container.scrollTop > 0

    if (!canScrollDown && !canScrollUp) return

    event.preventDefault()
    container.scrollTop = Math.min(maxScrollTop, Math.max(0, container.scrollTop + event.deltaY))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className="h-auto min-h-11 w-full min-w-0 justify-between gap-2 px-3 py-2 text-left font-normal md:min-h-9"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={`Selected playbooks: ${selectedPlaybookLabel}`}
          title={selectedPlaybookLabel}
        >
          <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-sm">
            <span className="truncate">{visiblePlaybooks.length ? visiblePlaybooks.join(", ") : "Select playbooks"}</span>
            {hiddenPlaybookCount > 0 ? (
              <span className="shrink-0 text-muted-foreground">+{hiddenPlaybookCount} more</span>
            ) : null}
          </span>
          <ChevronDownIcon className={cn("size-4 shrink-0 transition-transform duration-200 ease-linear", open && "rotate-180")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        sideOffset={6}
        collisionPadding={12}
        avoidCollisions
        role="listbox"
        aria-multiselectable="true"
        data-vaul-no-drag=""
        className="z-[80] w-(--radix-popover-trigger-width) min-w-64 overflow-hidden rounded-lg p-0 shadow-lg"
        onEscapeKeyDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen(false)
        }}
      >
        <div
          data-vaul-no-drag=""
          className="grid max-h-[min(18rem,calc(100svh-8rem))] gap-1 overflow-y-auto overscroll-contain p-1"
          onWheelCapture={handleOptionsWheel}
          onTouchMoveCapture={(event) => event.stopPropagation()}
        >
          {callPlaybookOptions.map((playbook) => {
            const isSelected = selectedPlaybooks.includes(playbook)

            return (
              <button
                key={playbook}
                type="button"
                role="option"
                aria-selected={isSelected}
                className="grid w-full grid-cols-[20px_1fr] gap-2 rounded-md px-2 py-2 text-left transition-[background-color,color,box-shadow,opacity] duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => togglePlaybook(playbook)}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-4 items-center justify-center rounded border",
                    isSelected && "border-primary bg-primary text-primary-foreground"
                  )}
                >
                  {isSelected ? <CheckIcon className="size-3" /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{playbook}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {callPlaybookDescriptions[playbook]}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function HomeDashboard({
  accounts,
  accountResearchById,
  defaultCurrency,
  opportunities,
  opportunityDrafts,
  playbookFields,
  playbookRows,
  savedOpenAiKeyState,
  sellerResearchProfile,
  workspaceId,
  onOpenSettings,
  onOpenOpportunities,
  onOpportunitySelect,
  onStartRecording,
}: {
  accounts: AccountNavItem[]
  accountResearchById: Record<string, CustomerResearchConfig>
  defaultCurrency: CurrencyCode
  opportunities: Opportunity[]
  opportunityDrafts: Record<string, OpportunityDraft>
  playbookFields: PlaybookFieldRow[]
  playbookRows: PlaybookRow[]
  savedOpenAiKeyState: SavedOpenAiKeyState | null
  sellerResearchProfile: SellerResearchProfile
  workspaceId: string
  onOpenSettings: () => void
  onOpenOpportunities: () => void
  onOpportunitySelect: (id: string) => void
  onStartRecording: StartRecordingHandler
}) {
  const dashboardPreviewLimit = 10
  const [focusQuery, setFocusQuery] = React.useState("")
  const [focusCoverageFilter, setFocusCoverageFilter] = React.useState<OpportunityCoverageFilter>("all")
  const [focusSort, setFocusSort] = React.useState<OpportunitySort>("gaps")
  const accountById = React.useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts])
  const displayOpportunities = React.useMemo(
    () =>
      opportunities.map((opportunity) =>
        applyOpportunityMethodologySummary(
          opportunity,
          getOpportunityMethodologySummary({
            opportunity,
            playbookFields,
            playbookRows,
            selectedPlaybooks: parsePlaybookSelection(opportunityDrafts[opportunity.id]?.frameworks),
          })
        )
      ),
    [opportunities, opportunityDrafts, playbookFields, playbookRows]
  )
  const averageCoverage = displayOpportunities.length
    ? Math.round(displayOpportunities.reduce((total, opportunity) => total + opportunity.coverage, 0) / displayOpportunities.length)
    : 0
  const totalGaps = displayOpportunities.reduce((total, opportunity) => total + opportunity.missing + opportunity.weak, 0)
  const totalValue = displayOpportunities.reduce((total, opportunity) => total + parseOpportunityAmount(opportunity.amount), 0)
  const attentionCount = displayOpportunities.filter((opportunity) => opportunity.coverage < 65 || opportunity.missing >= 5).length
  const sortedCoverageOpportunities = [...displayOpportunities].sort((left, right) => left.coverage - right.coverage)
  const coverageOpportunities = getDashboardCoverageOpportunities(displayOpportunities, dashboardPreviewLimit)
  const filteredFocusOpportunities = sortOpportunities(
    getFuzzyMatches(
      displayOpportunities.filter((item) => matchesCoverageFilter(item, focusCoverageFilter)),
      focusQuery,
      (item) => getOpportunitySearchText(item, accountById.get(item.accountId), opportunityDrafts[item.id])
    ),
    focusSort
  )
  const visibleFocusOpportunities = filteredFocusOpportunities.slice(0, dashboardPreviewLimit)
  const hiddenFocusCount = Math.max(0, filteredFocusOpportunities.length - visibleFocusOpportunities.length)
  const hiddenCoverageCount = Math.max(0, sortedCoverageOpportunities.length - coverageOpportunities.length)
  const hasFocusFilters = Boolean(focusQuery.trim()) || focusCoverageFilter !== "all" || focusSort !== "gaps"

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Seller dashboard</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Pipeline health, methodology coverage, and the next records to tighten.
          </p>
        </div>
        <StartRecordingDialog
          accounts={accounts}
          accountResearchById={accountResearchById}
          opportunityDrafts={opportunityDrafts}
          opportunities={opportunities}
          savedOpenAiKeyState={savedOpenAiKeyState}
          sellerResearchProfile={sellerResearchProfile}
          workspaceId={workspaceId}
          triggerLabel="Start call"
          triggerVariant="destructive"
          onOpenSettings={onOpenSettings}
          onStartRecording={onStartRecording}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <DashboardMetric label="Pipeline value" value={formatCurrencyAmount(totalValue, defaultCurrency, { compact: true })} />
        <DashboardMetric label="Avg. coverage" value={`${averageCoverage}%`} />
        <DashboardMetric label="Open gaps" value={totalGaps.toString()} />
        <DashboardMetric label="Needs attention" value={attentionCount.toString()} />
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Coverage by opportunity</CardTitle>
            <CardDescription>
              Representative spread across coverage health
              {hiddenCoverageCount ? `, showing ${coverageOpportunities.length} of ${sortedCoverageOpportunities.length}` : ""}
            </CardDescription>
          </div>
          <CardAction>
            <Button variant="outline" size="sm" className="h-11 w-full gap-2 sm:w-auto md:h-7" onClick={onOpenOpportunities}>
              <ChartNoAxesColumnIncreasingIcon />
              View all
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {coverageOpportunities.length ? (
            coverageOpportunities.map((opportunity) => {
              const account = accountById.get(opportunity.accountId)

              return (
                <div key={`${opportunity.id}-coverage`} className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{opportunity.name}</p>
                      <p className="text-xs text-muted-foreground">{account?.name ?? "No account linked"}</p>
                    </div>
                    <span className="text-sm font-medium">{opportunity.coverage}%</span>
                  </div>
                  <CoverageProgress
                    value={opportunity.coverage}
                    className="h-2"
                    data-testid="dashboard-coverage-bar"
                  />
                </div>
              )
            })
          ) : (
            <div className="md:col-span-2">
              <ListEmptyState
                icon={<ChartNoAxesColumnIncreasingIcon />}
                title="No opportunity coverage yet"
                message="Create an opportunity or start a call when there is a deal to qualify."
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Opportunity focus</CardTitle>
            <CardDescription>
              Sorted by methodology gaps and coverage risk
              {hiddenFocusCount ? `, showing ${visibleFocusOpportunities.length} of ${filteredFocusOpportunities.length}` : ""}
            </CardDescription>
          </div>
          <CardAction>
            <Button variant="outline" size="sm" className="h-11 w-full gap-2 sm:w-auto md:h-7" onClick={onOpenOpportunities}>
              <Table2Icon />
              View all
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_160px_auto]">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search account, opportunity, stakeholder, or gap"
                value={focusQuery}
                className="h-11 pl-9 md:h-8"
                placeholder="Search account, opportunity, stakeholder, or gap"
                onChange={(event) => setFocusQuery(event.currentTarget.value)}
              />
            </div>
            <Select
              value={focusCoverageFilter}
              onValueChange={(value) => setFocusCoverageFilter(value as OpportunityCoverageFilter)}
            >
              <SelectTrigger className="min-h-11 w-full md:min-h-8" aria-label="Filter opportunities by coverage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All coverage</SelectItem>
                <SelectItem value="needs-attention">Needs attention</SelectItem>
                <SelectItem value="low">Low coverage</SelectItem>
                <SelectItem value="mid">Medium coverage</SelectItem>
                <SelectItem value="high">High coverage</SelectItem>
              </SelectContent>
            </Select>
            <Select value={focusSort} onValueChange={(value) => setFocusSort(value as OpportunitySort)}>
              <SelectTrigger className="min-h-11 w-full md:min-h-8" aria-label="Sort opportunity focus">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gaps">Most gaps</SelectItem>
                <SelectItem value="coverage-asc">Lowest coverage</SelectItem>
                <SelectItem value="coverage-desc">Highest coverage</SelectItem>
                <SelectItem value="value-desc">Highest value</SelectItem>
                <SelectItem value="close-date">Close date</SelectItem>
              </SelectContent>
            </Select>
            {hasFocusFilters ? (
              <Button
                variant="outline"
                className="h-11 gap-2 md:h-8"
                onClick={() => {
                  setFocusQuery("")
                  setFocusCoverageFilter("all")
                  setFocusSort("gaps")
                }}
              >
                <FilterIcon />
                Reset
              </Button>
            ) : null}
          </div>
          {filteredFocusOpportunities.length ? (
            <>
              <div className="grid gap-2 md:hidden" data-testid="dashboard-opportunity-focus-mobile-list">
                {visibleFocusOpportunities.map((opportunity) => {
                  const account = accountById.get(opportunity.accountId)
                  const attention = getOpportunityAttention(opportunity)

                  return (
                    <div
                      key={`${opportunity.id}-mobile-focus`}
                      className="grid cursor-pointer gap-3 rounded-lg bg-muted/30 p-3 transition-[background-color,color,box-shadow,opacity] duration-150 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      tabIndex={0}
                      aria-label={`Open ${opportunity.name}`}
                      onClick={() => onOpportunitySelect(opportunity.id)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return
                        if (event.key !== "Enter" && event.key !== " ") return

                        event.preventDefault()
                        onOpportunitySelect(opportunity.id)
                      }}
                    >
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{opportunity.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{account?.name ?? "No account linked"}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn("shrink-0", getAttentionBadgeClassName(attention.score))}
                          data-attention-tone={attention.tone}
                          data-testid="dashboard-attention-badge"
                        >
                          {attention.label}
                        </Badge>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {attention.detail}
                      </p>
                      <div className="grid min-w-0 gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-muted-foreground">
                            {opportunity.missing} missing / {opportunity.weak} weak
                          </span>
                          <span className="text-xs font-medium">{opportunity.coverage}%</span>
                        </div>
                        <CoverageProgress value={opportunity.coverage} className="h-1.5" />
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="hidden overflow-hidden md:block">
                <table className="w-full table-fixed text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="w-[38%] py-2 pr-4 font-medium">Opportunity</th>
                      <th className="hidden w-[14%] py-2 pr-4 font-medium lg:table-cell">Stage</th>
                      <th className="w-[22%] py-2 pr-4 font-medium">Attention</th>
                      <th className="hidden w-[16%] py-2 pr-4 font-medium md:table-cell">Gaps</th>
                      <th className="w-[84px] py-2 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleFocusOpportunities.map((opportunity) => {
                      const account = accountById.get(opportunity.accountId)
                      const attention = getOpportunityAttention(opportunity)

                      return (
                        <tr
                          key={`${opportunity.id}-row`}
                          className="cursor-pointer border-b transition-[background-color,color,box-shadow,opacity] duration-150 hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring last:border-b-0"
                          tabIndex={0}
                          aria-label={`Open ${opportunity.name}`}
                          onClick={() => onOpportunitySelect(opportunity.id)}
                          onKeyDown={(event) => {
                            if (event.target !== event.currentTarget) return
                            if (event.key !== "Enter" && event.key !== " ") return

                            event.preventDefault()
                            onOpportunitySelect(opportunity.id)
                          }}
                        >
                          <td className="min-w-0 py-3 pr-4">
                            <p className="truncate font-medium">{opportunity.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{account?.name ?? "No account linked"}</p>
                            <p className="mt-1 hidden truncate text-xs text-muted-foreground xl:block">
                              {getOpportunityGuidancePreview(opportunity)}
                            </p>
                          </td>
                          <td className="hidden py-3 pr-4 text-muted-foreground lg:table-cell">
                            <span className="block truncate">{opportunity.stage}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="grid min-w-0 gap-1.5">
                              <Badge
                                variant="outline"
                                className={getAttentionBadgeClassName(attention.score)}
                                data-attention-tone={attention.tone}
                                data-testid="dashboard-attention-badge"
                              >
                                {attention.label}
                              </Badge>
                              <span className="truncate text-xs text-muted-foreground">{attention.detail}</span>
                            </div>
                          </td>
                          <td className="hidden py-3 pr-4 text-muted-foreground md:table-cell">
                            <span className="block truncate">
                              {opportunity.missing} missing / {opportunity.weak} weak
                            </span>
                          </td>
                          <td
                            className="py-3 text-right"
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <OpenButton onClick={() => onOpportunitySelect(opportunity.id)} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <ListEmptyState
              icon={<TargetIcon />}
              title="Nothing matches that view"
              message="Try a lighter filter or search by account, opportunity, stakeholder, or gap."
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function DashboardMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  )
}

function OpenButton({ onClick, label = "Open" }: { onClick: () => void; label?: string }) {
  return (
    <Button size="sm" variant="outline" className="h-11 min-w-[72px] md:h-7" onClick={onClick}>
      {label}
    </Button>
  )
}

function getCoverageTone(value: number) {
  const coverage = Math.max(0, Math.min(100, value))

  if (coverage <= 33) return "low"
  if (coverage <= 66) return "mid"
  return "high"
}

function getCoverageIndicatorClassName(value: number) {
  const tone = getCoverageTone(value)

  if (tone === "low") return "bg-coverage-low"
  if (tone === "mid") return "bg-coverage-mid"
  return "bg-coverage-high"
}

function getDashboardCoverageOpportunities(opportunities: Opportunity[], limit: number) {
  const sorted = [...opportunities].sort((left, right) => left.coverage - right.coverage)
  if (sorted.length <= limit) return sorted

  const buckets = {
    low: sorted.filter((opportunity) => getCoverageTone(opportunity.coverage) === "low"),
    mid: sorted.filter((opportunity) => getCoverageTone(opportunity.coverage) === "mid"),
    high: sorted.filter((opportunity) => getCoverageTone(opportunity.coverage) === "high"),
  }
  const baseTarget = Math.floor(limit / 3)
  let spareSlots = limit - baseTarget * 3
  const targets = {
    low: baseTarget,
    mid: baseTarget,
    high: baseTarget,
  }

  for (const tone of ["high", "mid", "low"] as const) {
    if (spareSlots <= 0) break
    targets[tone] += 1
    spareSlots -= 1
  }

  const selectedIds = new Set<string>()
  const selected: Opportunity[] = []

  for (const tone of ["low", "mid", "high"] as const) {
    for (const opportunity of buckets[tone].slice(0, targets[tone])) {
      selected.push(opportunity)
      selectedIds.add(opportunity.id)
    }
  }

  if (selected.length < limit) {
    for (const opportunity of sorted) {
      if (selectedIds.has(opportunity.id)) continue

      selected.push(opportunity)
      selectedIds.add(opportunity.id)
      if (selected.length >= limit) break
    }
  }

  return selected.sort((left, right) => left.coverage - right.coverage)
}

function getCoverageBadgeClassName(value: number) {
  const tone = getCoverageTone(value)

  if (tone === "low") return "border-coverage-low/30 bg-coverage-low/10 text-coverage-low"
  if (tone === "mid") return "border-coverage-mid/30 bg-coverage-mid/10 text-coverage-mid"
  return "border-coverage-high/30 bg-coverage-high/10 text-coverage-high"
}

function CoverageProgress({
  value,
  className,
  "data-testid": dataTestId,
}: {
  value: number
  className?: string
  "data-testid"?: string
}) {
  const tone = getCoverageTone(value)

  return (
    <Progress
      value={value}
      className={className}
      indicatorClassName={getCoverageIndicatorClassName(value)}
      data-coverage-tone={tone}
      data-testid={dataTestId}
    />
  )
}

function CoverageBadge({
  value,
  label = "coverage",
}: {
  value: number
  label?: string
}) {
  return (
    <Badge variant="outline" className={getCoverageBadgeClassName(value)} data-coverage-tone={getCoverageTone(value)}>
      {value}%{label ? ` ${label}` : ""}
    </Badge>
  )
}

function getOpportunityAttention(opportunity: Opportunity) {
  const gapCount = opportunity.missing + opportunity.weak
  const score = Math.min(
    100,
    Math.max(0, Math.round(100 - opportunity.coverage + opportunity.missing * 4 + opportunity.weak * 2))
  )
  const tone = getAttentionTone(score)
  const label = tone === "high" ? "High attention" : tone === "mid" ? "Medium attention" : "Low attention"

  return {
    detail: `${score}/100 risk score / ${gapCount} gaps`,
    label,
    score,
    tone,
  }
}

function getAttentionTone(value: number) {
  const score = Math.max(0, Math.min(100, value))

  if (score >= 67) return "high"
  if (score >= 34) return "mid"
  return "low"
}

function getAttentionBadgeClassName(value: number) {
  const tone = getAttentionTone(value)

  if (tone === "high") return "border-coverage-low/30 bg-coverage-low/10 text-coverage-low"
  if (tone === "mid") return "border-coverage-mid/30 bg-coverage-mid/10 text-coverage-mid"
  return "border-coverage-high/30 bg-coverage-high/10 text-coverage-high"
}

function AccountView({
  account,
  accountDraft,
  accountEnrichment,
  accountEnrichmentRunMessage,
  accountEnrichmentRunStatus,
  accountEnrichmentSaveMessage,
  accountEnrichmentSaveStatus,
  accountResearchById,
  opportunityDrafts,
  opportunities,
  playbookFields,
  playbookRows,
  savedAccountDraft,
  savedOpenAiKeyState,
  sellerResearchProfile,
  workspaceId,
  onAccountDraftChange,
  onArchiveAccount,
  onArchiveOpportunity,
  onCreateOpportunity,
  onDeleteOpportunity,
  onOpportunitySelect,
  onOpenSettings,
  onRunAccountEnrichment,
  onSaveAccountDraft,
  onSaveAccountEnrichment,
  onScrollToTop,
  onStartRecording,
  saveMessage,
  saveStatus,
}: {
  account: AccountNavItem
  accountDraft: AccountDraft
  accountEnrichment: AccountEnrichmentProfileRow | null
  accountEnrichmentRunMessage: string
  accountEnrichmentRunStatus: RecordSaveStatus
  accountEnrichmentSaveMessage: string
  accountEnrichmentSaveStatus: RecordSaveStatus
  accountResearchById: Record<string, CustomerResearchConfig>
  opportunityDrafts: Record<string, OpportunityDraft>
  opportunities: Opportunity[]
  playbookFields: PlaybookFieldRow[]
  playbookRows: PlaybookRow[]
  savedAccountDraft: AccountDraft
  savedOpenAiKeyState: SavedOpenAiKeyState | null
  sellerResearchProfile: SellerResearchProfile
  workspaceId: string
  onAccountDraftChange: <K extends keyof AccountDraft>(field: K, value: AccountDraft[K]) => void
  onArchiveAccount: (id: string) => void
  onArchiveOpportunity: (id: string) => void
  onCreateOpportunity: () => void
  onDeleteOpportunity: (id: string) => void
  onOpportunitySelect: (id: string) => void
  onOpenSettings: () => void
  onRunAccountEnrichment: () => void
  onSaveAccountDraft: () => void
  onSaveAccountEnrichment: (draft: AccountEnrichmentDraft) => Promise<RecordMutationResult> | RecordMutationResult
  onScrollToTop: () => void
  onStartRecording: StartRecordingHandler
  saveMessage: string
  saveStatus: RecordSaveStatus
}) {
  const [opportunityQuery, setOpportunityQuery] = React.useState("")
  const [opportunityCoverageFilter, setOpportunityCoverageFilter] = React.useState<OpportunityCoverageFilter>("all")
  const [opportunitySort, setOpportunitySort] = React.useState<OpportunitySort>("gaps")
  const displayOpportunities = opportunities.map((opportunity) =>
    applyOpportunityMethodologySummary(
      opportunity,
      getOpportunityMethodologySummary({
        opportunity,
        playbookFields,
        playbookRows,
        selectedPlaybooks: parsePlaybookSelection(opportunityDrafts[opportunity.id]?.frameworks),
      })
    )
  )
  const averageCoverage = displayOpportunities.length
    ? Math.round(displayOpportunities.reduce((total, opportunity) => total + opportunity.coverage, 0) / displayOpportunities.length)
    : 0
  const visibleOpportunities = sortOpportunities(
    getFuzzyMatches(
      displayOpportunities.filter((item) => matchesCoverageFilter(item, opportunityCoverageFilter)),
      opportunityQuery,
      (item) => getOpportunitySearchText(item, account)
    ),
    opportunitySort
  )
  const accountHasDraftChanges = !areAccountDraftsEqual(accountDraft, savedAccountDraft)

  return (
    <div className="grid w-full min-w-0 gap-4">
      <Card className="w-full min-w-0">
        <CardHeader>
          <div className="flex min-w-0 items-center gap-3">
            <AccountLogoAvatar
              domain={accountDraft.website || account.logoDomain}
              logoUrl={account.logoUrl}
              name={accountDraft.accountName}
              retryKey={`${account.logoCheckedAt}-${accountDraft.website}`}
              size="md"
            />
            <div className="min-w-0">
              <CardTitle className="truncate text-2xl">{accountDraft.accountName}</CardTitle>
              <div className="mt-3 flex flex-wrap gap-2">
                <CoverageBadge value={averageCoverage} />
              </div>
            </div>
          </div>
          <CardAction className="col-span-full col-start-1 row-span-1 row-start-2 mt-3 flex flex-wrap items-center gap-2 justify-self-start sm:col-span-auto sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:mt-0 sm:justify-self-end">
            <StartRecordingDialog
              accounts={[account]}
              accountResearchById={accountResearchById}
              defaultAccountId={account.id}
              opportunityDrafts={opportunityDrafts}
              opportunities={opportunities}
              savedOpenAiKeyState={savedOpenAiKeyState}
              sellerResearchProfile={sellerResearchProfile}
              workspaceId={workspaceId}
              onOpenSettings={onOpenSettings}
              onStartRecording={onStartRecording}
            />
          </CardAction>
        </CardHeader>
      </Card>

      <Tabs defaultValue="record" className="grid w-full min-w-0 gap-4" onValueChange={onScrollToTop}>
        <TabsList className="grid w-full grid-cols-3 md:w-fit">
          <TabsTrigger value="record">Account record</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
        </TabsList>

        <TabsContent value="record" className="m-0 w-full min-w-0">
          <Card className="w-full min-w-0">
            <CardHeader>
              <div>
                <CardTitle>Main account fields</CardTitle>
                <CardDescription>Account context SalesFrame uses for research and live guidance</CardDescription>
              </div>
              <CardAction className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
                <Button
                  size="sm"
                  className="w-full gap-2 sm:w-auto"
                  disabled={saveStatus === "saving" || !accountDraft.accountName.trim() || !accountHasDraftChanges}
                  onClick={onSaveAccountDraft}
                >
                  <CheckCircle2Icon />
                  {saveStatus === "saving" ? "Saving..." : "Save account"}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-4">
              {saveMessage && !(saveStatus === "saved" && accountHasDraftChanges) ? (
                <RecordStatusMessage message={saveMessage} status={saveStatus} />
              ) : null}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <EditableTextField
                  id="account-name"
                  label="Account name"
                  value={accountDraft.accountName}
                  onChange={(value) => onAccountDraftChange("accountName", value)}
                />
                <EditableTextField
                  id="account-website"
                  label="Website"
                  value={accountDraft.website}
                  onChange={(value) => onAccountDraftChange("website", value)}
                />
                <div className="grid gap-2">
                  <Label htmlFor="account-created-date">Created date</Label>
                  <Input id="account-created-date" value={account.createdAt} readOnly />
                </div>
                <EditableTextField
                  id="account-industry"
                  label="Industry"
                  value={accountDraft.industry}
                  onChange={(value) => onAccountDraftChange("industry", value)}
                />
                <EditableTextField
                  id="account-employees"
                  label="Employees"
                  value={accountDraft.employeeCount}
                  onChange={(value) => onAccountDraftChange("employeeCount", value)}
                />
                <EditableTextField
                  id="account-region"
                  label="Location"
                  value={accountDraft.region}
                  onChange={(value) => onAccountDraftChange("region", value)}
                />
                <CurrencySelect
                  id="account-currency"
                  value={accountDraft.currency}
                  onChange={(value) => onAccountDraftChange("currency", value)}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <EditableTextareaField
                  id="account-tools"
                  label="Current tools"
                  value={accountDraft.currentTools}
                  onChange={(value) => onAccountDraftChange("currentTools", value)}
                />
                <EditableTextareaField
                  id="account-initiatives"
                  label="Strategic initiatives"
                  value={accountDraft.strategicInitiatives}
                  onChange={(value) => onAccountDraftChange("strategicInitiatives", value)}
                />
                <EditableTextareaField
                  id="account-competitors"
                  label="Competitors"
                  value={accountDraft.competitors}
                  onChange={(value) => onAccountDraftChange("competitors", value)}
                />
                <EditableTextareaField
                  id="account-notes"
                  label="Account notes"
                  value={accountDraft.accountNotes}
                  onChange={(value) => onAccountDraftChange("accountNotes", value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="opportunities" className="m-0 w-full min-w-0">
          <Card className="w-full min-w-0">
            <CardHeader>
              <div>
                <CardTitle>Current opportunities</CardTitle>
                <CardDescription>Open an opportunity to work the live call, fields, and intelligence</CardDescription>
              </div>
              <CardAction>
                <Button variant="outline" size="sm" className="w-full gap-2 sm:w-auto" onClick={onCreateOpportunity}>
                  <PlusIcon />
                  New opportunity
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-3">
              {opportunities.length ? (
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_160px]">
                  <div className="relative">
                    <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      aria-label="Search this account's opportunities"
                      value={opportunityQuery}
                      className="pl-9"
                      placeholder="Search this account's opportunities"
                      onChange={(event) => setOpportunityQuery(event.currentTarget.value)}
                    />
                  </div>
                  <Select
                    value={opportunityCoverageFilter}
                    onValueChange={(value) => setOpportunityCoverageFilter(value as OpportunityCoverageFilter)}
                  >
                    <SelectTrigger className="w-full" aria-label="Filter account opportunities by coverage">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All coverage</SelectItem>
                      <SelectItem value="needs-attention">Needs attention</SelectItem>
                      <SelectItem value="low">Low coverage</SelectItem>
                      <SelectItem value="mid">Medium coverage</SelectItem>
                      <SelectItem value="high">High coverage</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={opportunitySort} onValueChange={(value) => setOpportunitySort(value as OpportunitySort)}>
                    <SelectTrigger className="w-full" aria-label="Sort account opportunities">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gaps">Most gaps</SelectItem>
                      <SelectItem value="coverage-asc">Lowest coverage</SelectItem>
                      <SelectItem value="coverage-desc">Highest coverage</SelectItem>
                      <SelectItem value="value-desc">Highest value</SelectItem>
                      <SelectItem value="close-date">Close date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {visibleOpportunities.length ? (
                <div className="grid gap-2 md:hidden" data-testid="account-opportunities-mobile-list">
                  {visibleOpportunities.map((opportunity) => (
                    <div
                      key={`${opportunity.id}-mobile`}
                      className="grid gap-3 rounded-lg bg-muted/30 p-3"
                    >
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <button
                          type="button"
                          className="min-w-0 text-left outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={`Open ${opportunity.name}`}
                          onClick={() => onOpportunitySelect(opportunity.id)}
                        >
                          <span className="block truncate text-sm font-medium">{opportunity.name}</span>
                          <span className="mt-1 block truncate text-xs text-muted-foreground">
                            {opportunity.stage} / {formatCurrencyAmount(opportunity.amount, accountDraft.currency)}
                          </span>
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="shrink-0 gap-1.5"
                              aria-label={`Actions for ${opportunity.name}`}
                            >
                              Actions
                              <ChevronDownIcon className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onSelect={() => onOpportunitySelect(opportunity.id)}>
                              <ExternalLinkIcon />
                              Open
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => onArchiveOpportunity(opportunity.id)}>
                              <ArchiveIcon />
                              Archive
                            </DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onSelect={() => onDeleteOpportunity(opportunity.id)}>
                              <Trash2Icon />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="grid min-w-0 gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-muted-foreground">Methodology coverage</span>
                          <span className="text-xs font-medium">{opportunity.coverage}%</span>
                        </div>
                        <CoverageProgress
                          value={opportunity.coverage}
                          className="h-1.5"
                          data-testid="account-opportunity-mobile-coverage-bar"
                        />
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {getOpportunityGuidancePreview(opportunity)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
              {visibleOpportunities.length ? (
                <div className="hidden w-full overflow-hidden rounded-lg border md:block" data-testid="account-opportunities-table">
                  <table className="w-full table-fixed text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                        <th className="w-[30%] px-3 py-2 font-medium">Opportunity</th>
                        <th className="hidden w-[14%] px-3 py-2 font-medium lg:table-cell">Stage</th>
                        <th className="hidden w-[12%] px-3 py-2 font-medium md:table-cell">Value</th>
                        <th className="hidden w-[10%] px-3 py-2 font-medium 2xl:table-cell">Close</th>
                        <th className="w-[16%] px-3 py-2 font-medium">Coverage</th>
                        <th className="hidden w-[96px] px-3 py-2 text-center font-medium xl:table-cell">Gaps</th>
                        <th className="w-[128px] px-2 py-2 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleOpportunities.map((opportunity) => (
                        <tr
                          key={opportunity.id}
                          className="cursor-pointer border-b transition-[background-color,color,box-shadow,opacity] duration-150 hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring last:border-b-0"
                          tabIndex={0}
                          aria-label={`Open ${opportunity.name}`}
                          onClick={() => onOpportunitySelect(opportunity.id)}
                          onKeyDown={(event) => {
                            if (event.target !== event.currentTarget) return
                            if (event.key !== "Enter" && event.key !== " ") return

                            event.preventDefault()
                            onOpportunitySelect(opportunity.id)
                          }}
                        >
                          <td className="min-w-0 px-3 py-3 align-middle">
                            <button
                              type="button"
                              className="block max-w-full truncate text-left font-medium underline-offset-4 outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label={`Open ${opportunity.name}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                onOpportunitySelect(opportunity.id)
                              }}
                            >
                              {opportunity.name}
                            </button>
                            <p className="mt-1 hidden truncate text-xs text-muted-foreground sm:block">
                              {getOpportunityGuidancePreview(opportunity)}
                            </p>
                          </td>
                          <td className="hidden px-3 py-3 align-middle text-muted-foreground lg:table-cell">
                            <span className="block truncate">{opportunity.stage}</span>
                          </td>
                          <td className="hidden px-3 py-3 align-middle text-muted-foreground md:table-cell">
                            <span className="block truncate">
                              {formatCurrencyAmount(opportunity.amount, accountDraft.currency)}
                            </span>
                          </td>
                          <td className="hidden px-3 py-3 align-middle text-muted-foreground 2xl:table-cell">
                            <span className="block truncate">{opportunity.closeDate}</span>
                          </td>
                          <td className="px-3 py-3 align-middle">
                            <div className="grid min-w-0 gap-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-xs text-muted-foreground">Methodology</span>
                                <span className="w-9 text-right text-xs font-medium">{opportunity.coverage}%</span>
                              </div>
                              <CoverageProgress
                                value={opportunity.coverage}
                                className="h-1.5"
                                data-testid="account-opportunity-coverage-bar"
                              />
                            </div>
                          </td>
                          <td className="hidden px-3 py-3 text-center align-middle text-muted-foreground xl:table-cell">
                            <span className={cn("text-sm", opportunity.missing > 5 && "font-medium text-destructive")}>
                              {opportunity.missing} missing
                            </span>
                          </td>
                          <td
                            className="px-2 py-3 text-right align-middle"
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="min-w-[104px] justify-center gap-1.5"
                                  aria-label={`Actions for ${opportunity.name}`}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  Actions
                                  <ChevronDownIcon className="size-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44" onClick={(event) => event.stopPropagation()}>
                                <DropdownMenuItem onSelect={() => onOpportunitySelect(opportunity.id)}>
                                  <ExternalLinkIcon />
                                  Open
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => onArchiveOpportunity(opportunity.id)}>
                                  <ArchiveIcon />
                                  Archive
                                </DropdownMenuItem>
                                <DropdownMenuItem variant="destructive" onSelect={() => onDeleteOpportunity(opportunity.id)}>
                                  <Trash2Icon />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : opportunities.length ? (
                <ListEmptyState
                  icon={<TargetIcon />}
                  title="Nothing matches that view"
                  message="Try a lighter filter or search by opportunity name, amount, stage, or methodology gap."
                />
              ) : (
                <ListEmptyState
                  icon={<TargetIcon />}
                  title="No opportunities yet"
                  message="Create one from Start Call, or add an opportunity when there is a deal to qualify."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="intelligence" className="m-0 grid w-full min-w-0 gap-4 xl:grid-cols-2">
          <AccountEnrichmentEditor
            hasSavedOpenAiKey={Boolean(savedOpenAiKeyState)}
            profile={accountEnrichment}
            runMessage={accountEnrichmentRunMessage}
            runStatus={accountEnrichmentRunStatus}
            saveMessage={accountEnrichmentSaveMessage}
            saveStatus={accountEnrichmentSaveStatus}
            onOpenSettings={onOpenSettings}
            onRunEnrichment={onRunAccountEnrichment}
            onSave={onSaveAccountEnrichment}
          />

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Recommended focus</CardTitle>
              <CardDescription>What the next calls should improve across this account</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {opportunities.length ? opportunities.map((opportunity) => (
                <div key={`${opportunity.id}-focus`} className="rounded-lg bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-medium">{opportunity.name}</p>
                    <span className="text-sm font-medium">{opportunity.coverage}%</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {getOpportunityGuidancePreview(opportunity)}
                  </p>
                </div>
              )) : (
                <ListEmptyState
                  icon={<TargetIcon />}
                  title="No active opportunity focus yet"
                  message="Add an opportunity to see where the next calls should tighten methodology coverage."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {account.id ? (
        <div className="flex justify-start pt-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => onArchiveAccount(account.id)}
          >
            <ArchiveIcon />
            Archive account
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function AccountEnrichmentEditor({
  hasSavedOpenAiKey,
  profile,
  runMessage,
  runStatus,
  saveMessage,
  saveStatus,
  onOpenSettings,
  onRunEnrichment,
  onSave,
}: {
  hasSavedOpenAiKey: boolean
  profile: AccountEnrichmentProfileRow | null
  runMessage: string
  runStatus: RecordSaveStatus
  saveMessage: string
  saveStatus: RecordSaveStatus
  onOpenSettings: () => void
  onRunEnrichment: () => void
  onSave: (draft: AccountEnrichmentDraft) => Promise<RecordMutationResult> | RecordMutationResult
}) {
  const savedDraft = React.useMemo(() => mapAccountEnrichmentProfileToDraft(profile), [profile])
  const [draft, setDraft] = React.useState<AccountEnrichmentDraft>(() => savedDraft)
  const hasDraftChanges = !areAccountEnrichmentDraftsEqual(draft, savedDraft)

  React.useEffect(() => {
    setDraft(savedDraft)
  }, [savedDraft])

  const updateDraft = (field: keyof AccountEnrichmentDraft, value: string) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }))
  }

  const enrichmentFields: {
    field: keyof AccountEnrichmentDraft
    label: string
    placeholder: string
  }[] = [
    {
      field: "businessSummary",
      label: "Business summary",
      placeholder: "Concise account summary for sales discovery",
    },
    {
      field: "likelyBuyingTriggers",
      label: "Likely buying triggers",
      placeholder: "Events or pressures that could create urgency",
    },
    {
      field: "strategicPriorities",
      label: "Strategic priorities",
      placeholder: "Business priorities worth aligning questions to",
    },
    {
      field: "currentTechStack",
      label: "Current tech stack",
      placeholder: "Known or likely tools and systems",
    },
    {
      field: "hiringGrowthSignals",
      label: "Hiring or growth signals",
      placeholder: "Hiring, expansion, restructure, or growth clues",
    },
    {
      field: "recentNewsSignals",
      label: "Recent news signals",
      placeholder: "Recent announcements or market events",
    },
    {
      field: "procurementSignals",
      label: "Procurement or government signals",
      placeholder: "Tender, procurement, funding, or contract signals",
    },
    {
      field: "reviewSentimentSignals",
      label: "Review / customer sentiment signals",
      placeholder: "Public review themes or customer sentiment",
    },
    {
      field: "likelyStakeholders",
      label: "Likely stakeholders",
      placeholder: "People or functions likely involved in the buying process",
    },
    {
      field: "discoveryAngles",
      label: "Discovery angles",
      placeholder: "Question angles the live coach should consider",
    },
    {
      field: "riskFlags",
      label: "Risk flags",
      placeholder: "Potential blockers, complexity, or caution areas",
    },
    {
      field: "sourceNotes",
      label: "Source notes",
      placeholder: "Source URLs, provenance notes, and confidence caveats",
    },
  ]
  const primaryStatusMessage = saveMessage
    ? saveStatus === "saved" && hasDraftChanges
      ? null
      : { message: saveMessage, status: saveStatus }
    : runMessage && (runStatus === "saving" || runStatus === "error")
      ? { message: runMessage, status: runStatus }
      : null
  const runActionLabel = profile?.last_enriched_at ? "Refresh enrichment" : "Enrich account"

  return (
    <Card className="min-w-0 xl:col-span-2">
      <CardHeader className="gap-3">
        <div>
          <CardTitle>AI Enriched Sales Signals</CardTitle>
          <CardDescription>
            Run enrichment when you want fresh account research; edit and save the signals you want SalesFrame to use.
          </CardDescription>
        </div>
        <CardAction className="col-start-1 row-span-1 row-start-auto mt-1 flex w-full flex-col items-stretch gap-2 justify-self-start sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:mt-0 sm:w-auto sm:flex-row sm:items-center sm:justify-self-end">
          {!hasSavedOpenAiKey ? (
            <Button type="button" size="sm" variant="outline" className="min-w-40 justify-center gap-2 sm:w-auto" onClick={onOpenSettings}>
              <KeyRoundIcon />
              Open settings
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-w-40 justify-center gap-2 sm:w-auto"
              disabled={runStatus === "saving"}
              onClick={onRunEnrichment}
            >
              <SparklesIcon />
              {runStatus === "saving" ? "Enriching..." : runActionLabel}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            className="min-w-40 justify-center gap-2 sm:w-auto"
            disabled={saveStatus === "saving" || !hasDraftChanges}
            onClick={() => void onSave(draft)}
          >
            <CheckCircle2Icon />
            {saveStatus === "saving" ? "Saving..." : "Save intelligence"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        {primaryStatusMessage ? (
          <RecordStatusMessage message={primaryStatusMessage.message} status={primaryStatusMessage.status} />
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          {enrichmentFields.map((item) => (
            <EditableTextareaField
              key={item.field}
              id={`account-enrichment-${item.field}`}
              label={item.label}
              value={draft[item.field]}
              placeholder={item.placeholder}
              onChange={(value) => updateDraft(item.field, value)}
            />
          ))}
          <EditableTextField
            id="account-enrichment-confidence"
            label="Confidence"
            value={draft.confidence}
            placeholder="High, medium, low, or mixed"
            onChange={(value) => updateDraft("confidence", value)}
          />
          <div className="grid gap-1.5">
            <p className="text-sm font-medium">Last enriched</p>
            <p className="min-h-10 rounded-md bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              {profile?.last_enriched_at ? formatSavedAt(profile.last_enriched_at) : "Not enriched yet"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function getCoachPopoutCallStatus({
  activeCallId,
  captureStatus,
  isRecording,
  isStoppingCall,
}: {
  activeCallId: string
  captureStatus: CallCaptureStatus
  isRecording: boolean
  isStoppingCall: boolean
}): LiveCoachPopoutCallStatus {
  if (isStoppingCall || captureStatus === "stopping") return "stopping"
  if (captureStatus === "error" || captureStatus === "permission-denied" || captureStatus === "upload-failed") {
    return "error"
  }
  if (captureStatus === "requesting-permission" || captureStatus === "connecting") return "starting"
  if (captureStatus === "paused") return "paused"
  if (isRecording || captureStatus === "recording") return "live"
  if (activeCallId || captureStatus === "stopped") return "ended"

  return "idle"
}

function getCoachPopoutMessage({
  callStatus,
  coachStatus,
  hasQuestion,
  liveCoachError,
}: {
  callStatus: LiveCoachPopoutCallStatus
  coachStatus: LiveCoachStatus
  hasQuestion: boolean
  liveCoachError: string
}) {
  if (callStatus === "starting") return "Getting the live coach ready."
  if (callStatus === "stopping") return "Saving the call and wrapping things up."
  if (callStatus === "ended") return "Call ended. You can close this window."
  if (callStatus === "error") return liveCoachError || "SalesFrame needs attention in the main tab."
  if (hasQuestion) return "Keep this close while you work in other apps."
  if (coachStatus === "thinking" || coachStatus === "checking") return "SalesFrame is reading the conversation."

  return "Waiting for the next live question."
}

type LiveCoachPopoutPlacement = {
  height: number
  left: number
  mainHeight: number
  mainLeft: number
  mainTop: number
  mainWidth: number
  shouldDockMainWindow: boolean
  top: number
  width: number
}

function getLiveCoachPopoutPlacement(): LiveCoachPopoutPlacement {
  const screenDetails = window.screen as Screen & {
    availLeft?: number
    availTop?: number
  }
  const availableLeft = screenDetails.availLeft ?? 0
  const availableTop = screenDetails.availTop ?? 0
  const availableWidth = window.screen.availWidth || window.outerWidth
  const availableHeight = window.screen.availHeight || window.outerHeight
  const margin = 12
  const gutter = 12
  const width = Math.min(430, Math.max(390, Math.round(availableWidth * 0.24)))
  const height = Math.max(620, Math.min(window.outerHeight || 720, availableHeight - margin * 2))
  const currentTop = Math.max(availableTop + margin, window.screenY)
  const top = Math.min(currentTop, availableTop + availableHeight - height - margin)
  const minimumMainWidth = 900
  const hasSideBySideRoom = availableWidth >= minimumMainWidth + width + gutter + margin * 2

  if (hasSideBySideRoom) {
    const mainLeft = availableLeft + margin
    const mainTop = Math.max(availableTop + margin, Math.min(window.screenY, availableTop + availableHeight - height - margin))
    const mainWidth = Math.max(
      minimumMainWidth,
      Math.min(window.outerWidth || minimumMainWidth, availableWidth - width - gutter - margin * 2)
    )
    const mainHeight = height

    return {
      height,
      left: mainLeft + mainWidth + gutter,
      mainHeight,
      mainLeft,
      mainTop,
      mainWidth,
      shouldDockMainWindow: true,
      top: mainTop,
      width,
    }
  }

  const preferredLeft = window.screenX + (window.outerWidth || availableWidth) + gutter
  const maximumLeft = availableLeft + availableWidth - width - margin
  const fallbackLeft = window.screenX + (window.outerWidth || availableWidth) - width - margin

  return {
    height,
    left: Math.max(availableLeft + margin, Math.min(preferredLeft <= maximumLeft ? preferredLeft : fallbackLeft, maximumLeft)),
    mainHeight: window.outerHeight || height,
    mainLeft: window.screenX,
    mainTop: window.screenY,
    mainWidth: window.outerWidth || availableWidth,
    shouldDockMainWindow: false,
    top,
    width,
  }
}

function getLiveCoachPopoutFeatures(placement: LiveCoachPopoutPlacement) {
  const features = {
    height: Math.round(placement.height),
    left: Math.round(placement.left),
    location: "no",
    menubar: "no",
    popup: "yes",
    resizable: "yes",
    scrollbars: "yes",
    status: "no",
    toolbar: "no",
    top: Math.round(placement.top),
    width: Math.round(placement.width),
  }

  return Object.entries(features)
    .map(([key, value]) => `${key}=${value}`)
    .join(",")
}

function placeMainWindowForCoachPopout(placement: LiveCoachPopoutPlacement) {
  if (!placement.shouldDockMainWindow) return

  try {
    window.moveTo(Math.round(placement.mainLeft), Math.round(placement.mainTop))
    window.resizeTo(Math.round(placement.mainWidth), Math.round(placement.mainHeight))
  } catch {
    // Some browsers only allow moving windows they created. The popout still opens as a sidecar.
  }
}

function WorkspaceView({
  activeCallId,
  activeView,
  account,
  accountDraft,
  accountResearchById,
  calls,
  callType,
  callPlaybooks,
  audioPreflight,
  captureError,
  capturePermissionState,
  captureStatus,
  customerResearch,
  elapsed,
  initialLiveGuidance,
  isRecording,
  isStoppingCall,
  manualCoach,
  notes,
  opportunity,
  opportunityDraft,
  opportunityDrafts,
  playbookFields,
  playbookRows,
  postCallFocusCallId,
  postCallGenerating,
  postCallError,
  postCallOutput,
  postCallTranscript,
  savedOpenAiKeyState,
  savedOpportunityDraft,
  sellerResearchProfile,
  sellerName,
  speakerIdentities,
  transcript,
  workspaceId,
  onMarkQuestionAsked,
  onCoachFeedback,
  onNavigate,
  onOpenSettings,
  onOpportunityDraftChange,
  onArchiveOpportunity,
  onDeleteOpportunity,
  onSaveOpportunityDraft,
  onScrollToTop,
  onStartRecording,
  onStopRecording,
  onSpeakerIdentityChange,
  onTranscriptSpeakerChange,
  onDeleteCall,
  onUseManualQuestion,
  opportunitySaveMessage,
  opportunitySaveStatus,
}: {
  activeCallId: string
  activeView: string
  account: AccountNavItem
  accountDraft: AccountDraft
  accountResearchById: Record<string, CustomerResearchConfig>
  calls: CallSummary[]
  callType: string
  callPlaybooks: CallPlaybook[]
  audioPreflight: AudioPreflightResult | null
  captureError: string | null
  capturePermissionState: CallCapturePermissionState
  captureStatus: CallCaptureStatus
  customerResearch: CustomerResearchConfig
  elapsed: number
  initialLiveGuidance: LiveGuidance | null
  isRecording: boolean
  isStoppingCall: boolean
  manualCoach: ManualCoachState
  notes: string[]
  opportunity: Opportunity
  opportunityDraft: OpportunityDraft
  opportunityDrafts: Record<string, OpportunityDraft>
  playbookFields: PlaybookFieldRow[]
  playbookRows: PlaybookRow[]
  postCallFocusCallId: string
  postCallGenerating: boolean
  postCallError: string
  postCallOutput: PostCallOutputView | null
  postCallTranscript: Opportunity["transcript"]
  savedOpenAiKeyState: SavedOpenAiKeyState | null
  savedOpportunityDraft: OpportunityDraft
  sellerResearchProfile: SellerResearchProfile
  sellerName: string
  speakerIdentities: CallSpeakerIdentityMap
  transcript: Opportunity["transcript"]
  workspaceId: string
  onMarkQuestionAsked: (question: ManualQuestion) => void
  onCoachFeedback: (action: LiveSellerFeedbackAction, question: ManualQuestion) => void
  onNavigate: (view: string) => void
  onOpenSettings: () => void
  onOpportunityDraftChange: (field: keyof OpportunityDraft, value: string) => void
  onArchiveOpportunity: (id: string) => void
  onDeleteOpportunity: (id: string) => void
  onSaveOpportunityDraft: () => void
  onScrollToTop: () => void
  onStartRecording: StartRecordingHandler
  onStopRecording: () => void | Promise<void>
  onSpeakerIdentityChange: (payload: SpeakerIdentityChangePayload) => Promise<SpeakerIdentityChangeResult>
  onTranscriptSpeakerChange: (segmentId: string, speaker: TranscriptSpeaker) => void
  onDeleteCall: (callId: string) => void
  onUseManualQuestion: (question: ManualQuestion) => void
  opportunitySaveMessage: string
  opportunitySaveStatus: RecordSaveStatus
}) {
  const [aiLiveGuidance, setAiLiveGuidance] = React.useState<LiveGuidance | null>(null)
  const [liveCoachError, setLiveCoachError] = React.useState("")
  const [liveCoachStatus, setLiveCoachStatus] = React.useState<LiveCoachStatus>("idle")
  const [liveCoachHeartbeatTick, setLiveCoachHeartbeatTick] = React.useState(0)
  const [liveCoachRefreshTick, setLiveCoachRefreshTick] = React.useState(0)
  const [coachPopoutMessage, setCoachPopoutMessage] = React.useState("")
  const liveCoachQuestionRequestRef = React.useRef(0)
  const liveCoachStateRequestRef = React.useRef(0)
  const liveCoachSignatureRef = React.useRef("")
  const liveCoachFeedbackCountRef = React.useRef(0)
  const liveCoachGuidanceTurnCountRef = React.useRef(0)
  const liveCoachHasGuidanceRef = React.useRef(false)
  const liveCoachHeartbeatHandledRef = React.useRef(0)
  const liveCoachRefreshHandledRef = React.useRef(0)
  const liveCoachFullGuidanceInFlightRef = React.useRef(false)
  const liveCoachPendingRefreshRef = React.useRef(false)
  const liveCoachLastDecisionAtRef = React.useRef(0)
  const aiLiveGuidanceRef = React.useRef<LiveGuidance | null>(null)
  const coachPopoutChannelRef = React.useRef<BroadcastChannel | null>(null)
  const coachPopoutOpenedRef = React.useRef(false)
  const coachPopoutQuestionRef = React.useRef<ManualQuestion | null>(null)
  const coachPopoutActiveCallIdRef = React.useRef("")
  const coachPopoutCanEndCallRef = React.useRef(false)
  const coachPopoutSnapshotRef = React.useRef<LiveCoachPopoutSnapshot | null>(null)
  const coachPopoutSourceIdRef = React.useRef(createLiveCoachPopoutSourceId("main"))
  const processedCoachPopoutCommandKeysRef = React.useRef<Set<string>>(new Set())
  const defaultTab =
    activeView === "post-call"
      ? "post-call"
      : activeView === "methodology" || activeView === "opportunity-record" || activeView === "opportunity-intelligence"
        ? "opportunity"
        : "cockpit"
  const liveGuidance = aiLiveGuidance
  const displayedCoachQuestion = getDisplayedLiveCoachQuestion({ guidance: liveGuidance, manualCoach })
  const coachPopoutCallStatus = getCoachPopoutCallStatus({
    activeCallId,
    captureStatus,
    isRecording,
    isStoppingCall,
  })
  const coachPopoutCanEndCall = Boolean(
    activeCallId &&
      isRecording &&
      !isStoppingCall &&
      ["requesting-permission", "connecting", "recording", "paused"].includes(captureStatus)
  )
  const shouldShowCoachPopoutButton = Boolean(
    activeCallId && ["starting", "live", "paused", "stopping", "error"].includes(coachPopoutCallStatus)
  )
  const coachPopoutQuestionConfidence =
    liveGuidance?.displayRecommendation?.confidence ?? liveGuidance?.conversationState?.confidence ?? null
  const coachPopoutQuestionIsAsked = displayedCoachQuestion
    ? manualCoach.askedQuestionIds.includes(displayedCoachQuestion.id)
    : false
  const coachPopoutLimitNotice =
    activeCallId && isRecording ? getLiveCallLimitNotice(elapsed, MAX_LIVE_CALL_SECONDS) : ""
  const coachPopoutSnapshot = React.useMemo<LiveCoachPopoutSnapshot>(() => ({
    type: "snapshot",
    version: liveCoachPopoutVersion,
    sentAt: new Date().toISOString(),
    sourceId: coachPopoutSourceIdRef.current,
    activeCallId,
    accountName: account.name || "Account",
    opportunityName: opportunity.name || "Opportunity",
    callStatus: coachPopoutCallStatus,
    coachStatus: liveCoachStatus,
    durationLimitSeconds: MAX_LIVE_CALL_SECONDS,
    elapsedSeconds: elapsed,
    limitNotice: coachPopoutLimitNotice,
    question: displayedCoachQuestion
      ? {
          ...displayedCoachQuestion,
          confidence: coachPopoutQuestionConfidence,
          isAsked: coachPopoutQuestionIsAsked,
        }
      : null,
    canActOnQuestion: Boolean(displayedCoachQuestion && !coachPopoutQuestionIsAsked),
    canEndCall: coachPopoutCanEndCall,
    message: getCoachPopoutMessage({
      callStatus: coachPopoutCallStatus,
      coachStatus: liveCoachStatus,
      hasQuestion: Boolean(displayedCoachQuestion),
      liveCoachError,
    }),
  }), [
    account.name,
    activeCallId,
    coachPopoutCallStatus,
    coachPopoutCanEndCall,
    coachPopoutQuestionConfidence,
    coachPopoutQuestionIsAsked,
    displayedCoachQuestion,
    elapsed,
    coachPopoutLimitNotice,
    liveCoachError,
    liveCoachStatus,
    opportunity.name,
  ])
  const postCallReplayCall = getLatestReplayableCallForOpportunity({
    calls,
    opportunityId: opportunity.id,
    preferredCallId: activeCallId || postCallFocusCallId,
  })
  const postCallTranscriptCall = getLatestCallForOpportunity({
    calls,
    opportunityId: opportunity.id,
    preferredCallId: activeCallId || postCallFocusCallId,
  })

  const publishCoachPopoutSnapshot = React.useCallback((snapshot: LiveCoachPopoutSnapshot) => {
    coachPopoutChannelRef.current?.postMessage(snapshot)
    writeStoredLiveCoachPopoutSnapshot(snapshot)
  }, [])

  const publishCoachPopoutCommandAcknowledgement = React.useCallback((
    acknowledgement: LiveCoachPopoutCommandAcknowledgement
  ) => {
    coachPopoutChannelRef.current?.postMessage(acknowledgement)
    writeStoredLiveCoachPopoutAcknowledgement(acknowledgement)
  }, [])

  React.useEffect(() => {
    coachPopoutSnapshotRef.current = coachPopoutSnapshot
  }, [coachPopoutSnapshot])

  React.useEffect(() => {
    coachPopoutQuestionRef.current = displayedCoachQuestion
  }, [displayedCoachQuestion])

  React.useEffect(() => {
    coachPopoutActiveCallIdRef.current = activeCallId
  }, [activeCallId])

  React.useEffect(() => {
    coachPopoutCanEndCallRef.current = coachPopoutCanEndCall
  }, [coachPopoutCanEndCall])

  React.useEffect(() => {
    const handleCommand = (command: LiveCoachPopoutCommand) => {
      if (command.sourceId === coachPopoutSourceIdRef.current) return
      if (!isFreshLiveCoachPopoutCommand(command)) return

      const commandKey = getLiveCoachPopoutCommandKey(command)
      if (processedCoachPopoutCommandKeysRef.current.has(commandKey)) return
      processedCoachPopoutCommandKeysRef.current.add(commandKey)
      if (processedCoachPopoutCommandKeysRef.current.size > 50) {
        const oldestCommandKey = processedCoachPopoutCommandKeysRef.current.values().next().value
        if (oldestCommandKey) processedCoachPopoutCommandKeysRef.current.delete(oldestCommandKey)
      }

      const acknowledgeCommand = (
        status: LiveCoachPopoutCommandAcknowledgement["status"],
        message: string
      ) => {
        publishCoachPopoutCommandAcknowledgement({
          type: "command_ack",
          version: liveCoachPopoutVersion,
          sentAt: new Date().toISOString(),
          sourceId: coachPopoutSourceIdRef.current,
          commandKey,
          status,
          message,
        })
      }

      if (command.command === "ready") {
        if (coachPopoutSnapshotRef.current) publishCoachPopoutSnapshot(coachPopoutSnapshotRef.current)
        return
      }

      const currentCallId = coachPopoutActiveCallIdRef.current
      if (!currentCallId || command.activeCallId !== currentCallId) {
        acknowledgeCommand("ignored", "That live call is no longer active in the main tab.")
        return
      }

      if (command.command === "end_call") {
        if (coachPopoutCanEndCallRef.current) {
          acknowledgeCommand("accepted", "Ending the call in SalesFrame.")
          void onStopRecording()
        } else {
          acknowledgeCommand("ignored", "That call cannot be ended from the popout right now.")
        }
        return
      }

      const currentQuestion = coachPopoutQuestionRef.current
      if (!currentQuestion || command.questionId !== currentQuestion.id) {
        acknowledgeCommand("ignored", "That question has already changed in the main tab.")
        return
      }

      if (command.command === "asked") {
        acknowledgeCommand("accepted", "Marked as asked in SalesFrame.")
        onMarkQuestionAsked(currentQuestion)
        return
      }

      if (command.command === "skip") {
        acknowledgeCommand("accepted", "Skipped in SalesFrame.")
        onCoachFeedback("skip", currentQuestion)
      }
    }

    const handleBroadcastMessage = (event: MessageEvent) => {
      if (isLiveCoachPopoutCommand(event.data)) handleCommand(event.data)
    }

    const handleStorageMessage = (event: StorageEvent) => {
      if (event.key !== liveCoachPopoutCommandStorageKey || !event.newValue) return

      try {
        const parsedValue: unknown = JSON.parse(event.newValue)
        if (isLiveCoachPopoutCommand(parsedValue)) handleCommand(parsedValue)
      } catch {
        // Ignore malformed storage events from older tabs.
      }
    }

    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(liveCoachPopoutChannelName)
      coachPopoutChannelRef.current = channel
      channel.addEventListener("message", handleBroadcastMessage)
    }

    window.addEventListener("storage", handleStorageMessage)

    return () => {
      window.removeEventListener("storage", handleStorageMessage)
      coachPopoutChannelRef.current?.removeEventListener("message", handleBroadcastMessage)
      coachPopoutChannelRef.current?.close()
      coachPopoutChannelRef.current = null
    }
  }, [
    onCoachFeedback,
    onMarkQuestionAsked,
    onStopRecording,
    publishCoachPopoutCommandAcknowledgement,
    publishCoachPopoutSnapshot,
  ])

  React.useEffect(() => {
    if (!activeCallId && !displayedCoachQuestion && !coachPopoutOpenedRef.current) return
    publishCoachPopoutSnapshot(coachPopoutSnapshot)
  }, [activeCallId, coachPopoutSnapshot, displayedCoachQuestion, publishCoachPopoutSnapshot])

  const handleOpenCoachPopout = React.useCallback(() => {
    if (typeof window === "undefined") return

    const placement = getLiveCoachPopoutPlacement()
    const popoutUrl = new URL(liveCoachPopoutRoute, window.location.origin)
    const popoutWindow = window.open(
      popoutUrl.toString(),
      "salesframe-live-coach",
      getLiveCoachPopoutFeatures(placement)
    )

    if (!popoutWindow) {
      setCoachPopoutMessage("Allow popups for SalesFrame, then try again.")
      return
    }

    coachPopoutOpenedRef.current = true
    setCoachPopoutMessage("")
    placeMainWindowForCoachPopout(placement)
    popoutWindow.focus()
    publishCoachPopoutSnapshot(coachPopoutSnapshot)
    window.setTimeout(() => publishCoachPopoutSnapshot(coachPopoutSnapshot), 250)
  }, [coachPopoutSnapshot, publishCoachPopoutSnapshot])

  React.useEffect(() => {
    setAiLiveGuidance(initialLiveGuidance)
    aiLiveGuidanceRef.current = initialLiveGuidance
    liveCoachHasGuidanceRef.current = Boolean(initialLiveGuidance)
    liveCoachGuidanceTurnCountRef.current = 0
    setLiveCoachError("")
    setLiveCoachStatus(initialLiveGuidance ? "ready" : "idle")
    liveCoachSignatureRef.current = ""
    liveCoachFeedbackCountRef.current = 0
    liveCoachHeartbeatHandledRef.current = 0
    liveCoachRefreshHandledRef.current = 0
    liveCoachFullGuidanceInFlightRef.current = false
    liveCoachPendingRefreshRef.current = false
    liveCoachQuestionRequestRef.current = 0
    liveCoachStateRequestRef.current = 0
    liveCoachLastDecisionAtRef.current = initialLiveGuidance ? Date.now() : 0
    setLiveCoachHeartbeatTick(0)
    setLiveCoachRefreshTick(0)
  }, [activeCallId, initialLiveGuidance, opportunity.id])

  React.useEffect(() => {
    aiLiveGuidanceRef.current = aiLiveGuidance
    liveCoachHasGuidanceRef.current = Boolean(aiLiveGuidance)
  }, [aiLiveGuidance])

  React.useEffect(() => {
    if (!activeCallId || !isRecording) return
    if (!["recording", "paused"].includes(captureStatus)) return

    const intervalId = window.setInterval(() => {
      setLiveCoachHeartbeatTick((current) => current + 1)
    }, LIVE_COACH_FAST_CHECK_MS)

    return () => window.clearInterval(intervalId)
  }, [activeCallId, captureStatus, isRecording])

  React.useEffect(() => {
    const aiTranscript = buildTranscriptForAi(transcript)
    const feedbackCountChanged = manualCoach.feedbackSignals.length !== liveCoachFeedbackCountRef.current
    const heartbeatTickChanged =
      liveCoachHeartbeatTick > 0 && liveCoachHeartbeatTick !== liveCoachHeartbeatHandledRef.current
    const refreshTickChanged =
      liveCoachRefreshTick > 0 && liveCoachRefreshTick !== liveCoachRefreshHandledRef.current
    if (!activeCallId || !isRecording) return
    if (aiTranscript.length === 0 && !feedbackCountChanged && !heartbeatTickChanged && !refreshTickChanged) return
    if (!account.id || !opportunity.id) return
    if (!["recording", "paused"].includes(captureStatus)) return

    const lastDecisionAt = liveCoachLastDecisionAtRef.current || 0
    const questionAuditDue =
      heartbeatTickChanged &&
      (!liveCoachHasGuidanceRef.current || !lastDecisionAt || Date.now() - lastDecisionAt >= LIVE_COACH_AI_RECHECK_MS)

    const signature = buildLiveGuidanceSignature({
      activeCallId,
      accountDraft,
      callPlaybooks,
      callType,
      customerResearch,
      sellerFeedback: manualCoach.feedbackSignals,
      opportunityId: opportunity.id,
      transcript: aiTranscript,
    })

    if (
      signature === liveCoachSignatureRef.current &&
      !feedbackCountChanged &&
      !heartbeatTickChanged &&
      !refreshTickChanged
    ) {
      return
    }

    const delay = feedbackCountChanged || refreshTickChanged || questionAuditDue ? 0 : transcript.length <= 1 ? 150 : 350

    const timeoutId = window.setTimeout(() => {
      setLiveCoachStatus(feedbackCountChanged || refreshTickChanged || questionAuditDue ? "thinking" : "checking")
      setLiveCoachError("")
      let fullGuidanceRequested = false
      const turnsSinceLastFullGuidance = Math.max(0, aiTranscript.length - liveCoachGuidanceTurnCountRef.current)
      const currentGuidanceSnapshot = aiLiveGuidanceRef.current
      const visibleQuestion = currentGuidanceSnapshot
        ? {
            question: currentGuidanceSnapshot.displayRecommendation?.question ?? currentGuidanceSnapshot.nextQuestion,
            reason: currentGuidanceSnapshot.displayRecommendation?.reason ?? currentGuidanceSnapshot.questionReason,
            target: currentGuidanceSnapshot.displayRecommendation?.primaryIntentLabel ?? currentGuidanceSnapshot.target,
            questionLifecycle: currentGuidanceSnapshot.questionLifecycle,
            uiMode: currentGuidanceSnapshot.uiMode,
          }
        : null
      const latestFeedback = manualCoach.feedbackSignals.at(-1)
      const shouldRejectRepeatedQuestion = latestFeedback
        ? ["asked", "skip", "too_soon", "softer"].includes(latestFeedback.action)
        : false
      const blockedQuestionTexts = shouldRejectRepeatedQuestion && latestFeedback?.question
        ? [latestFeedback.question]
        : []
      const refreshReason = questionAuditDue
        ? "periodic_30_second_ai_recheck"
        : feedbackCountChanged
          ? "seller_feedback"
          : refreshTickChanged
            ? "queued_refresh"
            : "transcript_or_flow_change"

      const guidancePayload = {
        account: {
          id: account.id,
          name: account.name,
          industry: account.description,
          website: account.website,
        },
        accountProfile: {
          accountNotes: accountDraft.accountNotes,
          competitors: accountDraft.competitors,
          currentTools: accountDraft.currentTools,
          employeeCount: accountDraft.employeeCount,
          profileNotes: accountDraft.accountNotes,
          region: accountDraft.region,
          strategicInitiatives: accountDraft.strategicInitiatives,
          website: accountDraft.website || account.website,
        },
        accountId: account.id,
        callId: activeCallId,
        callType,
        customerResearch,
        opportunity: {
          id: opportunity.id,
          name: opportunity.name,
          stage: opportunity.stage,
          amount: opportunity.amount,
          closeDate: opportunity.closeDate,
          coverage: opportunity.coverage,
          missing: opportunity.missing,
          weak: opportunity.weak,
        },
        opportunityId: opportunity.id,
        playbooks: callPlaybooks,
        currentGuidance: visibleQuestion,
        refreshContext: {
          reason: refreshReason,
          cadenceSeconds: LIVE_COACH_AI_RECHECK_SECONDS,
          elapsedSinceLastQuestionDecisionMs: liveCoachLastDecisionAtRef.current
            ? Date.now() - liveCoachLastDecisionAtRef.current
            : null,
          transcriptTurnCount: aiTranscript.length,
          turnsSinceLastFullGuidance,
          lastDisplayedQuestion: visibleQuestion,
          latestFeedback,
          blockedQuestionTexts,
        },
        sellerFeedback: manualCoach.feedbackSignals,
        transcript: aiTranscript,
      }

      const requestLiveQuestionRefresh = (retryAvoidSameQuestion = false) => {
        if (fullGuidanceRequested) return
        fullGuidanceRequested = true
        setLiveCoachStatus("thinking")

        if (liveCoachFullGuidanceInFlightRef.current) {
          liveCoachPendingRefreshRef.current = true
          return
        }

        liveCoachFullGuidanceInFlightRef.current = true
        const questionRequestId = liveCoachQuestionRequestRef.current + 1
        liveCoachQuestionRequestRef.current = questionRequestId
        const questionPayload = retryAvoidSameQuestion
          ? {
              ...guidancePayload,
              refreshContext: {
                ...guidancePayload.refreshContext,
                retryAvoidSameQuestion: true,
              },
            }
          : guidancePayload

        requestLiveQuestion(questionPayload)
          .then((response) => {
            if (questionRequestId !== liveCoachQuestionRequestRef.current) return

            const mappedGuidance = mapAiLiveGuidanceResponse(response)
            if (!mappedGuidance) {
              setAiLiveGuidance(null)
              liveCoachHasGuidanceRef.current = false
              setLiveCoachStatus("error")
              setLiveCoachError("SalesFrame is still reading the conversation. Keep listening for a moment, then try again.")
              return
            }

            if (shouldRejectRepeatedQuestion && latestFeedback?.question) {
              const mappedQuestion = createManualQuestionFromGuidance(mappedGuidance)
              const actedQuestionId = createManualQuestionId(
                "live",
                latestFeedback.target,
                latestFeedback.question
              )
              const repeatedQuestion =
                mappedQuestion.id === actedQuestionId ||
                normalizeComparableText(mappedQuestion.question) === normalizeComparableText(latestFeedback.question)

              if (repeatedQuestion && !retryAvoidSameQuestion) {
                fullGuidanceRequested = false
                liveCoachFullGuidanceInFlightRef.current = false
                requestLiveQuestionRefresh(true)
                return
              }

              if (repeatedQuestion) {
                setLiveCoachStatus("error")
                setLiveCoachError("SalesFrame heard that signal, but OpenAI repeated the same question. Try again in a moment.")
                return
              }
            }

            liveCoachGuidanceTurnCountRef.current = aiTranscript.length
            liveCoachHasGuidanceRef.current = true
            liveCoachSignatureRef.current = signature
            liveCoachFeedbackCountRef.current = manualCoach.feedbackSignals.length
            if (heartbeatTickChanged) liveCoachHeartbeatHandledRef.current = liveCoachHeartbeatTick
            if (refreshTickChanged) liveCoachRefreshHandledRef.current = liveCoachRefreshTick
            liveCoachLastDecisionAtRef.current = Date.now()
            setAiLiveGuidance(mappedGuidance)
            setLiveCoachStatus("ready")
          })
          .catch((caughtError: unknown) => {
            if (questionRequestId !== liveCoachQuestionRequestRef.current) return

            const existingGuidance = aiLiveGuidanceRef.current
            const refreshMessage = getUserFacingErrorMessage(
              caughtError,
              "SalesFrame is checking the latest turn. Keep the current question for now."
            )
            if (existingGuidance) {
              liveCoachHasGuidanceRef.current = true
              setLiveCoachStatus("ready")
              setLiveCoachError(`Keep this question for now. SalesFrame is checking whether the flow has moved. ${refreshMessage}`)
              return
            }

            setAiLiveGuidance(null)
            liveCoachHasGuidanceRef.current = false
            setLiveCoachStatus("error")
            setLiveCoachError(refreshMessage)
          })
          .finally(() => {
            if (questionRequestId === liveCoachQuestionRequestRef.current) {
              liveCoachFullGuidanceInFlightRef.current = false
              if (liveCoachPendingRefreshRef.current) {
                liveCoachPendingRefreshRef.current = false
                setLiveCoachRefreshTick((current) => current + 1)
              }
            }
          })
      }

      const forceFullGuidanceRefresh =
        feedbackCountChanged ||
        refreshTickChanged ||
        questionAuditDue ||
        !liveCoachHasGuidanceRef.current ||
        aiTranscript.length <= 1 ||
        turnsSinceLastFullGuidance >= LIVE_COACH_FORCE_REFRESH_TURNS

      const stateRequestId = liveCoachStateRequestRef.current + 1
      liveCoachStateRequestRef.current = stateRequestId

      void requestLiveState({
        accountId: account.id,
        callId: activeCallId,
        currentGuidance: guidancePayload.currentGuidance,
        opportunityId: opportunity.id,
        sellerFeedback: manualCoach.feedbackSignals,
        transcript: aiTranscript,
      })
        .then((response) => {
          if (stateRequestId !== liveCoachStateRequestRef.current) return

          const fastStateResponse = mapAiLiveStateResponse(response)
          if (!fastStateResponse) return

          const { conversationState: fastState, shouldRefreshQuestion, uiMode } = fastStateResponse

          setAiLiveGuidance((current) => current
            ? {
                ...current,
                activeIntentStatus: fastState.activeIntentStatus ?? fastState.intentStatus,
                conversationState: fastState,
                target: fastState.activeIntent || current.target,
                uiMode: uiMode ?? current.uiMode,
              }
            : current
          )

          if (shouldRefreshQuestion) {
            requestLiveQuestionRefresh()
          } else if (!fullGuidanceRequested) {
            liveCoachSignatureRef.current = signature
            if (heartbeatTickChanged) liveCoachHeartbeatHandledRef.current = liveCoachHeartbeatTick
            if (refreshTickChanged) liveCoachRefreshHandledRef.current = liveCoachRefreshTick
            setLiveCoachStatus("ready")
          }
        })
        .catch(() => {
          if (!fullGuidanceRequested) setLiveCoachStatus("ready")
        })

      if (forceFullGuidanceRefresh) requestLiveQuestionRefresh()
    }, delay)

    return () => window.clearTimeout(timeoutId)
  }, [
    account,
    accountDraft,
    activeCallId,
    callPlaybooks,
    callType,
    captureStatus,
    customerResearch,
    isRecording,
    liveCoachHeartbeatTick,
    liveCoachRefreshTick,
    manualCoach.feedbackSignals,
    opportunity,
    transcript,
  ])

  return (
    <Tabs key={defaultTab} defaultValue={defaultTab} className="grid w-full min-w-0 gap-4" onValueChange={onScrollToTop}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <TabsList className="grid w-full grid-cols-3 md:w-fit">
          <TabsTrigger value="opportunity">Opportunity</TabsTrigger>
          <TabsTrigger value="cockpit">Call cockpit</TabsTrigger>
          <TabsTrigger value="post-call">Post-call</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="cockpit" className="m-0 grid w-full min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex w-full flex-wrap justify-start gap-2 2xl:col-span-2">
          {isRecording ? (
            <Button
              className="gap-2"
              disabled={isStoppingCall}
              variant="destructive"
              onClick={() => void onStopRecording()}
            >
              <SquareIcon />
              {isStoppingCall ? "Stopping call" : "Stop call"}
            </Button>
          ) : account.id && opportunity.id ? (
            <StartRecordingDialog
              accounts={[account]}
              accountResearchById={accountResearchById}
              defaultAccountId={account.id}
              defaultOpportunityId={opportunity.id}
              opportunityDrafts={opportunityDrafts}
              opportunities={[opportunity]}
              savedOpenAiKeyState={savedOpenAiKeyState}
              sellerResearchProfile={sellerResearchProfile}
              workspaceId={workspaceId}
              onOpenSettings={onOpenSettings}
              onStartRecording={onStartRecording}
            />
          ) : null}
          {shouldShowCoachPopoutButton ? (
            <Button
              type="button"
              variant="outline"
              className="hidden gap-2 md:inline-flex"
              onClick={handleOpenCoachPopout}
            >
              <ExternalLinkIcon />
              Pop out coach
            </Button>
          ) : null}
          {coachPopoutMessage ? (
            <p className="hidden w-full text-sm text-muted-foreground md:block">
              {coachPopoutMessage}
            </p>
          ) : null}
        </div>
        <div className="grid min-w-0 gap-4">
          <NextQuestionCard
            callType={callType}
            coachError={liveCoachError}
            coachStatus={liveCoachStatus}
            guidance={liveGuidance}
            manualCoach={manualCoach}
            onCoachFeedback={onCoachFeedback}
            onMarkQuestionAsked={onMarkQuestionAsked}
            onNavigate={onNavigate}
            onUseManualQuestion={onUseManualQuestion}
          />
          <LiveCoachDetailTabs guidance={liveGuidance} />
        </div>
        <LiveRail
          activeCallId={activeCallId}
          callType={callType}
          audioPreflight={audioPreflight}
          captureError={captureError}
          capturePermissionState={capturePermissionState}
          captureStatus={isStoppingCall ? "stopping" : captureStatus}
          guidance={liveGuidance}
          isRecording={isRecording}
          notes={isRecording ? notes : []}
          onDeleteCall={onDeleteCall}
          onSpeakerIdentityChange={onSpeakerIdentityChange}
          onTranscriptSpeakerChange={onTranscriptSpeakerChange}
          searchQuery=""
          sellerName={sellerName}
          speakerIdentities={speakerIdentities}
          startCallAction={
            account.id && opportunity.id ? (
              <StartRecordingDialog
                accounts={[account]}
                accountResearchById={accountResearchById}
                defaultAccountId={account.id}
                defaultOpportunityId={opportunity.id}
                opportunityDrafts={opportunityDrafts}
                opportunities={[opportunity]}
                savedOpenAiKeyState={savedOpenAiKeyState}
                sellerResearchProfile={sellerResearchProfile}
                workspaceId={workspaceId}
                onOpenSettings={onOpenSettings}
                onStartRecording={onStartRecording}
              />
            ) : null
          }
          onStopRecording={onStopRecording}
          transcript={isRecording ? transcript : []}
        />
      </TabsContent>

      <TabsContent value="opportunity" className="m-0 w-full min-w-0">
        <OpportunityWorkspace
          activeCallId={activeCallId}
          account={account}
          accountDraft={accountDraft}
          accountResearchById={accountResearchById}
          activeView={activeView}
          calls={calls}
          opportunity={opportunity}
          opportunityDraft={opportunityDraft}
          opportunityDrafts={opportunityDrafts}
          playbookFields={playbookFields}
          playbookRows={playbookRows}
          savedOpenAiKeyState={savedOpenAiKeyState}
          savedOpportunityDraft={savedOpportunityDraft}
          sellerResearchProfile={sellerResearchProfile}
          workspaceId={workspaceId}
          onArchiveOpportunity={onArchiveOpportunity}
          onDeleteCall={onDeleteCall}
          onDeleteOpportunity={onDeleteOpportunity}
          onNavigate={onNavigate}
          onOpenSettings={onOpenSettings}
          onOpportunityDraftChange={onOpportunityDraftChange}
          onSaveOpportunityDraft={onSaveOpportunityDraft}
          onScrollToTop={onScrollToTop}
          onStartRecording={onStartRecording}
          opportunitySaveMessage={opportunitySaveMessage}
          opportunitySaveStatus={opportunitySaveStatus}
        />
      </TabsContent>

      <TabsContent value="post-call" className="m-0 w-full min-w-0">
        <PostCallPanel
          isProcessing={postCallGenerating}
          opportunity={opportunity}
          output={postCallOutput}
          processingError={postCallError}
          replayCall={postCallReplayCall}
          transcript={postCallTranscript}
          transcriptCall={postCallTranscriptCall}
          onDeleteCall={onDeleteCall}
          onViewNextCallBrief={() => onNavigate("opportunity-intelligence")}
        />
      </TabsContent>
    </Tabs>
  )
}

function OpportunityWorkspace({
  activeCallId,
  account,
  accountDraft,
  accountResearchById,
  activeView,
  calls,
  opportunity,
  opportunityDraft,
  opportunityDrafts,
  playbookFields,
  playbookRows,
  savedOpenAiKeyState,
  savedOpportunityDraft,
  sellerResearchProfile,
  workspaceId,
  onArchiveOpportunity,
  onDeleteCall,
  onDeleteOpportunity,
  onNavigate,
  onOpenSettings,
  onOpportunityDraftChange,
  onSaveOpportunityDraft,
  onScrollToTop,
  onStartRecording,
  opportunitySaveMessage,
  opportunitySaveStatus,
}: {
  activeCallId: string
  account: AccountNavItem
  accountDraft: AccountDraft
  accountResearchById: Record<string, CustomerResearchConfig>
  activeView: string
  calls: CallSummary[]
  opportunity: Opportunity
  opportunityDraft: OpportunityDraft
  opportunityDrafts: Record<string, OpportunityDraft>
  playbookFields: PlaybookFieldRow[]
  playbookRows: PlaybookRow[]
  savedOpenAiKeyState: SavedOpenAiKeyState | null
  savedOpportunityDraft: OpportunityDraft
  sellerResearchProfile: SellerResearchProfile
  workspaceId: string
  onArchiveOpportunity: (id: string) => void
  onDeleteCall: (callId: string) => void
  onDeleteOpportunity: (id: string) => void
  onNavigate: (view: string) => void
  onOpenSettings: () => void
  onOpportunityDraftChange: (field: keyof OpportunityDraft, value: string) => void
  onSaveOpportunityDraft: () => void
  onScrollToTop: () => void
  onStartRecording: StartRecordingHandler
  opportunitySaveMessage: string
  opportunitySaveStatus: RecordSaveStatus
}) {
  const defaultTab =
    activeView === "methodology" ? "methodology" : activeView === "opportunity-intelligence" ? "intelligence" : "record"

  return (
    <Tabs key={defaultTab} defaultValue={defaultTab} className="grid w-full min-w-0 gap-4" onValueChange={onScrollToTop}>
      <OpportunitySummaryStrip
        opportunity={opportunity}
        startCallAction={
          account.id && opportunity.id ? (
            <StartRecordingDialog
              accounts={[account]}
              accountResearchById={accountResearchById}
              defaultAccountId={account.id}
              defaultOpportunityId={opportunity.id}
              opportunityDrafts={opportunityDrafts}
              opportunities={[opportunity]}
              savedOpenAiKeyState={savedOpenAiKeyState}
              sellerResearchProfile={sellerResearchProfile}
              workspaceId={workspaceId}
              onOpenSettings={onOpenSettings}
              onStartRecording={onStartRecording}
            />
          ) : null
        }
      />
      <TabsList className="grid w-full grid-cols-4 md:w-fit">
        <TabsTrigger value="record">Record</TabsTrigger>
        <TabsTrigger value="intelligence">Intel</TabsTrigger>
        <TabsTrigger value="methodology">Methodology</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      <TabsContent value="record" className="m-0 grid w-full min-w-0 gap-4" data-testid="opportunity-record-stack">
        <OpportunityProfile
          account={account}
          opportunity={opportunity}
          opportunityDraft={opportunityDraft}
          savedOpportunityDraft={savedOpportunityDraft}
          onOpportunityDraftChange={onOpportunityDraftChange}
          onSaveOpportunityDraft={onSaveOpportunityDraft}
          saveMessage={opportunitySaveMessage}
          saveStatus={opportunitySaveStatus}
        />
        <AccountRecordPanel account={account} accountDraft={accountDraft} onNavigate={onNavigate} />
      </TabsContent>
      <TabsContent value="intelligence" className="m-0 w-full min-w-0">
        <OpportunityIntelligence
          opportunity={opportunity}
          playbookFields={playbookFields}
          playbookRows={playbookRows}
          selectedPlaybooks={parsePlaybookSelection(opportunityDraft.frameworks)}
        />
      </TabsContent>
      <TabsContent value="methodology" className="m-0 w-full min-w-0">
        <MethodologyGrid
          opportunity={opportunity}
          playbookFields={playbookFields}
          playbookRows={playbookRows}
          saveMessage={opportunitySaveMessage}
          saveStatus={opportunitySaveStatus}
          savedSelectedPlaybooks={parsePlaybookSelection(savedOpportunityDraft.frameworks)}
          selectedPlaybooks={parsePlaybookSelection(opportunityDraft.frameworks)}
          onSavePlaybooks={onSaveOpportunityDraft}
          onSelectedPlaybooksChange={(playbooks) =>
            onOpportunityDraftChange("frameworks", formatPlaybooks(playbooks))
          }
        />
      </TabsContent>
      <TabsContent value="history" className="m-0 w-full min-w-0">
        <OpportunityRecordingHistory
          activeCallId={activeCallId}
          calls={calls}
          opportunity={opportunity}
          onDeleteCall={onDeleteCall}
        />
      </TabsContent>
      {opportunity.id ? (
        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => onArchiveOpportunity(opportunity.id)}
          >
            <ArchiveIcon />
            Archive opportunity
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2 text-destructive hover:text-destructive"
            onClick={() => onDeleteOpportunity(opportunity.id)}
          >
            <Trash2Icon />
            Delete opportunity
          </Button>
        </div>
      ) : null}
    </Tabs>
  )
}

function OpportunitySummaryStrip({
  opportunity,
  startCallAction,
}: {
  opportunity: Opportunity
  startCallAction?: React.ReactNode
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {startCallAction}
      </div>
      <CoverageBadge value={opportunity.coverage} />
    </div>
  )
}

function NextQuestionCard({
  callType,
  coachError,
  coachStatus,
  guidance,
  manualCoach,
  onCoachFeedback,
  onMarkQuestionAsked,
  onNavigate,
  onUseManualQuestion,
}: {
  callType: string
  coachError: string
  coachStatus: LiveCoachStatus
  guidance: LiveGuidance | null
  manualCoach: ManualCoachState
  onCoachFeedback: (action: LiveSellerFeedbackAction, question: ManualQuestion) => void
  onMarkQuestionAsked: (question: ManualQuestion) => void
  onNavigate: (view: string) => void
  onUseManualQuestion: (question: ManualQuestion) => void
}) {
  const displayedQuestion = getDisplayedLiveCoachQuestion({ guidance, manualCoach })
  const isManualOverride = manualCoach.activeQuestion !== null
  const isAsked = displayedQuestion ? manualCoach.askedQuestionIds.includes(displayedQuestion.id) : false
  const confidence = guidance?.displayRecommendation?.confidence ?? guidance?.conversationState?.confidence
  const softerAlternative = guidance?.displayRecommendation?.softerAlternative
  const primaryIntentLabel = guidance?.displayRecommendation?.primaryIntentLabel
  const alsoCovers = guidance?.displayRecommendation?.alsoCovers ?? []
  const visibleAlsoCovers = alsoCovers.slice(0, 3)
  const additionalCoverCount = Math.max(0, alsoCovers.length - visibleAlsoCovers.length)
  const questionLifecycle = guidance?.questionLifecycle
  const parkedIntents = guidance?.parkedIntents ?? []
  const primaryParkedIntent = parkedIntents[0]
  const bankedIntentNote = guidance?.evidenceCommit?.bankedIntentNote
  const flowNote =
    guidance?.conversationState?.shouldRefreshQuestion
      ? `Following the buyer's thread: ${guidance.conversationState.refreshReason || "checking if this recommendation still fits"}`
      : coachStatus === "thinking" && displayedQuestion
        ? "Checking if this still fits."
        : guidance?.uiMode === "recover_before_close" || questionLifecycle?.stabilityRecommendation === "recover"
      ? `Before you wrap: recover ${primaryParkedIntent?.intentLabel ?? primaryIntentLabel ?? "one important gap"}`
      : guidance?.uiMode === "park_and_follow_flow" ||
          questionLifecycle?.stabilityRecommendation === "park" ||
          questionLifecycle?.currentQuestionState === "parked" ||
          questionLifecycle?.currentQuestionState === "stale"
        ? `Parked for a better moment: ${primaryParkedIntent?.intentLabel ?? primaryIntentLabel ?? "a high-value intent"}`
        : bankedIntentNote
          ? `Banked: ${bankedIntentNote}`
        : guidance?.conversationState && !guidance.conversationState.shouldAskNow
          ? `Best move right now: ${guidance.conversationState.naturalnessGuidance}`
          : ""
  const hasRecentManualAction = manualCoach.lastAction !== "No manual coaching actions yet."
  const cardTitle = displayedQuestion
    ? "Ask this next"
    : hasRecentManualAction
      ? "Getting the next recommendation"
      : coachStatus === "thinking"
        ? "Reading the conversation"
        : coachStatus === "checking"
          ? "Checking if this still fits"
          : "Ready for your next call"
  const emptyGuidanceTitle = hasRecentManualAction
    ? "Finding the next move"
    : "Start a call when you are ready"
  const emptyGuidanceDescription = hasRecentManualAction
    ? "SalesFrame heard that signal and is checking the flow before it shows the next question."
    : "SalesFrame will check audio, use the account context, opportunity history, call type, and selected playbooks, then bring back the first natural seller move before recording begins."
  return (
    <Card>
      <CardHeader>
        <div>
          <CardDescription>{displayedQuestion ? "Next best question" : "AI question guidance"}</CardDescription>
          <CardTitle className="mt-1 text-xl">{cardTitle}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        {displayedQuestion ? (
          <p
            key={`${displayedQuestion.id}-${displayedQuestion.question}`}
            aria-atomic="true"
            aria-live="polite"
            className="next-question-text animate-in fade-in-0 slide-in-from-bottom-1 duration-300 max-w-5xl break-words text-2xl leading-[1.08] font-semibold sm:text-3xl md:text-4xl lg:text-[2.75rem]"
          >
            “{displayedQuestion.question}”
          </p>
        ) : (
          <div className="grid gap-3 rounded-lg bg-muted/30 p-4" role="status" aria-live="polite" aria-atomic="true">
            <div className="flex items-center gap-2">
              <SparklesIcon className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium">{emptyGuidanceTitle}</p>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {emptyGuidanceDescription}
            </p>
            {coachError ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                {coachError}
              </div>
            ) : null}
          </div>
        )}
        <div className="grid max-w-5xl gap-1 text-sm text-muted-foreground">
          {displayedQuestion ? (
            <p>{displayedQuestion.reason}</p>
          ) : null}
          {typeof confidence === "number" ? (
            <p>{Math.round(confidence * 100)}% confidence</p>
          ) : null}
          {isAsked ? <p>Listening for the answer</p> : null}
        </div>
        {visibleAlsoCovers.length ? (
          <div className="rounded-lg bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Also updates: </span>
            {visibleAlsoCovers.map((cover) => `${cover.playbookLabel} ${cover.fieldLabel}`).join(", ")}
            {additionalCoverCount ? `, +${additionalCoverCount} more` : ""}
          </div>
        ) : null}
        {flowNote ? (
          <div
            className="max-w-5xl truncate rounded-lg bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            {flowNote}
          </div>
        ) : null}
        {coachStatus === "error" && coachError && displayedQuestion ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {coachError}
          </div>
        ) : null}
        {isManualOverride && displayedQuestion ? (
          <div className="grid gap-2 rounded-lg bg-primary/5 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <UserRoundCheckIcon className="size-4" />
              Seller-selected question
            </div>
            <p className="text-sm text-muted-foreground">
              This question stays in focus until the seller marks it asked or selects a different next question.
            </p>
          </div>
        ) : null}
        {hasRecentManualAction ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/30 p-3 text-sm">
            <CheckCircle2Icon className="size-4 text-emerald-600" />
            <span className="text-muted-foreground">{manualCoach.lastAction}</span>
          </div>
        ) : null}
        {displayedQuestion ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="gap-2"
              disabled={isAsked}
              onClick={() => onMarkQuestionAsked(displayedQuestion)}
            >
              <CheckCircle2Icon />
              Asked
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => onCoachFeedback("too_soon", displayedQuestion)}
            >
              <Clock3Icon />
              Too soon
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => {
                onCoachFeedback("softer", displayedQuestion)
                if (softerAlternative) {
                  onUseManualQuestion({
                    ...displayedQuestion,
                    id: `softer-${displayedQuestion.id}`,
                    question: softerAlternative,
                    reason: "Softer version of the current AI recommendation.",
                    source: "alternative",
                  })
                }
              }}
            >
              <SparklesIcon />
              Softer
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => onCoachFeedback("skip", displayedQuestion)}
            >
              <ArrowRightIcon />
              Skip
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function LiveCoachDetailTabs({
  guidance,
}: {
  guidance: LiveGuidance | null
}) {
  if (!guidance) return null

  return (
    <Tabs defaultValue="gaps" className="grid gap-3">
      <TabsList className="grid w-full grid-cols-3 md:w-fit">
        <TabsTrigger value="gaps">Gaps</TabsTrigger>
        <TabsTrigger value="parked">Parked</TabsTrigger>
        <TabsTrigger value="read">Coach read</TabsTrigger>
      </TabsList>
      <TabsContent value="gaps" className="m-0">
        <PriorityGapsCard guidance={guidance} />
      </TabsContent>
      <TabsContent value="parked" className="m-0">
        <ParkedIntentsCard guidance={guidance} />
      </TabsContent>
      <TabsContent value="read" className="m-0">
        <ConversationMapCard guidance={guidance} />
      </TabsContent>
    </Tabs>
  )
}

function PriorityGapsCard({
  guidance,
}: {
  guidance: LiveGuidance
}) {
  const gaps = guidance.gaps ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Intent clusters to cover</CardTitle>
        <CardDescription>
          Shared playbook intents are ranked by timing, buyer mood, evidence strength, and conversational fit
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {gaps.map((gap, index) => (
          <div key={`${gap.label}-${index}`} className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                gap.status === "missing"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <p className="text-sm font-medium">{gap.label}</p>
                <span className="text-xs text-muted-foreground">{gap.status}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{gap.detail}</p>
            </div>
          </div>
        ))}
        {gaps.length === 0 ? (
          <ListEmptyState
            icon={<CheckCircle2Icon />}
            title="Intent coverage is quiet"
            message="Required live-call intent clusters have been asked or answered. SalesFrame will listen for risk, contradiction, or a natural next step."
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

function ParkedIntentsCard({
  guidance,
}: {
  guidance: LiveGuidance
}) {
  const parkedIntents = guidance.parkedIntents ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parked intents</CardTitle>
        <CardDescription>Important questions saved for a better moment</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {parkedIntents.map((intent) => (
          <div key={`${intent.intentClusterId}-${intent.latestRevisitMoment}`} className="grid gap-2 rounded-lg bg-muted/30 p-3 text-sm">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="font-medium">{intent.intentLabel}</p>
              <span className={cn("text-xs", intent.priority === "high" ? "font-medium text-destructive" : "text-muted-foreground")}>
                {intent.priority} priority
              </span>
              <span className="text-xs text-muted-foreground">
                {intent.latestRevisitMoment === "before_wrap"
                  ? "Before wrap"
                  : intent.latestRevisitMoment === "next_call"
                    ? "Next call"
                    : "Mid-call"}
              </span>
            </div>
            <p className="text-muted-foreground">{intent.reasonParked}</p>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Re-entry cue: </span>
              {intent.reentryCue}
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Bridge: </span>
              “{intent.bridgeQuestion}”
            </p>
          </div>
        ))}
        {parkedIntents.length === 0 ? (
          <ListEmptyState
            icon={<Clock3Icon />}
            title="Nothing parked right now"
            message="SalesFrame is following the current conversation thread and will save intent debt when the timing is wrong."
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

function ConversationMapCard({
  guidance,
}: {
  guidance: LiveGuidance
}) {
  const flow = guidance.flow ?? []
  const candidateScores = guidance.candidateScores ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Coach read</CardTitle>
        <CardDescription>Flow, timing, and ranked alternatives</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {candidateScores.length ? (
          <div className="grid gap-2">
            {candidateScores.map((candidate, index) => (
              <div key={`${candidate.target}-${index}`} className="grid gap-1 rounded-lg bg-muted/30 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{index === 0 ? "Chosen" : `Option ${index + 1}`}</span>
                  <span className="text-xs font-medium text-muted-foreground">{Math.round(candidate.overallScore * 100)}%</span>
                </div>
                <p className="text-muted-foreground">{candidate.reason}</p>
                <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                  <span>Ask now {Math.round(candidate.askNowFit * 100)}%</span>
                  <span>Topic {Math.round(candidate.currentTopicFit * 100)}%</span>
                  <span>Re-entry {Math.round(candidate.reentryPotential * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {flow.map(({ label, detail }) => (
          <div key={label} className="grid grid-cols-[28px_1fr] gap-3">
            <div className="flex size-7 items-center justify-center rounded-full border text-xs font-medium">
              {label.slice(0, 1)}
            </div>
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-sm text-muted-foreground">{detail}</p>
            </div>
          </div>
        ))}
        {!candidateScores.length && !flow.length ? (
          <ListEmptyState
            icon={<SparklesIcon />}
            title="No coach read yet"
            message="SalesFrame will show timing, flow, and ranked alternatives after the next guidance update."
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

type MethodologyChecklistStatus = Opportunity["meddicc"][number]["status"]

type MethodologyChecklistItem = {
  detail: string
  label: string
  status: MethodologyChecklistStatus
}

function getMethodologyChecklistItems({
  capturedFields,
  framework,
  playbookFields,
  playbookRows,
}: {
  capturedFields: Array<Opportunity["meddicc"][number]>
  framework: CallPlaybook
  playbookFields: PlaybookFieldRow[]
  playbookRows: PlaybookRow[]
}): MethodologyChecklistItem[] {
  const selectedName = normalizePlaybooks([framework])[0]
  const playbookRow = playbookRows.find((playbook) => getCanonicalMethodologyPlaybookName(playbook) === selectedName)
  const configuredRows = playbookRow
    ? [...playbookFields]
        .filter((field) => field.playbook_id === playbookRow.id)
        .sort((first, second) => first.sort_order - second.sort_order)
    : []
  const fallbackPlaybook = playbooks.find((playbook) => normalizePlaybooks([playbook.name])[0] === selectedName)
  const configuredFields = configuredRows.length
    ? configuredRows.map((field) => ({
        detail: field.evidence_standard || field.description || "Use buyer evidence that clearly supports this field.",
        label: field.label,
      }))
    : (fallbackPlaybook?.fields ?? []).map(([label, detail]) => ({ detail, label }))

  if (!configuredFields.length) {
    return [
      {
        detail: "Add required fields to this playbook before it can be scored on an opportunity.",
        label: "Required fields",
        status: "missing",
      },
    ]
  }

  const capturedByLabel = new Map(
    capturedFields.map((field) => [normalizeSearchText(field.label), field])
  )

  return configuredFields.map((field) => {
    const capturedField = capturedByLabel.get(normalizeSearchText(field.label))

    return {
      detail: capturedField?.detail || field.detail,
      label: field.label,
      status: capturedField?.status ?? "missing",
    }
  })
}

type OpportunityMethodologySummary = {
  confirmed: number
  coverage: number
  missing: number
  total: number
  weak: number
}

function getOpportunityMethodologySummary({
  opportunity,
  playbookFields,
  playbookRows,
  selectedPlaybooks,
}: {
  opportunity: Opportunity
  playbookFields: PlaybookFieldRow[]
  playbookRows: PlaybookRow[]
  selectedPlaybooks: CallPlaybook[]
}): OpportunityMethodologySummary {
  const capturedFields = [...opportunity.meddicc, ...opportunity.bant]
  const items = normalizePlaybooks(selectedPlaybooks).flatMap((framework) =>
    getMethodologyChecklistItems({
      capturedFields,
      framework,
      playbookFields,
      playbookRows,
    })
  )
  const confirmed = items.filter((field) => field.status === "confirmed").length
  const weak = items.filter((field) => field.status === "weak").length
  const missing = items.filter((field) => field.status === "missing").length
  const total = items.length
  const coverage = total ? Math.round((confirmed / total) * 100) : opportunity.coverage

  return {
    confirmed,
    coverage,
    missing,
    total,
    weak,
  }
}

function applyOpportunityMethodologySummary(
  opportunity: Opportunity,
  summary: OpportunityMethodologySummary
): Opportunity {
  return {
    ...opportunity,
    coverage: summary.coverage,
    missing: summary.missing,
    weak: summary.weak,
  }
}

function getCanonicalMethodologyPlaybookName(playbook: PlaybookRow) {
  return normalizePlaybooks([playbook.slug === "custom" ? "Custom framework" : playbook.name])[0]
}

function getMethodologyChecklistStatusLabel(status: MethodologyChecklistStatus) {
  if (status === "confirmed") return "Covered"
  if (status === "weak") return "Weak"

  return "Missing"
}

function getMethodologyChecklistIconClassName(status: MethodologyChecklistStatus) {
  if (status === "confirmed") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
  if (status === "weak") return "bg-amber-400/20 text-amber-700 dark:text-amber-300"

  return "bg-muted text-muted-foreground"
}

function getMethodologyChecklistTextClassName(status: MethodologyChecklistStatus) {
  if (status === "confirmed") return "border-emerald-500/25 text-emerald-700 dark:text-emerald-300"
  if (status === "weak") return "border-amber-400/40 text-amber-700 dark:text-amber-300"

  return "text-muted-foreground"
}

function MethodologyGrid({
  opportunity,
  onSavePlaybooks,
  onSelectedPlaybooksChange,
  playbookFields,
  playbookRows,
  saveMessage,
  saveStatus,
  savedSelectedPlaybooks,
  selectedPlaybooks,
}: {
  opportunity: Opportunity
  onSavePlaybooks: () => void
  onSelectedPlaybooksChange: (playbooks: CallPlaybook[]) => void
  playbookFields: PlaybookFieldRow[]
  playbookRows: PlaybookRow[]
  saveMessage: string
  saveStatus: RecordSaveStatus
  savedSelectedPlaybooks: CallPlaybook[]
  selectedPlaybooks: CallPlaybook[]
}) {
  const selectedSet = new Set(selectedPlaybooks)
  const transcriptLineCount = opportunity.transcript.length
  const capturedFields = [...opportunity.meddicc, ...opportunity.bant]
  const checklistGroups = selectedPlaybooks.map((framework) => {
    const requiredFields = getMethodologyChecklistItems({
      capturedFields,
      framework,
      playbookFields,
      playbookRows,
    })
    const coveredCount = requiredFields.filter((field) => field.status === "confirmed").length
    const weakCount = requiredFields.filter((field) => field.status === "weak").length
    const missingCount = requiredFields.filter((field) => field.status === "missing").length

    return {
      coveredCount,
      framework,
      missingCount,
      requiredFields,
      weakCount,
    }
  })
  const weakFieldCount = checklistGroups.reduce((total, group) => total + group.weakCount, 0)
  const missingFieldCount = checklistGroups.reduce((total, group) => total + group.missingCount, 0)
  const playbooksHaveChanges = !arePlaybookSelectionsEqual(selectedPlaybooks, savedSelectedPlaybooks)

  const togglePlaybook = (playbook: CallPlaybook) => {
    if (selectedSet.has(playbook) && selectedPlaybooks.length === 1) return

    const nextSelected = selectedSet.has(playbook)
      ? selectedPlaybooks.filter((item) => item !== playbook)
      : [...selectedPlaybooks, playbook]

    onSelectedPlaybooksChange(normalizePlaybooks(nextSelected))
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Opportunity methodology</CardTitle>
            <CardDescription>
              Select the playbooks this opportunity should enforce during calls.
            </CardDescription>
          </div>
          <CardAction className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
            <span className="max-w-full truncate text-sm text-muted-foreground sm:max-w-[260px]">{formatPlaybooks(selectedPlaybooks)}</span>
              <Button
                size="sm"
                className="w-full gap-2 sm:w-auto"
                disabled={saveStatus === "saving" || selectedPlaybooks.length === 0 || !playbooksHaveChanges}
                onClick={onSavePlaybooks}
              >
              <CheckCircle2Icon />
              {saveStatus === "saving" ? "Saving..." : "Save methodologies"}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4">
          {saveMessage && !(saveStatus === "saved" && playbooksHaveChanges) ? (
            <RecordStatusMessage message={saveMessage} status={saveStatus} />
          ) : null}
          <div className="grid gap-2">
            <Label>Selected playbooks</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {callPlaybookOptions.map((playbook) => {
                const isSelected = selectedSet.has(playbook)

                return (
                  <Button
                    key={playbook}
                    type="button"
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    className="gap-2"
                    aria-pressed={isSelected}
                    aria-describedby="methodology-playbook-selection-help"
                    onClick={() => togglePlaybook(playbook)}
                  >
                    {isSelected ? <CheckIcon /> : <PlusIcon />}
                    {playbook}
                  </Button>
                )
              })}
            </div>
            <p id="methodology-playbook-selection-help" className="text-sm text-muted-foreground">
              Keep at least one playbook selected so the live coach has a methodology to enforce.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">Transcript lines captured</p>
              <p className="mt-1 text-2xl font-semibold">{transcriptLineCount}</p>
            </div>
            <div className="rounded-lg bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">Last AI coverage</p>
              <p className="mt-1 text-2xl font-semibold">{opportunity.coverage}%</p>
            </div>
            <div className="rounded-lg bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">Weak fields</p>
              <p className="mt-1 text-2xl font-semibold">{weakFieldCount}</p>
            </div>
            <div className="rounded-lg bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">Missing</p>
              <p className="mt-1 text-2xl font-semibold">{missingFieldCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {checklistGroups.map(({ coveredCount, framework, requiredFields }) => {
          return (
            <Card key={framework}>
              <CardHeader>
                <div>
                  <CardTitle>{framework}</CardTitle>
                  <CardDescription>{callPlaybookDescriptions[framework]}</CardDescription>
                </div>
                <CardAction>
                  <span className="text-sm text-muted-foreground">
                    {coveredCount}/{requiredFields.length} covered
                  </span>
                </CardAction>
              </CardHeader>
              <CardContent className="grid gap-2">
                {requiredFields.map((field) => (
                  <div key={field.label} className="flex min-w-0 gap-3 rounded-lg bg-muted/25 p-3">
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                        getMethodologyChecklistIconClassName(field.status)
                      )}
                      aria-hidden="true"
                    >
                      {field.status === "confirmed" ? (
                        <CheckIcon className="size-3.5" />
                      ) : field.status === "weak" ? (
                        <CircleAlertIcon className="size-3.5" />
                      ) : (
                        <CircleDotIcon className="size-3.5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{field.label}</p>
                        <span className={cn("text-xs font-medium", getMethodologyChecklistTextClassName(field.status))}>
                          {getMethodologyChecklistStatusLabel(field.status)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{field.detail}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function AccountRecordPanel({
  account,
  accountDraft,
  onNavigate,
}: {
  account: AccountNavItem
  accountDraft: AccountDraft
  onNavigate: (view: string) => void
}) {
  const accountSummaryRows = [
    ["Account name", accountDraft.accountName || account.name],
    ["Website", accountDraft.website],
    ["Industry", accountDraft.industry || account.description],
    ["Employees", accountDraft.employeeCount],
    ["Location", accountDraft.region],
    ["Currency", accountDraft.currency],
  ]
  const accountContextRows = [
    ["Current tools", accountDraft.currentTools],
    ["Strategic initiatives", accountDraft.strategicInitiatives],
    ["Competitors", accountDraft.competitors],
    ["Account notes", accountDraft.accountNotes],
  ]

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Account record</CardTitle>
          <CardDescription>Account data linked to this opportunity</CardDescription>
        </div>
        <CardAction>
          <OpenButton label="Open account" onClick={() => onNavigate("account-detail")} />
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {accountSummaryRows.map(([label, value]) => (
            <RecordFieldTile key={label} label={label} value={value || "Not captured"} />
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {accountContextRows.map(([label, value]) => (
            <RecordFieldTile key={label} label={label} value={value || "Not captured"} roomy />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function RecordFieldTile({
  label,
  roomy = false,
  value,
}: {
  label: string
  roomy?: boolean
  value: string
}) {
  return (
    <div className={cn("rounded-lg bg-muted/20 p-3", roomy && "min-h-24")}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm leading-relaxed break-words">{value}</p>
    </div>
  )
}

function SpeakerIdentityPanel({
  identities,
  onSpeakerIdentityChange,
  sellerName,
  transcript,
}: {
  identities: CallSpeakerIdentityMap
  onSpeakerIdentityChange: (payload: SpeakerIdentityChangePayload) => Promise<SpeakerIdentityChangeResult>
  sellerName: string
  transcript: Opportunity["transcript"]
}) {
  const [addedSpeakerLabels, setAddedSpeakerLabels] = React.useState<TranscriptSpeaker[]>([])
  const [pendingSpeakerLabel, setPendingSpeakerLabel] = React.useState<TranscriptSpeaker | null>(null)
  const [speakerSaveMessage, setSpeakerSaveMessage] = React.useState("")
  const [speakerSaveTone, setSpeakerSaveTone] = React.useState<"saved" | "local" | "error">("saved")
  const touchedSpeakerLabelsRef = React.useRef(new Set<TranscriptSpeaker>())
  const hasTranscriptText = transcript.some((line) => line.text.trim())
  const speakerRows = React.useMemo(() => {
    const labels = new Map<TranscriptSpeaker, { displayName: string; lineCount: number }>()
    const requiredLabels: TranscriptSpeaker[] = ["Seller", "Customer"]

    transcript.forEach((line) => {
      if (!line.text.trim()) return

      const label = getTranscriptSpeakerLabel(line)
      if (label === "Unknown") return

      const existingLabel = labels.get(label)

      labels.set(label, {
        displayName: existingLabel?.displayName || getTranscriptSpeakerDisplayName(line),
        lineCount: (existingLabel?.lineCount ?? 0) + 1,
      })
    })

    Object.entries(identities).forEach(([rawLabel, identity]) => {
      const label = getCanonicalTranscriptSpeakerLabel(normalizeTranscriptSpeakerLabel(rawLabel))
      if (!identity) return
      if (label === "Unknown") return

      labels.set(label, {
        displayName: identity.displayName || labels.get(label)?.displayName || label,
        lineCount: labels.get(label)?.lineCount ?? 0,
      })
    })

    ;[...requiredLabels, ...addedSpeakerLabels].forEach((label) => {
      if (labels.has(label)) return

      labels.set(label, {
        displayName: label,
        lineCount: 0,
      })
    })

    const labelOrder: TranscriptSpeaker[] = ["Seller", "Customer", "Customer 2", "Customer 3"]

    return [...labels.entries()]
      .sort(([leftLabel], [rightLabel]) => {
        const leftIndex = labelOrder.indexOf(leftLabel)
        const rightIndex = labelOrder.indexOf(rightLabel)

        return (leftIndex === -1 ? labelOrder.length : leftIndex) - (rightIndex === -1 ? labelOrder.length : rightIndex)
      })
      .map(([label, details]) => ({
        displayName: identities[label]?.displayName || details.displayName || label,
        isMe: Boolean(identities[label]?.isMe),
        label,
        lineCount: details.lineCount,
      }))
  }, [addedSpeakerLabels, identities, transcript])
  const [draftNames, setDraftNames] = React.useState<Record<string, string>>({})
  const nextSpeakerLabel = React.useMemo(() => {
    const visibleLabels = new Set(speakerRows.map((speaker) => speaker.label))
    return (["Customer 2", "Customer 3"] as TranscriptSpeaker[]).find((label) => !visibleLabels.has(label)) ?? null
  }, [speakerRows])
  const hasSpeakerIdentityContext =
    addedSpeakerLabels.length > 0 ||
    speakerRows.some((speaker) => {
      const savedIdentity = identities[speaker.label]
      const savedName = savedIdentity?.displayName?.trim() ?? ""

      return speaker.lineCount > 0 || Boolean(savedIdentity?.isMe) || Boolean(savedName && savedName !== speaker.label)
    })
  const saveSpeakerIdentity = React.useCallback(
    async (payload: SpeakerIdentityChangePayload) => {
      const normalizedLabel = getCanonicalTranscriptSpeakerLabel(normalizeTranscriptSpeakerLabel(payload.label))
      if (normalizedLabel === "Unknown") return

      setPendingSpeakerLabel(normalizedLabel)
      setSpeakerSaveMessage("")
      setSpeakerSaveTone("saved")

      try {
        const result = await onSpeakerIdentityChange({
          ...payload,
          label: normalizedLabel,
        })
        touchedSpeakerLabelsRef.current.delete(normalizedLabel)
        setDraftNames((items) => ({
          ...items,
          [normalizedLabel]: (payload.isMe ? sellerName || "Me" : payload.displayName).trim(),
        }))
        setSpeakerSaveTone(result.persistence === "saved" ? "saved" : "local")
        setSpeakerSaveMessage(result.message || (result.persistence === "saved" ? "Speaker name saved." : "Speaker name applied locally."))
      } catch (caughtError: unknown) {
        touchedSpeakerLabelsRef.current.add(normalizedLabel)
        setSpeakerSaveTone("error")
        setSpeakerSaveMessage(
          getUserFacingErrorMessage(caughtError, "Speaker name was applied locally and will sync when the connection recovers.")
        )
      } finally {
        setPendingSpeakerLabel(null)
      }
    },
    [onSpeakerIdentityChange, sellerName]
  )

  React.useEffect(() => {
    setDraftNames((items) => {
      const nextItems = { ...items }
      let changed = false

      speakerRows.forEach((speaker) => {
        if (touchedSpeakerLabelsRef.current.has(speaker.label)) return

        const nextName = speaker.displayName === speaker.label ? "" : speaker.displayName
        if (nextItems[speaker.label] === nextName) return

        nextItems[speaker.label] = nextName
        changed = true
      })

      return changed ? nextItems : items
    })
  }, [speakerRows])

  if (!hasTranscriptText || !hasSpeakerIdentityContext || speakerRows.length === 0) return null

  return (
    <details className="group rounded-lg bg-muted/20 px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
        <span className="text-xs font-medium text-muted-foreground">Speaker map</span>
        <ChevronDownIcon className="size-3.5 text-muted-foreground transition-transform duration-200 ease-linear group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="mt-2 grid gap-2">
        {nextSpeakerLabel ? (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              aria-label={`Add ${nextSpeakerLabel} to speaker map`}
              onClick={() => setAddedSpeakerLabels((labels) => [...labels, nextSpeakerLabel])}
            >
              <PlusIcon />
              Add speaker
            </Button>
          </div>
        ) : null}
        {speakerRows.map((speaker) => {
          const draftValue = draftNames[speaker.label] ?? ""
          const savedName = speaker.displayName === speaker.label ? "" : speaker.displayName
          const isPending = pendingSpeakerLabel === speaker.label

          return (
            <div key={speaker.label} className="grid gap-2 rounded-md bg-background p-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className={cn("text-sm font-medium", speaker.isMe && "text-primary")}>
                  {speaker.label}
                </span>
                {speaker.lineCount > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {speaker.lineCount} {speaker.lineCount === 1 ? "turn" : "turns"}
                  </span>
                ) : null}
              </div>
              <Input
                aria-label={`Name ${speaker.label}`}
                value={draftValue}
                className="h-8"
                placeholder={speaker.label.startsWith("Speaker") ? "Name this speaker" : `${speaker.label} name`}
                disabled={isPending}
                onChange={(event) => {
                  touchedSpeakerLabelsRef.current.add(speaker.label)
                  setSpeakerSaveMessage("")
                  setSpeakerSaveTone("saved")
                  setDraftNames((items) => ({
                    ...items,
                    [speaker.label]: event.currentTarget.value,
                  }))
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void saveSpeakerIdentity({
                      displayName: draftValue,
                      label: speaker.label,
                    })
                  }
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 flex-1 gap-1.5 sm:flex-none"
                  disabled={isPending || draftValue.trim() === savedName.trim()}
                  onClick={() =>
                    void saveSpeakerIdentity({
                      displayName: draftValue,
                      label: speaker.label,
                    })
                  }
                >
                  <CheckIcon />
                  Save
                </Button>
                <Button
                  type="button"
                  variant={speaker.isMe ? "default" : "outline"}
                  size="sm"
                  className="h-8 flex-1 gap-1.5 sm:flex-none"
                  disabled={isPending || speaker.isMe}
                  onClick={() =>
                    void saveSpeakerIdentity({
                      displayName: sellerName || "Me",
                      isMe: true,
                      label: speaker.label,
                    })
                  }
                >
                  <UserRoundCheckIcon />
                  Me
                </Button>
              </div>
            </div>
          )
        })}
        {speakerSaveMessage ? (
          <p
            className={cn(
              "px-1 text-xs",
              speakerSaveTone === "saved" && "text-muted-foreground",
              speakerSaveTone === "local" && "text-amber-700 dark:text-amber-400",
              speakerSaveTone === "error" && "text-destructive"
            )}
            role={speakerSaveTone === "saved" ? "status" : "alert"}
          >
            {speakerSaveMessage}
          </p>
        ) : null}
      </div>
    </details>
  )
}

function LiveRail({
  activeCallId,
  audioPreflight,
  callType,
  captureError,
  capturePermissionState,
  captureStatus,
  guidance,
  isRecording,
  notes,
  onDeleteCall,
  onSpeakerIdentityChange,
  onTranscriptSpeakerChange,
  onStopRecording,
  searchQuery,
  sellerName,
  speakerIdentities,
  startCallAction,
  transcript,
}: {
  activeCallId: string
  audioPreflight: AudioPreflightResult | null
  callType: string
  captureError: string | null
  capturePermissionState: CallCapturePermissionState
  captureStatus: CallCaptureStatus
  guidance: LiveGuidance | null
  isRecording: boolean
  notes: string[]
  onDeleteCall: (callId: string) => void
  onSpeakerIdentityChange: (payload: SpeakerIdentityChangePayload) => Promise<SpeakerIdentityChangeResult>
  onTranscriptSpeakerChange: (segmentId: string, speaker: TranscriptSpeaker) => void
  onStopRecording: () => void | Promise<void>
  searchQuery: string
  sellerName: string
  speakerIdentities: CallSpeakerIdentityMap
  startCallAction?: React.ReactNode
  transcript: Opportunity["transcript"]
}) {
  const visibleNotes = getFuzzyMatches(notes, searchQuery, (note) => note)
  const visibleEvidence = getFuzzyMatches(
    guidance?.evidence ?? [],
    searchQuery,
    (item) => `${item.label} ${item.framework} ${item.status} ${item.detail}`
  )
  const visibleTranscript = getFuzzyMatches(
    transcript,
    searchQuery,
    (line) => `${getTranscriptSpeakerDisplayName(line)} ${getTranscriptSpeakerLabel(line)} ${line.time} ${line.text}`
  )
  const hasSearch = normalizeSearchText(searchQuery).length > 0
  const transcriptScrollRef = React.useRef<HTMLDivElement | null>(null)
  const transcriptEndRef = React.useRef<HTMLDivElement | null>(null)
  const shouldAutoScrollTranscriptRef = React.useRef(true)
  const transcriptScrollSignature = visibleTranscript
    .map((line) => `${line.clientId ?? line.id}:${line.text.length}:${line.isPartial ? "partial" : "final"}`)
    .join("|")
  const isCaptureActive =
    isRecording || ["requesting-permission", "connecting", "recording", "paused", "stopping"].includes(captureStatus)
  const displayCaptureStatus: CallCaptureStatus =
    isRecording && ["idle", "error", "stopped", "upload-failed"].includes(captureStatus)
      ? "recording"
      : captureStatus
  const captureIndicators = getAudioHealthIndicators({
    audioPreflight,
    capturePermissionState,
    captureStatus: displayCaptureStatus,
    guidance,
  })
  const shouldShowSignalHealth =
    isCaptureActive || ["permission-denied", "error", "upload-failed"].includes(displayCaptureStatus)
  const canStartFromRail =
    Boolean(startCallAction) &&
    !activeCallId &&
    !isRecording &&
    !isCaptureActive &&
    ["idle", "error", "permission-denied", "stopped", "upload-failed"].includes(captureStatus)
  const canStopFromRail = isCaptureActive && displayCaptureStatus !== "stopping"
  const canDeleteFromRail = Boolean(activeCallId) && !isCaptureActive
  const recordingActionLabel =
    displayCaptureStatus === "requesting-permission" || displayCaptureStatus === "connecting"
      ? "Cancel call"
      : displayCaptureStatus === "stopping"
        ? "Stopping call"
        : "Stop call"

  const handleTranscriptScroll = React.useCallback(() => {
    const container = transcriptScrollRef.current
    if (!container) return

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    shouldAutoScrollTranscriptRef.current = distanceFromBottom <= 96
  }, [])

  React.useEffect(() => {
    if (hasSearch || !shouldAutoScrollTranscriptRef.current) return

    const animationFrame = window.requestAnimationFrame(() => {
      transcriptEndRef.current?.scrollIntoView({ block: "end" })
    })

    return () => window.cancelAnimationFrame(animationFrame)
  }, [hasSearch, transcriptScrollSignature])
  const captureActivityLabel =
    displayCaptureStatus === "requesting-permission"
      ? "Waiting for audio permission"
      : displayCaptureStatus === "connecting"
        ? "Starting transcription"
        : displayCaptureStatus === "recording"
          ? "Recording and transcribing"
          : displayCaptureStatus === "paused"
            ? "Capture paused"
            : displayCaptureStatus === "stopping"
              ? "Finalising call"
              : displayCaptureStatus === "permission-denied"
                ? "Audio permission denied"
                : displayCaptureStatus === "error"
                  ? "Capture needs attention"
                  : "Waiting for call"

  return (
    <div className="grid gap-4 2xl:sticky 2xl:top-20">
      <Card className="order-2">
        <CardHeader>
          <div>
            <CardTitle>{getCaptureStatusLabel(displayCaptureStatus)}</CardTitle>
            <CardDescription>{getCaptureStatusDescription(displayCaptureStatus, capturePermissionState)}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          {canStartFromRail ? (
            <div className="[&_button]:w-full">{startCallAction}</div>
          ) : isCaptureActive ? (
            <div className="grid gap-2">
              <Button
                aria-label={canStopFromRail ? "Stop recording" : "Stopping recording"}
                className="h-auto w-full justify-between gap-3 px-3 py-3"
                disabled={!canStopFromRail}
                variant="destructive"
                onClick={() => void onStopRecording()}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <SquareIcon className="size-4 shrink-0" />
                  <span className="truncate">{recordingActionLabel}</span>
                </span>
              </Button>
              <p className="text-sm text-muted-foreground">{captureActivityLabel}</p>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3 text-sm">
              <span className="font-medium">{captureActivityLabel}</span>
            </div>
          )}
          {captureError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {captureError}
            </div>
          ) : null}
          {audioPreflight?.statusMessage ? (
            <div
              role={audioPreflight.ok ? "status" : "alert"}
              className={cn(
                "rounded-lg p-3 text-sm",
                audioPreflight.ok
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border border-destructive/40 bg-destructive/10 text-destructive"
              )}
            >
              {audioPreflight.statusMessage}
            </div>
          ) : null}
          {canDeleteFromRail ? (
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onDeleteCall(activeCallId)}
            >
              <Trash2Icon />
              Delete call
            </Button>
          ) : null}
          {shouldShowSignalHealth ? <CaptureSignalStack indicators={captureIndicators} /> : null}
        </CardContent>
      </Card>
      <Card className="order-1">
        <CardHeader>
          <CardTitle>Live capture</CardTitle>
          <CardDescription>Notes, evidence, and transcript</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="transcript" className="grid gap-3">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="transcript">Transcript</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="evidence">Evidence</TabsTrigger>
            </TabsList>
            <TabsContent value="notes" className="m-0 grid gap-2">
              {visibleNotes.map((note, index) => (
                <div key={`${note}-${index}`} className="rounded-lg bg-muted/40 p-3 text-sm">
                  {note}
                </div>
              ))}
              {visibleNotes.length === 0 ? (
                <LiveCaptureEmptyState
                  icon={<SquarePenIcon className="size-4 text-muted-foreground" />}
                  message={hasSearch ? "No notes match this search." : "Notes will land here as the call gets going."}
                />
              ) : null}
            </TabsContent>
            <TabsContent value="evidence" className="m-0 grid gap-2">
              {visibleEvidence.slice(0, 6).map((item) => (
                <div key={item.label} className="grid gap-2 rounded-lg bg-muted/30 p-3 text-sm">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                    <p className="font-medium">{item.label}</p>
                    <span className="text-xs text-muted-foreground">{item.framework} · {item.status}</span>
                  </div>
                  <p className="text-muted-foreground">{item.detail}</p>
                </div>
              ))}
              {visibleEvidence.length === 0 ? (
                <LiveCaptureEmptyState
                  icon={<FileTextIcon className="size-4 text-muted-foreground" />}
                  message={hasSearch ? "No evidence matches this search" : "Evidence will appear as the conversation answers playbook fields."}
                />
              ) : null}
            </TabsContent>
            <TabsContent
              ref={transcriptScrollRef}
              value="transcript"
              className="m-0 max-h-[390px] overflow-y-auto pr-1"
              onScroll={handleTranscriptScroll}
            >
              <SpeakerIdentityPanel
                identities={speakerIdentities}
                onSpeakerIdentityChange={onSpeakerIdentityChange}
                sellerName={sellerName}
                transcript={transcript}
              />
              <MessageGroup className="mt-3 gap-3">
                {visibleTranscript.map((line, index) => {
                  const speakerLabel = getTranscriptSpeakerLabel(line)
                  const isSeller = speakerLabel === "Seller"
                  const align = isSeller ? "end" : "start"
                  const bubbleVariant = line.isPartial ? "outline" : isSeller ? "tinted" : "muted"

                  return (
                    <Message
                      key={line.clientId ?? line.id ?? `${speakerLabel}-${index}`}
                      align={align}
                      className="items-end"
                    >
                      <MessageAvatar
                        className={cn(
                          "size-8 text-xs font-semibold ring-1",
                          getTranscriptAvatarClassName(speakerLabel)
                        )}
                        aria-hidden="true"
                      >
                        {getTranscriptAvatarInitial(line)}
                      </MessageAvatar>
                      <MessageContent className="gap-1.5">
                        <MessageHeader className={cn("gap-2 px-0", isSeller && "justify-end")}>
                          <span className="truncate text-xs font-medium text-foreground">
                            {getTranscriptSpeakerDisplayName(line)}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">{line.time}</span>
                        </MessageHeader>
                        <Bubble align={align} variant={bubbleVariant} className="max-w-[min(82%,34rem)]">
                          <BubbleContent className="whitespace-pre-wrap text-foreground">
                            {line.text}
                          </BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  )
                })}
              </MessageGroup>
              {visibleTranscript.length === 0 ? (
                <LiveCaptureEmptyState
                  className="mt-3"
                  icon={<AudioLinesIcon className="size-4 text-muted-foreground" />}
                  message={hasSearch ? "No transcript lines match this search." : "The transcript will appear here as people speak."}
                />
              ) : null}
              <div ref={transcriptEndRef} aria-hidden="true" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

function LiveCaptureEmptyState({
  className,
  icon,
  message,
}: {
  className?: string
  icon: React.ReactNode
  message: string
}) {
  return (
    <div className={cn("flex items-center gap-2 rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground", className)}>
      {icon}
      <span>{message}</span>
    </div>
  )
}

type CaptureSignalTone = "live" | "building" | "warning" | "error" | "muted"

type CaptureSignalIndicator = {
  label: string
  tone: CaptureSignalTone
  value: string
}

function CaptureSignalStack({
  indicators,
}: {
  indicators: CaptureSignalIndicator[]
}) {
  return (
    <div className="grid gap-1.5" aria-live="polite">
      {indicators.map((indicator) => (
        <div
          key={indicator.label}
          className="flex items-center justify-between gap-3 rounded-lg bg-muted/25 px-3 py-2 text-sm"
        >
          <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                indicator.tone === "live" && "bg-emerald-500 shadow-[0_0_0_4px_rgb(16_185_129_/_0.12)]",
                indicator.tone === "building" && "bg-sky-500 shadow-[0_0_0_4px_rgb(14_165_233_/_0.12)]",
                indicator.tone === "warning" && "bg-amber-500 shadow-[0_0_0_4px_rgb(245_158_11_/_0.12)]",
                indicator.tone === "error" && "bg-destructive shadow-[0_0_0_4px_rgb(239_68_68_/_0.12)]",
                indicator.tone === "muted" && "bg-muted-foreground/40"
              )}
            />
            <span className="truncate">{indicator.label}</span>
          </span>
          <span
            className={cn(
              "shrink-0 font-medium",
              indicator.tone === "live" && "text-emerald-700 dark:text-emerald-300",
              indicator.tone === "building" && "text-sky-700 dark:text-sky-300",
              indicator.tone === "warning" && "text-amber-700 dark:text-amber-300",
              indicator.tone === "error" && "text-destructive",
              indicator.tone === "muted" && "text-muted-foreground"
            )}
          >
            {indicator.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function CallReplayCard({
  call,
  onDeleteCall,
  transcript,
}: {
  call: CallSummary
  onDeleteCall: (callId: string) => void
  transcript: Opportunity["transcript"]
}) {
  const hasTranscriptLines = transcript.some((line) => line.text.trim())
  const hasAudioRecording = Boolean(call.recordingStoragePath || call.recordingUrl)
  const [downloadStatus, setDownloadStatus] = React.useState<"idle" | "downloading" | "error">("idle")
  const [downloadError, setDownloadError] = React.useState("")

  const handleDownloadAudio = async () => {
    if (!hasAudioRecording) {
      setDownloadStatus("error")
      setDownloadError("No audio recording is available for this call.")
      return
    }

    setDownloadStatus("downloading")
    setDownloadError("")

    try {
      await downloadCallAudioFile(call)
      setDownloadStatus("idle")
    } catch (caughtError: unknown) {
      setDownloadStatus("error")
      setDownloadError(getUserFacingErrorMessage(caughtError, "Recording needs another download attempt."))
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardDescription>Recording</CardDescription>
          <CardTitle>{call.title}</CardTitle>
        </div>
        <CardAction className="col-start-1 row-span-1 row-start-auto mt-3 flex w-full flex-col items-stretch gap-2 justify-self-start sm:col-start-1 sm:row-span-1 sm:row-start-auto sm:mt-3 sm:w-full sm:flex-row sm:items-center sm:justify-self-start">
          <Button
            size="sm"
            variant="outline"
            className="w-full gap-2 sm:w-auto"
            disabled={!hasAudioRecording || downloadStatus === "downloading"}
            onClick={() => void handleDownloadAudio()}
          >
            <DownloadIcon />
            {downloadStatus === "downloading" ? "Downloading..." : "Download audio"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full gap-2 sm:w-auto"
            disabled={!hasTranscriptLines}
            onClick={() => downloadTranscriptFile(call, transcript)}
          >
            <DownloadIcon />
            Download transcript
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="w-full gap-2 sm:w-auto"
            onClick={() => onDeleteCall(call.id)}
          >
            <Trash2Icon />
            Delete call
          </Button>
        </CardAction>
      </CardHeader>
      {downloadError ? (
        <CardContent>
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {downloadError}
          </div>
        </CardContent>
      ) : null}
    </Card>
  )
}

async function downloadCallAudioFile(call: CallSummary) {
  const recordingUrl = call.recordingStoragePath
    ? await createCallRecordingSignedUrl(call.recordingStoragePath)
    : call.recordingUrl ?? ""
  if (!recordingUrl) throw new Error("No audio recording is available for this call.")

  const response = await fetch(recordingUrl)
  if (!response.ok) throw new Error("Recording download failed.")

  const blob = await response.blob()
  if (blob.size <= 0) throw new Error("Recording download was empty.")

  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = objectUrl
  link.download = getRecordingDownloadFileName(call)
  link.rel = "noopener noreferrer"
  link.style.display = "none"
  document.body.appendChild(link)
  try {
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
  }
}

function getRecordingDownloadFileName(call: CallSummary) {
  const extension = getRecordingExtensionFromMimeType(call.recordingMimeType)
  const name = call.title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

  return `${name || "salesframe-call-recording"}.${extension}`
}

function getRecordingExtensionFromMimeType(mimeType: string | null) {
  if (!mimeType) return "webm"
  if (mimeType.includes("mp4")) return "m4a"
  if (mimeType.includes("mpeg")) return "mp3"
  if (mimeType.includes("ogg")) return "ogg"
  if (mimeType.includes("wav")) return "wav"
  if (mimeType.includes("aac")) return "aac"
  if (mimeType.includes("flac")) return "flac"

  return "webm"
}

function getAudioHealthIndicators({
  audioPreflight,
  capturePermissionState,
  captureStatus,
  guidance,
}: {
  audioPreflight: AudioPreflightResult | null
  capturePermissionState: CallCapturePermissionState
  captureStatus: CallCaptureStatus
  guidance: LiveGuidance | null
}) {
  const isStarting = captureStatus === "requesting-permission" || captureStatus === "connecting"
  const isLive = captureStatus === "recording" || captureStatus === "paused"
  const needsAttention = ["permission-denied", "error", "upload-failed"].includes(captureStatus)
  const sellerMic: CaptureSignalIndicator =
    capturePermissionState === "denied" || captureStatus === "permission-denied"
      ? { label: "Seller mic", tone: "error", value: "Blocked" }
      : audioPreflight?.sellerMicReady
        ? { label: "Seller mic", tone: isLive ? "live" : "building", value: isLive ? "Live" : "Connected" }
        : isStarting
          ? { label: "Seller mic", tone: "building", value: "Checking" }
          : { label: "Seller mic", tone: needsAttention ? "warning" : "muted", value: "Not checked" }
  const sharedAudioSilent = audioPreflight?.warnings.some((warning) =>
    warning.includes("Shared audio looks silent") || warning.includes("meter is quiet")
  ) ?? false
  const customerAudio: CaptureSignalIndicator = audioPreflight
    ? audioPreflight.requiredCustomerAudio
      ? audioPreflight.customerAudioReady
        ? sharedAudioSilent
          ? { label: "Shared audio", tone: "warning", value: "No signal" }
          : { label: "Shared audio", tone: isLive ? "live" : "building", value: isLive ? "Live" : "Connected" }
        : {
            label: "Shared audio",
            tone: needsAttention || isLive ? "error" : "warning",
            value: "Not detected",
          }
      : audioPreflight.mixedRoomReady
        ? { label: "Room/call audio", tone: isLive ? "live" : "building", value: isLive ? "Live" : "One channel" }
        : { label: "Room/call audio", tone: "muted", value: "One channel" }
    : isStarting
      ? { label: "Room/call audio", tone: "building", value: "Checking" }
      : { label: "Room/call audio", tone: needsAttention ? "warning" : "muted", value: "Not checked" }
  const liveTranscript: CaptureSignalIndicator = guidance
    ? { label: "Live transcript", tone: "live", value: isLive ? "Live" : "Ready" }
    : isLive
      ? { label: "Live transcript", tone: "building", value: "Connecting" }
      : isStarting
        ? { label: "Live transcript", tone: "building", value: "Preflight" }
        : { label: "Live transcript", tone: needsAttention ? "warning" : "muted", value: "Preflight" }

  return [sellerMic, customerAudio, liveTranscript]
}

function getCaptureStatusLabel(status: CallCaptureStatus) {
  const labels: Record<CallCaptureStatus, string> = {
    idle: "Capture ready",
    "requesting-permission": "Requesting audio access",
    connecting: "Connecting transcription",
    recording: "Recording live",
    paused: "Capture paused",
    stopping: "Finalising call",
    stopped: "Call saved",
    "permission-denied": "Audio permission denied",
    "upload-failed": "Recording needs another upload attempt",
    error: "Capture needs attention",
  }

  return labels[status]
}

function getCaptureStatusDescription(
  status: CallCaptureStatus,
  permissionState: CallCapturePermissionState
) {
  if (status === "recording") return "Transcript, notes, and evidence are being saved to this call."
  if (status === "requesting-permission") return "Choose the selected channel setup and allow microphone access when prompted."
  if (status === "connecting") return "Getting live transcription ready."
  if (status === "permission-denied") return "Allow audio capture to record and transcribe this call."
  if (status === "upload-failed") return "Transcript is saved. The audio recording needs another upload attempt."
  if (status === "stopping") return "Saving the recording and preparing post-call outputs."
  if (status === "stopped") return "The call, transcript, and recording are saved."
  if (permissionState === "capture-unavailable") return "This browser cannot share audio with SalesFrame."

  return "Start a call with one-channel audio or two-channel mic plus system audio."
}

function OpportunityProfile({
  account,
  opportunity,
  opportunityDraft,
  savedOpportunityDraft,
  onOpportunityDraftChange,
  onSaveOpportunityDraft,
  saveMessage,
  saveStatus,
}: {
  account: AccountNavItem
  opportunity: Opportunity
  opportunityDraft: OpportunityDraft
  savedOpportunityDraft: OpportunityDraft
  onOpportunityDraftChange: (field: keyof OpportunityDraft, value: string) => void
  onSaveOpportunityDraft: () => void
  saveMessage: string
  saveStatus: RecordSaveStatus
}) {
  const opportunityHasDraftChanges = !areOpportunityDraftsEqual(opportunityDraft, savedOpportunityDraft)

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Opportunity record</CardTitle>
        </div>
        <CardAction className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Button
            size="sm"
            className="w-full gap-2 sm:w-auto"
            disabled={saveStatus === "saving" || !opportunityDraft.opportunityName.trim() || !opportunityHasDraftChanges}
            onClick={onSaveOpportunityDraft}
          >
            <CheckCircle2Icon />
            {saveStatus === "saving" ? "Saving..." : "Save changes"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        {saveMessage && !(saveStatus === "saved" && opportunityHasDraftChanges) ? (
          <RecordStatusMessage message={saveMessage} status={saveStatus} />
        ) : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <EditableTextField
            id="opportunity-name"
            label="Opportunity name"
            value={opportunityDraft.opportunityName}
            onChange={(value) => onOpportunityDraftChange("opportunityName", value)}
          />
          <div className="grid gap-2">
            <Label htmlFor="opportunity-stage">Stage</Label>
            <Select
              value={opportunityDraft.stage}
              onValueChange={(value) => onOpportunityDraftChange("stage", value)}
            >
              <SelectTrigger id="opportunity-stage" className="w-full">
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                {["Qualification", "Discovery", "Validation", "Demo", "Business case", "Negotiation", "Closed won"].map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {stage}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="opportunity-close-date">Close date</Label>
            <DatePicker
              id="opportunity-close-date"
              value={opportunityDraft.closeDate}
              placeholder="Select close date"
              onChange={(value) => onOpportunityDraftChange("closeDate", value)}
            />
          </div>
          <EditableTextField
            id="opportunity-source"
            label="Source"
            value={opportunityDraft.source}
            onChange={(value) => onOpportunityDraftChange("source", value)}
          />
          <div className="grid gap-2">
            <Label htmlFor="opportunity-created-date">Created date</Label>
            <Input id="opportunity-created-date" value={opportunity.createdAt} readOnly />
          </div>
          <div className="grid gap-2 xl:col-span-2">
            <Label htmlFor="opportunity-frameworks">Frameworks</Label>
            <PlaybookMultiSelect
              id="opportunity-frameworks"
              value={parsePlaybookSelection(opportunityDraft.frameworks)}
              onChange={(playbooks) =>
                onOpportunityDraftChange("frameworks", formatPlaybooks(playbooks))
              }
            />
          </div>
          <EditableTextField
            id="opportunity-amount"
            label="Opportunity amount"
            value={opportunityDraft.amount}
            placeholder="e.g. 250000, 250k, 1.2m"
            onChange={(value) => onOpportunityDraftChange("amount", value)}
            onBlur={() =>
              onOpportunityDraftChange(
                "amount",
                formatCurrencyAmount(opportunityDraft.amount.trim() || "Unqualified", account.currency)
              )
            }
          />
          <div className="grid gap-2">
            <Label htmlFor="opportunity-account-currency">Account currency</Label>
            <Input id="opportunity-account-currency" value={currencyLabels[account.currency]} readOnly />
          </div>
        </div>
        <Separator />
        <div className="grid gap-4 lg:grid-cols-2">
          <EditableTextareaField
            id="opportunity-next-step"
            label="Next step"
            value={opportunityDraft.nextStep}
            onChange={(value) => onOpportunityDraftChange("nextStep", value)}
          />
          <EditableTextareaField
            id="opportunity-pain"
            label="Pain"
            value={opportunityDraft.pain}
            onChange={(value) => onOpportunityDraftChange("pain", value)}
          />
          <EditableTextareaField
            id="opportunity-decision-process"
            label="Decision process"
            value={opportunityDraft.decisionProcess}
            onChange={(value) => onOpportunityDraftChange("decisionProcess", value)}
          />
          <EditableTextareaField
            id="opportunity-manual-notes"
            label="Manual notes"
            value={opportunityDraft.manualNotes}
            onChange={(value) => onOpportunityDraftChange("manualNotes", value)}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function OpportunityIntelligence({
  opportunity,
  playbookFields,
  playbookRows,
  selectedPlaybooks,
}: {
  opportunity: Opportunity
  playbookFields: PlaybookFieldRow[]
  playbookRows: PlaybookRow[]
  selectedPlaybooks: CallPlaybook[]
}) {
  const methodologySummary = getOpportunityMethodologySummary({
    opportunity,
    playbookFields,
    playbookRows,
    selectedPlaybooks,
  })
  const fieldGroups: [string, number][] = [
    ["Confirmed fields", methodologySummary.confirmed],
    ["Weak evidence", methodologySummary.weak],
    ["Missing required", methodologySummary.missing],
  ]

  return (
    <div className="grid gap-4">
      {opportunity.nextCallBrief ? (
        <NextCallBriefCard brief={opportunity.nextCallBrief} />
      ) : null}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Opportunity intelligence</CardTitle>
            <CardDescription>Read-only AI findings generated from call history</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-sm font-medium">
              {hasStarterOpportunityGuidance(opportunity) ? "Live question" : "Next best question"}
            </p>
            {hasStarterOpportunityGuidance(opportunity) ? (
              <div className="mt-2 rounded-lg bg-background/70 p-3 text-sm leading-relaxed text-muted-foreground">
                Start a call when you are ready. SalesFrame will prepare the first live question from the account, opportunity, and selected playbooks.
              </div>
            ) : (
              <>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {getOpportunityGuidancePreview(opportunity)}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {opportunity.questionReason}
                </p>
              </>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {fieldGroups.map(([label, value]) => (
              <div key={label} className="rounded-lg bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function NextCallBriefCard({ brief }: { brief: NextCallBrief }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardDescription>Next-call brief</CardDescription>
          <CardTitle>What to do on the next customer call</CardTitle>
        </div>
        <CardAction>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <FileTextIcon className="size-4" />
            {brief.previousCall}
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-3">
            <BriefTextBlock title="Objective" icon={<TargetIcon />}>
              {brief.objective}
            </BriefTextBlock>
            <BriefTextBlock title="Suggested opening" icon={<SquarePenIcon />}>
              {brief.opening}
            </BriefTextBlock>
          </div>
          <div className="grid gap-3">
            <BriefList title="Focus questions" items={brief.focusQuestions} icon={<ListChecksIcon />} />
            <BriefList title="Missing evidence" items={brief.missingEvidence} icon={<CircleAlertIcon />} />
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
          <BriefList title="Risks to manage" items={brief.riskNotes} icon={<ShieldCheckIcon />} />
          <BriefTextBlock title="Recommended next step" icon={<ArrowRightIcon />}>
            {brief.recommendedNextStep}
          </BriefTextBlock>
        </div>
      </CardContent>
    </Card>
  )
}

function BriefTextBlock({
  children,
  icon,
  title,
}: {
  children: React.ReactNode
  icon: React.ReactNode
  title: string
}) {
  return (
    <div className="rounded-lg bg-muted/20 p-3">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
      </div>
      <p className="mt-2 text-sm leading-relaxed">{children}</p>
    </div>
  )
}

function BriefList({
  icon,
  items,
  title,
}: {
  icon: React.ReactNode
  items: string[]
  title: string
}) {
  return (
    <div className="rounded-lg bg-muted/20 p-3">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
      </div>
      <div className="mt-2 grid gap-2">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2 text-sm">
            <CheckIcon className="mt-0.5 size-3.5 text-emerald-600" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function OpportunityRecordingHistory({
  activeCallId,
  calls,
  onDeleteCall,
  opportunity,
}: {
  activeCallId: string
  calls: CallSummary[]
  opportunity: Opportunity
  onDeleteCall: (callId: string) => void
}) {
  const [downloadingCallId, setDownloadingCallId] = React.useState("")
  const [downloadError, setDownloadError] = React.useState("")
  const recordings = calls
    .filter((call) => call.opportunityId === opportunity.id)
    .filter(canReplayCall)
    .filter((call) => getCallDisplayStatus(call, activeCallId) !== "Recording")
    .sort((leftCall, rightCall) => {
      const leftStartedAt = leftCall.startedAt ? new Date(leftCall.startedAt).getTime() : 0
      const rightStartedAt = rightCall.startedAt ? new Date(rightCall.startedAt).getTime() : 0

      return rightStartedAt - leftStartedAt
    })

  const handleDownloadRecording = async (call: CallSummary) => {
    setDownloadError("")
    setDownloadingCallId(call.id)
    try {
      await downloadCallAudioFile(call)
    } catch (caughtError: unknown) {
      setDownloadError(getUserFacingErrorMessage(caughtError, "Recording needs another download attempt."))
    } finally {
      setDownloadingCallId("")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Previous call recordings</CardTitle>
        <CardDescription>Download stored audio from earlier calls on this opportunity</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {downloadError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {downloadError}
          </div>
        ) : null}
        {recordings.map((call) => {
          const displayStatus = getCallDisplayStatus(call, activeCallId)
          const displayDuration = getCallDisplayDuration(call, activeCallId)

          return (
            <div
              key={call.id}
              className="grid gap-3 rounded-lg bg-muted/30 p-4 md:grid-cols-[minmax(0,1fr)_120px_150px] md:items-center"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <FileAudioIcon className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{call.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {call.date} · {call.type} · {displayDuration}
                  </p>
                </div>
              </div>
              <span className={cn("text-sm font-medium", getCallStatusTextClassName(displayStatus))}>
                {displayStatus}
              </span>
              <div className="flex gap-2 md:justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  disabled={downloadingCallId === call.id}
                  onClick={() => void handleDownloadRecording(call)}
                >
                  <DownloadIcon />
                  {downloadingCallId === call.id ? "Downloading..." : "Download audio"}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => onDeleteCall(call.id)}>
                  Delete
                </Button>
              </div>
            </div>
          )
        })}
        {recordings.length === 0 ? (
          <div className="grid place-items-center gap-2 rounded-lg bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            <FileAudioIcon className="size-5" />
            <p>No recordings for this opportunity yet.</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function PostCallPanel({
  isProcessing,
  opportunity,
  output,
  processingError,
  replayCall,
  transcript,
  transcriptCall,
  onDeleteCall,
  onViewNextCallBrief,
}: {
  isProcessing: boolean
  opportunity: Opportunity
  output: PostCallOutputView | null
  processingError: string
  replayCall: CallSummary | null
  transcript: Opportunity["transcript"]
  transcriptCall: CallSummary | null
  onDeleteCall: (callId: string) => void
  onViewNextCallBrief: () => void
}) {
  const nextCallItems =
    output?.nextCallPlan
      .split(/\n+/)
      .map((item) => item.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean) ?? []
  const hasTranscriptLines = transcript.some((line) => line.text.trim())
  const completedCall = replayCall ?? transcriptCall
  const didReachCallLimit = completedCall?.endedReason === "time_limit_reached"

  return (
    <div className="grid gap-4">
      {didReachCallLimit ? (
        <Card>
          <CardContent className="pt-6">
            <div className="rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">
              SalesFrame ended this call after 2 hours to keep transcription controlled. Transcript and audio were saved.
            </div>
          </CardContent>
        </Card>
      ) : null}
      {replayCall ? (
        <CallReplayCard
          call={replayCall}
          onDeleteCall={onDeleteCall}
          transcript={transcript}
        />
      ) : null}
      {processingError ? (
        <Card>
          <CardHeader>
            <CardTitle>Post-call AI needs another pass</CardTitle>
            <CardDescription>Your recording and transcript are still saved.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">
              SalesFrame is still preparing the notes and next-call brief. You can keep using the recording and transcript while it catches up.
            </div>
          </CardContent>
        </Card>
      ) : isProcessing ? (
        <Card>
          <CardHeader>
            <CardTitle>Building the post-call brief</CardTitle>
            <CardDescription>SalesFrame is turning the transcript into notes, evidence, and next steps.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      ) : null}
      {!replayCall && transcriptCall && hasTranscriptLines ? (
        <Card>
          <CardHeader>
            <div>
              <CardDescription>Transcript</CardDescription>
              <CardTitle>{transcriptCall.title}</CardTitle>
            </div>
            <CardAction className="col-start-1 row-span-1 row-start-auto mt-3 flex w-full flex-col items-stretch gap-2 justify-self-start sm:col-start-1 sm:row-span-1 sm:row-start-auto sm:mt-3 sm:w-full sm:flex-row sm:items-center sm:justify-self-start">
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-2 sm:w-auto"
                onClick={() => downloadTranscriptFile(transcriptCall, transcript)}
              >
                <DownloadIcon />
                Download transcript
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="w-full gap-2 sm:w-auto"
                onClick={() => onDeleteCall(transcriptCall.id)}
              >
                <Trash2Icon />
                Delete call
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">
              Audio replay is not available for this call, but the transcript can be downloaded.
            </div>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Next-call plan</CardTitle>
          <CardDescription>Strict methodology checklist</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {(nextCallItems.length ? nextCallItems : ["Next-call plan will appear after the call is processed."]).map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
              <CircleDotIcon className="mt-0.5 size-4 text-muted-foreground" />
              <p className="text-sm">{item}</p>
            </div>
          ))}
          {opportunity.nextCallBrief ? (
            <Button className="gap-2" onClick={onViewNextCallBrief}>
              <FileTextIcon />
              View next-call brief
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

type SortDirection = "asc" | "desc"
type OpportunityTableSortKey = "opportunity" | "account" | "created" | "coverage" | "missing" | "close" | "value" | "gaps"
type OpportunityTableSort = {
  key: OpportunityTableSortKey
  direction: SortDirection
}
type OpportunitySortSelectValue =
  | OpportunitySort
  | "opportunity-asc"
  | "opportunity-desc"
  | "account-asc"
  | "account-desc"
  | "missing-asc"
  | "created-asc"
  | "created-desc"
type CallTableSortKey = "call" | "account" | "status" | "duration" | "date"
type CallTableSort = {
  key: CallTableSortKey
  direction: SortDirection
}

const defaultOpportunityTableSort = {
  key: "gaps",
  direction: "desc",
} satisfies OpportunityTableSort

const defaultCallTableSort = {
  key: "date",
  direction: "desc",
} satisfies CallTableSort

function SortableHeaderButton({
  active,
  align = "left",
  direction,
  label,
  onClick,
}: {
  active: boolean
  align?: "left" | "right"
  direction: SortDirection
  label: string
  onClick: () => void
}) {
  const SortIcon = direction === "asc" ? ArrowUpIcon : ArrowDownIcon

  return (
    <button
      type="button"
      className={cn(
        "group inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-muted-foreground transition-[background-color,color,opacity] duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "text-foreground",
        align === "right" && "justify-self-end text-right"
      )}
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      onClick={onClick}
    >
      <span>{label}</span>
      {active ? (
        <SortIcon className="size-3.5" aria-hidden="true" />
      ) : (
        <ArrowDownIcon className="size-3.5 opacity-0 transition-opacity duration-100 group-hover:opacity-40" aria-hidden="true" />
      )}
    </button>
  )
}

function getNextSortDirection<TSortKey extends string>({
  currentDirection,
  currentKey,
  defaultDirection,
  nextKey,
}: {
  currentDirection: SortDirection
  currentKey: TSortKey
  defaultDirection: SortDirection
  nextKey: TSortKey
}) {
  if (currentKey !== nextKey) return defaultDirection

  return currentDirection === "asc" ? "desc" : "asc"
}

function getOpportunitySortSelectValue(sort: OpportunityTableSort): OpportunitySortSelectValue {
  if (sort.key === "opportunity") return sort.direction === "asc" ? "opportunity-asc" : "opportunity-desc"
  if (sort.key === "account") return sort.direction === "asc" ? "account-asc" : "account-desc"
  if (sort.key === "created") return sort.direction === "asc" ? "created-asc" : "created-desc"
  if (sort.key === "coverage") return sort.direction === "asc" ? "coverage-asc" : "coverage-desc"
  if (sort.key === "value") return "value-desc"
  if (sort.key === "close") return "close-date"
  if (sort.key === "missing") return sort.direction === "asc" ? "missing-asc" : "gaps"

  return "gaps"
}

function getOpportunitySortFromSelectValue(value: OpportunitySortSelectValue): OpportunityTableSort {
  if (value === "opportunity-asc") return { key: "opportunity", direction: "asc" }
  if (value === "opportunity-desc") return { key: "opportunity", direction: "desc" }
  if (value === "account-asc") return { key: "account", direction: "asc" }
  if (value === "account-desc") return { key: "account", direction: "desc" }
  if (value === "created-asc") return { key: "created", direction: "asc" }
  if (value === "created-desc") return { key: "created", direction: "desc" }
  if (value === "coverage-asc") return { key: "coverage", direction: "asc" }
  if (value === "coverage-desc") return { key: "coverage", direction: "desc" }
  if (value === "value-desc") return { key: "value", direction: "desc" }
  if (value === "close-date") return { key: "close", direction: "asc" }
  if (value === "missing-asc") return { key: "missing", direction: "asc" }

  return defaultOpportunityTableSort
}

function sortOpportunityTableRows(
  opportunities: Opportunity[],
  sort: OpportunityTableSort,
  accountById: Map<string, AccountNavItem>
) {
  return [...opportunities].sort((left, right) => {
    const leftAccount = accountById.get(left.accountId)
    const rightAccount = accountById.get(right.accountId)
    const isDateSort = sort.key === "close" || sort.key === "created"
    const result = sort.key === "close" ? compareDates(left.closeDate, right.closeDate, sort.direction) :
      sort.key === "created" ? compareDates(left.createdAtIso ?? left.createdAt, right.createdAtIso ?? right.createdAt, sort.direction) :
      sort.key === "opportunity" ? compareStrings(left.name, right.name) :
        sort.key === "account" ? compareStrings(leftAccount?.name, rightAccount?.name) :
          sort.key === "coverage" ? left.coverage - right.coverage :
            sort.key === "missing" || sort.key === "gaps" ? left.missing + left.weak - (right.missing + right.weak) :
              parseOpportunityAmount(left.amount) - parseOpportunityAmount(right.amount)

    return (isDateSort ? result : applySortDirection(result, sort.direction)) || compareStrings(left.name, right.name)
  })
}

function sortCallTableRows(
  calls: CallSummary[],
  sort: CallTableSort,
  accountById: Map<string, AccountNavItem>,
  opportunityById: Map<string, Opportunity>,
  activeCallId: string
) {
  return [...calls].sort((left, right) => {
    const leftOpportunity = opportunityById.get(left.opportunityId)
    const rightOpportunity = opportunityById.get(right.opportunityId)
    const leftAccount = leftOpportunity ? accountById.get(leftOpportunity.accountId) : undefined
    const rightAccount = rightOpportunity ? accountById.get(rightOpportunity.accountId) : undefined
    const result = sort.key === "date" ? compareDates(left.startedAt ?? left.date, right.startedAt ?? right.date, sort.direction) :
      sort.key === "call" ? compareStrings(left.title, right.title) :
        sort.key === "account" ? compareStrings(leftAccount?.name, rightAccount?.name) :
          sort.key === "status" ? compareStrings(getCallDisplayStatus(left, activeCallId), getCallDisplayStatus(right, activeCallId)) :
            left.durationSeconds - right.durationSeconds

    return (sort.key === "date" ? result : applySortDirection(result, sort.direction)) || compareStrings(left.title, right.title)
  })
}

function compareStrings(left?: string | null, right?: string | null) {
  return (left ?? "").localeCompare(right ?? "", undefined, { numeric: true, sensitivity: "base" })
}

function compareDates(left: string | null | undefined, right: string | null | undefined, direction: SortDirection) {
  const leftValue = getSortableDateValue(left)
  const rightValue = getSortableDateValue(right)

  if (leftValue === null && rightValue === null) return 0
  if (leftValue === null) return 1
  if (rightValue === null) return -1

  return direction === "asc" ? leftValue - rightValue : rightValue - leftValue
}

function getSortableDateValue(value?: string | null) {
  if (!value) return null

  const parsed = Date.parse(value)

  return Number.isFinite(parsed) ? parsed : null
}

function applySortDirection(value: number, direction: SortDirection) {
  return direction === "asc" ? value : value * -1
}

function OpportunitiesView({
  accounts,
  opportunities,
  opportunityDrafts,
  playbookFields,
  playbookRows,
  onArchiveOpportunity,
  onCreateOpportunity,
  onDeleteOpportunity,
  onOpportunitySelect,
}: {
  accounts: AccountNavItem[]
  opportunities: Opportunity[]
  opportunityDrafts: Record<string, OpportunityDraft>
  playbookFields: PlaybookFieldRow[]
  playbookRows: PlaybookRow[]
  onArchiveOpportunity: (id: string) => void
  onCreateOpportunity: () => void
  onDeleteOpportunity: (id: string) => void
  onOpportunitySelect: (id: string) => void
}) {
  const [query, setQuery] = React.useState("")
  const [stageFilter, setStageFilter] = React.useState("all")
  const [coverageFilter, setCoverageFilter] = React.useState<OpportunityCoverageFilter>("all")
  const [sort, setSort] = React.useState<OpportunityTableSort>(defaultOpportunityTableSort)
  const [page, setPage] = React.useState(1)
  const pageSize = 15
  const accountById = React.useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts])
  const displayOpportunities = React.useMemo(
    () =>
      opportunities.map((opportunity) =>
        applyOpportunityMethodologySummary(
          opportunity,
          getOpportunityMethodologySummary({
            opportunity,
            playbookFields,
            playbookRows,
            selectedPlaybooks: parsePlaybookSelection(opportunityDrafts[opportunity.id]?.frameworks),
          })
        )
      ),
    [opportunities, opportunityDrafts, playbookFields, playbookRows]
  )
  const stages = Array.from(new Set(displayOpportunities.map((item) => item.stage))).sort()
  const visibleOpportunities = sortOpportunityTableRows(
    getFuzzyMatches(
      displayOpportunities
        .filter((item) => stageFilter === "all" || item.stage === stageFilter)
        .filter((item) => matchesCoverageFilter(item, coverageFilter)),
      query,
      (item) => getOpportunitySearchText(item, accountById.get(item.accountId), opportunityDrafts[item.id])
    ),
    sort,
    accountById
  )
  const pageCount = Math.max(1, Math.ceil(visibleOpportunities.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const paginatedOpportunities = visibleOpportunities.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const opportunityRangeStart = visibleOpportunities.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const opportunityRangeEnd = Math.min(currentPage * pageSize, visibleOpportunities.length)
  const hasOpportunityFilters = Boolean(query.trim()) || stageFilter !== "all" || coverageFilter !== "all"

  React.useEffect(() => {
    setPage(1)
  }, [query, stageFilter, coverageFilter, sort])

  const updateOpportunitySort = React.useCallback((key: OpportunityTableSortKey, defaultDirection: SortDirection = "asc") => {
    setSort((currentSort) => ({
      key,
      direction: getNextSortDirection({
        currentDirection: currentSort.direction,
        currentKey: currentSort.key,
        defaultDirection,
        nextKey: key,
      }),
    }))
  }, [])

  React.useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Opportunities</h1>
          </div>
          <CardAction>
            <Button className="gap-2" onClick={onCreateOpportunity}>
              <PlusIcon />
              New opportunity
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-[minmax(22rem,1fr)_11rem_11rem_10rem_auto]">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search opportunities, accounts, stakeholders, or gaps"
                value={query}
                className="pl-9"
                placeholder="Search opportunities"
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-full" aria-label="Filter opportunities by stage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {stages.map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {stage}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={coverageFilter} onValueChange={(value) => setCoverageFilter(value as OpportunityCoverageFilter)}>
              <SelectTrigger className="w-full" aria-label="Filter opportunities by coverage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All coverage</SelectItem>
                <SelectItem value="needs-attention">Needs attention</SelectItem>
                <SelectItem value="low">Low coverage</SelectItem>
                <SelectItem value="mid">Medium coverage</SelectItem>
                <SelectItem value="high">High coverage</SelectItem>
              </SelectContent>
            </Select>
            <Select value={getOpportunitySortSelectValue(sort)} onValueChange={(value) => setSort(getOpportunitySortFromSelectValue(value as OpportunitySortSelectValue))}>
              <SelectTrigger className="w-full" aria-label="Sort opportunities">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="opportunity-asc">Opportunity A-Z</SelectItem>
                <SelectItem value="opportunity-desc">Opportunity Z-A</SelectItem>
                <SelectItem value="account-asc">Account A-Z</SelectItem>
                <SelectItem value="account-desc">Account Z-A</SelectItem>
                <SelectItem value="gaps">Most gaps</SelectItem>
                <SelectItem value="missing-asc">Fewest gaps</SelectItem>
                <SelectItem value="coverage-asc">Lowest coverage</SelectItem>
                <SelectItem value="coverage-desc">Highest coverage</SelectItem>
                <SelectItem value="value-desc">Highest value</SelectItem>
                <SelectItem value="close-date">Close date</SelectItem>
                <SelectItem value="created-desc">Newest created</SelectItem>
                <SelectItem value="created-asc">Oldest created</SelectItem>
              </SelectContent>
            </Select>
            {hasOpportunityFilters ? (
              <Button
                variant="outline"
                className="gap-2 justify-self-start 2xl:justify-self-auto"
                onClick={() => {
                  setQuery("")
                  setStageFilter("all")
                  setCoverageFilter("all")
                  setSort(defaultOpportunityTableSort)
                  setPage(1)
                }}
              >
                <FilterIcon />
                Reset
              </Button>
            ) : null}
          </div>
          <div className="grid gap-3">
            {paginatedOpportunities.length > 0 ? (
              <div
                className="hidden px-4 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[minmax(0,1fr)_minmax(8rem,0.75fr)_110px_150px_110px_110px_112px] md:items-center"
                role="row"
              >
                <SortableHeaderButton
                  active={sort.key === "opportunity"}
                  direction={sort.direction}
                  label="Opportunity"
                  onClick={() => updateOpportunitySort("opportunity")}
                />
                <SortableHeaderButton
                  active={sort.key === "account"}
                  direction={sort.direction}
                  label="Account"
                  onClick={() => updateOpportunitySort("account")}
                />
                <SortableHeaderButton
                  active={sort.key === "created"}
                  direction={sort.direction}
                  label="Created"
                  onClick={() => updateOpportunitySort("created", "desc")}
                />
                <SortableHeaderButton
                  active={sort.key === "coverage"}
                  direction={sort.direction}
                  label="Coverage"
                  onClick={() => updateOpportunitySort("coverage", "desc")}
                />
                <SortableHeaderButton
                  active={sort.key === "missing" || sort.key === "gaps"}
                  direction={sort.direction}
                  label="Missing"
                  onClick={() => updateOpportunitySort("missing", "desc")}
                />
                <SortableHeaderButton
                  active={sort.key === "close"}
                  direction={sort.direction}
                  label="Close"
                  onClick={() => updateOpportunitySort("close")}
                />
                <span className="text-right">Actions</span>
              </div>
            ) : null}
            {paginatedOpportunities.map((opportunity) => {
              const account = accountById.get(opportunity.accountId)

              return (
                <div
                  key={opportunity.id}
                  className="grid cursor-pointer gap-3 rounded-lg bg-muted/30 p-4 transition-[background-color,color,box-shadow,opacity] duration-150 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[minmax(0,1fr)_minmax(8rem,0.75fr)_110px_150px_110px_110px_112px] md:items-center"
                  tabIndex={0}
                  aria-label={`Open ${opportunity.name}`}
                  onClick={() => onOpportunitySelect(opportunity.id)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return
                    if (event.key !== "Enter" && event.key !== " ") return

                    event.preventDefault()
                    onOpportunitySelect(opportunity.id)
                  }}
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      className="flex min-h-11 items-center text-left font-medium leading-snug underline-offset-4 outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring md:min-h-0"
                      aria-label={`Open ${opportunity.name}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onOpportunitySelect(opportunity.id)
                      }}
                    >
                      {opportunity.name}
                    </button>
                    <p className="truncate text-sm text-muted-foreground">
                      {formatCurrencyAmount(opportunity.amount, account?.currency)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground md:hidden">Account</p>
                    <p className="truncate text-sm font-medium">{account?.name ?? "No account linked"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground md:hidden">Created</p>
                    <p className="truncate text-sm font-medium">{opportunity.createdAt}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground md:hidden">Coverage</p>
                    <div className="mt-1 flex items-center gap-2">
                      <CoverageProgress
                        value={opportunity.coverage}
                        className="h-2"
                        data-testid="opportunity-list-coverage-bar"
                      />
                      <span className="text-sm font-medium">{opportunity.coverage}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground md:hidden">Missing</p>
                    <p className="text-sm font-medium">{opportunity.missing} fields</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground md:hidden">Close</p>
                    <p className="truncate text-sm font-medium">{opportunity.closeDate}</p>
                  </div>
                  <div
                    className="flex md:justify-end"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-11 min-w-[104px] justify-center gap-1.5 md:h-7"
                          aria-label={`Actions for ${opportunity.name}`}
                        >
                          Actions
                          <ChevronDownIcon className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onSelect={() => onOpportunitySelect(opportunity.id)}>
                          <ExternalLinkIcon />
                          Open
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onArchiveOpportunity(opportunity.id)}>
                          <ArchiveIcon />
                          Archive
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onSelect={() => onDeleteOpportunity(opportunity.id)}>
                          <Trash2Icon />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )
            })}
            {visibleOpportunities.length === 0 ? (
              <ListEmptyState
                icon={<TargetIcon />}
                title={opportunities.length === 0 ? "No opportunities yet" : "Nothing matches that view"}
                message={
                  opportunities.length === 0
                    ? "Create one when there is a deal to qualify, or start a call and SalesFrame will attach the context as you go."
                    : hasOpportunityFilters
                      ? "Try a lighter filter or search by account, amount, stakeholder, or gap."
                      : "Your opportunities are here, but none are ready for this view yet."
                }
              />
            ) : null}
          </div>
          {visibleOpportunities.length > pageSize ? (
            <div className="flex flex-col gap-2 pt-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing {opportunityRangeStart}-{opportunityRangeEnd} of {visibleOpportunities.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  Previous
                </Button>
                <span className="min-w-16 text-center text-xs">
                  Page {currentPage} of {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === pageCount}
                  onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

    </div>
  )
}

function CallsView({
  accounts,
  accountResearchById,
  activeCallId,
  calls,
  opportunityDrafts,
  opportunities,
  savedOpenAiKeyState,
  sellerResearchProfile,
  transcriptsByCallId,
  workspaceId,
  onCallSelect,
  onDeleteCall,
  onOpenSettings,
  onStartRecording,
}: {
  accounts: AccountNavItem[]
  accountResearchById: Record<string, CustomerResearchConfig>
  activeCallId: string
  calls: CallSummary[]
  opportunityDrafts: Record<string, OpportunityDraft>
  opportunities: Opportunity[]
  savedOpenAiKeyState: SavedOpenAiKeyState | null
  sellerResearchProfile: SellerResearchProfile
  transcriptsByCallId: Record<string, Opportunity["transcript"]>
  workspaceId: string
  onCallSelect: (callId: string) => void
  onDeleteCall: (callId: string) => void
  onOpenSettings: () => void
  onStartRecording: StartRecordingHandler
}) {
  const callsPageSize = 10
  const [query, setQuery] = React.useState("")
  const [typeFilter, setTypeFilter] = React.useState("all")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [callSort, setCallSort] = React.useState<CallTableSort>(defaultCallTableSort)
  const [callsPage, setCallsPage] = React.useState(1)
  const accountById = React.useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts])
  const opportunityById = React.useMemo(
    () => new Map(opportunities.map((item) => [item.id, item])),
    [opportunities]
  )
  const callTypes = React.useMemo(() => Array.from(new Set(calls.map((call) => call.type))).sort(), [calls])
  const callStatuses = React.useMemo(
    () => Array.from(new Set(calls.map((call) => getCallDisplayStatus(call, activeCallId)))).sort(),
    [activeCallId, calls]
  )
  const visibleCalls = React.useMemo(
    () =>
      sortCallTableRows(
        getFuzzyMatches(
          calls
            .filter((call) => typeFilter === "all" || call.type === typeFilter)
            .filter((call) => statusFilter === "all" || getCallDisplayStatus(call, activeCallId) === statusFilter),
          query,
          (call) => {
            const relatedOpportunity = opportunityById.get(call.opportunityId)
            const relatedAccount = relatedOpportunity ? accountById.get(relatedOpportunity.accountId) : undefined

            return getCallSearchText({
              account: relatedAccount,
              call,
              opportunity: relatedOpportunity,
              opportunityDraft: relatedOpportunity ? opportunityDrafts[relatedOpportunity.id] : undefined,
              transcript: transcriptsByCallId[call.id] ?? relatedOpportunity?.transcript ?? [],
            })
          }
        ),
        callSort,
        accountById,
        opportunityById,
        activeCallId
      ),
    [
      accountById,
      activeCallId,
      callSort,
      calls,
      opportunityById,
      opportunityDrafts,
      query,
      statusFilter,
      transcriptsByCallId,
      typeFilter,
    ]
  )
  const totalCallPages = Math.max(1, Math.ceil(visibleCalls.length / callsPageSize))
  const safeCallsPage = Math.min(callsPage, totalCallPages)
  const paginatedCalls = visibleCalls.slice(
    (safeCallsPage - 1) * callsPageSize,
    safeCallsPage * callsPageSize
  )
  const callRangeStart = visibleCalls.length === 0 ? 0 : (safeCallsPage - 1) * callsPageSize + 1
  const callRangeEnd = Math.min(safeCallsPage * callsPageSize, visibleCalls.length)
  const hasCallFilters = Boolean(query.trim()) || typeFilter !== "all" || statusFilter !== "all"
  React.useEffect(() => {
    setCallsPage(1)
  }, [callSort, query, statusFilter, typeFilter])

  const updateCallSort = React.useCallback((key: CallTableSortKey, defaultDirection: SortDirection = "asc") => {
    setCallSort((currentSort) => ({
      key,
      direction: getNextSortDirection({
        currentDirection: currentSort.direction,
        currentKey: currentSort.key,
        defaultDirection,
        nextKey: key,
      }),
    }))
  }, [])

  React.useEffect(() => {
    if (callsPage > totalCallPages) setCallsPage(totalCallPages)
  }, [callsPage, totalCallPages])

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Calls
            </h1>
          </div>
          <CardAction>
            <StartRecordingDialog
              accounts={accounts}
              accountResearchById={accountResearchById}
              opportunityDrafts={opportunityDrafts}
              opportunities={opportunities}
              savedOpenAiKeyState={savedOpenAiKeyState}
              sellerResearchProfile={sellerResearchProfile}
              workspaceId={workspaceId}
              onOpenSettings={onOpenSettings}
              onStartRecording={onStartRecording}
            />
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-[minmax(22rem,1fr)_11rem_11rem_auto]">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search calls, opportunities, accounts, or status"
                value={query}
                className="pl-9"
                placeholder="Search calls"
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full" aria-label="Filter calls by type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All call types</SelectItem>
                {callTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full" aria-label="Filter calls by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {callStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasCallFilters ? (
              <Button
                variant="outline"
                className="gap-2 justify-self-start 2xl:justify-self-auto"
                onClick={() => {
                  setQuery("")
                  setTypeFilter("all")
                  setStatusFilter("all")
                  setCallSort(defaultCallTableSort)
                  setCallsPage(1)
                }}
              >
                <FilterIcon />
                Reset
              </Button>
            ) : null}
          </div>
          <div className="grid gap-3">
            {paginatedCalls.length > 0 ? (
              <div
                className="hidden px-4 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[minmax(0,1fr)_minmax(8rem,0.75fr)_140px_110px_110px_112px] md:items-center"
                role="row"
              >
                <SortableHeaderButton
                  active={callSort.key === "call"}
                  direction={callSort.direction}
                  label="Call"
                  onClick={() => updateCallSort("call")}
                />
                <SortableHeaderButton
                  active={callSort.key === "account"}
                  direction={callSort.direction}
                  label="Account"
                  onClick={() => updateCallSort("account")}
                />
                <SortableHeaderButton
                  active={callSort.key === "status"}
                  direction={callSort.direction}
                  label="Status"
                  onClick={() => updateCallSort("status")}
                />
                <SortableHeaderButton
                  active={callSort.key === "duration"}
                  direction={callSort.direction}
                  label="Duration"
                  onClick={() => updateCallSort("duration", "desc")}
                />
                <SortableHeaderButton
                  active={callSort.key === "date"}
                  direction={callSort.direction}
                  label="Date"
                  onClick={() => updateCallSort("date", "desc")}
                />
                <span className="text-right">Actions</span>
              </div>
            ) : null}
            {paginatedCalls.map((call) => {
              const displayStatus = getCallDisplayStatus(call, activeCallId)
              const displayDuration = getCallDisplayDuration(call, activeCallId)
              const relatedOpportunity = opportunityById.get(call.opportunityId)
              const relatedAccount = relatedOpportunity ? accountById.get(relatedOpportunity.accountId) : undefined

              return (
                <div
                  key={call.id}
                  className="grid cursor-pointer gap-3 rounded-lg bg-muted/30 p-4 transition-[background-color,color,box-shadow,opacity] duration-150 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[minmax(0,1fr)_minmax(8rem,0.75fr)_140px_110px_110px_112px] md:items-center"
                  tabIndex={0}
                  aria-label={`Open ${call.title}`}
                  onClick={() => onCallSelect(call.id)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return
                    if (event.key !== "Enter" && event.key !== " ") return

                    event.preventDefault()
                    onCallSelect(call.id)
                  }}
                >
                  <div className="min-w-0">
                    <p className="font-medium">{call.title}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {relatedOpportunity?.name ?? "No opportunity linked"} · {call.type}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground md:hidden">Account</p>
                    <p className="truncate text-sm font-medium">{relatedAccount?.name ?? "No account linked"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground md:hidden">Status</p>
                    <p className={cn("text-sm font-medium", getCallStatusTextClassName(displayStatus))}>{displayStatus}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground md:hidden">Duration</p>
                    <p className="text-sm font-medium">{displayDuration}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground md:hidden">Date</p>
                    <p className="truncate text-sm font-medium">{call.date}</p>
                  </div>
                  <div
                    className="flex md:justify-end"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-11 min-w-[104px] justify-center gap-1.5 md:h-7"
                          aria-label={`Actions for ${call.title}`}
                        >
                          Actions
                          <ChevronDownIcon className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onSelect={() => onCallSelect(call.id)}>
                          <ExternalLinkIcon />
                          Open
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onSelect={() => onDeleteCall(call.id)}>
                          <Trash2Icon />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )
            })}
            {visibleCalls.length === 0 ? (
              <ListEmptyState
                icon={<PhoneCallIcon />}
                title={calls.length === 0 ? "No calls recorded yet" : "Nothing matches that view"}
                message={
                  calls.length === 0
                    ? "Start a call when you are ready. SalesFrame will save the recording, transcript, notes, and next-call brief here."
                    : hasCallFilters
                      ? "Try clearing the filters or searching by account, opportunity, status, or call type."
                      : "Your calls are here, but none are ready for this view yet."
                }
              />
            ) : null}
          </div>
          {visibleCalls.length > callsPageSize ? (
            <div className="flex flex-col gap-2 pt-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">
                Showing {callRangeStart}-{callRangeEnd} of {visibleCalls.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={safeCallsPage === 1}
                  onClick={() => setCallsPage((page) => Math.max(1, page - 1))}
                >
                  Previous
                </Button>
                <span className="min-w-20 text-center text-muted-foreground">
                  Page {safeCallsPage} of {totalCallPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={safeCallsPage === totalCallPages}
                  onClick={() => setCallsPage((page) => Math.min(totalCallPages, page + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function ListEmptyState({
  icon,
  message,
  title,
}: {
  icon: React.ReactNode
  message: string
  title: string
}) {
  return (
    <div className="rounded-lg bg-muted/30 p-5">
      <div className="flex max-w-2xl items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-xs [&>svg]:size-4">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  )
}

function RecordStatusMessage({
  message,
  status,
}: {
  message: string
  status: RecordSaveStatus
}) {
  const isError = status === "error"

  return (
    <div
      aria-live={isError ? "assertive" : "polite"}
      role={isError ? "alert" : "status"}
      className={cn(
        "rounded-lg p-3 text-sm",
        isError
          ? "border border-destructive/30 bg-destructive/10 text-destructive"
          : "bg-muted/30 text-muted-foreground"
      )}
    >
      {message}
    </div>
  )
}

type EditableCustomFrameworkField = {
  id: string
  detail: string
  label: string
}

type EditableCustomFrameworkCriterion = {
  id: string
  text: string
}

type EditableCustomFramework = {
  bestFor: string
  description: string
  evidenceStandard: string
  fields: EditableCustomFrameworkField[]
  frameworkName: string
  liveGuidance: string
  exitCriteria: EditableCustomFrameworkCriterion[]
}

const customFrameworkStorageKey = "salesframe.customFramework"
const customExitCriteriaMarker = "\n\nCustom exit criteria:"

function createEditorId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

function parseCustomFrameworkLiveGuidance(value?: string | null) {
  const liveGuidance = (value ?? "").trim()
  const markerIndex = liveGuidance.indexOf(customExitCriteriaMarker)

  if (markerIndex === -1) {
    return {
      exitCriteria: [] as string[],
      liveGuidance,
    }
  }

  const criteriaBlock = liveGuidance.slice(markerIndex + customExitCriteriaMarker.length).trim()

  return {
    exitCriteria: criteriaBlock
      .split("\n")
      .map((line) => line.replace(/^-\s*/, "").trim())
      .filter(Boolean),
    liveGuidance: liveGuidance.slice(0, markerIndex).trim(),
  }
}

function encodeCustomFrameworkLiveGuidance(liveGuidance: string, exitCriteria: string[]) {
  const criteria = exitCriteria.map((criterion) => `- ${criterion.trim()}`).filter((criterion) => criterion !== "-")

  return criteria.length ? `${liveGuidance.trim()}${customExitCriteriaMarker}\n${criteria.join("\n")}` : liveGuidance.trim()
}

function getDefaultCustomFramework(): EditableCustomFramework {
  const customPlaybook = playbooks.find((playbook) => playbook.id === "custom") ?? playbooks[playbooks.length - 1]

  return {
    bestFor: customPlaybook.bestFor,
    description: customPlaybook.description,
    evidenceStandard: customPlaybook.evidenceStandard,
    fields: customPlaybook.fields.map(([label, detail], index) => ({
      detail,
      id: `field-${index}`,
      label,
    })),
    frameworkName: "Custom framework",
    liveGuidance: customPlaybook.liveGuidance,
    exitCriteria: customPlaybook.exitCriteria.map((text, index) => ({
      id: `criteria-${index}`,
      text,
    })),
  }
}

function normalizeCustomFramework(value: EditableCustomFramework): EditableCustomFramework {
  const defaults = getDefaultCustomFramework()
  const fields = value.fields.length
    ? value.fields.map((field, index) => ({
        detail: field.detail.trim(),
        id: field.id || `field-${index}`,
        label: field.label.trim() || `Required field ${index + 1}`,
      }))
    : defaults.fields
  const exitCriteria = value.exitCriteria.length
    ? value.exitCriteria.map((criterion, index) => ({
        id: criterion.id || `criteria-${index}`,
        text: criterion.text.trim() || `Exit criterion ${index + 1}`,
      }))
    : defaults.exitCriteria

  return {
    bestFor: value.bestFor.trim() || defaults.bestFor,
    description: value.description.trim() || defaults.description,
    evidenceStandard: value.evidenceStandard.trim() || defaults.evidenceStandard,
    fields,
    frameworkName: value.frameworkName.trim() || defaults.frameworkName,
    liveGuidance: value.liveGuidance.trim() || defaults.liveGuidance,
    exitCriteria,
  }
}

function createEditableCustomFrameworkFromRows(
  playbookRow?: PlaybookRow,
  playbookFieldRows: PlaybookFieldRow[] = []
): EditableCustomFramework | null {
  if (!playbookRow) return null

  const defaults = getDefaultCustomFramework()
  const parsedLiveGuidance = parseCustomFrameworkLiveGuidance(playbookRow.live_guidance)
  const fields = playbookFieldRows.length
    ? playbookFieldRows
        .slice()
        .sort((firstField, secondField) => firstField.sort_order - secondField.sort_order)
        .map((field) => ({
          detail: field.evidence_standard ?? field.description ?? "",
          id: field.id,
          label: field.label,
        }))
    : defaults.fields
  const exitCriteria = parsedLiveGuidance.exitCriteria.length
    ? parsedLiveGuidance.exitCriteria.map((text, index) => ({
        id: `criteria-${index}`,
        text,
      }))
    : defaults.exitCriteria

  return normalizeCustomFramework({
    bestFor: playbookRow.best_for ?? defaults.bestFor,
    description: playbookRow.description ?? defaults.description,
    evidenceStandard: playbookRow.evidence_standard ?? defaults.evidenceStandard,
    fields,
    frameworkName: playbookRow.name,
    liveGuidance: parsedLiveGuidance.liveGuidance || defaults.liveGuidance,
    exitCriteria,
  })
}

function getCustomPlaybookRow(playbookRows: PlaybookRow[]) {
  return (
    playbookRows.find((playbook) => playbook.slug === "custom" && !playbook.is_system) ??
    playbookRows.find((playbook) => playbook.slug === "custom")
  )
}

function loadCustomFramework(): EditableCustomFramework {
  const defaults = getDefaultCustomFramework()

  if (typeof window === "undefined") return defaults

  try {
    const stored = window.localStorage.getItem(customFrameworkStorageKey)
    if (!stored) return defaults

    const parsed = JSON.parse(stored) as Partial<EditableCustomFramework>

    return normalizeCustomFramework({
      ...defaults,
      ...parsed,
      fields: Array.isArray(parsed.fields) ? parsed.fields : defaults.fields,
      exitCriteria: Array.isArray(parsed.exitCriteria) ? parsed.exitCriteria : defaults.exitCriteria,
    })
  } catch {
    return defaults
  }
}

function saveCustomFramework(value: EditableCustomFramework) {
  const normalized = normalizeCustomFramework(value)

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(customFrameworkStorageKey, JSON.stringify(normalized))
    } catch {
      // Storage can be unavailable in restricted browser modes. The backend save still keeps the custom framework.
    }
  }

  return normalized
}

function PlaybooksView({
  activeView,
  playbookFields,
  playbookRows,
  onNavigate,
  onSaveCustomFramework,
}: {
  activeView: string
  playbookFields: PlaybookFieldRow[]
  playbookRows: PlaybookRow[]
  onNavigate: (view: string) => void
  onSaveCustomFramework?: (draft: EditableCustomFramework) => Promise<EditableCustomFramework | void>
}) {
  const workspaceCustomFramework = React.useMemo(() => {
    const customPlaybookRow = getCustomPlaybookRow(playbookRows)
    const customPlaybookFields = customPlaybookRow
      ? playbookFields.filter((field) => field.playbook_id === customPlaybookRow.id)
      : []

    return createEditableCustomFrameworkFromRows(customPlaybookRow, customPlaybookFields) ?? loadCustomFramework()
  }, [playbookFields, playbookRows])
  const workspaceCustomFrameworkKey = React.useMemo(
    () => JSON.stringify(workspaceCustomFramework),
    [workspaceCustomFramework]
  )
  const [savedCustomFramework, setSavedCustomFramework] = React.useState<EditableCustomFramework>(() =>
    workspaceCustomFramework
  )
  const [customDraft, setCustomDraft] = React.useState<EditableCustomFramework>(savedCustomFramework)
  const [customSaveMessage, setCustomSaveMessage] = React.useState("")
  const [customSaveTone, setCustomSaveTone] = React.useState<"success" | "error" | "info">("info")
  const [customSaving, setCustomSaving] = React.useState(false)
  const playbookCatalog = React.useMemo(
    () =>
      playbooks
        .map((playbook) =>
          playbook.id === "custom"
            ? {
                ...playbook,
                bestFor: customDraft.bestFor,
                description: customDraft.description,
                evidenceStandard: customDraft.evidenceStandard,
                fields: customDraft.fields.map((field) => [field.label, field.detail] as [string, string]),
                liveGuidance: customDraft.liveGuidance,
                name: customDraft.frameworkName,
                exitCriteria: customDraft.exitCriteria.map((criterion) => criterion.text),
              }
            : playbook
        )
        .sort((firstPlaybook, secondPlaybook) => firstPlaybook.name.localeCompare(secondPlaybook.name)),
    [customDraft]
  )
  const selectedPlaybook = playbookCatalog.find((playbook) => playbook.id === activeView)
  const visiblePlaybooks = playbookCatalog
  const hasCustomChanges = JSON.stringify(customDraft) !== JSON.stringify(savedCustomFramework)

  React.useEffect(() => {
    setSavedCustomFramework(workspaceCustomFramework)
    setCustomDraft(workspaceCustomFramework)
  }, [workspaceCustomFrameworkKey, workspaceCustomFramework])

  const updateCustomDraft = <Field extends keyof EditableCustomFramework>(
    field: Field,
    value: EditableCustomFramework[Field]
  ) => {
    setCustomDraft((current) => ({
      ...current,
      [field]: value,
    }))
    setCustomSaveMessage("")
    setCustomSaveTone("info")
  }

  const updateCustomField = (fieldId: string, values: Partial<EditableCustomFrameworkField>) => {
    setCustomDraft((current) => ({
      ...current,
      fields: current.fields.map((field) => (field.id === fieldId ? { ...field, ...values } : field)),
    }))
    setCustomSaveMessage("")
    setCustomSaveTone("info")
  }

  const removeCustomField = (fieldId: string) => {
    setCustomDraft((current) => ({
      ...current,
      fields: current.fields.length > 1 ? current.fields.filter((field) => field.id !== fieldId) : current.fields,
    }))
    setCustomSaveMessage("")
    setCustomSaveTone("info")
  }

  const addCustomField = () => {
    setCustomDraft((current) => ({
      ...current,
      fields: [
        ...current.fields,
        {
          detail: "Describe the evidence needed before this field is complete.",
          id: createEditorId("field"),
          label: `Required field ${current.fields.length + 1}`,
        },
      ],
    }))
    setCustomSaveMessage("")
    setCustomSaveTone("info")
  }

  const updateCustomCriterion = (criterionId: string, text: string) => {
    setCustomDraft((current) => ({
      ...current,
      exitCriteria: current.exitCriteria.map((criterion) =>
        criterion.id === criterionId ? { ...criterion, text } : criterion
      ),
    }))
    setCustomSaveMessage("")
    setCustomSaveTone("info")
  }

  const removeCustomCriterion = (criterionId: string) => {
    setCustomDraft((current) => ({
      ...current,
      exitCriteria:
        current.exitCriteria.length > 1
          ? current.exitCriteria.filter((criterion) => criterion.id !== criterionId)
          : current.exitCriteria,
    }))
    setCustomSaveMessage("")
    setCustomSaveTone("info")
  }

  const addCustomCriterion = () => {
    setCustomDraft((current) => ({
      ...current,
      exitCriteria: [
        ...current.exitCriteria,
        {
          id: createEditorId("criteria"),
          text: `Exit criterion ${current.exitCriteria.length + 1}`,
        },
      ],
    }))
    setCustomSaveMessage("")
  }

  const handleSaveCustomFramework = async () => {
    const normalized = normalizeCustomFramework(customDraft)

    setCustomSaving(true)
    setCustomSaveMessage("")
    setCustomSaveTone("info")

    try {
      const persisted = (await onSaveCustomFramework?.(normalized)) ?? saveCustomFramework(normalized)

      setSavedCustomFramework(persisted)
      setCustomDraft(persisted)
      setCustomSaveTone("success")
      setCustomSaveMessage("Custom framework saved.")
    } catch (caughtError: unknown) {
      setCustomSaveTone("error")
      setCustomSaveMessage(getUserFacingErrorMessage(caughtError, "Custom framework needs another save attempt."))
    } finally {
      setCustomSaving(false)
    }
  }

  const handleResetCustomFramework = () => {
    setCustomDraft(savedCustomFramework)
    setCustomSaveTone("info")
    setCustomSaveMessage("Unsaved custom framework changes reset.")
  }

  if (!selectedPlaybook) {
    return (
      <div className="grid gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Playbooks</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Reference pages for the qualification frameworks sellers can attach to opportunities.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visiblePlaybooks.map((playbook) => (
            <div
              key={playbook.id}
              className="grid min-h-44 gap-4 rounded-lg bg-muted/20 p-4 transition-colors duration-150 hover:bg-muted/30"
            >
              <div className="grid gap-3">
                <div className="flex items-start gap-3">
                  <PlaybookIcon playbookId={playbook.id} />
                  <div className="min-w-0">
                    <p className="font-medium leading-snug">{playbook.name}</p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{playbook.description}</p>
              </div>
              <div className="mt-auto flex items-center justify-between gap-3 pt-1 text-sm">
                <span className="text-muted-foreground">{playbook.fields.length} required fields</span>
                <OpenButton onClick={() => onNavigate(playbook.id)} />
              </div>
            </div>
          ))}
          {visiblePlaybooks.length === 0 ? (
            <div className="lg:col-span-3">
              <ListEmptyState
                icon={<BookOpenCheckIcon />}
                title="Nothing matches that view"
                message="Playbooks will appear here once the workspace has methodology access."
              />
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  if (selectedPlaybook.id === "custom") {
    return (
      <CustomFrameworkEditor
        draft={customDraft}
        hasChanges={hasCustomChanges}
        isSaving={customSaving}
        saveMessage={customSaveMessage}
        saveTone={customSaveTone}
        onAddCriterion={addCustomCriterion}
        onAddField={addCustomField}
        onDraftChange={updateCustomDraft}
        onFieldChange={updateCustomField}
        onRemoveCriterion={removeCustomCriterion}
        onRemoveField={removeCustomField}
        onReset={handleResetCustomFramework}
        onSave={handleSaveCustomFramework}
        onCriterionChange={updateCustomCriterion}
      />
    )
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <PlaybookIcon playbookId={selectedPlaybook.id} className="size-11 bg-muted/40" iconClassName="size-5" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">{selectedPlaybook.name}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{selectedPlaybook.description}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="gap-4">
        <TabsList className="w-full justify-start sm:w-fit">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="fields">Fields</TabsTrigger>
          <TabsTrigger value="exit-criteria">Exit criteria</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="m-0 grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["Origin", selectedPlaybook.origin],
              ["Why use it", selectedPlaybook.whyUse],
              ["Where it fits", selectedPlaybook.bestFor],
              ["Adoption pattern", selectedPlaybook.adoption],
            ].map(([label, value]) => (
              <div key={label} className="grid gap-2 rounded-lg bg-muted/20 p-4">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{value}</p>
              </div>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>How SalesFrame applies it</CardTitle>
              <CardDescription>
                The framework stays strict in the background while the seller gets one natural next move.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <ContextRow label="Evidence standard" value={selectedPlaybook.evidenceStandard} />
              <ContextRow label="Live question behavior" value={selectedPlaybook.liveGuidance} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fields" className="m-0">
          <Card>
            <CardHeader>
              <CardTitle>Required fields</CardTitle>
              <CardDescription>What SalesFrame listens for before it treats the framework as covered.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[560px] pr-3">
                <Accordion
                  type="single"
                  collapsible
                  className="w-full"
                  defaultValue={selectedPlaybook.fields[0] ? "field-0" : undefined}
                >
                  {selectedPlaybook.fields.map(([field, detail], index) => (
                    <AccordionItem key={field} value={`field-${index}`}>
                      <AccordionTrigger>
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/40 text-muted-foreground">
                            <ListChecksIcon className="size-3.5" />
                          </span>
                          <span className="truncate">{field}</span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pl-10 text-muted-foreground">
                        {detail}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exit-criteria" className="m-0">
          <Card>
            <CardHeader>
              <CardTitle>Exit criteria</CardTitle>
              <CardDescription>Signals that this playbook has enough usable customer evidence.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {selectedPlaybook.exitCriteria.map((criteria) => (
                <div key={criteria} className="flex min-w-0 items-start gap-3 rounded-lg bg-muted/20 p-3 text-sm">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    <CheckIcon className="size-3.5" />
                  </span>
                  <span className="min-w-0 leading-relaxed">{criteria}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function CustomFrameworkEditor({
  draft,
  hasChanges,
  isSaving,
  onAddCriterion,
  onAddField,
  onCriterionChange,
  onDraftChange,
  onFieldChange,
  onRemoveCriterion,
  onRemoveField,
  onReset,
  onSave,
  saveMessage,
  saveTone,
}: {
  draft: EditableCustomFramework
  hasChanges: boolean
  isSaving: boolean
  onAddCriterion: () => void
  onAddField: () => void
  onCriterionChange: (criterionId: string, text: string) => void
  onDraftChange: <Field extends keyof EditableCustomFramework>(
    field: Field,
    value: EditableCustomFramework[Field]
  ) => void
  onFieldChange: (fieldId: string, values: Partial<EditableCustomFrameworkField>) => void
  onRemoveCriterion: (criterionId: string) => void
  onRemoveField: (fieldId: string) => void
  onReset: () => void
  onSave: () => void
  saveMessage: string
  saveTone: "success" | "error" | "info"
}) {
  return (
    <div className="grid gap-4" data-testid="custom-framework-editor">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <PlaybookIcon playbookId="custom" className="size-11 bg-muted/40" iconClassName="size-5" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight break-words">{draft.frameworkName}</h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{draft.description}</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Framework setup</CardTitle>
            <CardDescription>Name the framework and define how the coach should use it.</CardDescription>
          </div>
          <CardAction className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
            {saveMessage ? (
              <p
                className={cn(
                  "text-sm sm:text-right",
                  saveTone === "error" && "text-destructive",
                  saveTone === "success" && "text-emerald-600",
                  saveTone === "info" && "text-muted-foreground"
                )}
                aria-live={saveTone === "error" ? "assertive" : "polite"}
                role={saveTone === "error" ? "alert" : "status"}
              >
                {saveMessage}
              </p>
            ) : null}
            <Button className="w-full sm:w-auto" variant="outline" size="sm" disabled={!hasChanges || isSaving} onClick={onReset}>
              Reset
            </Button>
            <Button size="sm" className="w-full gap-2 sm:w-auto" disabled={!hasChanges || isSaving} onClick={onSave}>
              <CheckCircle2Icon />
              {isSaving ? "Saving..." : "Save custom framework"}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <EditableTextField
              id="custom-framework-name"
              label="Framework name"
              value={draft.frameworkName}
              onChange={(value) => onDraftChange("frameworkName", value)}
            />
            <EditableTextField
              id="custom-framework-best-for"
              label="Best for"
              value={draft.bestFor}
              onChange={(value) => onDraftChange("bestFor", value)}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <EditableTextareaField
              id="custom-framework-description"
              label="Description"
              value={draft.description}
              onChange={(value) => onDraftChange("description", value)}
            />
            <EditableTextareaField
              id="custom-framework-evidence-standard"
              label="Evidence standard"
              value={draft.evidenceStandard}
              onChange={(value) => onDraftChange("evidenceStandard", value)}
            />
          </div>
          <EditableTextareaField
            id="custom-framework-live-guidance"
            label="Live guidance"
            value={draft.liveGuidance}
            onChange={(value) => onDraftChange("liveGuidance", value)}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Required fields</CardTitle>
              <CardDescription>Fields the seller must capture before the opportunity progresses. Keep at least one required field.</CardDescription>
            </div>
            <CardAction>
              <Button variant="outline" size="sm" className="gap-2" onClick={onAddField}>
                <PlusIcon />
                Add field
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-3">
            {draft.fields.map((field, index) => (
              <div key={field.id} className="grid gap-3 rounded-lg border bg-muted/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">Field {index + 1}</p>
                  {draft.fields.length > 1 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 text-muted-foreground"
                      onClick={() => onRemoveField(field.id)}
                    >
                      <Trash2Icon />
                      Remove
                    </Button>
                  ) : null}
                </div>
                <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
                  <div className="grid gap-2">
                    <Label htmlFor={`${field.id}-label`}>Field name</Label>
                    <Input
                      id={`${field.id}-label`}
                      value={field.label}
                      onChange={(event) => onFieldChange(field.id, { label: event.currentTarget.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`${field.id}-detail`}>Required evidence</Label>
                    <Textarea
                      id={`${field.id}-detail`}
                      className="min-h-20 resize-none"
                      value={field.detail}
                      onChange={(event) => onFieldChange(field.id, { detail: event.currentTarget.value })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Exit criteria</CardTitle>
                <CardDescription>Rules for when this custom framework has enough evidence. Keep at least one criterion.</CardDescription>
              </div>
              <CardAction>
                <Button variant="outline" size="sm" className="gap-2" onClick={onAddCriterion}>
                  <PlusIcon />
                  Add criterion
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-3">
              {draft.exitCriteria.map((criterion, index) => (
                <div key={criterion.id} className="grid gap-2 rounded-lg border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">Criteria {index + 1}</p>
                    {draft.exitCriteria.length > 1 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-muted-foreground"
                        onClick={() => onRemoveCriterion(criterion.id)}
                      >
                        <Trash2Icon />
                        Remove
                      </Button>
                    ) : null}
                  </div>
                  <Textarea
                    aria-label={`Exit criteria ${index + 1}`}
                    className="min-h-20 resize-none"
                    value={criterion.text}
                    onChange={(event) => onCriterionChange(criterion.id, event.currentTarget.value)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Custom framework label</CardTitle>
              <CardDescription>This remains selectable as the app's custom framework playbook.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <ContextTile icon={<BookOpenCheckIcon />} label="Display name" value={draft.frameworkName} />
              <ContextTile icon={<ListChecksIcon />} label="Required fields" value={draft.fields.length.toString()} />
              <ContextTile icon={<CheckCircle2Icon />} label="Exit criteria" value={draft.exitCriteria.length.toString()} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function PersonalAccountView({
  accounts,
  archivedAccounts,
  archivedOpportunities,
  bulkImportStatus,
  bulkImportStatusLoading,
  bulkImportStatusMessage,
  profile,
  savedOpenAiKeyState,
  sellerResearchProfile,
  workspaceId,
  onOpenCsvImport,
  onRefreshBulkImportStatus,
  onRestoreArchivedAccount,
  onRestoreArchivedOpportunity,
  onRetryFailedBulkEnrichment,
  onProfileChange,
  onSellerResearchProfileChange,
  onOpenSettings,
}: {
  accounts: AccountNavItem[]
  archivedAccounts: AccountRow[]
  archivedOpportunities: OpportunityRow[]
  bulkImportStatus: BulkImportStatusResponse | null
  bulkImportStatusLoading: boolean
  bulkImportStatusMessage: string
  profile: PersonalAccountProfile
  savedOpenAiKeyState: SavedOpenAiKeyState | null
  sellerResearchProfile: SellerResearchProfile
  workspaceId: string
  onOpenCsvImport: (mode: CsvImportType) => void
  onRefreshBulkImportStatus: () => void
  onRestoreArchivedAccount: (accountId: string) => Promise<RecordMutationResult> | RecordMutationResult
  onRestoreArchivedOpportunity: (opportunityId: string) => Promise<RecordMutationResult> | RecordMutationResult
  onRetryFailedBulkEnrichment: () => void
  onProfileChange: (profile: PersonalAccountProfile) => void
  onSellerResearchProfileChange: (profile: SellerResearchProfile) => void
  onOpenSettings: () => void
}) {
  const [draft, setDraft] = React.useState(profile)
  const [statusMessage, setStatusMessage] = React.useState("")
  const [statusTone, setStatusTone] = React.useState<"success" | "error" | "info">("info")
  const [profileSavePending, setProfileSavePending] = React.useState(false)
  const [avatarUploadPending, setAvatarUploadPending] = React.useState(false)
  const [deletePhrase, setDeletePhrase] = React.useState("")
  const avatarInputRef = React.useRef<HTMLInputElement | null>(null)
  const initials = draft.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U"
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(profile)
  const canSave =
    draft.fullName.trim().length > 0 &&
    draft.email.trim().length > 0 &&
    !profileSavePending &&
    !avatarUploadPending
  const canRequestDeletion = deletePhrase.trim().toUpperCase() === "DELETE"
  const deletionRequestHref = React.useMemo(() => {
    const subject = encodeURIComponent("SalesFrame account deletion request")
    const body = encodeURIComponent([
      "Hi SalesFrame,",
      "",
      "Please help me delete my SalesFrame account.",
      "",
      `Name: ${draft.fullName.trim() || profile.fullName}`,
      `Email: ${draft.email.trim() || profile.email}`,
      `Workspace ID: ${workspaceId || "Not available"}`,
      "",
      "I understand you will verify identity and workspace ownership before deletion.",
    ].join("\n"))

    return `mailto:${salesFrameSupportEmail}?subject=${subject}&body=${body}`
  }, [draft.email, draft.fullName, profile.email, profile.fullName, workspaceId])

  React.useEffect(() => {
    setDraft(profile)
  }, [profile])

  const updateDraft = (field: keyof PersonalAccountProfile, value: string) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }))
    setStatusMessage("")
    setStatusTone("info")
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ""

    if (!file) return

    if (!isSupportedAvatarImage(file)) {
      setStatusTone("error")
      setStatusMessage("Choose a PNG, JPEG, WebP, or GIF image.")
      return
    }

    if (file.size > maxAvatarFileSizeBytes) {
      setStatusTone("error")
      setStatusMessage("Choose an image smaller than 5MB.")
      return
    }

    setAvatarUploadPending(true)
    setStatusTone("info")
    setStatusMessage("Preparing photo...")

    try {
      const avatarUrl = await createAvatarDataUrl(file)

      updateDraft("avatarUrl", avatarUrl)
      setStatusTone("success")
      setStatusMessage("Photo ready. Save profile to use it.")
    } catch (caughtError: unknown) {
      setStatusTone("error")
      setStatusMessage(getUserFacingErrorMessage(caughtError, "Photo needs another upload attempt."))
    } finally {
      setAvatarUploadPending(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!canSave) return

    const nextProfile = {
      ...draft,
      avatarUrl: draft.avatarUrl.trim(),
      fullName: draft.fullName.trim(),
      email: draft.email.trim(),
      title: draft.title.trim(),
      company: draft.company.trim(),
      role: draft.role.trim(),
      region: draft.region.trim(),
      timezone: draft.timezone.trim(),
      phone: draft.phone.trim(),
      linkedin: draft.linkedin.trim(),
      bio: draft.bio.trim(),
    }

    setProfileSavePending(true)
    setStatusTone("info")
    setStatusMessage("Saving profile...")

    try {
      const savedProfile = await updateCurrentUserProfile({
        avatar_url: nextProfile.avatarUrl || null,
        company_name: nextProfile.company || null,
        email: profile.email,
        full_name: nextProfile.fullName,
        role_title: nextProfile.title || null,
        timezone: nextProfile.timezone || "Australia/Sydney",
      })

      onProfileChange({
        ...nextProfile,
        avatarUrl: savedProfile.avatar_url ?? "",
        company: savedProfile.company_name ?? nextProfile.company,
        email: savedProfile.email || profile.email,
        fullName: savedProfile.full_name || nextProfile.fullName,
        title: savedProfile.role_title ?? nextProfile.title,
        timezone: savedProfile.timezone || nextProfile.timezone,
      })
      setStatusTone("success")
      setStatusMessage("Profile saved.")
    } catch (caughtError: unknown) {
      setStatusTone("error")
      setStatusMessage(getUserFacingErrorMessage(caughtError, "Profile needs another save attempt."))
    } finally {
      setProfileSavePending(false)
    }
  }

  const handleResetProfile = () => {
    setDraft(profile)
    setStatusTone("info")
    setStatusMessage("Unsaved profile changes reset.")
  }

  const handleRequestDeletion = () => {
    if (!canRequestDeletion) return

    window.location.href = deletionRequestHref
    setStatusTone("info")
    setStatusMessage("Your email app should open with a deletion request ready to send.")
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Avatar className="size-12 rounded-lg" size="lg">
              <AvatarImage className="rounded-lg" src={profile.avatarUrl} alt={profile.fullName} />
              <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="font-heading text-2xl leading-tight font-semibold">{profile.fullName}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage your seller profile, workspace identity, and account-level actions.
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Profile details</CardTitle>
            <CardDescription>These details identify you in the product and connected outputs</CardDescription>
          </div>
          {hasChanges ? (
            <CardAction>
              <p className="text-sm text-muted-foreground" aria-live="polite">Unsaved changes</p>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-col gap-3 rounded-lg bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="size-16 rounded-lg" size="lg">
                <AvatarImage className="rounded-lg" src={draft.avatarUrl} alt={draft.fullName} />
                <AvatarFallback className="rounded-lg text-base font-medium">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium">Profile photo</p>
                <p className="text-sm text-muted-foreground">
                  Used in your sidebar profile and account menu.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Input
                ref={avatarInputRef}
                id="personal-avatar-upload"
                aria-hidden="true"
                className="hidden"
                tabIndex={-1}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                disabled={avatarUploadPending || profileSavePending}
                onChange={handleAvatarUpload}
              />
              <Button
                variant="outline"
                className="w-full gap-2 sm:w-auto"
                disabled={avatarUploadPending || profileSavePending}
                onClick={() => avatarInputRef.current?.click()}
              >
                <ImageIcon className="size-4" />
                {avatarUploadPending ? "Preparing..." : "Upload photo"}
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2 sm:w-auto"
                disabled={!draft.avatarUrl || avatarUploadPending || profileSavePending}
                onClick={() => updateDraft("avatarUrl", "")}
              >
                <Trash2Icon />
                Remove
              </Button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <EditableTextField
              id="personal-name"
              label="Full name"
              value={draft.fullName}
              onChange={(value) => updateDraft("fullName", value)}
            />
            <div className="grid gap-2">
              <Label htmlFor="personal-email">Sign-in email</Label>
              <Input id="personal-email" value={profile.email} readOnly aria-readonly="true" className="bg-muted/40" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Used for login and account recovery.
              </p>
            </div>
            <EditableTextField
              id="personal-title"
              label="Title"
              value={draft.title}
              onChange={(value) => updateDraft("title", value)}
            />
            <EditableTextField
              id="personal-company"
              label="Company"
              value={draft.company}
              onChange={(value) => updateDraft("company", value)}
            />
            <EditableTextField
              id="personal-region"
              label="Location"
              value={draft.region}
              onChange={(value) => updateDraft("region", value)}
            />
            <TimezoneSelect
              id="personal-timezone"
              label="Timezone"
              value={draft.timezone}
              onChange={(value) => updateDraft("timezone", value)}
            />
            <EditableTextField
              id="personal-phone"
              label="Phone"
              value={draft.phone}
              placeholder="Optional"
              onChange={(value) => updateDraft("phone", value)}
            />
            <EditableTextField
              id="personal-linkedin"
              label="LinkedIn"
              value={draft.linkedin}
              placeholder="Optional"
              onChange={(value) => updateDraft("linkedin", value)}
            />
          </div>
          <EditableTextareaField
            id="personal-bio"
            label="Profile notes"
            value={draft.bio}
            onChange={(value) => updateDraft("bio", value)}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button className="w-full gap-2 sm:w-auto" disabled={!canSave || !hasChanges} onClick={handleSaveProfile}>
              <CheckCircle2Icon />
              {profileSavePending ? "Saving..." : "Save profile"}
            </Button>
            <Button className="w-full sm:w-auto" variant="outline" disabled={!hasChanges} onClick={handleResetProfile}>
              Reset changes
            </Button>
          </div>
          {statusMessage ? (
            <p
              className={cn(
                "text-sm",
                statusTone === "error" && "text-destructive",
                statusTone === "success" && "text-emerald-600",
                statusTone === "info" && "text-muted-foreground"
              )}
              aria-live={statusTone === "error" ? "assertive" : "polite"}
              role={statusTone === "error" ? "alert" : "status"}
            >
              {statusMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <SellerResearchProfileCard
        savedOpenAiKeyState={savedOpenAiKeyState}
        sellerResearchProfile={sellerResearchProfile}
        workspaceId={workspaceId}
        onOpenSettings={onOpenSettings}
        onSellerResearchProfileChange={onSellerResearchProfileChange}
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Data import</CardTitle>
            <CardDescription>Import customer accounts and opportunities into the selected workspace.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid min-w-0 gap-4">
          <div className="min-w-0 overflow-hidden rounded-lg bg-muted/30 p-4">
            <div className="flex min-w-0 items-start gap-3">
              <DatabaseIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Current workspace only</p>
                <p className="mt-1 max-w-full break-words text-sm leading-relaxed text-muted-foreground">
                  This import only affects the selected workspace. Switch workspace to import a different dataset.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              variant="outline"
              className="w-full gap-2 sm:w-auto"
              disabled={!workspaceId}
              onClick={() => onOpenCsvImport("accounts")}
            >
              <Building2Icon />
              Import accounts
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2 sm:w-auto"
              disabled={!workspaceId}
              onClick={() => onOpenCsvImport("opportunities")}
            >
              <TargetIcon />
              Import opportunities
            </Button>
          </div>
          <BulkImportStatusPanel
            loading={bulkImportStatusLoading}
            message={bulkImportStatusMessage}
            status={bulkImportStatus}
            onOpenSettings={onOpenSettings}
            onRefresh={onRefreshBulkImportStatus}
            onRetryFailed={onRetryFailedBulkEnrichment}
          />
        </CardContent>
      </Card>

      <ArchiveRestoreCard
        accounts={accounts}
        archivedAccounts={archivedAccounts}
        archivedOpportunities={archivedOpportunities}
        onRestoreAccount={onRestoreArchivedAccount}
        onRestoreOpportunity={onRestoreArchivedOpportunity}
      />

      <Card>
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
          <CardDescription>Request account deletion and access review</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <CircleAlertIcon className="mt-0.5 size-4 text-destructive" />
              <div>
                <p className="text-sm font-medium">Deleting your account requires confirmation</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Send a deletion request to {salesFrameSupportEmail}. We will verify identity, review workspace ownership, and confirm how customer records should be handled.
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="delete-personal-account">Type DELETE to request deletion</Label>
            <Input
              id="delete-personal-account"
              value={deletePhrase}
              placeholder="DELETE"
              onChange={(event) => setDeletePhrase(event.currentTarget.value)}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button className="w-full sm:w-auto" variant="destructive" disabled={!canRequestDeletion} onClick={handleRequestDeletion}>
              Request account deletion
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}

function ArchiveRestoreCard({
  accounts,
  archivedAccounts,
  archivedOpportunities,
  onRestoreAccount,
  onRestoreOpportunity,
}: {
  accounts: AccountNavItem[]
  archivedAccounts: AccountRow[]
  archivedOpportunities: OpportunityRow[]
  onRestoreAccount: (accountId: string) => Promise<RecordMutationResult> | RecordMutationResult
  onRestoreOpportunity: (opportunityId: string) => Promise<RecordMutationResult> | RecordMutationResult
}) {
  const [restorePendingId, setRestorePendingId] = React.useState("")
  const [restoreMessage, setRestoreMessage] = React.useState("")
  const [restoreMessageTone, setRestoreMessageTone] = React.useState<"success" | "error" | "info">("info")
  const activeAccountById = React.useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts])
  const archivedAccountById = React.useMemo(
    () => new Map(archivedAccounts.map((account) => [account.id, account])),
    [archivedAccounts]
  )

  const handleRestore = async ({
    id,
    label,
    restore,
  }: {
    id: string
    label: string
    restore: (id: string) => Promise<RecordMutationResult> | RecordMutationResult
  }) => {
    setRestorePendingId(id)
    setRestoreMessage("")
    setRestoreMessageTone("info")

    const result = await restore(id)

    if (!result.ok) {
      setRestoreMessage(result.message)
      setRestoreMessageTone("error")
      setRestorePendingId("")
      return
    }

    setRestoreMessage(`${label} restored.`)
    setRestoreMessageTone("success")
    setRestorePendingId("")
  }

  const hasArchivedRecords = archivedAccounts.length > 0 || archivedOpportunities.length > 0

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Archive</CardTitle>
          <CardDescription>Restore accounts and opportunities hidden from the active workspace.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!hasArchivedRecords ? (
          <ListEmptyState
            icon={<ArchiveIcon />}
            title="Nothing archived yet"
            message="Good, clean workspace."
          />
        ) : null}

        {archivedAccounts.length ? (
          <div className="grid gap-2">
            <h3 className="text-sm font-medium">Archived accounts</h3>
            <div className="grid gap-2">
              {archivedAccounts.map((account) => (
                <div
                  key={account.id}
                  className="grid gap-3 rounded-lg bg-muted/30 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,0.55fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{account.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{account.website || "No website saved"}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {account.archived_at ? formatSavedAt(account.archived_at) : "Archived"}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full gap-2 sm:w-auto"
                    disabled={restorePendingId === account.id}
                    onClick={() =>
                      void handleRestore({
                        id: account.id,
                        label: account.name,
                        restore: onRestoreAccount,
                      })
                    }
                  >
                    <Undo2Icon />
                    {restorePendingId === account.id ? "Restoring..." : "Restore account"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {archivedOpportunities.length ? (
          <div className="grid gap-2">
            <h3 className="text-sm font-medium">Archived opportunities</h3>
            <div className="grid gap-2">
              {archivedOpportunities.map((opportunity) => {
                const activeParentAccount = activeAccountById.get(opportunity.account_id)
                const archivedParentAccount = archivedAccountById.get(opportunity.account_id)
                const parentAccountName = activeParentAccount?.name ?? archivedParentAccount?.name ?? "Account not found"
                const isParentArchived = Boolean(archivedParentAccount)

                return (
                  <div
                    key={opportunity.id}
                    className="grid gap-3 rounded-lg bg-muted/30 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,0.55fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{opportunity.name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {isParentArchived ? `${parentAccountName} is archived` : parentAccountName}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {opportunity.archived_at ? formatSavedAt(opportunity.archived_at) : "Archived"}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full gap-2 sm:w-auto"
                      disabled={isParentArchived || restorePendingId === opportunity.id}
                      title={isParentArchived ? "Restore the account before restoring this opportunity." : undefined}
                      onClick={() =>
                        void handleRestore({
                          id: opportunity.id,
                          label: opportunity.name,
                          restore: onRestoreOpportunity,
                        })
                      }
                    >
                      <Undo2Icon />
                      {restorePendingId === opportunity.id ? "Restoring..." : "Restore opportunity"}
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        {restoreMessage ? (
          <p
            className={cn(
              "text-sm",
              restoreMessageTone === "error" && "text-destructive",
              restoreMessageTone === "success" && "text-emerald-600",
              restoreMessageTone === "info" && "text-muted-foreground"
            )}
            role={restoreMessageTone === "error" ? "alert" : "status"}
            aria-live={restoreMessageTone === "error" ? "assertive" : "polite"}
          >
            {restoreMessage}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function BulkImportStatusPanel({
  loading,
  message,
  status,
  onOpenSettings,
  onRefresh,
  onRetryFailed,
}: {
  loading: boolean
  message: string
  status: BulkImportStatusResponse | null
  onOpenSettings: () => void
  onRefresh: () => void
  onRetryFailed: () => void
}) {
  const runs = status?.runs ?? []
  const pausedCount = status?.pausedMissingKeyCount ?? 0
  const failedCount = runs.reduce((total, run) => total + run.enrichment.failed, 0)

  return (
    <div className="grid min-w-0 max-w-full gap-3 overflow-hidden rounded-lg bg-muted/30 p-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <SparklesIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Recent imports and enrichment</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              SalesFrame imports the data first, then enriches accounts quietly in the background.
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
          {failedCount > 0 ? (
            <Button variant="outline" size="sm" className="w-full gap-2 sm:w-auto" disabled={loading} onClick={onRetryFailed}>
              <SparklesIcon />
              Retry failed
            </Button>
          ) : null}
          <Button variant="outline" size="sm" className="w-full sm:w-auto" disabled={loading} onClick={onRefresh}>
            {loading ? "Refreshing..." : "Refresh status"}
          </Button>
        </div>
      </div>

      {pausedCount > 0 ? (
        <div className="min-w-0 overflow-hidden rounded-lg bg-background/70 p-3">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">AI enrichment is paused</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {pausedCount} accounts are waiting for an OpenAI key before SalesFrame can research them.
              </p>
            </div>
            <Button variant="outline" size="sm" className="w-full gap-2 sm:w-auto" onClick={onOpenSettings}>
              <KeyRoundIcon />
              Open settings
            </Button>
          </div>
        </div>
      ) : null}

      {message ? (
        <p
          className={cn("break-words text-sm", /needs|try|failed|error/i.test(message) ? "text-destructive" : "text-muted-foreground")}
          aria-live={/needs|try|failed|error/i.test(message) ? "assertive" : "polite"}
          role={/needs|try|failed|error/i.test(message) ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}

      {runs.length > 0 ? (
        <div className="grid min-w-0 gap-2">
          {runs.map((run) => (
            <BulkImportRunRow key={run.id} run={run} />
          ))}
        </div>
      ) : (
        <div className="min-w-0 overflow-hidden rounded-lg bg-background/70 p-3 text-sm text-muted-foreground">
          No imports yet. When you upload a CSV, enrichment progress will show here.
        </div>
      )}
    </div>
  )
}

function BulkImportRunRow({ run }: { run: BulkImportStatusResponse["runs"][number] }) {
  const activeCount = run.enrichment.queued + run.enrichment.running + run.enrichment.retrying
  const completedCount = run.enrichment.completed
  const pausedCount = run.enrichment.paused
  const failedCount = run.enrichment.failed
  const summary = [
    `${run.rows.created} created`,
    `${run.rows.updated} updated`,
    `${run.rows.skipped} skipped`,
    run.rows.failed ? `${run.rows.failed} needs review` : "",
  ].filter(Boolean).join(" / ")
  const enrichmentLine = run.enrichment.total === 0
    ? "No account enrichment queued for this import."
    : [
        completedCount ? `${completedCount} completed` : "",
        activeCount ? `${activeCount} in progress` : "",
        pausedCount ? `${pausedCount} paused` : "",
        failedCount ? `${failedCount} failed` : "",
        run.enrichment.skipped ? `${run.enrichment.skipped} skipped` : "",
      ].filter(Boolean).join(" / ")
  const icon =
    failedCount > 0 ? <CircleAlertIcon className="size-4 text-destructive" /> :
      pausedCount > 0 ? <KeyRoundIcon className="size-4 text-muted-foreground" /> :
        run.enrichment.total > 0 && completedCount >= run.enrichment.total ? <CheckCircle2Icon className="size-4 text-emerald-600" /> :
          <Clock3Icon className="size-4 text-muted-foreground" />

  return (
    <div className="min-w-0 overflow-hidden rounded-lg bg-background/70 p-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {run.importType === "accounts" ? "Accounts import" : "Opportunities import"}
              </p>
              {run.fileName ? (
                <p className="mt-0.5 break-all text-xs text-muted-foreground">{run.fileName}</p>
              ) : null}
            </div>
            <p className="shrink-0 text-xs text-muted-foreground">Updated {formatSavedAt(run.lastUpdatedAt)}</p>
          </div>
          <p className="mt-1 break-words text-sm text-muted-foreground">{summary}</p>
          <p className="mt-1 break-words text-sm text-muted-foreground">{enrichmentLine}</p>
          {run.enrichment.total > 0 ? (
            <Progress className="mt-3 h-2" value={run.progress} aria-label="AI enrichment progress" />
          ) : null}
          {run.failureRows.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full gap-2 sm:w-auto"
              onClick={() => downloadBulkImportFailedRows(run)}
            >
              <DownloadIcon />
              Download failed rows
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function downloadBulkImportFailedRows(run: BulkImportStatusResponse["runs"][number]) {
  const csv = makeFailedRowsCsv({
    created: run.rows.created,
    enrichment: {
      alreadyTracked: run.enrichment.alreadyTracked,
      enabled: run.enrichment.total > 0,
      paused: run.enrichment.paused,
      queued: run.enrichment.queued,
      skipped: run.enrichment.skipped,
      status: "none",
    },
    failed: run.failureRows.length,
    failures: run.failureRows,
    skipped: run.rows.skipped,
    updated: run.rows.updated,
  })
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${run.importType}-import-review-${run.id.slice(0, 8)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function SellerResearchProfileCard({
  savedOpenAiKeyState,
  sellerResearchProfile,
  workspaceId,
  onOpenSettings,
  onSellerResearchProfileChange,
}: {
  savedOpenAiKeyState: SavedOpenAiKeyState | null
  sellerResearchProfile: SellerResearchProfile
  workspaceId: string
  onOpenSettings: () => void
  onSellerResearchProfileChange: (profile: SellerResearchProfile) => void
}) {
  const [draft, setDraft] = React.useState<SellerResearchProfile>(sellerResearchProfile)
  const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = React.useState("")
  const lookupSequenceRef = React.useRef(0)
  const lookupTimeoutRef = React.useRef<number | null>(null)
  const hasSavedOpenAiKey = Boolean(savedOpenAiKeyState)
  const hasChanges = !areSellerResearchProfilesEqual(draft, sellerResearchProfile)
  const canSave =
    draft.sellerCompany.trim().length > 0 &&
    normalizeSellerDomain(draft.sellerDomain).length > 0 &&
    draft.productContext.trim().length > 0 &&
    status !== "loading"

  React.useEffect(() => {
    setDraft(sellerResearchProfile)
    setStatus("idle")
    setMessage("")
  }, [sellerResearchProfile])

  React.useEffect(() => {
    return () => {
      if (lookupTimeoutRef.current) {
        window.clearTimeout(lookupTimeoutRef.current)
      }
    }
  }, [])

  const clearPendingLookup = () => {
    if (lookupTimeoutRef.current) {
      window.clearTimeout(lookupTimeoutRef.current)
      lookupTimeoutRef.current = null
    }
  }

  const handleDomainChange = (value: string) => {
    clearPendingLookup()

    const lookupSequence = lookupSequenceRef.current + 1
    lookupSequenceRef.current = lookupSequence
    const normalizedDomain = normalizeSellerDomain(value)

    setDraft((current) => ({
      ...current,
      productContext: "",
      sellerCompany: normalizedDomain ? "" : current.sellerCompany,
      sellerDomain: value,
    }))

    if (!normalizedDomain) {
      setStatus("idle")
      setMessage("")
      return
    }

    if (!normalizedDomain.includes(".")) {
      setStatus("idle")
      setMessage("Enter a full company domain to research what you sell.")
      return
    }

    if (!hasSavedOpenAiKey) {
      setStatus("error")
      setMessage("Add an OpenAI API key in Settings before running seller domain research.")
      return
    }

    setStatus("loading")
    setMessage(`Looking up ${normalizedDomain} after you stop typing...`)

    lookupTimeoutRef.current = window.setTimeout(() => {
      setMessage(`Reading public information for ${normalizedDomain}...`)

      void requestSellerDomainResearch({
        domain: normalizedDomain,
        workspaceId,
      })
        .then((result) => {
          if (lookupSequenceRef.current !== lookupSequence) return

          setDraft({
            sellerCompany: result.sellerCompany,
            sellerDomain: result.sellerDomain || normalizedDomain,
            productContext: result.productContext,
          })
          setStatus("success")
          setMessage(`What you sell is ready for ${result.sellerDomain || normalizedDomain}.`)
        })
        .catch((error: unknown) => {
          if (lookupSequenceRef.current !== lookupSequence) return

          setStatus("error")
          setMessage(
            getUserFacingErrorMessage(error, "SalesFrame needs another moment to research this domain. You can type what you sell manually.")
          )
        })
    }, sellerDomainLookupDebounceMs)
  }

  const updateDraft = (field: keyof SellerResearchProfile, value: string) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }))
    if (status !== "loading") {
      setStatus("idle")
      setMessage("")
    }
  }

  const handleSave = () => {
    if (!canSave) return

    const nextProfile: SellerResearchProfile = {
      sellerCompany: draft.sellerCompany.trim(),
      sellerDomain: normalizeSellerDomain(draft.sellerDomain),
      productContext: draft.productContext.trim(),
    }

    onSellerResearchProfileChange(nextProfile)
    setStatus("success")
    setMessage("Selling context saved. Account, opportunity, and call setup research will prefill from these fields.")
  }

  const handleReset = () => {
    clearPendingLookup()
    lookupSequenceRef.current += 1
    setDraft(sellerResearchProfile)
    setStatus("idle")
    setMessage("Selling context changes reset.")
  }

  return (
    <Card>
          <CardHeader>
        <div>
          <CardTitle>Selling context</CardTitle>
          <CardDescription>Used to prefill Seller Research across account, opportunity, and call setup</CardDescription>
        </div>
        {hasChanges ? (
          <CardAction>
            <p className="text-sm text-muted-foreground" aria-live="polite">Unsaved changes</p>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-4">
        {!hasSavedOpenAiKey ? (
          <div className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 sm:flex-row sm:items-center sm:justify-between" role="alert">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CircleAlertIcon className="size-4 text-destructive" />
                <p className="text-sm font-medium text-destructive">OpenAI key required for domain refresh</p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                You can edit these fields manually, but domain-based updates need the workspace OpenAI key.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full gap-2 sm:w-fit" onClick={onOpenSettings}>
              <KeyRoundIcon />
              Open settings
            </Button>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="seller-profile-domain">Your company domain</Label>
            <Input
              id="seller-profile-domain"
              value={draft.sellerDomain}
              placeholder="e.g. salesframe.ai"
              onChange={(event) => handleDomainChange(event.currentTarget.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="seller-profile-company">Your company</Label>
            <Input
              id="seller-profile-company"
              value={draft.sellerCompany}
              placeholder="e.g. SalesFrame"
              onChange={(event) => updateDraft("sellerCompany", event.currentTarget.value)}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="seller-profile-product-context">What you sell</Label>
          <Textarea
            id="seller-profile-product-context"
            value={draft.productContext}
            disabled={status === "loading"}
            className="min-h-24 resize-none"
            placeholder={status === "loading" ? "Looking up your company..." : "Describe what SalesFrame should connect to buyer research and live questions."}
            onChange={(event) => updateDraft("productContext", event.currentTarget.value)}
          />
          <p
            className={cn(
              "text-xs text-muted-foreground",
              status === "loading" && "text-primary",
              status === "error" && "text-destructive",
              status === "success" && "text-emerald-600"
            )}
            aria-live={status === "error" ? "assertive" : "polite"}
            role={status === "error" ? "alert" : "status"}
          >
            {message || "Changing the company domain clears this field, then SalesFrame refreshes it after you stop typing."}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button className="w-full gap-2 sm:w-auto" disabled={!canSave || !hasChanges} onClick={handleSave}>
            <CheckCircle2Icon />
            Save selling context
          </Button>
          <Button className="w-full sm:w-auto" variant="outline" disabled={!hasChanges && status !== "loading"} onClick={handleReset}>
            Reset changes
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function WorkspaceSwitchSkeleton({
  workspace,
}: {
  workspace: WorkspaceNavItem
}) {
  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200 grid gap-4" aria-busy="true" aria-live="polite">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <Building2Icon className="size-5" />
            </div>
            <div className="min-w-0">
              <CardDescription>Switching workspace</CardDescription>
              <CardTitle className="text-2xl">{workspace.name}</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Give us a moment. We are bringing over the accounts, calls, and playbooks for this workspace.
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-56" />
          </CardHeader>
          <CardContent className="grid gap-3">
            <Skeleton className="h-64 rounded-lg" />
            <div className="grid gap-3">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="grid gap-3">
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-6 w-44" />
            </CardHeader>
            <CardContent className="grid gap-3">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function PageTransitionSkeleton({
  activeView,
}: {
  activeView: string
}) {
  const label = viewLabels[activeView] ?? "Workspace"

  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200 grid gap-4" aria-busy="true" aria-live="polite" data-testid="page-transition-skeleton">
      <div className="flex items-center justify-between gap-3">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-20" />
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-lg" />
            <div className="grid gap-2">
              <Skeleton className="h-6 w-48" />
              <span className="sr-only">Loading {label}</span>
            </div>
          </div>
        </div>
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-3 rounded-lg bg-muted/30 p-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-64 rounded-lg" />
          <div className="grid gap-2">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        </div>
        <div className="grid gap-3 rounded-lg bg-muted/30 p-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

function WorkspaceStateView({
  activeView,
  message,
  state,
  onCreateAccount,
  onNavigate,
  onRetry,
}: {
  activeView: string
  message?: string
  state: Exclude<WorkspaceDataState, "ready">
  onCreateAccount: () => void
  onNavigate: (view: string) => void
  onRetry: () => void
}) {
  type WorkspaceStateBaseConfig = {
    title: string
    body: string
    icon: React.ReactNode
  }
  type WorkspaceStateActionConfig = WorkspaceStateBaseConfig & {
    primaryLabel: string
    primaryAction: () => void
    secondaryLabel: string
    secondaryAction: () => void
  }
  const stateConfig: {
    loading: WorkspaceStateBaseConfig
    empty: WorkspaceStateActionConfig
    error: WorkspaceStateActionConfig
    "permission-denied": WorkspaceStateActionConfig
  } = {
    loading: {
      title: "Getting this workspace ready",
      body: "We are loading the accounts, opportunities, calls, and playbooks that belong here.",
      icon: <Clock3Icon className="size-5" />,
    },
    empty: {
      title: "Nothing here yet",
      body: "Start with one account. SalesFrame will build the selling context around it as calls and opportunities come in.",
      icon: <Building2Icon className="size-5" />,
      primaryLabel: "Create account",
      primaryAction: onCreateAccount,
      secondaryLabel: "Import data",
      secondaryAction: () => onNavigate("profile-account"),
    },
    error: {
      title: "This workspace needs another moment",
      body: "Give it another try. If it keeps happening, settings can help confirm the connection is still in shape.",
      icon: <CircleAlertIcon className="size-5" />,
      primaryLabel: "Try again",
      primaryAction: onRetry,
      secondaryLabel: "Open settings",
      secondaryAction: () => onNavigate("settings"),
    },
    "permission-denied": {
      title: "This workspace is out of reach",
      body: "You are signed in, but this workspace is not available to your account. Check settings or switch back to a workspace you can access.",
      icon: <ShieldCheckIcon className="size-5" />,
      primaryLabel: "Open settings",
      primaryAction: () => onNavigate("settings"),
      secondaryLabel: "Open account",
      secondaryAction: () => onNavigate("profile-account"),
    },
  }
  const config = stateConfig[state]
  const actionConfig =
    state === "empty" || state === "error" || state === "permission-denied"
      ? stateConfig[state]
      : null
  const body = state === "error" && message ? message : config.body
  const workspaceMoment: Record<Exclude<WorkspaceDataState, "ready">, string> = {
    loading: "SalesFrame is gathering this workspace.",
    empty: "You have a clean start.",
    error: "SalesFrame is ready to try again.",
    "permission-denied": "This workspace is not available here.",
  }

  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200 grid min-h-[calc(100svh-9rem)] place-items-center">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              {config.icon}
            </div>
            <div className="min-w-0">
              <CardTitle className="text-2xl">{config.title}</CardTitle>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {actionConfig ? (
            <div className="grid gap-3 md:grid-cols-3">
              <ContextTile icon={<TargetIcon />} label="You are here" value={viewLabels[activeView] ?? "Workspace"} />
              <ContextTile icon={state === "empty" ? <Building2Icon /> : <DatabaseIcon />} label="What is happening" value={workspaceMoment[state]} />
              <ContextTile icon={state === "empty" ? <PlusIcon /> : <ShieldCheckIcon />} label="Best next move" value={actionConfig.primaryLabel} />
            </div>
          ) : (
            <div className="grid gap-3 rounded-lg bg-muted/30 p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Skeleton className="h-20 rounded-lg" />
                <Skeleton className="h-20 rounded-lg" />
                <Skeleton className="h-20 rounded-lg" />
              </div>
              <Skeleton className="h-36 rounded-lg" />
            </div>
          )}
          {actionConfig ? (
            <div className="flex flex-wrap gap-2">
              <Button className="gap-2" onClick={actionConfig.primaryAction}>
                {actionConfig.icon}
                {actionConfig.primaryLabel}
              </Button>
              <Button variant="outline" onClick={actionConfig.secondaryAction}>
                {actionConfig.secondaryLabel}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground" role="status">
              A few moving pieces are coming together. SalesFrame will bring you in when the workspace is ready.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SettingsView({
  activeView,
  bulkImportStatus,
  isWorkspaceOwner,
  workspaceId,
  keyStatusMessage,
  savedKeyState,
  onKeySaved,
  onSavedKeyStateChange,
  onViewImportStatus,
}: {
  activeView: string
  bulkImportStatus: BulkImportStatusResponse | null
  isWorkspaceOwner: boolean
  workspaceId: string
  keyStatusMessage: string
  savedKeyState: SavedOpenAiKeyState | null
  onKeySaved: () => void
  onSavedKeyStateChange: (state: SavedOpenAiKeyState | null) => void
  onViewImportStatus: () => void
}) {
  const [apiKey, setApiKey] = React.useState("")
  const [isSavingKey, setIsSavingKey] = React.useState(false)
  const [saveMessage, setSaveMessage] = React.useState("")
  const [saveMessageTone, setSaveMessageTone] = React.useState<"success" | "error">("success")
  const [captureSettings, setCaptureSettings] = React.useState<CaptureSettings>(() => readCaptureSettings(workspaceId))
  const [captureSettingsMessage, setCaptureSettingsMessage] = React.useState("")
  const [captureSettingsTone, setCaptureSettingsTone] = React.useState<"success" | "warning">("success")
  const [sessionPolicy, setSessionPolicy] = React.useState<WorkspaceSessionPolicy | null>(null)
  const [sessionPolicyMessage, setSessionPolicyMessage] = React.useState("")
  const [sessionPolicyTone, setSessionPolicyTone] = React.useState<"success" | "error">("success")
  const [sessionPolicySaving, setSessionPolicySaving] = React.useState(false)
  const [removeKeyDialogOpen, setRemoveKeyDialogOpen] = React.useState(false)
  const [removeKeyError, setRemoveKeyError] = React.useState("")
  const hasApiKey = apiKey.trim().length > 0
  const hasSavedKey = savedKeyState !== null
  const pausedEnrichmentCount = bulkImportStatus?.pausedMissingKeyCount ?? 0

  React.useEffect(() => {
    setCaptureSettings(readCaptureSettings(workspaceId))
    setCaptureSettingsMessage("")
    setCaptureSettingsTone("success")
  }, [workspaceId])

  React.useEffect(() => {
    let cancelled = false

    setSessionPolicy(null)
    setSessionPolicyMessage("")
    setSessionPolicyTone("success")

    if (!workspaceId) return

    getWorkspaceSessionPolicy(workspaceId)
      .then((policy) => {
        if (cancelled) return
        setSessionPolicy(policy)
      })
      .catch((caughtError: unknown) => {
        if (cancelled) return
        setSessionPolicyMessage(getUserFacingErrorMessage(caughtError, "Session timeout needs another check."))
        setSessionPolicyTone("error")
      })

    return () => {
      cancelled = true
    }
  }, [workspaceId])

  React.useEffect(() => {
    let cancelled = false

    if (!workspaceId) {
      onSavedKeyStateChange(null)
      return
    }

    getOpenAiKeyStatus(workspaceId)
      .then((status) => {
        if (cancelled) return

        onSavedKeyStateChange(mapOpenAiKeyStatusToSavedState(status))
      })
      .catch((caughtError: unknown) => {
        if (cancelled) return

        setSaveMessageTone("error")
        setSaveMessage(getUserFacingErrorMessage(caughtError, "OpenAI key status needs another check."))
      })

    return () => {
      cancelled = true
    }
  }, [onSavedKeyStateChange, workspaceId])

  const handleSaveKey = async () => {
    if (!hasApiKey) return

    setIsSavingKey(true)
    setSaveMessage("")
    setSaveMessageTone("success")

    try {
      if (!workspaceId) throw new Error("Select a workspace before saving an OpenAI key.")

      const status = await saveOpenAiKey(apiKey, workspaceId)
      const nextState =
        mapOpenAiKeyStatusToSavedState(status) ?? {
          maskedKey: status.maskedKey ?? "Saved key",
          fingerprint: status.fingerprint ?? "UNKNOWN",
          savedAt: status.savedAt ?? new Date().toISOString(),
          storageMode: "server-encrypted",
        }

      onSavedKeyStateChange(nextState)
      onKeySaved()
      setApiKey("")
      setSaveMessageTone("success")
      setSaveMessage("OpenAI key connection saved.")
    } catch (caughtError: unknown) {
      setSaveMessageTone("error")
      setSaveMessage(getUserFacingErrorMessage(caughtError, "OpenAI key connection needs another save attempt."))
    } finally {
      setIsSavingKey(false)
    }
  }

  const handleRemoveKey = async () => {
    setIsSavingKey(true)
    setSaveMessage("")
    setSaveMessageTone("success")
    setRemoveKeyError("")

    try {
      if (!workspaceId) throw new Error("Select a workspace before removing an OpenAI key.")

      await deleteOpenAiKey(workspaceId)
      onSavedKeyStateChange(null)
      setApiKey("")
      setRemoveKeyDialogOpen(false)
      setSaveMessageTone("success")
      setSaveMessage("OpenAI key connection removed.")
    } catch (caughtError: unknown) {
      const message = getUserFacingErrorMessage(caughtError, "OpenAI key connection needs another remove attempt.")
      setRemoveKeyError(message)
      setSaveMessageTone("error")
      setSaveMessage(message)
    } finally {
      setIsSavingKey(false)
    }
  }

  const handleCaptureSettingChange = (id: keyof CaptureSettings, checked: boolean) => {
    const nextSettings = {
      ...captureSettings,
      [id]: checked,
    }

    setCaptureSettings(nextSettings)
    const didSave = saveCaptureSettings(workspaceId, nextSettings)
    setCaptureSettingsTone(didSave ? "success" : "warning")
    setCaptureSettingsMessage(
      didSave
        ? "Capture preference saved for this workspace on this browser."
        : "Preference changed for now. It may reset after this browser closes."
    )
  }

  const handleSessionPolicyChange = async (value: string) => {
    if (!workspaceId || !isWorkspaceOwner) return

    const idleTimeoutSeconds = value === "never" ? null : Number(value)

    setSessionPolicySaving(true)
    setSessionPolicyMessage("")
    setSessionPolicyTone("success")

    try {
      const policy = await saveWorkspaceSessionPolicy(workspaceId, idleTimeoutSeconds)
      setSessionPolicy(policy)
      setSessionPolicyMessage("Session timeout saved for this workspace.")
    } catch (caughtError: unknown) {
      setSessionPolicyTone("error")
      setSessionPolicyMessage(getUserFacingErrorMessage(caughtError, "Session timeout needs another save attempt."))
    } finally {
      setSessionPolicySaving(false)
    }
  }

  const keyFeedbackMessage = saveMessage || keyStatusMessage
  const keyFeedbackIsError = saveMessage ? saveMessageTone === "error" : Boolean(keyStatusMessage)
  const sessionPolicyValue =
    sessionPolicy?.idle_timeout_seconds === null
      ? "never"
      : String(sessionPolicy?.idle_timeout_seconds ?? 3600)

  return (
    <div className="grid gap-4">
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{activeView === "ai" ? "OpenAI API key" : "OpenAI setup"}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="openai-api-key">OpenAI API key</Label>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <Input
                  id="openai-api-key"
                  type="password"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={apiKey}
                  placeholder="sk-proj-..."
                  onChange={(event) => {
                    setApiKey(event.currentTarget.value)
                    setSaveMessage("")
                    setSaveMessageTone("success")
                  }}
                />
                <Button type="button" className="gap-2" disabled={!hasApiKey || isSavingKey} onClick={handleSaveKey}>
                  {hasSavedKey ? <CheckCircle2Icon /> : <KeyRoundIcon />}
                  {isSavingKey ? "Saving..." : hasSavedKey ? "Replace key" : "Save key"}
                </Button>
                {hasSavedKey ? (
                  <Button
                    variant="outline"
                    className="gap-2"
                    disabled={isSavingKey}
                    onClick={() => {
                      setRemoveKeyError("")
                      setRemoveKeyDialogOpen(true)
                    }}
                  >
                    <Trash2Icon />
                    Remove
                  </Button>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                Your key powers live questions, notes, enrichment, and post-call outputs for this workspace. SalesFrame handles live transcription separately.
              </p>
            </div>

            <div
              className={cn(
                "grid gap-3 rounded-lg p-4",
                hasSavedKey ? "bg-emerald-500/10" : "bg-muted/30"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {hasSavedKey ? (
                      <CheckCircle2Icon className="size-4 text-emerald-600" />
                    ) : (
                      <KeyRoundIcon className="size-4 text-muted-foreground" />
                    )}
                    <p className="text-sm font-medium">
                      {hasSavedKey ? "OpenAI key connected" : "OpenAI key not connected"}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {hasSavedKey
                      ? "AI-assisted workflows can use this connection for enabled features."
                      : "Add your key to power live questions, notes, enrichment, and post-call outputs for this workspace."}
                  </p>
                </div>
              </div>

              {hasSavedKey ? (
                <div className="grid gap-2 rounded-lg bg-background/70 p-3 text-sm md:grid-cols-3">
                  <ContextRow label="Masked key" value={savedKeyState.maskedKey} />
                  <ContextRow label="Fingerprint" value={savedKeyState.fingerprint} />
                  <ContextRow label="Saved" value={formatSavedAt(savedKeyState.savedAt)} />
                </div>
              ) : null}

              {keyFeedbackMessage ? (
                <p
                  className={cn("text-sm", keyFeedbackIsError ? "text-destructive" : "text-muted-foreground")}
                  aria-live={keyFeedbackIsError ? "assertive" : "polite"}
                  role={keyFeedbackIsError ? "alert" : "status"}
                >
                  {keyFeedbackMessage}
                </p>
              ) : null}
            </div>

            {pausedEnrichmentCount > 0 ? (
              <div className="rounded-lg bg-muted/30 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">AI enrichment paused while waiting for an OpenAI key</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {pausedEnrichmentCount} accounts are ready to research once this workspace has a saved key.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={onViewImportStatus}>
                    View import status
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              {[
                ["Live guidance", "Next best question and methodology gap detection during calls."],
                ["Deepgram live transcript", "Speaker-aware transcript turns for captured calls."],
                ["AI notes", "Structured discovery notes and evidence snippets."],
                ["Post-call outputs", "Follow-up email, next-call plan, and account/opportunity field updates."],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-muted/30 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <SparklesIcon className="size-4 text-muted-foreground" />
                    <p className="text-sm font-medium">{label}</p>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Dialog
          open={removeKeyDialogOpen && hasSavedKey}
          onOpenChange={(nextOpen) => {
            if (!nextOpen && !isSavingKey) {
              setRemoveKeyDialogOpen(false)
              setRemoveKeyError("")
            }
          }}
        >
          <DialogContent
            className="max-sm:max-w-[calc(100%-0.75rem)] max-sm:[&_[data-slot=button]]:min-h-11 max-sm:[&_[data-slot=button]]:px-4 sm:max-w-md"
            onEscapeKeyDown={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
            onPointerDownOutside={(event) => event.preventDefault()}
          >
            <DialogHeader>
              <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <KeyRoundIcon className="size-5" />
              </div>
              <DialogTitle>Remove OpenAI key?</DialogTitle>
              <DialogDescription>
                SalesFrame will stop using this workspace key for live questions, notes, enrichment, and post-call outputs until a new key is saved.
              </DialogDescription>
            </DialogHeader>
            {savedKeyState ? (
              <div className="grid gap-2 rounded-lg bg-muted/30 p-3 text-sm">
                <ContextRow label="Masked key" value={savedKeyState.maskedKey} />
                <ContextRow label="Fingerprint" value={savedKeyState.fingerprint} />
              </div>
            ) : null}
            {removeKeyError ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                {removeKeyError}
              </div>
            ) : null}
            <DialogActions
              cancelDisabled={isSavingKey}
              onCancel={() => {
                setRemoveKeyDialogOpen(false)
                setRemoveKeyError("")
              }}
              primaryAction={
                <Button variant="destructive" className="gap-2" disabled={isSavingKey} onClick={handleRemoveKey}>
                  <Trash2Icon />
                  {isSavingKey ? "Removing..." : "Remove key"}
                </Button>
              }
            />
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader>
            <CardTitle>Session timeout</CardTitle>
            <CardDescription>
              Choose how long this workspace stays open when SalesFrame is quiet.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="workspace-session-timeout">Auto sign-out after inactivity</Label>
              <Select
                value={sessionPolicyValue}
                disabled={!isWorkspaceOwner || sessionPolicySaving || !workspaceId}
                onValueChange={handleSessionPolicyChange}
              >
                <SelectTrigger id="workspace-session-timeout" className="w-full sm:max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workspaceSessionTimeoutOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                SalesFrame warns before signing out and treats active recording as presence. Choosing Never turns off idle sign-out for this workspace, but a fresh sign-in is still required after 24 hours.
              </p>
            </div>

            {!isWorkspaceOwner ? (
              <p className="text-sm text-muted-foreground">
                Workspace owners can change this setting.
              </p>
            ) : null}

            {sessionPolicyMessage ? (
              <p
                className={cn("text-sm", sessionPolicyTone === "error" ? "text-destructive" : "text-muted-foreground")}
                aria-live={sessionPolicyTone === "error" ? "assertive" : "polite"}
                role={sessionPolicyTone === "error" ? "alert" : "status"}
              >
                {sessionPolicyMessage}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{activeView === "retention" ? "Retention" : activeView === "capture" ? "Audio capture" : "Capture settings"}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {[
              {
                id: "browserTab" as const,
                title: "Two-channel mic + system audio",
                body: "Desktop capture can listen to shared meeting, app, window, tab, or system audio alongside your microphone when the browser supports it.",
                configurable: true,
              },
              {
                id: "inPersonMic" as const,
                title: "One-channel microphone capture",
                body: "Phone or laptop microphone capture for in-person, mobile, or speakerphone calls where SalesFrame hears everyone through one stream.",
                configurable: true,
              },
            ].map((item) => (
              <div key={item.id} className="flex flex-col gap-3 rounded-lg bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Label htmlFor={`capture-setting-${item.id}`} className="text-sm font-medium">{item.title}</Label>
                  <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                </div>
                <Switch
                  id={`capture-setting-${item.id}`}
                  aria-label={`Toggle ${item.title}`}
                  checked={captureSettings[item.id]}
                  disabled={!item.configurable}
                  onCheckedChange={(checked) => handleCaptureSettingChange(item.id, checked)}
                />
              </div>
            ))}
            <p
              className={cn(
                "text-sm",
                captureSettingsTone === "warning" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"
              )}
              aria-live={captureSettingsTone === "warning" ? "assertive" : "polite"}
              role={captureSettingsTone === "warning" ? "alert" : "status"}
            >
              {captureSettingsMessage ||
                "Capture preferences are saved in this browser for the active workspace."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SectionView({
  activeView,
  onNavigate,
}: {
  activeView: string
  onNavigate: (view: string) => void
}) {
  const label = viewLabels[activeView] ?? "Workspace"
  const cards = sectionCards[activeView] ?? []

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{cards.length ? label : "Let's get you back on track"}</CardTitle>
          <CardDescription>
            {cards.length
              ? "Use this section to keep the workspace focused and easy to navigate."
              : "That page is not in the current workspace menu. Head back to Home or open the call cockpit."}
          </CardDescription>
          <CardAction>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-2" onClick={() => onNavigate("home")}>
                <LayoutDashboardIcon />
                Home
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => onNavigate("workspace")}>
                <PhoneCallIcon />
                Call cockpit
              </Button>
            </div>
          </CardAction>
        </CardHeader>
      </Card>
      {cards.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Card key={card.title}>
              <CardHeader>
                <CardDescription>{card.kicker}</CardDescription>
                <CardTitle>{card.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{card.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-t pt-3 first:border-t-0 first:pt-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm leading-relaxed">{value}</p>
    </div>
  )
}

function EditableTextField({
  id,
  label,
  value,
  onChange,
  onBlur,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        onBlur={onBlur}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </div>
  )
}

function CurrencySelect({
  id,
  label = "Currency",
  value,
  onChange,
}: {
  id: string
  label?: string
  value: CurrencyCode
  onChange: (value: CurrencyCode) => void
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={(nextValue) => onChange(normalizeCurrencyCode(nextValue))}>
        <SelectTrigger id={id} className="w-full">
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
  )
}

function TimezoneSelect({
  id,
  label = "Timezone",
  value,
  onChange,
}: {
  id: string
  label?: string
  value: string
  onChange: (value: string) => void
}) {
  const options = React.useMemo(() => {
    if (!value || timezoneOptions.some((timezone) => timezone.value === value)) {
      return timezoneOptions
    }

    return [{ value, label: value }, ...timezoneOptions]
  }, [value])

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((timezone) => (
            <SelectItem key={timezone.value} value={timezone.value}>
              {timezone.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function EditableTextareaField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={value}
        placeholder={placeholder}
        className="min-h-24 resize-none"
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </div>
  )
}

function ContextTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg bg-muted/30 p-3">
      <div className="mb-3 flex size-8 items-center justify-center rounded-lg bg-background/70 text-muted-foreground">
        {icon}
      </div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}

function formatTime(value: number) {
  const hours = Math.floor(value / 3600)
  const minutes = String(Math.floor((value % 3600) / 60)).padStart(2, "0")
  const seconds = String(value % 60).padStart(2, "0")
  if (hours > 0) return `${hours}:${minutes}:${seconds}`

  return `${minutes}:${seconds}`
}

export default App
