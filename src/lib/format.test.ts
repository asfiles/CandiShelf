import { describe, it, expect } from "vitest";
import { initials, formatBytes, scorePercent, fileName } from "./format";

describe("initials", () => {
  it("handles full names", () => {
    expect(initials("Ada Kovács")).toBe("AK");
    expect(initials("Bruno Miguel Almeida")).toBe("BA");
  });
  it("handles single names", () => {
    expect(initials("Chen")).toBe("CH");
  });
  it("handles empty input", () => {
    expect(initials("   ")).toBe("?");
  });
});

describe("formatBytes", () => {
  it("formats across units", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(90_000_000)).toBe("86 MB");
    expect(formatBytes(2_000_000_000)).toBe("1.9 GB");
  });
});

describe("scorePercent", () => {
  it("clamps and rounds", () => {
    expect(scorePercent(0.5)).toBe(50);
    expect(scorePercent(1.4)).toBe(100);
    expect(scorePercent(-0.2)).toBe(0);
  });
});

describe("fileName", () => {
  it("extracts basename from posix and windows paths", () => {
    expect(fileName("/home/user/cv.pdf")).toBe("cv.pdf");
    expect(fileName("C:\\Users\\me\\cv.docx")).toBe("cv.docx");
  });
});
