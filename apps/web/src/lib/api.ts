const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3333/api";

export type Vault = {
  id: string;
  name: string;
  description: string | null;
};

export type Project = {
  id: string;
  vaultId: string;
  parentProjectId: string | null;
  name: string;
  description: string | null;
};

export type CapturedEntry = {
  entry: {
    id: string;
    vaultId: string;
    projectId?: string;
    title?: string;
    content: string;
    source: "text" | "voice" | "import";
    status: string;
  };
  job: {
    id: string;
    type: string;
    status: string;
  };
  message: string;
};

export type Note = {
  id: string;
  vaultId: string;
  projectId: string | null;
  title: string | null;
  content: string;
  path: string | null;
  folder: string | null;
  aliases: string[];
  properties: Record<string, unknown>;
  headings: Array<{ level: number; text: string; slug: string }>;
  footnotes: Footnote[];
  wordCount: number;
  characterCount: number;
  updatedAt: string;
};

export type Footnote = {
  id: string;
  definition: string | null;
  referenceCount: number;
};

export type NoteVersion = {
  id: string;
  version: number;
  title: string | null;
  content: string;
  changeReason: string | null;
  createdAt: string;
};

export type ExplorerFolder = {
  path: string;
  depth: number;
  noteCount: number;
};

export type ExplorerNote = Pick<Note, "id" | "title" | "path" | "folder" | "updatedAt">;

export type QuickSwitcherResult = {
  id: string;
  title: string | null;
  path: string | null;
  aliases: string[];
  tags: string[];
  score: number;
};

export type CommandDefinition = {
  id: string;
  label: string;
  category: string;
  enabled: boolean;
};

export type Bookmark = {
  id: string;
  vaultId: string;
  label: string;
  payload: {
    type: "note" | "search" | "heading" | "canvas" | "graph" | "external";
    targetId: string | null;
    targetPath: string | null;
    query: string | null;
    url: string | null;
  };
  createdAt: string;
  updatedAt: string;
};

export type NoteLink = {
  raw: string;
  target: string;
  alias: string | null;
  resolved: boolean;
  note: {
    id: string;
    title: string | null;
    path: string | null;
  } | null;
};

export type Backlink = {
  source: {
    id: string;
    title: string | null;
    path: string | null;
  };
  type: string;
  strength: string;
  context: string | null;
};

export type BaseRow = {
  id: string;
  title: string | null;
  path: string | null;
  folder: string | null;
  tags: string[];
  properties: Record<string, unknown>;
  wordCount: number;
  updatedAt: string;
};

export type SlashCommand = {
  id: string;
  label: string;
  insertion: string;
  description: string;
};

export type Slide = {
  index: number;
  title: string;
  markdown: string;
};

export type PublishState = {
  config: unknown | null;
  publicNotes: Note[];
  graph: {
    nodes: unknown[];
    edges: unknown[];
  };
};

export type SyncState = {
  vaultId: string;
  serverVersion: string;
  notes: Note[];
  acceptedChanges?: number;
};

