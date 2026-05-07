# Obsidian Core Coverage Matrix

IdeaHub targets Obsidian core-feature parity while keeping PostgreSQL as the
canonical source of truth. Markdown and files are compatibility surfaces for
editing, import, and export, not the native persistence model.

Reference scope: <https://obsidian.md/help/plugins>

Status values:

- `not_started`: no implementation yet.
- `planned`: contract or implementation plan exists.
- `implemented`: usable in API or UI.
- `verified`: covered by functional validation.

Coverage rule: a feature only moves to `verified` when this matrix points to a
repeatable test, smoke script, Playwright scenario, or documented release
evidence.

Surface status values:

- `none`: no API/UI surface exists.
- `contract`: documented route or placeholder exists, but the behavior is not
  implemented.
- `implemented`: usable behavior exists in API or UI.
- `verified`: behavior has repeatable automated validation or documented release
  evidence.

| Feature             | Release target     | Overall status | API status  | UI status   | Acceptance criteria                                                                  | API / UI surface                                             | Test / evidence                                | Remaining gap                                                 |
| ------------------- | ------------------ | -------------- | ----------- | ----------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------- |
| Audio recorder      | M6 AI/RAG          | implemented    | implemented | implemented | Record/upload audio and create a transcribed note.                                   | `POST /api/entries/audio`, web MediaRecorder capture         | OpenAPI check, web build                       | Provider transcription and durable audio object storage       |
| Backlinks           | M1 Editor + Links  | implemented    | implemented | implemented | A note linking with `[[Wiki Link]]` appears as a backlink on the target note.        | `GET /api/notes/:id/backlinks`, web backlinks panel          | Markdown parser tests, OpenAPI check           | Browser regression and API integration test                   |
| Bases               | M7 Core completion | implemented    | implemented | implemented | Filter, sort, and edit notes by structured properties.                               | `GET /api/bases`, web core plugins panel                     | OpenAPI check, web build                       | Saved base definitions and richer table editing               |
| Bookmarks           | M2 Productivity    | implemented    | implemented | implemented | Save notes, searches, headings, canvas, graph, and external references as shortcuts. | `GET/POST/PATCH/DELETE /api/bookmarks`, web bookmarks panel  | OpenAPI check                                  | E2E coverage and richer bookmark target opening               |
| Canvas              | M3 Visual          | implemented    | implemented | planned     | Store JSON Canvas documents in PostgreSQL.                                           | `GET/POST /api/canvas`                                       | OpenAPI check                                  | Visual canvas editor and node/edge mutation APIs              |
| Command palette     | M2 Productivity    | implemented    | implemented | implemented | Command registry can run note, daily-note, random, unique, bookmark, and compose.    | `GET /api/commands`, web command registry                    | OpenAPI check                                  | Keyboard modal, fuzzy actions, hotkeys                        |
| Daily notes         | M1 Editor + Links  | implemented    | implemented | implemented | Open today's note, creating it from optional template when missing.                  | `POST /api/daily-notes/open`, web daily note button          | OpenAPI check                                  | Browser regression and richer date/template settings          |
| File explorer       | M1 Navigation      | verified       | verified    | verified    | Browse and move logical PostgreSQL notes by vault/folder/path.                       | `GET /api/explorer`, `POST /api/notes/:id/move`              | Release evidence and current verified scenario | Drag/drop and folder operations                               |
| File recovery       | M1 Navigation      | verified       | verified    | verified    | List recovery snapshots and restore a note version.                                  | `GET /api/notes/:id/versions`, `POST /api/notes/:id/restore` | Release evidence and current verified scenario | Diff UI and automated API integration test                    |
| Footnotes view      | M1.1 Coverage      | implemented    | implemented | implemented | Extract footnote references/definitions for the active note.                         | `GET /api/notes/:id/footnotes`, web footnotes panel          | `apps/api/src/notes/markdown.test.ts`          | Browser regression and richer source navigation               |
| Format converter    | M4 Interop         | implemented    | implemented | implemented | Convert Markdown variants from other apps into IdeaHub Markdown.                     | `POST /api/format-converter`, web normalize action           | `apps/api/src/routes/core-plugins.test.ts`     | Broader app-specific converters and review UI                 |
| Graph view          | M3 Visual          | implemented    | implemented | planned     | Return graph nodes and edges from canonical notes and links.                         | `GET /api/graph`                                             | OpenAPI check                                  | Interactive graph UI, filters, local graph                    |
| Note composer       | M2 Productivity    | implemented    | implemented | implemented | Merge selected source notes into a composed PostgreSQL note.                         | `POST /api/notes/compose`, web command action                | OpenAPI check                                  | Split/extract workflow and e2e coverage                       |
| Outgoing links      | M1 Editor + Links  | implemented    | implemented | implemented | Parse wiki-links and report resolved/unresolved targets.                             | `GET /api/notes/:id/outgoing-links`, web outgoing panel      | Markdown parser tests, OpenAPI check           | API/browser regression                                        |
| Outline             | M1 Editor + Links  | implemented    | implemented | planned     | Extract headings from Markdown into note metadata.                                   | `GET /api/notes`, note metadata                              | Markdown parser tests                          | Dedicated outline panel and heading navigation                |
| Page preview        | M3 Visual          | implemented    | implemented | implemented | Hovering links previews note content.                                                | `GET /api/page-preview`, web active note preview             | OpenAPI check, web build                       | True hover interaction and browser regression                 |
| Properties view     | M1 Editor + Links  | implemented    | implemented | planned     | Parse frontmatter/properties into note metadata.                                     | `GET/POST/PATCH /api/notes`                                  | Markdown parser tests                          | Editable properties UI, global properties view, indexes       |
| Publish             | M5 Publish + Sync  | implemented    | implemented | implemented | Publish selected notes as a web knowledge base.                                      | `GET/POST/PATCH /api/publish`, web publish action            | OpenAPI check, web build                       | Public static renderer, auth, domains, link rewriting         |
| Quick switcher      | M1 Navigation      | implemented    | implemented | implemented | Fuzzy-open notes by title, path, alias, tag, or content.                             | `GET /api/quick-switcher`, web quick switcher                | OpenAPI check                                  | Keyboard launcher and browser regression                      |
| Random note         | M2 Productivity    | implemented    | implemented | implemented | Open a random note in the active vault.                                              | `POST /api/notes/random`                                     | OpenAPI check                                  | E2E coverage                                                  |
| Search              | M1 Editor + Links  | implemented    | implemented | implemented | Search notes by title/content with vault scoping.                                    | `GET /api/search`, web search input                          | OpenAPI check                                  | PostgreSQL full-text search, filters, operators, e2e coverage |
| Slash commands      | M2 Productivity    | implemented    | implemented | implemented | `/` menu inserts blocks, links, templates, and commands.                             | `GET/POST /api/slash-commands`, web insertion buttons        | OpenAPI check, web build                       | Keyboard slash menu inside editor                             |
| Slides              | M7 Core completion | implemented    | implemented | implemented | Render note sections as a presentation.                                              | `GET /api/slides/:id`, web slide count                       | `apps/api/src/routes/core-plugins.test.ts`     | Full presentation mode                                        |
| Sync                | M5 Publish + Sync  | implemented    | implemented | implemented | Multi-device sync built around PostgreSQL/server state.                              | `GET/POST /api/sync`, web checkpoint action                  | OpenAPI check, web build                       | Authenticated clients and conflict UI                         |
| Tags view           | M1 Editor + Links  | implemented    | implemented | planned     | Parse `#tags`, persist canonical tags, and list tag counts.                          | `GET /api/tags`                                              | Markdown parser tests, OpenAPI check           | Tag browser UI and e2e coverage                               |
| Templates           | M1 Editor + Links  | implemented    | implemented | planned     | Store Markdown templates and use them for daily notes.                               | `GET/POST /api/templates`                                    | OpenAPI check                                  | Template insert UI and settings                               |
| Unique note creator | M2 Productivity    | implemented    | implemented | implemented | Create timestamp/Zettelkasten-style notes from optional templates.                   | `POST /api/notes/unique`                                     | OpenAPI check                                  | E2E coverage and settings                                     |
| Web viewer          | M7 Core completion | implemented    | implemented | implemented | Open external links inside the workspace.                                            | `GET /api/web-viewer`, `POST /api/web-viewer/open`, web UI   | OpenAPI check, web build                       | Embedded viewer policy and browser regression                 |
| Word count          | M1 Editor + Links  | implemented    | implemented | implemented | Store word and character counts for Markdown notes.                                  | `GET /api/notes`, editor metadata                            | Markdown parser tests                          | Live count updates and browser regression                     |
| Workspaces          | M2 Productivity    | implemented    | implemented | planned     | Save workspace layout JSON in PostgreSQL.                                            | `GET/POST /api/workspaces`                                   | OpenAPI check                                  | Real layout restore/switching UI                              |

