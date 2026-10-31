import ExcelJS from 'exceljs';

/**
 * Generates an Excel workbook for Tiffin or Refreshment bill and writes to res stream.
 * @param {Object} billData Calculated bill data from billingService.js
 * @param {res} res Express response object
 */
export async function generateBillExcel(billData, res) {
  const isTiffin = billData.billType === 'TIFFIN';
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(isTiffin ? 'Tiffin Monthly Bill' : 'Refreshment Monthly Bill');

  // Page setup
  worksheet.pageSetup.orientation = 'portrait';
  worksheet.pageSetup.paperSize = 9; // A4
  worksheet.views = [{ showGridLines: true }];

  // Styling helpers
  const navyFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1A365D' } // Navy Blue
  };
  const lightGrayFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEDF2F7' }
  };
  const darkGrayFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' }
  };

  const whiteBoldFont = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  const blackBoldFont = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF2D3748' } };
  const titleFont = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF1A365D' } };
  const subTitleFont = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF4A5568' } };
  const dataFont = { name: 'Arial', size: 10, color: { argb: 'FF2D3748' } };

  const centerAlign = { vertical: 'middle', horizontal: 'center' };
  const rightAlign = { vertical: 'middle', horizontal: 'right' };
  const leftAlign = { vertical: 'middle', horizontal: 'left' };

  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
  };
  
  const doubleBottomBorder = {
    top: { style: 'thin', color: { argb: 'FF2D3748' } },
    bottom: { style: 'double', color: { argb: 'FF2D3748' } }
  };

  // --- Title & Metadata Headers ---
  worksheet.mergeCells('A1:D1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = isTiffin ? 'MONTHLY BILLING INVOICE - TIFFIN SERVICE' : 'MONTHLY BILLING INVOICE - REFRESHMENT SERVICE';
  titleCell.font = titleFont;
  titleCell.alignment = leftAlign;
  worksheet.getRow(1).height = 30;

  worksheet.mergeCells('A2:D2');
  const periodCell = worksheet.getCell('A2');
  periodCell.value = `Billing Period: ${billData.period.monthName} ${billData.period.year}`;
  periodCell.font = subTitleFont;
  periodCell.alignment = leftAlign;
  worksheet.getRow(2).height = 20;

  // Metadata block (Date, Status)
  worksheet.getCell('E1').value = 'Bill Date:';
  worksheet.getCell('E1').font = { name: 'Arial', size: 9, bold: true };
  worksheet.getCell('F1').value = new Date().toLocaleDateString();
  worksheet.getCell('F1').font = { name: 'Arial', size: 9 };

  // --- Billed To Section ---
  worksheet.getCell('A4').value = 'Billed To:';
  worksheet.getCell('A4').font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF4A5568' } };

  worksheet.getCell('A5').value = billData.company.name;
  worksheet.getCell('A5').font = { name: 'Arial', size: 12, bold: true };

  let rowCursor = 6;
  if (billData.company.address) {
    worksheet.getCell(`A${rowCursor}`).value = billData.company.address;
    worksheet.getCell(`A${rowCursor}`).font = dataFont;
    rowCursor++;
  }
  if (billData.company.contactPerson || billData.company.mobileNumber) {
    const contactText = [
      billData.company.contactPerson ? `Contact: ${billData.company.contactPerson}` : '',
      billData.company.mobileNumber ? `Phone: ${billData.company.mobileNumber}` : ''
    ].filter(Boolean).join(' | ');
    worksheet.getCell(`A${rowCursor}`).value = contactText;
    worksheet.getCell(`A${rowCursor}`).font = dataFont;
    rowCursor++;
  }

  rowCursor += 2; // Insert empty space before data table

  // --- DATA TABLE ---
  const startDataRow = rowCursor;
  const tableHeaders = isTiffin
    ? ['Date', 'Requisition No.', 'Regular Tiffin Count', 'Dahi Tiffin Count']
    : ['Date', 'Requisition No.', 'Nasta Count', 'Tea Count', 'Milk Litres', 'Chapati Count'];

  // Write headers
  worksheet.getRow(rowCursor).height = 24;
  tableHeaders.forEach((h, i) => {
    const colLetter = String.fromCharCode(65 + i); // A, B, C, D...
    const cell = worksheet.getCell(`${colLetter}${rowCursor}`);
    cell.value = h;
    cell.fill = navyFill;
    cell.font = whiteBoldFont;
    cell.alignment = (i >= 2) ? rightAlign : leftAlign;
    cell.border = thinBorder;
  });
  rowCursor++;

  // Write details
  billData.entries.forEach((entry) => {
    worksheet.getRow(rowCursor).height = 20;
    const rowValues = isTiffin
      ? [entry.date, entry.requisitionNo, entry.regularTiffinCount, entry.dahiTiffinCount]
      : [entry.date, entry.requisitionNo, entry.nastaCount, entry.teaCount, entry.milkLitres, entry.chapatiCount];

    rowValues.forEach((val, i) => {
      const colLetter = String.fromCharCode(65 + i);
      const cell = worksheet.getCell(`${colLetter}${rowCursor}`);
      cell.value = val;
      cell.font = dataFont;
      cell.border = thinBorder;
      if (i >= 2) {
        cell.alignment = rightAlign;
        // Apply number format
        cell.numFmt = (i === 4 && !isTiffin) ? '0.00' : '#,##0';
      } else {
        cell.alignment = leftAlign;
      }
    });
    rowCursor++;
  });

  // Write Totals row
  const totalsRowIndex = rowCursor;
  worksheet.getRow(rowCursor).height = 22;
  
  // Label cell
  worksheet.getCell(`A${rowCursor}`).value = 'TOTAL QUANTITY';
  worksheet.getCell(`A${rowCursor}`).font = blackBoldFont;
  worksheet.getCell(`A${rowCursor}`).alignment = leftAlign;
  worksheet.getCell(`A${rowCursor}`).border = doubleBottomBorder;
  
  worksheet.getCell(`B${rowCursor}`).border = doubleBottomBorder;

  const totalColsCount = isTiffin ? 4 : 6;
  // Cached results, in the same order as the quantity columns (C, D, E, F)
  const totalResults = isTiffin
    ? [billData.totals.regularTiffinCount, billData.totals.dahiTiffinCount]
    : [billData.totals.nastaCount, billData.totals.teaCount, billData.totals.milkLitres, billData.totals.chapatiCount];
  const hasEntries = billData.entries.length > 0;

  for (let i = 2; i < totalColsCount; i++) {
    const colLetter = String.fromCharCode(65 + i);
    const cell = worksheet.getCell(`${colLetter}${rowCursor}`);
    // With no entries the range would collapse onto the totals row itself
    // (circular reference), so write a plain 0 instead of a SUM.
    cell.value = hasEntries
      ? {
          formula: `SUM(${colLetter}${startDataRow + 1}:${colLetter}${totalsRowIndex - 1})`,
          result: totalResults[i - 2]
        }
      : 0;
    cell.font = blackBoldFont;
    cell.alignment = rightAlign;
    cell.border = doubleBottomBorder;
    cell.numFmt = (i === 4 && !isTiffin) ? '0.00' : '#,##0';
  }
  rowCursor += 3; // Space before calculations block

  // --- CALCULATION TABLE ---
  worksheet.getCell(`A${rowCursor}`).value = 'Billing Calculations Breakdown';
  worksheet.getCell(`A${rowCursor}`).font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1A365D' } };
  rowCursor++;

  // Calc Headers
  worksheet.getRow(rowCursor).height = 20;
  const calcHeaders = ['Item Description', 'Total Quantity', 'Rate per Unit', 'Total Amount'];
  calcHeaders.forEach((h, i) => {
    const cell = worksheet.getCell(`${String.fromCharCode(65 + i)}${rowCursor}`);
    cell.value = h;
    cell.fill = darkGrayFill;
    cell.font = blackBoldFont;
    cell.border = thinBorder;
    cell.alignment = (i > 0) ? rightAlign : leftAlign;
  });
  const calcStartRow = rowCursor + 1;
  rowCursor++;

  const renderCalcRow = (item, qtyFormula, rateVal, qtyResult, amountResult) => {
    worksheet.getRow(rowCursor).height = 20;
    
    // Description
    const cellA = worksheet.getCell(`A${rowCursor}`);
    cellA.value = item;
    cellA.font = dataFont;
    cellA.border = thinBorder;
    
    // Qty formula referencing the totals cell
    const cellB = worksheet.getCell(`B${rowCursor}`);
    cellB.value = { formula: qtyFormula, result: qtyResult };
    cellB.font = dataFont;
    cellB.alignment = rightAlign;
    cellB.border = thinBorder;
    cellB.numFmt = (item === 'Milk (Litres)') ? '0.00' : '#,##0';

    // Rate
    const cellC = worksheet.getCell(`C${rowCursor}`);
    cellC.value = rateVal;
    cellC.font = dataFont;
    cellC.alignment = rightAlign;
    cellC.border = thinBorder;
    cellC.numFmt = '"Rs. "#,##0.00';

    // Amount = Qty * Rate
    const cellD = worksheet.getCell(`D${rowCursor}`);
    cellD.value = { formula: `B${rowCursor}*C${rowCursor}`, result: amountResult };
    cellD.font = blackBoldFont;
    cellD.alignment = rightAlign;
    cellD.border = thinBorder;
    cellD.numFmt = '"Rs. "#,##0.00';

    rowCursor++;
  };

  if (isTiffin) {
    renderCalcRow('Regular Tiffin', `C${totalsRowIndex}`, billData.rates.regularTiffinRate, billData.totals.regularTiffinCount, billData.amounts.regularTiffinAmount);
    renderCalcRow('Dahi Tiffin', `D${totalsRowIndex}`, billData.rates.dahiTiffinRate, billData.totals.dahiTiffinCount, billData.amounts.dahiTiffinAmount);
  } else {
    renderCalcRow('Nasta / Snacks', `C${totalsRowIndex}`, billData.rates.nastaRate, billData.totals.nastaCount, billData.amounts.nastaAmount);
    renderCalcRow('Tea', `D${totalsRowIndex}`, billData.rates.teaRate, billData.totals.teaCount, billData.amounts.teaAmount);
    renderCalcRow('Milk (Litres)', `E${totalsRowIndex}`, billData.rates.milkRate, billData.totals.milkLitres, billData.amounts.milkAmount);
    renderCalcRow('Chapati', `F${totalsRowIndex}`, billData.rates.chapatiRate, billData.totals.chapatiCount, billData.amounts.chapatiAmount);
  }

  // Grand Total Row
  worksheet.getRow(rowCursor).height = 24;
  worksheet.getCell(`A${rowCursor}`).value = 'GRAND TOTAL';
  worksheet.getCell(`A${rowCursor}`).font = blackBoldFont;
  worksheet.getCell(`A${rowCursor}`).border = doubleBottomBorder;

  worksheet.getCell(`B${rowCursor}`).border = doubleBottomBorder;
  worksheet.getCell(`C${rowCursor}`).border = doubleBottomBorder;

  const totalCellD = worksheet.getCell(`D${rowCursor}`);
  totalCellD.value = { formula: `SUM(D${calcStartRow}:D${rowCursor - 1})`, result: billData.amounts.grandTotal };
  totalCellD.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1A365D' } };
  totalCellD.fill = lightGrayFill;
  totalCellD.alignment = rightAlign;
  totalCellD.border = doubleBottomBorder;
  totalCellD.numFmt = '"Rs. "#,##0.00';

  // --- Auto-adjust Column Widths ---
  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.value && typeof cell.value === 'object') return; // Skip formula cells for length check
      const cellVal = cell.value ? cell.value.toString() : '';
      if (cellVal.length > maxLength) {
        maxLength = cellVal.length;
      }
    });
    // Set padding
    column.width = Math.max(maxLength + 4, 12);
  });

  // Specifically adjust first two columns for readability
  worksheet.getColumn('A').width = 16;
  worksheet.getColumn('B').width = 18;

  // Send to response stream
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${billData.company.name.replace(/\s+/g, '_')}_Bill_${billData.period.monthName}_${billData.period.year}.xlsx"`);

  await workbook.xlsx.write(res);
  res.end();
}
