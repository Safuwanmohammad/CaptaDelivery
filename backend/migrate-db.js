const pool = require('./db');

async function migrateDatabase() {
  try {
    console.log('🔄 Starting database migration...');
    
    // Check if images column exists
    const checkImages = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'images'
    `);
    
    if (checkImages.rows.length > 0) {
      console.log(`Current images column type: ${checkImages.rows[0].data_type}`);
      
      // If it's text[] or text, convert to jsonb
      if (checkImages.rows[0].data_type === 'text[]' || checkImages.rows[0].data_type === 'text') {
        console.log('🔄 Converting images column from text[] to jsonb...');
        
        // Add a temporary jsonb column
        await pool.query(`
          ALTER TABLE products 
          ADD COLUMN IF NOT EXISTS images_new jsonb DEFAULT '[]'::jsonb
        `);
        console.log('✅ Created temporary images_new column');
        
        // Copy data from old column to new column
        await pool.query(`
          UPDATE products 
          SET images_new = COALESCE(
            CASE 
              WHEN images IS NULL THEN '[]'::jsonb
              WHEN jsonb_typeof(images::jsonb) = 'array' THEN images::jsonb
              ELSE jsonb_build_array(images)
            END,
            '[]'::jsonb
          )
          WHERE images IS NOT NULL
        `);
        console.log('✅ Data copied to images_new');
        
        // Drop the old column
        await pool.query(`
          ALTER TABLE products 
          DROP COLUMN IF EXISTS images
        `);
        console.log('✅ Dropped old images column');
        
        // Rename the new column
        await pool.query(`
          ALTER TABLE products 
          RENAME COLUMN images_new TO images
        `);
        console.log('✅ Renamed images_new to images');
        
        // Set default value
        await pool.query(`
          ALTER TABLE products 
          ALTER COLUMN images SET DEFAULT '[]'::jsonb
        `);
        console.log('✅ Set default value for images');
      }
    }
    
    // Handle variants column similarly
    const checkVariants = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'variants'
    `);
    
    if (checkVariants.rows.length > 0) {
      console.log(`Current variants column type: ${checkVariants.rows[0].data_type}`);
      
      if (checkVariants.rows[0].data_type === 'text[]' || checkVariants.rows[0].data_type === 'text') {
        console.log('🔄 Converting variants column from text[] to jsonb...');
        
        await pool.query(`
          ALTER TABLE products 
          ADD COLUMN IF NOT EXISTS variants_new jsonb DEFAULT '[]'::jsonb
        `);
        console.log('✅ Created temporary variants_new column');
        
        await pool.query(`
          UPDATE products 
          SET variants_new = COALESCE(
            CASE 
              WHEN variants IS NULL THEN '[]'::jsonb
              WHEN jsonb_typeof(variants::jsonb) = 'array' THEN variants::jsonb
              ELSE jsonb_build_array(variants)
            END,
            '[]'::jsonb
          )
          WHERE variants IS NOT NULL
        `);
        console.log('✅ Data copied to variants_new');
        
        await pool.query(`
          ALTER TABLE products 
          DROP COLUMN IF EXISTS variants
        `);
        console.log('✅ Dropped old variants column');
        
        await pool.query(`
          ALTER TABLE products 
          RENAME COLUMN variants_new TO variants
        `);
        console.log('✅ Renamed variants_new to variants');
        
        await pool.query(`
          ALTER TABLE products 
          ALTER COLUMN variants SET DEFAULT '[]'::jsonb
        `);
        console.log('✅ Set default value for variants');
      }
    }
    
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

migrateDatabase();