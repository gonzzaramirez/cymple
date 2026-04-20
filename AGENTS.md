# MedAgenda - Agent Instructions

## Project Structure
- `front/` — Next.js 16 frontend (App Router, shadcn/ui base-nova, Tailwind CSS 4)
- `back/` — NestJS backend (Prisma, PostgreSQL, JWT auth, multi-tenant)

## Build & Lint Commands

### Frontend
```bash
cd front
npm run build    # Production build (typecheck included)
npm run lint     # ESLint check
npm run dev      # Dev server
```

### Backend
```bash
cd back
npm run build           # NestJS build (no typecheck, use tsc separately)
npx tsc --noEmit        # TypeScript check
npm run lint            # ESLint
npm run start:dev       # Dev server with watch
```

### Database
```bash
cd back
npx prisma generate     # Generate Prisma client
npx prisma migrate dev  # Run migrations
npx prisma db seed      # Seed demo data
```

## Design System
- Fonts: SF Pro Display (headings), SF Pro Text (body) — Apple system fonts
- Style: Apple-inspired, Cal.com shadow system (multi-layer), generous border-radius
- Shadows: `shadow-card`, `shadow-card-hover`, `shadow-elevated` — ring borders + diffused shadows
- Colors: Apple blue `#0071e3` primary, monochrome grays, semantic colors per DESIGN.md
- Components: shadcn/ui base-nova with @base-ui/react primitives

## Key Patterns
- All backend routes use `@UseGuards(JwtAuthGuard, TenantGuard)` + `@CurrentProfessionalId()`
- Frontend uses cookie-based auth (`medagenda_token`) with server-side `serverApiFetch`
- Frontend proxy: `/api/backend/[...path]` proxies to backend with auth cookie
- Multi-tenancy: every query filters by `professionalId` from JWT
- Soft delete for patients (`deletedAt` field)

## Architecture
- Backend: Feature modules (auth, patients, appointments, finance, availability, webhooks, professional)
- Frontend: App Router with (auth) and (dashboard) route groups
- Mobile-first: DataCard on mobile, DataTable on desktop (useIsMobile hook)
