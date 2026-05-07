import { describe, expect, it } from "vitest";
import { normalizeTitle, parseMarkdown, toDefaultPath } from "./markdown";

describe("Markdown note parsing", () => {
  it("extracts frontmatter properties, aliases, headings, tags, and wiki-links", () => {
    const parsed = parseMarkdown(`---
aliases: Alpha, First note
status: draft
---
# Alpha Note

This links to [[Beta Note|beta]] and [[Gamma Note]] with #core/tag.
`);

    expect(parsed.properties).toEqual({
      aliases: ["Alpha", "First note"],
      status: "draft"
    });
    expect(parsed.aliases).toEqual(["Alpha", "First note"]);
    expect(parsed.headings).toEqual([{ level: 1, text: "Alpha Note", slug: "alpha-note" }]);
    expect(parsed.tags).toEqual(["core/tag"]);
    expect(parsed.wikiLinks).toEqual([
      { raw: "[[Beta Note|beta]]", target: "Beta Note", alias: "beta" },
      { raw: "[[Gamma Note]]", target: "Gamma Note", alias: null }
    ]);
    expect(parsed.wordCount).toBeGreaterThan(0);
  });

  it("extracts footnote references and definitions", () => {
    const parsed = parseMarkdown(`# Research note

This claim needs a source.[^source] This one is missing a definition.[^todo]

[^source]: Stored as a PostgreSQL-native footnote view.
`);

    expect(parsed.footnotes).toEqual([
      {
        id: "source",
        definition: "Stored as a PostgreSQL-native footnote view.",
        referenceCount: 1
      },
      {
        id: "todo",
        definition: null,
        referenceCount: 1
      }
    ]);
  });

  it("normalizes note titles and creates default paths", () => {
    expect(normalizeTitle("  My Note.md ")).toBe("my note");
    expect(toDefaultPath("Daily Note", "Journal/Daily")).toBe("Journal/Daily/Daily Note.md");
  });
});
