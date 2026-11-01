import PDFDocument from 'pdfkit';

/**
 * Generates a professional PDF bill.
 * @param {Object} billData Calculated bill data from billingService.js
 * @param {res} stream Writeable response stream
 */
export function generateBillPDF(billData, stream) {
  const isTiffin = billData.billType === 'TIFFIN';
  
  // Set page options: landscape for refreshment if columns are too wide, but portrait fits 6 columns easily.
  // We'll use Portrait with 0.5-inch margins (36 points)
  const doc = new PDFDocument({
    size: 'A4',
    margin: 36,
    bufferPages: true
  });

  doc.pipe(stream);

  // Colors & Fonts
  const primaryColor = '#1A365D'; // Dark Navy
  const secondaryColor = '#2B6CB0'; // Slate Blue
  const textDark = '#2D3748';
  const tableHeaderBg = '#EDF2F7';
  const lineGray = '#E2E8F0';

  // --- HEADER SECTION ---
  doc
    .rect(36, 36, 523, 70)
    .fill(primaryColor);

  doc
    .fillColor('#FFFFFF')
    .font('Helvetica-Bold')
    .fontSize(18)
    .text('COMPANY MONTHLY BILLING REPORT', 50, 48)
    .fontSize(14)
    .text(isTiffin ? 'TIFFIN SERVICE BILL' : 'NASTA & REFRESHMENT BILL', 50, 70);

  // Invoice Meta
  const metaX = 400;
  doc
    .fontSize(9)
    .fillColor('#FFFFFF')
    .text(`Bill Date: ${new Date().toLocaleDateString()}`, metaX, 48, { align: 'right', width: 150 })
    .text(`Billing Period: ${billData.period.monthName} ${billData.period.year}`, metaX, 62, { align: 'right', width: 150 })
    .text(`Status: DRAFT / GENERATED`, metaX, 76, { align: 'right', width: 150 });

  // --- COMPANY DETAILS ---
  doc.y = 120;
  doc
    .fillColor(textDark)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text('Billed To:', 36, doc.y)
    .font('Helvetica-Bold')
    .fontSize(14)
    .text(billData.company.name, 36, doc.y + 15)
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#4A5568');

  let detailsY = doc.y + 5;
  if (billData.company.address) {
    doc.text(billData.company.address, 36, detailsY);
    detailsY += 15;
  }
  if (billData.company.contactPerson || billData.company.mobileNumber) {
    const contactText = [
      billData.company.contactPerson ? `Attn: ${billData.company.contactPerson}` : '',
      billData.company.mobileNumber ? `Ph: ${billData.company.mobileNumber}` : ''
    ].filter(Boolean).join(' | ');
    doc.text(contactText, 36, detailsY);
  }

  // Draw separator line
  doc.y = 185;
  doc
    .moveTo(36, doc.y)
    .lineTo(559, doc.y)
    .strokeColor(lineGray)
    .lineWidth(1)
    .stroke();

  // --- DAILY DETAILS TABLE ---
  doc.y = 200;
  doc
    .fillColor(primaryColor)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text('Daily Requisitions Ledger', 36, doc.y);

  doc.y = 215;

  // Table Configuration
  const colWidths = isTiffin 
    ? [100, 150, 130, 143] // Total width = 523 (559 - 36)
    : [90, 110, 80, 80, 83, 80];

  const colHeaders = isTiffin
    ? ['Date', 'Requisition No.', 'Regular Tiffin Count', 'Dahi Tiffin Count']
    : ['Date', 'Requisition No.', 'Nasta Count', 'Tea Count', 'Milk (L)', 'Chapati Count'];

  // Table Drawing Helper
  const drawRow = (y, cols, isHeader = false) => {
    let currentX = 36;
    
    // Draw row background if header
    if (isHeader) {
      doc
        .rect(36, y, 523, 20)
        .fill(tableHeaderBg);
      doc.fillColor(textDark).font('Helvetica-Bold').fontSize(9);
    } else {
      doc.fillColor(textDark).font('Helvetica').fontSize(9);
    }

    cols.forEach((val, idx) => {
      const align = (idx >= 2) ? 'right' : 'left';
      const width = colWidths[idx];
      const padX = align === 'right' ? currentX - 5 : currentX + 5;
      
      doc.text(String(val), padX, y + 5, {
        width: width - 10,
        align: align
      });
      currentX += width;
    });

    // Draw bottom border
    doc
      .moveTo(36, y + 20)
      .lineTo(559, y + 20)
      .strokeColor(lineGray)
      .lineWidth(0.5)
      .stroke();
  };

  // Render Table Header
  let currentY = doc.y;
  drawRow(currentY, colHeaders, true);
  currentY += 20;

  // Render Table Rows
  billData.entries.forEach((entry) => {
    // Page break logic (A4 height is 842, margin is 36, let's break around 750)
    if (currentY > 730) {
      doc.addPage();
      currentY = 36;
      drawRow(currentY, colHeaders, true);
      currentY += 20;
    }

    const rowData = isTiffin
      ? [entry.date, entry.requisitionNo, entry.regularTiffinCount, entry.dahiTiffinCount]
      : [entry.date, entry.requisitionNo, entry.nastaCount, entry.teaCount, entry.milkLitres.toFixed(2), entry.chapatiCount];

    drawRow(currentY, rowData, false);
    currentY += 20;
  });

  // Render Running/Monthly Totals Row
  if (currentY > 730) {
    doc.addPage();
    currentY = 36;
  }

  // Draw double line for totals header
  doc
    .moveTo(36, currentY)
    .lineTo(559, currentY)
    .strokeColor(primaryColor)
    .lineWidth(1)
    .stroke();

  const totalRowData = isTiffin
    ? ['TOTALS', '', billData.totals.regularTiffinCount, billData.totals.dahiTiffinCount]
    : ['TOTALS', '', billData.totals.nastaCount, billData.totals.teaCount, billData.totals.milkLitres.toFixed(2), billData.totals.chapatiCount];

  let currentX = 36;
  doc.fillColor(textDark).font('Helvetica-Bold').fontSize(9);
  totalRowData.forEach((val, idx) => {
    const align = (idx >= 2) ? 'right' : 'left';
    const width = colWidths[idx];
    const padX = align === 'right' ? currentX - 5 : currentX + 5;
    
    doc.text(String(val), padX, currentY + 5, {
      width: width - 10,
      align: align
    });
    currentX += width;
  });

  currentY += 20;
  doc
    .moveTo(36, currentY)
    .lineTo(559, currentY)
    .strokeColor(primaryColor)
    .lineWidth(1.5)
    .stroke();

  // --- CALCULATION BREAKDOWN & GRAND TOTAL ---
  currentY += 25;
  if (currentY > 620) { // Check space for calculations block
    doc.addPage();
    currentY = 40;
  }

  doc
    .fillColor(primaryColor)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text('Billing Rate & Amount Calculations', 36, currentY);

  currentY += 15;

  // Draw Calculation Table
  const calcHeaderBg = '#E2E8F0';
  doc
    .rect(36, currentY, 523, 18)
    .fill(calcHeaderBg);

  doc.fillColor(textDark).font('Helvetica-Bold').fontSize(8.5);
  doc.text('Item Description', 41, currentY + 4, { width: 180 });
  doc.text('Total Qty', 230, currentY + 4, { width: 80, align: 'right' });
  doc.text('Rate', 320, currentY + 4, { width: 80, align: 'right' });
  doc.text('Amount (INR)', 430, currentY + 4, { width: 120, align: 'right' });

  doc
    .moveTo(36, currentY + 18)
    .lineTo(559, currentY + 18)
    .strokeColor(lineGray)
    .lineWidth(0.5)
    .stroke();

  currentY += 18;

  const renderCalcRow = (item, qty, rate, amt) => {
    doc.fillColor(textDark).font('Helvetica').fontSize(9);
    doc.text(item, 41, currentY + 4, { width: 180 });
    doc.text(qty, 230, currentY + 4, { width: 80, align: 'right' });
    doc.text(`Rs. ${rate.toFixed(2)}`, 320, currentY + 4, { width: 80, align: 'right' });
    doc.text(`Rs. ${amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 430, currentY + 4, { width: 120, align: 'right' });
    
    doc
      .moveTo(36, currentY + 18)
      .lineTo(559, currentY + 18)
      .strokeColor(lineGray)
      .lineWidth(0.5)
      .stroke();
      
    currentY += 18;
  };

  if (isTiffin) {
    renderCalcRow('Regular Tiffin', billData.totals.regularTiffinCount.toString(), billData.rates.regularTiffinRate, billData.amounts.regularTiffinAmount);
    renderCalcRow('Dahi Tiffin', billData.totals.dahiTiffinCount.toString(), billData.rates.dahiTiffinRate, billData.amounts.dahiTiffinAmount);
  } else {
    renderCalcRow('Nasta / Snacks', billData.totals.nastaCount.toString(), billData.rates.nastaRate, billData.amounts.nastaAmount);
    renderCalcRow('Tea', billData.totals.teaCount.toString(), billData.rates.teaRate, billData.amounts.teaAmount);
    renderCalcRow('Milk (Litres)', billData.totals.milkLitres.toFixed(2), billData.rates.milkRate, billData.amounts.milkAmount);
    renderCalcRow('Chapati', billData.totals.chapatiCount.toString(), billData.rates.chapatiRate, billData.amounts.chapatiAmount);
  }

  // Grand Total Block
  doc
    .rect(300, currentY + 5, 259, 28)
    .fill(primaryColor);

  doc
    .fillColor('#FFFFFF')
    .font('Helvetica-Bold')
    .fontSize(11)
    .text('GRAND TOTAL:', 310, currentY + 14)
    .text(`Rs. ${billData.amounts.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 420, currentY + 14, {
      width: 130,
      align: 'right'
    });

  // --- SIGNATURES / FOOTER ---
  currentY += 60;
  if (currentY > 750) {
    doc.addPage();
    currentY = 40;
  }

  // Footer notes
  doc
    .fillColor('#718096')
    .font('Helvetica-Oblique')
    .fontSize(8)
    .text('Note: This is a system-generated summary bill. Please cross-reference with the requisitions ledger.', 36, currentY);

  currentY += 40;
  
  // Signature Lines
  doc
    .moveTo(36, currentY)
    .lineTo(180, currentY)
    .strokeColor('#A0AEC0')
    .lineWidth(0.5)
    .stroke();

  doc
    .moveTo(415, currentY)
    .lineTo(559, currentY)
    .stroke();

  doc
    .fillColor(textDark)
    .font('Helvetica')
    .fontSize(8.5)
    .text('Prepared By (Authorized Signatory)', 36, currentY + 5)
    .text('Accepted By (For Billed Company)', 415, currentY + 5);

  doc.end();
}
