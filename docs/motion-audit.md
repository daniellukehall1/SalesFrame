# SalesFrame Motion Audit

Last reviewed: 2026-07-05

## Motion Sources

SalesFrame should only use:

- shadcn/Radix primitives with `tw-animate-css` entry and exit classes.
- shadcn-style Tailwind defaults for hover, focus, press, layout, progress, and opacity changes.
- Animate UI components only where the component improves continuity without adding decorative movement.

SalesFrame should not use local keyframes, custom animation utility classes, custom motion CSS variables, permanent shimmer, text-shadow flashes, large hover scale, bounce, elastic motion, decorative animation, or pulsing icons outside the shadcn Skeleton component.

## Current Decisions

| Surface | Approved behavior |
| --- | --- |
| Buttons | Fast color, shadow, opacity, and one-pixel press feedback using shared shadcn button classes. |
| Inputs, selects, textareas, switches | Fast focus, validation, and state transitions using shadcn-style transition utilities. |
| Dialogs and sheets | shadcn/Radix overlay and content fade/zoom or side-aware slide using default `tw-animate-css` classes. |
| Dropdowns, context menus, popovers, tooltips | shadcn/Radix fade/zoom with side-aware slide using default `tw-animate-css` classes. |
| Tabs | Soft active-state transitions only; no panel choreography unless implemented through shadcn/Animate UI. |
| Sidebar expand/collapse | Stock shadcn sidebar timing for desktop width changes. Nested account/playbook sections open directly; only the chevron rotates. |
| Workspace and page loading | shadcn Skeleton pulse and short shadcn `animate-in` content entry. |
| Live question | One shadcn `animate-in fade-in` with short slide when the question changes. No shimmer or gradient text masking. |
| Transcript messages | shadcn message layout with short `animate-in fade-in` entry for new messages only. |
| Audio and import activity | Static status changes and progress. No pulsing decorative icons. |
| Account logos | Opacity transition from fallback to resolved logo. |
| Marketing homepage | No custom keyframes; typed cursor is static, and video/copy transitions use plain Tailwind durations. |

## Regression Guards

The production contract test rejects:

- Local `@keyframes`.
- `--sf-motion-*` and `--sf-ease-*` custom motion variables.
- SalesFrame-specific animation helpers such as `sf-question-enter`, `sf-live-breathe`, and old pulse/highlight classes.
- Gradient text masking and text-shadow flashes in the live question.
- Large hover scale on replay markers.
- Fade/slide animation on nested sidebar account or playbook sections.
- `animate-pulse` outside the shared shadcn Skeleton.

When adding a new animated interaction, first try the existing shadcn primitive. If that is not enough, use Animate UI only if the movement makes the product easier to understand. If neither fits, keep the surface static.
