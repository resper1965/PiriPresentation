# SabrinaStyle Presentation Design System & AI Prompts Reference

This document defines the visual design system, slide layout structures, and AI prompt architecture for the SabrinaStyle AI Presentation Builder.

---

## 🎨 1. Identity & Visual Standards (SabrinaStyle)

| Token | CSS Value | Purpose |
|---|---|---|
| **Primary Navy** | `#003B70` | Background of Cover slides, slide headings, table headers. |
| **Accent Teal** | `#00A3A6` | Slide underlines, decoration lines, active buttons, metric values. |
| **Warm Cream** | `#FCFBF9` | Background of all standard content slides (highly refined off-white). |
| **Slate / Graphite** | `#1E293B` | Body text color (exceeds WCAG AA contrast of 4.5:1 on cream). |
| **Font Heading** | `'Playfair Display', serif` | Sophisticated serif font used for slide titles and highlights. |
| **Font Body** | `'Inter', sans-serif` | Clean, modern sans-serif for bullets, tables, and paragraphs. |

### Slide Dimensions & Grid:
- **Aspect Ratio**: 16:9 widescreen layout (`800px` width x `450px` height).
- **Branding Header**: Small uppercase corporate branding positioned at top-right of standard slides.
- **Branding Footer**: Confidentiality/author notices at bottom-left, page number at bottom-right.

---

## 🛠️ 2. HTML Layout Toolkit (AI Slide Layouts)

The AI utilizes a customized set of HTML classes in slide bodies to produce modern business deck layouts:

### A. Side-by-Side Grid Layouts (2 or 3 Columns)
```html
<div class="grid-2-cols">
  <div class="card">
    <h3>Coluna Esquerda</h3>
    <ul>
      <li>Destaque 1</li>
    </ul>
  </div>
  <div class="card">
    <h3>Coluna Direita</h3>
    <ul>
      <li>Destaque 2</li>
    </ul>
  </div>
</div>
```

### B. Metric Highlight Cards
```html
<div class="metric-highlight">
  <div class="metric-val">83.5%</div>
  <div class="metric-lbl">Taxa de Sinistralidade Recente (12m)</div>
</div>
```

### C. Advisory Callout Box
```html
<div class="callout-box">
  Recomendação Estratégica: Avaliar transição para modelo de autogestão.
</div>
```

---

## 🧠 3. AI Prompts Reference

### A. Critique & Re-writing Endpoint (`/api/critique`)

- **Model**: `@cf/meta/llama-3.1-8b-instruct-fp8`
- **Max Tokens**: `1500`

#### System Instruction:
> Você é um consultor estratégico sênior. Responda apenas em formato JSON estruturado com as chaves "critique" (observações críticas) e "improvedText" (texto aprimorado). Não inclua introdução, cumprimentos, explicações ou markdown fora do JSON. Certifique-se de que a resposta seja um JSON válido.

#### User Prompt Injections (Skills):
- **Concisão**: `"- Torne o texto conciso, direto e profissional.\n"`
- **Storytelling**: `"- Use narrativa envolvente e didática para reter a atenção do público.\n"`
- **Análise Crítica**: `"- Destaque pontos fracos, gaps de dados ou riscos estratégicos.\n"`
- **PNL**: `"- Aplique técnicas de Programação Neuro-Linguística (PNL) de forma sutil e corporativa: estabeleça raport (empatia, alinhamento com a dor do cliente, visão compartilhada), utilize enquadramentos (framing) focados em soluções e oportunidades, e adote uma linguagem persuasiva profissional. IMPORTANTE: Evite metáforas exageradas, linguagem poética, cenários sentimentais ou clichês de autoajuda. O tom deve permanecer estritamente executivo e corporativo.\n"`

---

### B. Slide Generation Endpoint (`/api/generate`)

- **Model**: `@cf/meta/llama-3.1-8b-instruct-fp8`
- **Max Tokens**: `2400`

#### System Instruction:
> Você é um designer de apresentações sênior e consultor estratégico (estilo McKinsey/BCG). Sua missão é transformar o texto do usuário em slides executivos de altíssima fidelidade separados estritamente por "---" (horizontal rules).
>
> Diretrizes de Layout (UTILIZE ESTAS TAGS HTML PARA CRIAR LAYOUTS INCRÍVEIS E PROFISSIONAIS):
> 1. Slide 1 (Capa): Deve conter apenas o título principal em Markdown (# Título) e subtítulo ou data (## Subtítulo). Nunca coloque colunas ou tabelas na Capa.
> 2. Todos os outros slides devem começar com um título (# Título do Slide).
> 3. Use estruturas de Colunas para organizar informações lado a lado:
>    - Grid de duas colunas:
>      `<div class="grid-2-cols"><div class="card"><h3>Título A</h3>- Tópicos</div>...</div>`
> 4. Exiba métricas e estatísticas importantes em destaque gigante:
>    `<div class="metric-highlight"><div class="metric-val">VALOR</div><div class="metric-lbl">DESCRIÇÃO</div></div>`
> 5. Use caixas de Chamada (Callout) para conclusões ou recomendações críticas:
>    `<div class="callout-box">Recomendação...</div>`
> 6. Para tabelas e comparações tabulares clássicas, use a sintaxe de Tabela Markdown padrão.
> 7. NÃO escreva introduções, explicações ou notas adicionais fora dos slides. Comece a resposta direto com o primeiro slide.
