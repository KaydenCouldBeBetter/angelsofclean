import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ProgressDots from "../ProgressDots";

function dotLabels(currentStep: number, totalSteps: number) {
  const html = renderToStaticMarkup(
    <ProgressDots currentStep={currentStep} totalSteps={totalSteps} />,
  );
  return [...html.matchAll(/role="img" aria-label="([^"]+)"/g)].map((m) => m[1]);
}

describe("ProgressDots", () => {
  it("announces earlier steps as completed, this step as current, later steps plainly", () => {
    expect(dotLabels(3, 6)).toEqual([
      "Step 1, completed",
      "Step 2, completed",
      "Step 3, current",
      "Step 4",
      "Step 5",
      "Step 6",
    ]);
  });

  it("marks the first step current, not completed", () => {
    expect(dotLabels(1, 4)[0]).toBe("Step 1, current");
  });

  it("marks the last step current, not completed", () => {
    expect(dotLabels(4, 4)).toEqual([
      "Step 1, completed",
      "Step 2, completed",
      "Step 3, completed",
      "Step 4, current",
    ]);
  });

  it("flags exactly one dot as the current step", () => {
    const html = renderToStaticMarkup(<ProgressDots currentStep={2} totalSteps={6} />);
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
  });
});
