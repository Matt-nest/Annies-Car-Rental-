import PDFDocument from 'pdfkit';

/**
 * Helper to fetch image data buffer from a base64 string
 */
function getSignatureBuffer(base64Image) {
  if (!base64Image) return null;
  const matches = base64Image.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return null;
  }
  return Buffer.from(matches[2], 'base64');
}

/**
 * Draws a simple labeled box
 */
function drawLabeledBox(doc, label, value, x, y, width, height) {
  doc.rect(x, y, width, height).stroke('#cccccc');
  doc.fontSize(8).fillColor('#666666').text(label, x + 4, y + 4);
  
  if (value) {
    doc.fontSize(10).fillColor('#000000').text(value, x + 4, y + 16, {
      width: width - 8,
      height: height - 16,
      ellipsis: true
    });
  }
}

/**
 * Generates a rental agreement PDF
 */
export async function generateRentalAgreementPdf(agreement, booking, res) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 40, bottom: 40, left: 40, right: 40 }
      });
      
      const customer = booking.customers || {};
      const vehicle = booking.vehicles || {};
      
      // Pipe the PDF directly to the response
      doc.pipe(res);
      
      // ════════════════════════════════════════════════════════════════════════════
      // PAGE 1: The Form
      // ════════════════════════════════════════════════════════════════════════════
      
      // Header
      doc.fontSize(20).font('Helvetica-Bold').text("ANNIE's CAR RENTAL", { align: 'center' });
      doc.fontSize(10).font('Helvetica').text("RENTAL AGREEMENT", { align: 'center' });
      doc.moveDown(2);
      
      let cursorY = doc.y;
      const leftColX = 40;
      const rightColX = 320;
      const colWidth = 260; // total 520 content width out of 612 (40+260+20+260+40=620... wait letter is 612x792 -> left40 + 532 = right 40)
      const adjustedColWidth = 250;
      const midGap = 32;
      const rightStart = leftColX + adjustedColWidth + midGap;
      
      // SECTION: Customer Details
      doc.fontSize(12).font('Helvetica-Bold').text("Customer Information", leftColX, cursorY);
      cursorY += 16;
      
      const customerName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
      drawLabeledBox(doc, "Customer Name", customerName, leftColX, cursorY, adjustedColWidth, 30);
      cursorY += 35;
      
      const address = agreement.address_line1 || '';
      drawLabeledBox(doc, "Home Address", address, leftColX, cursorY, adjustedColWidth, 30);
      cursorY += 35;
      
      drawLabeledBox(doc, "City", agreement.city || '', leftColX, cursorY, 100, 30);
      drawLabeledBox(doc, "State", agreement.state || '', leftColX + 110, cursorY, 60, 30);
      drawLabeledBox(doc, "Zip", agreement.zip || '', leftColX + 180, cursorY, 70, 30);
      cursorY += 35;
      
      drawLabeledBox(doc, "Driver's License No", agreement.driver_license_number || '', leftColX, cursorY, 130, 30);
      drawLabeledBox(doc, "State", agreement.driver_license_state || '', leftColX + 140, cursorY, 50, 30);
      drawLabeledBox(doc, "Expires", agreement.driver_license_expiry || '', leftColX + 200, cursorY, 50, 30);
      cursorY += 35;
      
      drawLabeledBox(doc, "Birth Date", agreement.date_of_birth || '', leftColX, cursorY, 100, 30);
      drawLabeledBox(doc, "Telephone", customer.phone || '', leftColX + 110, cursorY, 140, 30);
      cursorY += 35;
      
      drawLabeledBox(doc, "E-mail", customer.email || '', leftColX, cursorY, adjustedColWidth, 30);
      cursorY += 45;
      
      // Right side logic (start from top again)
      let rightCurY = doc.y - 231; // go back up to match left sections
      
      doc.fontSize(12).font('Helvetica-Bold').text("Rental Vehicle Information", rightStart, rightCurY);
      rightCurY += 16;
      
      drawLabeledBox(doc, "Rental Car VIN", vehicle.vin || '', rightStart, rightCurY, 250, 30);
      rightCurY += 35;
      
      drawLabeledBox(doc, "License No", vehicle.license_plate || '', rightStart, rightCurY, 150, 30);
      drawLabeledBox(doc, "State", vehicle.state || '', rightStart + 160, rightCurY, 90, 30);
      rightCurY += 35;
      
      const vehicleDesc = `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`;
      drawLabeledBox(doc, "Year / Make / Model", vehicleDesc, rightStart, rightCurY, 250, 30);
      rightCurY += 35;
      
      // Dates
      drawLabeledBox(doc, "Date OUT", `${booking.pickup_date} ${booking.pickup_time || ''}`, leftColX, cursorY, 120, 30);
      drawLabeledBox(doc, "Date DUE IN", `${booking.return_date} ${booking.return_time || ''}`, leftColX + 130, cursorY, 120, 30);
      cursorY += 45;
      
      // SECTION: Insurance
      doc.fontSize(12).font('Helvetica-Bold').text("Customer Vehicle Insurance Information", leftColX, cursorY);
      cursorY += 16;
      
      drawLabeledBox(doc, "Auto Insurance Company", agreement.insurance_company || '', leftColX, cursorY, adjustedColWidth, 30);
      cursorY += 35;
      
      drawLabeledBox(doc, "Policy No.", agreement.insurance_policy_number || '', leftColX, cursorY, 140, 30);
      drawLabeledBox(doc, "Expires", agreement.insurance_expiry || '', leftColX + 150, cursorY, 100, 30);
      cursorY += 35;
      
      drawLabeledBox(doc, "Agent", agreement.insurance_agent_name || '', leftColX, cursorY, 140, 30);
      drawLabeledBox(doc, "Telephone", agreement.insurance_agent_phone || '', leftColX + 150, cursorY, 100, 30);
      cursorY += 35;
      
      drawLabeledBox(doc, "Insured Vehicle Year/Make/Model", agreement.insurance_vehicle_description || '', leftColX, cursorY, adjustedColWidth, 30);
      cursorY += 45;
      
      // Right Side: Rates
      rightCurY = doc.y - 161;
      
      doc.fontSize(12).font('Helvetica-Bold').text("Car Rental Rate", rightStart, rightCurY);
      rightCurY += 16;
      
      drawLabeledBox(doc, "Daily Rate", `$${Number(booking.daily_rate).toFixed(2)}`, rightStart, rightCurY, 120, 30);
      drawLabeledBox(doc, "Weekly Rate", vehicle.weekly_rate ? `$${Number(vehicle.weekly_rate).toFixed(2)}` : 'N/A', rightStart + 130, rightCurY, 120, 30);
      rightCurY += 35;
      
      doc.fontSize(12).font('Helvetica-Bold').text("Time & Mileage Charges", rightStart, rightCurY);
      rightCurY += 16;
      
      drawLabeledBox(doc, "Rental Days", String(booking.rental_days), rightStart, rightCurY, 80, 30);
      drawLabeledBox(doc, "Miles Allowed", `${vehicle.mileage_limit_per_day || 150} / day`, rightStart + 90, rightCurY, 160, 30);
      rightCurY += 35;
      
      drawLabeledBox(doc, "Subtotal", `$${Number(booking.subtotal).toFixed(2)}`, rightStart, rightCurY, 250, 25);
      rightCurY += 27;
      
      drawLabeledBox(doc, "Tax", `$${Number(booking.tax_amount || 0).toFixed(2)}`, rightStart, rightCurY, 120, 25);
      drawLabeledBox(doc, "Delivery Fee", `$${Number(booking.delivery_fee || 0).toFixed(2)}`, rightStart + 130, rightCurY, 120, 25);
      rightCurY += 27;
      
      drawLabeledBox(doc, "Total Charge", `$${Number(booking.total_cost).toFixed(2)}`, rightStart, rightCurY, 250, 30);
      
      // Signatures Phase 1
      cursorY += 20; // below insurance
      drawLabeledBox(doc, "CUSTOMER SIGNATURE", "", leftColX, cursorY, adjustedColWidth, 60);
      const custSigStatus = agreement.customer_signature_data ? 'Signed' : 'Not Signed';
      doc.fontSize(10).fillColor(agreement.customer_signature_data ? '#15803d' : '#b91c1c').text(custSigStatus, leftColX + 4, cursorY + 45);
      
      if (agreement.customer_signature_data) {
        const sigBuf = getSignatureBuffer(agreement.customer_signature_data);
        if (sigBuf) {
          doc.image(sigBuf, leftColX + 50, cursorY + 10, { height: 40 });
        }
        
        doc.fontSize(8).fillColor('#666666').text(
          `Signed: ${new Date(agreement.customer_signed_at).toLocaleString()}`, 
          leftColX + 4, cursorY + 65
        );
      }
      
      drawLabeledBox(doc, "COMPANY SIGNATURE", "", rightStart, cursorY, 250, 60);
      const ownerSigStatus = agreement.owner_signature_data ? 'Countersigned' : 'Awaiting Countersignature';
      doc.fontSize(10).fillColor(agreement.owner_signature_data ? '#15803d' : '#b91c1c').text(ownerSigStatus, rightStart + 4, cursorY + 45);
      
      if (agreement.owner_signature_data) {
        const ownerSigBuf = getSignatureBuffer(agreement.owner_signature_data);
        if (ownerSigBuf) {
          doc.image(ownerSigBuf, rightStart + 50, cursorY + 10, { height: 40 });
        }
        doc.fontSize(8).fillColor('#666666').text(
          `Signed: ${new Date(agreement.owner_signed_at).toLocaleString()}`, 
          rightStart + 4, cursorY + 65
        );
      }
      
      // ════════════════════════════════════════════════════════════════════════════
      // PAGE 2: Terms and Conditions
      // ════════════════════════════════════════════════════════════════════════════
      doc.addPage();
      
      doc.fontSize(14).font('Helvetica-Bold').text("Rental Agreement Terms and Conditions", { align: 'center' });
      doc.moveDown();
      
      const terms1 = `1. Definitions. "Agreement" means all terms and conditions found on both sides of this form and on any other documents we give You at the time of rental. "You" or "Your" means the person identified as the customer on the reverse side of this Agreement, any person signing this Agreement, any Authorized Driver and any person or organization to whom charges are billed by Us at its or the customer's direction. You are jointly and severally bound by this Agreement. "We", "Us" or "Our" means the independent dealer named elsewhere in this Agreement. "Vehicle" means the automobile identified in this Agreement and any vehicle We substitute for it. The Vehicle is a temporary substitute for a vehicle that You own or lease.
      
2. Rental; Indemnity and Warranties. This is a contract for rental of the Vehicle. In addition to any rental charges stated in this Agreement, Our right (or the right of Our affiliate), to repair Your vehicle is consideration paid to Us for this rental. You agree to indemnify Us, defend Us and hold Us harmless from and against, all claims, liability, costs and attorneys' fees we incur resulting from, or arising out of, this Agreement or Your use of the Vehicle. We make no warranties, express, implied or apparent, regarding the Vehicle, no warranty of merchantability and no warranty that the Vehicle is fit for a particular purpose.

3. Condition and Return of Vehicle. You must return the Vehicle to Our office or other location We specify, on the date and time specified in this Agreement, in the same condition that You received it, except for ordinary wear. If the Vehicle is returned after closing hours, You remain responsible for any damage to the Vehicle until We inspect it on reopening for business. Service to the Vehicle or replacement of parts or accessories during this rental must have Our prior approval.

4. Responsibility for Damage or Loss; Reporting to Police. You are responsible for all damage to, or loss or theft of, the Vehicle, including damage caused by weather, road conditions, and acts of nature, whether or not You are at fault. You are responsible for the cost of repair, or the actual cash retail value of the Vehicle, on the date of the loss if the Vehicle is stolen, not repairable, or if We elect not to repair the Vehicle. You are also responsible for Loss of Use, and Our administrative expenses incurred processing the claim. You must report all accidents or incidents of theft and vandalism to Us and the police as soon as You discover them.`;

      const terms2 = `5. Prohibited Uses. The following uses of the Vehicle are prohibited and constitute breaches of this Agreement. The Vehicle shall not be used: (a) by anyone who is not an Authorized Driver or not licensed to drive, or by anyone whose driving license is suspended; (b) by anyone under the influence of alcohol, prescription or non-prescription drugs; (c) by anyone who obtained the Vehicle, or extended the rental period by giving Us false, fraudulent, or misleading information; (d) under any circumstances that could be properly charged as a crime other than a minor traffic violation; (e) to carry persons or property for hire; (f) to push or tow anything.

6. Insurance. You are responsible for all damage or loss You cause to others. You agree to provide auto liability, collision and comprehensive insurance covering You, Us, and the Vehicle. Your insurance may cover all or only part of the financial liability for the Vehicle. You should check with Your insurance company to find out about your coverage. Your insurance is primary.

7. Charges. You will pay Us, or the appropriate government authorities, on demand, all charges due under this Agreement, including: (a) time and mileage for the period that You kept the Vehicle; (b) applicable taxes; (c) $50 or the maximum amount permitted by law, whichever is greater, if You pay Us with a check returned unpaid for any reason; (d) all parking and traffic fines, toll violations, penalties, citations, forfeitures, court costs, towing, storage, impound charges and other expenses involving the Vehicle assessed against Us or the Vehicle.

8. Deposit. We may use Your deposit, if any, to pay amounts owed to Us under this Agreement.

9. Your Property. You release Us, Our agents and employees from all claims for loss of, or damage to, Your personal property or that of any other person, that We received, handled or stored, or that was left or carried in or on the Vehicle.`;

      doc.fontSize(8).font('Helvetica');
      // Render text in 2 columns
      doc.text(terms1, 40, 80, { width: 250, align: 'justify' });
      doc.text(terms2, 320, 80, { width: 250, align: 'justify' });

      // Finalize PDF file
      doc.end();
      
      // Wait for stream to finish
      res.on('finish', () => {
        resolve();
      });
      res.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}
