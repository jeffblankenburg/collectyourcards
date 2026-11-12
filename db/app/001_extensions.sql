-- Extensions needed by the app layer. pg_trgm powers fuzzy/typo-tolerant entity
-- search (already installed; included for reproducibility). unaccent is optional
-- and only used inside search RPCs, never in an index expression (not immutable).
create extension if not exists pg_trgm;
create extension if not exists unaccent;
