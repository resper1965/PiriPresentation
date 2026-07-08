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
    try {
      const res = await callCritique(text, selectedSkills, customInstructions);
      setCritique(res.critique);
      setImprovedText(res.improvedText);
    } catch (err) {
      console.error(err);
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
    const parts = markdown.split(/\n---\n/);
    return parts.map(part => {
      const trimmed = part.trim();
      const lines = trimmed.split('\n');
      
      // Find title
      let title = 'Slide';
      const titleLine = lines.find(l => l.startsWith('# '));
      if (titleLine) {
        title = titleLine.replace('# ', '').trim();
      }

      // Detect layout type
      const isCover = lines.some(l => l.toLowerCase().includes('capa') || l.toLowerCase().includes('reunião')) || title === 'Slide';
      const isTable = trimmed.includes('|') && trimmed.includes('-|-');

      // Simple HTML converter for topics and tables
      let contentHtml = '';
      let insideList = false;

      lines.forEach(line => {
        if (line.startsWith('# ')) return; // Skip title line
        
        if (line.startsWith('- ') || line.startsWith('* ')) {
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
          if (line.trim().startsWith('|')) {
            // Convert simple tables to html
            const cells = line.split('|').map(c => c.trim()).filter(Boolean);
            if (cells.length > 0) {
              contentHtml += `<div class="table-row">${cells.map(c => `<div class="table-cell">${c}</div>`).join('')}</div>`;
            }
          } else if (line.trim() !== '') {
            contentHtml += `<p>${line}</p>`;
          }
        }
      });
      if (insideList) contentHtml += '</ul>';

      return { title, contentHtml, isCover, isTable };
    }).filter(s => s.contentHtml || s.title);
  };

  const handleGenerateSlides = async () => {
    setLoading(true);
    try {
      const res = await callGenerateSlides(text);
      setSlidesMarkdown(res.slidesMarkdown);
      const parsed = parseSlides(res.slidesMarkdown);
      setSlides(parsed);
      setCurrentSlideIndex(0);
      setViewMode('slides');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>SabrinaStyle Builder</h1>
        {viewMode === 'slides' && (
          <button className="btn btn-accent" onClick={() => setViewMode('edit')}>
            ← Voltar para Edição
          </button>
        )}
      </header>
      
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
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn" onClick={handleAnalyze} disabled={loading}>
                  {loading ? 'Analisando...' : 'Analisar Texto'}
                </button>
                <button className="btn btn-accent" onClick={handleGenerateSlides} disabled={loading || !text}>
                  {loading ? 'Gerando...' : 'Gerar Slides'}
                </button>
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
          </div>
        </main>
      )}
    </div>
  );
}
