import os from 'os';
import path from 'path';
import fs from 'fs';

// SAFETY: run against a throwaway database, never the real billing.db.
// DB_PATH must be set BEFORE db.js is loaded, so we import it dynamically.
const testDbPath = path.join(os.tmpdir(), `billing_test_${process.pid}.db`);
process.env.DB_PATH = testDbPath;

const { initDb, run, get } = await import('./db.js');
const { calculateTiffinBill, calculateRefreshmentBill } = await import('./billingService.js');

function cleanupTestDb() {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    try { fs.unlinkSync(testDbPath + suffix); } catch { /* ignore */ }
  }
}

async function runTests() {
  console.log('=== STARTING AUTOMATED VERIFICATION ===');
  
  try {
    // 1. Initialize schema
    console.log('Initializing DB Schema...');
    await initDb();
    
    console.log(`Using temporary test database: ${testDbPath}`);

    // 2. Test Company Creation
    console.log('\n--- Testing Company Master ---');
    const compResult = await run(
      `INSERT INTO companies (name, address, contact_person, mobile_number) 
       VALUES (?, ?, ?, ?)`,
      ['Test Company Ltd', '123 Business Park, City', 'John Doe', '9876543210']
    );
    const companyId = compResult.id;
    console.log(`Created Company with ID: ${companyId}`);
    
    const compObj = await get('SELECT * FROM companies WHERE id = ?', [companyId]);
    if (compObj.name !== 'Test Company Ltd') throw new Error('Company name mismatch');
    if (compObj.is_active !== 1) throw new Error('Company should be active by default');
    console.log('Company Master checks passed.');

    // 3. Test Company Rates Setup
    console.log('\n--- Testing Company Rate Setup ---');
    await run(
      `INSERT INTO company_rates (
        company_id, regular_tiffin_rate, dahi_tiffin_rate, nasta_rate, tea_rate, milk_rate, chapati_rate
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [companyId, 80.00, 100.00, 30.00, 10.00, 60.00, 5.00]
    );
    
    const rates = await get('SELECT * FROM company_rates WHERE company_id = ?', [companyId]);
    if (rates.regular_tiffin_rate !== 80.00) throw new Error('Regular Tiffin Rate mismatch');
    if (rates.milk_rate !== 60.00) throw new Error('Milk Rate mismatch');
    console.log('Rates Setup checks passed.');

    // 4. Test Daily Tiffin Entry & Totals
    console.log('\n--- Testing Daily Tiffin Entries ---');
    
    // Add multiple entries
    await run(
      `INSERT INTO tiffin_entries (company_id, entry_date, requisition_no, regular_tiffin_count, dahi_tiffin_count)
       VALUES (?, ?, ?, ?, ?)`,
      [companyId, '2026-08-01', 'TIF-001', 50, 10]
    );
    await run(
      `INSERT INTO tiffin_entries (company_id, entry_date, requisition_no, regular_tiffin_count, dahi_tiffin_count)
       VALUES (?, ?, ?, ?, ?)`,
      [companyId, '2026-08-02', 'TIF-002', 55, 12]
    );

    // Edit an entry
    console.log('Editing TIF-002 entry counts...');
    await run(
      `UPDATE tiffin_entries 
       SET regular_tiffin_count = 60, dahi_tiffin_count = 15 
       WHERE company_id = ? AND entry_date = ? AND requisition_no = ?`,
      [companyId, '2026-08-02', 'TIF-002']
    );

    // Verify totals
    const tiffinBill = await calculateTiffinBill(companyId, 8, 2026);
    console.log('Tiffin Bill calculations:');
    console.log(`- Regular Count: ${tiffinBill.totals.regularTiffinCount} (Expected: 110)`);
    console.log(`- Dahi Count: ${tiffinBill.totals.dahiTiffinCount} (Expected: 25)`);
    console.log(`- Regular Amount: Rs. ${tiffinBill.amounts.regularTiffinAmount} (Expected: 8800)`);
    console.log(`- Dahi Amount: Rs. ${tiffinBill.amounts.dahiTiffinAmount} (Expected: 2500)`);
    console.log(`- Grand Total: Rs. ${tiffinBill.amounts.grandTotal} (Expected: 11300)`);

    if (tiffinBill.totals.regularTiffinCount !== 110) throw new Error('Total Regular Tiffin Count calculation error');
    if (tiffinBill.totals.dahiTiffinCount !== 25) throw new Error('Total Dahi Tiffin Count calculation error');
    if (tiffinBill.amounts.grandTotal !== 11300.00) throw new Error('Tiffin Bill Grand Total calculation error');
    console.log('Daily Tiffin Entry & Calculation checks passed.');

    // 5. Test Duplicate Prevention (Tiffin)
    console.log('\n--- Testing Duplicate Prevention ---');
    try {
      await run(
        `INSERT INTO tiffin_entries (company_id, entry_date, requisition_no, regular_tiffin_count, dahi_tiffin_count)
         VALUES (?, ?, ?, ?, ?)`,
        [companyId, '2026-08-01', 'TIF-001', 10, 5]
      );
      throw new Error('Duplicate entry was saved without triggering SQLite constraint!');
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        console.log('SUCCESS: Duplicate entry was correctly blocked by SQLite Unique constraint.');
      } else {
        throw err;
      }
    }

    // 6. Test Daily Refreshment Entry with Decimals & Calculations
    console.log('\n--- Testing Daily Refreshments (Nasta/Tea/Milk/Chapati) ---');
    
    // Add entries with decimal milk values
    await run(
      `INSERT INTO refreshment_entries (company_id, entry_date, requisition_no, nasta_count, tea_count, milk_litres, chapati_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [companyId, '2026-08-01', 'REF-001', 50, 60, 3.50, 100]
    );
    await run(
      `INSERT INTO refreshment_entries (company_id, entry_date, requisition_no, nasta_count, tea_count, milk_litres, chapati_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [companyId, '2026-08-02', 'REF-002', 55, 70, 4.25, 120]
    );

    const refBill = await calculateRefreshmentBill(companyId, 8, 2026);
    console.log('Refreshment Bill calculations:');
    console.log(`- Nasta Count: ${refBill.totals.nastaCount} (Expected: 105)`);
    console.log(`- Tea Count: ${refBill.totals.teaCount} (Expected: 130)`);
    console.log(`- Milk Litres: ${refBill.totals.milkLitres} (Expected: 7.75)`);
    console.log(`- Chapati Count: ${refBill.totals.chapatiCount} (Expected: 220)`);
    console.log(`- Grand Total: Rs. ${refBill.amounts.grandTotal} (Expected: 6015.00)`);
    // Calculation check:
    // Nasta: 105 * 30 = 3150
    // Tea: 130 * 10 = 1300
    // Milk: 7.75 * 60 = 465
    // Chapati: 220 * 5 = 1100
    // Total = 3150 + 1300 + 465 + 1100 = 6015.00

    if (refBill.totals.nastaCount !== 105) throw new Error('Total Nasta error');
    if (refBill.totals.milkLitres !== 7.75) throw new Error('Total Milk litres error');
    if (refBill.amounts.grandTotal !== 6015.00) throw new Error('Refreshment Grand Total calculation error');
    console.log('Daily Refreshment Entry & Calculation checks passed.');

    console.log('\n=========================================');
    console.log('ALL BACKEND CHECKS AND TESTS PASSED!');
    console.log('=========================================');
    
  } catch (error) {
    console.error('\n❌ VERIFICATION TEST FAILED:', error.message);
    cleanupTestDb();
    process.exit(1);
  }
  cleanupTestDb();
  process.exit(0);
}

runTests();
