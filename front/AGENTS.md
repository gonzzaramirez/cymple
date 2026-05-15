<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

**Multi-tenant / edge:** use root `proxy.ts` with `export function proxy` (Next 16 replaces `middleware.ts`). Production requires `NEXT_PUBLIC_BASE_DOMAIN`.
<!-- END:nextjs-agent-rules -->
