import {
  Activity,
  Bug,
  Droplet,
  FlaskConical,
  HeartPulse,
  type LucideIcon,
  Package,
  ScanLine,
  Sun,
} from "lucide-react";

import type { Test } from "./types";

export type CategoryKey =
  | "packages"
  | "heart"
  | "diabetes"
  | "organ"
  | "vitamins"
  | "infection"
  | "imaging"
  | "blood";

interface Category {
  key: CategoryKey;
  label: string;
  icon: LucideIcon;
  /** Lower-cased substrings of a test name that place it in this category. */
  keywords: string[];
}

// The API has no test categories, so tests are grouped by name for browsing. Order matters: the
// first matching category wins, and "blood" is the catch-all for general pathology.
export const CATEGORIES: Category[] = [
  { key: "packages", label: "Health packages", icon: Package, keywords: ["package", "checkup"] },
  { key: "heart", label: "Heart", icon: HeartPulse, keywords: ["lipid", "ecg", "cardiac"] },
  { key: "diabetes", label: "Diabetes", icon: Activity, keywords: ["glucose", "hba1c", "sugar"] },
  {
    key: "organ",
    label: "Liver, kidney & thyroid",
    icon: FlaskConical,
    keywords: ["liver", "kidney", "thyroid", "urine"],
  },
  { key: "vitamins", label: "Vitamins & minerals", icon: Sun, keywords: ["vitamin", "iron"] },
  {
    key: "infection",
    label: "Infections & fever",
    icon: Bug,
    keywords: ["dengue", "widal", "covid", "crp"],
  },
  { key: "imaging", label: "Imaging", icon: ScanLine, keywords: ["x-ray", "scan", "mri", "ultrasound"] },
  { key: "blood", label: "Blood tests", icon: Droplet, keywords: [] },
];

export function categoryOf(test: Test): Category {
  const name = test.name.toLowerCase();
  return (
    CATEGORIES.find((c) => c.keywords.some((keyword) => name.includes(keyword))) ??
    CATEGORIES[CATEGORIES.length - 1]
  );
}
