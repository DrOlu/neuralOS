import assert from "node:assert/strict";
import {
  createTerminalSearchHandle,
  getOrCreateTerminalSearchHandle,
  type TerminalSearchResultsChangeHandler,
  type TerminalSearchRuntimeLike,
  type XTermSearchHandle,
} from "./terminalSearchHandle";

const SEARCH_OPTIONS = {
  caseSensitive: false,
  decorations: {
    matchBackground: "rgba(214, 154, 36, 0.18)",
    matchBorder: "rgba(214, 154, 36, 0.4)",
    matchOverviewRuler: "rgba(214, 154, 36, 0.5)",
    activeMatchBackground: "rgba(214, 154, 36, 0.42)",
    activeMatchBorder: "rgba(214, 154, 36, 0.9)",
    activeMatchColorOverviewRuler: "rgba(214, 154, 36, 0.9)",
  },
} as const;

const createRuntime = () => {
  const calls = {
    clearDecorations: 0,
    clearSelection: 0,
    findNext: [] as string[],
    findPrevious: [] as string[],
  };
  const runtime: TerminalSearchRuntimeLike = {
    searchAddon: {
      clearDecorations: () => {
        calls.clearDecorations += 1;
      },
      findNext: (query) => {
        calls.findNext.push(query);
        return true;
      },
      findPrevious: (query) => {
        calls.findPrevious.push(query);
        return true;
      },
    },
    term: {
      clearSelection: () => {
        calls.clearSelection += 1;
      },
    },
  };
  return { runtime, calls };
};

const runCase = (name: string, fn: () => void): void => {
  fn();
  console.log(`PASS ${name}`);
};

runCase(
  "getOrCreateTerminalSearchHandle keeps the same handle instance across updates",
  () => {
    const { runtime } = createRuntime();
    const runtimeRef = { current: runtime };
    const onSearchResultsChangeRef = {
      current: undefined as TerminalSearchResultsChangeHandler | undefined,
    };
    const handleRef = { current: null as XTermSearchHandle | null };

    const first = getOrCreateTerminalSearchHandle(
      handleRef,
      runtimeRef,
      onSearchResultsChangeRef,
      SEARCH_OPTIONS,
    );
    onSearchResultsChangeRef.current = () => {};
    const second = getOrCreateTerminalSearchHandle(
      handleRef,
      runtimeRef,
      onSearchResultsChangeRef,
      SEARCH_OPTIONS,
    );

    assert.equal(
      second,
      first,
      "search handle should stay referentially stable for the same ref container",
    );
  },
);

runCase(
  "createTerminalSearchHandle forwards trimmed search commands to the latest runtime",
  () => {
    const firstRuntime = createRuntime();
    const secondRuntime = createRuntime();
    const runtimeRef = { current: firstRuntime.runtime };
    const onSearchResultsChangeRef = {
      current: undefined as TerminalSearchResultsChangeHandler | undefined,
    };
    const handle = createTerminalSearchHandle(
      runtimeRef,
      onSearchResultsChangeRef,
      SEARCH_OPTIONS,
    );

    handle.setSearchQuery("  alpha  ");
    handle.findNext(" beta ");
    handle.findPrevious(" gamma ");

    runtimeRef.current = secondRuntime.runtime;
    handle.findNext("delta");

    assert.deepEqual(firstRuntime.calls.findNext, ["alpha", "beta"]);
    assert.deepEqual(firstRuntime.calls.findPrevious, ["gamma"]);
    assert.deepEqual(secondRuntime.calls.findNext, ["delta"]);
  },
);

runCase(
  "clearing search emits reset results through the latest callback reference",
  () => {
    const { runtime, calls } = createRuntime();
    const runtimeRef = { current: runtime };
    const observedPayloads: Array<{ tag: string; resultCount: number; resultIndex: number }> =
      [];
    const onSearchResultsChangeRef = {
      current: ((payload) => {
        observedPayloads.push({ tag: "initial", ...payload });
      }) as TerminalSearchResultsChangeHandler | undefined,
    };
    const handle = createTerminalSearchHandle(
      runtimeRef,
      onSearchResultsChangeRef,
      SEARCH_OPTIONS,
    );

    onSearchResultsChangeRef.current = (payload) => {
      observedPayloads.push({ tag: "updated", ...payload });
    };
    handle.clearSearch();

    assert.equal(calls.clearDecorations, 1);
    assert.equal(calls.clearSelection, 1);
    assert.deepEqual(observedPayloads, [
      { tag: "updated", resultCount: 0, resultIndex: -1 },
    ]);
  },
);

console.log("terminalSearchHandle.extreme.spec.ts passed");
