import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Building2, User, Phone, Mail, MapPin, FileText, CheckCircle2,
  AlertCircle, Truck, Package, QrCode, CreditCard, ShieldCheck
} from 'lucide-react';
import { money, fmtDate, fmtDateTime } from '../lib/api';
import { renderCustomDocumentHtml } from '../lib/exporters';

export const DEFAULT_INVOICE_SECTIONS = [
  { id: 'invoice_header', name: 'Header, Logo & Company Tax Identifiers', enabled: true },
  { id: 'buyer_shipping', name: 'Buyer (Bill-To) & Consignee (Ship-To) Addresses', enabled: true },
  { id: 'transport_meta', name: 'Order, PO, E-Way & Transport Details', enabled: true },
  { id: 'custom_banner', name: 'Custom Notice / Announcement Banner', enabled: true },
  { id: 'items_table', name: 'Itemized Line Items & HSN Table', enabled: true },
  { id: 'bank_qr_totals', name: 'Bank Details, UPI QR & Total Summary', enabled: true },
  { id: 'hsn_summary', name: 'HSN / SAC Tax Slab Summary Matrix', enabled: true },
  { id: 'terms_signature', name: 'Terms & Conditions & Authorized Signatory', enabled: true }
];

export const INVOICE_THEMES = [
  {
    id: 'corporate_blue',
    name: 'Corporate GST Blue',
    badge: 'GST Standard',
    tagline: 'Standard professional B2B & B2C tax invoice format with complete statutory compliance.',
    description: 'Features company tax identifiers, structured Bill-To & Ship-To, HSN summary matrix, and bank transfer block.',
    defaults: {
      accentColor: 'blue',
      paperSize: 'A4',
      showInvoiceLogo: true,
      showCompanyTaxMeta: true,
      showConsigneeShipTo: true,
      showTransportMeta: true,
      showItemHsn: true,
      showItemUnit: true,
      showItemTaxBreakup: true,
      showHsnSummaryTable: true,
      showBankDetails: true,
      showPaymentQr: true,
      showInvoiceWordsTotal: true,
      showInvoiceSignature: true,
      showInvoiceTerms: true,
      sections: DEFAULT_INVOICE_SECTIONS,
      customLabels: {
        invoiceTitle: 'TAX INVOICE',
        recipientCopy: 'Original for Recipient',
        billToTitle: 'Bill To (Buyer / Customer)',
        shipToTitle: 'Ship To (Consignee)',
        itemColHeader: 'Item Description',
        hsnColHeader: 'HSN/SAC',
        qtyColHeader: 'Qty',
        unitColHeader: 'Unit',
        rateColHeader: 'Rate (₹)',
        taxableColHeader: 'Taxable (₹)',
        taxRateColHeader: 'Tax %',
        amountColHeader: 'Amount (₹)',
        subtotalLabel: 'Total Taxable Amount:',
        discountLabel: 'Special Discount:',
        taxLabel: 'Total GST:',
        totalLabel: 'TOTAL INVOICE VALUE:',
        wordsLabel: 'Amount in Words (Rupees):',
        termsTitle: 'Terms & Conditions',
        signatoryTitle: 'Authorised Signatory',
        computerGeneratedNote: 'This is a Computer Generated Tax Invoice'
      }
    }
  },
  {
    id: 'modern_clean',
    name: 'Modern Minimalist',
    badge: 'Clean Design',
    tagline: 'Sleek, modern typography with crisp borders and clean table layout.',
    description: 'High-contrast total summary card, compact metadata, and elegant footer.',
    defaults: {
      accentColor: 'indigo',
      paperSize: 'A4',
      showInvoiceLogo: true,
      showCompanyTaxMeta: false,
      showConsigneeShipTo: false,
      showTransportMeta: false,
      showItemHsn: true,
      showItemUnit: true,
      showItemTaxBreakup: true,
      showHsnSummaryTable: false,
      showBankDetails: true,
      showPaymentQr: true,
      showInvoiceWordsTotal: true,
      showInvoiceSignature: true,
      showInvoiceTerms: true,
      sections: DEFAULT_INVOICE_SECTIONS,
      customLabels: {
        invoiceTitle: 'INVOICE',
        recipientCopy: 'Customer Copy',
        billToTitle: 'Billed To',
        shipToTitle: 'Shipped To',
        itemColHeader: 'Description',
        hsnColHeader: 'HSN',
        qtyColHeader: 'Qty',
        unitColHeader: 'Unit',
        rateColHeader: 'Price (₹)',
        taxableColHeader: 'Taxable (₹)',
        taxRateColHeader: 'GST%',
        amountColHeader: 'Total (₹)',
        subtotalLabel: 'Subtotal:',
        discountLabel: 'Discount:',
        taxLabel: 'Taxes:',
        totalLabel: 'FINAL AMOUNT:',
        wordsLabel: 'Total in Words:',
        termsTitle: 'Notes & Terms',
        signatoryTitle: 'Signed by',
        computerGeneratedNote: 'Electronic Invoice'
      }
    }
  },
  {
    id: 'classic_emerald',
    name: 'Classic Emerald Ledger',
    badge: 'Traditional',
    tagline: 'Traditional framed border layout with rich emerald green accents and ledger styling.',
    description: 'Distinctive section headers, clear financial reconciliation rows, and ledger-grade readability.',
    defaults: {
      accentColor: 'emerald',
      paperSize: 'A4',
      showInvoiceLogo: true,
      showCompanyTaxMeta: true,
      showConsigneeShipTo: true,
      showTransportMeta: false,
      showItemHsn: true,
      showItemUnit: true,
      showItemTaxBreakup: true,
      showHsnSummaryTable: true,
      showBankDetails: true,
      showPaymentQr: true,
      showInvoiceWordsTotal: true,
      showInvoiceSignature: true,
      showInvoiceTerms: true,
      sections: DEFAULT_INVOICE_SECTIONS,
      customLabels: {
        invoiceTitle: 'GST TAX INVOICE',
        recipientCopy: 'Original Invoice Copy',
        billToTitle: 'Purchaser / Debtor',
        shipToTitle: 'Destination Consignee',
        itemColHeader: 'Particulars of Goods / Services',
        hsnColHeader: 'HSN/SAC',
        qtyColHeader: 'Quantity',
        unitColHeader: 'UOM',
        rateColHeader: 'Unit Rate (₹)',
        taxableColHeader: 'Taxable Value (₹)',
        taxRateColHeader: 'GST Rate',
        amountColHeader: 'Net Amount (₹)',
        subtotalLabel: 'Net Goods Value:',
        discountLabel: 'Trade Rebate / Discount:',
        taxLabel: 'Cumulative GST:',
        totalLabel: 'NET BILL PAYABLE:',
        wordsLabel: 'Amount Chargeable in Words:',
        termsTitle: 'Terms of Sale & Settlement',
        signatoryTitle: 'For & on behalf of Merchant',
        computerGeneratedNote: 'Statutory Computer Generated Tax Invoice'
      }
    }
  },
  {
    id: 'industrial_logistics',
    name: 'Industrial & Logistics Wholesale',
    badge: 'Transport & B2B',
    tagline: 'Heavy-duty layout featuring Vehicle No, Packaging units, E-Way Bill, and Consignee shipping details.',
    description: 'Built for distributors, manufacturers, and freight deliveries requiring transport and delivery documents.',
    defaults: {
      accentColor: 'slate',
      paperSize: 'A4',
      showInvoiceLogo: true,
      showCompanyTaxMeta: true,
      showConsigneeShipTo: true,
      showTransportMeta: true,
      showItemHsn: true,
      showItemUnit: true,
      showItemTaxBreakup: true,
      showHsnSummaryTable: true,
      showBankDetails: true,
      showPaymentQr: true,
      showInvoiceWordsTotal: true,
      showInvoiceSignature: true,
      showInvoiceTerms: true,
      sections: DEFAULT_INVOICE_SECTIONS,
      customLabels: {
        invoiceTitle: 'TAX INVOICE & DESPATCH CHALLAN',
        recipientCopy: 'Original for Consignee / Transporter',
        billToTitle: 'Consignee (Bill-To Entity)',
        shipToTitle: 'Despatch To (Delivery Site)',
        itemColHeader: 'Commodity / Description',
        hsnColHeader: 'Tariff / HSN',
        qtyColHeader: 'Despatched Qty',
        unitColHeader: 'Pkg Unit',
        rateColHeader: 'Contract Rate (₹)',
        taxableColHeader: 'Assessable Value (₹)',
        taxRateColHeader: 'IGST/CGST%',
        amountColHeader: 'Gross Amount (₹)',
        subtotalLabel: 'Assessable Value Total:',
        discountLabel: 'Commercial Rebate:',
        taxLabel: 'Central & State Tax:',
        totalLabel: 'TOTAL CONSIGNMENT VALUE:',
        wordsLabel: 'Consignment Amount in Words:',
        termsTitle: 'Freight, Demurrage & Delivery Conditions',
        signatoryTitle: 'Authorised Despatch Officer',
        computerGeneratedNote: 'E-Way Compliant Computer Generated Tax Document'
      }
    }
  },
  {
    id: 'compact_a5',
    name: 'Compact A5 Half-Page',
    badge: '50% Paper Saver',
    tagline: 'Space-efficient format designed specifically for A5 paper (148 × 210 mm).',
    description: 'Compact font and tight line height allowing single-page printing on half-sheet A5 sheets without overflow.',
    defaults: {
      accentColor: 'blue',
      paperSize: 'A5',
      showInvoiceLogo: false,
      showCompanyTaxMeta: false,
      showConsigneeShipTo: false,
      showTransportMeta: false,
      showItemHsn: true,
      showItemUnit: false,
      showItemTaxBreakup: false,
      showHsnSummaryTable: false,
      showBankDetails: true,
      showPaymentQr: true,
      showInvoiceWordsTotal: false,
      showInvoiceSignature: true,
      showInvoiceTerms: false,
      sections: DEFAULT_INVOICE_SECTIONS,
      customLabels: {
        invoiceTitle: 'TAX INVOICE (A5)',
        recipientCopy: 'Original',
        billToTitle: 'Customer / Buyer',
        shipToTitle: 'Ship To',
        itemColHeader: 'Item',
        hsnColHeader: 'HSN',
        qtyColHeader: 'Qty',
        unitColHeader: 'Unit',
        rateColHeader: 'Rate',
        taxableColHeader: 'Taxable',
        taxRateColHeader: 'GST%',
        amountColHeader: 'Amount (₹)',
        subtotalLabel: 'Subtotal:',
        discountLabel: 'Disc:',
        taxLabel: 'GST:',
        totalLabel: 'TOTAL:',
        wordsLabel: 'In Words:',
        termsTitle: 'Terms',
        signatoryTitle: 'Authorised Signatory',
        computerGeneratedNote: 'Computer Generated Bill'
      }
    }
  }
];

