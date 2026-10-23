import { useEffect, useState } from "react";
import { backend } from "./backend";
import { educationSystems, levelsFor } from "./education";
export function useEducationCatalog() {
  const [systems, setSystems] = useState(educationSystems),
    [levels, setLevels] = useState<
      { system_code: string; label: string; ordinal: number }[]
    >([]);
  useEffect(() => {
    let active = true;
    if (backend)
      void Promise.all([
        backend.from("education_systems").select("code,name").order("name"),
        backend
          .from("education_levels")
          .select("system_code,label,ordinal")
          .order("ordinal"),
      ]).then(([s, l]) => {
        if (active && !s.error && !l.error) {
          setSystems(s.data || educationSystems);
          setLevels(l.data || []);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  return {
    systems,
    levelsForSystem: (code: string) =>
      levels.length
        ? levels.filter((x) => x.system_code === code)
        : levelsFor(code),
  };
}
