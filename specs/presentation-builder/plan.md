# SabrinaStyle AI Presentation Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fullstack web application where users write/submit raw text, critique and improve it using Cloudflare Workers AI skills, and generate/export beautiful slideshow presentations in SabrinaStyle (PDF and native PPTX formats).

**Architecture:** A unified fullstack Monorepo served by a single Cloudflare Worker. The API is powered by Hono (which routes requests to Workers AI / AI Gateway), and the frontend is an SPA built in React + Vite, styled using highly polished Vanilla CSS.

**Tech Stack:** React 19, TypeScript 5, Vite 6, Hono 4, wrangler 3 (Cloudflare CLI), PptxGenJS (PowerPoint export).

---

## Global Constraints

- **Single Project Architecture**: API routes and static frontend files served by a single Cloudflare Worker via `wrangler.json`.
- **Vanilla CSS styling**: No TailwindCSS; use highly polished, custom Vanilla CSS in `index.css` reflecting SabrinaStyle.
- **Acessibilidade de Contraste**: Garantir que as cores de texto nos slides possuam taxa mínima de contraste de 4.5:1 (Azul Escuro `#003B70` e Grafite `#1E293B` sobre fundos claros).

---

## File Structure

```text
c:\Users\resper\OneDrive\Área de Trabalho\DESENVOLVIMENTO\Apresentacoes Sabrina/
├── wrangler.json                             # Configuração da Cloudflare (Workers Assets)
├── package.json                              # Dependências do projeto fullstack
├── tsconfig.json                             # Configurações TypeScript gerais
├── vite.config.ts                            # Configuração de compilação do Vite
├── specs/presentation-builder/
│   ├── spec.md                               # Especificação de requisitos (já aprovada)
│   └── plan.md                               # Este arquivo
└── src/
    ├── index.ts                              # Entrypoint da API backend (Hono Worker)
    └── frontend/
        ├── index.html                        # Ponto de entrada HTML do app
        ├── main.tsx                          # Inicialização do React
        ├── App.tsx                           # Painel de Edição, Crítica, Slides e Ações
        ├── index.css                         # CSS SabrinaStyle (Layouts, Cores, Print CSS)
        └── services/
            ├── pptxExporter.ts               # Serviço de geração e exportação de PPTX
            └── aiService.ts                  # Requisições do frontend para a API do Hono
```

---

## Implementation Tasks

### Task 1: Project Scaffolding & Configuration

**Files:**
- Create: `package.json`
- Create: `wrangler.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src/index.ts`

**Interfaces:**
- Consumes: N/A
- Produces: Base configuration files and entry Hono worker routing to a simple status endpoint.

- [ ] **Step 1: Create package.json**
  Write package.json in the workspace root.
  ```json
  {
    "name": "sabrinastyle-builder",
    "version": "1.0.0",
    "type": "module",
    "scripts": {
      "dev": "vite",
      "build": "tsc && vite build",
      "deploy": "npm run build && wrangler deploy"
    },
    "dependencies": {
      "hono": "^4.6.0",
      "pptxgenjs": "^3.12.0",
      "react": "^19.0.0",
      "react-dom": "^19.0.0"
    },
    "devDependencies": {
      "@cloudflare/workers-types": "^4.20240903.0",
      "@types/react": "^19.0.0",
      "@types/react-dom": "^19.0.0",
      "typescript": "^5.0.0",
      "vite": "^6.0.0",
      "wrangler": "^3.78.0"
    }
  }
  ```

- [ ] **Step 2: Create wrangler.json**
  Write wrangler.json in the workspace root.
  ```json
  {
    "name": "sabrinastyle-builder",
    "main": "src/index.ts",
    "compatibility_date": "2026-07-08",
    "assets": {
      "directory": "./dist"
    },
    "observability": {
      "enabled": true
    }
  }
  ```

