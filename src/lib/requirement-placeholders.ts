// Nudges a society toward the level of detail vendors actually need to
// quote accurately, without forcing a structured field per category
// (product decision — see requirement-completeness brainstorm, 2026-07-21).
// Keyed by category name rather than id since categories are admin-managed
// and this is just example copy, not validated data — a category added
// later without an entry here just falls back to DEFAULT_PLACEHOLDER.
const PLACEHOLDER_BY_CATEGORY: Record<string, string> = {
  "Architect and Structural Engineering":
    "e.g. Structural stability audit for a 40-year-old, G+7 building — mention the last audit date and any visible cracks/seepage to flag.",
  "Borewell & Rain Water Harvesting":
    "e.g. New borewell up to 300ft depth for the garden area, plus a rainwater harvesting pit — mention existing soil/water table info if known.",
  "Carpentry and Woodwork":
    "e.g. Replace 6 flush doors in the common corridor, 7ft x 3ft — mention wood type (teak/plywood) and whether hardware (hinges/locks) is included.",
  "Civil/Masonry":
    "e.g. Repair cracked plaster on the 4th floor corridor ceiling, approx. 200 sqft — mention if there's an active leak causing it.",
  "Compound Wall and Barbed Wire":
    "e.g. Rebuild 150ft of compound wall, 6ft height, plus barbed wire on top — mention wall material (brick/precast) and any gate work needed.",
  "Computers & Peripherals":
    "e.g. Supply 2 desktop PCs and 1 printer for the security office — mention specs (RAM/storage) or brand preference if any.",
  "EV Charging Infrastructure":
    "e.g. Install 4 EV charging points in the basement parking — mention charger type (AC/DC), power rating, and whether a new electrical connection is needed.",
  Electrical:
    "e.g. Need 5 ceiling-mounted LED panel lights for the lobby — 18W, cool white, round fitting. Attach a photo of the existing fixture if possible.",
  "Elevator / Lift Services":
    "e.g. Repair a passenger lift stuck between floors — mention lift brand/model and the specific fault (door, motor, control panel) if known.",
  "Fabrication Work":
    "e.g. Fabricate and install 20ft of MS handrail for the staircase — mention material (MS/SS) and finish (powder-coated/painted).",
  "Fire Safety":
    "e.g. Refill and certify 20 fire extinguishers across the building — mention extinguisher types if known (ABC/CO2).",
  "Flooring and Tiling":
    "e.g. Re-tile the lobby floor, approx. 500 sqft — mention tile type (vitrified/marble), size preference, and whether old tile removal is included.",
  "Furniture Purchase":
    "e.g. Purchase 10 plastic chairs and 2 tables for the clubhouse — mention material and any brand/model preference.",
  "Furniture Rental":
    "e.g. Rent 50 chairs and 10 tables for a 2-day society event — mention event dates and setup/pickup requirements.",
  "Gardening and Landscaping":
    "e.g. Garden maintenance for the central courtyard, approx. 1,500 sqft — mention if this includes tree trimming or only lawn/plant upkeep.",
  "Generator DG Backup Services":
    "e.g. Annual maintenance for a 62.5 KVA DG set — mention make/model and whether this includes fuel/oil top-up.",
  "Gym Equipment":
    "e.g. Supply and install a treadmill and multi-gym station for the society gym — mention brand preference or budget-tier if any.",
  Hardware:
    "e.g. Supply door locks, hinges, and handles for 15 flat entrance doors — mention finish (chrome/brass) and quantity per unit.",
  Housekeeping:
    "e.g. Daily common-area cleaning for a 3-wing, 12-floor building — mention number of staff and shift timing expected.",
  "Housekeeping Material":
    "e.g. Monthly supply of cleaning consumables (phenyl, garbage bags, mops) for a 200-flat society — mention preferred brands if any.",
  "Housekeeping Services":
    "e.g. Daily common-area cleaning for a 3-wing, 12-floor building — mention number of staff and shift timing expected.",
  "Intercom Services":
    "e.g. Install/repair intercom connecting the security gate to 80 flats — mention existing system brand and whether wiring already exists.",
  Landscaping:
    "e.g. Garden maintenance for the central courtyard, approx. 1,500 sqft — mention if this includes tree trimming or only lawn/plant upkeep.",
  "Lift/Elevator AMC":
    "e.g. Annual maintenance contract for 2 passenger lifts (8-person capacity) — mention lift brand/model if known.",
  Painting:
    "e.g. Repaint the exterior of Wing B, approx. 3,000 sqft — mention current paint type, number of coats needed, and whether waterproofing prep is required.",
  "Parking Sheds and Covers":
    "e.g. Install a 2-wheeler parking shed covering 500 sqft — mention roofing material (tin/polycarbonate) and pillar requirements.",
  "Pest Control":
    "e.g. Cockroach and rodent treatment for the basement parking and garbage room — mention frequency needed (one-time/quarterly).",
  "Play Area Equipment":
    "e.g. Supply and install a slide and 2 swings for the children's play area — mention age group and available space dimensions.",
  Plumbing:
    "e.g. Leaking pipe under the kitchen sink in Wing A, Flat 302 — mention pipe material (CPVC/GI) and whether it's a joint leak or a crack.",
  "Redevelopment Advisory":
    "e.g. Feasibility study and advisory for redeveloping a 3-wing, 60-flat society — mention current FSI status and whether a structural audit already exists.",
  "Roofing Solutions":
    "e.g. Replace roofing sheets over the parking area, approx. 1,000 sqft — mention current material and any leakage issues.",
  "STP/WTP & Water Treatment":
    "e.g. AMC for a 20 KLD sewage treatment plant — mention plant make/model and current operational issues if any.",
  "Security Personnel":
    "e.g. 2 security guards for 12-hour shifts at the main gate — mention whether armed/unarmed and any specific certification required.",
  "Security Systems":
    "e.g. Install 8 CCTV cameras covering the main gate and parking — mention indoor/outdoor mix and whether NVR/storage is needed.",
  Signage:
    "e.g. Wing-wise nameboards and directional signage for a 4-wing society — mention material (acrylic/metal) and approximate sizes.",
  "Sliding Windows":
    "e.g. Replace 10 sliding windows in the common lobby, approx. 4ft x 5ft each — mention frame material (UPVC/aluminium) and glass type.",
  "Solar Power Services":
    "e.g. Install a rooftop solar system for common-area lighting, approx. 5kW — mention available roof area and current sanctioned load.",
  "Swimming Pool Services":
    "e.g. Monthly maintenance for a 30ft x 15ft swimming pool — mention whether this includes chemical dosing and filter servicing.",
  "Water Tanker":
    "e.g. Daily 5,000L water tanker supply for 2 weeks during a shortage — mention delivery timing and access point for the tanker.",
  Waterproofing:
    "e.g. Terrace waterproofing for a 2,500 sqft roof — mention if there's existing membrane to remove, and any known leak points.",
  "Wifi and Telecom":
    "e.g. Common-area WiFi covering the lobby and clubhouse — mention required coverage area and expected number of connected devices.",
};

const DEFAULT_PLACEHOLDER =
  "What needs fixing, where, and any relevant details — quantities, dimensions, materials, or brand preferences vendors would need to quote accurately.";

export function descriptionPlaceholderFor(categoryNames: string[]): string {
  for (const name of categoryNames) {
    if (PLACEHOLDER_BY_CATEGORY[name]) return PLACEHOLDER_BY_CATEGORY[name];
  }
  return DEFAULT_PLACEHOLDER;
}
