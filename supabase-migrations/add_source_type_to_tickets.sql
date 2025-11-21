-- Add source_type column to tickets table
-- This column indicates if a ticket was created manually or from a PDF

ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS source_type TEXT CHECK (source_type IN ('pdf', 'manual'));

-- Update existing tickets based on their characteristics:
-- 1. If file_name = 'Manual' -> manual entry
-- 2. If file_name ends with .pdf -> PDF upload
-- 3. If file_url is NULL -> manual entry
-- 4. Default to PDF for others
UPDATE tickets 
SET source_type = CASE 
  WHEN file_name = 'Manual' THEN 'manual'
  WHEN file_name ILIKE '%.pdf' THEN 'pdf'
  WHEN file_url IS NULL THEN 'manual'
  ELSE 'pdf'
END
WHERE source_type IS NULL;

-- Add comment to document the column
COMMENT ON COLUMN tickets.source_type IS 'Origin of the ticket: pdf (uploaded PDF file) or manual (manually entered)';
