import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { renderCustomDocumentHtml } from '../lib/exporters';

export const DEFAULT_THERMAL_SECTIONS = [
  { id: 'header_branding', name: 'Store Header & Branding', enabled: true },
  { id: 'store_meta', name: 'Store Tax IDs & Contact Info', enabled: true },
  { id: 'custom_banner', name: 'Custom Notice / Announcement Banner', enabled: true },
  { id: 'bill_meta', name: 'Bill Number, Date, Time & Cashier', enabled: true },
  { id: 'customer_info', name: 'Customer Name, Phone & Loyalty Info', enabled: true },
  { id: 'items_table', name: 'Itemized Products & Services Table', enabled: true },
  { id: 'totals_summary', name: 'Subtotal, Taxes, Round-off & Grand Total', enabled: true },
  { id: 'gst_slabs', name: 'Statutory GST Slab Breakdown Matrix', enabled: true },
  { id: 'savings_badge', name: 'Customer Savings & Discount Callout', enabled: true },
  { id: 'payments_breakup', name: 'Payment Breakdown & Advance Credit', enabled: true },
  { id: 'qr_payment', name: 'Instant UPI QR Code & Payee Details', enabled: true },
  { id: 'barcode', name: 'Order Tracking Barcode', enabled: true },
  { id: 'terms_footer', name: 'Terms & Conditions, Greeting & Signatory', enabled: true }
];

