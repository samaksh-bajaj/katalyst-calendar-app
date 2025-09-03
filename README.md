# Katalyst Calendar — Click-to-Run Starter

This folder contains everything you need:
- Next.js (App Router) + TypeScript + Tailwind
- Internal MCP-style JSON-RPC mock at `/api/mcp`
- `/api/meetings` fetches from MCP and returns 5 upcoming + 5 past meetings
- Simple login page (cookie-based)

## Run without terminal knowledge
1) Open this folder in **VS Code**.
2) Open the **NPM Scripts** sidebar (Command Palette → 'NPM Scripts: Focus on NPM Scripts View').
3) Click **setup** (installs dependencies).
4) Click **dev** (starts the dev server).
5) Visit `http://localhost:3000/login`, enter any email, then you'll see the meetings UI.

## Where to edit
- UI: `src/app/page.tsx`, components in `src/components`
- Login: `src/app/login/page.tsx`
- API (server): `src/app/api/mcp/route.ts` (mock), `src/app/api/meetings/route.ts` (backend for front-end)
- Data shaping: `src/lib/mcp.ts`, types in `src/types.ts`

## Next steps
- Create an actual login page.
