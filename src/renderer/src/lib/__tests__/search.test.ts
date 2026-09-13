import { describe, expect, it } from "vitest";
import type { Video } from "@shared/types";
import { buildFacets, selectVisible, type SearchCriteria } from "../search";

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

const criteria = (overrides: Partial<SearchCriteria> = {}): SearchCriteria => ({
  query: "",
  tags: [],
  artists: [],
  characters: [],
  genres: [],
  sort: "none",
  hideUnplayable: false,
  ...overrides,
});

const alice = makeVideo({
  id: "a",
  title: "Alpha",
  genre: "Drama",
  tags: ["red", "round"],
  artist: ["Ann"],
  character: ["Aya"],
  created: "2024-03-01T00:00:00.000Z",
});
const bob = makeVideo({
  id: "b",
  title: "Beta",
  genre: "Comedy",
  tags: ["red"],
  artist: ["Bob"],
  character: ["Bela"],
  created: "2024-01-01T00:00:00.000Z",
});
const carol = makeVideo({
  id: "c",
  title: "Gamma",
  genre: "Drama",
  tags: ["blue"],
  artist: ["Ann"],
  character: ["Aya"],
  created: "2024-02-01T00:00:00.000Z",
  playable: false,
});

const library = [alice, bob, carol];

describe("selectVisible", () => {
  it("returns the whole library when nothing is asked for", () => {
    expect(selectVisible(library, criteria()).map((v) => v.id)).toEqual(["a", "b", "c"]);
  });

  it("matches fuzzy text against the title", () => {
    expect(selectVisible(library, criteria({ query: "Alph" })).map((v) => v.id)).toEqual(["a"]);
  });

  it("ignores a whitespace-only query", () => {
    expect(selectVisible(library, criteria({ query: "   " }))).toHaveLength(3);
  });

  it("requires every tag to be present", () => {
    expect(selectVisible(library, criteria({ tags: ["red"] })).map((v) => v.id)).toEqual([
      "a",
      "b",
    ]);
    expect(selectVisible(library, criteria({ tags: ["red", "round"] })).map((v) => v.id)).toEqual([
      "a",
    ]);
  });

  it("filters by artist, character and genre", () => {
    expect(selectVisible(library, criteria({ artists: ["Ann"] })).map((v) => v.id)).toEqual([
      "a",
      "c",
    ]);
    expect(selectVisible(library, criteria({ characters: ["Bela"] })).map((v) => v.id)).toEqual([
      "b",
    ]);
    expect(selectVisible(library, criteria({ genres: ["Comedy"] })).map((v) => v.id)).toEqual([
      "b",
    ]);
  });

  it("combines facets and text as AND", () => {
    expect(
      selectVisible(library, criteria({ query: "a", tags: ["red"], artists: ["Ann"] })).map(
        (v) => v.id
      )
    ).toEqual(["a"]);
  });

  it("sorts by date, title and in both directions", () => {
    const ids = (sort: SearchCriteria["sort"]): string[] =>
      selectVisible(library, criteria({ sort })).map((v) => v.id);

    expect(ids("none")).toEqual(["a", "b", "c"]);
    expect(ids("date-desc")).toEqual(["a", "c", "b"]);
    expect(ids("date-asc")).toEqual(["b", "c", "a"]);
    expect(ids("title-asc")).toEqual(["a", "b", "c"]);
    expect(ids("title-desc")).toEqual(["c", "b", "a"]);
  });

  it("hides unplayable records only when asked", () => {
    expect(selectVisible(library, criteria()).map((v) => v.id)).toContain("c");
    expect(selectVisible(library, criteria({ hideUnplayable: true })).map((v) => v.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("applies every input together", () => {
    expect(
      selectVisible(
        library,
        criteria({ query: "a", genres: ["Drama"], sort: "title-asc", hideUnplayable: true })
      ).map((v) => v.id)
    ).toEqual(["a"]);
  });

  it("does not mutate the input array", () => {
    const snapshot = [...library];
    selectVisible(library, criteria({ sort: "title-desc" }));
    expect(library).toEqual(snapshot);
  });
});

describe("buildFacets", () => {
  it("counts every facet kind and sorts by count then name", () => {
    const facets = buildFacets(library);
    expect(facets.tags).toEqual([
      { name: "red", count: 2 },
      { name: "blue", count: 1 },
      { name: "round", count: 1 },
    ]);
    expect(facets.artists).toEqual([
      { name: "Ann", count: 2 },
      { name: "Bob", count: 1 },
    ]);
    expect(facets.genres).toEqual([
      { name: "Drama", count: 2 },
      { name: "Comedy", count: 1 },
    ]);
  });

  it("skips empty names", () => {
    const facets = buildFacets([makeVideo({ id: "d", tags: [""], genre: "" })]);
    expect(facets.tags).toEqual([]);
    expect(facets.genres).toEqual([]);
  });
});