export const ACCENT_COLORS = [
  { id: 'blue', name: 'Corporate Blue', hex: '#1e40af', bgLight: 'bg-blue-50', textMain: 'text-blue-900', border: 'border-blue-200', bgHeader: 'bg-blue-900' },
  { id: 'indigo', name: 'Royal Indigo', hex: '#4f46e5', bgLight: 'bg-indigo-50', textMain: 'text-indigo-900', border: 'border-indigo-200', bgHeader: 'bg-indigo-900' },
  { id: 'emerald', name: 'Emerald Green', hex: '#059669', bgLight: 'bg-emerald-50', textMain: 'text-emerald-900', border: 'border-emerald-200', bgHeader: 'bg-emerald-800' },
  { id: 'slate', name: 'Slate Charcoal', hex: '#334155', bgLight: 'bg-slate-50', textMain: 'text-slate-900', border: 'border-slate-300', bgHeader: 'bg-slate-900' },
  { id: 'crimson', name: 'Crimson Wine', hex: '#be123c', bgLight: 'bg-rose-50', textMain: 'text-rose-900', border: 'border-rose-200', bgHeader: 'bg-rose-900' },
  { id: 'amber', name: 'Warm Amber', hex: '#d97706', bgLight: 'bg-amber-50', textMain: 'text-amber-900', border: 'border-amber-200', bgHeader: 'bg-amber-900' }
];

