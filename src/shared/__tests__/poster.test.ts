import { describe, expect, it } from "vitest";
import { parsePosterUrl } from "../poster";

describe("parsePosterUrl", () => {
  it("extracts a protocol-relative poster url and prepends https", () => {
    expect(
      parsePosterUrl(
        "url(&quot;//i.iwara.tv/image/original/7e010291-42f1-4a25-9835-af5dca437b8a/thumbnail-11.jpg&quot;)"
      )
    ).toBe(
      "https://i.iwara.tv/image/original/7e010291-42f1-4a25-9835-af5dca437b8a/thumbnail-11.jpg"
    );
  });

  it("handles double-quoted urls without html entities", () => {
    expect(parsePosterUrl('url("//i.iwara.tv/a.jpg")')).toBe("https://i.iwara.tv/a.jpg");
  });

  it("keeps an absolute http(s) url unchanged", () => {
    expect(parsePosterUrl("url('https://cdn.example.com/poster.png')")).toBe(
      "https://cdn.example.com/poster.png"
    );
  });

  it("returns empty string when no background url is present", () => {
    expect(parsePosterUrl("background: none")).toBe("");
    expect(parsePosterUrl("")).toBe("");
  });
});
