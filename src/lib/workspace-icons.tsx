import {
  BanknoteIcon,
  BriefcaseBusinessIcon,
  Building2Icon,
  ChartNoAxesCombinedIcon,
  FactoryIcon,
  Globe2Icon,
  HandshakeIcon,
  HospitalIcon,
  LandmarkIcon,
  NetworkIcon,
  RocketIcon,
  SchoolIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StoreIcon,
  TargetIcon,
  type LucideIcon,
} from "lucide-react"

export const defaultWorkspaceIconId = "building-2"

export const workspaceIconOptions = [
  { id: "building-2", label: "Workspace", icon: Building2Icon },
  { id: "briefcase-business", label: "Business", icon: BriefcaseBusinessIcon },
  { id: "globe-2", label: "Global", icon: Globe2Icon },
  { id: "landmark", label: "Enterprise", icon: LandmarkIcon },
  { id: "rocket", label: "Growth", icon: RocketIcon },
  { id: "target", label: "Pipeline", icon: TargetIcon },
  { id: "chart-no-axes-combined", label: "Revenue", icon: ChartNoAxesCombinedIcon },
  { id: "handshake", label: "Partners", icon: HandshakeIcon },
  { id: "network", label: "Network", icon: NetworkIcon },
  { id: "factory", label: "Industry", icon: FactoryIcon },
  { id: "store", label: "Retail", icon: StoreIcon },
  { id: "school", label: "Education", icon: SchoolIcon },
  { id: "hospital", label: "Health", icon: HospitalIcon },
  { id: "banknote", label: "Finance", icon: BanknoteIcon },
  { id: "shield-check", label: "Trust", icon: ShieldCheckIcon },
  { id: "sparkles", label: "New market", icon: SparklesIcon },
] as const

export type WorkspaceIconId = (typeof workspaceIconOptions)[number]["id"]

const workspaceIconMap = new Map<string, LucideIcon>(
  workspaceIconOptions.map((option) => [option.id, option.icon])
)

export function normalizeWorkspaceIconId(value?: string | null): WorkspaceIconId {
  return workspaceIconMap.has(value ?? "")
    ? (value as WorkspaceIconId)
    : defaultWorkspaceIconId
}

export function WorkspaceIconGlyph({
  className = "size-4",
  iconId,
}: {
  className?: string
  iconId?: string | null
}) {
  const Icon = workspaceIconMap.get(normalizeWorkspaceIconId(iconId)) ?? Building2Icon

  return <Icon aria-hidden="true" className={className} />
}
