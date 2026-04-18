# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Instructions

- Use comments sparingly. Only comment complex, non-obvious code.
- Prefer editing existing files over creating new ones unless a new file is clearly warranted.
- Match the existing code style and conventions in surrounding files.
- Run `npm run lint` and `npm run test` after making changes to verify nothing broke.
- Use the `@/*` path alias for imports from `src/` — never use relative paths like `../../`.
- When adding UI, check `src/components/ui/` first for existing shadcn/ui components before building new ones.
- Write tests for new components in colocated `__tests__/` directories using vitest + React Testing Library.
- Do not write files to disk from tool calls — use the VirtualFileSystem (`str_replace_editor` / `file_manager`).

## Commands

- **Setup**: `npm run setup` (installs deps, generates Prisma client, runs migrations)
- **Dev**: `npm run dev` (Next.js with Turbopack)
- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Test**: `npm run test` (vitest)
- **Single test**: `npx vitest run src/components/chat/__tests__/MessageList.test.tsx`
- **DB reset**: `npm run db:reset`

All server commands require `NODE_OPTIONS='--require ./node-compat.cjs'` (already configured in npm scripts).

## Architecture

UIGen is an AI-powered React component generator. Users describe components in a chat; Claude generates code via tool calls; a live preview renders the result in a sandboxed iframe.

### Core Data Flow

​`
User chat input → ChatContext (useChat) → /api/chat/route.ts (streamText + tools)
  → Claude API generates tool calls → str_replace_editor / file_manager tools
  → VirtualFileSystem updated server-side → saved to DB via Prisma onFinish
  → Client receives stream, FileSystemContext processes tool results
  → PreviewFrame detects change → Babel transforms JSX → iframe renders via import map
​`

### Key Subsystems

**Virtual File System** (`src/lib/file-system.ts`): In-memory tree structure — no files written to disk. Serialized as JSON to persist in the database. Two tools are exposed to the AI: `str_replace_editor` (create/read/replace/insert) and `file_manager` (rename/delete).

**Preview** (`src/components/preview/PreviewFrame.tsx` + `src/lib/transform/jsx-transformer.ts`): Transforms JSX files with Babel, creates blob URLs, generates an ES module import map (local files → blob URLs, external packages → esm.sh CDN), and renders in an iframe with `srcdoc`. Entry point is `/App.jsx` or `/App.tsx`.

**AI Provider** (`src/lib/provider.ts`): Uses Claude Haiku via `@ai-sdk/anthropic` when `ANTHROPIC_API_KEY` is set. Falls back to a `MockLanguageModel` that returns canned responses for demo/testing without an API key.

**Chat & File System Contexts** (`src/lib/contexts/`): React contexts that manage all client state. `ChatContext` wraps the Vercel AI SDK `useChat` hook and sends serialized file system state with each request. `FileSystemContext` processes AI tool call results and exposes a `refreshTrigger` counter for the preview.

### Layout

The main UI (`src/app/main-content.tsx`) is a horizontal resizable panel: chat on the left (35%), preview/code editor on the right (65%). The code view has a file tree + Monaco editor.

### Auth & Persistence

- JWT session cookies (jose), bcrypt passwords, Prisma + SQLite
- Anonymous users can work without signing in; work is tracked in sessionStorage (`src/lib/anon-work-tracker.ts`) and converted to a project on sign-up
- Projects store `messages` (JSON array) and `data` (serialized VirtualFileSystem) as strings
- Server actions in `src/actions/` handle project CRUD

### Path Alias

`@/*` maps to `./src/*` (configured in tsconfig.json). shadcn/ui components live in `src/components/ui/`.

### Testing

Tests use vitest + jsdom + React Testing Library. Test files are colocated in `__tests__/` directories next to their components.
