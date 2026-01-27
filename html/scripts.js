window.jsPDF = window.jspdf.jsPDF;
const PRIMARY_COLOR = '#002244'; // Azul Oscuro Policía
const SECONDARY_COLOR = '#aadd00'; // Verde Lima
let doc;

// Helper to load images preserving aspect ratio (for circular profile)
async function getCircularImageUri(url, dWidth, dHeight) {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = function () {
      const canvas = document.createElement('canvas');
      canvas.width = dWidth;
      canvas.height = dHeight;

      const aspectRatio = this.naturalWidth / this.naturalHeight;
      let imgWidth = dWidth;
      let imgHeight = dHeight;
      if (aspectRatio > 1) {
        imgWidth = dWidth * aspectRatio;
      } else {
        imgHeight = dHeight / aspectRatio;
      }

      const ctx = canvas.getContext('2d');
      // Draw image centered
      ctx.drawImage(
        this,
        -(imgWidth - dWidth) / 2,
        -(imgHeight - dHeight) / 2,
        imgWidth,
        imgHeight
      );

      // Mask with circle
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(dWidth * 0.5, dHeight * 0.5, dWidth * 0.5, 0, 2 * Math.PI);
      ctx.fill();

      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = function () {
      resolve('');
    };
    image.src = url;
  });
}

