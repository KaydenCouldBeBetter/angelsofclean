"use client";

import { createContext, useContext, useId } from "react";
import { cn } from "@/lib/utils";

// The one "selected" style for every choice in the booking and quote flows:
// solid brand fill, white text, and a check mark so colour isn't the only cue.
//
// Each choice is a real (visually hidden) radio or checkbox inside a label, so
// screen readers announce "radio button, checked" and arrow keys work natively;
// the global focus ring lands on the label (see globals.css).

interface GroupContext {
  type: "radio" | "checkbox";
  name: string;
}

const SelectableGroupContext = createContext<GroupContext | null>(null);

interface SelectableGroupProps {
  /** "radio" for pick-one, "checkbox" for pick-many. */
  type: "radio" | "checkbox";
  /** Names the group for screen readers; or use aria-labelledby. */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
  children: React.ReactNode;
}

// Wraps a set of choices. It gives them a name that is unique to this rendered
// copy: the residential shell renders each step twice (mobile and desktop
// layouts), and radios that shared a name would un-check each other across
// the two copies.
export function SelectableGroup({
  type,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  children,
}: SelectableGroupProps) {
  const name = useId();
  return (
    <SelectableGroupContext.Provider value={{ type, name }}>
      <div
        role={type === "radio" ? "radiogroup" : "group"}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={className}
      >
        {children}
      </div>
    </SelectableGroupContext.Provider>
  );
}

interface SelectableProps {
  value: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  /** Accessible name when the visible content isn't a good one. */
  "aria-label"?: string;
  /** Layout and size. Colours and the selected state come from here. */
  className?: string;
  children: React.ReactNode;
}

// Children can style themselves from the state with the `group` variants,
// e.g. `text-zinc-500 group-data-selected:text-white`.
export default function Selectable({
  value,
  selected,
  onSelect,
  disabled = false,
  "aria-label": ariaLabel,
  className,
  children,
}: SelectableProps) {
  const group = useContext(SelectableGroupContext);
  if (!group) throw new Error("Selectable must be rendered inside a SelectableGroup");

  return (
    <label
      data-selected={selected ? "true" : undefined}
      className={cn(
        "group relative rounded-xl border-2 text-sm font-medium transition-colors",
        disabled
          ? "cursor-not-allowed border-zinc-100 bg-zinc-50 text-zinc-400"
          : selected
            ? "cursor-pointer border-primary bg-primary text-white"
            : "cursor-pointer border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300",
        className,
      )}
    >
      <input
        type={group.type}
        name={group.name}
        value={value}
        checked={selected}
        onChange={onSelect}
        disabled={disabled}
        aria-label={ariaLabel}
        className="sr-only"
      />
      {children}
      {selected && !disabled && (
        <svg
          aria-hidden="true"
          viewBox="0 0 12 10"
          fill="none"
          className="absolute top-1.5 right-1.5 h-3 w-3.5"
        >
          <path
            d="M1 5l3.5 3.5L11 1"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </label>
  );
}
