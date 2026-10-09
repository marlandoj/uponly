import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ActiveQuestCard from "./ActiveQuestCard";

const RUN = "33333333-3333-3333-3333-333333333333";
const render = (status: "draft" | "active") =>
  renderToStaticMarkup(createElement(ActiveQuestCard, { run: { id: RUN, title: "Clean the kitchen", status } }));

describe("ActiveQuestCard", () => {
  it("links to the run with its title", () => {
    const html = render("active");
    expect(html).toContain(`href="/quest/${RUN}"`);
    expect(html).toContain("Clean the kitchen");
    expect(html).toContain("Your active quest");
  });

  it("asks for the before photo on a draft", () => {
    expect(render("draft")).toContain("Snap your before photo");
  });

  it("shows the running timer on an active run", () => {
    expect(render("active")).toContain("Quest in progress — timer running");
  });
});
