# Plan 008 — UI Foundation & Layout System

## 1. Objective

Set up the component library, app shell (sidebar navigation + top bar), and responsive layout system for the authenticated application.

## 2. Scope

- Install and configure shadcn/ui
- Build the authenticated app shell (sidebar + top bar)
- Role-aware navigation items
- Responsive behavior (collapsible sidebar on desktop, drawer on mobile)
- Base reusable components (page header, empty state, loading)
- Brand colors in Tailwind config

### Out of Scope

- Dark mode (deferred beyond Sprint 1)
- Individual feature pages (Assessment builder, Candidate list, etc.)
- Complex data tables or data visualization
- Animations or transitions

## 3. Prerequisites / Dependencies

- Plan 06 completed (protected layout route group)
- Plan 07 completed (RBAC, `useCurrentUser()` hook, `RoleGate` component)
- Plan 01 completed (Tailwind CSS configured)

## 4. Technical Approach

shadcn/ui is not a dependency — it copies component source into the project. This gives full control over customization without library lock-in.

The app shell follows a standard SaaS layout:
- **Sidebar** (left): logo, navigation links (role-filtered), user section at bottom
- **Top bar**: breadcrumb/page title area, quick actions, user avatar with dropdown
- **Main content**: scrollable area with consistent padding

On mobile (<768px), the sidebar becomes a sheet/drawer triggered by a hamburger button in the top bar.

## 5. Implementation Steps

1. Install shadcn/ui:
   - `npx shadcn-ui@latest init` (New York style, Tailwind, CSS variables)
   - Install components:
     ```
     npx shadcn-ui@latest add button input card avatar dropdown-menu
     npx shadcn-ui@latest add sheet separator badge tooltip
     npx shadcn-ui@latest add skeleton
     ```
2. Configure brand colors in `tailwind.config.ts`:
   - Define SelectIQ brand palette as CSS variables in `app/globals.css`:
     ```css
     :root {
       --primary: /* SelectIQ blue */;
       --primary-foreground: /* white */;
       --accent: /* secondary accent */;
       /* ...standard shadcn/ui variable set */
     }
     ```
   - Light mode only for now
3. Install `lucide-react` for icons (if not already from shadcn setup)
4. Create sidebar navigation config `constants/navigation.ts`:
   ```typescript
   export const NAV_ITEMS = [
     { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['ALL'] },
     { label: 'Assessments', href: '/assessments', icon: ClipboardCheck, roles: ['COLLEGE_ADMIN', 'RECRUITER', 'SUPER_ADMIN'] },
     { label: 'Candidates', href: '/candidates', icon: Users, roles: ['COLLEGE_ADMIN', 'RECRUITER', 'SUPER_ADMIN'] },
     { label: 'Results', href: '/results', icon: BarChart3, roles: ['ALL'] },
     { label: 'Settings', href: '/settings', icon: Settings, roles: ['COLLEGE_ADMIN', 'SUPER_ADMIN'] },
     { label: 'Admin', href: '/admin', icon: Shield, roles: ['SUPER_ADMIN'] },
   ];
   ```
5. Create `components/layout/sidebar.tsx`:
   - Logo/brand at top
   - Navigation links filtered by `useCurrentUser().role`
   - Active state highlighting (matches current pathname)
   - Collapsible on desktop (icon-only mode)
   - User info section at bottom (avatar, name, role badge)
6. Create `components/layout/top-bar.tsx`:
   - Mobile: hamburger menu button (opens sidebar as Sheet)
   - Page area: slot for breadcrumbs or page title
   - Right side: user Avatar with DropdownMenu (Profile, Settings, Sign Out)
7. Create `components/layout/app-shell.tsx`:
   - Composes sidebar + top bar + main content area
   - Handles responsive layout via CSS (not JS)
   - Sidebar state management (expanded/collapsed)
8. Update `app/(protected)/layout.tsx`:
   - Wrap with `UserProvider` (from Plan 07)
   - Render `AppShell` as the layout container
   - Fetch current user server-side, pass to provider
9. Create utility components:
   - `components/ui/page-header.tsx`:
     ```typescript
     // Props: title, description, children (action buttons slot)
     // Consistent page title + description + right-aligned actions
     ```
   - `components/ui/empty-state.tsx`:
     ```typescript
     // Props: icon, title, description, action (button)
     // Centered placeholder for pages with no data
     ```
   - `components/ui/loading.tsx`:
     ```typescript
     // Full-page spinner and inline skeleton variants
     ```
10. Create placeholder pages using new components:
    - `/app/(protected)/dashboard/page.tsx` — PageHeader + welcome card
    - `/app/(protected)/assessments/page.tsx` — PageHeader + EmptyState
    - `/app/(protected)/candidates/page.tsx` — PageHeader + EmptyState
    - `/app/(protected)/settings/page.tsx` — PageHeader + placeholder
11. Update `/app/(auth)/login/page.tsx`:
    - Apply consistent styling with shadcn Card, Button, Input components
    - Add SelectIQ logo/branding

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Setup | `components/ui/*.tsx` | shadcn/ui components |
| Modify | `tailwind.config.ts` | Brand colors |
| Modify | `app/globals.css` | CSS variables |
| Create | `constants/navigation.ts` | Nav items config |
| Create | `components/layout/sidebar.tsx` | Sidebar navigation |
| Create | `components/layout/top-bar.tsx` | Top bar |
| Create | `components/layout/app-shell.tsx` | Shell compositor |
| Modify | `app/(protected)/layout.tsx` | Use AppShell |
| Create | `components/ui/page-header.tsx` | Page header component |
| Create | `components/ui/empty-state.tsx` | Empty state component |
| Create | `components/ui/loading.tsx` | Loading states |
| Create | `app/(protected)/assessments/page.tsx` | Placeholder |
| Create | `app/(protected)/candidates/page.tsx` | Placeholder |
| Create | `app/(protected)/settings/page.tsx` | Placeholder |

## 7. Testing / Verification

- [ ] Desktop (1280px+): sidebar visible, collapsible, nav items render correctly
- [ ] Mobile (375px): sidebar hidden, hamburger menu opens drawer
- [ ] Nav items filtered by role: Student sees fewer items than CollegeAdmin
- [ ] Active nav item highlighted for current route
- [ ] User dropdown shows avatar, name, role badge
- [ ] Sign out from dropdown works (clears session, redirects to login)
- [ ] PageHeader renders consistently across all placeholder pages
- [ ] EmptyState displays correctly with icon, text, and action button
- [ ] Login page styled with shadcn components and brand colors
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: component library (shadcn/ui), layout structure, navigation config pattern
- Add to `CLAUDE.md`: "Add new nav items to `constants/navigation.ts` with role restrictions"
- Add to `docs/project-context.md`: Plan 08 completed, app shell and UI foundation ready

## 9. Estimated Effort

- Claude Code execution: ~50 minutes
- Manual testing: ~15 minutes (responsive, role-based nav, all pages)
- Documentation updates: ~5 minutes
