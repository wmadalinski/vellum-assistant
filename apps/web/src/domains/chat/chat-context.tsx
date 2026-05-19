/**
 * Provides deeply-shared chat state and actions to nested components
 * without prop drilling.
 *
 * Split into three internal contexts to avoid unnecessary re-renders:
 *
 * - **State** (`messages`, `activeConversationKey`, `assistantId`) changes
 *   frequently — especially `messages` during streaming (~50 ms cadence).
 * - **Actions** (`sendMessage`, `dispatchTurn`) are stable function refs
 *   that rarely change.
 * - **Interaction store** is a Zustand `StoreApi` — stable by identity,
 *   so it never triggers a re-render on its own.  Components subscribe to
 *   slices via `useStore(store, selector)`.
 *
 * Components that only dispatch actions can call `useChatActions()` and
 * stay immune to high-frequency state updates. Components that read state
 * use `useChatState()`. The combined `useChatContext()` hook is kept for
 * consumers that genuinely need both.
 *
 * Reference: {@link https://react.dev/learn/scaling-up-with-reducer-and-context}
 * Pattern:   {@link https://kentcdodds.com/blog/how-to-optimize-your-context-value}
 * Zustand:   {@link https://zustand.docs.pmnd.rs/guides/initialize-state-with-props}
 */

import {
  type Dispatch,
  type ReactNode,
  createContext,
  useContext,
  useMemo,
} from "react";

import type { DisplayAttachment, DisplayMessage } from "@/domains/chat/lib/reconcile.js";
import type { DomainEvent } from "@/domains/chat/lib/turn-state-machine.js";
import type { InteractionStoreApi } from "@/domains/chat/lib/interaction-state-machine.js";

// ---------------------------------------------------------------------------
// State context — changes frequently (messages update during streaming)
// ---------------------------------------------------------------------------

export interface ChatStateValue {
  /** Current transcript messages for the active conversation. */
  messages: DisplayMessage[];
  /** Key identifying the active conversation, or `null` when none is selected. */
  activeConversationKey: string | null;
  /** Current assistant ID, or `null` before the assistant is resolved. */
  assistantId: string | null;
}

const ChatStateContext = createContext<ChatStateValue | null>(null);

// ---------------------------------------------------------------------------
// Actions context — stable function refs, rarely changes
// ---------------------------------------------------------------------------

export interface ChatActionsValue {
  /** Send a user message (with optional attachments) to the active conversation. */
  sendMessage: (content: string, attachments?: DisplayAttachment[]) => Promise<void>;
  /** Dispatch a turn state-machine event. */
  dispatchTurn: Dispatch<DomainEvent>;
  /** Zustand store for interaction state (secret, confirmation, contact, question prompts). */
  interactionStore: InteractionStoreApi;
}

const ChatActionsContext = createContext<ChatActionsValue | null>(null);

// ---------------------------------------------------------------------------
// Combined type (backward-compatible)
// ---------------------------------------------------------------------------

export type ChatContextValue = ChatStateValue & ChatActionsValue;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface ChatProviderProps {
  messages: DisplayMessage[];
  activeConversationKey: string | null;
  assistantId: string | null;
  sendMessage: (content: string, attachments?: DisplayAttachment[]) => Promise<void>;
  dispatchTurn: Dispatch<DomainEvent>;
  interactionStore: InteractionStoreApi;
  children: ReactNode;
}

export function ChatProvider({
  messages,
  activeConversationKey,
  assistantId,
  sendMessage,
  dispatchTurn,
  interactionStore,
  children,
}: ChatProviderProps) {
  const state = useMemo<ChatStateValue>(
    () => ({ messages, activeConversationKey, assistantId }),
    [messages, activeConversationKey, assistantId],
  );

  const actions = useMemo<ChatActionsValue>(
    () => ({ sendMessage, dispatchTurn, interactionStore }),
    [sendMessage, dispatchTurn, interactionStore],
  );

  return (
    <ChatActionsContext value={actions}>
      <ChatStateContext value={state}>
        {children}
      </ChatStateContext>
    </ChatActionsContext>
  );
}

// ---------------------------------------------------------------------------
// Consumer hooks
// ---------------------------------------------------------------------------

/**
 * Read-only chat state (messages, active conversation, assistant ID).
 * Re-renders when any state value changes — use `useChatActions()` if you
 * only need to dispatch.
 */
export function useChatState(): ChatStateValue {
  const ctx = useContext(ChatStateContext);
  if (ctx === null) {
    throw new Error("useChatState must be used within a <ChatProvider>");
  }
  return ctx;
}

/**
 * Stable action dispatchers and store refs (sendMessage, dispatchTurn,
 * interactionStore).
 * Does **not** re-render when messages or active conversation change.
 */
export function useChatActions(): ChatActionsValue {
  const ctx = useContext(ChatActionsContext);
  if (ctx === null) {
    throw new Error("useChatActions must be used within a <ChatProvider>");
  }
  return ctx;
}

/**
 * Combined state + actions. Convenience hook for consumers that genuinely
 * need both — prefer `useChatState()` or `useChatActions()` when possible
 * to minimize re-renders.
 */
export function useChatContext(): ChatContextValue {
  return { ...useChatState(), ...useChatActions() };
}