export const THERMAL_THEMES = [
  {
    id: 'detailed_gst',
    name: 'Detailed GST Bill',
    badge: 'GST Compliant',
    tagline: 'Complete tax invoice with GSTIN, HSN, item tax rates, slab summary, and FSSAI.',
    description: 'Perfect for retail stores, supermarkets, and B2C/B2B businesses requiring full statutory compliance on bill rolls.',
    defaults: {
      showGstin: true,
      showFssai: true,
      showStoreAddress: true,
      showStorePhone: true,
      showStoreEmail: true,
      showCustomerDetails: true,
      showCustomerGstin: true,
      showCashier: true,
      showHsn: true,
      showItemTaxRate: true,
      showItemDiscount: true,
      showGstBreakup: true,
      showSavings: true,
      showPaymentBreakup: true,
      showLoyaltySummary: true,
      showAdvanceSummary: true,
      showQrCode: true,
      qrCodeType: 'upi',
      showBarcode: true,
      showTerms: true,
      showFooterNote: true,
      showSignature: false,
      dividerStyle: 'dashed',
      fontSize: 'md',
      paperWidth: '80mm',
      sections: DEFAULT_THERMAL_SECTIONS,
      customLabels: {
        receiptTitle: 'RETAIL TAX INVOICE',
        itemHeader: 'Item Description',
        hsnHeader: 'HSN',
        qtyHeader: 'Qty',
        rateHeader: 'Rate',
        discountHeader: 'Disc',
        taxHeader: 'Tax%',
        totalHeader: 'Amount',
        subtotalLabel: 'Subtotal',
        taxLabel: 'Total GST',
        totalLabel: 'GRAND TOTAL',
        paidLabel: 'Amount Paid',
        changeLabel: 'Change Due',
        savingsLabel: '🎉 YOU SAVED',
        termsTitle: 'Terms & Conditions',
        signatoryLabel: 'Authorized Signatory',
        greetingText: 'Thank you for shopping with us! Visit again.'
      }
    }
  },
  {
    id: 'standard',
    name: 'Standard Retail Bill',
    badge: 'Classic',
    tagline: 'Clean, balanced POS bill for fast daily cash-counter billing.',
    description: 'Classic format with store contact, bill meta, itemized pricing, subtotal, discount, totals, and payment info.',
    defaults: {
      showGstin: true,
      showFssai: false,
      showStoreAddress: true,
      showStorePhone: true,
      showStoreEmail: false,
      showCustomerDetails: true,
      showCustomerGstin: false,
      showCashier: true,
      showHsn: false,
      showItemTaxRate: false,
      showItemDiscount: true,
      showGstBreakup: true,
      showSavings: true,
      showPaymentBreakup: true,
      showLoyaltySummary: true,
      showAdvanceSummary: false,
      showQrCode: false,
      qrCodeType: 'upi',
      showBarcode: true,
      showTerms: true,
      showFooterNote: true,
      showSignature: false,
      dividerStyle: 'dashed',
      fontSize: 'md',
      paperWidth: '80mm',
      sections: DEFAULT_THERMAL_SECTIONS,
      customLabels: {
        receiptTitle: 'RETAIL RECEIPT',
        itemHeader: 'Item',
        hsnHeader: 'HSN',
        qtyHeader: 'Qty',
        rateHeader: 'Price',
        discountHeader: 'Disc',
        taxHeader: 'Tax',
        totalHeader: 'Total',
        subtotalLabel: 'Subtotal',
        taxLabel: 'Taxes',
        totalLabel: 'NET TOTAL',
        paidLabel: 'Paid',
        changeLabel: 'Change',
        savingsLabel: 'Total Savings',
        termsTitle: 'Return Policy',
        signatoryLabel: 'Cashier Signature',
        greetingText: 'Thank you for visiting!'
      }
    }
  },
  {
    id: 'normal_thermal',
    name: 'Normal Bill',
    badge: 'No GST Breakdown',
    tagline: 'A regular, readable thermal bill without the statutory GST slab matrix.',
    description: 'Same store details, items and totals as a normal receipt — just without the CGST/SGST/IGST slab-wise breakdown table.',
    defaults: {
      showGstin: true,
      showFssai: false,
      showStoreAddress: true,
      showStorePhone: true,
      showStoreEmail: false,
      showCustomerDetails: true,
      showCustomerGstin: false,
      showCashier: true,
      showHsn: false,
      showItemTaxRate: false,
      showItemDiscount: true,
      showGstBreakup: false,
      showSavings: true,
      showPaymentBreakup: true,
      showLoyaltySummary: true,
      showAdvanceSummary: false,
      showQrCode: false,
      qrCodeType: 'upi',
      showBarcode: true,
      showTerms: true,
      showFooterNote: true,
      showSignature: false,
      dividerStyle: 'dashed',
      fontSize: 'md',
      paperWidth: '80mm',
      sections: DEFAULT_THERMAL_SECTIONS,
      customLabels: {
        receiptTitle: 'CASH RECEIPT',
        itemHeader: 'Item',
        hsnHeader: 'HSN',
        qtyHeader: 'Qty',
        rateHeader: 'Price',
        discountHeader: 'Disc',
        taxHeader: 'Tax',
        totalHeader: 'Total',
        subtotalLabel: 'Subtotal',
        taxLabel: 'Tax',
        totalLabel: 'TOTAL',
        paidLabel: 'Paid',
        changeLabel: 'Change',
        savingsLabel: 'Total Savings',
        termsTitle: 'Return Policy',
        signatoryLabel: 'Cashier Signature',
        greetingText: 'Thank you for visiting!'
      }
    }
  },
  {
    id: 'minimal',
    name: 'Minimal / Compact Bill',
    badge: 'Fast Print',
    tagline: 'Space-saving, fast-printing compact bill for 58mm / 80mm rolls.',
    description: 'Stripped of non-essential tables for rapid queue-busting counters and small 2-inch roll printers.',
    defaults: {
      showGstin: false,
      showFssai: false,
      showStoreAddress: false,
      showStorePhone: true,
      showStoreEmail: false,
      showCustomerDetails: false,
      showCustomerGstin: false,
      showCashier: false,
      showHsn: false,
      showItemTaxRate: false,
      showItemDiscount: false,
      showGstBreakup: false,
      showSavings: false,
      showPaymentBreakup: false,
      showLoyaltySummary: false,
      showAdvanceSummary: false,
      showQrCode: false,
      qrCodeType: 'upi',
      showBarcode: false,
      showTerms: false,
      showFooterNote: true,
      showSignature: false,
      dividerStyle: 'dotted',
      fontSize: 'sm',
      paperWidth: '58mm',
      sections: DEFAULT_THERMAL_SECTIONS,
      customLabels: {
        receiptTitle: 'CASH RECEIPT',
        itemHeader: 'Item',
        hsnHeader: 'HSN',
        qtyHeader: 'Q',
        rateHeader: 'Rate',
        discountHeader: 'D',
        taxHeader: 'T%',
        totalHeader: 'Amt',
        subtotalLabel: 'Sub',
        taxLabel: 'Tax',
        totalLabel: 'TOTAL',
        paidLabel: 'Paid',
        changeLabel: 'Bal',
        savingsLabel: 'Saved',
        termsTitle: 'Terms',
        signatoryLabel: 'Sign',
        greetingText: 'Visit Again!'
      }
    }
  },
  {
    id: 'modern',
    name: 'Modern Supermarket Bill',
    badge: 'Supermarket',
    tagline: 'Modern layout with customer savings badges, item discount details, and QR payment.',
    description: 'Ideal for grocery stores, apparel outlets, and supermarkets focused on customer savings and instant UPI scan.',
    defaults: {
      showGstin: true,
      showFssai: true,
      showStoreAddress: true,
      showStorePhone: true,
      showStoreEmail: false,
      showCustomerDetails: true,
      showCustomerGstin: true,
      showCashier: true,
      showHsn: true,
      showItemTaxRate: true,
      showItemDiscount: true,
      showGstBreakup: true,
      showSavings: true,
      showPaymentBreakup: true,
      showLoyaltySummary: true,
      showAdvanceSummary: true,
      showQrCode: true,
      qrCodeType: 'upi',
      showBarcode: true,
      showTerms: true,
      showFooterNote: true,
      showSignature: false,
      dividerStyle: 'double',
      fontSize: 'md',
      paperWidth: '80mm',
      sections: DEFAULT_THERMAL_SECTIONS,
      customLabels: {
        receiptTitle: 'SUPERMARKET TAX INVOICE',
        itemHeader: 'Particulars',
        hsnHeader: 'HSN',
        qtyHeader: 'Qty',
        rateHeader: 'MRP',
        discountHeader: 'Offer',
        taxHeader: 'GST%',
        totalHeader: 'Net',
        subtotalLabel: 'Gross Value',
        taxLabel: 'GST Total',
        totalLabel: 'FINAL BILL VALUE',
        paidLabel: 'Tendered',
        changeLabel: 'Refund / Change',
        savingsLabel: '🌟 YOU SAVED TODAY',
        termsTitle: 'Customer Care & Returns',
        signatoryLabel: 'Manager Signature',
        greetingText: 'Thank you for choosing us today! Happy Shopping!'
      }
    }
  },
  {
    id: 'restaurant',
    name: 'Restaurant / Dine-In Bill',
    badge: 'F&B / Cafe',
    tagline: 'Food & beverage bill with Table No, Token No, Captain, Steward, and Service details.',
    description: 'Specialized for cafes, QSR counters, bakeries, and dine-in restaurants.',
    defaults: {
      showGstin: true,
      showFssai: true,
      showStoreAddress: true,
      showStorePhone: true,
      showStoreEmail: false,
      showCustomerDetails: true,
      showCustomerGstin: false,
      showCashier: true,
      showHsn: false,
      showItemTaxRate: true,
      showItemDiscount: true,
      showGstBreakup: true,
      showSavings: true,
      showPaymentBreakup: true,
      showLoyaltySummary: true,
      showAdvanceSummary: false,
      showQrCode: true,
      qrCodeType: 'upi',
      showBarcode: false,
      showTerms: true,
      showFooterNote: true,
      showSignature: false,
      dividerStyle: 'solid',
      fontSize: 'md',
      paperWidth: '80mm',
      sections: DEFAULT_THERMAL_SECTIONS,
      customLabels: {
        receiptTitle: 'RESTAURANT GUEST CHECK',
        itemHeader: 'Menu Item',
        hsnHeader: 'SAC',
        qtyHeader: 'Qty',
        rateHeader: 'Price',
        discountHeader: 'Disc',
        taxHeader: 'GST%',
        totalHeader: 'Amount',
        subtotalLabel: 'Food & Beverage Subtotal',
        taxLabel: 'GST (2.5% CGST + 2.5% SGST)',
        totalLabel: 'TOTAL PAYABLE',
        paidLabel: 'Settled Amount',
        changeLabel: 'Tip / Change',
        savingsLabel: 'Chef Special Discount',
        termsTitle: 'Feedback & Service',
        signatoryLabel: 'Steward Signature',
        greetingText: 'Hope you enjoyed your meal! Visit us again soon!'
      }
    }
  }
];