## Current Verified Scenario

The first implementation milestones focus on Editor + Links, Explorer +
Recovery + Quick Switcher, and Command Palette + Bookmarks + Note Utilities:

1. Create or select a vault.
2. Create a Markdown note through `POST /api/notes`.
3. Write wiki-links, tags, footnotes, headings, and frontmatter properties.
4. Save the note and create a recovery version.
5. Resolve outgoing links and backlinks from canonical PostgreSQL rows.
6. Search notes and open daily notes from the web workspace.
7. Browse the logical PostgreSQL explorer by folder/path.
8. Move or rename a note without making files the source of truth.
9. List recovery versions and restore a prior note version.
10. Fuzzy-open notes through quick switcher search.
11. Create a bookmark for a note and remove it.
12. Run command registry actions for daily, random, unique, bookmark, and compose.
13. Compose a new note from selected PostgreSQL source notes.

Features marked `implemented` still need browser-level regression coverage before
they can move to `verified`.

## Release Evidence

Current local evidence for M1/M1.1 and core-completion MVP closure on
2026-05-07:

- `pnpm format:check`
- `pnpm typecheck`
- `pnpm openapi:check` generated OpenAPI 3.1 with 47 paths.
- `pnpm test`
- `pnpm lint`
- `pnpm build`
- `pnpm docs:generate`
- `make compose-config`
- `make compose-prod-config`
- `make k8s-dry-run` skipped safely because no Kubernetes cluster context was
  configured.

## Release Closure Backlog

1. Add API integration tests for note CRUD, backlinks, tags, footnotes,
   explorer, recovery, quick switcher, bookmarks, and utilities.
2. Add Playwright browser tests for the current web workspace.
3. Implement visual Graph and visual Canvas before moving those rows to
   `verified`.
4. Add native attachments, full vault import/export, production Publish,
   authenticated Sync clients, and real AI/RAG as separate vertical milestones.
5. Keep README, `docs/api.md`, `docs/architecture.md`, `docs/deployment.md`,
   `docs/mcp.md`, OpenAPI, Docker/Compose/Kubernetes, and CI aligned with every
   milestone.
