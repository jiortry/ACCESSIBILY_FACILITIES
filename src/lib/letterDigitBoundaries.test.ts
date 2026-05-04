import { describe, it, expect } from "vitest";
import { normalizeLetterDigitBoundaries } from "@/lib/letterDigitBoundaries";

describe("normalizeLetterDigitBoundaries", () => {
  it("separa parola italiana e porta MC", () => {
    expect(normalizeLetterDigitBoundaries("porta25565")).toBe("porta 25565");
  });
  it("separa nome e versione", () => {
    expect(normalizeLetterDigitBoundaries("minecraft1.21.4")).toBe("minecraft 1.21.4");
  });
  it("lascia invariato testo già spaziato", () => {
    expect(normalizeLetterDigitBoundaries("porta 25565")).toBe("porta 25565");
  });
  it("non spezza rune singole tipo prefisso v1", () => {
    expect(normalizeLetterDigitBoundaries("v1.20")).toBe("v1.20");
  });
  it("separa cifre e parola dopo", () => {
    expect(normalizeLetterDigitBoundaries("25565tcp")).toBe("25565 tcp");
  });
});
