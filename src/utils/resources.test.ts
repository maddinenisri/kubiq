import { describe, it, expect } from "vitest";
import { parseCpu, parseMemory, formatMemory, formatCpu } from "./resources";

describe("parseCpu", () => {
  it("parses millicores", () => expect(parseCpu("250m")).toBe(250));
  it("parses whole cores", () => expect(parseCpu("1")).toBe(1000));
  it("parses fractional cores", () => expect(parseCpu("0.5")).toBe(500));
  it("parses nanocores", () => expect(parseCpu("100000000n")).toBe(100));
  it("handles empty", () => expect(parseCpu("")).toBe(0));
  it("parses 4 cores", () => expect(parseCpu("4")).toBe(4000));
});

describe("parseMemory", () => {
  it("parses Mi", () => expect(parseMemory("256Mi")).toBe(256 * 1024 * 1024));
  it("parses Gi", () => expect(parseMemory("1Gi")).toBe(1024 * 1024 * 1024));
  it("parses Ki", () => expect(parseMemory("1024Ki")).toBe(1024 * 1024));
  it("parses raw bytes", () => expect(parseMemory("134217728")).toBe(134217728));
  it("handles empty", () => expect(parseMemory("")).toBe(0));
  it("parses 16Gi", () => expect(parseMemory("16Gi")).toBe(16 * 1024 ** 3));
});

describe("formatMemory", () => {
  it("formats Gi", () => expect(formatMemory(1024 ** 3)).toBe("1.0Gi"));
  it("formats Mi", () => expect(formatMemory(256 * 1024 ** 2)).toBe("256Mi"));
});

describe("formatCpu", () => {
  it("formats millicores", () => expect(formatCpu(250)).toBe("250m"));
  it("formats cores", () => expect(formatCpu(1500)).toBe("1.5"));
});
