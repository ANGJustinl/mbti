import {
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
});
