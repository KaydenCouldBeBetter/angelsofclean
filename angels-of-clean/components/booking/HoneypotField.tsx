"use client";

import type { CSSProperties } from "react";
import { HONEYPOT_FIELD_NAME } from "@/lib/bot-check";

// Off-screen rather than display:none / visibility:hidden, which form-filling
// scripts know to skip. Hidden from assistive tech and the tab order below.
const OFF_SCREEN: CSSProperties = {
  position: "absolute",
  left: "-10000px",
  top: "auto",
  width: "1px",
  height: "1px",
  overflow: "hidden",
};

// Bot trap for the contact steps. People never see it: aria-hidden removes it
// from screen readers and tabIndex -1 keeps it out of keyboard navigation.
export default function HoneypotField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div aria-hidden="true" style={OFF_SCREEN}>
      <label htmlFor={HONEYPOT_FIELD_NAME}>Website (leave this field empty)</label>
      <input
        type="text"
        id={HONEYPOT_FIELD_NAME}
        name={HONEYPOT_FIELD_NAME}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
      />
    </div>
  );
}
