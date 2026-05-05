# Obsidian Core Coverage Matrix

IdeaHub targets Obsidian core-feature parity while keeping PostgreSQL as the
canonical source of truth. Markdown remains the editing, import, and export
format.

Status values:

- `not_started`: no implementation yet.
- `planned`: contract or implementation plan exists.
- `implemented`: usable in API or UI.
- `verified`: covered by functional validation.

| Obsidian core feature | IdeaHub status | Acceptance criteria                                                               | API / UI surface                                             |
| --------------------- | -------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Audio recorder        | planned        | Record/upload audio and create a transcribed note.                                | `POST /api/entries/audio`                                    |
| Backlinks             | implemented    | A note linking with `[[Wiki Link]]` appears as a backlink on the target note.     | `GET /api/notes/:id/backlinks`, web backlinks panel          |
| Bases                 | planned        | Filter/sort/edit notes by structured properties.                                  | Future bases views over note properties                      |
| Bookmarks             | planned        | Save notes, searches, headings, and canvases as shortcuts.                        | Future bookmarks API                                         |
| Canvas                | implemented    | Store JSON Canvas documents in PostgreSQL.                                        | `GET/POST /api/canvas`                                       |
| Command palette       | planned        | Keyboard palette can run note, search, daily-note, graph, and workspace commands. | `GET /api/commands`, future palette UI                       |
| Daily notes           | implemented    | Open today's note, creating it from optional template when missing.               | `POST /api/daily-notes/open`, web daily note button          |
| File explorer         | verified       | Browse and move logical PostgreSQL notes by vault/folder/path.                    | `GET /api/explorer`, `POST /api/notes/:id/move`              |
| File recovery         | verified       | List recovery snapshots and restore a note version.                               | `GET /api/notes/:id/versions`, `POST /api/notes/:id/restore` |
| Format converter      | planned        | Convert Markdown variants from other apps into IdeaHub Markdown.                  | Future converter API                                         |
| Graph view            | implemented    | Return graph nodes and edges from canonical notes and links.                      | `GET /api/graph`                                             |
| Note composer         | planned        | Merge notes or split selected content into new notes.                             | Future note composer API                                     |
| Outgoing links        | implemented    | Parse wiki-links and report resolved/unresolved targets.                          | `GET /api/notes/:id/outgoing-links`, web outgoing panel      |
| Outline               | implemented    | Extract headings from Markdown into note metadata.                                | `GET /api/notes`, editor metadata                            |
| Page preview          | planned        | Hovering links previews note content.                                             | Future web hover preview                                     |
| Properties view       | implemented    | Parse frontmatter/properties into note metadata.                                  | `GET/POST/PATCH /api/notes`                                  |
| Publish               | planned        | Publish selected notes as a web knowledge base.                                   | Future publish service                                       |
| Quick switcher        | implemented    | Fuzzy-open notes by title, path, alias, tag, or content.                          | `GET /api/quick-switcher`, web quick switcher                |
| Random note           | planned        | Open a random note in the active vault.                                           | Future notes utility endpoint                                |
| Search                | implemented    | Search notes by title/content with vault scoping.                                 | `GET /api/search`, web search input                          |
| Slash commands        | planned        | `/` menu inserts blocks, links, templates, and commands.                          | Future editor command layer                                  |
| Slides                | planned        | Render note sections as a presentation.                                           | Future slides route/view                                     |
| Sync                  | planned        | Multi-device sync built around PostgreSQL/server state.                           | Future sync/offline architecture                             |
| Tags view             | implemented    | Parse `#tags`, persist canonical tags, and list tag counts.                       | `GET /api/tags`                                              |
| Templates             | implemented    | Store Markdown templates and use them for daily notes.                            | `GET/POST /api/templates`                                    |
| Unique note creator   | planned        | Create timestamp/Zettelkasten notes from templates.                               | Future note creation command                                 |
| Web viewer            | planned        | Open external links inside the workspace.                                         | Future web viewer panel                                      |
| Word count            | implemented    | Store word and character counts for Markdown notes.                               | `GET /api/notes`, editor metadata                            |
| Workspaces            | implemented    | Save workspace layout JSON in PostgreSQL.                                         | `GET/POST /api/workspaces`                                   |

## Current Verified Scenario

The first implementation milestones focus on Editor + Links and Explorer +
Recovery + Quick Switcher:

1. Create or select a vault.
2. Create a Markdown note through `POST /api/notes`.
3. Write wiki-links, tags, headings, and frontmatter properties.
4. Save the note and create a recovery version.
5. Resolve outgoing links and backlinks from canonical PostgreSQL rows.
6. Search notes and open daily notes from the web workspace.
7. Browse the logical PostgreSQL explorer by folder/path.
8. Move or rename a note without making files the source of truth.
9. List recovery versions and restore a prior note version.
10. Fuzzy-open notes through quick switcher search.

Features marked `implemented` still need browser-level regression coverage before
they can move to `verified`.
