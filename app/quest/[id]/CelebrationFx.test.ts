import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import QuestStartForm, { QuestStartBurst } from "../QuestStartForm";
import CelebrationFx, { QuestCompleteBurst, celebratedKey } from "./CelebrationFx";

describe("CelebrationFx", () => {
  it("renders nothing on the server — it fires on mount", () => {
    expect(renderToStaticMarkup(createElement(CelebrationFx, { runId: "r1" }))).toBe("");
  });

  it("renders a decorative confetti + QUEST COMPLETE! banner", () => {
    const html = renderToStaticMarkup(createElement(QuestCompleteBurst));
    expect(html).toContain('class="fx-overlay fx-complete" aria-hidden="true"');
    expect(html).toContain("QUEST COMPLETE!");
    expect(html.match(/<span /g)?.length).toBeGreaterThanOrEqual(20);
    expect(html).toContain("--fx-x:");
  });

  it("keys the once-per-run guard by run id", () => {
    expect(celebratedKey("abc")).toBe("cq-celebrated-abc");
  });
});

describe("QuestStartForm", () => {
  it("renders the form and its fields without the overlay until submit", () => {
    const html = renderToStaticMarkup(
      createElement(QuestStartForm, {
        action: async () => {},
        className: "quest-list",
        children: createElement("button", { type: "submit" }, "Start quest"),
      }),
    );
    expect(html).toContain('class="quest-list"');
    expect(html).toContain("Start quest");
    expect(html).not.toContain("QUEST START!");
  });

  it("burst has rings, rising particles and the title", () => {
    const html = renderToStaticMarkup(createElement(QuestStartBurst));
    expect(html).toContain("QUEST START!");
    expect(html.match(/class="fx-ring"/g)).toHaveLength(3);
    expect(html).toContain("fx-particles");
  });
});
