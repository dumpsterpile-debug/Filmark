import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blankCriteria, blankDraft, resetAppStore } from "@/test/resetStore";
import { useAppStore } from "../useAppStore";

describe("search criteria", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetAppStore();
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("only turns the draft into the applied criteria on demand", () => {
    const { setDraftQuery, toggleDraft, applySearch } = useAppStore.getState();

    setDraftQuery("hello");
    toggleDraft("tags", "red");
    expect(useAppStore.getState().criteria).toEqual(blankCriteria());

    applySearch();
    expect(useAppStore.getState().criteria).toEqual(
      blankCriteria({ query: "hello", tags: ["red"] })
    );
    expect(useAppStore.getState().advancedOpen).toBe(false);
  });

  it("toggles a draft facet on and back off", () => {
    useAppStore.getState().toggleDraft("artists", "a");
    expect(useAppStore.getState().draft.artists).toEqual(["a"]);

    useAppStore.getState().toggleDraft("artists", "a");
    expect(useAppStore.getState().draft.artists).toEqual([]);
  });

  it("clears every draft facet and the draft query", () => {
    useAppStore.setState({ draft: blankDraft({ query: "x", tags: ["t"], genres: ["g"] }) });

    useAppStore.getState().clearDrafts();

    expect(useAppStore.getState().draft).toEqual(blankDraft());
    expect(useAppStore.getState().criteria).toEqual(blankCriteria());
  });

  it("removes only the targeted applied facet", () => {
    useAppStore.setState({ criteria: blankCriteria({ tags: ["a", "b"], genres: ["g"] }) });

    useAppStore.getState().removeApplied("tags", "a");

    expect(useAppStore.getState().criteria).toEqual(blankCriteria({ tags: ["b"], genres: ["g"] }));
  });

  it("keeps sort and the hide switch inside the applied criteria, never in the draft", () => {
    useAppStore.getState().setSortMode("date-desc");
    useAppStore.getState().setHideUnplayable(true);

    expect(useAppStore.getState().criteria).toEqual(
      blankCriteria({ sort: "date-desc", hideUnplayable: true })
    );
    expect(useAppStore.getState().draft).toEqual(blankDraft());
  });

  it("resets paging whenever the applied criteria change", () => {
    useAppStore.setState({ page: 4 });
    useAppStore.getState().applySearch();
    expect(useAppStore.getState().page).toBe(1);

    useAppStore.setState({ page: 4 });
    useAppStore.getState().removeApplied("tags", "x");
    expect(useAppStore.getState().page).toBe(1);

    useAppStore.setState({ page: 4 });
    useAppStore.getState().setSortMode("title-asc");
    expect(useAppStore.getState().page).toBe(1);
  });
});
