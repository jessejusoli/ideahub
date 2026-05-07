import { describe, expect, it } from "vitest";
import { buildSlides, convertMarkdown } from "./core-plugins";

describe("core plugin helpers", () => {
  it("converts imported Markdown into IdeaHub-compatible Markdown", () => {
    const converted = convertMarkdown("#[[Big Idea]]\r\n\r\n> 💡 Remember this", "roam");

    expect(converted.convertedContent).toContain("sourceFormat: roam");
    expect(converted.convertedContent).toContain("#big-idea");
    expect(converted.convertedContent).toContain("> [!tip]");
    expect(converted.changes.length).toBeGreaterThan(1);
  });

  it("renders Markdown sections as slides", () => {
    const slides = buildSlides(`# One

First slide

---

## Two

Second slide`);

    expect(slides).toEqual([
      { index: 1, title: "One", markdown: "# One\n\nFirst slide" },
      { index: 2, title: "Two", markdown: "## Two\n\nSecond slide" }
    ]);
  });
});
