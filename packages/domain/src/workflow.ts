import type { Recommendation, SessionState } from "./types";

export const MAX_SANDBOX_ROUNDS = 3;

export function canStartMatch(hasProfile: boolean) {
  return hasProfile;
}

export function canAdvanceSandbox(state: SessionState) {
  return state === "matched" || state === "sandboxing";
}

export function canFinalizeSandbox(state: SessionState, currentRound: number) {
  return canAdvanceSandbox(state) && currentRound >= MAX_SANDBOX_ROUNDS;
}

export function getStateAfterRound(currentRound: number): SessionState {
  if (currentRound <= 0) {
    return "matched";
  }

  return "sandboxing";
}

export function getStateAfterFinalize(recommendation: Recommendation): SessionState {
  return recommendation === "terminate" ? "filtered_out" : "reconnect_ready";
}

export function canExchangeContacts(state: SessionState) {
  return state === "reconnect_ready" || state === "exchanged";
}
