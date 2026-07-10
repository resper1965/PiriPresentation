import React, { useState, useEffect } from 'react';
import { 
  callCritique, 
  callGenerateSlides, 
  callWizardBlueprint, 
  callWizardDraft 
} from './services/aiService.ts';

interface SlideData {
  title: string;
  contentHtml: string;
  isCover: boolean;
  isTable: boolean;
  isCta?: boolean;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [loginError, setLoginError] = useState('');

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
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('piripres_auth_token') || '');
  const [copied, setCopied] = useState(false);
  const [exportingPptx, setExportingPptx] = useState(false);
  const [showBranding, setShowBranding] = useState(false);
  const [aiGatewayUrl, setAiGatewayUrl] = useState(() => localStorage.getItem('piripres_ai_gateway_url') || '');
  const [aiGatewayToken, setAiGatewayToken] = useState(() => localStorage.getItem('piripres_ai_gateway_token') || '');
  const [aiGatewayModel, setAiGatewayModel] = useState(() => localStorage.getItem('piripres_ai_gateway_model') || 'claude-3-5-sonnet-20241022');
  const [anthropicApiKey, setAnthropicApiKey] = useState(() => localStorage.getItem('piripres_anthropic_api_key') || '');
  const [showAiConfig, setShowAiConfig] = useState(false);

  const handleGatewayModelChange = (val: string) => {
    setAiGatewayModel(val);
    if (val) {
      localStorage.setItem('piripres_ai_gateway_model', val);
    } else {
      localStorage.removeItem('piripres_ai_gateway_model');
    }
  };

  const handleGatewayUrlChange = (val: string) => {
    setAiGatewayUrl(val);
    if (val) {
      localStorage.setItem('piripres_ai_gateway_url', val);
    } else {
      localStorage.removeItem('piripres_ai_gateway_url');
    }
  };

  const handleGatewayTokenChange = (val: string) => {
    setAiGatewayToken(val);
    if (val) {
      localStorage.setItem('piripres_ai_gateway_token', val);
    } else {
      localStorage.removeItem('piripres_ai_gateway_token');
    }
  };

  const handleApiKeyChange = (val: string) => {
    setAnthropicApiKey(val);
    if (val) {
      localStorage.setItem('piripres_anthropic_api_key', val);
    } else {
      localStorage.removeItem('piripres_anthropic_api_key');
    }
  };

  // Wizard Mode States
  const [creatorMode, setCreatorMode] = useState<'direct' | 'wizard'>('direct');
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardTopic, setWizardTopic] = useState('');
  const [wizardAudience, setWizardAudience] = useState('');
  const [wizardGoal, setWizardGoal] = useState('');
  const [wizardTargetSlides, setWizardTargetSlides] = useState(6);
  const [wizardBlueprint, setWizardBlueprint] = useState('');
  const [wizardOutline, setWizardOutline] = useState<{ title: string; type: 'cover' | 'standard'; focus: string }[]>([]);
  const [wizardDrafts, setWizardDrafts] = useState<{ title: string; type: 'cover' | 'standard'; draft: string }[]>([]);

  useEffect(() => {
    const savedToken = localStorage.getItem('piripres_auth_token');
    if (savedToken) {
      setIsAuthenticated(true);
      setAuthToken(savedToken);
    }
  }, []);

  const handleCopyText = () => {
    if (improvedText) {
      navigator.clipboard.writeText(improvedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev => {
      if (prev.includes(skill)) {
        return prev.filter(s => s !== skill);
      } else {
        let next = [...prev, skill];
        if (skill === 'concision') {
          next = next.filter(s => s !== 'storytelling');
        } else if (skill === 'storytelling') {
          next = next.filter(s => s !== 'concision');
        }
        return next;
      }
    });
  };

  const handleAnalyzeAndGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Run Critique / Analysis
      const critiqueRes = await callCritique(text, selectedSkills, customInstructions);
      setCritique(critiqueRes.critique);
      setImprovedText(critiqueRes.improvedText);

      // Determine text to generate from (use improved version if available, otherwise original text)
      const textToGenerate = critiqueRes.improvedText && critiqueRes.improvedText.trim() 
        ? critiqueRes.improvedText 
        : text;

      // 2. Generate Slides
      const generateRes = await callGenerateSlides(textToGenerate, targetSlides);
      setSlidesMarkdown(generateRes.slidesMarkdown);
      const parsed = parseSlides(generateRes.slidesMarkdown);
      setSlides(parsed);
      setCurrentSlideIndex(0);
      setViewMode('slides');
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('Não autorizado') || errMsg.includes('token') || errMsg.includes('401')) {
        localStorage.removeItem('piripres_auth_token');
        setIsAuthenticated(false);
        setLoginError('Sessão expirada ou Token de acesso inválido.');
      } else {
        setError(errMsg);
      }
    } finally {
      setLoading(false);
    }
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
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('Não autorizado') || errMsg.includes('token') || errMsg.includes('401')) {
        localStorage.removeItem('piripres_auth_token');
        setIsAuthenticated(false);
        setLoginError('Sessão expirada ou Token de acesso inválido.');
      } else {
        setError(errMsg);
      }
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

        const originalClasses = Array.from(child.classList);
        Array.from(child.attributes).forEach(attr => child.removeAttribute(attr.name));
        const safeClasses = originalClasses.filter(className => allowedClasses.has(className));
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
        const cleanLine = line.trim();
        if (cleanLine.startsWith('# ')) return;
        if (cleanLine.startsWith('## ')) {
          if (insideTable) {
            contentHtml += '</div>';
            insideTable = false;
          }
          if (insideList) {
            contentHtml += '</ul>';
            insideList = false;
          }
          contentHtml += `<h3>${parseInlineMarkdown(cleanLine.slice(3))}</h3>`;
          return;
        }
        if (cleanLine.startsWith('- ') || cleanLine.startsWith('* ')) {
          if (insideTable) {
            contentHtml += '</div>';
            insideTable = false;
          }
          if (!insideList) {
            contentHtml += '<ul>';
            insideList = true;
          }
          contentHtml += `<li>${parseInlineMarkdown(cleanLine.slice(2))}</li>`;
        } else {
          if (insideList) {
            contentHtml += '</ul>';
            insideList = false;
          }
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
                contentHtml += `<p>${parseInlineMarkdown(cleanLine)}</p>`;
              }
            }
          }
        }
      });
      if (insideList) contentHtml += '</ul>';
      if (insideTable) contentHtml += '</div>';
      const isCta = index === parts.length - 1 && parts.length > 1;
      return { title, contentHtml: sanitizeSlideHtml(contentHtml), isCover, isTable, isCta };
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
      const isCta = type === 'cta';
      const isTable = content.includes('|') && content.includes('-|-');

      let contentHtml = '';
      let insideList = false;
      let insideTable = false;

      lines.forEach(line => {
        const cleanLine = line.trim();
        if (cleanLine.startsWith('# ')) return;
        if (cleanLine.startsWith('## ')) {
          if (insideTable) {
            contentHtml += '</div>';
            insideTable = false;
          }
          if (insideList) {
            contentHtml += '</ul>';
            insideList = false;
          }
          contentHtml += `<h3>${parseInlineMarkdown(cleanLine.slice(3))}</h3>`;
          return;
        }
        
        if (cleanLine.startsWith('- ') || cleanLine.startsWith('* ')) {
          if (insideTable) {
            contentHtml += '</div>';
            insideTable = false;
          }
          if (!insideList) {
            contentHtml += '<ul>';
            insideList = true;
          }
          contentHtml += `<li>${parseInlineMarkdown(cleanLine.slice(2))}</li>`;
        } else {
          if (insideList) {
            contentHtml += '</ul>';
            insideList = false;
          }
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
                contentHtml += `<p>${parseInlineMarkdown(cleanLine)}</p>`;
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
        isTable,
        isCta
      });
    }

    return slidesList;
  };

  const handleGenerateBlueprint = async () => {
    if (!wizardTopic.trim()) {
      setError('Por favor, informe o tema da apresentação.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await callWizardBlueprint(wizardTopic, wizardAudience, wizardGoal, wizardTargetSlides);
      setWizardBlueprint(res.blueprint);
      setWizardOutline(res.outline);
      setWizardStep(2);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDrafts = async () => {
    if (wizardOutline.length === 0) {
      setError('A estrutura de slides está vazia.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await callWizardDraft(
        wizardOutline, 
        wizardBlueprint, 
        wizardTopic, 
        wizardAudience, 
        wizardGoal
      );
      setWizardDrafts(res.drafts);
      setWizardStep(3);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeWizardSlides = async () => {
    setLoading(true);
    setError('');
    try {
      const formattedScript = wizardDrafts.map((slide, index) => {
        return `Slide ${index + 1}: ${slide.title}\n${slide.draft}`;
      }).join('\n\n---\n\n');

      setText(formattedScript);

      const res = await callGenerateSlides(formattedScript, wizardDrafts.length);
      setSlidesMarkdown(res.slidesMarkdown);
      const parsed = parseSlides(res.slidesMarkdown);
      setSlides(parsed);
      setCurrentSlideIndex(0);
      setViewMode('slides');
      setWizardStep(4);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
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
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('Não autorizado') || errMsg.includes('token') || errMsg.includes('401')) {
        localStorage.removeItem('piripres_auth_token');
        setIsAuthenticated(false);
        setLoginError('Sessão expirada ou Token de acesso inválido.');
      } else {
        setError(errMsg);
      }
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
        body { margin: 0; font-family: var(--font-body); background: #011420; }
      .slide {
        width: 100vw;
        height: 56.25vw;
        padding: 3.8rem 4rem;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: center;
        page-break-after: always;
        background: var(--color-navy);
        color: #F8FAFC;
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
      .slide.cta {
        background: var(--color-navy);
        color: var(--color-white);
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 3rem;
      }
      .slide-title { font-size: 1.85rem; margin-top: 0; font-family: var(--font-heading); color: var(--color-white); }
      .slide.cover .slide-title, .slide.cta .slide-title { font-size: 2.5rem; color: var(--color-white); border-bottom: none; }
      .slide.standard .slide-title { border-bottom: 2px solid var(--color-teal); padding-bottom: 0.4rem; }
      .slide-line { width: 120px; height: 3px; background: var(--color-teal); margin: 1.25rem auto; border-radius: 2px; }
      .slide-content { font-size: 1.12rem; line-height: 1.6; margin-top: 1rem; }
      .slide-content ul { margin: 0; padding-left: 1.5rem; }
      .slide-content li { margin-bottom: 0.5rem; }
      
      /* Layout grids and cards */
      .grid-2-cols { display: flex; gap: 1.1rem; width: 100%; margin-top: 0.75rem; }
      .grid-3-cols { display: flex; gap: 0.9rem; width: 100%; margin-top: 0.75rem; }
      .grid-2-cols > *, .grid-3-cols > * { flex: 1; min-width: 0; }
      .card { background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px; padding: 1rem; box-shadow: 0 10px 20px rgba(0,0,0,0.15); box-sizing: border-box; }
      .card h3 { margin-top: 0; margin-bottom: 0.5rem; font-family: var(--font-heading); color: var(--color-white); font-size: 1.2rem; border-bottom: 1.5px solid var(--color-teal); padding-bottom: 0.3rem; font-weight: 600; }
      .card ul { margin: 0; padding-left: 1.25rem; }
      .card li { margin-bottom: 0.4rem; font-size: 1.05rem; color: #E2E8F0; }
      .metric-highlight { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 0.8rem 1rem; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px; box-shadow: 0 10px 20px rgba(0,0,0,0.15); box-sizing: border-box; }
      .metric-highlight .metric-val { font-size: 2.6rem; font-weight: 700; color: var(--color-teal); font-family: var(--font-heading); line-height: 1; text-shadow: 0 0 12px rgba(0, 163, 166, 0.35); }
      .metric-highlight .metric-lbl { font-size: 0.95rem; color: #E2E8F0; margin-top: 0.4rem; font-weight: 600; }
      .callout-box { background: rgba(0, 163, 166, 0.08); border-left: 4px solid var(--color-teal); padding: 0.75rem 1.1rem; border-radius: 4px; font-style: italic; color: #F8FAFC; margin-bottom: 0.75rem; font-size: 1rem; }
 
      /* Tables styling */
      .table-container { margin: 1.5rem 0; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; overflow: hidden; background: rgba(255, 255, 255, 0.04); }
      .table-row { display: flex; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding: 0.5rem 0; color: #E2E8F0; }
      .table-row.header-row { font-weight: 600; background: rgba(255, 255, 255, 0.08); border-bottom: 2px solid var(--color-teal); color: var(--color-white); }
      .table-cell { flex: 1; padding: 0.5rem; }
 
      /* Header/Footer styling */
      .slide-header { position: absolute; top: 1.25rem; left: 4rem; right: 4rem; display: flex; justify-content: flex-end; font-size: 0.8rem; color: rgba(255, 255, 255, 0.45); text-transform: uppercase; font-weight: 600; }
      .slide-footer { position: absolute; bottom: 1.25rem; left: 4rem; right: 4rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: rgba(255, 255, 255, 0.45); }
      .slide-footer .slide-number { font-weight: 600; background: rgba(0, 163, 166, 0.06); color: var(--color-teal); padding: 0.2rem 0.5rem; border-radius: 4px; }
      .slide.cover .slide-author { margin-top: 1.5rem; font-size: 1rem; color: rgba(255,255,255,0.7); font-weight: 500; text-align: center; font-family: var(--font-body); letter-spacing: 0.02em; }

      @media print {
        body { background: white; }
        .slide { border: none; box-shadow: none; }
      }
    `;

    const slidesHtml = slides.map((slide, index) => `
      <div class="slide ${slide.isCover ? 'cover' : (slide.isCta ? 'cta' : 'standard')}">
        ${!(slide.isCover || slide.isCta) ? `
          <div class="slide-header">
            <span class="slide-brand">${escapeHtml(slideHeader)}</span>
          </div>
        ` : ''}
        <h2 class="slide-title">${escapeHtml(slide.title)}</h2>
        ${slide.isCover ? '<div class="slide-line"></div>' : ''}
        <div class="slide-content">${slide.contentHtml}</div>
        ${!(slide.isCover || slide.isCta) ? `
          <div class="slide-footer">
            <span class="slide-confidential">${escapeHtml(slideFooter)}</span>
            <span class="slide-number">${index + 1}</span>
          </div>
        ` : `
          ${slide.isCover && slideAuthor ? `
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
    {!isAuthenticated ? (
      <div className="login-wrapper">
        <div className="login-card">
          <div className="login-header">
            <img src="/logo.svg" alt="PiriPres Logo" className="piripres-logo-img logo-lg" />
            <h1 className="login-title">Piri<span className="text-teal">Pres</span></h1>
            <p className="login-subtitle">PiriOffice</p>
          </div>
          
          <p className="login-description">
            Criação editorial de apresentações executivas sob o padrão de excelência de consultoria de alto impacto.
          </p>

          {loginError && <div className="login-error-banner">{loginError}</div>}

          <form className="login-form" onSubmit={(e) => {
            e.preventDefault();
            if (!tokenInput.trim()) {
              setLoginError('Digite o token de acesso.');
              return;
            }
            localStorage.setItem('piripres_auth_token', tokenInput.trim());
            setAuthToken(tokenInput.trim());
            setIsAuthenticated(true);
            setLoginError('');
          }}>
            <div className="input-group" style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-dark)' }}>Token de Acesso:</label>
              <input
                type="password"
                className="custom-inst-input"
                placeholder="Digite o token de acesso..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <button type="submit" className="btn btn-accent btn-login" style={{ width: '100%', marginTop: '0.5rem' }}>
              Entrar no PiriPres
            </button>
          </form>
        </div>
      </div>
    ) : (
      <>
      <div className="container">
        <header className="header">
          <div className="header-branding">
            <div className="logo-brand-group">
              <img src="/logo.svg" alt="PiriPres Logo" className="piripres-logo-img" />
              <div className="brand-divider"></div>
              <div className="header-title-group">
                <span className="header-title-main">Piri<span className="text-teal">Pres</span></span>
                <span className="header-subtitle">PiriOffice</span>
              </div>
            </div>
            <span className={`header-badge ${aiGatewayUrl ? 'badge-claude' : ''}`}>
              {aiGatewayUrl ? 'Claude 3.5 Sonnet Active' : 'Workers AI Active'}
            </span>
          </div>
          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            {viewMode === 'slides' && (
              <button className="btn btn-accent" onClick={() => setViewMode('edit')}>
                <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 19-7-7 7-7" />
                  <path d="M19 12H5" />
                </svg>
                Voltar para Edição
              </button>
            )}
            <button 
              className="btn-logout"
              onClick={() => {
                localStorage.removeItem('piripres_auth_token');
                setIsAuthenticated(false);
                setTokenInput('');
              }}
              title="Sair do PiriPres"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Sair</span>
            </button>
          </div>
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
            <div className="mode-tabs">
              <button 
                className={`mode-tab ${creatorMode === 'direct' ? 'active' : ''}`}
                onClick={() => setCreatorMode('direct')}
              >
                Criador Direto
              </button>
              <button 
                className={`mode-tab ${creatorMode === 'wizard' ? 'active' : ''}`}
                onClick={() => setCreatorMode('wizard')}
              >
                Assistente Guiado
              </button>
            </div>

            {creatorMode === 'direct' ? (
              <>
                <h2 className="panel-title" style={{ marginTop: 0 }}>
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
                        Concisão
                      </label>
                      <label className={`skill-item ${selectedSkills.includes('storytelling') ? 'active' : ''}`}>
                        <input
                          type="checkbox"
                          checked={selectedSkills.includes('storytelling')}
                          onChange={() => toggleSkill('storytelling')}
                        />
                        Storytelling
                      </label>
                      <label className={`skill-item ${selectedSkills.includes('critical') ? 'active' : ''}`}>
                        <input
                          type="checkbox"
                          checked={selectedSkills.includes('critical')}
                          onChange={() => toggleSkill('critical')}
                        />
                        Análise Crítica
                      </label>
                      <label className={`skill-item ${selectedSkills.includes('pnl') ? 'active' : ''}`}>
                        <input
                          type="checkbox"
                          checked={selectedSkills.includes('pnl')}
                          onChange={() => toggleSkill('pnl')}
                        />
                        PNL
                      </label>
                    </div>
                    <input
                      type="text"
                      className="custom-inst-input"
                      placeholder="Instruções personalizadas adicionais (ex: 'Foco em tom corporativo')..."
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                    />
                    <div className="accordion-wrapper">
                      <button
                        type="button"
                        className="accordion-header"
                        onClick={() => setShowBranding(!showBranding)}
                      >
                        <span>Configurações dos Slides (Metadados)</span>
                        <svg
                          className={`accordion-chevron ${showBranding ? 'open' : ''}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ width: '16px', height: '16px', transition: 'transform 0.2s' }}
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>
                      {showBranding && (
                        <div className="accordion-body branding-inputs">
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
                        </div>
                      )}
                    </div>
                    
                    <div className="accordion-wrapper" style={{ marginTop: '0.75rem', marginBottom: '1.25rem' }}>
                      <button
                        type="button"
                        className="accordion-header"
                        onClick={() => setShowAiConfig(!showAiConfig)}
                      >
                        <span>Conexão IA & AI Gateway</span>
                        <svg
                          className={`accordion-chevron ${showAiConfig ? 'open' : ''}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ width: '16px', height: '16px', transition: 'transform 0.2s' }}
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>
                      {showAiConfig && (
                        <div className="accordion-body branding-inputs">
                          <div className="input-group">
                            <label>AI Gateway URL:</label>
                            <input
                              type="text"
                              className="custom-inst-input"
                              value={aiGatewayUrl}
                              onChange={(e) => handleGatewayUrlChange(e.target.value)}
                              placeholder="https://gateway.ai.cloudflare.com/v1/..."
                            />
                            <span style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '0.1rem' }}>
                              URL do AI Gateway da Cloudflare para rotear requisições.
                            </span>
                          </div>
                          <div className="input-group">
                            <label>AI Gateway Token (Opcional):</label>
                            <input
                              type="password"
                              className="custom-inst-input"
                              value={aiGatewayToken}
                              onChange={(e) => handleGatewayTokenChange(e.target.value)}
                              placeholder="Token de autorização do Gateway se ativo"
                            />
                          </div>
                          <div className="input-group">
                            <label>Modelo Anthropic (Opcional):</label>
                            <input
                              type="text"
                              className="custom-inst-input"
                              value={aiGatewayModel}
                              onChange={(e) => handleGatewayModelChange(e.target.value)}
                              placeholder="claude-3-5-sonnet-20241022"
                            />
                          </div>
                          <div className="input-group">
                            <label>Anthropic API Key (Opcional):</label>
                            <input
                              type="password"
                              className="custom-inst-input"
                              value={anthropicApiKey}
                              onChange={(e) => handleApiKeyChange(e.target.value)}
                              placeholder="Chave sk-ant-... se não gerenciada pelo Gateway"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="slides-count-container" style={{ marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-text-dark)' }}>Quantidade de Slides Target:</label>
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
                    <div className="action-buttons-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                      <button 
                        className="btn btn-accent" 
                        onClick={handleAnalyzeAndGenerate} 
                        disabled={loading || !text}
                        style={{ padding: '0.8rem 1rem', fontSize: '1rem', fontWeight: '600', width: '100%' }}
                      >
                        {loading ? 'Analisando e Criando Slides...' : 'Analisar e Criar Slides'}
                      </button>
                      
                      <div style={{ display: 'flex', gap: '0.6rem', width: '100%' }}>
                        <button 
                          className="btn" 
                          onClick={handleAnalyze} 
                          disabled={loading || !text}
                          style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
                          title="Executar apenas a análise crítica e sugestão de melhorias"
                        >
                          Apenas Analisar
                        </button>
                        <button 
                          className="btn" 
                          onClick={handleGenerateSlides} 
                          disabled={loading || !text}
                          style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
                          title="Gerar slides diretamente com o texto atual"
                        >
                          Apenas Gerar
                        </button>
                      </div>
                      
                      {slides.length > 0 && (
                        <button 
                          className="btn" 
                          onClick={() => setViewMode('slides')} 
                          disabled={loading}
                          style={{ width: '100%' }}
                        >
                          Visualizar Apresentação
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="editor-container" style={{ display: 'block', overflowY: 'auto', flex: 1, paddingRight: '0.25rem' }}>
                <div className="wizard-progress">
                  <div className={`wizard-step-node ${wizardStep === 1 ? 'active' : ''} ${wizardStep > 1 ? 'completed' : ''}`}>
                    <div className="wizard-step-circle">1</div>
                    <span className="wizard-step-label">Blueprint</span>
                  </div>
                  <div className={`wizard-step-line ${wizardStep > 1 ? 'completed' : ''}`} />
                  
                  <div className={`wizard-step-node ${wizardStep === 2 ? 'active' : ''} ${wizardStep > 2 ? 'completed' : ''}`}>
                    <div className="wizard-step-circle">2</div>
                    <span className="wizard-step-label">Estrutura</span>
                  </div>
                  <div className={`wizard-step-line ${wizardStep > 2 ? 'completed' : ''}`} />
                  
                  <div className={`wizard-step-node ${wizardStep === 3 ? 'active' : ''} ${wizardStep > 3 ? 'completed' : ''}`}>
                    <div className="wizard-step-circle">3</div>
                    <span className="wizard-step-label">Rascunhos</span>
                  </div>
                  <div className={`wizard-step-line ${wizardStep > 3 ? 'completed' : ''}`} />
                  
                  <div className={`wizard-step-node ${wizardStep === 4 ? 'active' : ''} ${wizardStep > 4 ? 'completed' : ''}`}>
                    <div className="wizard-step-circle">4</div>
                    <span className="wizard-step-label">Design</span>
                  </div>
                </div>

                {wizardStep === 1 && (
                  <div className="branding-inputs">
                    <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-navy)', marginTop: 0, marginBottom: '1rem' }}>Passo 1: Planejamento & Objetivo</h3>
                    <div className="input-group">
                      <label>Tema ou Assunto da Apresentação (Obrigatório):</label>
                      <input 
                        type="text" 
                        className="custom-inst-input" 
                        placeholder="Ex: RFP de Saúde e Odonto - SHEIN 2026"
                        value={wizardTopic}
                        onChange={(e) => setWizardTopic(e.target.value)}
                      />
                    </div>
                    <div className="input-group">
                      <label>Público-Alvo:</label>
                      <input 
                        type="text" 
                        className="custom-inst-input" 
                        placeholder="Ex: Diretoria executiva, Recursos Humanos"
                        value={wizardAudience}
                        onChange={(e) => setWizardAudience(e.target.value)}
                      />
                    </div>
                    <div className="input-group">
                      <label>Objetivo Principal da Apresentação:</label>
                      <textarea 
                        className="custom-inst-input" 
                        style={{ minHeight: '80px', resize: 'vertical' }}
                        placeholder="Ex: Demonstrar oportunidades de melhoria no plano atual e propor RFP"
                        value={wizardGoal}
                        onChange={(e) => setWizardGoal(e.target.value)}
                      />
                    </div>
                    <div className="input-group">
                      <label>Quantidade Estimada de Slides:</label>
                      <input 
                        type="number" 
                        className="custom-inst-input" 
                        value={wizardTargetSlides}
                        min="2"
                        max="20"
                        onChange={(e) => setWizardTargetSlides(parseInt(e.target.value, 10) || 6)}
                      />
                    </div>
                    
                    <div className="accordion-wrapper" style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
                      <button
                        type="button"
                        className="accordion-header"
                        onClick={() => setShowAiConfig(!showAiConfig)}
                      >
                        <span>Conexão IA & AI Gateway</span>
                        <svg
                          className={`accordion-chevron ${showAiConfig ? 'open' : ''}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ width: '16px', height: '16px', transition: 'transform 0.2s' }}
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>
                      {showAiConfig && (
                        <div className="accordion-body branding-inputs">
                          <div className="input-group">
                            <label>AI Gateway URL:</label>
                            <input
                              type="text"
                              className="custom-inst-input"
                              value={aiGatewayUrl}
                              onChange={(e) => handleGatewayUrlChange(e.target.value)}
                              placeholder="https://gateway.ai.cloudflare.com/v1/..."
                            />
                          </div>
                          <div className="input-group">
                            <label>AI Gateway Token (Opcional):</label>
                            <input
                              type="password"
                              className="custom-inst-input"
                              value={aiGatewayToken}
                              onChange={(e) => handleGatewayTokenChange(e.target.value)}
                              placeholder="Token de autorização do Gateway se ativo"
                            />
                          </div>
                          <div className="input-group">
                            <label>Modelo Anthropic (Opcional):</label>
                            <input
                              type="text"
                              className="custom-inst-input"
                              value={aiGatewayModel}
                              onChange={(e) => handleGatewayModelChange(e.target.value)}
                              placeholder="claude-3-5-sonnet-20241022"
                            />
                          </div>
                          <div className="input-group">
                            <label>Anthropic API Key (Opcional):</label>
                            <input
                              type="password"
                              className="custom-inst-input"
                              value={anthropicApiKey}
                              onChange={(e) => handleApiKeyChange(e.target.value)}
                              placeholder="Chave sk-ant-... se não gerenciada pelo Gateway"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <button 
                      className="btn btn-accent" 
                      style={{ marginTop: '1.25rem', width: '100%' }} 
                      onClick={handleGenerateBlueprint}
                      disabled={loading || !wizardTopic.trim()}
                    >
                      {loading ? 'Planejando com IA...' : 'Gerar Blueprint Estratégico'}
                    </button>
                  </div>
                )}

                {wizardStep === 2 && (
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-navy)', marginTop: 0, marginBottom: '0.8rem' }}>Passo 2: Roteiro & Fluxo</h3>
                    {wizardBlueprint && (
                      <div className="wizard-blueprint-card">
                        <h4>Diretriz Estratégica</h4>
                        <p>{wizardBlueprint}</p>
                      </div>
                    )}
                    <div className="outline-list">
                      {wizardOutline.map((slide, index) => (
                        <div key={index} className="outline-card">
                          <div className="outline-card-header">
                            <span>Slide {index + 1}</span>
                            <div className="outline-card-actions">
                              <button 
                                disabled={index === 0} 
                                onClick={() => {
                                  const nextOutline = [...wizardOutline];
                                  const temp = nextOutline[index];
                                  nextOutline[index] = nextOutline[index - 1];
                                  nextOutline[index - 1] = temp;
                                  setWizardOutline(nextOutline);
                                }}
                                title="Mover para cima"
                              >
                                ↑
                              </button>
                              <button 
                                disabled={index === wizardOutline.length - 1}
                                onClick={() => {
                                  const nextOutline = [...wizardOutline];
                                  const temp = nextOutline[index];
                                  nextOutline[index] = nextOutline[index + 1];
                                  nextOutline[index + 1] = temp;
                                  setWizardOutline(nextOutline);
                                }}
                                title="Mover para baixo"
                              >
                                ↓
                              </button>
                              <button 
                                className="btn-delete"
                                onClick={() => {
                                  setWizardOutline(wizardOutline.filter((_, i) => i !== index));
                                }}
                                title="Excluir slide"
                              >
                                &times;
                              </button>
                            </div>
                          </div>
                          <div className="outline-card-body">
                            <div className="input-row">
                              <div className="input-group-title">
                                <input 
                                  type="text" 
                                  className="custom-inst-input" 
                                  placeholder="Título do Slide"
                                  value={slide.title}
                                  onChange={(e) => {
                                    const nextOutline = [...wizardOutline];
                                    nextOutline[index].title = e.target.value;
                                    setWizardOutline(nextOutline);
                                  }}
                                />
                              </div>
                              <div className="input-group-type">
                                <select 
                                  className="custom-inst-input"
                                  value={slide.type}
                                  onChange={(e) => {
                                    const nextOutline = [...wizardOutline];
                                    nextOutline[index].type = e.target.value as 'cover' | 'standard';
                                    setWizardOutline(nextOutline);
                                  }}
                                >
                                  <option value="standard">Conteúdo</option>
                                  <option value="cover">Capa</option>
                                </select>
                              </div>
                            </div>
                            <textarea 
                              className="custom-inst-input" 
                              style={{ minHeight: '60px', fontSize: '0.85rem' }}
                              placeholder="Foco de Conteúdo (ex: 'Diagnóstico de reajuste estimado em 20.6%')"
                              value={slide.focus}
                              onChange={(e) => {
                                      const nextOutline = [...wizardOutline];
                                      nextOutline[index].focus = e.target.value;
                                      setWizardOutline(nextOutline);
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <button 
                      className="btn btn-secondary" 
                      style={{ width: '100%', marginBottom: '1.25rem' }}
                      onClick={() => setWizardOutline([...wizardOutline, { title: 'Novo Slide', type: 'standard', focus: '' }])}
                    >
                      + Adicionar Slide
                    </button>
                    <div style={{ display: 'flex', gap: '0.8rem' }}>
                      <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setWizardStep(1)}>
                        Voltar
                      </button>
                      <button className="btn btn-accent" style={{ flex: 2 }} onClick={handleGenerateDrafts} disabled={loading || wizardOutline.length === 0}>
                        {loading ? 'Escrevendo...' : 'Gerar Rascunhos'}
                      </button>
                    </div>
                  </div>
                )}

                {wizardStep === 3 && (
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-navy)', marginTop: 0, marginBottom: '1rem' }}>Passo 3: Edição de Rascunhos</h3>
                    <div className="outline-list">
                      {wizardDrafts.map((slide, index) => (
                        <div key={index} className="draft-editor-card">
                          <div className="draft-editor-card-header">
                            <h4>Slide {index + 1}: {slide.title}</h4>
                            <span>{slide.type === 'cover' ? 'Capa' : 'Conteúdo'}</span>
                          </div>
                          <textarea 
                            className="draft-editor-textarea"
                            value={slide.draft}
                            onChange={(e) => {
                              const nextDrafts = [...wizardDrafts];
                              nextDrafts[index].draft = e.target.value;
                              setWizardDrafts(nextDrafts);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1.25rem' }}>
                      <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setWizardStep(2)}>
                        Voltar
                      </button>
                      <button className="btn btn-accent" style={{ flex: 2 }} onClick={handleFinalizeWizardSlides} disabled={loading || wizardDrafts.length === 0}>
                        {loading ? 'Formatando...' : 'Finalizar Slides'}
                      </button>
                    </div>
                  </div>
                )}

                {wizardStep === 4 && (
                  <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
                    <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-navy)', marginTop: 0 }}>Apresentação Gerada!</h3>
                    <p style={{ color: '#64748B', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '2rem' }}>
                      Seus slides foram gerados com o tema Dark Navy Premium e estão prontos para visualização.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                      <button className="btn btn-accent" onClick={() => setViewMode('slides')}>
                        Visualizar Apresentação
                      </button>
                      <button className="btn btn-secondary" onClick={() => setWizardStep(3)}>
                        Voltar para Rascunhos
                      </button>
                      <button className="btn btn-secondary" onClick={() => {
                        setWizardStep(1);
                        setWizardTopic('');
                        setWizardAudience('');
                        setWizardGoal('');
                        setWizardOutline([]);
                        setWizardDrafts([]);
                      }}>
                        Criar Nova Apresentação
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
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
              <div className={`slide-layout ${slides[currentSlideIndex].isCover ? 'cover' : (slides[currentSlideIndex].isCta ? 'cta' : 'standard')}`}>
                {!(slides[currentSlideIndex].isCover || slides[currentSlideIndex].isCta) && (
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
                {!(slides[currentSlideIndex].isCover || slides[currentSlideIndex].isCta) ? (
                  <div className="slide-footer">
                    <span className="slide-confidential">{slideFooter}</span>
                    <span className="slide-number">{currentSlideIndex + 1}</span>
                  </div>
                ) : (
                  slides[currentSlideIndex].isCover && slideAuthor && (
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
        <div key={index} className={`slide-page slide-layout ${slide.isCover ? 'cover' : (slide.isCta ? 'cta' : 'standard')}`}>
          {!(slide.isCover || slide.isCta) && (
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
          {!(slide.isCover || slide.isCta) ? (
            <div className="slide-footer">
              <span className="slide-confidential">{slideFooter}</span>
              <span className="slide-number">{index + 1}</span>
            </div>
          ) : (
            slide.isCover && slideAuthor && (
              <div className="slide-author">
                Elaborado por: {slideAuthor}
              </div>
            )
          )}
        </div>
      ))}
    </div>
    </>
    )}
    </>
  );
}


