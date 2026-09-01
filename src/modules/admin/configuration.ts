export const configurationEntityTypes = [
  "property",
  "building_area",
  "service_location",
  "department",
  "support_team",
  "ticket_category",
  "ticket_subcategory",
] as const;

export type ConfigurationEntityType = (typeof configurationEntityTypes)[number];

export const buildingAreaKinds = ["building", "area"] as const;
export type BuildingAreaKind = (typeof buildingAreaKinds)[number];

export const serviceLocationKinds = ["room", "service_location"] as const;
export type ServiceLocationKind = (typeof serviceLocationKinds)[number];

export const configurationEntityLabels: Record<ConfigurationEntityType, string> = {
  property: "Properties",
  building_area: "Buildings or Areas",
  service_location: "Rooms or Service Locations",
  department: "Departments",
  support_team: "Support Teams",
  ticket_category: "Ticket Categories",
  ticket_subcategory: "Ticket Subcategories",
};
