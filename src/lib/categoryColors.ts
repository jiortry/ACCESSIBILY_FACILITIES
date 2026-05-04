/** HSL variable names — must match :root in index.css */
export const CATEGORY_COLOR_VARS = [
  "--cat-1",
  "--cat-2",
  "--cat-3",
  "--cat-4",
  "--cat-5",
  "--cat-6",
  "--cat-7",
  "--cat-8",
] as const;

export function categoryColorVar(categoryIndex: number): string {
  return CATEGORY_COLOR_VARS[categoryIndex % CATEGORY_COLOR_VARS.length]!;
}
