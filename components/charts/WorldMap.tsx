import worldMapData from "@svg-maps/world";

/** @svg-maps/world's actual shape — declared locally rather than
 * depending on its (unpublished-as-a-separate-package) shared type, to
 * avoid a build-time type-resolution risk. */
interface WorldMapLocation {
  id: string;
  name: string;
  path: string;
}
interface WorldMapData {
  viewBox: string;
  label?: string;
  locations: WorldMapLocation[];
}

const world = worldMapData as unknown as WorldMapData;

/**
 * A real world map (CC-BY-4.0, @svg-maps/world — actual country
 * boundaries, not a stylized approximation) with every country that has
 * at least one real purchase colored blue. countryCodes are real
 * 2-letter codes (e.g. "US", "KE") — matches what's stored on Order via
 * lib/geo.ts's real IP-based geotagging.
 */
export function WorldMap({ highlightedCountryCodes }: { highlightedCountryCodes: Set<string> }) {
  return (
    <svg viewBox={world.viewBox} style={{ width: "100%", height: "auto" }}>
      {world.locations.map((loc) => (
        <path
          key={loc.id}
          d={loc.path}
          fill={highlightedCountryCodes.has(loc.id.toUpperCase()) ? "#2451B7" : "var(--line)"}
          stroke="var(--paper)"
          strokeWidth={0.5}
        >
          <title>{loc.name}</title>
        </path>
      ))}
    </svg>
  );
}