export type WebViewerDocument = {
  id: string;
  vaultId: string;
  title: string | null;
  url: string;
  embedAllowed: boolean;
  message: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `IdeaHub API request failed with ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

export async function listVaults() {
  return request<{ vaults: Vault[] }>("/vaults");
}

export async function createVault(input: { name: string; description?: string }) {
  return request<Vault>("/vaults", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function listProjects(vaultId: string) {
  return request<{ projects: Project[] }>(`/projects?vaultId=${vaultId}`);
}

export async function createProject(input: {
  vaultId: string;
  name: string;
  description?: string;
}) {
  return request<Project>("/projects", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function createEntry(input: {
  vaultId: string;
  projectId?: string;
  title?: string;
  content: string;
}) {
  return request<CapturedEntry>("/entries", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      source: "text"
    })
  });
}

export async function createAudioEntry(input: {
  vaultId: string;
  projectId?: string;
  title?: string;
  transcript?: string;
  audioData?: string;
  mimeType?: string;
  durationSeconds?: number;
}) {
  return request<CapturedEntry>("/entries/audio", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function listNotes(vaultId?: string, q?: string) {
  const params = new URLSearchParams();
  if (vaultId) {
    params.set("vaultId", vaultId);
  }
  if (q) {
    params.set("q", q);
  }

  return request<{ notes: Note[] }>(`/notes?${params.toString()}`);
}

export async function createNote(input: {
  vaultId: string;
  projectId?: string;
  title: string;
  content: string;
  folder?: string;
  path?: string;
}) {
  return request<Note>("/notes", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateNote(
  id: string,
  input: {
    title?: string;
    content?: string;
    folder?: string | null;
    path?: string;
  }
) {
  return request<Note>(`/notes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function moveNote(
  id: string,
  input: {
    title?: string;
    path: string;
    folder?: string | null;
  }
) {
  return request<Note>(`/notes/${id}/move`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function listNoteVersions(noteId: string) {
  return request<{ noteId: string; versions: NoteVersion[] }>(`/notes/${noteId}/versions`);
}

export async function restoreNoteVersion(noteId: string, version: number) {
  return request<Note>(`/notes/${noteId}/restore`, {
    method: "POST",
    body: JSON.stringify({ version })
  });
}

export async function openRandomNote(vaultId: string) {
  return request<{ note: Note | null }>("/notes/random", {
    method: "POST",
    body: JSON.stringify({ vaultId })
  });
}

export async function createUniqueNote(input: {
  vaultId: string;
  projectId?: string;
  prefix?: string;
  folder?: string;
}) {
  return request<Note>("/notes/unique", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function composeNote(input: {
  vaultId: string;
  projectId?: string;
  title: string;
  sourceNoteIds: string[];
}) {
  return request<Note>("/notes/compose", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function getOutgoingLinks(noteId: string) {
  return request<{ noteId: string; links: NoteLink[] }>(`/notes/${noteId}/outgoing-links`);
}

export async function getBacklinks(noteId: string) {
  return request<{ noteId: string; backlinks: Backlink[]; unlinkedMentions: Backlink[] }>(
    `/notes/${noteId}/backlinks`
  );
}

export async function getFootnotes(noteId: string) {
  return request<{ noteId: string; footnotes: Footnote[] }>(`/notes/${noteId}/footnotes`);
}

export async function getBases(vaultId: string) {
  return request<{ vaultId: string; columns: string[]; rows: BaseRow[] }>(
    `/bases?vaultId=${vaultId}`
  );
}

export async function convertMarkdown(content: string, sourceFormat = "generic") {
  return request<{ sourceFormat: string; convertedContent: string; changes: string[] }>(
    "/format-converter",
    {
      method: "POST",
      body: JSON.stringify({ content, sourceFormat })
    }
  );
}

export async function getPagePreview(input: { vaultId: string; noteId?: string; target?: string }) {
  const params = new URLSearchParams({ vaultId: input.vaultId });
  if (input.noteId) {
    params.set("noteId", input.noteId);
  }
  if (input.target) {
    params.set("target", input.target);
  }

  return request<{
    note:
      | (Pick<Note, "id" | "title" | "path" | "headings" | "properties" | "wordCount"> & {
          excerpt: string;
        })
      | null;
  }>(`/page-preview?${params.toString()}`);
}

export async function listSlashCommands() {
  return request<{ commands: SlashCommand[] }>("/slash-commands");
}

export async function executeSlashCommand(input: {
  vaultId?: string;
  noteId?: string;
  commandId: string;
  query?: string;
}) {
  return request<{ commandId: string; insertion: string; description: string }>(
    "/slash-commands/execute",
    {
      method: "POST",
      body: JSON.stringify(input)
    }
  );
}

export async function getSlides(noteId: string) {
  return request<{ noteId: string; title: string | null; slides: Slide[] }>(`/slides/${noteId}`);
}

export async function publishVault(input: {
  vaultId: string;
  siteName: string;
  slug: string;
  noteIds: string[];
}) {
  return request<PublishState>("/publish", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function getSyncState(vaultId: string) {
  return request<SyncState>(`/sync?vaultId=${vaultId}`);
}

export async function pushSyncCheckpoint(input: {
  vaultId: string;
  clientId: string;
  changes?: Array<{
    entity: "note" | "workspace" | "canvas" | "bookmark";
    operation: "upsert" | "delete";
    id?: string;
    payload?: Record<string, unknown>;
  }>;
}) {
  return request<SyncState>("/sync", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function openWebViewer(input: { vaultId: string; url: string; title?: string }) {
  return request<WebViewerDocument>("/web-viewer/open", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function openDailyNote(input: { vaultId: string; projectId?: string }) {
  return request<{ note: Note; created: boolean }>("/daily-notes/open", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function getExplorer(vaultId: string) {
  return request<{ vaultId: string; folders: ExplorerFolder[]; notes: ExplorerNote[] }>(
    `/explorer?vaultId=${vaultId}`
  );
}

export async function quickSwitcher(vaultId: string, q: string) {
  const params = new URLSearchParams({ vaultId, q });
  return request<{ query: string; vaultId: string; results: QuickSwitcherResult[] }>(
    `/quick-switcher?${params.toString()}`
  );
}

export async function listCommands() {
  return request<{ commands: CommandDefinition[] }>("/commands");
}

export async function listBookmarks(vaultId?: string) {
  const params = new URLSearchParams();
  if (vaultId) {
    params.set("vaultId", vaultId);
  }

  return request<{ bookmarks: Bookmark[] }>(`/bookmarks?${params.toString()}`);
}

export async function createBookmark(input: {
  vaultId: string;
  label: string;
  type: Bookmark["payload"]["type"];
  targetId?: string;
  targetPath?: string;
  query?: string;
  url?: string;
}) {
  return request<Bookmark>("/bookmarks", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function deleteBookmark(id: string) {
  return request<{ id: string; deleted: boolean }>(`/bookmarks/${id}`, {
    method: "DELETE"
  });
}
