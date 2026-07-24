import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const generateReport = async (elementId: string, filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element);
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  
  pdf.setFontSize(16);
  pdf.text("Kenya Yield Insight - GeoAI Analysis", 10, 10);
  pdf.addImage(imgData, 'PNG', 10, 20, 190, 100);
  pdf.save(`${filename}.pdf`);
};