// Helper to load rectangular images (for logos)
async function getRectImageUri(url) {
    return new Promise((resolve) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = function () {
            const canvas = document.createElement('canvas');
            canvas.width = this.naturalWidth;
            canvas.height = this.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(this, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        image.onerror = function () {
            resolve(''); 
        };
        image.src = url;
    });
}

function getQrCodeUri(text) {
  const qrContainer = document.createElement('div');
  new QRCode(qrContainer, text);
  return qrContainer.querySelector('canvas').toDataURL('image/png');
}

function downloadIdCard() {
  if (doc) {
    doc.save('id-card.pdf');
  }
}

async function generateIdCard(data) {
  // Restore Portrait Orientation
  doc = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: [2.125, 3.375], // Standard ID-1
  });

  // add fonts
  // Assuming POPPINS variables are global from base64-uris.js
  if (typeof POPPINS_BOLD !== 'undefined') {
    doc.addFileToVFS('Poppins-Bold', POPPINS_BOLD);
    doc.addFont('Poppins-Bold', 'Poppins', 'bold');
  }
  if (typeof POPPINS_MEDIUM !== 'undefined') {
    doc.addFileToVFS('Poppins-Medium', POPPINS_MEDIUM);
    doc.addFont('Poppins-Medium', 'Poppins', 'medium');
  }

  // Pre-load Logos
  const escudoUri = await getRectImageUri('escudo.png');
  const bienestarUri = await getRectImageUri('logobienestar.png');

  for (const [i, employee] of data.entries()) {
    if (i > 0) {
      doc.addPage();
    }

    // --- Header ---
    // Logos
    // Reduced size and moved to edges to prevent overlap with text
    const logoSize = 0.32;
    const margin = 0.05;
    const pageWidth = 2.125;
    
    if(escudoUri) doc.addImage(escudoUri, 'PNG', margin, 0.1, logoSize, logoSize); 
    if(bienestarUri) doc.addImage(bienestarUri, 'PNG', pageWidth - margin - logoSize, 0.1, logoSize, logoSize);

    // Header Text
    // Adjusted font size and position to fit between logos
    doc.setFont('Poppins', 'bold');
    doc.setTextColor(PRIMARY_COLOR);
    
    doc.setFontSize(7); // Reduced from 8
    doc.text('REPÚBLICA DE COLOMBIA', 1.0625, 0.20, null, null, 'center');
    
    doc.setFontSize(6);
    doc.text('POLICÍA NACIONAL', 1.0625, 0.30, null, null, 'center');
    
    doc.setFontSize(4.5); 
    doc.text('DIRECCIÓN DE BIENESTAR SOCIAL', 1.0625, 0.40, null, null, 'center');

    // --- Background Shapes ---
    doc.setFillColor(PRIMARY_COLOR);
    
    // Transition Triangle
    // Angled cut similar to original design
    // Overlap the rect slightly to remove white line
    doc.triangle(0, 1.685, 2.125, 1.30, 2.125, 1.685, 'F');
    
    // Main Dark Background
    doc.rect(0, 1.68, 2.125, 3.375 - 1.68, 'F');

    // --- Profile Image ---
    doc.setFillColor('#fff');
    // White border circle
    doc.circle(1.063, 1.447, 0.473, 'F');
    const profileUri = await getCircularImageUri(employee.image, 400, 400);
    // Profile image
    doc.addImage(profileUri, 0.633, 1.015, 0.86, 0.86);

    // --- Text Info ---
    doc.setFont('Poppins', 'bold');
    doc.setFontSize(9);
    doc.setTextColor('#fff');
    // Name
    doc.text(employee.name.toUpperCase(), 1.0625, 2.15, null, null, 'center');
    
    // Designation
    doc.setFont('Poppins', 'medium');
    doc.setFontSize(6);
    doc.text(employee.designation.toUpperCase(), 1.0625, 2.25, null, null, 'center');

    // Details Grid
    const startInfoY = 2.45;
    const lineSpace = 0.14;
    
    const items = [
        { l: 'ID', v: employee.id },
        { l: 'Teléfono', v: employee.phone },
        { l: 'Dirección', v: employee.address },
        { l: 'Valido', v: '2026-12-31' }
    ];

    items.forEach((item, k) => {
        const y = startInfoY + (k * lineSpace);
        doc.setFontSize(5.5);
        doc.setTextColor(200, 200, 200); // Label color
        doc.text(item.l, 0.4, y);
        doc.text(':', 0.85, y);
        
        doc.setTextColor(255, 255, 255); // Value color
        doc.text(item.v, 0.9, y);
    });

    // --- QR Code ---
    // White background for QR
    const qrSize = 0.4;
    const qrX = 1.6;
    const qrY = 2.5;
    
    doc.setFillColor('#fff');
    doc.rect(qrX - 0.02, qrY - 0.02, qrSize + 0.04, qrSize + 0.04, 'F');
    
    const qrCodeUri = getQrCodeUri(employee.id);
    doc.addImage(qrCodeUri, qrX, qrY, qrSize, qrSize);

    // --- Pattern Strip (Footer) ---
    // Replicating the CSS conic-gradient pattern manually with rects
    // Pattern strip height ~0.25 inches
    const stripHeight = 0.25;
    const bottomY = 3.375 - stripHeight;
    const squareSize = 0.125; // Size of each checkered square in inches

    const colGreen = [170, 221, 0]; // #aadd00
    const colBlue = [0, 34, 68]; // #002244

    let rowIdx = 0;
    for (let y = bottomY; y < 3.375; y += squareSize) {
        let colIdx = 0;
        for (let x = 0; x < 2.125; x += squareSize) {
            // Checkerboard logic
            if ((rowIdx + colIdx) % 2 === 0) {
                 doc.setFillColor(...colGreen);
            } else {
                 doc.setFillColor(...colBlue);
            }
            
            // Draw square clipped to page bounds
            let w = (x + squareSize > 2.125) ? 2.125 - x : squareSize;
            let h = (y + squareSize > 3.375) ? 3.375 - y : squareSize;
            
            // Avoid drawing tiny slivers
            if (w > 0.01 && h > 0.01) {
                doc.rect(x, y, w, h, 'F');
            }
            colIdx++;
        }
        rowIdx++;
    }
    
    // Draw line above pattern?
    doc.setDrawColor(0, 34, 68);
    doc.setLineWidth(0.01);
    doc.line(0, bottomY, 2.125, bottomY);
  }

  document
    .getElementById('idcard-preview')
    .setAttribute('src', URL.createObjectURL(doc.output('blob')));
}
