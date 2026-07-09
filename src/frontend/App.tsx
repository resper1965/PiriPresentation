import React, { useState } from 'react';
import { callCritique, callGenerateSlides } from './services/aiService.ts';

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
  const [viewMode, setViewMode] = useState<'edit' | 'slides'>('edit');
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slideHeader, setSlideHeader] = useState('Marsh McLennan');
  const [slideFooter, setSlideFooter] = useState('Confidential - Strategic Review 2026');
  const [slideAuthor, setSlideAuthor] = useState('Sabrina Barros');
  const [targetSlides, setTargetSlides] = useState(6);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('piripres_auth_token') || 'piri2026@!');
  const [copied, setCopied] = useState(false);
  const [exportingPptx, setExportingPptx] = useState(false);

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

  const escapeHtml = (value: string): string => {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const sanitizeSlideHtml = (html: string): string => {
    const allowedTags = new Set(['DIV', 'H3', 'P', 'UL', 'LI', 'STRONG', 'EM', 'CODE']);
    const allowedClasses = new Set([
      'grid-2-cols',
      'grid-3-cols',
      'card',
      'metric-highlight',
      'metric-val',
      'metric-lbl',
      'callout-box',
      'table-container',
      'table-row',
      'header-row',
      'table-cell'
    ]);
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
    const root = doc.body.firstElementChild;
    if (!root) return '';

    const clean = (element: Element) => {
      Array.from(element.children).forEach(child => {
        if (!allowedTags.has(child.tagName)) {
          child.replaceWith(doc.createTextNode(child.textContent || ''));
          return;
        }

        Array.from(child.attributes).forEach(attr => child.removeAttribute(attr.name));
        const safeClasses = Array.from(child.classList).filter(className => allowedClasses.has(className));
        if (safeClasses.length > 0) child.setAttribute('class', safeClasses.join(' '));
        clean(child);
      });
    };

    clean(root);
    return root.innerHTML;
  };

  const parseInlineMarkdown = (txt: string): string => {
    return escapeHtml(txt)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>');
  };

  const parseSlidesLegacy = (markdown: string): SlideData[] => {
    let normalizedMarkdown = markdown.replace(/(?:^|\r?\n)[ \t]*--[ \t]*(?:\r?\n|$)/g, '\n---\n');
    if (!normalizedMarkdown.includes('---')) {
      normalizedMarkdown = normalizedMarkdown.replace(/(?:^|\r?\n)(?:#\s*)?Slide\s*\d+\s*[:\-]*\s*/gi, '\n---\n# ');
      if (!normalizedMarkdown.includes('---')) {
        normalizedMarkdown = normalizedMarkdown.replace(/(?:^|\r?\n)(?:#\s*)?Slide\s*[:\-]\s*/gi, '\n---\n# ');
      }
    }
    const parts = normalizedMarkdown.split(/\r?\n[ \t]*---[ \t]*\r?\n/).map(p => p.trim()).filter(Boolean);
    return parts.map((part, index) => {
      const trimmed = part.trim();
      const lines = trimmed.split(/\r?\n/);
      let title = 'Slide';
      const titleLine = lines.find(l => l.startsWith('# '));
      if (titleLine) {
        title = titleLine.replace('# ', '').replace(/\*\*|\*|__/g, '').trim();
      }
      const isCover = index === 0;
      const isTable = trimmed.includes('|') && trimmed.includes('-|-');
      let contentHtml = '';
      let insideList = false;
      let insideTable = false;
      lines.forEach(line => {
        if (line.startsWith('# ')) return;
        if (line.startsWith('- ') || line.startsWith('* ')) {
          if (insideTable) {
            contentHtml += '</div>';
            insideTable = false;
          }
          if (!insideList) {
            contentHtml += '<ul>';
            insideList = true;
          }
          contentHtml += `<li>${parseInlineMarkdown(line.slice(2))}</li>`;
        } else {
          if (insideList) {
            contentHtml += '</ul>';
            insideList = false;
          }
          const cleanLine = line.trim();
          if (cleanLine.startsWith('|')) {
            if (cleanLine.replace(/[\s\-|:|]/g, '') === '') return;
            let cells = cleanLine.split('|').map(c => c.trim());
            if (cleanLine.startsWith('|')) cells.shift();
            if (cleanLine.endsWith('|')) cells.pop();
            if (!insideTable) {
              contentHtml += '<div class="table-container">';
              insideTable = true;
              contentHtml += `<div class="table-row header-row">${cells.map(c => `<div class="table-cell">${parseInlineMarkdown(c)}</div>`).join('')}</div>`;
            } else {
              contentHtml += `<div class="table-row">${cells.map(c => `<div class="table-cell">${parseInlineMarkdown(c)}</div>`).join('')}</div>`;
            }
          } else {
            if (insideTable) {
              contentHtml += '</div>';
              insideTable = false;
            }
            if (cleanLine !== '') {
              if (cleanLine.startsWith('<')) {
                contentHtml += line;
              } else {
                contentHtml += `<p>${parseInlineMarkdown(line)}</p>`;
              }
            }
          }
        }
      });
      if (insideList) contentHtml += '</ul>';
      if (insideTable) contentHtml += '</div>';
      return { title, contentHtml: sanitizeSlideHtml(contentHtml), isCover, isTable };
    }).filter(s => s.contentHtml || s.title);
  };

  const parseSlides = (markdown: string): SlideData[] => {
    const hasTags = /<slide/i.test(markdown);
    if (!hasTags) {
      return parseSlidesLegacy(markdown);
    }

    const slideRegex = /<slide\s+type="([^"]+)">([\s\S]*?)<\/slide>/gi;
    const slidesList: SlideData[] = [];
    let match;

    while ((match = slideRegex.exec(markdown)) !== null) {
      const type = match[1].toLowerCase();
      const content = match[2].trim();
      const lines = content.split(/\r?\n/);

      let title = 'Slide';
      const titleLine = lines.find(l => l.startsWith('# '));
      if (titleLine) {
        title = titleLine.replace('# ', '').replace(/\*\*|\*|__/g, '').trim();
      }

      const isCover = type === 'cover';
      const isTable = content.includes('|') && content.includes('-|-');

      let contentHtml = '';
      let insideList = false;
      let insideTable = false;

      lines.forEach(line => {
        if (line.startsWith('# ')) return;
        
        if (line.startsWith('- ') || line.startsWith('* ')) {
          if (insideTable) {
            contentHtml += '</div>';
            insideTable = false;
          }
          if (!insideList) {
            contentHtml += '<ul>';
            insideList = true;
          }
          contentHtml += `<li>${parseInlineMarkdown(line.slice(2))}</li>`;
        } else {
          if (insideList) {
            contentHtml += '</ul>';
            insideList = false;
          }
          const cleanLine = line.trim();
          if (cleanLine.startsWith('|')) {
            if (cleanLine.replace(/[\s\-|:|]/g, '') === '') {
              return;
            }
            let cells = cleanLine.split('|').map(c => c.trim());
            if (cleanLine.startsWith('|')) cells.shift();
            if (cleanLine.endsWith('|')) cells.pop();

            if (!insideTable) {
              contentHtml += '<div class="table-container">';
              insideTable = true;
              contentHtml += `<div class="table-row header-row">${cells.map(c => `<div class="table-cell">${parseInlineMarkdown(c)}</div>`).join('')}</div>`;
            } else {
              contentHtml += `<div class="table-row">${cells.map(c => `<div class="table-cell">${parseInlineMarkdown(c)}</div>`).join('')}</div>`;
            }
          } else {
            if (insideTable) {
              contentHtml += '</div>';
              insideTable = false;
            }
            if (cleanLine !== '') {
              if (cleanLine.startsWith('<')) {
                contentHtml += line;
              } else {
                contentHtml += `<p>${parseInlineMarkdown(line)}</p>`;
              }
            }
          }
        }
      });
      if (insideList) contentHtml += '</ul>';
      if (insideTable) contentHtml += '</div>';

      slidesList.push({
        title,
        contentHtml: sanitizeSlideHtml(contentHtml),
        isCover,
        isTable
      });
    }

    return slidesList;
  };

  const handleGenerateSlides = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await callGenerateSlides(text, targetSlides);
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

  const handleExportPPTX = async () => {
    setExportingPptx(true);
    setError('');
    try {
      const { exportToPPTX } = await import('./services/pptxExporter.ts');
      await exportToPPTX(slides, slideHeader, slideFooter, slideAuthor);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExportingPptx(false);
    }
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
        padding: 3.8rem 4rem;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: center;
        page-break-after: always;
        background: #FCFBF9;
        color: var(--color-text-dark);
        position: relative;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .slide.cover {
        background: var(--color-navy);
        color: var(--color-white);
        align-items: center;
        text-align: center;
        padding: 3rem;
      }
      .slide-title { font-size: 2.1rem; margin-top: 0; font-family: var(--font-heading); color: var(--color-navy); }
      .slide.cover .slide-title { font-size: 2.6rem; color: var(--color-white); }
      .slide.standard .slide-title { border-bottom: 2px solid var(--color-teal); padding-bottom: 0.5rem; }
      .slide-line { width: 120px; height: 3px; background: var(--color-teal); margin: 1.25rem auto; border-radius: 2px; }
      .slide-content { font-size: 1.15rem; line-height: 1.7; margin-top: 1.5rem; }
      .slide-content ul { margin: 0; padding-left: 1.5rem; }
      .slide-content li { margin-bottom: 0.6rem; }
      
      /* Layout grids and cards */
      .grid-2-cols { display: flex; gap: 1.5rem; width: 100%; margin-top: 1rem; }
      .grid-3-cols { display: flex; gap: 1.2rem; width: 100%; margin-top: 1rem; }
      .grid-2-cols > *, .grid-3-cols > * { flex: 1; min-width: 0; }
      .card { background: var(--color-white); border: 1px solid #E2E8F0; border-radius: 12px; padding: 1.25rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); box-sizing: border-box; }
      .card h3 { margin-top: 0; margin-bottom: 0.75rem; font-family: var(--font-heading); color: var(--color-navy); font-size: 1.25rem; border-bottom: 1.5px solid var(--color-teal); padding-bottom: 0.4rem; font-weight: 600; }
      .card ul { margin: 0; padding-left: 1.25rem; }
      .card li { margin-bottom: 0.4rem; font-size: 1.05rem; }
      .metric-highlight { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 1.25rem; background: var(--color-white); border: 1px solid #E2E8F0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); box-sizing: border-box; }
      .metric-highlight .metric-val { font-size: 3rem; font-weight: 700; color: var(--color-teal); font-family: var(--font-heading); line-height: 1; }
      .metric-highlight .metric-lbl { font-size: 0.95rem; color: var(--color-text-dark); margin-top: 0.5rem; font-weight: 600; }
      .callout-box { background: rgba(0, 163, 166, 0.04); border-left: 4px solid var(--color-teal); padding: 1.1rem; border-radius: 4px; font-style: italic; color: var(--color-text-dark); margin-bottom: 1.25rem; font-size: 1.1rem; }

      /* Tables styling */
      .table-container { margin: 1.5rem 0; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; background: #FFFFFF; }
      .table-row { display: flex; border-bottom: 1px solid #E2E8F0; padding: 0.5rem 0; }
      .table-row.header-row { font-weight: 600; background: #F8F9FA; border-bottom: 2px solid var(--color-teal); }
      .table-cell { flex: 1; padding: 0.5rem; }

      /* Header/Footer styling */
      .slide-header { position: absolute; top: 1.25rem; left: 4rem; right: 4rem; display: flex; justify-content: flex-end; font-size: 0.8rem; color: #94A3B8; text-transform: uppercase; font-weight: 600; }
      .slide-footer { position: absolute; bottom: 1.25rem; left: 4rem; right: 4rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: #94A3B8; }
      .slide-footer .slide-number { font-weight: 600; background: rgba(0, 163, 166, 0.06); color: var(--color-teal); padding: 0.2rem 0.5rem; border-radius: 4px; }
      .slide.cover .slide-author { margin-top: 1.5rem; font-size: 1rem; color: rgba(255,255,255,0.7); font-weight: 500; text-align: center; font-family: var(--font-body); letter-spacing: 0.02em; }

      @media print {
        body { background: white; }
        .slide { border: none; box-shadow: none; }
      }
    `;

    const slidesHtml = slides.map((slide, index) => `
      <div class="slide ${slide.isCover ? 'cover' : 'standard'}">
        ${!slide.isCover ? `
          <div class="slide-header">
            <span class="slide-brand">${escapeHtml(slideHeader)}</span>
          </div>
        ` : ''}
        <h2 class="slide-title">${escapeHtml(slide.title)}</h2>
        ${slide.isCover ? '<div class="slide-line"></div>' : ''}
        <div class="slide-content">${slide.contentHtml}</div>
        ${!slide.isCover ? `
          <div class="slide-footer">
            <span class="slide-confidential">${escapeHtml(slideFooter)}</span>
            <span class="slide-number">${index + 1}</span>
          </div>
        ` : `
          ${slideAuthor ? `
            <div class="slide-author">
              Elaborado por: ${escapeHtml(slideAuthor)}
            </div>
          ` : ''}
        `}
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
            console.log("Apresentação estática gerada via PiriPres.");
          </script>
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Apresentacao_PiriPres.html';
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
          <div className="piripres-logo">
            <span className="logo-letter">P</span>
            <span className="logo-letter-sub">P</span>
          </div>
          <div className="header-title-group">
            <span className="header-title-main">Piri<span className="text-teal">Pres</span></span>
            <span className="header-subtitle">PiriOffice</span>
          </div>
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
                  <label className={`skill-item ${selectedSkills.includes('pnl') ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedSkills.includes('pnl')}
                      onChange={() => toggleSkill('pnl')}
                    />
                    🗣️ PNL
                  </label>
                </div>
                <input
                  type="text"
                  className="custom-inst-input"
                  placeholder="Instruções personalizadas adicionais (ex: 'Foco em tom corporativo')..."
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                />
                <div className="branding-inputs">
                  <div className="input-group">
                    <label>Cabeçalho:</label>
                    <input
                      type="text"
                      className="custom-inst-input"
                      value={slideHeader}
                      onChange={(e) => setSlideHeader(e.target.value)}
                      placeholder="Empresa (ex: Marsh McLennan)"
                    />
                  </div>
                  <div className="input-group">
                    <label>Rodapé:</label>
                    <input
                      type="text"
                      className="custom-inst-input"
                      value={slideFooter}
                      onChange={(e) => setSlideFooter(e.target.value)}
                      placeholder="Confidencialidade"
                    />
                  </div>
                  <div className="input-group">
                    <label>Autor:</label>
                    <input
                      type="text"
                      className="custom-inst-input"
                      value={slideAuthor}
                      onChange={(e) => setSlideAuthor(e.target.value)}
                      placeholder="Autor (ex: Sabrina Barros)"
                    />
                  </div>
                  <div className="input-group">
                    <label>Token de Acesso:</label>
                    <input
                      type="password"
                      className="custom-inst-input"
                      value={authToken}
                      onChange={(e) => {
                        setAuthToken(e.target.value);
                        localStorage.setItem('piripres_auth_token', e.target.value);
                      }}
                      placeholder="Token de acesso (ex: piri2026@!)"
                    />
                  </div>
                </div>
                <div className="slides-count-container" style={{ marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-dark)' }}>Quantidade de Slides Target:</label>
                  <select
                    className="custom-inst-input"
                    value={targetSlides}
                    onChange={(e) => setTargetSlides(Number(e.target.value))}
                    style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'var(--color-white)', border: '1px solid #E2E8F0' }}
                  >
                    {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(n => (
                      <option key={n} value={n}>{n} Slides</option>
                    ))}
                  </select>
                </div>
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
                {!slides[currentSlideIndex].isCover && (
                  <div className="slide-header">
                    <span className="slide-brand">{slideHeader}</span>
                  </div>
                )}
                <h2 className="slide-title">{slides[currentSlideIndex].title}</h2>
                {slides[currentSlideIndex].isCover && <div className="slide-line"></div>}
                <div
                  className="slide-content"
                  dangerouslySetInnerHTML={{ __html: slides[currentSlideIndex].contentHtml }}
                />
                {!slides[currentSlideIndex].isCover ? (
                  <div className="slide-footer">
                    <span className="slide-confidential">{slideFooter}</span>
                    <span className="slide-number">{currentSlideIndex + 1}</span>
                  </div>
                ) : (
                  slideAuthor && (
                    <div className="slide-author">
                      Elaborado por: {slideAuthor}
                    </div>
                  )
                )}
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
            <button className="btn btn-accent" onClick={handleExportPPTX} disabled={exportingPptx}>{exportingPptx ? 'Exportando...' : 'Baixar PPTX'}</button>
            <button className="btn" onClick={handlePrintPDF}>Imprimir/Salvar PDF</button>
            <button className="btn" onClick={handleExportHTML}>Exportar HTML</button>
          </div>
        </main>
      )}
    </div>
    <div className="print-container">
      {slides.map((slide, index) => (
        <div key={index} className={`slide-page slide-layout ${slide.isCover ? 'cover' : 'standard'}`}>
          {!slide.isCover && (
            <div className="slide-header">
              <span className="slide-brand">{slideHeader}</span>
            </div>
          )}
          <h2 className="slide-title">{slide.title}</h2>
          {slide.isCover && <div className="slide-line"></div>}
          <div
            className="slide-content"
            dangerouslySetInnerHTML={{ __html: slide.contentHtml }}
          />
          {!slide.isCover ? (
            <div className="slide-footer">
              <span className="slide-confidential">{slideFooter}</span>
              <span className="slide-number">{index + 1}</span>
            </div>
          ) : (
            slideAuthor && (
              <div className="slide-author">
                Elaborado por: {slideAuthor}
              </div>
            )
          )}
        </div>
      ))}
    </div>
    </>
  );
}


