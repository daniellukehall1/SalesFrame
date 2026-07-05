# SalesFrame Animation Component Audit

Last reviewed: 2026-07-05

## Rule

SalesFrame uses default shadcn/Radix motion first. Animate UI may be used only when a component-level interaction genuinely improves clarity. If neither default shadcn nor Animate UI clearly helps, the component stays static.

Do not add:

- Custom motion CSS variables such as `--sf-motion-*` or `--sf-ease-*`.
- Local keyframes.
- Permanent shimmer.
- Gradient text masking.
- Text-shadow flashes.
- Decorative pulses.
- Bounce, ping, spin, elastic movement, or large hover scale.
- Nested sidebar fade or slide choreography.

## Approved Motion Inventory

| Surface | Files | Current motion | Decision |
| --- | --- | --- | --- |
| Buttons | `src/components/ui/button.tsx` | Tailwind transition on colour, border, shadow, opacity, and minimal press transform. | Keep. Shared shadcn-style feedback. |
| Inputs and textareas | `src/components/ui/input.tsx`, `src/components/ui/textarea.tsx` | Tailwind transition on colour, border, shadow, opacity. | Keep. Form focus and validation feedback only. |
| Select | `src/components/ui/select.tsx` | Trigger transition; Radix content uses `animate-in/out`, fade, zoom, side-aware slide. | Keep. Default shadcn/Radix menu behaviour. |
| Dropdown menu | `src/components/ui/dropdown-menu.tsx` | Radix content uses `animate-in/out`, fade, zoom, side-aware slide. | Keep. Default shadcn/Radix menu behaviour. |
| Context menu | `src/components/ui/context-menu.tsx` | Radix content uses `animate-in/out`, fade, zoom, side-aware slide. | Keep. Default shadcn/Radix menu behaviour. |
| Dialog | `src/components/ui/dialog.tsx` | Overlay fade; content fade/zoom. | Keep. Default shadcn/Radix dialog behaviour. |
| Sheet | `src/components/ui/sheet.tsx` | Overlay fade; side-aware sheet slide. | Keep. Default shadcn/Radix sheet behaviour. |
| Popover | `src/components/ui/popover.tsx` | Radix content fade/zoom. | Keep. Default shadcn/Radix popover behaviour. |
| Tooltip | `src/components/ui/tooltip.tsx` | Radix content fade/zoom and side-aware slide. | Keep. Default shadcn/Radix tooltip behaviour. |
| Tabs | `src/components/ui/tabs.tsx` | Soft colour, shadow, opacity, and line indicator opacity transitions. | Keep. No panel animation. |
| Switch | `src/components/ui/switch.tsx` | Thumb transform and state colour transition. | Keep. Required to communicate switch state. |
| Progress | `src/components/ui/progress.tsx` | Bar transform transition. | Keep. Progress should move smoothly when value changes. |
| Skeleton | `src/components/ui/skeleton.tsx` | shadcn `animate-pulse`. | Keep. Only approved pulse in the app. |
| Message | `src/components/ui/message.tsx` | New message `animate-in`, fade, short upward slide. | Keep. Default shadcn message entry; avoid repeated animation on turn updates. |
| Badge | `src/components/ui/badge.tsx` | State transition for colour, border, shadow, opacity. | Keep. No decorative movement. |
| Breadcrumb | `src/components/ui/breadcrumb.tsx` | Text colour and opacity transition. | Keep. Subtle link feedback. |
| Bubble | `src/components/ui/bubble.tsx` | Colour, border, opacity transition; nested button/link transition-colors. | Keep. Message action feedback only. |
| Date picker clear button | `src/components/ui/date-picker.tsx` | Colour and opacity transition. | Keep. Small control feedback. |
| Sidebar shell | `src/components/ui/sidebar.tsx` | Stock shadcn desktop width and position transitions. | Keep. Do not add nested fade/slide. |
| Sidebar accounts | `src/components/nav-projects.tsx` | Chevron rotation only. Account/opportunity list reveal is direct. | Keep. This replaced the clunky custom fade/slide. |
| Sidebar playbooks | `src/components/nav-main.tsx` | Chevron rotation only. Submenu reveal is direct. | Keep. This replaced the clunky custom fade/slide. |
| Workspace switcher and user menu | `src/components/workspace-switcher.tsx`, `src/components/nav-user.tsx` | Uses shared dropdown/sidebar primitives. | Keep through primitives only. |
| Account logos | `src/components/account-logo-avatar.tsx` | Opacity transition from initials/fallback to resolved logo. | Keep. Prevents broken-logo flash. |
| Auth links | `src/components/login-form.tsx`, `src/components/signup-form.tsx` | Link colour, shadow, opacity transition. | Keep. Keyboard and hover feedback. |
| Marketing homepage | `src/components/marketing-landing-page.tsx` | Video opacity and action fade/short translate, disabled for reduced motion. | Keep. Public homepage is the only marketing surface. No app-wide decorative motion. |
| CSV import | `src/components/csv-import-dialog.tsx` | No icon pulse or spinner. Uses progress/copy states only. | Keep static. |
| Global search rows | `src/App.tsx` | Row colour and opacity transitions. | Keep. Clickable-row feedback only. |
| Playbook multiselect | `src/App.tsx` | Chevron rotation and option row colour transitions. | Keep. Dropdown itself uses shared Popover. |
| Opportunity/account table rows | `src/App.tsx` | Row colour and opacity transitions. | Keep. Clickable-row feedback only. |
| Live question | `src/App.tsx` | One `animate-in`, fade, short slide when question identity changes. | Keep. No shimmer, gradient, pulse, or looping. |
| Live capture indicators | `src/App.tsx` | Static colour/status changes. | Keep. No pulse. |
| Call replay timeline | `src/App.tsx` | Static marker hover ring. | Keep. No marker lift or scale. |
| Page/workspace loading | `src/App.tsx` | shadcn Skeleton plus one short `animate-in` for the loaded state. | Keep. No full-page slide transitions. |

## Animate UI Position

No Animate UI component is installed or needed after this audit. The app currently gets the required calm behaviour from shadcn/Radix primitives. If a future interaction needs Animate UI, document the component name, the reason it improves clarity, and the specific surface before adding it.

## Verification Checklist

Before adding or changing motion:

1. Search for `animate-`, `transition`, `duration-`, `ease-`, `@keyframes`, `sf-motion`, and `sf-ease`.
2. Confirm the motion appears in this audit.
3. Confirm reduced-motion remains respected.
4. Confirm no new decorative pulse, shimmer, spin, bounce, or scale was introduced.
5. Run the production contract test.