- [ ] **Step 3: Create tsconfig.json**
  Write tsconfig.json in the workspace root.
  ```json
  {
    "compilerOptions": {
      "target": "ESNext",
      "module": "ESNext",
      "moduleResolution": "bundler",
      "lib": ["DOM", "DOM.Iterable", "ESNext"],
      "jsx": "react-jsx",
      "allowImportingTsExtensions": true,
      "noEmit": true,
      "strict": true,
      "skipLibCheck": true,
      "isolatedModules": true
    },
    "include": ["src"]
  }
  ```

- [ ] **Step 4: Create vite.config.ts**
  Write vite.config.ts in the workspace root.
  ```typescript
  import { defineConfig } from 'vite';

  export default defineConfig({
    root: 'src/frontend',
    build: {
      outDir: '../../dist',
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      proxy: {
        '/api': 'http://localhost:8787'
      }
    }
  });
  ```

- [ ] **Step 5: Create Hono Backend Entrypoint**
  Write `src/index.ts` with a simple health endpoint.
  ```typescript
  import { Hono } from 'hono';

  const app = new Hono();

  app.get('/api/health', (c) => {
    return c.json({ status: 'ok', time: new Date().toISOString() });
  });

  export default app;
  ```

- [ ] **Step 6: Run local server to verify setup**
  Run: `npx wrangler dev` in a terminal to start the local Cloudflare Worker.
  Expected: Terminal prints local server starting at `http://localhost:8787` and `/api/health` returns status `ok`.

- [ ] **Step 7: Commit**
  Run: `git add package.json wrangler.json tsconfig.json vite.config.ts src/index.ts`
  Run: `git commit -m "feat: scaffold fullstack monorepo project and hono config"`

---

### Task 2: Cloudflare Workers AI API Endpoints

**Files:**
- Modify: `src/index.ts`

**Interfaces:**
- Consumes: Hono app routes
- Produces: POST `/api/critique` and POST `/api/generate` JSON endpoints in the worker.

