import { describe, expect, it, mock } from "bun:test";
import {
  createInteractionStore,
} from "@/domains/chat/lib/interaction-state-machine.js";

describe("createInteractionStore", () => {
  // --- Test 1: dispatch/getState/subscribe contract ---
  describe("dispatch/getState/subscribe contract", () => {
    it("initializes with INITIAL_INTERACTION_STATE", () => {
      const store = createInteractionStore();
      const state = store.getState();
      expect(state.pendingSecret).toBeNull();
      expect(state.pendingConfirmation).toBeNull();
      expect(state.pendingContactRequest).toBeNull();
      expect(state.pendingQuestion).toBeNull();
      expect(state.isSubmittingSecret).toBe(false);
      expect(state.isSubmittingConfirmation).toBe(false);
      expect(state.isSubmittingContactRequest).toBe(false);
      expect(state.isSubmittingQuestion).toBe(false);
      expect(state.secretSaved).toBe(false);
      expect(state.contactRequestAccepted).toBe(false);
      expect(state.isQuestionCardDismissed).toBe(false);
      expect(state.inlineConfirmationToolCallId).toBeNull();
    });

    it("dispatch updates state readable via getState", () => {
      const store = createInteractionStore();
      const payload = { requestId: "r1", label: "API Key" };
      store.dispatch({ type: "SHOW_SECRET", payload });
      expect(store.getState().pendingSecret).toEqual(payload);
    });

    it("subscribe fires on dispatch with updated state", () => {
      const store = createInteractionStore();
      const listener = mock(() => {});
      store.subscribe(listener);

      const payload = { requestId: "r1", label: "Token" };
      store.dispatch({ type: "SHOW_SECRET", payload });

      expect(listener).toHaveBeenCalledTimes(1);
      // After dispatch, getState reflects the change
      expect(store.getState().pendingSecret).toEqual(payload);
    });

    it("RESET_ALL returns state to initial via dispatch", () => {
      const store = createInteractionStore();
      store.dispatch({
        type: "SHOW_SECRET",
        payload: { requestId: "r1", label: "Key" },
      });
      store.dispatch({
        type: "SHOW_CONFIRMATION",
        payload: { requestId: "c1", title: "Allow?" },
      });
      expect(store.getState().pendingSecret).not.toBeNull();
      expect(store.getState().pendingConfirmation).not.toBeNull();

      store.dispatch({ type: "RESET_ALL" });

      const state = store.getState();
      expect(state.pendingSecret).toBeNull();
      expect(state.pendingConfirmation).toBeNull();
      expect(state.pendingContactRequest).toBeNull();
      expect(state.pendingQuestion).toBeNull();
      expect(state.isSubmittingSecret).toBe(false);
      expect(state.isSubmittingConfirmation).toBe(false);
    });
  });

  // --- Test 2: Store instance isolation ---
  describe("store instance isolation", () => {
    it("mutations to one store do not affect another", () => {
      const storeA = createInteractionStore();
      const storeB = createInteractionStore();

      storeA.dispatch({
        type: "SHOW_SECRET",
        payload: { requestId: "r1", label: "Key A" },
      });

      expect(storeA.getState().pendingSecret).toEqual({
        requestId: "r1",
        label: "Key A",
      });
      expect(storeB.getState().pendingSecret).toBeNull();
    });

    it("subscribe on one store does not fire for another store's dispatch", () => {
      const storeA = createInteractionStore();
      const storeB = createInteractionStore();
      const listenerB = mock(() => {});
      storeB.subscribe(listenerB);

      storeA.dispatch({
        type: "SHOW_SECRET",
        payload: { requestId: "r1", label: "Key" },
      });

      expect(listenerB).not.toHaveBeenCalled();
    });
  });

  // --- Test 3: Full interaction lifecycle ---
  describe("full secret lifecycle through store", () => {
    it("show → submit start → submit end → dismiss", () => {
      const store = createInteractionStore();
      const payload = { requestId: "s1", label: "API Key", description: "Enter your key" };

      // Show secret
      store.dispatch({ type: "SHOW_SECRET", payload });
      expect(store.getState().pendingSecret).toEqual(payload);
      expect(store.getState().isSubmittingSecret).toBe(false);
      expect(store.getState().secretSaved).toBe(false);

      // Submit start
      store.dispatch({ type: "SUBMIT_SECRET_START" });
      expect(store.getState().isSubmittingSecret).toBe(true);

      // Submit end with saved
      store.dispatch({ type: "SUBMIT_SECRET_END", saved: true });
      expect(store.getState().isSubmittingSecret).toBe(false);
      expect(store.getState().secretSaved).toBe(true);

      // Dismiss
      store.dispatch({ type: "DISMISS_SECRET" });
      expect(store.getState().pendingSecret).toBeNull();
      expect(store.getState().isSubmittingSecret).toBe(false);
    });
  });

  describe("full confirmation lifecycle through store", () => {
    it("show → submit start → submit end → dismiss", () => {
      const store = createInteractionStore();
      const payload = { requestId: "c1", title: "Allow file access?" };

      store.dispatch({ type: "SHOW_CONFIRMATION", payload });
      expect(store.getState().pendingConfirmation).toEqual(payload);

      store.dispatch({ type: "SUBMIT_CONFIRMATION_START" });
      expect(store.getState().isSubmittingConfirmation).toBe(true);

      store.dispatch({ type: "SUBMIT_CONFIRMATION_END" });
      expect(store.getState().isSubmittingConfirmation).toBe(false);

      store.dispatch({ type: "DISMISS_CONFIRMATION" });
      expect(store.getState().pendingConfirmation).toBeNull();
    });
  });

  describe("full question lifecycle through store", () => {
    it("show → dismiss card → dismiss fully", () => {
      const store = createInteractionStore();
      const payload = {
        requestId: "q1",
        entries: [{ id: "e1", question: "What is your name?", options: [] }],
      };

      store.dispatch({ type: "SHOW_QUESTION", payload });
      expect(store.getState().pendingQuestion).toEqual(payload);
      expect(store.getState().isQuestionCardDismissed).toBe(false);

      // Dismiss card (hides UI but keeps pendingQuestion for composer intercept)
      store.dispatch({ type: "DISMISS_QUESTION_CARD" });
      expect(store.getState().pendingQuestion).toEqual(payload);
      expect(store.getState().isQuestionCardDismissed).toBe(true);

      // Full dismiss
      store.dispatch({ type: "DISMISS_QUESTION" });
      expect(store.getState().pendingQuestion).toBeNull();
      expect(store.getState().isQuestionCardDismissed).toBe(false);
    });
  });

  // --- Verify dispatch type is on the store API, not inside state ---
  it("dispatch is a method on the store API, not part of getState()", () => {
    const store = createInteractionStore();
    expect(typeof store.dispatch).toBe("function");
    const state = store.getState();
    expect("dispatch" in state).toBe(false);
  });
});
