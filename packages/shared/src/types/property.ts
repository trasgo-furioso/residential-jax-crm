export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  county: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Owner {
  name: string;
  mailing_address: Address;
  is_regional: boolean;
}

export interface Structure {
  year_built: number;
  sqft: number;
  bedrooms: number;
  bathrooms: number;
  stories: number;
  roof_material: string;
  roof_year: number;
  condition: string;
}

export interface Provenance {
  contributing_sources: string[];
  collection_timestamps: Record<string, string>;
  last_pipeline_run: string;
  reconciliation_confidence: number;
}

export interface DerivedSignals {
  roof_age_years: number;
  ownership_tenure_years: number;
  is_regional_owner: boolean;
  water_proximity_ft: number;
  transit_distance_mi: number;
}

export interface Property {
  parcel_id: string;
  address: Address;
  assessed_value: number;
  ownership: Owner[];
  structure: Structure;
  coordinates: Coordinates;
  provenance: Provenance;
  derived_signals: DerivedSignals;
}
