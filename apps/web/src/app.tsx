import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BrainCircuit,
  CheckCircle2,
  Database,
  FolderTree,
  Layers3,
  Loader2,
  Network,
  Plus,
  SendHorizonal
} from "lucide-react";
import { layers, layerLabels } from "@ideahub/shared";
import { Button } from "./components/ui/button";
import {
  createEntry,
  createProject,
  createVault,
  listProjects,
  listVaults,
  type CapturedEntry
} from "./lib/api";

export function App() {
  const queryClient = useQueryClient();
  const [selectedVaultId, setSelectedVaultId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [vaultName, setVaultName] = useState("Personal Knowledge");
  const [projectName, setProjectName] = useState("IdeaHub MVP");
  const [entryTitle, setEntryTitle] = useState("");
  const [entryContent, setEntryContent] = useState("");
  const [captures, setCaptures] = useState<CapturedEntry[]>([]);

  const vaultsQuery = useQuery({
    queryKey: ["vaults"],
    queryFn: listVaults
  });

  const activeVaultId = selectedVaultId || vaultsQuery.data?.vaults[0]?.id || "";

  const projectsQuery = useQuery({
    queryKey: ["projects", activeVaultId],
    queryFn: () => listProjects(activeVaultId),
    enabled: Boolean(activeVaultId)
  });

  const activeProjectId = selectedProjectId || projectsQuery.data?.projects[0]?.id || "";

  const createVaultMutation = useMutation({
    mutationFn: createVault,
    onSuccess: async (vault) => {
      setSelectedVaultId(vault.id);
      await queryClient.invalidateQueries({ queryKey: ["vaults"] });
    }
  });

  const createProjectMutation = useMutation({
    mutationFn: createProject,
    onSuccess: async (project) => {
      setSelectedProjectId(project.id);
      await queryClient.invalidateQueries({ queryKey: ["projects", project.vaultId] });
    }
  });

  const createEntryMutation = useMutation({
    mutationFn: createEntry,
    onSuccess: (capture) => {
      setCaptures((current) => [capture, ...current]);
      setEntryTitle("");
      setEntryContent("");
    }
  });

  const statusText = useMemo(() => {
    if (createEntryMutation.isPending) {
      return "Capturing thought and queueing analysis";
    }

    if (captures.length > 0) {
      return "Latest thought captured";
    }

    return "Ready for capture";
  }, [captures.length, createEntryMutation.isPending]);

  const canCapture = Boolean(activeVaultId && entryContent.trim().length > 0);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8 lg:px-8">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800">
                <BrainCircuit className="h-4 w-4" />
                Intelligent capture workspace
              </div>
              <h1 className="text-4xl font-semibold leading-tight tracking-normal text-slate-950">
                IdeaHub
              </h1>
              <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">
                Capture a thought, place it in a vault/project, and queue the first analysis job
                against PostgreSQL.
              </p>
            </div>
            <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:min-w-72">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                {createEntryMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                )}
                {statusText}
              </div>
              <p className="text-xs leading-5 text-slate-500">
                {captures.length} captured entr{captures.length === 1 ? "y" : "ies"} in this
                session.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[360px_1fr] lg:px-8">
        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Database className="h-5 w-5 text-emerald-700" />
              <h2 className="text-lg font-semibold text-slate-950">Vault</h2>
            </div>
            <label className="text-sm font-medium text-slate-700" htmlFor="vault-select">
              Active vault
            </label>
            <select
              id="vault-select"
              className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={activeVaultId}
              onChange={(event) => setSelectedVaultId(event.target.value)}
            >
              {vaultsQuery.data?.vaults.map((vault) => (
                <option key={vault.id} value={vault.id}>
                  {vault.name}
                </option>
              ))}
            </select>
            <div className="mt-4 flex gap-2">
              <input
                className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 px-3 text-sm"
                value={vaultName}
                onChange={(event) => setVaultName(event.target.value)}
                placeholder="Vault name"
              />
              <Button
                size="icon"
                variant="secondary"
                title="Create vault"
                onClick={() => createVaultMutation.mutate({ name: vaultName })}
                disabled={createVaultMutation.isPending || vaultName.trim().length === 0}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <FolderTree className="h-5 w-5 text-emerald-700" />
              <h2 className="text-lg font-semibold text-slate-950">Project</h2>
            </div>
            <label className="text-sm font-medium text-slate-700" htmlFor="project-select">
              Active project
            </label>
            <select
              id="project-select"
              className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={activeProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              disabled={!activeVaultId}
            >
              {projectsQuery.data?.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <div className="mt-4 flex gap-2">
              <input
                className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 px-3 text-sm"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="Project name"
              />
              <Button
                size="icon"
                variant="secondary"
                title="Create project"
                onClick={() =>
                  createProjectMutation.mutate({
                    vaultId: activeVaultId,
                    name: projectName
                  })
                }
                disabled={
                  createProjectMutation.isPending ||
                  !activeVaultId ||
                  projectName.trim().length === 0
                }
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Layers3 className="h-5 w-5 text-emerald-700" />
              <h2 className="text-lg font-semibold text-slate-950">Layers</h2>
            </div>
            <div className="space-y-2">
              {layers.map((layer) => (
                <div
                  key={layer}
                  className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-slate-800">{layerLabels[layer]}</span>
                  <span className="text-slate-500">pending AI</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <SendHorizonal className="h-5 w-5 text-emerald-700" />
              <h2 className="text-lg font-semibold text-slate-950">Capture</h2>
            </div>
            <input
              className="mb-3 h-11 w-full rounded-md border border-slate-300 px-3 text-sm"
              value={entryTitle}
              onChange={(event) => setEntryTitle(event.target.value)}
              placeholder="Optional title"
            />
            <textarea
              className="min-h-56 w-full resize-y rounded-md border border-slate-300 p-3 text-sm leading-6"
              value={entryContent}
              onChange={(event) => setEntryContent(event.target.value)}
              placeholder="Capture the thought here..."
            />
            <div className="mt-4 flex justify-end">
              <Button
                onClick={() =>
                  createEntryMutation.mutate({
                    vaultId: activeVaultId,
                    projectId: activeProjectId || undefined,
                    title: entryTitle.trim() || undefined,
                    content: entryContent
                  })
                }
                disabled={!canCapture || createEntryMutation.isPending}
              >
                {createEntryMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SendHorizonal className="h-4 w-4" />
                )}
                Capture thought
              </Button>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Network className="h-5 w-5 text-emerald-700" />
              <h2 className="text-lg font-semibold text-slate-950">Session captures</h2>
            </div>
            <div className="space-y-3">
              {captures.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                  Captured entries will appear here after they are written to PostgreSQL.
                </p>
              ) : (
                captures.map((capture) => (
                  <article
                    key={capture.entry.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <h3 className="font-semibold text-slate-950">
                        {capture.entry.title || "Untitled capture"}
                      </h3>
                      <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">
                        {capture.job.type}:{capture.job.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{capture.entry.content}</p>
                    <p className="mt-3 font-mono text-xs text-slate-500">{capture.entry.id}</p>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
