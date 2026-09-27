import { parseLocation, type CatalogIndex, type Offering, type TestSummary } from "./catalog";
import { categoryOf } from "./test-categories";
import type { Centre } from "./types";

export const ALL = "all";

export type TestSort = "popular" | "price-asc" | "price-desc" | "name";

export const TEST_SORTS: { value: TestSort; label: string }[] = [
  { value: "popular", label: "Most available" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name (A–Z)" },
];

export const TEST_FILTER_DEFAULTS = {
  q: "",
  city: ALL,
  lab: ALL,
  category: ALL,
  sort: "popular",
};

const matches = (text: string, query: string) => text.toLowerCase().includes(query.toLowerCase());

export function offeringMatchesPlace(offering: Offering, city: string, lab: string) {
  return (
    (city === ALL || parseLocation(offering.centre.location).city === city) &&
    (lab === ALL || String(offering.centre.lab.id) === lab)
  );
}

/**
 * Tests narrowed to the offerings in the chosen city/lab, so "starting from" prices and centre
 * counts describe what the patient can actually book there.
 */
export function filterTests(index: CatalogIndex, filters: typeof TEST_FILTER_DEFAULTS) {
  const q = filters.q.trim();
  const result: TestSummary[] = [];
  for (const summary of index.tests) {
    if (q && !matches(summary.test.name, q) && !matches(summary.test.description, q)) continue;
    if (filters.category !== ALL && categoryOf(summary.test).key !== filters.category) continue;
    const offerings = summary.offerings.filter((o) =>
      offeringMatchesPlace(o, filters.city, filters.lab)
    );
    if (offerings.length === 0) continue;
    const prices = offerings.map((o) => o.price);
    result.push({
      test: summary.test,
      offerings,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
    });
  }

  const sorters: Record<TestSort, (a: TestSummary, b: TestSummary) => number> = {
    popular: (a, b) => b.offerings.length - a.offerings.length || a.minPrice - b.minPrice,
    "price-asc": (a, b) => a.minPrice - b.minPrice,
    "price-desc": (a, b) => b.minPrice - a.minPrice,
    name: (a, b) => a.test.name.localeCompare(b.test.name),
  };
  return result.sort(sorters[filters.sort as TestSort] ?? sorters.popular);
}

export const CENTRE_FILTER_DEFAULTS = { q: "", city: ALL, lab: ALL };

export interface CentreListing {
  centre: Centre;
  testCount: number;
  minPrice: number | null;
}

export function filterCentres(index: CatalogIndex, filters: typeof CENTRE_FILTER_DEFAULTS) {
  const q = filters.q.trim();
  return index.centres
    .filter((centre) => {
      const { city } = parseLocation(centre.location);
      if (filters.city !== ALL && city !== filters.city) return false;
      if (filters.lab !== ALL && String(centre.lab.id) !== filters.lab) return false;
      return !q || matches(centre.name, q) || matches(centre.location, q);
    })
    .map((centre): CentreListing => {
      const prices = index.offerings.filter((o) => o.centre.id === centre.id).map((o) => o.price);
      return {
        centre,
        testCount: prices.length,
        minPrice: prices.length ? Math.min(...prices) : null,
      };
    });
}

export function cityOptions(cities: string[]) {
  return [{ value: ALL, label: "All cities" }, ...cities.map((c) => ({ value: c, label: c }))];
}

export function labOptions(labs: { id: number; name: string }[]) {
  return [
    { value: ALL, label: "All labs" },
    ...labs.map((lab) => ({ value: String(lab.id), label: lab.name })),
  ];
}
