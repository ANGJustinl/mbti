import { describe, expect, it } from "vitest";

import { explainConflictFlag, getRecommendationInsight, getRiskTagLabel } from "../apps/web/lib/conflict-explainer";

describe("conflict explainer", () => {
  it("maps structured conflict flags to human-readable labels and actions", () => {
    const result = explainConflictFlag({
      type: "control_conflict",
      severity: "high",
      reason: "双方都希望掌控节奏。",
    });

    expect(result.label).toBe("控制权冲突");
    expect(result.severityLabel).toBe("高风险");
    expect(result.action).toContain("拍板");
  });

  it("returns recommendation and risk tag copy for UI surfaces", () => {
    expect(getRecommendationInsight("cautious").label).toBe("可以合作，但先约边界");
    expect(getRiskTagLabel("authority")).toBe("权责边界");
    expect(getRiskTagLabel("unknown")).toBe("unknown");
  });
});
