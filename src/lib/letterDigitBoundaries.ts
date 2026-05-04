/**
 * Inserisce spazi tra sequenze di lettere (≥2) e cifre, e tra cifre e lettere (≥2),
 * così TTS e lettura trattano bene input tipo `porta25565` o `minecraft1.21`.
 */
export function normalizeLetterDigitBoundaries(text: string): string {
  let s = text;
  s = s.replace(/(\p{L}{2,})(\d+)/gu, "$1 $2");
  s = s.replace(/(\d+)(\p{L}{2,})/gu, "$1 $2");
  return s.replace(/\s{2,}/g, " ");
}
