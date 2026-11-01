import express from 'express';
import { run, get, all } from './db.js';
import { calculateTiffinBill, calculateRefreshmentBill, roundToTwo } from './billingService.js';
import { generateBillPDF } from './pdfService.js';
import { generateBillExcel } from './excelService.js';

const router = express.Router();

// Used by PUT routes. Moving an entry TO an inactive company is blocked (same rule as POST),
// but editing an existing entry that already belongs to a since-deactivated company is allowed,
// so past records can still be corrected.
async function checkEntryCompany(newCompanyId, currentCompanyId) {
  const company = await get('SELECT is_active FROM companies WHERE id = ?', [newCompanyId]);
  if (!company) return { status: 404, error: 'Company not found' };
  const changingCompany = Number(newCompanyId) !== Number(currentCompanyId);
  if (company.is_active !== 1 && changingCompany) {
    return { status: 400, error: 'Selected company is inactive' };
  }
  return null;
}

// ==========================================
// 1. COMPANIES ROUTES
// ==========================================

// GET all companies
router.get('/companies', async (req, res) => {
  try {
    const search = req.query.search || '';
    let sql = 'SELECT * FROM companies';
    const params = [];
    
    if (search) {
      sql += ' WHERE name LIKE ?';
      params.push(`%${search}%`);
    }
    
    sql += ' ORDER BY name ASC';
    const companies = await all(sql, params);
    res.json(companies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single company
router.get('/companies/:id', async (req, res) => {
  try {
    const company = await get('SELECT * FROM companies WHERE id = ?', [req.params.id]);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(company);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE company
router.post('/companies', async (req, res) => {
  try {
    const { name, address, contact_person, mobile_number } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    // Check duplicate name
    const existing = await get('SELECT id FROM companies WHERE name = ?', [name.trim()]);
    if (existing) {
      return res.status(400).json({ error: 'A company with this name already exists' });
    }

    const result = await run(
      `INSERT INTO companies (name, address, contact_person, mobile_number) 
       VALUES (?, ?, ?, ?)`,
      [name.trim(), address || '', contact_person || '', mobile_number || '']
    );

    // Auto-create rate entry with 0 rates
    await run('INSERT INTO company_rates (company_id) VALUES (?)', [result.id]);

    const created = await get('SELECT * FROM companies WHERE id = ?', [result.id]);
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE company
router.put('/companies/:id', async (req, res) => {
  try {
    const { name, address, contact_person, mobile_number } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    // Check duplicate name (excluding current company)
    const existing = await get('SELECT id FROM companies WHERE name = ? AND id != ?', [name.trim(), req.params.id]);
    if (existing) {
      return res.status(400).json({ error: 'A company with this name already exists' });
    }

    const current = await get('SELECT id FROM companies WHERE id = ?', [req.params.id]);
    if (!current) {
      return res.status(404).json({ error: 'Company not found' });
    }

    await run(
      `UPDATE companies 
       SET name = ?, address = ?, contact_person = ?, mobile_number = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [name.trim(), address || '', contact_person || '', mobile_number || '', req.params.id]
    );

    const updated = await get('SELECT * FROM companies WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// TOGGLE company active status
router.patch('/companies/:id/toggle', async (req, res) => {
  try {
    const current = await get('SELECT is_active FROM companies WHERE id = ?', [req.params.id]);
    if (!current) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const nextStatus = current.is_active === 1 ? 0 : 1;
    await run('UPDATE companies SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [nextStatus, req.params.id]);
    
    res.json({ id: parseInt(req.params.id, 10), is_active: nextStatus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ==========================================
// 2. COMPANY RATES ROUTES
// ==========================================

// GET company rates
router.get('/rates/:company_id', async (req, res) => {
  try {
    let rates = await get('SELECT * FROM company_rates WHERE company_id = ?', [req.params.company_id]);
    if (!rates) {
      // Create rates row if missing
      await run('INSERT INTO company_rates (company_id) VALUES (?)', [req.params.company_id]);
      rates = await get('SELECT * FROM company_rates WHERE company_id = ?', [req.params.company_id]);
    }
    res.json(rates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE company rates
router.post('/rates/:company_id', async (req, res) => {
  try {
    const {
      regular_tiffin_rate,
      dahi_tiffin_rate,
      nasta_rate,
      tea_rate,
      milk_rate,
      chapati_rate
    } = req.body;

    // Blank / missing rate fields default to 0; anything else must be a valid, non-negative number
    const toRate = (v) => {
      if (v === undefined || v === null || String(v).trim() === '') return 0;
      return Number(v);
    };

    const rates = {
      regular_tiffin_rate: toRate(regular_tiffin_rate),
      dahi_tiffin_rate: toRate(dahi_tiffin_rate),
      nasta_rate: toRate(nasta_rate),
      tea_rate: toRate(tea_rate),
      milk_rate: toRate(milk_rate),
      chapati_rate: toRate(chapati_rate)
    };

    for (const value of Object.values(rates)) {
      if (!Number.isFinite(value) || value < 0) {
        return res.status(400).json({ error: 'Rates cannot be negative or invalid numbers' });
      }
    }

    // Verify company exists
    const company = await get('SELECT id FROM companies WHERE id = ?', [req.params.company_id]);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    await run(
      `INSERT INTO company_rates (
        company_id, regular_tiffin_rate, dahi_tiffin_rate, nasta_rate, tea_rate, milk_rate, chapati_rate, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(company_id) DO UPDATE SET
        regular_tiffin_rate = excluded.regular_tiffin_rate,
        dahi_tiffin_rate = excluded.dahi_tiffin_rate,
        nasta_rate = excluded.nasta_rate,
        tea_rate = excluded.tea_rate,
        milk_rate = excluded.milk_rate,
        chapati_rate = excluded.chapati_rate,
        updated_at = CURRENT_TIMESTAMP`,
      [
        req.params.company_id,
        rates.regular_tiffin_rate,
        rates.dahi_tiffin_rate,
        rates.nasta_rate,
        rates.tea_rate,
        rates.milk_rate,
        rates.chapati_rate
      ]
    );

    const updated = await get('SELECT * FROM company_rates WHERE company_id = ?', [req.params.company_id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ==========================================
// 3. TIFFIN ENTRIES ROUTES
// ==========================================

// GET tiffin entries with filters
router.get('/tiffin-entries', async (req, res) => {
  try {
    const { company_id, month, year, requisition_no } = req.query;
    let sql = 'SELECT t.*, c.name as company_name FROM tiffin_entries t JOIN companies c ON t.company_id = c.id WHERE 1=1';
    const params = [];

    if (company_id) {
      sql += ' AND t.company_id = ?';
      params.push(company_id);
    }
    if (month && year) {
      const monthStr = month.toString().padStart(2, '0');
      sql += ' AND t.entry_date LIKE ?';
      params.push(`${year}-${monthStr}-%`);
    }
    if (requisition_no) {
      sql += ' AND t.requisition_no LIKE ?';
      params.push(`%${requisition_no}%`);
    }

    sql += ' ORDER BY t.entry_date ASC, t.requisition_no ASC';
    const entries = await all(sql, params);
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE tiffin entry
router.post('/tiffin-entries', async (req, res) => {
  try {
    const { company_id, entry_date, requisition_no, regular_tiffin_count, dahi_tiffin_count } = req.body;

    // Validation
    if (!company_id) return res.status(400).json({ error: 'Company is required' });
    if (!entry_date) return res.status(400).json({ error: 'Date is required' });
    if (!requisition_no || !requisition_no.trim()) return res.status(400).json({ error: 'Requisition Number is required' });
    const regular = parseInt(regular_tiffin_count || 0, 10);
    const dahi = parseInt(dahi_tiffin_count || 0, 10);

    if (isNaN(regular) || regular < 0 || isNaN(dahi) || dahi < 0) {
      return res.status(400).json({ error: 'Counts must be non-negative integers' });
    }

    // Verify company is active
    const company = await get('SELECT is_active FROM companies WHERE id = ?', [company_id]);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    if (company.is_active !== 1) return res.status(400).json({ error: 'Selected company is inactive' });

    try {
      const result = await run(
        `INSERT INTO tiffin_entries (company_id, entry_date, requisition_no, regular_tiffin_count, dahi_tiffin_count)
         VALUES (?, ?, ?, ?, ?)`,
        [company_id, entry_date, requisition_no.trim(), regular, dahi]
      );
      const created = await get('SELECT * FROM tiffin_entries WHERE id = ?', [result.id]);
      res.status(201).json(created);
    } catch (dbErr) {
      if (dbErr.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({
          error: 'Duplicate entry detected: An entry with this Date and Requisition Number already exists for this company.'
        });
      }
      throw dbErr;
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE tiffin entry
router.put('/tiffin-entries/:id', async (req, res) => {
  try {
    const { company_id, entry_date, requisition_no, regular_tiffin_count, dahi_tiffin_count } = req.body;
    
    if (!company_id || !entry_date || !requisition_no || !requisition_no.trim()) {
      return res.status(400).json({ error: 'Company, Date, and Requisition Number are required' });
    }

    const regular = parseInt(regular_tiffin_count || 0, 10);
    const dahi = parseInt(dahi_tiffin_count || 0, 10);

    if (isNaN(regular) || regular < 0 || isNaN(dahi) || dahi < 0) {
      return res.status(400).json({ error: 'Counts must be non-negative integers' });
    }

    const current = await get('SELECT id, company_id FROM tiffin_entries WHERE id = ?', [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Entry not found' });

    const companyProblem = await checkEntryCompany(company_id, current.company_id);
    if (companyProblem) return res.status(companyProblem.status).json({ error: companyProblem.error });

    try {
      await run(
        `UPDATE tiffin_entries
         SET company_id = ?, entry_date = ?, requisition_no = ?, regular_tiffin_count = ?, dahi_tiffin_count = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [company_id, entry_date, requisition_no.trim(), regular, dahi, req.params.id]
      );
      const updated = await get('SELECT * FROM tiffin_entries WHERE id = ?', [req.params.id]);
      res.json(updated);
    } catch (dbErr) {
      if (dbErr.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({
          error: 'Duplicate entry detected: An entry with this Date and Requisition Number already exists for this company.'
        });
      }
      throw dbErr;
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE tiffin entry
router.delete('/tiffin-entries/:id', async (req, res) => {
  try {
    const current = await get('SELECT id FROM tiffin_entries WHERE id = ?', [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Entry not found' });

    await run('DELETE FROM tiffin_entries WHERE id = ?', [req.params.id]);
    res.json({ message: 'Entry deleted successfully', id: parseInt(req.params.id, 10) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET tiffin running totals for month
router.get('/tiffin-entries/totals', async (req, res) => {
  try {
    const { company_id, month, year } = req.query;
    if (!company_id || !month || !year) {
      return res.status(400).json({ error: 'Company ID, Month, and Year are required' });
    }

    const monthStr = month.toString().padStart(2, '0');
    const datePrefix = `${year}-${monthStr}-%`;

    const totals = await get(
      `SELECT SUM(regular_tiffin_count) as total_regular, SUM(dahi_tiffin_count) as total_dahi
       FROM tiffin_entries
       WHERE company_id = ? AND entry_date LIKE ?`,
      [company_id, datePrefix]
    );

    res.json({
      totalRegularTiffin: totals.total_regular || 0,
      totalDahiTiffin: totals.total_dahi || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ==========================================
// 4. REFRESHMENT ENTRIES ROUTES
// ==========================================

// GET refreshment entries with filters
router.get('/refreshment-entries', async (req, res) => {
  try {
    const { company_id, month, year, requisition_no } = req.query;
    let sql = 'SELECT r.*, c.name as company_name FROM refreshment_entries r JOIN companies c ON r.company_id = c.id WHERE 1=1';
    const params = [];

    if (company_id) {
      sql += ' AND r.company_id = ?';
      params.push(company_id);
    }
    if (month && year) {
      const monthStr = month.toString().padStart(2, '0');
      sql += ' AND r.entry_date LIKE ?';
      params.push(`${year}-${monthStr}-%`);
    }
    if (requisition_no) {
      sql += ' AND r.requisition_no LIKE ?';
      params.push(`%${requisition_no}%`);
    }

    sql += ' ORDER BY r.entry_date ASC, r.requisition_no ASC';
    const entries = await all(sql, params);
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE refreshment entry
router.post('/refreshment-entries', async (req, res) => {
  try {
    const { company_id, entry_date, requisition_no, nasta_count, tea_count, milk_litres, chapati_count } = req.body;

    // Validation
    if (!company_id) return res.status(400).json({ error: 'Company is required' });
    if (!entry_date) return res.status(400).json({ error: 'Date is required' });
    if (!requisition_no || !requisition_no.trim()) return res.status(400).json({ error: 'Requisition Number is required' });
    const nasta = parseInt(nasta_count || 0, 10);
    const tea = parseInt(tea_count || 0, 10);
    const milk = parseFloat(milk_litres || 0.0);
    const chapati = parseInt(chapati_count || 0, 10);

    if (isNaN(nasta) || nasta < 0 || isNaN(tea) || tea < 0 || isNaN(milk) || milk < 0 || isNaN(chapati) || chapati < 0) {
      return res.status(400).json({ error: 'Counts/Milk quantities must be non-negative numbers' });
    }

    // Verify company is active
    const company = await get('SELECT is_active FROM companies WHERE id = ?', [company_id]);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    if (company.is_active !== 1) return res.status(400).json({ error: 'Selected company is inactive' });

    try {
      const result = await run(
        `INSERT INTO refreshment_entries (company_id, entry_date, requisition_no, nasta_count, tea_count, milk_litres, chapati_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [company_id, entry_date, requisition_no.trim(), nasta, tea, roundToTwo(milk), chapati]
      );
      const created = await get('SELECT * FROM refreshment_entries WHERE id = ?', [result.id]);
      res.status(201).json(created);
    } catch (dbErr) {
      if (dbErr.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({
          error: 'Duplicate entry detected: An entry with this Date and Requisition Number already exists for this company.'
        });
      }
      throw dbErr;
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE refreshment entry
router.put('/refreshment-entries/:id', async (req, res) => {
  try {
    const { company_id, entry_date, requisition_no, nasta_count, tea_count, milk_litres, chapati_count } = req.body;
    
    if (!company_id || !entry_date || !requisition_no || !requisition_no.trim()) {
      return res.status(400).json({ error: 'Company, Date, and Requisition Number are required' });
    }

    const nasta = parseInt(nasta_count || 0, 10);
    const tea = parseInt(tea_count || 0, 10);
    const milk = parseFloat(milk_litres || 0.0);
    const chapati = parseInt(chapati_count || 0, 10);

    if (isNaN(nasta) || nasta < 0 || isNaN(tea) || tea < 0 || isNaN(milk) || milk < 0 || isNaN(chapati) || chapati < 0) {
      return res.status(400).json({ error: 'Counts/Milk quantities must be non-negative numbers' });
    }

    const current = await get('SELECT id, company_id FROM refreshment_entries WHERE id = ?', [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Entry not found' });

    const companyProblem = await checkEntryCompany(company_id, current.company_id);
    if (companyProblem) return res.status(companyProblem.status).json({ error: companyProblem.error });

    try {
      await run(
        `UPDATE refreshment_entries
         SET company_id = ?, entry_date = ?, requisition_no = ?, nasta_count = ?, tea_count = ?, milk_litres = ?, chapati_count = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [company_id, entry_date, requisition_no.trim(), nasta, tea, roundToTwo(milk), chapati, req.params.id]
      );
      const updated = await get('SELECT * FROM refreshment_entries WHERE id = ?', [req.params.id]);
      res.json(updated);
    } catch (dbErr) {
      if (dbErr.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({
          error: 'Duplicate entry detected: An entry with this Date and Requisition Number already exists for this company.'
        });
      }
      throw dbErr;
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE refreshment entry
router.delete('/refreshment-entries/:id', async (req, res) => {
  try {
    const current = await get('SELECT id FROM refreshment_entries WHERE id = ?', [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Entry not found' });

    await run('DELETE FROM refreshment_entries WHERE id = ?', [req.params.id]);
    res.json({ message: 'Entry deleted successfully', id: parseInt(req.params.id, 10) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET refreshment running totals for month
router.get('/refreshment-entries/totals', async (req, res) => {
  try {
    const { company_id, month, year } = req.query;
    if (!company_id || !month || !year) {
      return res.status(400).json({ error: 'Company ID, Month, and Year are required' });
    }

    const monthStr = month.toString().padStart(2, '0');
    const datePrefix = `${year}-${monthStr}-%`;

    const totals = await get(
      `SELECT SUM(nasta_count) as total_nasta, SUM(tea_count) as total_tea, 
              SUM(milk_litres) as total_milk, SUM(chapati_count) as total_chapati
       FROM refreshment_entries
       WHERE company_id = ? AND entry_date LIKE ?`,
      [company_id, datePrefix]
    );

    res.json({
      totalNasta: totals.total_nasta || 0,
      totalTea: totals.total_tea || 0,
      totalMilkLitres: roundToTwo(totals.total_milk || 0.0),
      totalChapati: totals.total_chapati || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ==========================================
// 5. BILLING & EXPORTS ROUTES
// ==========================================

// GET Tiffin Bill Preview
router.get('/bills/tiffin/preview', async (req, res) => {
  try {
    const { company_id, month, year } = req.query;
    if (!company_id || !month || !year) {
      return res.status(400).json({ error: 'Company ID, Month, and Year are required' });
    }
    const billData = await calculateTiffinBill(company_id, month, year);
    res.json(billData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET Refreshment Bill Preview
router.get('/bills/refreshment/preview', async (req, res) => {
  try {
    const { company_id, month, year } = req.query;
    if (!company_id || !month || !year) {
      return res.status(400).json({ error: 'Company ID, Month, and Year are required' });
    }
    const billData = await calculateRefreshmentBill(company_id, month, year);
    res.json(billData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET Tiffin Bill PDF Export
router.get('/bills/tiffin/pdf', async (req, res) => {
  try {
    const { company_id, month, year } = req.query;
    if (!company_id || !month || !year) {
      return res.status(400).json({ error: 'Company ID, Month, and Year are required' });
    }
    const billData = await calculateTiffinBill(company_id, month, year);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${billData.company.name.replace(/\s+/g, '_')}_Tiffin_Bill_${billData.period.monthName}_${billData.period.year}.pdf"`);
    
    generateBillPDF(billData, res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET Refreshment Bill PDF Export
router.get('/bills/refreshment/pdf', async (req, res) => {
  try {
    const { company_id, month, year } = req.query;
    if (!company_id || !month || !year) {
      return res.status(400).json({ error: 'Company ID, Month, and Year are required' });
    }
    const billData = await calculateRefreshmentBill(company_id, month, year);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${billData.company.name.replace(/\s+/g, '_')}_Refreshment_Bill_${billData.period.monthName}_${billData.period.year}.pdf"`);
    
    generateBillPDF(billData, res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET Tiffin Bill Excel Export
router.get('/bills/tiffin/excel', async (req, res) => {
  try {
    const { company_id, month, year } = req.query;
    if (!company_id || !month || !year) {
      return res.status(400).json({ error: 'Company ID, Month, and Year are required' });
    }
    const billData = await calculateTiffinBill(company_id, month, year);
    await generateBillExcel(billData, res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET Refreshment Bill Excel Export
router.get('/bills/refreshment/excel', async (req, res) => {
  try {
    const { company_id, month, year } = req.query;
    if (!company_id || !month || !year) {
      return res.status(400).json({ error: 'Company ID, Month, and Year are required' });
    }
    const billData = await calculateRefreshmentBill(company_id, month, year);
    await generateBillExcel(billData, res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
