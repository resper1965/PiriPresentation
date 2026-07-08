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

  const [copied, setCopied] = useState(false);

  const handleCopyText = () => {
    if (improvedText) {
      navigator.clipboard.writeText(improvedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
        <div className="header-branding">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3h18v12H3z" />
            <path d="M12 15v5" />
            <path d="M9 20h6" />
            <path d="m9 8 3-3 3 3" />
            <path d="M12 5v6" />
          </svg>
          <h1>SabrinaStyle Builder</h1>
          <span className="header-badge">Workers AI Active</span>
        </div>
        {viewMode === 'slides' && (
          <button className="btn btn-accent" onClick={() => setViewMode('edit')}>
            <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 19-7-7 7-7" />
              <path d="M19 12H5" />
            </svg>
            Voltar para Edição
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
            <h2 className="panel-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              Roteiro & Conteúdo
            </h2>
            <div className="editor-container">
              <div className="textarea-wrapper">
                <textarea
                  placeholder="Digite o rascunho ou a história de sua apresentação aqui..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <div className="textarea-footer">
                  {text.length} caracteres
                </div>
              </div>
              <div className="controls">
                <div className="skills-list">
                  <label className={`skill-item ${selectedSkills.includes('concision') ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedSkills.includes('concision')}
                      onChange={() => toggleSkill('concision')}
                    />
                    ⚡ Concisão
                  </label>
                  <label className={`skill-item ${selectedSkills.includes('storytelling') ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedSkills.includes('storytelling')}
                      onChange={() => toggleSkill('storytelling')}
                    />
                    📖 Storytelling
                  </label>
                  <label className={`skill-item ${selectedSkills.includes('critical') ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedSkills.includes('critical')}
                      onChange={() => toggleSkill('critical')}
                    />
                    🧠 Análise Crítica
                  </label>
                </div>
                <input
                  type="text"
                  className="custom-inst-input"
                  placeholder="Instruções personalizadas adicionais (ex: 'Foco em tom corporativo')..."
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                />
                <div className="action-buttons-group">
                  <button className="btn" onClick={handleAnalyze} disabled={loading || !text}>
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
            </div>
          </section>

          <section className="panel panel-right">
            {!critique && !improvedText ? (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m19 11-8 8" />
                  <path d="m15 15-3 3" />
                  <path d="m18 10 3-3" />
                  <path d="m2 2 11 11" />
                  <path d="M22 2v4h-4" />
                  <path d="M2 22h4v-4" />
                  <path d="M20 20h.01" />
                  <path d="M4 4h.01" />
                </svg>
                <h3>Aprimoramento por IA</h3>
                <p>Escreva o texto do seu roteiro ao lado e clique em "Analisar Texto" ou "Gerar Slides" para ver a mágica acontecer.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {critique && (
                  <div className="critique-card">
                    <h3>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1 .3 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                        <path d="M9 18h6" />
                        <path d="M10 22h4" />
                      </svg>
                      Observações Críticas
                    </h3>
                    <p style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: '0.95rem', lineHeight: '1.6' }}>{critique}</p>
                  </div>
                )}
                {improvedText && (
                  <div className="improved-card">
                    <div className="card-header-actions">
                      <h3>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m12 3-1.912 5.886L4.202 9l5.886 1.912L12 16.8l1.912-5.886 5.886-1.912-5.886-1.912z" />
                        </svg>
                        Texto Aprimorado
                      </h3>
                      <button className={`btn-copy ${copied ? 'copied' : ''}`} onClick={handleCopyText}>
                        {copied ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                    <textarea readOnly value={improvedText} style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '1rem', borderRadius: '8px' }} />
                    <button
                      className="btn btn-accent"
                      onClick={handleApplyImprovements}
                      style={{ marginTop: '1.25rem' }}
                    >
                      Aplicar Melhorias ao Roteiro
                    </button>
                  </div>
                )}
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
              className="btn-circle"
              onClick={() => setCurrentSlideIndex(p => Math.max(0, p - 1))}
              disabled={currentSlideIndex === 0}
              title="Anterior"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <span>{currentSlideIndex + 1} / {slides.length}</span>
            <button
              className="btn-circle"
              onClick={() => setCurrentSlideIndex(p => Math.min(slides.length - 1, p + 1))}
              disabled={currentSlideIndex === slides.length - 1}
              title="Próximo"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
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
