import { describe, it, expect } from "vitest";
import { slugify, uniqueSlug } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases and replaces spaces", () => {
    expect(slugify("FitClub Dakar")).toBe("fitclub-dakar");
  });
  it("removes accents", () => {
    expect(slugify("Sénégal Élite")).toBe("senegal-elite");
  });
  it("strips non-alphanumeric punctuation", () => {
    expect(slugify("Power & Muscle, Inc.")).toBe("power-muscle-inc");
  });
  it("collapses repeated dashes", () => {
    expect(slugify("Hello   World!!!")).toBe("hello-world");
  });
  it("trims leading and trailing dashes", () => {
    expect(slugify("---hello---")).toBe("hello");
  });
});

describe("uniqueSlug", () => {
  it("returns base slug when not taken", async () => {
    const result = await uniqueSlug("fitclub", async () => false);
    expect(result).toBe("fitclub");
  });
  it("appends -2 when base taken once", async () => {
    let calls = 0;
    const exists = async (s: string) => {
      calls++;
      return s === "fitclub";
    };
    const result = await uniqueSlug("fitclub", exists);
    expect(result).toBe("fitclub-2");
    expect(calls).toBe(2);
  });
  it("keeps incrementing until free", async () => {
    const taken = new Set(["fitclub", "fitclub-2", "fitclub-3"]);
    const result = await uniqueSlug("fitclub", async (s) => taken.has(s));
    expect(result).toBe("fitclub-4");
  });
});
