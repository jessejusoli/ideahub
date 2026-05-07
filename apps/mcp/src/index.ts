import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { config } from "./config";

const server = new McpServer({
  name: "ideahub-mcp",
  version: "0.1.0"
});

async function apiGet(path: string) {
  const response = await fetch(`${config.IDEAHUB_API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`IdeaHub API request failed with ${response.status}.`);
  }

  return response.json() as Promise<unknown>;
}

async function apiPost(path: string, body: unknown) {
  const response = await fetch(`${config.IDEAHUB_API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`IdeaHub API request failed with ${response.status}.`);
  }

  return response.json() as Promise<unknown>;
}

server.registerTool(
  "ideahub.health",
  {
    title: "IdeaHub Health",
    description: "Check whether the IdeaHub API is reachable.",
    inputSchema: {}
  },
  async () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await apiGet("/health"), null, 2)
      }
    ]
  })
);

server.registerTool(
  "ideahub.searchSemantic",
  {
    title: "IdeaHub Semantic Search",
    description: "Search IdeaHub entries semantically through the public API.",
    inputSchema: {
      q: z.string().min(1),
      vaultId: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(50).default(10)
    }
  },
  async ({ q, vaultId, limit }) => {
    const params = new URLSearchParams({ q, limit: String(limit) });

    if (vaultId) {
      params.set("vaultId", vaultId);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(await apiGet(`/search/semantic?${params.toString()}`), null, 2)
        }
      ]
    };
  }
);

server.registerTool(
  "ideahub.getEntry",
  {
    title: "IdeaHub Get Entry",
    description: "Fetch an IdeaHub entry by ID through the public API.",
    inputSchema: {
      id: z.string().uuid()
    }
  },
  async ({ id }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await apiGet(`/entries/${id}`), null, 2)
      }
    ]
  })
);

server.registerTool(
  "ideahub.getFootnotes",
  {
    title: "IdeaHub Get Footnotes",
    description: "Fetch footnotes for a PostgreSQL-canonical Markdown note.",
    inputSchema: {
      noteId: z.string().uuid()
    }
  },
  async ({ noteId }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await apiGet(`/notes/${noteId}/footnotes`), null, 2)
      }
    ]
  })
);

server.registerTool(
  "ideahub.createEntry",
  {
    title: "IdeaHub Create Entry",
    description: "Create a text entry through the public API.",
    inputSchema: {
      vaultId: z.string().uuid(),
      content: z.string().min(1),
      title: z.string().min(1).max(160).optional()
    }
  },
  async ({ vaultId, content, title }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await apiPost("/entries", { vaultId, content, title }), null, 2)
      }
    ]
  })
);

server.registerTool(
  "ideahub.getBases",
  {
    title: "IdeaHub Bases",
    description: "Query PostgreSQL notes as a property-driven base view.",
    inputSchema: {
      vaultId: z.string().uuid()
    }
  },
  async ({ vaultId }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await apiGet(`/bases?vaultId=${vaultId}`), null, 2)
      }
    ]
  })
);

server.registerTool(
  "ideahub.convertMarkdown",
  {
    title: "IdeaHub Format Converter",
    description: "Normalize external Markdown into IdeaHub-compatible Markdown.",
    inputSchema: {
      content: z.string().min(1),
      sourceFormat: z.enum(["generic", "notion", "roam", "google_docs"]).default("generic")
    }
  },
  async ({ content, sourceFormat }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await apiPost("/format-converter", { content, sourceFormat }), null, 2)
      }
    ]
  })
);

server.registerTool(
  "ideahub.getPagePreview",
  {
    title: "IdeaHub Page Preview",
    description: "Preview a note by ID, title, alias, or path.",
    inputSchema: {
      vaultId: z.string().uuid(),
      noteId: z.string().uuid().optional(),
      target: z.string().min(1).optional()
    }
  },
  async ({ vaultId, noteId, target }) => {
    const params = new URLSearchParams({ vaultId });
    if (noteId) {
      params.set("noteId", noteId);
    }
    if (target) {
      params.set("target", target);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(await apiGet(`/page-preview?${params.toString()}`), null, 2)
        }
      ]
    };
  }
);

server.registerTool(
  "ideahub.getSlides",
  {
    title: "IdeaHub Slides",
    description: "Render a Markdown note as slides.",
    inputSchema: {
      noteId: z.string().uuid()
    }
  },
  async ({ noteId }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await apiGet(`/slides/${noteId}`), null, 2)
      }
    ]
  })
);

server.registerTool(
  "ideahub.getSyncState",
  {
    title: "IdeaHub Sync State",
    description: "Fetch server-centric sync state for a vault.",
    inputSchema: {
      vaultId: z.string().uuid()
    }
  },
  async ({ vaultId }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await apiGet(`/sync?vaultId=${vaultId}`), null, 2)
      }
    ]
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
