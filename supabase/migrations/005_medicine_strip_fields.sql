-- Sheet/strip pricing on medicines: tablets-per-sheet plus the sheet price,
-- so the pharmacy form can calculate single-tablet and sheet prices both ways.
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS strip_size INTEGER NOT NULL DEFAULT 10;
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS sheet_price DOUBLE PRECISION NOT NULL DEFAULT 0;
