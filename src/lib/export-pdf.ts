import jsPDF from "jspdf";
import "jspdf-autotable";

export const PDF_COLORS = {
  primary: [41, 65, 148] as [number, number, number],
  gray: [100, 100, 100] as [number, number, number],
  lightGray: [240, 240, 240] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  black: [0, 0, 0] as [number, number, number],
  red: [200, 50, 50] as [number, number, number],
  green: [30, 130, 76] as [number, number, number],
};

export function drawPdfHeader(doc: jsPDF, title: string) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...PDF_COLORS.primary);
  doc.text("Al Madina Flour Mill", 14, 20);

  doc.setFontSize(14);
  doc.setTextColor(...PDF_COLORS.gray);
  doc.text(title, pageWidth - 14, 20, { align: "right" });

  doc.setDrawColor(...PDF_COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(14, 25, pageWidth - 14, 25);

  return 30; // y position after header
}

export function drawPdfFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.gray);
    doc.setFont("helvetica", "italic");
    doc.text("This is a computer generated statement", 14, pageHeight - 10);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: "right" });
  }
}

export function formatPdfDate(): string {
  return new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
