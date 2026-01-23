---
description: How to create skeleton loading states for new components
---

# Skeleton Loading States

All new components that load data or depend on user preferences MUST include skeleton loading states.

## Steps to Add Skeletons

1. **Create the skeleton component** in `components/ui/skeleton.tsx`:
   ```tsx
   export function MyComponentSkeleton() {
       return (
           <div className="...">
               <Skeleton className="h-X w-Y" />
               // Match the structure of your real component
           </div>
       );
   }
   ```

2. **Import and use in your component**:
   ```tsx
   import { MyComponentSkeleton } from "@/components/ui/skeleton";

   export function MyComponent() {
       const { isLoading } = useDataHook();
       
       if (isLoading) {
           return <MyComponentSkeleton />;
       }
       
       return <div>Real content</div>;
   }
   ```

## Rules

- **NO `Math.random()`** - Use fixed values to avoid hydration mismatch
- **Match the real component layout** - Skeleton should have similar dimensions
- **Use `animate-pulse`** - Already included in base `Skeleton` component
- **Keep it simple** - Just show the structure, not details

## Existing Skeletons

| Component | Skeleton |
|-----------|----------|
| AppSidebar | `SidebarSkeleton` |
| ProductionView | `ProductionViewSkeleton` |
| GanttToolbar | `GanttToolbarSkeleton` |
| GanttChart | `GanttChartSkeleton` |

## Example Usage

```tsx
// In component file
import { SomePageSkeleton } from "@/components/ui/skeleton";

export function SomePage() {
    const { data, isLoading } = useData();
    
    if (isLoading) return <SomePageSkeleton />;
    
    return <div>{/* Real content */}</div>;
}
```
