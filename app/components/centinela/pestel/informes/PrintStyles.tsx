// app/components/centinela/pestel/informes/PrintStyles.tsx
// Injects @media print styles into <head> for PDF export via window.print().

"use client";

import { useEffect } from "react";

const CSS = `
@media print {
  /* Hide navigation, buttons, and non-content elements */
  .no-print {
    display: none !important;
  }

  /* Page setup */
  @page {
    margin: 1.5cm 2cm;
    size: A4 portrait;
  }

  body {
    font-size: 11pt;
    font-family: Georgia, "Times New Roman", serif;
    color: #000 !important;
    background: #fff !important;
  }

  /* Report container */
  .report-container {
    max-width: none !important;
    padding: 0 !important;
    border: none !important;
    box-shadow: none !important;
    background: transparent !important;
    font-family: Georgia, "Times New Roman", serif !important;
    font-size: 11pt !important;
    line-height: 1.6 !important;
  }

  /* Scorecard table */
  table {
    width: 100% !important;
    border-collapse: collapse !important;
    font-size: 10pt !important;
    page-break-inside: avoid;
  }

  th, td {
    border: 1px solid #ccc !important;
    padding: 4pt 6pt !important;
  }

  th {
    background: #f5f5f5 !important;
    color: #000 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Avoid breaking section headers across pages */
  h2, h3 {
    page-break-after: avoid;
    font-size: 13pt !important;
    margin-top: 14pt !important;
  }

  /* Do not show URLs after links */
  a[href]::after {
    content: none !important;
  }

  /* Page break hints */
  .page-break {
    page-break-before: always;
  }
}
`;

export default function PrintStyles() {
  useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-pestel-print", "1");
    style.textContent = CSS;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return null;
}
