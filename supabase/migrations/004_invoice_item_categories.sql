-- The app bills OPD consultations and IPD stays with item categories "OPD"
-- and "IPD", but the original CHECK only allowed Consultation/Lab/Radiology/
-- Pharmacy/Room/Procedure/Other — so those bills failed on fresh databases.
ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_category_check;
ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_category_check
  CHECK (category IN ('Consultation', 'OPD', 'IPD', 'Lab', 'Radiology', 'Pharmacy', 'Room', 'Procedure', 'Other'));
