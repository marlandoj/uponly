import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RolePicker from "./RolePicker";

// No DOM test libs: render the picker to HTML the way the create and join forms
// would, then read the radio inputs out of the markup.
const render = (defaultRole: "parent" | "kid") => renderToStaticMarkup(createElement(RolePicker, { defaultRole }));
const inputs = (html: string) => html.match(/<input[^>]*>/g) ?? [];
const roleInputs = (html: string, value: string) =>
  inputs(html).filter((i) => i.includes('name="householdRole"') && i.includes(`value="${value}"`));

describe.each([
  ["create form", "parent"],
  ["join form", "kid"],
] as const)("RolePicker in the %s (defaultRole=%s)", (_, defaultRole) => {
  const html = render(defaultRole);
  const other = defaultRole === "parent" ? "kid" : "parent";

  it("renders both options", () => {
    expect(html).toContain("I&#x27;M A PARENT");
    expect(html).toContain("I&#x27;M A KID");
  });

  it("has exactly one householdRole radio per value", () => {
    expect(inputs(html).filter((i) => i.includes('name="householdRole"'))).toHaveLength(2);
    for (const v of ["parent", "kid"]) {
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
