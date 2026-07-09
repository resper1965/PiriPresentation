import { Hono } from 'hono';

type Bindings = {
  AI: {
    run: (model: string, input: unknown) => Promise<{ response?: string }>;
  };
  AI_GATEWAY_TOKEN?: string;
  AI_GATEWAY_URL?: string;
  AUTH_TOKEN?: string;
};

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function generateCompletion(
  env: Bindings,
  preferredModel: string,
  fallbackModel: string,
  messages: any[],
  maxTokens: number
): Promise<string> {
  if (env.AI_GATEWAY_URL && env.AI_GATEWAY_TOKEN) {
    try {
      const response = await fetchWithTimeout(env.AI_GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.AI_GATEWAY_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: preferredModel,
          messages: messages,
          max_tokens: maxTokens
        })
      }, 12000);
      if (response.ok) {
        const data: any = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) return content;
      }
      console.warn(`AI Gateway preferred model (${preferredModel}) failed or returned empty. Retrying with fallback (${fallbackModel})...`);
    } catch (e) {
      console.error(`AI Gateway fetch failed or timed out for preferred model:`, e);
    }

    try {
      const response = await fetchWithTimeout(env.AI_GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.AI_GATEWAY_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: fallbackModel,
          messages: messages,
          max_tokens: maxTokens
        })
      }, 15000);
      if (response.ok) {
        const data: any = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) return content;
      }
    } catch (e) {
      console.error(`AI Gateway fetch failed or timed out for fallback model:`, e);
    }
  }

  const aiResponse = await env.AI.run(fallbackModel, {
    messages: messages,
    max_tokens: maxTokens
  });
  return aiResponse.response || '';
}

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('X-XSS-Protection', '1; mode=block');
  
  if (c.req.path.startsWith('/api/')) {
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    c.header('Pragma', 'no-cache');
    c.header('Expires', '0');
  }
});

app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/health') {
    return next();
  }
  const expectedToken = c.env.AUTH_TOKEN || 'piri2026@!';
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Não autorizado. Token de acesso ausente ou inválido.' }, 401);
  }
  const token = authHeader.substring(7);
  if (token !== expectedToken) {
    return c.json({ error: 'Não autorizado. Token de acesso inválido.' }, 401);
  }
  await next();
});

const MAX_TEXT_LENGTH = 20000;
const MAX_CUSTOM_INSTRUCTIONS_LENGTH = 1000;
const ALLOWED_SKILLS = new Set(['concision', 'storytelling', 'critical', 'pnl']);

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function validateText(value: unknown): { text: string; error?: string } {
  const text = normalizeText(value);
  if (!text) return { text, error: 'Informe um texto para continuar.' };
  if (text.length > MAX_TEXT_LENGTH) return { text, error: `O texto excede o limite de ${MAX_TEXT_LENGTH} caracteres.` };
  return { text };
}

function normalizeSkills(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((skill): skill is string => typeof skill === 'string' && ALLOWED_SKILLS.has(skill))
    : [];
}

function safeJsonParse(text: string): { critique?: unknown; improvedText?: unknown } {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    const jsonStr = text.substring(start, end + 1);
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      // Fallback
    }
  }
  return JSON.parse(text);
}

interface SlideOutlineItem {
  title: string;
  type: 'cover' | 'standard';
  focus: string;
}

function parseOutline(text: string): SlideOutlineItem[] {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    const jsonStr = text.substring(start, end + 1);
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      // Fallback
    }
  }
  return JSON.parse(text);
}

