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
  "ideahub.createEntry",
  {
    title: "IdeaHub Create Entry",
    description: "Placeholder for creating entries through the public API.",
    inputSchema: {
      vaultId: z.string().uuid(),
      content: z.string().min(1),
      title: z.string().min(1).max(160).optional()
    }
  },
  async () => ({
    content: [
      {
        type: "text",
        text: "Entry creation is declared as an MCP tool but will be wired after the API client layer is added."
      }
    ]
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
