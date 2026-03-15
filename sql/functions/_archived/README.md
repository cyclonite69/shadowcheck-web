These SQL helper files are not part of the canonical migration/runtime path.

Files archived here are kept only as historical or operator reference material.
If a function must exist in a live database, its definition should live in:

- `sql/migrations/20260216_consolidated_*.sql`, or
- a current forward migration

Do not treat files in this directory as automatically applied runtime assets.