// Billing only ever offers these two thermal options — a detailed GST bill
// and a plain one — rather than the full built-in gallery plus an
// open-ended custom-template list. That's what made theme selection at the
// counter feel broken: an unbounded, ever-growing set of near-identical
// choices whose config could silently leak into each other. Both remain
// fully editable in place (branding, labels, sections) via the template
// editor — editing overwrites that same slot rather than creating a new one.
export const BILLING_THERMAL_THEME_IDS = ['detailed_gst', 'normal_thermal'];

export const SAMPLE_RECEIPT_DATA = {
  orderId: 'BILL-2026-8941',
  date: new Date().toISOString(),
  cashier: 'Ramesh Patel',
  counter: 'POS-01 (Express)',
  tableNo: 'Table 14',
  tokenNo: 'TK-42',
  customerName: 'Ananya Sharma',
  customerPhone: '+91 98765 43210',
  customerGstin: '29ABCDE1234F1Z5',
  customerLoyaltyPoints: 120,
  loyaltyPointsEarned: 15,
  subtotal: 1250.00,
  discount: 100.00,
  tax: 150.00,
  roundOff: 0.00,
  total: 1300.00,
  paidAmount: 1300.00,
  changeAmount: 0.00,
  paymentMethod: 'UPI / GPay',
  loyaltyRedeemed: 0,
  pointsRedeemed: 0,
  advanceRedeemed: 0,
  advanceBalance: 500.00,
  items: [
    {
      name: 'Organic Whole Wheat Bread 400g',
      printName: 'Whole Wheat Bread 400g',
      hsn: '1905',
      qty: 2,
      price: 55.00,
      discount: 10.00,
      taxRate: 5,
      total: 100.00
    },
    {
      name: 'Farm Fresh Pure Butter 500g',
      printName: 'Pure Butter 500g',
      hsn: '0405',
      qty: 1,
      price: 275.00,
      discount: 25.00,
      taxRate: 12,
      total: 250.00
    },
    {
      name: 'Artisan Dark Chocolate Cookies',
      printName: 'Dark Choco Cookies',
      hsn: '1905',
      qty: 3,
      price: 160.00,
      discount: 30.00,
      taxRate: 18,
      total: 450.00
    },
    {
      name: 'Cold Pressed Almond Milk 1L',
      printName: 'Almond Milk 1L',
      hsn: '2202',
      qty: 2,
      price: 240.00,
      discount: 30.00,
      taxRate: 12,
      total: 450.00
    }
  ]
};

