const pool = require('./db');

async function setupAdminPhones() {
  try {
    const phones = ['+919019825189', '+918277079552', '+919483685462'];
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2) 
       ON CONFLICT (key) DO UPDATE SET value = $2`,
      ['admin_phones', JSON.stringify(phones)]
    );
    console.log('✅ Admin phones set:', phones);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

setupAdminPhones();