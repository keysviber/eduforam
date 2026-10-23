export const educationSystems = [
  { code: "ZW", name: "Zimbabwe" },
  { code: "GB", name: "United Kingdom" },
  { code: "ZA", name: "South Africa" },
  { code: "US", name: "United States" },
  { code: "NG", name: "Nigeria" },
  { code: "KE", name: "Kenya" },
  { code: "OTHER", name: "Other / international" },
];
export function levelsFor(system: string) {
  const count =
    system === "OTHER" ? 20 : ["ZW", "GB"].includes(system) ? 13 : 12;
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const label =
      system === "ZW"
        ? n <= 7
          ? `Grade ${n}`
          : `Form ${n - 7}`
        : system === "GB"
          ? `Year ${n}`
          : system === "OTHER"
            ? `Level ${n}`
            : system === "NG"
              ? n <= 6
                ? `Primary ${n}`
                : n <= 9
                  ? `JSS ${n - 6}`
                  : `SSS ${n - 9}`
              : `Grade ${n}`;
    return { label, ordinal: n };
  });
}
export function canonicalGrade(n: number) {
  return n <= 7 ? `Grade ${n}` : n <= 13 ? `Form ${n - 7}` : `Level ${n}`;
}
export const subjects = [
  "Maths",
  "Science",
  "English",
  "Languages",
  "History",
  "Geography",
  "Computer Science",
  "Business",
  "Art",
  "Music",
  "Physical Education",
  "Other",
];
