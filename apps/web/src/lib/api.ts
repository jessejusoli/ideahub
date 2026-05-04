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
