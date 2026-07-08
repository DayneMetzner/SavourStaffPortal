/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Invoice } from '../types';

export function downloadInvoice(invoice: Invoice) {
  // Format dates to DD/MM/YY as shown in the template
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = String(d.getFullYear()).slice(-2);
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  const invoiceDate = formatDate(invoice.createdAt);

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice - ${invoice.staffName} - ${invoice.eventName}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      color: #000000;
      margin: 0;
      padding: 40px;
      line-height: 1.4;
      background-color: #f1f5f9;
    }

    .page-wrapper {
      max-width: 800px;
      margin: 0 auto;
    }

    .invoice-container {
      background-color: #ffffff;
      padding: 60px 50px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
      position: relative;
    }

    /* Print utility bar styling */
    .print-bar {
      background-color: #1e293b;
      padding: 12px 24px;
      border-radius: 8px;
      display: flex;
      justify-content: justify;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }

    .print-bar span {
      color: #94a3b8;
      font-size: 13px;
      font-weight: 500;
      flex-grow: 1;
    }

    .print-bar-btn {
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 700;
      border-radius: 6px;
      cursor: pointer;
      border: none;
      transition: all 0.1s ease;
    }

    .btn-print {
      background-color: #10b981;
      color: #ffffff;
    }

    .btn-print:hover {
      background-color: #059669;
    }

    .btn-close {
      background-color: #475569;
      color: #f8fafc;
    }

    .btn-close:hover {
      background-color: #334155;
    }

    @media print {
      body {
        background-color: #ffffff !important;
        padding: 0 !important;
      }
      .invoice-container {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
      }
      .print-bar {
        display: none !important;
      }
    }

    .header-section {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 50px;
    }

    .invoice-title {
      font-size: 28px;
      font-weight: bold;
      text-align: right;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #64748b;
      padding-bottom: 10px;
    }

    .bill-to-box {
      text-align: right;
      font-size: 14px;
      color: #000000;
      line-height: 1.5;
    }

    .bill-to-box a {
      color: #2563eb;
      text-decoration: none;
    }

    .metadata-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 40px;
      font-size: 14px;
    }

    .metadata-cell {
      width: 50%;
      vertical-align: top;
      padding: 8px 0;
    }

    .metadata-row {
      margin-bottom: 15px;
      display: flex;
    }

    .metadata-label {
      font-weight: bold;
      width: 120px;
      color: #000000;
    }

    .metadata-value {
      color: #000000;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
      font-size: 13px;
    }

    .items-table th {
      background-color: #c3ddf7; /* Matching soft blue color from PDF template */
      color: #000000;
      font-weight: bold;
      text-align: center;
      padding: 10px 6px;
      border: 1.5px solid #000000;
    }

    .items-table td {
      padding: 10px 6px;
      border: 1.5px solid #000000;
      color: #000000;
      text-align: center;
    }

    .items-table td.desc-cell {
      text-align: left;
      padding-left: 10px;
    }

    .total-wrapper-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 50px;
    }

    .total-box-container {
      width: 160px;
      float: right;
      border-collapse: collapse;
    }

    .total-box-header {
      background-color: #c3ddf7;
      color: #000000;
      font-weight: bold;
      text-align: center;
      padding: 8px;
      border: 1.5px solid #000000;
      font-size: 13px;
      text-transform: capitalize;
    }

    .total-box-value {
      padding: 12px;
      text-align: center;
      border: 1.5px solid #000000;
      font-size: 14px;
      font-weight: bold;
      color: #000000;
    }

    .footer-disclaimer {
      font-size: 12px;
      color: #000000;
      line-height: 1.6;
      text-align: left;
      margin-top: 40px;
      clear: both;
    }
  </style>
