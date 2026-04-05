import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const subscribers = await base44.asServiceRole.entities.Subscriber.list('-created_date', 500);
  const doc = new jsPDF({ orientation: 'landscape' });

  // Title
  doc.setFontSize(18);
  doc.text('تقرير المشتركين', 260, 15, { align: 'right' });
  doc.setFontSize(10);
  doc.text(`تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}`, 260, 22, { align: 'right' });

  // Headers
  doc.setFillColor(34, 85, 60);
  doc.rect(10, 28, 277, 9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  const headers = ['الاسم', 'الجنس', 'الوزن الحالي', 'الوزن المستهدف', 'الطول', 'مؤشر الكتلة', 'الحالة', 'تاريخ الانتهاء'];
  const xPositions = [260, 220, 185, 150, 115, 82, 52, 18];
  headers.forEach((h, i) => doc.text(h, xPositions[i], 34, { align: 'right' }));

  // Rows
  doc.setTextColor(0, 0, 0);
  let y = 44;
  subscribers.forEach((s, idx) => {
    if (y > 185) {
      doc.addPage();
      y = 20;
    }
    if (idx % 2 === 0) {
      doc.setFillColor(245, 250, 247);
      doc.rect(10, y - 5, 277, 9, 'F');
    }
    doc.setFontSize(8);
    const statusMap = { active: 'نشط', trial: 'تجريبي', expired: 'منتهي', cancelled: 'ملغي' };
    const genderMap = { male: 'ذكر', female: 'أنثى' };
    const row = [
      s.full_name || '-',
      genderMap[s.gender] || '-',
      `${s.current_weight || '-'} كغ`,
      `${s.target_weight || '-'} كغ`,
      `${s.height_cm || '-'} سم`,
      s.bmi ? s.bmi.toFixed(1) : '-',
      statusMap[s.subscription_status] || '-',
      s.subscription_end_date || '-',
    ];
    row.forEach((cell, i) => doc.text(String(cell), xPositions[i], y, { align: 'right' }));
    y += 10;
  });

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`صفحة ${i} من ${totalPages} | إجمالي المشتركين: ${subscribers.length}`, 148, 200, { align: 'center' });
  }

  const pdfBytes = doc.output('arraybuffer');
  return new Response(pdfBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=subscribers-report.pdf',
    },
  });
});