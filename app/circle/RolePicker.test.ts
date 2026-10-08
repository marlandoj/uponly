import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RolePicker from "./RolePicker";

// No DOM test libs: render the picker to HTML the way the create and join forms
// would, then read the radio inputs out of the markup.
const render = (defaultRole: "gamemaster" | "gamer") => renderToStaticMarkup(createElement(RolePicker, { defaultRole }));
const inputs = (html: string) => html.match(/<input[^>]*>/g) ?? [];
const roleInputs = (html: string, value: string) =>
  inputs(html).filter((i) => i.includes('name="householdRole"') && i.includes(`value="${value}"`));

describe.each([
  ["create form", "gamemaster"],
  ["join form", "gamer"],
] as const)("RolePicker in the %s (defaultRole=%s)", (_, defaultRole) => {
  const html = render(defaultRole);
  const other = defaultRole === "gamemaster" ? "gamer" : "gamemaster";

  it("renders both options", () => {
    expect(html).toContain("I&#x27;M A GAMEMASTER");
    expect(html).toContain("I&#x27;M A GAMER");
  });

  it("has exactly one householdRole radio per value", () => {
    expect(inputs(html).filter((i) => i.includes('name="householdRole"'))).toHaveLength(2);
    for (const v of ["gamemaster", "gamer"]) {
      const [input, ...rest] = roleInputs(html, v);
      expect(rest).toHaveLength(0);
      expect(input).toContain('type="radio"');
    }
  });

  it(`checks ${defaultRole} by default`, () => {
    expect(roleInputs(html, defaultRole)[0]).toMatch(/\schecked(=""|\s|\/|>)/);
    expect(roleInputs(html, other)[0]).not.toMatch(/\schecked/);
  });
});
