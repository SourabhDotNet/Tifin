import { get, all } from './db.js';

// Helper to round to 2 decimal places for accurate money calculation
export const roundToTwo = (num) => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

// Map of month numbers to names
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Calculates the Tiffin Bill for a company, month, and year.
 */
export async function calculateTiffinBill(companyId, month, year) {
  // Validate inputs
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (isNaN(m) || m < 1 || m > 12 || isNaN(y)) {
    throw new Error('Invalid month or year');
  }

  // 1. Get Company info
  const company = await get('SELECT * FROM companies WHERE id = ?', [companyId]);
  if (!company) {
    throw new Error('Company not found');
  }

  // 2. Get rates (if rates don't exist, default to 0)
  let rates = await get('SELECT * FROM company_rates WHERE company_id = ?', [companyId]);
  if (!rates) {
    rates = {
      regular_tiffin_rate: 0.0,
      dahi_tiffin_rate: 0.0
    };
  }

  // 3. Get entries for the month
  // We format month as '01', '02', etc.
  const monthStr = m.toString().padStart(2, '0');
  const datePrefix = `${y}-${monthStr}-%`;

  const entries = await all(
    `SELECT * FROM tiffin_entries 
     WHERE company_id = ? AND entry_date LIKE ? 
    ORDER BY entry_date ASC, requisition_no ASC`,
    [companyId, datePrefix]
  );

  // 4. Calculate totals
  let totalRegularCount = 0;
  let totalDahiCount = 0;

  for (const entry of entries) {
    totalRegularCount += (entry.regular_tiffin_count || 0);
    totalDahiCount += (entry.dahi_tiffin_count || 0);
  }

  const regularRate = rates.regular_tiffin_rate || 0.0;
  const dahiRate = rates.dahi_tiffin_rate || 0.0;

  const regularAmount = roundToTwo(totalRegularCount * regularRate);
  const dahiAmount = roundToTwo(totalDahiCount * dahiRate);
  const grandTotal = roundToTwo(regularAmount + dahiAmount);

  return {
    billType: 'TIFFIN',
    company: {
      id: company.id,
      name: company.name,
      address: company.address || '',
      contactPerson: company.contact_person || '',
      mobileNumber: company.mobile_number || '',
      isActive: company.is_active
    },
    period: {
      month: m,
      monthName: MONTHS[m - 1],
      year: y
    },
    rates: {
      regularTiffinRate: regularRate,
      dahiTiffinRate: dahiRate
    },
    entries: entries.map(e => ({
      id: e.id,
      date: e.entry_date,
      requisitionNo: e.requisition_no,
      regularTiffinCount: e.regular_tiffin_count,
      dahiTiffinCount: e.dahi_tiffin_count
    })),
    totals: {
      regularTiffinCount: totalRegularCount,
      dahiTiffinCount: totalDahiCount
    },
    amounts: {
      regularTiffinAmount: regularAmount,
      dahiTiffinAmount: dahiAmount,
      grandTotal: grandTotal
    }
  };
}

/**
 * Calculates the Nasta & Refreshment Bill for a company, month, and year.
 */
export async function calculateRefreshmentBill(companyId, month, year) {
  // Validate inputs
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (isNaN(m) || m < 1 || m > 12 || isNaN(y)) {
    throw new Error('Invalid month or year');
  }

  // 1. Get Company info
  const company = await get('SELECT * FROM companies WHERE id = ?', [companyId]);
  if (!company) {
    throw new Error('Company not found');
  }

  // 2. Get rates (if rates don't exist, default to 0)
  let rates = await get('SELECT * FROM company_rates WHERE company_id = ?', [companyId]);
  if (!rates) {
    rates = {
      nasta_rate: 0.0,
      tea_rate: 0.0,
      milk_rate: 0.0,
      chapati_rate: 0.0
    };
  }

  // 3. Get entries for the month
  const monthStr = m.toString().padStart(2, '0');
  const datePrefix = `${y}-${monthStr}-%`;

  const entries = await all(
    `SELECT * FROM refreshment_entries 
     WHERE company_id = ? AND entry_date LIKE ? 
    ORDER BY entry_date ASC, requisition_no ASC`,
    [companyId, datePrefix]
  );

  // 4. Calculate totals
  let totalNastaCount = 0;
  let totalTeaCount = 0;
  let totalMilkLitres = 0.0;
  let totalChapatiCount = 0;

  for (const entry of entries) {
    totalNastaCount += (entry.nasta_count || 0);
    totalTeaCount += (entry.tea_count || 0);
    totalMilkLitres += (entry.milk_litres || 0.0);
    totalChapatiCount += (entry.chapati_count || 0);
  }

  // Round milk sum to 2 decimal places to prevent float drift
  totalMilkLitres = roundToTwo(totalMilkLitres);

  const nastaRate = rates.nasta_rate || 0.0;
  const teaRate = rates.tea_rate || 0.0;
  const milkRate = rates.milk_rate || 0.0;
  const chapatiRate = rates.chapati_rate || 0.0;

  const nastaAmount = roundToTwo(totalNastaCount * nastaRate);
  const teaAmount = roundToTwo(totalTeaCount * teaRate);
  const milkAmount = roundToTwo(totalMilkLitres * milkRate);
  const chapatiAmount = roundToTwo(totalChapatiCount * chapatiRate);

  const grandTotal = roundToTwo(nastaAmount + teaAmount + milkAmount + chapatiAmount);

  return {
    billType: 'REFRESHMENT',
    company: {
      id: company.id,
      name: company.name,
      address: company.address || '',
      contactPerson: company.contact_person || '',
      mobileNumber: company.mobile_number || '',
      isActive: company.is_active
    },
    period: {
      month: m,
      monthName: MONTHS[m - 1],
      year: y
    },
    rates: {
      nastaRate,
      teaRate,
      milkRate,
      chapatiRate
    },
    entries: entries.map(e => ({
      id: e.id,
      date: e.entry_date,
      requisitionNo: e.requisition_no,
      nastaCount: e.nasta_count,
      teaCount: e.tea_count,
      milkLitres: e.milk_litres,
      chapatiCount: e.chapati_count
    })),
    totals: {
      nastaCount: totalNastaCount,
      teaCount: totalTeaCount,
      milkLitres: totalMilkLitres,
      chapatiCount: totalChapatiCount
    },
    amounts: {
      nastaAmount,
      teaAmount,
      milkAmount,
      chapatiAmount,
      grandTotal
    }
  };
}
