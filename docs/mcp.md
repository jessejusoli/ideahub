# MCP Server

IdeaHub includes a separate MCP Server skeleton in `apps/mcp`.

## Purpose

The MCP server exists to let AI tools interact with IdeaHub through a stable protocol without importing API internals. It should call the public API boundary and preserve the same authorization and validation rules as other clients.

## Initial Tools

| Tool                     | Purpose                                         |
| ------------------------ | ----------------------------------------------- |
| `ideahub.health`         | Check API availability.                         |
| `ideahub.searchSemantic` | Search entries through the semantic search API. |
| `ideahub.getEntry`       | Fetch an entry by ID.                           |
| `ideahub.createEntry`    | Declared placeholder for future entry creation. |

Upcoming MCP tools should follow the new note-first API surface:

- `ideahub.listNotes`
- `ideahub.getNote`
- `ideahub.createNote`
- `ideahub.updateNote`
- `ideahub.getBacklinks`
- `ideahub.openDailyNote`

Those tools should call `/api/notes` and related public routes instead of
importing internal API modules.

## Boundary Rules

- Do not import modules from `apps/api/src`.
- Use HTTP/API clients for integration.
- Keep tool inputs small and schema-validated.
- Do not expose unreviewed RAG or LLM output as trusted facts.
