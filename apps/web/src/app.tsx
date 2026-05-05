import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BrainCircuit,
  ChevronRight,
  CheckCircle2,
  Command,
  Database,
  FileClock,
  FileText,
  FolderTree,
  Layers3,
  Link2,
  Loader2,
  Network,
  Plus,
  Search,
  SendHorizonal,
  CalendarDays,
  Save
} from "lucide-react";
import { layers, layerLabels } from "@ideahub/shared";
import { Button } from "./components/ui/button";
import {
  createEntry,
  createNote,
  createProject,
  createVault,
  getExplorer,
  getBacklinks,
  getOutgoingLinks,
  listCommands,
  listNoteVersions,
  listNotes,
  listProjects,
  listVaults,
  moveNote,
  openDailyNote,
  quickSwitcher,
  restoreNoteVersion,
  updateNote,
  type CapturedEntry,
  type Note
} from "./lib/api";

export function App() {
  const queryClient = useQueryClient();
  const [selectedVaultId, setSelectedVaultId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [vaultName, setVaultName] = useState("Personal Knowledge");
  const [projectName, setProjectName] = useState("IdeaHub MVP");
  const [entryTitle, setEntryTitle] = useState("");
  const [entryContent, setEntryContent] = useState("");
  const [noteSearch, setNoteSearch] = useState("");
  const [quickQuery, setQuickQuery] = useState("");
  const [activeNoteId, setActiveNoteId] = useState("");
  const [noteTitle, setNoteTitle] = useState("New linked note");
  const [notePath, setNotePath] = useState("");
  const [noteContent, setNoteContent] = useState(
    "# New linked note\n\nWrite Markdown with [[wiki links]], #tags, and properties.\n"
  );
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

  const notesQuery = useQuery({
    queryKey: ["notes", activeVaultId, noteSearch],
    queryFn: () => listNotes(activeVaultId, noteSearch),
    enabled: Boolean(activeVaultId)
  });

  const activeNote = notesQuery.data?.notes.find((note) => note.id === activeNoteId);

  const explorerQuery = useQuery({
    queryKey: ["explorer", activeVaultId],
    queryFn: () => getExplorer(activeVaultId),
    enabled: Boolean(activeVaultId)
  });

  const quickSwitcherQuery = useQuery({
    queryKey: ["quick-switcher", activeVaultId, quickQuery],
    queryFn: () => quickSwitcher(activeVaultId, quickQuery),
    enabled: Boolean(activeVaultId && quickQuery.trim().length > 0)
  });

  const versionsQuery = useQuery({
    queryKey: ["notes", activeNoteId, "versions"],
    queryFn: () => listNoteVersions(activeNoteId),
    enabled: Boolean(activeNoteId)
  });

  const commandsQuery = useQuery({
    queryKey: ["commands"],
    queryFn: listCommands
  });

  const outgoingQuery = useQuery({
    queryKey: ["notes", activeNoteId, "outgoing"],
    queryFn: () => getOutgoingLinks(activeNoteId),
    enabled: Boolean(activeNoteId)
  });

  const backlinksQuery = useQuery({
    queryKey: ["notes", activeNoteId, "backlinks"],
    queryFn: () => getBacklinks(activeNoteId),
    enabled: Boolean(activeNoteId)
  });

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

  const createNoteMutation = useMutation({
    mutationFn: createNote,
    onSuccess: async (note) => {
      setActiveNoteId(note.id);
      setNoteTitle(note.title ?? "");
      setNotePath(note.path ?? "");
      setNoteContent(note.content);
      await queryClient.invalidateQueries({ queryKey: ["notes", activeVaultId] });
      await queryClient.invalidateQueries({ queryKey: ["explorer", activeVaultId] });
    }
  });

  const updateNoteMutation = useMutation({
    mutationFn: (note: Note) =>
      updateNote(note.id, {
        title: noteTitle,
        content: noteContent,
        path: notePath || undefined
      }),
    onSuccess: async (note) => {
      setActiveNoteId(note.id);
      setNotePath(note.path ?? "");
      await queryClient.invalidateQueries({ queryKey: ["notes", activeVaultId] });
      await queryClient.invalidateQueries({ queryKey: ["explorer", activeVaultId] });
      await queryClient.invalidateQueries({ queryKey: ["notes", note.id, "outgoing"] });
      await queryClient.invalidateQueries({ queryKey: ["notes", note.id, "backlinks"] });
      await queryClient.invalidateQueries({ queryKey: ["notes", note.id, "versions"] });
    }
  });

  const moveNoteMutation = useMutation({
    mutationFn: (note: Note) =>
      moveNote(note.id, {
        title: noteTitle,
        path: notePath
      }),
    onSuccess: async (note) => {
      setActiveNoteId(note.id);
      setNoteTitle(note.title ?? "");
      setNotePath(note.path ?? "");
      await queryClient.invalidateQueries({ queryKey: ["notes", activeVaultId] });
      await queryClient.invalidateQueries({ queryKey: ["explorer", activeVaultId] });
      await queryClient.invalidateQueries({ queryKey: ["notes", note.id, "versions"] });
    }
  });

  const restoreVersionMutation = useMutation({
    mutationFn: (version: number) => restoreNoteVersion(activeNoteId, version),
    onSuccess: async (note) => {
      setActiveNoteId(note.id);
      setNoteTitle(note.title ?? "");
      setNotePath(note.path ?? "");
      setNoteContent(note.content);
      await queryClient.invalidateQueries({ queryKey: ["notes", activeVaultId] });
      await queryClient.invalidateQueries({ queryKey: ["explorer", activeVaultId] });
      await queryClient.invalidateQueries({ queryKey: ["notes", note.id, "versions"] });
      await queryClient.invalidateQueries({ queryKey: ["notes", note.id, "outgoing"] });
      await queryClient.invalidateQueries({ queryKey: ["notes", note.id, "backlinks"] });
    }
  });

  const dailyNoteMutation = useMutation({
    mutationFn: openDailyNote,
    onSuccess: async ({ note }) => {
      setActiveNoteId(note.id);
      setNoteTitle(note.title ?? "");
      setNotePath(note.path ?? "");
      setNoteContent(note.content);
      await queryClient.invalidateQueries({ queryKey: ["notes", activeVaultId] });
      await queryClient.invalidateQueries({ queryKey: ["explorer", activeVaultId] });
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
  const canSaveNote = Boolean(activeVaultId && noteTitle.trim() && noteContent.trim());

  function selectNote(note: Note) {
    setActiveNoteId(note.id);
    setNoteTitle(note.title ?? "");
    setNotePath(note.path ?? "");
    setNoteContent(note.content);
  }

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
              <div className="mt-4 max-w-xl rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Command className="h-4 w-4 text-emerald-700" />
                  Quick switcher
                </div>
                <input
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={quickQuery}
                  onChange={(event) => setQuickQuery(event.target.value)}
                  placeholder="Open by title, path, alias, tag, or content"
                />
                {quickSwitcherQuery.data?.results.length ? (
                  <div className="mt-2 max-h-44 overflow-auto rounded-md border border-slate-200 bg-white">
                    {quickSwitcherQuery.data.results.map((result) => (
                      <button
                        key={result.id}
                        className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-emerald-50"
                        onClick={() => {
                          const note = notesQuery.data?.notes.find((item) => item.id === result.id);
                          if (note) {
                            selectNote(note);
                            setQuickQuery("");
                          }
                        }}
                      >
                        <span>
                          <span className="block font-medium text-slate-900">
                            {result.title || result.path || "Untitled"}
                          </span>
                          <span className="block text-xs text-slate-500">{result.path}</span>
                        </span>
                        <span className="text-xs text-slate-400">{result.score.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
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
              <FileText className="h-5 w-5 text-emerald-700" />
              <h2 className="text-lg font-semibold text-slate-950">Notes</h2>
            </div>
            <div className="mb-3 flex items-center gap-2 rounded-md border border-slate-300 px-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
                value={noteSearch}
                onChange={(event) => setNoteSearch(event.target.value)}
                placeholder="Search notes"
              />
            </div>
            <div className="max-h-72 space-y-2 overflow-auto">
              {notesQuery.data?.notes.map((note) => (
                <button
                  key={note.id}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                    note.id === activeNoteId
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                  onClick={() => selectNote(note)}
                >
                  <span className="block font-medium text-slate-900">
                    {note.title || "Untitled"}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {note.path || note.id}
                  </span>
                </button>
              ))}
            </div>
            <Button
              className="mt-3 w-full"
              variant="secondary"
              onClick={() =>
                dailyNoteMutation.mutate({
                  vaultId: activeVaultId,
                  projectId: activeProjectId || undefined
                })
              }
              disabled={!activeVaultId || dailyNoteMutation.isPending}
            >
              <CalendarDays className="h-4 w-4" />
              Open daily note
            </Button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <FolderTree className="h-5 w-5 text-emerald-700" />
              <h2 className="text-lg font-semibold text-slate-950">Explorer</h2>
            </div>
            <div className="space-y-2">
              {(explorerQuery.data?.folders ?? []).map((folder) => (
                <div
                  key={folder.path}
                  className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  style={{ paddingLeft: `${12 + (folder.depth - 1) * 14}px` }}
                >
                  <span className="flex items-center gap-2 font-medium text-slate-800">
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                    {folder.path.split("/").at(-1)}
                  </span>
                  <span className="text-xs text-slate-500">{folder.noteCount}</span>
                </div>
              ))}
              {explorerQuery.data?.folders.length === 0 ? (
                <p className="text-sm text-slate-500">Folders appear after notes get paths.</p>
              ) : null}
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
              <FileText className="h-5 w-5 text-emerald-700" />
              <h2 className="text-lg font-semibold text-slate-950">Markdown editor</h2>
            </div>
            <input
              className="mb-3 h-11 w-full rounded-md border border-slate-300 px-3 text-sm"
              value={noteTitle}
              onChange={(event) => setNoteTitle(event.target.value)}
              placeholder="Note title"
            />
            <div className="mb-3 flex flex-col gap-2 sm:flex-row">
              <input
                className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 px-3 text-sm"
                value={notePath}
                onChange={(event) => setNotePath(event.target.value)}
                placeholder="Logical path, for example Projects/IdeaHub.md"
              />
              <Button
                variant="secondary"
                onClick={() => activeNote && moveNoteMutation.mutate(activeNote)}
                disabled={!activeNote || !notePath.trim() || moveNoteMutation.isPending}
              >
                <FolderTree className="h-4 w-4" />
                Move
              </Button>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <textarea
                className="min-h-80 w-full resize-y rounded-md border border-slate-300 p-3 font-mono text-sm leading-6"
                value={noteContent}
                onChange={(event) => setNoteContent(event.target.value)}
                placeholder="Write Markdown with [[wiki links]] and #tags..."
              />
              <div className="min-h-80 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6">
                <MarkdownPreview content={noteContent} />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-between gap-3">
              <div className="text-sm text-slate-500">
                {activeNote ? `${activeNote.wordCount} words` : "New note"} ·{" "}
                {activeNote?.path ?? "PostgreSQL canonical Markdown"}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setActiveNoteId("");
                    setNoteTitle("New linked note");
                    setNotePath("");
                    setNoteContent(
                      "# New linked note\n\nWrite Markdown with [[wiki links]] and #tags.\n"
                    );
                  }}
                >
                  <Plus className="h-4 w-4" />
                  New
                </Button>
                <Button
                  onClick={() =>
                    activeNote
                      ? updateNoteMutation.mutate(activeNote)
                      : createNoteMutation.mutate({
                          vaultId: activeVaultId,
                          projectId: activeProjectId || undefined,
                          title: noteTitle,
                          content: noteContent,
                          path: notePath || undefined
                        })
                  }
                  disabled={
                    !canSaveNote || createNoteMutation.isPending || updateNoteMutation.isPending
                  }
                >
                  <Save className="h-4 w-4" />
                  {activeNote ? "Save note" : "Create note"}
                </Button>
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Link2 className="h-5 w-5 text-emerald-700" />
                <h2 className="text-lg font-semibold text-slate-950">Outgoing links</h2>
              </div>
              <div className="space-y-2">
                {(outgoingQuery.data?.links ?? []).map((link) => (
                  <div
                    key={`${link.raw}-${link.target}`}
                    className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{link.raw}</span>
                    <span className="ml-2 text-xs text-slate-500">
                      {link.resolved ? "resolved" : "unresolved"}
                    </span>
                  </div>
                ))}
                {activeNoteId && outgoingQuery.data?.links.length === 0 ? (
                  <p className="text-sm text-slate-500">No wiki-links in this note yet.</p>
                ) : null}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Network className="h-5 w-5 text-emerald-700" />
                <h2 className="text-lg font-semibold text-slate-950">Backlinks</h2>
              </div>
              <div className="space-y-2">
                {(backlinksQuery.data?.backlinks ?? []).map((backlink) => (
                  <div
                    key={backlink.source.id}
                    className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">
                      {backlink.source.title || backlink.source.path}
                    </span>
                    <span className="ml-2 text-xs text-slate-500">{backlink.type}</span>
                  </div>
                ))}
                {activeNoteId && backlinksQuery.data?.backlinks.length === 0 ? (
                  <p className="text-sm text-slate-500">No backlinks to this note yet.</p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <FileClock className="h-5 w-5 text-emerald-700" />
                <h2 className="text-lg font-semibold text-slate-950">Recovery versions</h2>
              </div>
              <div className="space-y-2">
                {(versionsQuery.data?.versions ?? []).map((version) => (
                  <div
                    key={version.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="block font-medium text-slate-900">
                        Version {version.version}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {version.changeReason || "Snapshot"} ·{" "}
                        {new Date(version.createdAt).toLocaleString()}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => restoreVersionMutation.mutate(version.version)}
                      disabled={!activeNoteId || restoreVersionMutation.isPending}
                    >
                      Restore
                    </Button>
                  </div>
                ))}
                {activeNoteId && versionsQuery.data?.versions.length === 0 ? (
                  <p className="text-sm text-slate-500">No recovery snapshots yet.</p>
                ) : null}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Command className="h-5 w-5 text-emerald-700" />
                <h2 className="text-lg font-semibold text-slate-950">Command registry</h2>
              </div>
              <div className="space-y-2">
                {(commandsQuery.data?.commands ?? []).map((command) => (
                  <div
                    key={command.id}
                    className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="block font-medium text-slate-900">{command.label}</span>
                      <span className="block text-xs text-slate-500">{command.category}</span>
                    </span>
                    <span className="text-xs text-slate-500">
                      {command.enabled ? "ready" : "planned"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

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

function MarkdownPreview({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/);

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        const heading = block.match(/^(#{1,6})\s+(.+)$/);
        if (heading) {
          const level = heading[1]?.length ?? 1;
          const text = heading[2] ?? "";
          const className = level === 1 ? "text-2xl font-semibold" : "text-lg font-semibold";
          return (
            <h3 key={index} className={className}>
              {text}
            </h3>
          );
        }

        return (
          <p key={index} className="whitespace-pre-wrap text-slate-700">
            {renderInlineMarkdown(block)}
          </p>
        );
      })}
    </div>
  );
}

function renderInlineMarkdown(value: string) {
  const parts = value.split(/(\[\[[^\]]+\]\]|#[a-zA-Z0-9_/-]{2,80})/g);

  return parts.map((part, index) => {
    if (part.startsWith("[[") && part.endsWith("]]")) {
      return (
        <span key={index} className="rounded bg-emerald-100 px-1 font-medium text-emerald-800">
          {part}
        </span>
      );
    }

    if (part.startsWith("#")) {
      return (
        <span key={index} className="rounded bg-sky-100 px-1 font-medium text-sky-800">
          {part}
        </span>
      );
    }

    return part;
  });
}
