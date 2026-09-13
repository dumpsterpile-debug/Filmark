import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Video } from "@shared/types";
import i18n from "@/i18n";
import { blankCriteria, resetAppStore } from "@/test/resetStore";
import SearchBar from "@/components/SearchBar";
import { useAppStore } from "@/store/useAppStore";

function makeVideo(overrides: Partial<Video> & { id: string }): Video {
  return {
    file: `${overrides.id}.mp4`,
    thumbnail: "",
    title: overrides.id,
    durationMs: 0,
    genre: "",
    tags: [],
    artist: [],
    character: [],
    created: "2024-01-01T00:00:00.000Z",
    modified: "2024-01-01T00:00:00.000Z",
    extension: "mp4",
    ...overrides,
  };
}

const tagged = makeVideo({ id: "a", tags: ["red"], genre: "Drama" });

function renderSearchBar(): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <SearchBar />
    </MemoryRouter>
  );
}

beforeAll(async () => {
  await i18n.changeLanguage("en");
});

beforeEach(() => {
  resetAppStore({ videos: [tagged] });
});

describe("SearchBar", () => {
  it("renders applied chips from the single criteria value and removes one on click", async () => {
    const user = userEvent.setup();
    resetAppStore({
      videos: [tagged],
      criteria: blankCriteria({ tags: ["red"], genres: ["Drama"] }),
    });
    renderSearchBar();

    expect(screen.getByRole("button", { name: "red" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Drama" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "red" }));

    expect(useAppStore.getState().criteria.tags).toEqual([]);
    expect(useAppStore.getState().criteria.genres).toEqual(["Drama"]);
  });

  it("keeps the typed query in the draft until the search is applied", async () => {
    const user = userEvent.setup();
    renderSearchBar();

    await user.type(screen.getByTestId("search-input"), "hello");

    expect(useAppStore.getState().draft.query).toBe("hello");
    expect(useAppStore.getState().criteria.query).toBe("");

    await user.keyboard("{Enter}");

    expect(useAppStore.getState().criteria.query).toBe("hello");
  });

  it("toggles a facet chip in the panel without touching the applied criteria", async () => {
    const user = userEvent.setup();
    const { container } = renderSearchBar();

    await user.click(screen.getByTestId("search-input"));

    const panel = container.querySelector(".advanced-panel");
    expect(panel).not.toBeNull();
    await user.click(within(panel as HTMLElement).getByText("red"));

    expect(useAppStore.getState().draft.tags).toEqual(["red"]);
    expect(useAppStore.getState().criteria.tags).toEqual([]);
  });
});
