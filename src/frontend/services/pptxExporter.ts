import pptxgen from 'pptxgenjs';

interface SlideData {
  title: string;
  contentHtml: string;
  isCover: boolean;
}

export function exportToPPTX(slides: SlideData[], slideHeader = '', slideFooter = '', slideAuthor = '', filename = 'Apresentacao.pptx') {
  const pptx = new pptxgen();
  
  // Configure widescreen 16:9 layout
  pptx.layout = 'LAYOUT_169';

  slides.forEach((slide, index) => {
    const pptSlide = pptx.addSlide();

    if (slide.isCover) {
      // Navy Background (#003B70)
      pptSlide.background = { fill: '003B70' };

      // Title
      pptSlide.addText(slide.title, {
        x: 1.0,
        y: 1.8,
        w: 8.0,
        h: 1.5,
        fontSize: 40,
        bold: true,
        color: 'FFFFFF',
        fontFace: 'Georgia', // Serif fallback
        align: 'center'
      });

      // Decorative line
      pptSlide.addShape(pptx.ShapeType.rect, {
        x: 4.0,
        y: 3.3,
        w: 2.0,
        h: 0.05,
        fill: { color: '00A3A6' }
      });

      // Author Info
      if (slideAuthor) {
        pptSlide.addText(`Elaborado por: ${slideAuthor}`, {
          x: 1.0,
          y: 4.0,
          w: 8.0,
          h: 0.4,
          fontSize: 14,
          color: 'A0AEC0',
          fontFace: 'Arial',
          align: 'center'
        });
      }
    } else {
      // Standard Slide: Cream background (#FCFBF9)
      pptSlide.background = { fill: 'FCFBF9' };

      // Header text (top right)
      if (slideHeader) {
        pptSlide.addText(slideHeader, {
          x: 0.8,
          y: 0.2,
          w: 8.4,
          h: 0.3,
          fontSize: 10,
          color: '94A3B8',
          fontFace: 'Arial',
          align: 'right'
        });
      }

      // Title
      pptSlide.addText(slide.title, {
        x: 0.8,
        y: 0.5,
        w: 8.4,
        h: 0.8,
        fontSize: 24,
        bold: true,
        color: '003B70',
        fontFace: 'Georgia'
      });

      // Underline title line
      pptSlide.addShape(pptx.ShapeType.rect, {
        x: 0.8,
        y: 1.2,
        w: 8.4,
        h: 0.03,
        fill: { color: '00A3A6' }
      });

      // Extract bullets or tables from contentHtml dynamically
      const parser = new DOMParser();
      const doc = parser.parseFromString(slide.contentHtml, 'text/html');
      
      const tableRows = doc.querySelectorAll('.table-row');
      
      if (tableRows.length > 0) {
        const tableData: any[][] = [];
        tableRows.forEach(row => {
          const rowData: any[] = [];
          const isHeader = row.classList.contains('header-row');
          row.querySelectorAll('.table-cell').forEach(cell => {
            rowData.push({
              text: cell.textContent || '',
              options: {
                bold: isHeader,
                fill: { color: isHeader ? 'E2E8F0' : 'FFFFFF' },
                color: isHeader ? '003B70' : '1E293B'
              }
            });
          });
          if (rowData.length > 0) tableData.push(rowData);
        });

        pptSlide.addTable(tableData, {
          x: 0.8,
          y: 1.5,
          w: 8.4,
          fontSize: 13,
          fontFace: 'Arial',
          border: { type: 'solid', color: 'CBD5E1', pt: 1 }
        });
      } else {
        const bullets: { text: string }[] = [];
        doc.querySelectorAll('li').forEach(li => {
          bullets.push({ text: li.textContent || '' });
        });

        if (bullets.length > 0) {
          pptSlide.addText(bullets, {
            x: 0.8,
            y: 1.5,
            w: 8.4,
            h: 3.5,
            fontSize: 16,
            color: '1E293B',
            fontFace: 'Arial', // Sans-serif fallback
            bullet: true
          });
        } else {
          // Regular text paragraph
          const paragraphs = Array.from(doc.querySelectorAll('p'))
            .map(p => p.textContent || '')
            .join('\n\n');
            
          pptSlide.addText(paragraphs, {
            x: 0.8,
            y: 1.5,
            w: 8.4,
            h: 3.5,
            fontSize: 16,
            color: '1E293B',
            fontFace: 'Arial'
          });
        }
      }

      // Footer text (bottom left)
      if (slideFooter) {
        pptSlide.addText(slideFooter, {
          x: 0.8,
          y: 5.1,
          w: 6.0,
          h: 0.3,
          fontSize: 9,
          color: '94A3B8',
          fontFace: 'Arial',
          align: 'left'
        });
      }

      // Slide number (bottom right)
      pptSlide.addText(String(index + 1), {
        x: 8.0,
        y: 5.1,
        w: 1.2,
        h: 0.3,
        fontSize: 9,
        color: '94A3B8',
        fontFace: 'Arial',
        align: 'right'
      });
    }
  });

  pptx.writeFile({ fileName: filename });
}
