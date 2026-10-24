import fr from "./fr.json";
import ar from "./ar.json";

export type Language = "en" | "fr" | "ar";
export const dictionaries: Record<"fr" | "ar", Record<string, string>> = { fr, ar };
