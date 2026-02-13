-- Add imageUrls column to product_damages table
ALTER TABLE product_damages 
ADD COLUMN image_urls TEXT[] DEFAULT '{}';

-- Add comment to describe the column
COMMENT ON COLUMN product_damages.image_urls IS 'Array of image URLs for damage evidence';
