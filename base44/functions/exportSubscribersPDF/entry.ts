import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { jsPDF } from 'npm:jspdf@4.0.0';

// PDF LIMITATION: jsPDF's bundled fonts cannot shape Arabic script, so this
// report is an ENGLISH export with Arabic names transliterated to Latin
// script (deterministic mapping below). The UI presents it as "English PDF
// export". A proper Arabic PDF would need an embedded base64 Arabic font,
// which is not feasible in this function without a very large payload.

const AR_LAT = {
  'ا':'a','أ':'a','إ':'i','آ':'a','ب':'b','ت':'t','ث':'th','ج':'j','ح':'h','خ':'kh',
  'د':'d','ذ':'th','ر':'r','ز':'z','س':'s','ش':'sh','ص':'s','ض':'d','ط':'t','ظ':'z',
  'ع':'a','غ':'gh','ف':'f','ق':'q','ك':'k','ل':'l','م':'m','ن':'n','ه':'h','و':'w',
  'ي':'y','ى':'a','ة':'a','ء':'\'','ؤ':'u','ئ':'i',
  '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'
};

function transliterate(text) {
  if (!text) return '';
  return String(text)
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .split('')
    .map(ch => AR_LAT[ch] !== undefined ? AR_LAT[ch] : (ch.charCodeAt(0) < 128 ? ch : ''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const subscribers = await base44.asServiceRole.entities.Subscriber.list('-created_date', 500);
    const doc = new jsPDF({ orientation: 'landscape' });

    // Title
    doc.setFontSize(18);
    doc.text('Subscribers Report (English Export)', 148, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Report date: ${new Date().toISOString().split('T')[0]}`, 148, 22, { align: 'center' });

    // Headers
    doc.setFillColor(34, 85, 60);
    doc.rect(10, 28, 277, 9, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    const headers = ['Name', 'Gender', 'Current Wt', 'Target Wt', 'Height', 'BMI', 'Status', 'End Date'];
    const xPositions = [18, 82, 115, 150, 185, 215, 240, 265];
    headers.forEach((h, i) => doc.text(h, xPositions[i], 34, { align: 'left' }));

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
      const statusMap = { active: 'Active', trial: 'Trial', expired: 'Expired', cancelled: 'Cancelled' };
      const genderMap = { male: 'Male', female: 'Female' };
      const row = [
        transliterate(s.full_name) || '-',
        genderMap[s.gender] || '-',
        `${s.current_weight || '-'} kg`,
        `${s.target_weight || '-'} kg`,
        `${s.height_cm || '-'} cm`,
        s.bmi ? Number(s.bmi).toFixed(1) : '-',
        statusMap[s.subscription_status] || '-',
        s.subscription_end_date || '-',
      ];
      row.forEach((cell, i) => doc.text(String(cell), xPositions[i], y, { align: 'left' }));
      y += 10;
    });

    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} of ${totalPages} | Total subscribers: ${subscribers.length} | Arabic names transliterated`, 148, 200, { align: 'center' });
    }

    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=subscribers-report-en.pdf',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
