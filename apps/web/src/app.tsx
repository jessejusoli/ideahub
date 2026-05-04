import {
  BrainCircuit,
  GitBranch,
  Layers3,
  Mic,
  Network,
  SearchCheck,
  Sparkles
} from "lucide-react";
import { layers, layerLabels } from "@ideahub/shared";
import { Button } from "./components/ui/button";

const capabilities = [
  {
    title: "Capture without friction",
    description:
      "Drop voice notes or written thoughts into a focused inbox before the context evaporates.",
    icon: Mic
  },
  {
    title: "Classify the meaning",
    description:
      "Use LLM analysis to detect layer, summary, tags, project context, and next-step signals.",
    icon: Layers3
  },
  {
    title: "Retrieve before reasoning",
    description:
      "Search PostgreSQL and pgvector first, then let the LLM reason over grounded context.",
    icon: SearchCheck
  },
  {
    title: "Connect with confidence",
    description: "Suggest semantic links with strength, type, justification, and human review.",
    icon: Network
  }
];

const roadmap = [
  "Project foundation",
  "Database schema and API",
  "Capture inbox",
  "Review workflow",
  "Knowledge graph"
];

export function App() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid min-h-[620px] max-w-7xl gap-10 px-6 py-10 lg:grid-cols-[1.08fr_0.92fr] lg:px-8">
          <div className="flex flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800">
              <Sparkles className="h-4 w-4" />
              MVP in development
            </div>
            <h1 className="max-w-4xl text-5xl font-semibold leading-tight tracking-normal text-slate-950 md:text-6xl">
              IdeaHub
            </h1>
            <p className="mt-5 max-w-2xl text-xl leading-8 text-slate-700">
              An intelligent second brain for capturing, connecting, and evolving your thoughts.
            </p>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
              Built for people whose ideas move across projects, clients, strategies, and execution.
              Capture the raw thought, classify the signal, retrieve related context, and turn
              scattered knowledge into a living system.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button>
                <BrainCircuit className="h-4 w-4" />
                Open capture inbox
              </Button>
              <Button variant="secondary">
                <GitBranch className="h-4 w-4" />
                View roadmap
              </Button>
            </div>
          </div>

          <div className="flex items-center">
            <div className="w-full rounded-lg border border-slate-200 bg-slate-950 p-4 shadow-xl">
              <div className="mb-4 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-amber-400" />
                <div className="h-3 w-3 rounded-full bg-emerald-400" />
              </div>
              <div className="space-y-3 rounded-md bg-slate-900 p-5 font-mono text-sm text-slate-100">
                <p className="text-emerald-300">capture.entry</p>
                <p>source: voice</p>
                <p>layer: pending</p>
                <p>retrieval: pgvector.search()</p>
                <p>analysis: rag.classify()</p>
                <p className="text-sky-300">suggestions: tags + projects + links</p>
                <p className="text-amber-300">review: human approval required</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {capabilities.map((capability) => (
            <article
              key={capability.title}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <capability.icon className="h-6 w-6 text-emerald-600" />
              <h2 className="mt-4 text-lg font-semibold text-slate-950">{capability.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{capability.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-14 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-emerald-700">
              Four-layer model
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950">
              From raw thought to concrete execution.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              IdeaHub starts with a simple mental model that keeps knowledge flexible without making
              it vague.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {layers.map((layer) => (
              <div key={layer} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-base font-semibold text-slate-950">{layerLabels[layer]}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {layer === "intention" &&
                    "Purpose, motivation, direction, and the reason behind the thought."}
                  {layer === "concept" &&
                    "Ideas, principles, mental models, interpretations, and strategic meaning."}
                  {layer === "structure" &&
                    "Projects, systems, processes, architecture, categories, and relationships."}
                  {layer === "execution" &&
                    "Tasks, deliverables, concrete actions, commitments, and next steps."}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-emerald-700">
              Implementation path
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950">
              A practical route to the intelligent MVP.
            </h2>
          </div>
          <ol className="space-y-3">
            {roadmap.map((item, index) => (
              <li
                key={item}
                className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <span className="font-medium text-slate-800">{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}
