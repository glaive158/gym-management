import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("renders header + rows", () => {
    const csv = toCsv([{ a: 1, b: "hi" }, { a: 2, b: "yo" }], ["a", "b"]);
    expect(csv).toBe("a,b\n1,hi\n2,yo");
  });
  it("escapes commas in values", () => {
    const csv = toCsv([{ a: "x,y" }], ["a"]);
    expect(csv).toBe(`a\n"x,y"`);
  });
  it("escapes double quotes by doubling", () => {
    const csv = toCsv([{ a: `he said "hi"` }], ["a"]);
    expect(csv).toBe(`a\n"he said ""hi"""`);
  });
  it("handles null/undefined as empty", () => {
    const csv = toCsv([{ a: null, b: undefined }], ["a", "b"]);
    expect(csv).toBe("a,b\n,");
  });
  it("formats Date as ISO", () => {
    const d = new Date("2026-05-25T10:00:00Z");
    const csv = toCsv([{ a: d }], ["a"]);
    expect(csv).toBe("a\n2026-05-25T10:00:00.000Z");
  });
});
