import { listCentres, listCentreTests } from "./api";
import type { Centre, Test } from "./types";

/** One test offered at one centre, with its centre-specific price. */
export interface Offering {
  id: number;
  price: number;
  test: Test;
  centre: Centre;
}

/** A test aggregated across every centre that offers it. */
export interface TestSummary {
  test: Test;
  minPrice: number;
  maxPrice: number;
  offerings: Offering[];
}

export interface CatalogIndex {
  centres: Centre[];
  offerings: Offering[];
  tests: TestSummary[];
  cities: string[];
  labs: { id: number; name: string }[];
}

let cached: Promise<CatalogIndex> | null = null;

async function buildIndex(): Promise<CatalogIndex> {
  const centres = await listCentres();
  const perCentre = await Promise.all(centres.map((centre) => listCentreTests(centre.id)));

  const offerings = centres.flatMap((centre, i) =>
    perCentre[i].map((ct) => ({ id: ct.id, price: Number(ct.price), test: ct.test, centre }))
  );

  const byTest = new Map<number, TestSummary>();
  for (const offering of offerings) {
    const summary = byTest.get(offering.test.id) ?? {
      test: offering.test,
      minPrice: Infinity,
      maxPrice: 0,
      offerings: [],
    };
    summary.minPrice = Math.min(summary.minPrice, offering.price);
    summary.maxPrice = Math.max(summary.maxPrice, offering.price);
    summary.offerings.push(offering);
    byTest.set(offering.test.id, summary);
  }

  const labs = new Map(centres.map((c) => [c.lab.id, c.lab]));
  return {
    centres,
    offerings,
    tests: [...byTest.values()].sort((a, b) => a.test.name.localeCompare(b.test.name)),
    cities: [...new Set(centres.map((c) => parseLocation(c.location).city))].sort(),
    labs: [...labs.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/**
 * The whole public catalog (centres × their active tests), fetched once per session and shared by
 * every page. The backend has no cross-centre search endpoint, so search/filter/compare run over
 * this in-memory index.
 */
export function loadCatalog(): Promise<CatalogIndex> {
  cached ??= buildIndex().catch((err) => {
    cached = null;
    throw err;
  });
  return cached;
}

export function invalidateCatalog() {
  cached = null;
}

/** Seeded centres use "Locality, City"; a free-form location is treated as the city itself. */
export function parseLocation(location: string): { locality: string | null; city: string } {
  const parts = location.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return { locality: null, city: location.trim() };
  return { locality: parts.slice(0, -1).join(", "), city: parts[parts.length - 1] };
}

/** Centre names are "<Lab> - <Branch>"; the branch reads better when the lab is shown alongside. */
export function branchName(centre: Centre): string {
  const prefix = `${centre.lab.name} - `;
  return centre.name.startsWith(prefix) ? centre.name.slice(prefix.length) : centre.name;
}
