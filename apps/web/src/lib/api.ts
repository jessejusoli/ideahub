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
  wordCount: number;
  characterCount: number;
  updatedAt: string;
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

export async function getOutgoingLinks(noteId: string) {
  return request<{ noteId: string; links: NoteLink[] }>(`/notes/${noteId}/outgoing-links`);
}

export async function getBacklinks(noteId: string) {
  return request<{ noteId: string; backlinks: Backlink[]; unlinkedMentions: Backlink[] }>(
    `/notes/${noteId}/backlinks`
  );
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
