# Plan 001 — Next.js Project Scaffolding

## 1. Objective

Initialize a production-grade Next.js 14+ project with App Router, TypeScript strict mode, and Tailwind CSS as the foundation for all subsequent plans.

## 2. Scope

- Create Next.js app with App Router, TypeScript, Tailwind CSS, ESLint
- Establish folder structure conventions
- Configure path aliases
- Set up Prettier alongside ESLint
- Base layout with metadata
- First clean Git commit

### Out of Scope

- Environment variables (Plan 02)
- Database setup (Plan 03)
- Authentication (Plan 04)
- Any UI components beyond the default layout

## 3. Prerequisites / Dependencies

- Node.js 18+ installed
- Git initialized in project directory
- No prior plans required — this is the starting point

## 4. Technical Approach

Use `create-next-app` with all recommended defaults (App Router, TypeScript, Tailwind, ESLint). Layer on Prettier for formatting consistency. Establish folder conventions early so every future plan follows the same structure.

### Folder Structure

```
selectiq/
├── app/
│   ├── (auth)/            # Auth pages (login, register)
│   ├── (protected)/       # Authenticated app pages
│   ├── api/               # API route handlers
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Landing/home page
│   ├── error.tsx          # Global error boundary (Plan 10)
│   └── not-found.tsx      # 404 page (Plan 10)
├── components/
│   ├── ui/                # Reusable UI primitives
│   └── auth/              # Auth-specific components
├── lib/
│   ├── auth/              # Auth utilities
│   ├── firebase/          # Firebase client + admin
│   ├── supabase/          # Supabase storage client
│   └── prisma.ts          # Prisma singleton
├── services/              # Business logic / API wrappers
├── hooks/                 # Custom React hooks
├── types/                 # Shared TypeScript types
├── constants/             # App-wide constants
├── prisma/
│   └── schema.prisma      # Prisma schema
├── public/                # Static assets
├── docs/                  # Project documentation
│   └── plans/             # Implementation plans
└── tailwind.config.ts
```

## 5. Implementation Steps

1. Run `npx create-next-app@latest selectiq` with flags:
   - `--typescript`
   - `--tailwind`
   - `--eslint`
   - `--app`
   - `--src-dir=no`
   - `--import-alias="@/*"`
2. Create all empty directories: `components/ui`, `components/auth`, `lib/auth`, `lib/firebase`, `lib/supabase`, `services`, `hooks`, `types`, `constants`
3. Add `.gitkeep` to empty directories
4. Configure `tsconfig.json` path aliases:
   ```json
   {
     "paths": {
       "@/*": ["./*"],
       "@/components/*": ["./components/*"],
       "@/lib/*": ["./lib/*"],
       "@/types/*": ["./types/*"],
       "@/hooks/*": ["./hooks/*"],
       "@/services/*": ["./services/*"],
       "@/constants/*": ["./constants/*"]
     }
   }
   ```
5. Install and configure Prettier:
   - `npm install -D prettier eslint-config-prettier`
   - Create `.prettierrc` with project defaults (semi, singleQuote, trailingComma, printWidth: 100)
   - Add `prettier` to ESLint extends
6. Update `app/layout.tsx` with SelectIQ metadata:
   - Title: "SelectIQ — Campus Recruitment & Assessment Platform"
   - Description, favicon reference
7. Clean up default Next.js boilerplate from `app/page.tsx`
8. Add npm scripts: `"format": "prettier --write ."`, `"format:check": "prettier --check ."`

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Create | All directories above | Project structure |
| Modify | `tsconfig.json` | Path aliases |
| Create | `.prettierrc` | Prettier config |
| Modify | `.eslintrc.json` | Add prettier compat |
| Modify | `app/layout.tsx` | Metadata + clean markup |
| Modify | `app/page.tsx` | Remove boilerplate |
| Modify | `package.json` | Format scripts |

## 7. Testing / Verification

- [ ] `npm run dev` — starts without errors on localhost:3000
- [ ] `npm run build` — production build succeeds with zero warnings
- [ ] `npm run lint` — passes clean
- [ ] `npm run format:check` — passes clean
- [ ] All path aliases resolve (create a test import and verify)
- [ ] Browser shows clean page at localhost:3000

## 8. Documentation Updates

- Add to `CLAUDE.md`: folder structure conventions, path alias patterns
- Add to `docs/project-context.md`: Sprint 1 Plan 01 completed, tech stack initialized

## 9. Estimated Effort

- Claude Code execution: ~15 minutes
- Manual testing: ~5 minutes
- Documentation updates: ~5 minutes
