"use client";

import { useState } from "react";
import type { HouseholdRole } from "@/lib/householdRole";

const OPTIONS: { value: HouseholdRole; icon: string; label: string; hint: string }[] = [
  { value: "gamemaster", icon: "🛡️", label: "I'M A GAMEMASTER", hint: "Run the game — approve quests, control loot" },
  { value: "gamer", icon: "🎮", label: "I'M A GAMER", hint: "Play — do chores, earn loot" },
];

/**
 * GameMaster / gamer picker for the create and join forms. Real radio inputs (visually
 * hidden, still keyboard-focusable) so the form posts householdRole=gamemaster|gamer.
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