export const SAMPLE_INVOICE_DATA = {
  orderId: 'INV-2026-1082',
  voucherNo: 'VCH-1082',
  date: new Date().toISOString(),
  dueDate: new Date(Date.now() + 15 * 86400000).toISOString(),
  paymentTerms: 'Net 15 Days',
  buyerOrderNo: 'PO-98421',
  buyerOrderDate: new Date(Date.now() - 2 * 86400000).toISOString(),
  buyerRef: 'REQ-452',
  buyerRefDate: new Date(Date.now() - 3 * 86400000).toISOString(),
  eWayBillNo: '2410 9842 1190',
  vehicleNo: 'KA-01-MJ-4582',
  dispatchDocNo: 'LR-9982',
  dispatchDate: new Date().toISOString(),
  dispatchFrom: 'Bengaluru Central Warehouse',
  placeOfSupply: '29 - Karnataka',
  termsOfDelivery: 'Doorstep Delivery by Road Freight',
  cashier: 'Suresh Kumar',
  customerName: 'TechNova Solutions Pvt Ltd',
  customerPhone: '+91 98450 88776',
  customerEmail: 'accounts@technovasolutions.in',
  customerAddress: 'Tower B, 4th Floor, Global Tech Park, Whitefield, Bengaluru, Karnataka 560066',
  customerGstin: '29AABCT1234F1Z8',
  customerPan: 'AABCT1234F',
  customerState: 'Karnataka',
  customerStateCode: '29',
  consigneeName: 'TechNova Bengaluru Hub',
  consigneeAddress: 'Plot 42, Industrial Suburb, Peenya 2nd Stage, Bengaluru, Karnataka 560058',
  consigneeGstin: '29AABCT1234F1Z8',
  subtotal: 18500.00,
  discount: 500.00,
  tax: 2790.00,
  roundOff: 0.00,
  total: 20790.00,
  paidAmount: 20790.00,
  dueAmount: 0.00,
  paymentMethod: 'Bank NEFT / RTGS',
  items: [
    {
      name: 'Commercial High-Speed POS Terminal 15.6"',
      hsn: '8471',
      qty: 1,
      unit: 'pcs',
      price: 12000.00,
      discount: 300.00,
      taxRate: 18,
      total: 13806.00
    },
    {
      name: 'Thermal 80mm High-Density Receipt Rolls (Box of 50)',
      hsn: '4811',
      qty: 2,
      unit: 'box',
      price: 1500.00,
      discount: 100.00,
      taxRate: 12,
      total: 3248.00
    },
    {
      name: 'Omni-Directional 2D Barcode Scanner USB',
      hsn: '8471',
      qty: 1,
      unit: 'pcs',
      price: 3500.00,
      discount: 100.00,
      taxRate: 18,
      total: 4012.00
    },
    {
      name: 'Stainless Steel Heavy-Duty Cash Drawer RJ11',
      hsn: '8303',
      qty: 1,
      unit: 'pcs',
      price: 2000.00,
      discount: 0.00,
      taxRate: 18,
      total: 2360.00
    }
  ]
};

/** Convert number to Indian words format (Rupees) */
export function numberToWords(amount) {
  const num = Math.round(Number(amount) || 0);
  if (num === 0) return 'Zero Rupees Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n) {
    if (n === 0) return '';
    if (n < 20) return a[n] + ' ';
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '') + ' ';
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred ' + inWords(n % 100);
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand ' + inWords(n % 1000);
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh ' + inWords(n % 100000);
    return inWords(Math.floor(n / 10000000)) + ' Crore ' + inWords(n % 10000000);
  }

  // inWords() branches each already end in their own trailing space, and the
  // ' Thousand '/' Lakh '/' Crore ' separators add a leading space too, which
  // doubled up the space before those words on every printed amount ≥ 1,000.
  // Collapsing runs of whitespace keeps this safe regardless of branch taken.
  return (inWords(num).trim() + ' Rupees Only').replace(/\s+/g, ' ');
}