/** Convert number to words in INR format */
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
    if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + inWords(n % 1000);
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + inWords(n % 100000);
    return inWords(Math.floor(n / 10000000)) + 'Crore ' + inWords(n % 10000000);
  }

  return (inWords(num).trim() + ' Rupees Only');
}

/** Format Date and Time */
function fmtReceiptDate(d) {
  if (!d) return '';
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }) + ' ' + dt.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return String(d);
  }
}

/**
 * Main Thermal Receipt Renderer supporting themes, custom labels, block reordering, and custom CSS
 */
export function ThermalReceiptView({
  receipt = SAMPLE_RECEIPT_DATA,
  settings = {},
  tenant = {},
  customConfig = null,
  activeTheme = null
}) {
  const company = receipt.company || settings?.company || {
    name: tenant?.name || 'Selsolve Supermarket & Store',
    address: '123 MG Road, Central Plaza, Suite 400',
    city: 'Bengaluru',
    state: 'Karnataka',
    pin: '560001',
    phone: '+91 98450 11223',
    email: 'billing@selsolvestore.com',
    gstin: '29ABCDE1234F1Z5',
    fssai: '11223344556677'
  };

  const billing = settings?.billing || {};
  const currentThemeId = activeTheme || customConfig?.activeThermalTemplate || billing.activeThermalTemplate || 'detailed_gst';
  const customTemplates = (billing.customTemplates || []).filter((t) => t.type === 'thermal');
  const selectedCustom = customTemplates.find((t) => t.id === currentThemeId);
  const baseThemeId = selectedCustom ? selectedCustom.baseTheme : currentThemeId;
  const themeMeta = THERMAL_THEMES.find((t) => t.id === baseThemeId) || THERMAL_THEMES[0];
  const customTemplateConfig = selectedCustom ? (selectedCustom.config || {}) : {};

  // `billing.customHtml` is a stray leftover the template editor's "save"
  // action can write to the general settings object even while editing a
  // built-in theme — it must never override a built-in theme's own JSX
  // rendering. Only a genuinely selected custom template (customTemplateConfig)
  // or an explicit live-preview override (customConfig, from the editor
  // itself) may supply customHtml.
  // Deliberately NOT spreading `billing` into this merge. Template appearance
  // (which sections show, labels, fonts, paper width...) is per-theme data —
  // it belongs only in `customTemplateConfig` (this theme's own saved
  // override, looked up by its own id) or `customConfig` (an explicit
  // live-preview override from the editor). Spreading the whole `billing`
  // settings object here used to mean whichever theme was *last saved*
  // bled its exact settings into every other theme's rendering too, since
  // billing is one global object shared by all of them — that's what made
  // switching themes at the counter look like it did nothing.
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

  // QR Code Generation
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    if (!cfg.showQrCode) {
      setQrDataUrl('');
      return;
    }

    let qrPayload = '';
    const upiId = billing.upiId || company.upiId || 'selsolve@okbank';
    const payeeName = encodeURIComponent(company.name || 'Store');
    const orderTotal = Number(receipt.total || 0).toFixed(2);
    const orderRef = receipt.orderId || 'BILL';

    if (cfg.qrCodeType === 'invoice') {
      qrPayload = `INVOICE:${orderRef}|TOTAL:${orderTotal}|GSTIN:${company.gstin || 'N/A'}|DATE:${receipt.date || ''}`;
    } else {
      qrPayload = `upi://pay?pa=${upiId}&pn=${payeeName}&am=${orderTotal}&cu=INR&tn=Invoice%20${orderRef}`;
    }

    QRCode.toDataURL(qrPayload, {
      width: 140,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [cfg.showQrCode, cfg.qrCodeType, receipt.total, receipt.orderId, receipt.date, billing.upiId, company.upiId, company.name, company.gstin]);

  const is58mm = cfg.paperWidth === '58mm';
  const widthClass = is58mm ? 'w-full max-w-[62mm] min-w-[52mm]' : 'w-full max-w-[84mm] min-w-[76mm]';

  const fontScale = {
    sm: 'text-[10px] leading-tight',
    md: 'text-[11.5px] leading-normal',
    lg: 'text-[13px] leading-relaxed'
  }[cfg.fontSize || 'md'] || 'text-[11.5px]';

  const getDivider = () => {
    const style = cfg.dividerStyle || 'dashed';
    const count = is58mm ? 28 : 38;
    switch (style) {
      case 'dotted':
        return '. '.repeat(Math.floor(count / 2));
      case 'solid':
        return '━'.repeat(count);
      case 'double':
        return '═'.repeat(count);
      case 'stars':
        return '* '.repeat(Math.floor(count / 2));
      case 'equals':
        return '='.repeat(count);
      case 'dashed':
      default:
        return '-'.repeat(count);
    }
  };

  const divider = getDivider();

  // Compute GST slabs
  const gstSlabs = {};
  // Starts from the bill-level discount (shown separately below as "Bill
  // Discount") so the savings badge reflects everything the customer actually
  // saved, not just per-item discounts.
  let totalSavings = Number(receipt.discount) || 0;

  (receipt.items || []).forEach((item) => {
    const qty = Number(item.qty) || 1;
    const price = Number(item.price) || 0;
    const discount = Number(item.discount) || 0;
    const taxRate = Number(item.taxRate) || 0;
    const taxable = Math.max(0, Math.round((qty * price - discount) * 100) / 100);
    const tax = Math.round(((taxable * taxRate) / 100) * 100) / 100;

    totalSavings += discount;

    if (!gstSlabs[taxRate]) {
      gstSlabs[taxRate] = { taxable: 0, tax: 0, cgst: 0, sgst: 0, igst: 0 };
    }
    gstSlabs[taxRate].taxable += taxable;
    gstSlabs[taxRate].tax += tax;

    if (billing.interState) {
      gstSlabs[taxRate].igst += tax;
    } else {
      gstSlabs[taxRate].cgst += tax / 2;
      gstSlabs[taxRate].sgst += tax / 2;
    }
  });

  // Render individual sections based on section ordering. A saved custom
  // template's `sections` array can end up missing an entry entirely (rather
  // than explicitly disabled) — e.g. from an older save before a section was
  // introduced. Treat "missing" as "shown" (the same as a brand-new theme),
  // and only actually hide a section the saved config explicitly disabled.
  const sections = cfg.sections || DEFAULT_THERMAL_SECTIONS;
  const sectionMap = {};
  DEFAULT_THERMAL_SECTIONS.forEach((s) => { sectionMap[s.id] = true; });
  sections.forEach((s) => { sectionMap[s.id] = s.enabled !== false; });

  // Resolve the actual render order from the user-configured `sections` array
  // (this used to be computed and then ignored — every section rendered in a
  // fixed hardcoded order regardless of what was saved here). Any id missing
  // from an older/incomplete saved config is appended in its default position
  // so nothing silently disappears from render.
  const orderedSectionIds = [
    ...sections.map((s) => s.id),
    ...DEFAULT_THERMAL_SECTIONS.map((s) => s.id).filter((id) => !sections.some((s2) => s2.id === id))
  ];
  // bill_meta always renders its divider + receipt title even when the
  // "Bill Number, Date, Time & Cashier" toggle is off — only the bill-info
  // block inside billMetaNode itself is gated by sectionMap.bill_meta.
  const enabledOrder = orderedSectionIds.filter((id) => sectionMap[id] || id === 'bill_meta');

  // If template has exact custom HTML markup (e.g. from Word or custom HTML import), render it directly!
  if (cfg.customHtml && cfg.customHtml.trim()) {
    return (
      <div
        id="printable-thermal-receipt"
        className={`bg-white text-black font-mono p-3 sm:p-4 mx-auto rounded-xl border border-dashed border-slate-300 shadow-md print:border-none print:shadow-none print:p-0 print:m-0 w-full overflow-hidden box-border ${widthClass} ${fontScale}`}
        style={{ boxSizing: 'border-box' }}
      >
        {cfg.customCss && <style dangerouslySetInnerHTML={{ __html: cfg.customCss }} />}
        <div
          className="custom-document-template-root w-full overflow-hidden bg-white"
          dangerouslySetInnerHTML={{
            __html: renderCustomDocumentHtml(cfg.customHtml, { receipt, company, billing, cfg })
          }}
        />
      </div>
    );
  }

  // Per-section content, built once and slotted into `enabledOrder` below so
  // the visual order actually matches the user's configured section order.
  // The dashed dividers (and the fixed "Receipt Title" line) aren't
  // reorderable sections of their own — they travel with the section they
  // visually separate, so they move along with it if it's reordered.
  const headerBrandingNode = (
    <div className="text-center space-y-0.5 mb-1.5">
      {cfg.showLogo && company.logoUrl && (
        <div className="flex justify-center mb-1">
          <img src={company.logoUrl} alt="Logo" className="h-10 w-10 object-contain" />
        </div>
      )}
      <div className="font-black text-sm uppercase tracking-tight">{company.name}</div>
      {cfg.showStoreAddress && company.address && (
        <div className="text-[10px] leading-tight">{company.address}</div>
      )}
      {cfg.showStoreAddress && (company.city || company.state || company.pin) && (
        <div className="text-[10px] leading-tight">
          {[company.city, company.state, company.pin].filter(Boolean).join(', ')}
        </div>
      )}
    </div>
  );

  const storeMetaNode = (
    <div className="text-center text-[10.5px] space-y-0.5 mb-1">
      {cfg.showStorePhone && company.phone && <div>Tel: {company.phone}</div>}
      {cfg.showStoreEmail && company.email && <div>Email: {company.email}</div>}
      {cfg.showGstin && company.gstin && (
        <div className="font-bold">GSTIN: {company.gstin}</div>
      )}
      {cfg.showFssai && (company.fssai || company.fssaiNo) && (
        <div className="font-medium text-[10px]">FSSAI Lic No: {company.fssai || company.fssaiNo}</div>
      )}
    </div>
  );

  const customBannerNode = cfg.customBannerText ? (
    <div className="my-1.5 p-1 text-center font-bold text-[10.5px] border border-black border-dashed bg-slate-50">
      {cfg.customBannerText}
    </div>
  ) : null;

  const billMetaNode = (
    <>
      <div className="overflow-hidden whitespace-nowrap text-center opacity-70 my-1 w-full">{divider}</div>
      <div className="text-center font-bold text-[11px] uppercase tracking-wider my-0.5">
        {labels.receiptTitle || billing.invoiceTitle || 'TAX INVOICE'}
      </div>
      {sectionMap.bill_meta && (
        <div className="space-y-0.5 text-[10.5px]">
          <div className="flex justify-between">
            <span>Bill No: <strong className="font-bold">{receipt.orderId}</strong></span>
            <span>{fmtReceiptDate(receipt.date)}</span>
          </div>

          {(receipt.tokenNo || receipt.tableNo) && (
            <div className="flex justify-between font-bold">
              {receipt.tokenNo && <span>Token #: {receipt.tokenNo}</span>}
              {receipt.tableNo && <span>Table: {receipt.tableNo}</span>}
            </div>
          )}
        </div>
      )}
    </>
  );

  const customerInfoNode = (cfg.showCustomerDetails && (receipt.customerName || receipt.customerPhone)) ? (
    <div className="mt-1 pt-1 border-t border-dotted border-slate-400 text-[10px] space-y-0.5">
      <div className="flex justify-between">
        <span>Customer: <strong>{receipt.customerName || 'Walk-in'}</strong></span>
        {receipt.customerPhone && <span>{receipt.customerPhone}</span>}
      </div>
      {cfg.showCustomerGstin && receipt.customerGstin && (
        <div className="font-bold">Cust GSTIN: {receipt.customerGstin}</div>
      )}
      {cfg.showLoyaltySummary && receipt.customerLoyaltyPoints !== undefined && (
        <div className="flex justify-between text-slate-700">
          <span>Points Balance: {receipt.customerLoyaltyPoints} pts</span>
          {receipt.loyaltyPointsEarned > 0 && <span>+Earned: {receipt.loyaltyPointsEarned} pts</span>}
        </div>
      )}
    </div>
  ) : null;

  const itemsTableNode = (
    <>
      <div className="overflow-hidden whitespace-nowrap text-center opacity-70 my-1 w-full">{divider}</div>
      <div className="w-full overflow-hidden">
        <table className="w-full table-fixed text-left border-collapse text-[10.5px]">
          <thead>
            <tr className="border-b border-black font-bold pb-0.5">
              <th className="text-left py-0.5 truncate">{labels.itemHeader || 'Item'}</th>
              {cfg.showHsn && <th className="text-center w-[16%] py-0.5 truncate">{labels.hsnHeader || 'HSN'}</th>}
              <th className="text-right w-[12%] py-0.5">{labels.qtyHeader || 'Qty'}</th>
              <th className="text-right w-[18%] py-0.5">{labels.rateHeader || 'Rate'}</th>
              {cfg.showItemTaxRate && <th className="text-right w-[14%] py-0.5">{labels.taxHeader || 'Tax%'}</th>}
              <th className="text-right w-[20%] py-0.5">{labels.totalHeader || 'Amount'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dotted divide-slate-300">
            {(receipt.items || []).map((it, idx) => {
              const qty = Number(it.qty) || 1;
              const price = Number(it.price) || 0;
              const discount = Number(it.discount) || 0;
              const taxRate = Number(it.taxRate) || 0;
              const taxable = Math.max(0, Math.round((qty * price - discount) * 100) / 100);
              const lineTotal = Number(it.total) || Math.round((taxable + (taxable * taxRate) / 100) * 100) / 100;

              return (
                <tr key={idx} className="py-0.5">
                  <td className="py-0.5 text-left font-medium truncate pr-1">
                    <div className="truncate font-bold">{it.printName || it.name}</div>
                    {cfg.showItemDiscount && discount > 0 && (
                      <div className="text-[9px] text-slate-600 font-normal truncate">
                        (Disc: -₹{discount.toFixed(2)})
                      </div>
                    )}
                  </td>
                  {cfg.showHsn && (
                    <td className="py-0.5 text-center text-[9px] opacity-80 truncate">
                      {it.hsn || it.hsnCode || '—'}
                    </td>
                  )}
                  <td className="py-0.5 text-right font-bold">{qty}</td>
                  <td className="py-0.5 text-right">{price.toFixed(2)}</td>
                  {cfg.showItemTaxRate && (
                    <td className="py-0.5 text-right text-[9px]">{taxRate}%</td>
                  )}
                  <td className="py-0.5 text-right font-bold">{lineTotal.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="overflow-hidden whitespace-nowrap text-center opacity-70 my-1 w-full">{divider}</div>
    </>
  );

  const totalsSummaryNode = (
    <div className="space-y-0.5 text-[11px]">
      <div className="flex justify-between">
        <span>{labels.subtotalLabel || 'Subtotal'}:</span>
        <span className="font-bold">₹{Number(receipt.subtotal ?? receipt.total).toFixed(2)}</span>
      </div>

      {receipt.discount > 0 && (
        <div className="flex justify-between">
          <span>Bill Discount:</span>
          <span>-₹{Number(receipt.discount).toFixed(2)}</span>
        </div>
      )}

      {receipt.tax > 0 && (
        <div className="flex justify-between">
          <span>{labels.taxLabel || 'Total GST'}:</span>
          <span>₹{Number(receipt.tax).toFixed(2)}</span>
        </div>
      )}

      {receipt.roundOff !== undefined && receipt.roundOff !== 0 && (
        <div className="flex justify-between text-[10px]">
          <span>Round Off:</span>
          <span>{receipt.roundOff > 0 ? `+₹${receipt.roundOff.toFixed(2)}` : `-₹${Math.abs(receipt.roundOff).toFixed(2)}`}</span>
        </div>
      )}

      {/* Grand Total */}
      <div className="flex justify-between font-black text-sm pt-1 border-t border-b border-black my-1">
        <span>{labels.totalLabel || 'NET TOTAL'}:</span>
        <span>₹{Number(receipt.total).toFixed(2)}</span>
      </div>

      {cfg.showWordsTotal && (
        <div className="text-[9.5px] italic text-center py-0.5">
          {numberToWords(receipt.total)}
        </div>
      )}
    </div>
  );

  const gstSlabsNode = (cfg.showGstBreakup && Object.keys(gstSlabs).length > 0) ? (
    <div className="mt-1 pt-1 border-t border-dotted border-slate-400 text-[9.5px]">
      <div className="font-bold uppercase text-[9px] mb-0.5">GST Slab Breakdown:</div>
      <table className="w-full text-right border-collapse">
        <thead>
          <tr className="border-b border-slate-400 font-bold">
            <th className="text-left">Rate</th>
            <th>Taxable</th>
            {billing.interState ? <th>IGST</th> : <><th>CGST</th><th>SGST</th></>}
            <th>Tax</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(gstSlabs).map(([rate, v]) => (
            <tr key={rate}>
              <td className="text-left">{rate}%</td>
              <td>{v.taxable.toFixed(2)}</td>
              {billing.interState ? (
                <td>{v.igst.toFixed(2)}</td>
              ) : (
                <>
                  <td>{v.cgst.toFixed(2)}</td>
                  <td>{v.sgst.toFixed(2)}</td>
                </>
              )}
              <td className="font-bold">{v.tax.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : null;

  const savingsBadgeNode = (cfg.showSavings && totalSavings > 0) ? (
    <div className="my-1.5 p-1 text-center font-bold text-[10.5px] border border-black bg-slate-50">
      {labels.savingsLabel || '🎉 YOU SAVED'}: ₹{totalSavings.toFixed(2)}!
    </div>
  ) : null;

  const paymentsBreakupNode = (cfg.showPaymentBreakup || cfg.showAdvanceSummary) ? (
    <div className="mt-1 pt-1 border-t border-dotted border-slate-400 text-[10px] space-y-0.5">
      {cfg.showPaymentBreakup && Array.isArray(receipt.splitPayments) && receipt.splitPayments.length > 0 ? (
        <>
          {receipt.splitPayments.map((p, i) => (
            <div key={i} className="flex justify-between">
              <span>{p.method}{p.ref ? ` (${p.ref})` : ''}:</span>
              <span>₹{Number(p.amount || 0).toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold border-t border-dotted border-slate-400 pt-0.5">
            <span>{labels.paidLabel || 'Total Paid'}:</span>
            <span>₹{Number(receipt.paidAmount ?? receipt.total).toFixed(2)}</span>
          </div>
        </>
      ) : cfg.showPaymentBreakup && (
        <>
          <div className="flex justify-between font-bold">
            <span>{labels.paidLabel || 'Paid Mode'}: {receipt.paymentMethod || 'CASH'}</span>
            <span>₹{Number(receipt.paidAmount ?? receipt.total).toFixed(2)}</span>
          </div>
          {receipt.changeAmount > 0 && (
            <div className="flex justify-between">
              <span>{labels.changeLabel || 'Change Returned'}:</span>
              <span>₹{Number(receipt.changeAmount).toFixed(2)}</span>
            </div>
          )}
        </>
      )}

      {cfg.showAdvanceSummary && receipt.advanceRedeemed > 0 && (
        <div className="flex justify-between text-slate-700">
          <span>Advance Adjusted:</span>
          <span>-₹{Number(receipt.advanceRedeemed).toFixed(2)}</span>
        </div>
      )}

      {cfg.showAdvanceSummary && receipt.advanceBalance !== undefined && (
        <div className="flex justify-between text-slate-700 font-medium">
          <span>Remaining Store Credit:</span>
          <span>₹{Number(receipt.advanceBalance).toFixed(2)}</span>
        </div>
      )}
    </div>
  ) : null;

  const qrPaymentNode = (cfg.showQrCode && qrDataUrl) ? (
    <div className="my-2 flex flex-col items-center justify-center text-center">
      <img src={qrDataUrl} alt="QR Code" className="h-24 w-24 border border-black p-0.5" />
      <div className="text-[9px] mt-0.5 font-bold uppercase tracking-wider">
        {cfg.qrCodeType === 'invoice' ? 'Scan for Digital Invoice' : 'Scan to Pay via UPI'}
      </div>
      {cfg.qrCodeType !== 'invoice' && (billing.upiId || company.upiId) && (
        <div className="text-[8.5px] opacity-80">{billing.upiId || company.upiId}</div>
      )}
    </div>
  ) : null;

  const barcodeNode = (cfg.showBarcode && receipt.orderId) ? (
    <div className="my-1.5 text-center">
      <div className="inline-block px-2 py-0.5 border border-black font-mono font-bold tracking-widest text-[11px]">
        *{receipt.orderId}*
      </div>
    </div>
  ) : null;

  const termsFooterNode = (
    <>
      <div className="overflow-hidden whitespace-nowrap text-center opacity-70 my-1">{divider}</div>
      <div className="text-center text-[10px] space-y-1">
        {cfg.showTerms && (
          <div className="text-[9px] leading-tight text-slate-700 whitespace-pre-line">
            <div className="font-bold">{labels.termsTitle || 'Terms & Conditions'}:</div>
            {billing.terms || billing.termsText || cfg.termsText || '1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction.'}
          </div>
        )}

        {cfg.showFooterNote && (
          <div className="font-bold text-[10.5px]">
            {labels.greetingText || billing.footerNote || billing.footerText || cfg.greetingText || 'Thank you! Visit again.'}
          </div>
        )}

        <div className="text-[8px] text-slate-400 pt-1">
          Software by Selsolve POS
        </div>
      </div>
    </>
  );

  const sectionNodes = {
    header_branding: headerBrandingNode,
    store_meta: storeMetaNode,
    custom_banner: customBannerNode,
    bill_meta: billMetaNode,
    customer_info: customerInfoNode,
    items_table: itemsTableNode,
    totals_summary: totalsSummaryNode,
    gst_slabs: gstSlabsNode,
    savings_badge: savingsBadgeNode,
    payments_breakup: paymentsBreakupNode,
    qr_payment: qrPaymentNode,
    barcode: barcodeNode,
    terms_footer: termsFooterNode
  };

  return (
    <div
      id="printable-thermal-receipt"
      className={`bg-white text-black font-mono p-3 sm:p-4 mx-auto rounded-xl border border-dashed border-slate-300 shadow-md print:border-none print:shadow-none print:p-0 print:m-0 w-full overflow-hidden box-border ${widthClass} ${fontScale}`}
      style={{ boxSizing: 'border-box' }}
    >
      {cfg.customCss && <style dangerouslySetInnerHTML={{ __html: cfg.customCss }} />}

      {enabledOrder.map((id) => {
        const node = sectionNodes[id];
        return node ? <React.Fragment key={id}>{node}</React.Fragment> : null;
      })}
    </div>
  );
}