- [ ] **Step 1: Implement AI Critique & Generation routes in Backend**
  Write the routing logic for Workers AI in `src/index.ts`.
  ```typescript
  import { Hono } from 'hono';

  type Bindings = {
    AI: any;
    CF_AI_GATEWAY_TOKEN?: string; // Optional custom gateway token
  };

  const app = new Hono<{ Bindings: Bindings }>();

  app.post('/api/critique', async (c) => {
    const { text, skills, customInstructions } = await c.req.json();
    
    // Default prompt building based on selected skills
    let prompt = "Você é um consultor estratégico sênior. Analise criticamente o texto abaixo e forneça críticas construtivas mais uma versão melhorada.\n\n";
    if (skills.includes('concision')) {
      prompt += "- Torne o texto conciso, direto e profissional.\n";
    }
    if (skills.includes('storytelling')) {
      prompt += "- Use narrativa envolvente e didática para reter a atenção do público.\n";
    }
    if (skills.includes('critical')) {
      prompt += "- Destaque pontos fracos, gaps de dados ou riscos estratégicos.\n";
    }
    if (customInstructions) {
      prompt += `- Siga esta instrução adicional: ${customInstructions}\n`;
    }
    
    prompt += `\nTexto original:\n"""\n${text}\n"""\n\nResponda estritamente em formato JSON com duas chaves:\n{\n  "critique": "lista de observações críticas aqui",\n  "improvedText": "texto completamente aprimorado aqui"\n}`;

    try {
      // Using Llama-3-8b-instruct or similar available on Cloudflare Workers AI
      const aiResponse = await c.env.AI.run('@cf/meta/llama-3-8b-instruct', {
        prompt: prompt,
        response_format: { type: "json_object" }
      });
      return c.json(aiResponse);
    } catch (err: any) {
      // Fallback response if AI binding fails (for local testing without AI local bindings)
      return c.json({
        critique: "Simulando críticas locais. Ative o binding do Workers AI para chamadas reais.",
        improvedText: text + "\n\n(Texto aprimorado localmente - versão mock)"
      });
    }
  });

  app.post('/api/generate', async (c) => {
    const { text } = await c.req.json();
    
    const prompt = `Você é um designer de apresentações profissional. Converta o seguinte texto em um conjunto de slides estruturados separados estritamente por "---" (horizontal rules).\n\nCada slide deve conter:\n- Um título claro em Markdown\n- Tópicos ou tabelas apropriadas\n- Se houver comparação, formate como tabela ou em cartões separados.\n\nSiga a estrutura original de conteúdo, convertendo tudo em slides de apresentação elegantes.\n\nTexto original:\n"""\n${text}\n"""`;

    try {
      const aiResponse = await c.env.AI.run('@cf/meta/llama-3-8b-instruct', {
        prompt: prompt
      });
      return c.json({ slidesMarkdown: aiResponse.response });
    } catch (err: any) {
      return c.json({
        slidesMarkdown: `# Slide 1: Introdução\n\n${text.slice(0, 100)}...\n\n---\n\n# Slide 2: Análise\n\n${text.slice(100, 300) || "Sem dados adicionais"}`
      });
    }
  });

  app.get('/api/health', (c) => {
    return c.json({ status: 'ok', time: new Date().toISOString() });
  });

  export default app;
  ```

- [ ] **Step 2: Verify compile and endpoint**
  Run: `npm run build`
  Expected: Compiles without errors.

- [ ] **Step 3: Commit**
  Run: `git add src/index.ts`
  Run: `git commit -m "feat: implement API endpoints for text critique and slide generation"`

---

### Task 3: React Frontend Base & Layout (Split Screen)

**Files:**
- Create: `src/frontend/index.html`
- Create: `src/frontend/main.tsx`
- Create: `src/frontend/App.tsx`
- Create: `src/frontend/index.css`
- Create: `src/frontend/services/aiService.ts`

**Interfaces:**
- Consumes: Backend API routes
- Produces: Split Screen UI allowing text input, skill choices, and displaying AI Critique side-by-side.

- [ ] **Step 1: Create index.html**
  Write `src/frontend/index.html`.
  ```html
  <!DOCTYPE html>
  <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>SabrinaStyle AI Presentation Builder</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet">
    </head>
    <body>
      <div id="root"></div>
      <script type="module" src="/main.tsx"></script>
    </body>
  </html>
  ```

- [ ] **Step 2: Create main.tsx**
  Write `src/frontend/main.tsx`.
  ```typescript
  import React from 'react';
  import ReactDOM from 'react-dom/client';
  import App from './App.tsx';
  import './index.css';

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  ```

- [ ] **Step 3: Create index.css with SabrinaStyle tokens**
  Write `src/frontend/index.css` with core color variables, custom layout components, and print configurations.
  ```css
  :root {
    --color-navy: #003B70;
    --color-teal: #00A3A6;
    --color-bg-light: #F8F9FA;
    --color-text-dark: #1E293B;
    --color-white: #FFFFFF;
    
    --color-semantic-red: #D12A2A;
    --color-semantic-blue: #2B6CB0;
    --color-semantic-green: #38A169;
    --color-semantic-orange: #DD6B20;
    
    --font-heading: 'Playfair Display', serif;
    --font-body: 'Inter', sans-serif;
  }

  body {
    margin: 0;
    font-family: var(--font-body);
    background-color: #F1F3F5;
    color: var(--color-text-dark);
  }

  /* Split screen layout */
  .container {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .header {
    background-color: var(--color-navy);
    color: var(--color-white);
    padding: 1rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid var(--color-teal);
  }

  .header h1 {
    margin: 0;
    font-family: var(--font-heading);
    font-weight: 600;
  }

  .workspace {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 2rem;
    overflow-y: auto;
    background-color: var(--color-white);
  }

  .panel-left {
    border-right: 1px solid #E2E8F0;
  }

  .panel-right {
    background-color: var(--color-bg-light);
  }

  textarea {
    flex: 1;
    width: 100%;
    padding: 1rem;
    border: 1px solid #CBD5E1;
    border-radius: 8px;
    font-family: var(--font-body);
    font-size: 1rem;
    resize: none;
    outline: none;
    box-sizing: border-box;
  }

  textarea:focus {
    border-color: var(--color-teal);
  }

  .controls {
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .skills-list {
    display: flex;
    gap: 1.5rem;
  }

  .skill-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-weight: 500;
  }

  .btn {
    background-color: var(--color-navy);
    color: var(--color-white);
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .btn:hover {
    background-color: #00264d;
  }

  .btn-accent {
    background-color: var(--color-teal);
  }

  .btn-accent:hover {
    background-color: #008183;
  }

  .critique-card {
    background: var(--color-white);
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    border-left: 4px solid var(--color-semantic-orange);
  }

  .critique-card h3 {
    margin-top: 0;
    font-family: var(--font-heading);
  }

  /* Print Media formatting for 16:9 widescreen PDF */
  @media print {
    body, .container, .workspace, .panel {
      margin: 0;
      padding: 0;
      height: auto;
      background-color: var(--color-white);
    }
    .header, .controls, .panel-left, .critique-card, .btn {
      display: none !important;
    }
    .slide-page {
      page-break-after: always;
      width: 100vw;
      height: 56.25vw; /* 16:9 Aspect Ratio */
      box-sizing: border-box;
      padding: 3rem;
      display: flex;
      flex-direction: column;
      justify-content: center;
      background-color: var(--color-white) !important;
      color: var(--color-text-dark) !important;
    }
    .slide-page.dark {
      background-color: var(--color-navy) !important;
      color: var(--color-white) !important;
    }
  }
  ```

- [ ] **Step 4: Create aiService.ts**
  Write `src/frontend/services/aiService.ts`.
  ```typescript
  export interface CritiqueResponse {
    critique: string;
    improvedText: string;
  }

  export interface GenerateResponse {
    slidesMarkdown: string;
  }

  export async function callCritique(
    text: string,
    skills: string[],
    customInstructions: string
  ): Promise<CritiqueResponse> {
    const res = await fetch('/api/critique', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, skills, customInstructions })
    });
    return res.json();
  }

  export async function callGenerateSlides(text: string): Promise<GenerateResponse> {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    return res.json();
  }
  ```

- [ ] **Step 5: Create basic App.tsx interface**
  Write base container in `src/frontend/App.tsx`.
  ```typescript
  import React, { useState } from 'react';
  import { callCritique, callGenerateSlides } from './services/aiService.ts';

  export default function App() {
    const [text, setText] = useState('');
    const [selectedSkills, setSelectedSkills] = useState<string[]>(['concision']);
    const [customInstructions, setCustomInstructions] = useState('');
    const [critique, setCritique] = useState('');
    const [improvedText, setImprovedText] = useState('');
    const [loading, setLoading] = useState(false);

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

    return (
      <div className="container">
        <header className="header">
          <h1>SabrinaStyle Builder</h1>
        </header>
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
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #CBD5E1' }}
              />
              <button className="btn" onClick={handleAnalyze} disabled={loading}>
                {loading ? 'Analisando...' : 'Analisar Texto'}
              </button>
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
          </main>
        </main>
      </div>
    );
  }
  ```

- [ ] **Step 6: Build and check compiler**
  Run: `npm run build`
  Expected: Vite compiles static files into `dist/` directory successfully.

- [ ] **Step 7: Commit**
  Run: `git add src/frontend/`
  Run: `git commit -m "feat: build base split-screen layout with checkboxes and api integration"`

---

### Task 4: Markdown Parser & Slide Renderer

**Files:**
- Modify: `src/frontend/App.tsx`
- Modify: `src/frontend/index.css`

**Interfaces:**
- Consumes: Improved text
- Produces: Slide array parsing by `---`, rendering standard slides, covers, tables, and scenario lists on screen in real time.

- [ ] **Step 1: Add slide parsing and styling in App.tsx**
  Add parsing logic and slideshow rendering viewport in `src/frontend/App.tsx`.
  ```typescript
  // Replace import in App.tsx to add slide rendering
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
  ```

- [ ] **Step 2: Add styles for slides inside index.css**
  Write layout classes for slideshow preview in `src/frontend/index.css`.
  ```css
  /* Add to index.css at the end of the file */

  .slideshow-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: #E2E8F0;
    padding: 2rem;
  }

  .slide-frame {
    width: 800px;
    height: 450px; /* 16:9 ratio */
    background-color: var(--color-white);
    box-shadow: 0 10px 30px rgba(0, 59, 112, 0.1);
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    box-sizing: border-box;
  }

  .slide-layout {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 3rem;
    box-sizing: border-box;
    justify-content: center;
  }

  .slide-layout.cover {
    background-color: var(--color-navy);
    color: var(--color-white);
    align-items: center;
    text-align: center;
  }

  .slide-layout.cover .slide-title {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  .slide-layout.standard {
    background-color: #FCFBF9; /* Warm Cream background */
    color: var(--color-text-dark);
  }

  .slide-layout.standard .slide-title {
    font-family: var(--font-heading);
    font-size: 2rem;
    border-bottom: 2px solid var(--color-teal);
    padding-bottom: 0.5rem;
    margin-top: 0;
  }

  .slide-content {
    font-size: 1.1rem;
    line-height: 1.6;
    margin-top: 1.5rem;
  }

  .slide-content ul {
    margin: 0;
    padding-left: 1.5rem;
  }

  .slide-content li {
    margin-bottom: 0.5rem;
  }

  .slide-line {
    width: 150px;
    height: 2px;
    background-color: var(--color-teal);
    margin: 1rem 0;
  }

  .slideshow-nav {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    margin-top: 1.5rem;
    font-weight: 500;
  }

  /* Table styling */
  .table-row {
    display: flex;
    border-bottom: 1px solid #E2E8F0;
    padding: 0.5rem 0;
  }
  .table-row:first-child {
    font-weight: 600;
    border-bottom: 2px solid var(--color-teal);
  }
  .table-cell {
    flex: 1;
    padding: 0.5rem;
  }
  ```

- [ ] **Step 3: Test build**
  Run: `npm run build`
  Expected: Successful compile.

- [ ] **Step 4: Commit**
  Run: `git add src/frontend/App.tsx src/frontend/index.css`
  Run: `git commit -m "feat: parse slides separated by --- and render standard/cover slide layouts"`

---

### Task 5: PPTX Export using PptxGenJS

**Files:**
- Create: `src/frontend/services/pptxExporter.ts`
- Modify: `src/frontend/App.tsx`

**Interfaces:**
- Consumes: Slides array data
- Produces: Downloader function creating native edit PowerPoint `.pptx` presentations mapped to SabrinaStyle colors.

- [ ] **Step 1: Implement pptxExporter.ts**
  Write the PptxGenJS script in `src/frontend/services/pptxExporter.ts`.
  ```typescript
  import pptxgen from 'pptxgenjs';

  interface SlideData {
    title: string;
    contentHtml: string;
    isCover: boolean;
  }

  export function exportToPPTX(slides: SlideData[], filename = 'Apresentacao.pptx') {
    const pptx = new pptxgen();
    
    // Configure widescreen 16:9 layout
    pptx.layout = 'LAYOUT_169';

    slides.forEach(slide => {
      const pptSlide = pptx.addSlide();

      if (slide.isCover) {
        // Navy Background (#003B70)
        pptSlide.background = { fill: '003B70' };

        // Title
        pptSlide.addText(slide.title, {
          x: 1.0,
          y: 2.0,
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
          y: 3.5,
          w: 2.0,
          h: 0.05,
          fill: { color: '00A3A6' }
        });
      } else {
        // Standard Slide: Cream background (#FCFBF9)
        pptSlide.background = { fill: 'FCFBF9' };

        // Title
        pptSlide.addText(slide.title, {
          x: 0.8,
          y: 0.5,
          w: 8.4,
          h: 0.8,
          fontSize: 24,
          bold: true,
          color: '003B70',
          fontFace: 'Georgia',
          border: { type: 'none' }
        });

        // Underline title line
        pptSlide.addShape(pptx.ShapeType.rect, {
          x: 0.8,
          y: 1.2,
          w: 8.4,
          h: 0.03,
          fill: { color: '00A3A6' }
        });

        // Extract bullets from contentHtml dynamically
        const bullets: { text: string }[] = [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(slide.contentHtml, 'text/html');
        
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
    });

    pptx.writeFile({ fileName: filename });
  }
  ```

- [ ] **Step 2: Add export action button to React App**
  Modify `src/frontend/App.tsx` to import the exporter and add a download button in the slideshow nav.
  ```typescript
  // Add import in App.tsx at top
  import { exportToPPTX } from './services/pptxExporter.ts';

  // Add inside slideshow-nav div in App.tsx:
  // <button className="btn btn-accent" onClick={() => exportToPPTX(slides)}>Baixar PPTX</button>
  ```

- [ ] **Step 3: Modify App.tsx to include the Baixar PPTX button**
  Use `replace_file_content` to make this addition in Task 5 execution.

- [ ] **Step 4: Verify compilation**
  Run: `npm run build`
  Expected: Successful compilation.

- [ ] **Step 5: Commit**
  Run: `git add src/frontend/services/pptxExporter.ts src/frontend/App.tsx`
  Run: `git commit -m "feat: integrate pptxgenjs to allow download of editable PowerPoint slides"`

---

### Task 6: Browser Print (PDF) & HTML Export

**Files:**
- Modify: `src/frontend/App.tsx`
- Modify: `src/frontend/index.css`

**Interfaces:**
- Consumes: Rendered slideshow states
- Produces: Print modal trigger button and static HTML presentation downloader.

- [ ] **Step 1: Add PDF print and HTML download functions in App.tsx**
  Add export helper functions inside App component in `src/frontend/App.tsx`.
  ```typescript
  const handlePrintPDF = () => {
    window.print();
  };

  const handleExportHTML = () => {
    // Generate clean, inline static HTML containing all slides content
    const cssContent = `
      :root {
        --color-navy: #003B70;
        --color-teal: #00A3A6;
        --color-white: #FFFFFF;
        --color-text-dark: #1E293B;
      }
      body { margin: 0; font-family: sans-serif; background: #F1F3F5; }
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
      }
      .slide.cover {
        background: var(--color-navy);
        color: var(--color-white);
        align-items: center;
        text-align: center;
      }
      .slide-title { font-size: 2.5rem; margin-top: 0; }
      .slide.standard .slide-title { border-bottom: 2px solid var(--color-teal); padding-bottom: 0.5rem; }
      .slide-line { width: 150px; height: 2px; background: var(--color-teal); margin: 1rem auto; }
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
  ```

- [ ] **Step 2: Add buttons to Nav**
  Add the PDF Print and HTML Export actions inside the slideshow controls panel in `src/frontend/App.tsx`.
  ```typescript
  // Add inside slideshow-nav div:
  // <button className="btn" onClick={handlePrintPDF}>Imprimir/Salvar PDF</button>
  // <button className="btn" onClick={handleExportHTML}>Exportar HTML</button>
  ```

- [ ] **Step 3: Modify App.tsx to include the buttons**
  Apply the changes to React file.

- [ ] **Step 4: Verify whole build**
  Run: `npm run build`
  Expected: Full monorepo bundles successfully into `dist/`.

- [ ] **Step 5: Commit**
  Run: `git add src/frontend/App.tsx src/frontend/index.css`
  Run: `git commit -m "feat: add native PDF printing and standalone HTML file download"`
