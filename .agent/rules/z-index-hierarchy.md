---
description: Establishes a consistent z-index hierarchy for the Reyper XYZ platform to prevent overlapping and visibility issues.
---

# Z-Index Hierarchy Strategy

To maintain a clean and predictable UI where modals properly obscure background elements and interactive components remain functional, follow this z-index layering system.

## Layer Definitions

| Z-Index Range | Layer Name | Examples | Description |
| :--- | :--- | :--- | :--- |
| **11000+** | **Super Portals** | `CustomDropdown` | Elements that must remain visible even when opened inside a high-priority modal. |
| **10002** | **Floating Portals** | `Popover`, `Select` | Standard dropdowns and popups that should appear above modal content. |
| **10001** | **Modal Content** | `DialogContent`, `AlertDialogContent` | The foreground content of modals and alerts. |
| **10000** | **Modal Underlay** | `DialogOverlay`, `AlertDialogOverlay` | The dark backdrop that obscures the rest of the application. |
| **9999** | **Main Navigation** | `AppSidebar` (Fixed/Mobile) | Persistent app-level navigation that should be above most content but below modals. |
| **1000 - 9998** | **Side Panels** | evaluation-list-sidebar | Features-specific sidebars that slide over the main workspace. |
| **101 - 999** | **In-Page Nav** | `AppNavbar` (Sticky) | Top navigation and category headers within the main content area. |
| **100** | **Chart Overlays** | Gantt Tooltips, Context Menus | Interactive elements that appear on top of complex visualizations. |
| **1 - 99** | **Workspace** | Gantt SVG, Table headers | Interactive workspace elements. |
| **0** | **Base** | Main content background | The standard page background. |

## Implementation Rules

1. **Avoid Arbitrary Values**: Never use ad-hoc values like `z-[1234]`. Always align with the established ranges.
2. **Modals cover Sidebars**: All `Dialog` and `AlertDialog` components MUST use `z-[10000]` for overlays to ensure they cover the `AppSidebar` (`z-9999`).
3. **Dropdowns in Modals**: Any custom dropdown or portal component that might be used inside a modal must have a z-index higher than `10001`.
4. **Consistency**: When creating new components with `fixed` or `absolute` positioning, reference this rule to determine its correct layer.
5. **Portals**: Use Radix UI `Portal` primitives where possible to ensure elements are rendered at the root of the DOM while maintaining these z-index rules.

---
> [!IMPORTANT]
> This hierarchy is critical for the "Evaluation Mode" in the production planner, where the main sidebar must be completely obscured by the modal backdrop.
