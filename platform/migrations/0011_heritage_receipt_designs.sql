-- Additive legacy-studio design options. Existing receipt and template records are unchanged.
ALTER TABLE tenant_designs ADD COLUMN secondary_color TEXT NOT NULL DEFAULT '#19223b';
ALTER TABLE tenant_designs ADD COLUMN font_family TEXT NOT NULL DEFAULT 'modern';
ALTER TABLE tenant_designs ADD COLUMN text_logo_style TEXT NOT NULL DEFAULT 'split';
