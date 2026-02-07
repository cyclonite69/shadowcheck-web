# Removed Invalid `app.agency_offices` Rows (2026-02-06)

These rows were present as `FBI` `resident_agency` entries but had no physical address/ZIP and appeared to be invalid/duplicate artifacts (e.g., wrong state/city combos or duplicates of an existing office in another state).

They were removed from the DB so they no longer show up as "missing contact data" during backfill, but their prior contents are recorded here for auditability.

## `id=720` (Ft. Smith, OK)

```json
{
  "id": 720,
  "city": "Ft. Smith",
  "name": "Ft. Smith",
  "phone": "(405) 290-7770",
  "state": "OK",
  "agency": "FBI",
  "website": null,
  "latitude": null,
  "location": null,
  "longitude": null,
  "created_at": "2026-02-04T21:52:53.742438",
  "source_url": "https://www.fbi.gov/contact-us/field-offices/oklahomacity/about",
  "updated_at": "2026-02-06T22:14:55.783626",
  "office_type": "resident_agency",
  "postal_code": null,
  "jurisdiction": "Adair, Haskell, LeFlore, and Sequoyah counties.",
  "phone_digits": "4052907770",
  "address_line1": null,
  "address_line2": null,
  "parent_office": "Oklahoma City",
  "source_status": "verified",
  "normalized_city": null,
  "normalized_phone": "4052907770",
  "normalized_state": null,
  "source_retrieved_at": "2026-02-04T16:56:44.994",
  "address_validated_at": null,
  "normalized_postal_code": null,
  "normalized_address_line1": null,
  "normalized_address_line2": null,
  "normalized_phone_display": "(405) 290-7770",
  "address_validation_metadata": null,
  "address_validation_provider": null,
  "address_validation_dpv_match_code": null
}
```

## `id=750` (Gallup, AZ)

```json
{
  "id": 750,
  "city": "Gallup",
  "name": "Gallup",
  "phone": "(623) 466-1999",
  "state": "AZ",
  "agency": "FBI",
  "website": null,
  "latitude": null,
  "location": null,
  "longitude": null,
  "created_at": "2026-02-04T21:52:53.742438",
  "source_url": "https://www.fbi.gov/contact-us/field-offices/phoenix/about",
  "updated_at": "2026-02-06T22:14:55.783626",
  "office_type": "resident_agency",
  "postal_code": null,
  "jurisdiction": "Apache County (north of I-40) and the Navajo Indian Reservation (in Apache County)",
  "phone_digits": "6234661999",
  "address_line1": null,
  "address_line2": null,
  "parent_office": "Phoenix",
  "source_status": "verified",
  "normalized_city": null,
  "normalized_phone": "6234661999",
  "normalized_state": null,
  "source_retrieved_at": "2026-02-04T16:57:06.737",
  "address_validated_at": null,
  "normalized_postal_code": null,
  "normalized_address_line1": null,
  "normalized_address_line2": null,
  "normalized_phone_display": "(623) 466-1999",
  "address_validation_metadata": null,
  "address_validation_provider": null,
  "address_validation_dpv_match_code": null
}
```
