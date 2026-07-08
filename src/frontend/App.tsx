import React, { useState } from 'react';
import { callCritique, callGenerateSlides } from './services/aiService.ts';
import { exportToPPTX } from './services/pptxExporter.ts';

interface SlideData {
  title: string;
  contentHtml: string;
  isCover: boolean;
  isTable: boolean;
}

export default function App() {
  const [text, setText] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>(['concision']);
  const [customInstructions, setCustomInstructions] = useState('');
  const [critique, setCritique] = useState('');
  const [improvedText, setImprovedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Slide show states
  const [slidesMarkdown, setSlidesMarkdown] = useState('');
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'edit' | 'slides'>('edit');

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await callCritique(text, selectedSkills, customInstructions);
      setCritique(res.critique);
      setImprovedText(res.improvedText);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleApplyImprovements = () => {
    if (improvedText) {
      setText(improvedText);
    }
  };

  const parseSlides = (markdown: string): SlideData[] => {
    const parts = markdown.split(/\r?\n[ \t]*---[ \t]*\r?\n/);
    return parts.map((part, index) => {
      const trimmed = part.trim();
      const lines = trimmed.split(/\r?\n/);
      
      // Find title
      let title = 'Slide';
      const titleLine = lines.find(l => l.startsWith('# '));
      if (titleLine) {
        title = titleLine.replace('# ', '').trim();
      }

      // Detect layout type
      const isCover = index === 0;
      const isTable = trimmed.includes('|') && trimmed.includes('-|-');

      // Simple HTML converter for topics and tables
      let contentHtml = '';
      let insideList = false;
      let insideTable = false;

      lines.forEach(line => {
        if (line.startsWith('# ')) return; // Skip title line
        
        if (line.startsWith('- ') || line.startsWith('* ')) {
          if (insideTable) {
            contentHtml += '</div>';
            insideTable = false;
          }
          if (!insideList) {
            contentHtml += '<ul>';
            insideList = true;
          }
          contentHtml += `<li>${line.slice(2)}</li>`;
        } else {
          if (insideList) {
            contentHtml += '</ul>';
            insideList = false;
          }
          const cleanLine = line.trim();
          if (cleanLine.startsWith('|')) {
            // Handle table separator line: if cleanLine.replace(/[\s\-|:|]/g, '') === '', skip it
            if (cleanLine.replace(/[\s\-|:|]/g, '') === '') {
              return;
            }
            // Safely split cells keeping empty cells
            let cells = cleanLine.split('|').map(c => c.trim());
            if (cleanLine.startsWith('|')) cells.shift();
            if (cleanLine.endsWith('|')) cells.pop();

            if (!insideTable) {
              contentHtml += '<div class="table-container">';
              insideTable = true;
              contentHtml += `<div class="table-row header-row">${cells.map(c => `<div class="table-cell">${c}</div>`).join('')}</div>`;
            } else {
              contentHtml += `<div class="table-row">${cells.map(c => `<div class="table-cell">${c}</div>`).join('')}</div>`;
            }
          } else {
            if (insideTable) {
              contentHtml += '</div>';
              insideTable = false;
            }
            if (cleanLine !== '') {
              contentHtml += `<p>${line}</p>`;
            }
          }
        }
      });
      if (insideList) contentHtml += '</ul>';
      if (insideTable) contentHtml += '</div>';

      return { title, contentHtml, isCover, isTable };
    }).filter(s => s.contentHtml || s.title);
  };

  const handleGenerateSlides = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await callGenerateSlides(text);
      setSlidesMarkdown(res.slidesMarkdown);
      const parsed = parseSlides(res.slidesMarkdown);
      setSlides(parsed);
      setCurrentSlideIndex(0);
      setViewMode('slides');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const handleExportHTML = () => {
    // Generate clean, inline static HTML containing all slides content
    const cssContent = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap');
      :root {
        --color-navy: #003B70;
        --color-teal: #00A3A6;
        --color-white: #FFFFFF;
        --color-text-dark: #1E293B;
        --font-heading: 'Playfair Display', serif;
        --font-body: 'Inter', sans-serif;
      }
      body { margin: 0; font-family: var(--font-body); background: #F1F3F5; }
      .slide {
        width: 100vw;
        height: 56.25vw;
        padding: 3rem;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: center;
        page-break-after: always;
        background: #FCFBF9;
        color: var(--color-text-dark);
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .slide.cover {
        background: var(--color-navy);
        color: var(--color-white);
        align-items: center;
        text-align: center;
      }
      .slide-title { font-size: 2.5rem; margin-top: 0; font-family: var(--font-heading); }
      .slide.standard .slide-title { border-bottom: 2px solid var(--color-teal); padding-bottom: 0.5rem; }
      .slide-line { width: 150px; height: 2px; background: var(--color-teal); margin: 1rem auto; }
      .slide-content { font-size: 1.1rem; line-height: 1.6; margin-top: 1.5rem; }
      .slide-content ul { margin: 0; padding-left: 1.5rem; }
      .slide-content li { margin-bottom: 0.5rem; }
      .table-container {
        margin: 1.5rem 0;
        border: 1px solid #E2E8F0;
        border-radius: 8px;
        overflow: hidden;
        background: #FFFFFF;
      }
      .table-row {
        display: flex;
        border-bottom: 1px solid #E2E8F0;
        padding: 0.5rem 0;
      }
      .table-row.header-row {
        font-weight: 600;
        background: #F8F9FA;
        border-bottom: 2px solid var(--color-teal);
      }
      .table-cell {
        flex: 1;
        padding: 0.5rem;
      }
      @media print {
        body { background: white; }
        .slide { border: none; box-shadow: none; }
      }
    `;

    const slidesHtml = slides.map(slide => `
      <div class="slide ${slide.isCover ? 'cover' : 'standard'}">
        <h2 class="slide-title">${slide.title}</h2>
        ${slide.isCover ? '<div class="slide-line"></div>' : ''}
        <div class="slide-content">${slide.contentHtml}</div>
      </div>
    `).join('\n');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${slides[0]?.title || 'Apresentação'}</title>
          <style>${cssContent}</style>
        </head>
        <body>
          ${slidesHtml}
          <script>
            console.log("Apresentação estática gerada via SabrinaStyle.");
          </script>
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Apresentacao_SabrinaStyle.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
    <div className="container">
      <header className="header">
        <h1>SabrinaStyle Builder</h1>
        {viewMode === 'slides' && (
          <button className="btn btn-accent" onClick={() => setViewMode('edit')}>
            ← Voltar para Edição
          </button>
        )}
      </header>
      
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button className="error-close-btn" onClick={() => setError('')}>&times;</button>
        </div>
      )}
      
      {viewMode === 'edit' ? (
        <main className="workspace">
          <section className="panel panel-left">
            <textarea
              placeholder="Digite seu rascunho de apresentação..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="controls">
              <div className="skills-list">
                <label className="skill-item">
                  <input
                    type="checkbox"
                    checked={selectedSkills.includes('concision')}
                    onChange={() => toggleSkill('concision')}
                  />
                  Concisão
                </label>
                <label className="skill-item">
                  <input
                    type="checkbox"
                    checked={selectedSkills.includes('storytelling')}
                    onChange={() => toggleSkill('storytelling')}
                  />
                  Storytelling
                </label>
                <label className="skill-item">
                  <input
                    type="checkbox"
                    checked={selectedSkills.includes('critical')}
                    onChange={() => toggleSkill('critical')}
                  />
                  Análise Crítica
                </label>
              </div>
              <input
                type="text"
                placeholder="Instruções personalizadas adicionais..."
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '4px' }}
              />
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button className="btn" onClick={handleAnalyze} disabled={loading}>
                  {loading ? 'Analisando...' : 'Analisar Texto'}
                </button>
                <button className="btn btn-accent" onClick={handleGenerateSlides} disabled={loading || !text}>
                  {loading ? 'Gerando...' : 'Gerar Slides'}
                </button>
                {slides.length > 0 && (
                  <button className="btn" onClick={() => setViewMode('slides')} disabled={loading}>
                    Visualizar Slides
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="panel panel-right">
            {critique && (
              <div className="critique-card">
                <h3>Observações Críticas</h3>
                <p style={{ whiteSpace: 'pre-wrap' }}>{critique}</p>
              </div>
            )}
            {improvedText && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <h3>Texto Aprimorado</h3>
                <textarea readOnly value={improvedText} style={{ backgroundColor: '#F8FAFC' }} />
                <button
                  className="btn btn-accent"
                  onClick={handleApplyImprovements}
                  style={{ marginTop: '1rem' }}
                >
                  Aplicar Melhorias
                </button>
              </div>
            )}
          </section>
        </main>
      ) : (
        <main className="slideshow-view">
          <div className="slide-frame">
            {slides.length > 0 && (
              <div className={`slide-layout ${slides[currentSlideIndex].isCover ? 'cover' : 'standard'}`}>
                <h2 className="slide-title">{slides[currentSlideIndex].title}</h2>
                {slides[currentSlideIndex].isCover && <div className="slide-line"></div>}
                <div
                  className="slide-content"
                  dangerouslySetInnerHTML={{ __html: slides[currentSlideIndex].contentHtml }}
                />
              </div>
            )}
          </div>
          
          <div className="slideshow-nav">
            <button
              className="btn"
              onClick={() => setCurrentSlideIndex(p => Math.max(0, p - 1))}
              disabled={currentSlideIndex === 0}
            >
              Anterior
            </button>
            <span>Slide {currentSlideIndex + 1} de {slides.length}</span>
            <button
              className="btn"
              onClick={() => setCurrentSlideIndex(p => Math.min(slides.length - 1, p + 1))}
              disabled={currentSlideIndex === slides.length - 1}
            >
              Próximo
            </button>
            <button className="btn btn-accent" onClick={() => exportToPPTX(slides)}>Baixar PPTX</button>
            <button className="btn" onClick={handlePrintPDF}>Imprimir/Salvar PDF</button>
            <button className="btn" onClick={handleExportHTML}>Exportar HTML</button>
          </div>
        </main>
      )}
    </div>
    <div className="print-container">
      {slides.map((slide, index) => (
        <div key={index} className={`slide-page slide-layout ${slide.isCover ? 'cover' : 'standard'}`}>
          <h2 className="slide-title">{slide.title}</h2>
          {slide.isCover && <div className="slide-line"></div>}
          <div
            className="slide-content"
            dangerouslySetInnerHTML={{ __html: slide.contentHtml }}
          />
        </div>
      ))}
    </div>
    </>
  );
}