</head>
<body>

  <div class="page-wrapper">
    <!-- Built-in Print Bar for Testing / Production Ease -->
    <div class="print-bar">
      <span>📄 <strong>Invoice Template system:</strong> Click Print to Save as a PDF with perfect alignments.</span>
      <button class="print-bar-btn btn-print" onclick="window.print()">Print / Save PDF</button>
      <button class="print-bar-btn btn-close" onclick="window.close();">Close Window</button>
    </div>

    <div class="invoice-container">
      <table class="header-section">
        <tr>
          <td>
            <!-- Empty left spacing -->
          </td>
          <td style="width: 400px; vertical-align: top;">
            <div class="invoice-title">Invoice</div>
            <div class="bill-to-box">
              <strong>Bill to - Company:</strong> BBQ festivals LTD<br>
              <strong>Email:</strong> <a href="mailto:accounts@savourfestival.com">accounts@savourfestival.com</a><br>
              <strong>Email:</strong> <a href="mailto:info@savourfestival.com">info@savourfestival.com</a><br>
              <strong>Address:</strong> 110 Wigmore Street, Marylebone, London, W1U 3RW
            </div>
          </td>
        </tr>
      </table>

      <table class="metadata-table">
        <tr>
          <td class="metadata-cell">
            <div class="metadata-row">
              <span class="metadata-label">Name:</span>
              <span class="metadata-value">${invoice.contactDetails.fullName}</span>
            </div>
            <div class="metadata-row">
              <span class="metadata-label">Email:</span>
              <span class="metadata-value">${invoice.contactDetails.email}</span>
            </div>
            <div class="metadata-row">
              <span class="metadata-label">Mobile:</span>
              <span class="metadata-value">${invoice.contactDetails.phoneNumber}</span>
            </div>
          </td>
          <td class="metadata-cell">
            <div class="metadata-row">
              <span class="metadata-label">Date:</span>
              <span class="metadata-value">${invoiceDate}</span>
            </div>
            <div class="metadata-row">
              <span class="metadata-label">Sort Code:</span>
              <span class="metadata-value">${invoice.financialDetails.sortCode}</span>
            </div>
            <div class="metadata-row">
              <span class="metadata-label">Account Number:</span>
              <span class="metadata-value">${invoice.financialDetails.accountNumber}</span>
            </div>
          </td>
        </tr>
      </table>

      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 14%;">Date of Work</th>
            <th style="width: 30%;">Description</th>
            <th style="width: 12%;">Start Time</th>
            <th style="width: 12%;">End Time</th>
            <th style="width: 10%;">Hours</th>
            <th style="width: 10%;">Rate</th>
            <th style="width: 12%;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${invoice.shifts.map(s => `
            <tr>
              <td>${formatDate(s.date)}</td>
              <td class="desc-cell">${s.locationName || 'Worked Shift'}</td>
              <td>-</td>
              <td>-</td>
              <td>${s.hours}</td>
              <td>£${s.rate.toFixed(2)}</td>
              <td>£${s.total.toFixed(2)}</td>
            </tr>
          `).join('')}
          ${invoice.expenses.map(e => `
            <tr>
              <td>-</td>
              <td class="desc-cell">Expense: ${e.description}</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td>£${e.amount.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <table class="total-wrapper-table">
        <tr>
          <td></td>
          <td style="width: 200px; vertical-align: top;">
            <table class="total-box-container">
              <thead>
                <tr>
                  <th class="total-box-header">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="total-box-value">£${invoice.grandTotal.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </table>

      <div class="footer-disclaimer">
        I acknowledge I am responsible for my own self-assessment and tax declaration as a freelancer in line with HMRC guidelines should my annual income be over £12570 after this payment is received.
      </div>
    </div>
  </div>

  <script>
    // Self-acting triggers or utilities can be added here
  </script>
</body>
</html>`;

  // Create downloadable file blob
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  const sanitizedStaffName = invoice.staffName.replace(/[^a-zA-Z0-9]/g, '_');
  const sanitizedEventName = invoice.eventName.replace(/[^a-zA-Z0-9]/g, '_');
  
  link.setAttribute('download', `Invoice_${sanitizedStaffName}_${sanitizedEventName}_${invoice.id}.html`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
