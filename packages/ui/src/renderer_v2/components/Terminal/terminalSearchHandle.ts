import type { ISearchOptions } from "@xterm/addon-search";

export interface TerminalSearchResultsPayload {
  resultCount: number;
  resultIndex: number;
}

export type TerminalSearchResultsChangeHandler = (
  payload: TerminalSearchResultsPayload,
) => void;

export interface XTermSearchHandle {
  setSearchQuery: (query: string) => void;
  findNext: (query: string) => void;
  findPrevious: (query: string) => void;
  clearSearch: () => void;
}

interface SearchAddonLike {
  clearDecorations: () => void;
  findNext: (query: string, options?: ISearchOptions) => boolean;
  findPrevious: (query: string, options?: ISearchOptions) => boolean;
}

interface TerminalLike {
  clearSelection: () => void;
}

export interface TerminalSearchRuntimeLike {
  searchAddon: SearchAddonLike;
  term: TerminalLike;
}

interface RefValue<T> {
  current: T;
}

const emitClearedResults = (
  onSearchResultsChangeRef: RefValue<
    TerminalSearchResultsChangeHandler | undefined
  >,
): void => {
  onSearchResultsChangeRef.current?.({ resultCount: 0, resultIndex: -1 });
};

export const createTerminalSearchHandle = (
  runtimeRef: RefValue<TerminalSearchRuntimeLike | null>,
  onSearchResultsChangeRef: RefValue<
    TerminalSearchResultsChangeHandler | undefined
  >,
  searchOptions: ISearchOptions,
): XTermSearchHandle => ({
  setSearchQuery: (query: string) => {
    const runtime = runtimeRef.current;
    const normalizedQuery = String(query || "").trim();
    if (!runtime) {
      return;
    }
    if (!normalizedQuery) {
      runtime.searchAddon.clearDecorations();
      runtime.term.clearSelection();
      emitClearedResults(onSearchResultsChangeRef);
      return;
    }
    runtime.searchAddon.findNext(normalizedQuery, searchOptions);
  },
  findNext: (query: string) => {
    const runtime = runtimeRef.current;
    const normalizedQuery = String(query || "").trim();
    if (!runtime || !normalizedQuery) {
      return;
    }
    runtime.searchAddon.findNext(normalizedQuery, searchOptions);
  },
  findPrevious: (query: string) => {
    const runtime = runtimeRef.current;
    const normalizedQuery = String(query || "").trim();
    if (!runtime || !normalizedQuery) {
      return;
    }
    runtime.searchAddon.findPrevious(normalizedQuery, searchOptions);
  },
  clearSearch: () => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    runtime.searchAddon.clearDecorations();
    runtime.term.clearSelection();
    emitClearedResults(onSearchResultsChangeRef);
  },
});

export const getOrCreateTerminalSearchHandle = (
  handleRef: RefValue<XTermSearchHandle | null>,
  runtimeRef: RefValue<TerminalSearchRuntimeLike | null>,
  onSearchResultsChangeRef: RefValue<
    TerminalSearchResultsChangeHandler | undefined
  >,
  searchOptions: ISearchOptions,
): XTermSearchHandle => {
  if (!handleRef.current) {
    handleRef.current = createTerminalSearchHandle(
      runtimeRef,
      onSearchResultsChangeRef,
      searchOptions,
    );
  }
  return handleRef.current;
};