/**
 * Main Full A4 / A5 Tax Invoice Document Renderer
 */
export function InvoiceDocumentView({
  invoice = SAMPLE_INVOICE_DATA,
  settings = {},
  tenant = {},
  customConfig = null,
  activeTheme = null
}) {
  const company = invoice.company || settings?.company || {
    name: tenant?.name || 'Selsolve Technologies Private Limited',
    address: 'Plot 102, EPIP Zone, Whitefield',
    city: 'Bengaluru',
    state: 'Karnataka',
    stateCode: '29',
    pincode: '560066',
    phone: '+91 80 4123 9988',
    email: 'billing@selsolvetech.com',
    website: 'www.selsolvetech.com',
    gstin: '29AABCS9876E1Z4',
    pan: 'AABCS9876E',
    cin: 'U72900KA2022PTC158941',
    fssaiNo: '11223344556677',
    lutBondNo: 'AD290422001928K',
    bankAccountHolder: 'Selsolve Technologies Pvt Ltd',
    bankName: 'HDFC Bank Ltd',
    bankAccountNumber: '50200088991122',
    bankIfsc: 'HDFC0001234',
    bankBranch: 'Whitefield Branch, Bengaluru',
    upiId: 'selsolve@hdfcbank'
  };

  const billing = settings?.billing || {};
  const currentThemeId = activeTheme || customConfig?.activeInvoiceTemplate || billing.activeInvoiceTemplate || 'corporate_blue';
  const customTemplates = (billing.customTemplates || []).filter((t) => t.type === 'invoice');
  const selectedCustom = customTemplates.find((t) => t.id === currentThemeId);
  const baseThemeId = selectedCustom ? selectedCustom.baseTheme : currentThemeId;
  const themeMeta = INVOICE_THEMES.find((t) => t.id === baseThemeId) || INVOICE_THEMES[0];
  const customTemplateConfig = selectedCustom ? (selectedCustom.config || {}) : {};

  // Deliberately NOT spreading `billing` into this merge. Template appearance
  // is per-theme data — it belongs only in `customTemplateConfig` (this
  // theme's own saved override, looked up by its own id) or `customConfig`
  // (an explicit live-preview override from the editor). Spreading the whole
  // `billing` settings object here used to mean whichever theme was *last
  // saved* bled its exact settings into every other theme's rendering too,
  // since billing is one global object shared by all of them.
  const cfg = {
    ...themeMeta.defaults,
    ...customTemplateConfig,
    ...(customConfig || {}),
    customLabels: {
      ...themeMeta.defaults.customLabels,
      ...(customTemplateConfig.customLabels || {}),
      ...(customConfig?.customLabels || {})
    }
  };

  const labels = cfg.customLabels;
  const accentColorId = cfg.invoiceAccentColor || cfg.accentColor || 'blue';
  const accent = ACCENT_COLORS.find((c) => c.id === accentColorId) || ACCENT_COLORS[0];
  const isA5 = cfg.invoicePaperSize === 'A5' || cfg.paperSize === 'A5';

  // Compute GST slabs and HSN summary
  const gstSlabs = {};
  const hsnSummary = {};
  let totalTaxableValue = 0;
  let totalTaxAmt = 0;

  (invoice.items || []).forEach((item) => {
    const qty = Number(item.qty) || 1;
    const price = Number(item.price) || 0;
    const discount = Number(item.discount) || 0;
    const taxRate = Number(item.taxRate) || 0;
    const taxable = Math.max(0, Math.round((qty * price - discount) * 100) / 100);
    const tax = Math.round(((taxable * taxRate) / 100) * 100) / 100;
    const hsn = item.hsn || item.hsnCode || 'N/A';

    totalTaxableValue += taxable;
    totalTaxAmt += tax;

    if (!gstSlabs[taxRate]) {
      gstSlabs[taxRate] = { taxable: 0, tax: 0, cgst: 0, sgst: 0, igst: 0 };
    }
    gstSlabs[taxRate].taxable += taxable;
    gstSlabs[taxRate].tax += tax;

    if (!hsnSummary[hsn]) {
      hsnSummary[hsn] = { rate: taxRate, taxable: 0, tax: 0, cgst: 0, sgst: 0, igst: 0 };
    }
    hsnSummary[hsn].taxable += taxable;
    hsnSummary[hsn].tax += tax;

    if (billing.interState) {
      gstSlabs[taxRate].igst += tax;
      hsnSummary[hsn].igst += tax;
    } else {
      gstSlabs[taxRate].cgst += tax / 2;
      gstSlabs[taxRate].sgst += tax / 2;
      hsnSummary[hsn].cgst += tax / 2;
      hsnSummary[hsn].sgst += tax / 2;
    }
  });

  // QR Code Generation
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    if (!cfg.showPaymentQr) {
      setQrDataUrl('');
      return;
    }
    const upiId = billing.upiId || company.upiId || 'selsolve@hdfcbank';
    const payeeName = encodeURIComponent(company.name || 'Store');
    const orderTotal = Number(invoice.total || 0).toFixed(2);
    const orderRef = invoice.orderId || 'BILL';
    const qrPayload = `upi://pay?pa=${upiId}&pn=${payeeName}&am=${orderTotal}&cu=INR&tn=Invoice%20${orderRef}`;

    QRCode.toDataURL(qrPayload, {
      width: 130,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [cfg.showPaymentQr, invoice.total, invoice.orderId, billing.upiId, company.name, company.upiId]);

  const paidAmt = Number(invoice.paidAmount ?? (invoice.paymentStatus === 'PAID' ? invoice.total : 0));
  const dueAmt = Math.max(0, Number(invoice.dueAmount ?? (Number(invoice.total || 0) - paidAmt)));
  const isPaid = dueAmt <= 0 && paidAmt > 0;
  const isPartiallyPaid = dueAmt > 0 && paidAmt > 0;
  const isFullyUnpaid = dueAmt > 0 && paidAmt === 0;
  const isDraft = invoice.status === 'DRAFT';
  const isVoid = invoice.status === 'VOID' || invoice.status === 'CANCELLED';

  const containerWidth = isA5 ? 'max-w-[700px] text-[10.5px]' : 'max-w-[860px] text-[11.5px]';

  // A saved custom template's `sections` array can end up missing an entry
  // entirely (rather than explicitly disabled) — e.g. from an older save
  // before a section was introduced. Treat "missing" as "shown" (the same as
  // a brand-new theme), and only hide a section the saved config explicitly
  // disabled.
  const sections = cfg.sections || DEFAULT_INVOICE_SECTIONS;
  const sectionMap = {};
  DEFAULT_INVOICE_SECTIONS.forEach((s) => { sectionMap[s.id] = true; });
  sections.forEach((s) => { sectionMap[s.id] = s.enabled !== false; });

  // If template has exact custom HTML markup (e.g. from Word or custom HTML import), render it directly!
  if (cfg.customHtml && cfg.customHtml.trim()) {
    return (
      <div
        id="printable-tax-invoice"
        className={`bg-white text-slate-900 mx-auto rounded-xl border border-slate-200 font-sans shadow-md print:border-none print:shadow-none p-4 sm:p-6 w-full overflow-hidden box-border ${containerWidth}`}
        style={{ boxSizing: 'border-box' }}
      >
        {cfg.customCss && <style dangerouslySetInnerHTML={{ __html: cfg.customCss }} />}
        <div
          className="custom-document-template-root w-full overflow-hidden bg-white"
          dangerouslySetInnerHTML={{
            __html: renderCustomDocumentHtml(cfg.customHtml, { invoice, company, billing, cfg })
          }}
        />
      </div>
    );
  }

  return (
    <div
      id="printable-tax-invoice"
      className={`bg-white text-slate-900 mx-auto rounded-xl border border-slate-200 font-sans shadow-md print:border-none print:shadow-none print:p-0 print:m-0 w-full overflow-hidden box-border ${containerWidth}`}
      style={{ boxSizing: 'border-box' }}
    >
      {cfg.customCss && <style dangerouslySetInnerHTML={{ __html: cfg.customCss }} />}

      {/* ----------------- 1. INVOICE HEADER BAR ----------------- */}
      {sectionMap.invoice_header && (
        <div className={`p-4 sm:p-6 pb-4 border-b flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${accent.border}`}>
          <div className="flex items-start gap-3.5">
            {cfg.showInvoiceLogo && company.logoUrl && (
              <img
                src={company.logoUrl}
                alt="Logo"
                className="h-12 w-12 rounded-lg object-contain border border-slate-100 shrink-0"
              />
            )}
            <div>
              <div className="text-lg font-black tracking-tight text-slate-950 uppercase">
                {company.name}
              </div>
              {company.address && (
                <div className="text-xs text-slate-600 mt-0.5 max-w-sm">{company.address}</div>
              )}
              <div className="text-xs text-slate-600">
                {[company.city, company.state && `State: ${company.state}`, company.pincode && `PIN: ${company.pincode}`].filter(Boolean).join(' · ')}
                {company.stateCode && ` (Code: ${company.stateCode})`}
              </div>

              {/* Statutory Tax IDs */}
              {cfg.showCompanyTaxMeta && (
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[10.5px] text-slate-800">
                  {company.gstin && (
                    <span className="font-bold">
                      GSTIN: <span className="font-mono">{company.gstin}</span>
                    </span>
                  )}
                  {company.pan && (
                    <span className="font-semibold">
                      PAN: <span className="font-mono">{company.pan}</span>
                    </span>
                  )}
                  {company.cin && (
                    <span className="font-semibold">
                      CIN: <span className="font-mono">{company.cin}</span>
                    </span>
                  )}
                  {company.fssaiNo && (
                    <span className="font-semibold">
                      FSSAI: <span className="font-mono">{company.fssaiNo}</span>
                    </span>
                  )}
                  {company.lutBondNo && (
                    <span className="font-semibold">
                      LUT Bond: <span className="font-mono">{company.lutBondNo}</span>
                    </span>
                  )}
                </div>
              )}

              <div className="text-[10.5px] text-slate-500 mt-0.5">
                {[company.phone && `Tel: ${company.phone}`, company.email && `Email: ${company.email}`, company.website].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>

          <div className="text-right sm:min-w-[190px] shrink-0">
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              {labels.recipientCopy || 'Original for Recipient'}
            </div>
            <div
              className="text-xl font-black tracking-tight uppercase mt-0.5"
              style={{ color: accent.hex }}
            >
              {labels.invoiceTitle || billing.invoiceTitle || 'TAX INVOICE'}
            </div>
            <div className="text-sm font-mono font-bold text-slate-900 mt-0.5">
              #{invoice.orderId}
            </div>

            {isVoid ? (
              <div className="text-[10px] font-extrabold text-rose-600 uppercase tracking-wider mt-1">
                [ VOID / CANCELLED ]
              </div>
            ) : isDraft ? (
              <div className="text-[10px] font-extrabold text-sky-600 uppercase tracking-wider mt-1">
                [ DRAFT INVOICE ]
              </div>
            ) : isPaid ? (
              <div className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider mt-1">
                [ PAID IN FULL ]
              </div>
            ) : isPartiallyPaid ? (
              <div className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider mt-1">
                [ PARTIALLY PAID ]
              </div>
            ) : (
              <div className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider mt-1">
                [ UNPAID / DUE ]
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom Announcement / Notice Banner */}
      {sectionMap.custom_banner && cfg.customBannerText && (
        <div
          className="px-4 py-2 text-center font-bold text-xs border-b"
          style={{ backgroundColor: accent.hex + '15', color: accent.hex, borderColor: accent.hex + '30' }}
        >
          {cfg.customBannerText}
        </div>
      )}

      {/* ----------------- 2. BUYER (BILL-TO) & SHIP-TO & DATES ----------------- */}
      {(sectionMap.buyer_shipping || sectionMap.transport_meta) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 border-b border-slate-200 text-xs">
          {/* Bill To & Ship To */}
          {sectionMap.buyer_shipping && (
            <div className="p-4 sm:p-5 sm:border-r border-slate-200 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {labels.billToTitle || 'Bill To (Buyer / Customer)'}
              </div>
              <div className="text-sm font-bold text-slate-950">
                {invoice.customerName || 'Walk-in Customer'}
              </div>
              {invoice.customerAddress && (
                <div className="text-slate-600 max-w-xs">{invoice.customerAddress}</div>
              )}
              {invoice.customerPhone && (
                <div className="text-slate-600">Phone: {invoice.customerPhone}</div>
              )}
              {invoice.customerGstin && (
                <div className="text-slate-800 font-bold">
                  GSTIN / UIN: <span className="font-mono underline">{invoice.customerGstin}</span>
                </div>
              )}
              {invoice.customerPan && (
                <div className="text-slate-700">PAN: {invoice.customerPan}</div>
              )}
              {(invoice.customerState || invoice.customerStateCode) && (
                <div className="text-slate-600">
                  State: {invoice.customerState || '—'}{invoice.customerStateCode ? ` (Code: ${invoice.customerStateCode})` : ''}
                </div>
              )}

              {/* Consignee (Ship To) if enabled */}
              {cfg.showConsigneeShipTo && invoice.consigneeAddress && (
                <div className="pt-2 mt-2 border-t border-slate-100">
                  <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">
                    {labels.shipToTitle || 'Ship To (Consignee)'}
                  </div>
                  <div className="font-semibold text-slate-900">{invoice.consigneeName || invoice.customerName}</div>
                  <div className="text-slate-600 text-[11px]">{invoice.consigneeAddress}</div>
                  {invoice.consigneeGstin && (
                    <div className="text-slate-800 text-[10.5px]">GSTIN: {invoice.consigneeGstin}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Invoice Dates, Transport & Order Meta */}
          {sectionMap.transport_meta && (
            <div className="flex flex-col">
              <div className={`px-4 sm:px-5 py-2.5 flex items-center justify-between text-white ${accent.bgHeader}`}>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider block">
                    {isPaid ? 'Total Paid' : isPartiallyPaid ? 'Partially Paid' : 'Total Amount Due'}
                  </span>
                  {isPartiallyPaid && (
                    <span className="text-[9.5px] opacity-90 block">
                      Paid: ₹{paidAmt.toFixed(2)} · Due: ₹{dueAmt.toFixed(2)}
                    </span>
                  )}
                </div>
                <span className="text-base font-black font-mono">₹{Number(invoice.total).toFixed(2)}</span>
              </div>

              <div className="p-4 sm:p-5 space-y-1 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Invoice Date:</span>
                  <span className="font-bold font-mono">{fmtDate(invoice.date)}</span>
                </div>
                {invoice.dueDate && (
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Due Date:</span>
                    <span className="font-bold font-mono">{fmtDate(invoice.dueDate)}</span>
                  </div>
                )}
                {invoice.paymentTerms && (
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Payment Terms:</span>
                    <span className="font-bold">{invoice.paymentTerms}</span>
                  </div>
                )}
                {invoice.buyerOrderNo && (
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Buyer Order / PO No:</span>
                    <span className="font-bold">
                      {invoice.buyerOrderNo}{invoice.buyerOrderDate ? ` dt. ${fmtDate(invoice.buyerOrderDate)}` : ''}
                    </span>
                  </div>
                )}

                {/* Transport & Dispatch Details */}
                {cfg.showTransportMeta && (
                  <>
                    {invoice.eWayBillNo && (
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500">E-Way Bill No:</span>
                        <span className="font-mono font-bold">{invoice.eWayBillNo}</span>
                      </div>
                    )}
                    {invoice.vehicleNo && (
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500">Motor Vehicle No:</span>
                        <span className="font-mono font-bold">{invoice.vehicleNo}</span>
                      </div>
                    )}
                    {invoice.dispatchDocNo && (
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500">Despatch Doc No:</span>
                        <span className="font-bold">{invoice.dispatchDocNo}</span>
                      </div>
                    )}
                    {invoice.placeOfSupply && (
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500">Place of Supply:</span>
                        <span className="font-bold">{invoice.placeOfSupply}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ----------------- 3. ITEMS TABLE ----------------- */}
      {sectionMap.items_table && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className={`border-b uppercase font-bold text-[10px] tracking-wider ${accent.bgLight} ${accent.textMain}`}>
                <th className="py-2.5 px-3 w-8">#</th>
                <th className="py-2.5 px-3">{labels.itemColHeader || 'Item Description'}</th>
                {cfg.showItemHsn && <th className="py-2.5 px-3 text-center">{labels.hsnColHeader || 'HSN/SAC'}</th>}
                <th className="py-2.5 px-3 text-right">{labels.qtyColHeader || 'Qty'}</th>
                {cfg.showItemUnit && <th className="py-2.5 px-3 text-left">{labels.unitColHeader || 'Unit'}</th>}
                <th className="py-2.5 px-3 text-right">{labels.rateColHeader || 'Rate (₹)'}</th>
                <th className="py-2.5 px-3 text-right">{labels.taxableColHeader || 'Taxable (₹)'}</th>
                {cfg.showItemTaxBreakup && <th className="py-2.5 px-3 text-right">{labels.taxRateColHeader || 'Tax %'}</th>}
                <th className="py-2.5 px-3 text-right">{labels.amountColHeader || 'Amount (₹)'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(invoice.items || []).map((it, idx) => {
                const qty = Number(it.qty) || 1;
                const price = Number(it.price) || 0;
                const discount = Number(it.discount) || 0;
                const taxRate = Number(it.taxRate) || 0;
                const taxable = Math.max(0, Math.round((qty * price - discount) * 100) / 100);
                const lineTotal = Number(it.total) || Math.round((taxable + (taxable * taxRate) / 100) * 100) / 100;

                return (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      <div>{it.printName || it.name}</div>
                      {it.discount > 0 && (
                        <div className="text-[10px] text-emerald-700 font-normal">
                          (Disc: -₹{discount.toFixed(2)})
                        </div>
                      )}
                    </td>
                    {cfg.showItemHsn && (
                      <td className="py-2.5 px-3 text-center font-mono text-slate-600 text-[11px]">
                        {it.hsn || it.hsnCode || '—'}
                      </td>
                    )}
                    <td className="py-2.5 px-3 text-right font-mono font-bold">{qty}</td>
                    {cfg.showItemUnit && (
                      <td className="py-2.5 px-3 text-left text-slate-500">{it.unit || 'pcs'}</td>
                    )}
                    <td className="py-2.5 px-3 text-right font-mono">{price.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{taxable.toFixed(2)}</td>
                    {cfg.showItemTaxBreakup && (
                      <td className="py-2.5 px-3 text-right font-mono text-[11px]">{taxRate}%</td>
                    )}
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-950">
                      {lineTotal.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ----------------- 4. TOTALS, BANK & WORDS ----------------- */}
      {sectionMap.bank_qr_totals && (
        <div className="p-4 sm:p-6 space-y-4 border-t border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
            {/* Left: Bank details & UPI QR */}
            <div className="space-y-3">
              {cfg.showBankDetails && (company.bankAccountNumber || company.upiId) && (
                <div className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/60 space-y-1.5 text-xs">
                  <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" style={{ color: accent.hex }} />
                    Bank Transfer Details
                  </div>
                  {company.bankAccountHolder && <div>Account: <strong>{company.bankAccountHolder}</strong></div>}
                  {company.bankName && <div>Bank: <strong>{company.bankName}</strong></div>}
                  {company.bankAccountNumber && <div>A/C No: <strong className="font-mono">{company.bankAccountNumber}</strong></div>}
                  {company.bankIfsc && <div>IFSC: <strong className="font-mono">{company.bankIfsc}</strong></div>}
                  {company.bankBranch && <div>Branch: {company.bankBranch}</div>}
                </div>
              )}

              {cfg.showPaymentQr && qrDataUrl && (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/60">
                  <img src={qrDataUrl} alt="UPI Payment QR" className="h-20 w-20 rounded-md border border-slate-300" />
                  <div className="text-[11px]">
                    <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">Instant UPI Payment</div>
                    <div className="text-slate-600 mt-0.5">Scan with GPay, PhonePe, Paytm</div>
                    <div className="text-slate-900 font-mono font-bold mt-0.5">{billing.upiId || company.upiId}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Subtotal, Taxes & Grand Total */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">{labels.subtotalLabel || 'Total Taxable Amount:'}</span>
                <span className="font-mono font-semibold">₹{totalTaxableValue.toFixed(2)}</span>
              </div>

              {invoice.discount > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-100 text-emerald-700 font-semibold">
                  <span>{labels.discountLabel || 'Special Discount:'}</span>
                  <span className="font-mono">-₹{Number(invoice.discount).toFixed(2)}</span>
                </div>
              )}

              {totalTaxAmt > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">{labels.taxLabel || 'Total GST:'}</span>
                  <span className="font-mono font-semibold">₹{totalTaxAmt.toFixed(2)}</span>
                </div>
              )}

              {invoice.roundOff !== undefined && invoice.roundOff !== 0 && (
                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-500">
                  <span>Round Off:</span>
                  <span className="font-mono">{invoice.roundOff > 0 ? `+₹${invoice.roundOff.toFixed(2)}` : `-₹${Math.abs(invoice.roundOff).toFixed(2)}`}</span>
                </div>
              )}

              <div className={`flex justify-between py-2.5 border-t-2 border-b-2 font-black text-sm ${accent.border} ${accent.textMain}`}>
                <span>{labels.totalLabel || 'TOTAL INVOICE VALUE:'}</span>
                <span className="text-base font-mono">₹{Number(invoice.total).toFixed(2)}</span>
              </div>

              {(paidAmt > 0 || dueAmt > 0) && (
                <div className="space-y-1 pt-1 font-mono text-xs">
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Amount Paid:</span>
                    <span>₹{paidAmt.toFixed(2)}</span>
                  </div>
                  {dueAmt > 0 && (
                    <div className="flex justify-between text-rose-700 font-bold">
                      <span>Balance Due:</span>
                      <span>₹{dueAmt.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {cfg.showInvoiceWordsTotal && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    {labels.wordsLabel || 'Amount in Words (Rupees):'}
                  </span>
                  <div className="text-[11.5px] font-bold text-slate-900 italic mt-0.5">
                    {numberToWords(invoice.total)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ----------------- 5. HSN SUMMARY TABLE ----------------- */}
      {sectionMap.hsn_summary && cfg.showHsnSummaryTable && Object.keys(hsnSummary).length > 0 && (
        <div className="p-4 sm:p-6 pt-0 border-t border-slate-200">
          <div className="font-bold text-[10.5px] uppercase tracking-wider text-slate-700 mb-1.5 pt-3">
            GST Tax & HSN/SAC Summary
          </div>
          <table className="w-full text-xs border border-slate-200 border-collapse">
            <thead>
              <tr className={`text-[10px] uppercase font-bold border-b border-slate-200 ${accent.bgLight} ${accent.textMain}`}>
                <th className="py-1.5 px-2.5 border-r border-slate-200">HSN/SAC</th>
                <th className="py-1.5 px-2.5 border-r border-slate-200 text-right">Taxable (₹)</th>
                {billing.interState ? (
                  <>
                    <th className="py-1.5 px-2.5 border-r border-slate-200 text-right">IGST Rate</th>
                    <th className="py-1.5 px-2.5 border-r border-slate-200 text-right">IGST Amt (₹)</th>
                  </>
                ) : (
                  <>
                    <th className="py-1.5 px-2.5 border-r border-slate-200 text-right">CGST Amt (₹)</th>
                    <th className="py-1.5 px-2.5 border-r border-slate-200 text-right">SGST Amt (₹)</th>
                  </>
                )}
                <th className="py-1.5 px-2.5 text-right">Total Tax (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {Object.entries(hsnSummary).map(([hsn, v]) => (
                <tr key={hsn}>
                  <td className="py-1.5 px-2.5 border-r border-slate-100 font-bold">{hsn}</td>
                  <td className="py-1.5 px-2.5 border-r border-slate-100 text-right">{v.taxable.toFixed(2)}</td>
                  {billing.interState ? (
                    <>
                      <td className="py-1.5 px-2.5 border-r border-slate-100 text-right">{v.rate}%</td>
                      <td className="py-1.5 px-2.5 border-r border-slate-100 text-right">{v.igst.toFixed(2)}</td>
                    </>
                  ) : (
                    <>
                      <td className="py-1.5 px-2.5 border-r border-slate-100 text-right">{v.cgst.toFixed(2)}</td>
                      <td className="py-1.5 px-2.5 border-r border-slate-100 text-right">{v.sgst.toFixed(2)}</td>
                    </>
                  )}
                  <td className="py-1.5 px-2.5 text-right font-bold">{v.tax.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ----------------- 6. FOOTER, TERMS & SIGNATURE ----------------- */}
      {sectionMap.terms_signature && (
        <div className="p-4 sm:p-6 pt-3 border-t border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row items-end justify-between gap-6">
            <div className="text-slate-600 text-xs max-w-md space-y-1">
              {cfg.showInvoiceTerms && (
                <div>
                  <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                    {labels.termsTitle || 'Terms & Conditions'}
                  </div>
                  <div className="whitespace-pre-line text-[11px] text-slate-600 mt-0.5">
                    {cfg.termsText || billing.termsText || billing.terms || '1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged for delayed payments.\n3. Subject to local jurisdiction only.'}
                  </div>
                </div>
              )}
              {billing.footerText && (
                <div className="italic text-slate-500 text-[10.5px] mt-1">
                  {billing.footerText}
                </div>
              )}
            </div>

            {cfg.showInvoiceSignature && (
              <div className="text-center sm:text-right space-y-1 shrink-0">
                <div className="text-[11px] font-bold text-slate-800">
                  For {company.name}
                </div>
                <div className="h-10" />
                <div className="border-t border-slate-400 pt-1 font-bold text-slate-900 text-[11px]">
                  {labels.signatoryTitle || 'Authorised Signatory'}
                </div>
              </div>
            )}
          </div>

          <div className="text-center text-[9.5px] text-slate-400 pt-2 border-t border-slate-100">
            {labels.computerGeneratedNote || 'This is a Computer Generated Tax Invoice'}
          </div>
        </div>
      )}
    </div>
  );
}
