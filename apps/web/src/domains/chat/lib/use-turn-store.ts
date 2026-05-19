/**
 * Zustand store for the turn state machine.
 *
 * Wraps the pure `turnReducer` in a Zustand store so consumers can
 * subscribe to specific slices via selectors, avoiding unnecessary
 * re-renders during high-frequency streaming updates (~50ms cadence).
 *
 * Non-React code (stream handlers, reconciliation callbacks) can read
 * the latest state synchronously via `useTurnStore.getState()` —
 * replacing the manual `turnStateRef` pattern.
 *
 * @see https://zustand.docs.pmnd.rs/
 */

import { create } from "zustand";

import {
  type DomainEvent,
  type TurnState,
  INITIAL_TURN_STATE,
  turnReducer,
} from "@/domains/chat/lib/turn-state-machine.js";

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface TurnStore extends TurnState {
  /** Dispatch a domain event through the turn reducer. */
  dispatch: (event: DomainEvent) => void;
}

// ---------------------------------------------------------------------------
// Store instance
// ---------------------------------------------------------------------------

export const useTurnStore = create<TurnStore>((set) => ({
  ...INITIAL_TURN_STATE,
  dispatch: (event) =>
    set((state) => {
      const next = turnReducer(state, event);
      // Zustand skips re-render when the reference is the same,
      // which turnReducer already guarantees for no-op transitions.
      return next === state ? state : next;
    }),
}));