app.post('/api/critique', async (c) => {
  const body = ((await c.req.json().catch(() => ({}))) || {}) as Record<string, unknown>;
  const { text: safeText, error } = validateText(body.text);
  if (error) return c.json({ error }, 400);
  const safeSkills = normalizeSkills(body.skills);
  const safeInstructions = normalizeText(body.customInstructions);
  if (safeInstructions.length > MAX_CUSTOM_INSTRUCTIONS_LENGTH) {
    return c.json({ error: `As instruções adicionais excedem o limite de ${MAX_CUSTOM_INSTRUCTIONS_LENGTH} caracteres.` }, 400);
  }
  
  // Default prompt building based on selected skills
  let prompt = "Analise criticamente o texto abaixo e forneça críticas construtivas mais uma versão melhorada.\n\n";
  const hasConcision = safeSkills.includes('concision');
  const hasStorytelling = safeSkills.includes('storytelling');

  if (hasConcision && hasStorytelling) {
    prompt += "- Nota de Harmonização: O usuário selecionou Concisão e Storytelling simultaneamente. Você deve encurtar o texto cortando redundâncias e mantendo-o enxuto (foco na concisão), mas utilizar verbos ativos de forte impacto e uma estrutura de enredo fluida para capturar o leitor (foco no storytelling).\n";
  } else {
    if (hasConcision) {
      prompt += "- Torne o texto conciso, direto e profissional.\n";
    }
    if (hasStorytelling) {
      prompt += "- Use narrativa envolvente e didática para reter a atenção do público.\n";
    }
  }
  if (safeSkills.includes('critical')) {
    prompt += "- Destaque pontos fracos, gaps de dados ou riscos estratégicos.\n";
  }
  if (safeSkills.includes('pnl')) {
    prompt += "- Aplique técnicas de Programação Neuro-Linguística (PNL) de forma sutil e corporativa: estabeleça raport (empatia, alinhamento com a dor do cliente, visão compartilhada), utilize enquadramentos (framing) focados em soluções e oportunidades, e adote uma linguagem persuasiva profissional. IMPORTANTE: Evite metáforas exageradas, linguagem poética, cenários sentimentais ou clichês de autoajuda. O tom deve permanecer estritamente executivo e corporativo.\n";
  }
  if (safeInstructions) {
    prompt += `- Siga esta instrução adicional: ${safeInstructions}\n`;
  }
  
  prompt += `\nTexto original:\n"""\n${safeText}\n"""\n\nResponda em formato JSON com duas chaves. Importante: Todas as quebras de linha dentro das strings do JSON devem ser escapadas como \\n (barra invertida seguida de n). Não envie quebras de linha reais dentro dos valores das strings. Exemplo de formato:\n{\n  "critique": "Observação 1\\nObservação 2",\n  "improvedText": "Texto aprimorado aqui"\n}`;

  try {
    const content = await generateCompletion(
      c.env,
      '@cf/meta/llama-3.1-70b-instruct',
      '@cf/meta/llama-3.1-8b-instruct-fp8',
      [
        {
          role: 'system',
          content: 'Você é um consultor estratégico sênior. Responda apenas em formato JSON estruturado com as chaves "critique" (observações críticas) e "improvedText" (texto aprimorado). Não inclua introdução, cumprimentos, explicações ou markdown fora do JSON. Certifique-se de que a resposta seja um JSON válido.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      1500
    );
    // Parse the inner JSON string from response using safe parsing
    const parsed = safeJsonParse(content || '{}');
    return c.json({
      critique: typeof parsed.critique === 'string' ? parsed.critique : '',
      improvedText: typeof parsed.improvedText === 'string' ? parsed.improvedText : ''
    });
  } catch (err: unknown) {
    console.error('AI critique failed', err);
    return c.json({ error: 'Erro na chamada da IA de produção. Por favor, tente novamente.' }, 502);
  }
});

app.post('/api/generate', async (c) => {
  const body = ((await c.req.json().catch(() => ({}))) || {}) as Record<string, unknown>;
  const { text: safeText, error } = validateText(body.text);
  if (error) return c.json({ error }, 400);

  const targetSlides = typeof body.targetSlides === 'number' ? body.targetSlides : 6;

  try {
    // 1. Planner Agent: Plan slide titles, types, and focus descriptions in JSON format
    const planPrompt = `Você é um planejador de apresentações sênior. Sua tarefa é analisar o texto de entrada na tag <user_text> e dividi-lo em um plano estratégico de exatamente ${targetSlides} slides.
Retorne APENAS um array JSON contendo objetos com as chaves:
- "title": o título do slide (em português)
- "type": "cover" para o primeiro slide, e "standard" para os slides seguintes
- "focus": descrição resumida do foco de conteúdo a ser abordado nesse slide específico.

Não inclua explicações, introdução ou notas fora do JSON. Responda apenas com o JSON bruto.

<user_text>
${safeText}
</user_text>`;

    const planContent = await generateCompletion(
      c.env,
      '@cf/meta/llama-3.1-70b-instruct',
      '@cf/meta/llama-3.1-8b-instruct-fp8',
      [
        {
          role: 'system',
          content: 'Você é um planejador de apresentações sênior especializado em estruturação McKinsey/BCG. Você deve responder apenas com um array JSON válido contendo exatamente o número planejado de slides.'
        },
        {
          role: 'user',
          content: planPrompt
        }
      ],
      1500
    );

    const outline = parseOutline(planContent || '[]');
    if (!Array.isArray(outline) || outline.length === 0) {
      throw new Error('Falha ao planejar os slides. Outline inválido retornado pela IA.');
    }

    // 2. Writer Agents: Generate content for each slide in parallel
    const slideTasks = outline.map(async (slide, index) => {
      const slidePrompt = `Gere o conteúdo para o slide de índice ${index + 1} da apresentação.
Título do Slide: "${slide.title}"
Tipo do Slide: "${slide.type}"
Foco do Slide: "${slide.focus}"

Instruções importantes:
- Baseie-se estritamente nas informações relevantes do texto de origem em <user_text>.
- Retorne o slide encapsulado na tag XML: <slide type="${slide.type}"> ... </slide>.
- Se type for "cover", crie a capa da apresentação contendo apenas o título principal em Markdown (# Título) e o subtítulo (## Subtítulo). Não use tabelas ou colunas na capa.
- Se type for "standard", comece com o título do slide (# Título do Slide) e use pelo menos uma estrutura visual do nosso HTML toolkit (grids de colunas, caixas de callout, tabelas markdown ou métricas de destaque).
- Não escreva nenhuma introdução, notas explicativas ou tags fora de <slide> e </slide>.

<user_text>
${safeText}
</user_text>`;

      const systemContent = `Você é um designer de apresentações sênior (estilo McKinsey/BCG). Sua missão é transformar o plano de conteúdo fornecido em um slide executivo de altíssima fidelidade.\n\nRegras de estruturação e ACESSIBILIDADE DE COR:\n- REGRA DE CONTRASTE: Nunca use a cor Accent Teal (#00A3A6) para textos normais, descrições, tabelas ou parágrafos. O Teal possui baixo contraste sobre o fundo Warm Cream e deve ser utilizado exclusivamente para números gigantes em realces de métricas (metric-val) ou linhas horizontais decorativas. Textos normais de parágrafo ou listas devem ser escritos em cores de alto contraste.\n\nRegras do HTML toolkit a serem usadas em slides "standard":\n- Grid de duas colunas:\n  <div class="grid-2-cols">\n    <div class="card">\n      <h3>Título A</h3>\n      - Tópico 1\n      - Tópico 2\n    </div>\n    <div class="card">\n      <h3>Título B</h3>\n      - Tópico 1\n      - Tópico 2\n    </div>\n  </div>\n- Grid de três colunas:\n  <div class="grid-3-cols">\n    <div class="card">...</div>\n    <div class="card">...</div>\n    <div class="card">...</div>\n  </div>\n- Destacar números/métricas gigantes:\n  <div class="metric-highlight">\n    <div class="metric-val">94.2%</div>\n    <div class="metric-lbl">Taxa de Conversão</div>\n  </div>\n- Caixa de recomendação (Callout):\n  <div class="callout-box">Recomendação estratégica importante aqui...</div>\n- Tabelas: Use a sintaxe de tabelas markdown padrão.\n\nExemplo de saída esperada para um slide standard:\n<slide type="standard">\n# Desempenho Operacional Q2\n<div class="metric-highlight">\n  <div class="metric-val">83.5%</div>\n  <div class="metric-lbl">Sinistralidade Operacional</div>\n</div>\n<div class="grid-2-cols">\n  <div class="card">\n    <h3>Pontos de Destaque</h3>\n    - Redução de custos administrativos\n  </div>\n  <div class="card">\n    <h3>Gargalos</h3>\n    - Aumento na sinistralidade YoY\n  </div>\n</div>\n</slide>`;

      return generateCompletion(
        c.env,
        '@cf/meta/llama-3.1-70b-instruct',
        '@cf/meta/llama-3.1-8b-instruct-fp8',
        [
          {
            role: 'system',
            content: systemContent
          },
          {
            role: 'user',
            content: slidePrompt
          }
        ],
        1200
      );
    });

    const slidesResults = await Promise.all(slideTasks);
    const combinedMarkdown = slidesResults.filter(Boolean).join('\n\n');
    return c.json({ slidesMarkdown: combinedMarkdown });
  } catch (err: unknown) {
    console.error('AI multi-agent slide generation failed', err);
    return c.json({ error: 'Erro ao gerar slides com o pipeline de agentes. Por favor, tente novamente.' }, 502);
  }
});

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', time: new Date().toISOString() });
});

export default app;



