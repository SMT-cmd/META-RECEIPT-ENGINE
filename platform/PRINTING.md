# Printing and multipage receipts

Bizlano prints using the browser's **Print / Save as PDF** command. This means an already-installed and paired USB, Bluetooth, Wi-Fi, network, or POS printer can appear as a destination when the browser and operating system support it. Bizlano does not directly connect to printers using device-specific Bluetooth services or ESC/POS commands.

## Workflow

1. Open a saved receipt or invoice in the business workspace, or open a receipt from the customer recovery page.
2. Pick A4, Letter, 80 mm roll, or 58 mm roll.
3. Select **Print / Save PDF**.
4. In the system print dialog, choose the connected printer or **Save as PDF**. Select a matching roll size in the printer's own paper settings when needed.

The printer may first need to be added in Windows, macOS, Android, iOS, or the manufacturer's app. Some POS printers expose only a manufacturer's proprietary Bluetooth protocol and will not appear in the browser print dialog. Download the PDF and use the supplied manufacturer app/driver in that case. Do not claim that Web Bluetooth is a universal printer connection: it is not available across all browsers and printer models.

## Page layout

- For A4 and Letter, long item tables paginate naturally onto additional pages. A new page repeats the item-table headings where browser print support permits.
- Every line item stays together where possible, while totals, notes, recovery codes, signatures and document headings use page-break protection.
- The original August MetaForge receipt styles, including Swiss side branding and Japanese vertical branding, are preserved on standard paper.
- On narrow rolls, Bizlano uses compact typography and compact layouts. The original 58 mm five-column item table is stacked to retain description, quantity, unit price and amount.
- Receipt pages have no forced single-page cap or hidden overflow.
- An unsaved preview displays **UNSAVED PREVIEW — NOT ISSUED** on paper to prevent it being mistaken for an issued receipt.

## Verification

Automated Node regression checks cover the print CSS, paper selectors, and print commands. Browser-to-PDF verification has exercised 85-item A4 receipts across original and modern templates, 35-item 58 mm / 80 mm receipt rolls, and 75-item customer receipt printouts. The final item and totals were checked in the resulting PDFs. The browser may wrap a long item description in multiple lines; validate content rather than exact one-line text extraction.

Real-world printer compatibility still depends on the user's physical printer, OS pairing, supported printer driver, paper size, and browser. Do not claim a specific untested printer model is supported.

