import {
  applySecondMeCorrection,
  canAdvanceSandbox,
  canExchangeContacts,
  canFinalizeSandbox,
  getStateAfterFinalize,
  getStateAfterRound,
  MAX_SANDBOX_ROUNDS,
} from "@dual-core/domain";
import { describe, expect, it } from "vitest";

describe("workflow domain rules", () => {
  it("keeps a matched session in sandboxing once rounds begin", () => {
    expect(getStateAfterRound(0)).toBe("matched");
    expect(getStateAfterRound(1)).toBe("sandboxing");
    expect(getStateAfterRound(2)).toBe("sandboxing");
  });

  it("only allows finalize after the full sandbox", () => {
    expect(canFinalizeSandbox("matched", MAX_SANDBOX_ROUNDS - 1)).toBe(false);
    expect(canFinalizeSandbox("sandboxing", MAX_SANDBOX_ROUNDS)).toBe(true);
    expect(canFinalizeSandbox("filtered_out", MAX_SANDBOX_ROUNDS)).toBe(false);
  });

  it("maps recommendation to final state", () => {
    expect(getStateAfterFinalize("continue")).toBe("reconnect_ready");
    expect(getStateAfterFinalize("cautious")).toBe("reconnect_ready");
    expect(getStateAfterFinalize("terminate")).toBe("filtered_out");
  });

  it("only allows contact exchange in reconnect states", () => {
    expect(canAdvanceSandbox("matched")).toBe(true);
    expect(canAdvanceSandbox("sandboxing")).toBe(true);
    expect(canAdvanceSandbox("reconnect_ready")).toBe(false);
    expect(canExchangeContacts("reconnect_ready")).toBe(true);
    expect(canExchangeContacts("exchanged")).toBe(true);
    expect(canExchangeContacts("filtered_out")).toBe(false);
  });

  it("only corrects low-confidence axes with strong Second Me hints", () => {
    const base = {
      letters: "ENTJ",
      confidence: 0.25,
      axes: [
        { dimension: "energy", leftCode: "E", rightCode: "I", leftCount: 6, rightCount: 4, dominantCode: "E", confidence: 0.2 },
        { dimension: "perception", leftCode: "S", rightCode: "N", leftCount: 3, rightCount: 7, dominantCode: "N", confidence: 0.4 },
        { dimension: "decision", leftCode: "T", rightCode: "F", leftCount: 6, rightCount: 4, dominantCode: "T", confidence: 0.2 },
        { dimension: "execution", leftCode: "J", rightCode: "P", leftCount: 7, rightCount: 3, dominantCode: "J", confidence: 0.4 },
      ],
    } as const;

    const corrected = applySecondMeCorrection(base, [
      {
        dimension: "energy",
        code: "I",
        confidence: 0.88,
        evidence: ["更常以独处整理信息后再表达立场"],
      },
      {
        dimension: "perception",
        code: "S",
        confidence: 0.95,
        evidence: ["这条不应生效，因为量表置信度已经更高"],
      },
      {
        dimension: "decision",
        code: "F",
        confidence: 0.81,
        evidence: ["在协作记忆里反复优先提到关系缓冲和感受照顾"],
      },
    ]);

    expect(corrected.effective.letters).toBe("INFJ");
    expect(corrected.correction?.correctedAxes).toHaveLength(2);
    expect(corrected.correction?.correctedAxes.map((item) => item.dimension)).toEqual([
      "energy",
      "decision",
    ]);
  });

  it("keeps the original result when hints are weak or missing", () => {
    const base = {
      letters: "INTJ",
      confidence: 0.35,
      axes: [
        { dimension: "energy", leftCode: "E", rightCode: "I", leftCount: 4, rightCount: 6, dominantCode: "I", confidence: 0.2 },
        { dimension: "perception", leftCode: "S", rightCode: "N", leftCount: 3, rightCount: 7, dominantCode: "N", confidence: 0.4 },
        { dimension: "decision", leftCode: "T", rightCode: "F", leftCount: 7, rightCount: 3, dominantCode: "T", confidence: 0.4 },
        { dimension: "execution", leftCode: "J", rightCode: "P", leftCount: 7, rightCount: 3, dominantCode: "J", confidence: 0.4 },
      ],
    } as const;

    const corrected = applySecondMeCorrection(base, [
      {
        dimension: "energy",
        code: "E",
        confidence: 0.7,
        evidence: ["置信度不够，不应触发校正"],
      },
    ]);

    expect(corrected.effective.letters).toBe("INTJ");
    expect(corrected.correction).toBeNull();
  });
});
