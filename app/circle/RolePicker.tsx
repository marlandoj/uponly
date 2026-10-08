"use client";

import { useState } from "react";
import type { HouseholdRole } from "@/lib/householdRole";

const OPTIONS: { value: HouseholdRole; icon: string; label: string; hint: string }[] = [
  { value: "parent", icon: "🛡️", label: "I'M A PARENT", hint: "Approve quests, control loot" },
  { value: "kid", icon: "🎮", label: "I'M A KID", hint: "Do chores, earn loot" },
];

/**
 * Parent / kid picker for the create and join forms. Real radio inputs (visually
 * hidden, still keyboard-focusable) so the form posts householdRole=parent|kid.
 * create_circle / join_circle validate it again.
 */
export default function RolePicker({ defaultRole }: { defaultRole: HouseholdRole }) {
  const [role, setRole] = useState<HouseholdRole>(defaultRole);

  return (
    <fieldset className="role-picker">
      <legend>Who&apos;s playing?</legend>
      {OPTIONS.map((o) => (
        <label key={o.value} className={`role-option${role === o.value ? " selected" : ""}`}>
          <input
            type="radio"
            name="householdRole"
            value={o.value}
            checked={role === o.value}
            onChange={() => setRole(o.value)}
          />
          <span className="role-icon" aria-hidden="true">{o.icon}</span>
          <span className="role-label">{o.label}</span>
          <span className="role-hint">{o.hint}</span>
        </label>
      ))}
    </fieldset>
  );
}
