import { Hono } from 'hono';

type Bindings = {
  AI: {
    run: (model: string, input: unknown) => Promise<{ response?: string }>;
  };
  AI_GATEWAY_TOKEN?: string;
  AI_GATEWAY_URL?: string;
  AUTH_TOKEN?: string;
  ANTHROPIC_API_KEY?: string;
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
  // If Anthropic API Key is defined, route to Claude 3.5 Sonnet via Cloudflare AI Gateway!
  if (env.ANTHROPIC_API_KEY && env.AI_GATEWAY_URL) {
    const gatewayMatch = env.AI_GATEWAY_URL.match(/\/v1\/([^/]+)\/([^/]+)/);
    if (gatewayMatch) {
      const accountId = gatewayMatch[1];
      const gatewayId = gatewayMatch[2];
      const url = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/anthropic/v1/messages`;
      
      const systemMsg = messages.find(m => m.role === 'system')?.content || '';
      const userMsgs = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));

      try {
        const response = await fetchWithTimeout(url, {
          method: 'POST',
          headers: {
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            system: systemMsg,
            messages: userMsgs,
            max_tokens: maxTokens
          })
        }, 15000);
        
        if (response.ok) {
          const data: any = await response.json();
          const content = data?.content?.[0]?.text;
          if (content) return content;
        } else {
          console.warn(`Claude routing via AI Gateway returned status ${response.status}: ${await response.text()}`);
        }
      } catch (e) {
        console.error('Claude routing via AI Gateway failed:', e);
      }
    }
  }

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

  let result: unknown = '';
  try {
    const aiResponse = await env.AI.run(preferredModel, {
      messages: messages,
      max_tokens: maxTokens
    });
    console.log("Preferred model response type:", typeof aiResponse, "value:", JSON.stringify(aiResponse));
    result = aiResponse;
  } catch (e) {
    console.error(`Direct env.AI.run failed for preferred model (${preferredModel}):`, e);
    try {
      const aiResponse = await env.AI.run(fallbackModel, {
        messages: messages,
        max_tokens: maxTokens
      });
      console.log("Fallback model response type:", typeof aiResponse, "value:", JSON.stringify(aiResponse));
      result = aiResponse;
    } catch (err) {
      console.error(`Direct env.AI.run failed for fallback model (${fallbackModel}):`, err);
    }
  }

  // Defensively extract string content
  if (typeof result === 'string') {
    return result;
  }
  if (result && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    if (typeof obj.response === 'string') {
      return obj.response;
    }
    if (obj.result && typeof obj.result === 'object') {
      const innerResult = obj.result as Record<string, unknown>;
      if (typeof innerResult.response === 'string') {
        return innerResult.response;
      }
    }
    if (Array.isArray(obj.choices) && obj.choices.length > 0) {
      const choice = obj.choices[0] as Record<string, unknown>;
      if (choice.message && typeof choice.message === 'object') {
        const msg = choice.message as Record<string, unknown>;
        if (typeof msg.content === 'string') {
          return msg.content;
        }
      }
    }
  }
  return String(result || '');
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
  try {
    return JSON.parse(text);
  } catch (e) {
    return {
      critique: 'Não foi possível estruturar a crítica de forma automatizada.',
      improvedText: text
    };
  }
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
  try {
    return JSON.parse(text);
  } catch (e) {
    return [
      { title: 'Capa da Apresentação', type: 'cover', focus: 'Introdução e título principal da apresentação' },
      { title: 'Análise Estratégica', type: 'standard', focus: 'Detalhamento dos principais tópicos levantados' }
    ];
  }
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
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
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
    const hasSlideMarkers = /(?:^|\r?\n)Slide\s*\d+\s*[:\-]/i.test(safeText);
    const hasSeparators = safeText.includes('\n---') || safeText.includes('\r\n---');
    const isPreStructured = hasSlideMarkers || hasSeparators;
    let outline: { title: string; type: 'cover' | 'standard'; focus: string }[] = [];

    if (hasSlideMarkers) {
      // Parse using the Slide X: Regex pattern
      const regex = /(?:^|\r?\n)Slide\s*(\d+)\s*[:\-](.*?)(?=(?:\r?\n)Slide\s*\d+\s*[:\-]|$)/gis;
      const matches = [...safeText.matchAll(regex)];
      outline = matches.map((match, index) => {
        const slideNum = parseInt(match[1], 10);
        const rawContent = match[2].trim();
        const lines = rawContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        
        let title = `Slide ${slideNum}`;
        let focus = rawContent;
        
        if (lines.length > 0) {
          // The first line of rawContent is the title or title header
          const firstLine = lines[0];
          title = firstLine.replace(/^#+\s*/, '').replace(/^[*•\-]\s*/, '').trim();
          // The focus content is the rest of the text
          focus = lines.slice(1).join('\n');
        }
        
        return {
          title,
          type: index === 0 ? 'cover' as const : 'standard' as const,
          focus: `# ${title}\n${focus}`
        };
      });
    } else if (hasSeparators) {
      // Split the text by slide separator and trim parts
      const fragments = safeText.split(/\r?\n---\r?\n/).map(f => f.trim()).filter(Boolean);
      outline = fragments.map((fragment, index) => {
        const lines = fragment.split('\n').map(l => l.trim()).filter(Boolean);
        let title = `Slide ${index + 1}`;
        for (const line of lines) {
          if (line.startsWith('#')) {
            title = line.replace(/^#+\s*/, '');
            break;
          }
        }
        if (title === `Slide ${index + 1}` && lines.length > 0 && lines[0].length < 40) {
          title = lines[0];
        }
        return {
          title,
          type: index === 0 ? 'cover' as const : 'standard' as const,
          focus: fragment
        };
      });
    } else {
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
        '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
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

      const parsedOutline = parseOutline(planContent || '[]');
      if (!Array.isArray(parsedOutline) || parsedOutline.length === 0) {
        throw new Error('Falha ao planejar os slides. Outline inválido retornado pela IA.');
      }
      outline = parsedOutline.map(item => ({
        title: typeof item.title === 'string' ? item.title : 'Slide',
        type: item.type === 'cover' ? 'cover' as const : 'standard' as const,
        focus: typeof item.focus === 'string' ? item.focus : ''
      }));
    }

    // 2. Writer Agents: Generate content for each slide in parallel
    const slideTasks = outline.map(async (slide, index) => {
      let slidePrompt = '';
      if (isPreStructured) {
        // Designer mode: Transform the user's specific slide draft into a styled slide
        slidePrompt = `Gere o conteúdo final do slide de índice ${index + 1} da apresentação, atuando como um Designer e redator sênior.
Você deve formatar o rascunho de slide fornecido abaixo em HTML semântico utilizando o nosso toolkit.

Rascunho de Conteúdo para este Slide:
"""
${slide.focus}
"""

Instruções importantes:
- Baseie-se estritamente no rascunho de conteúdo fornecido. Não remova informações estratégicas e não crie tópicos adicionais que não estejam no rascunho.
- IMPORTANTE: Se o rascunho contiver no final seções gerais de texto corrido (como "Texto Consolidado do Diagnóstico", "Texto Consolidado", ou explicações finais da apresentação), ignore-as completamente e não as incorpore ao slide. Foque exclusivamente nos tópicos específicos relativos a este slide.
- Retorne o slide encapsulado na tag XML: <slide type="${slide.type}"> ... </slide>.
- Se type for "cover", crie a capa da apresentação contendo apenas o título principal em Markdown (# Título) e o subtítulo (## Subtítulo). Não use tabelas ou colunas na capa.
- Se type for "standard", comece com o título do slide (# Título do Slide) e use pelo menos uma estrutura visual do nosso HTML toolkit (grids de colunas, caixas de callout, tabelas markdown ou métricas de destaque) para organizar as informações de forma executiva.
- Certifique-se de respeitar a REGRA DE CONTRASTE: nunca use a cor Accent Teal (#00A3A6) para textos normais ou parágrafos, apenas para números gigantes de métricas (metric-val) ou elements decorativos.
- Não escreva nenhuma introdução, notas explicativas ou tags fora de <slide> e </slide>.`;
      } else {
        // Planner mode: Generate content from general user text and planned slide focus
        slidePrompt = `Gere o conteúdo para o slide de índice ${index + 1} da apresentação.
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
      }

      const systemContent = `Você é um designer de apresentações sênior (estilo McKinsey/BCG). Sua missão é transformar o plano de conteúdo fornecido em um slide executivo de altíssima fidelidade.\n\nRegras de estruturação e ACESSIBILIDADE DE COR:\n- REGRA DE CONTRASTE: Nunca use a cor Accent Teal (#00A3A6) para textos normais, descrições, tabelas ou parágrafos. O Teal possui baixo contraste sobre o fundo Warm Cream e deve ser utilizado exclusivamente para números gigantes em realces de métricas (metric-val) ou linhas horizontais decorativas. Textos normais de parágrafo ou listas devem ser escritos em cores de alto contraste.\n\nRegras do HTML toolkit a serem usadas em slides "standard":\n- Grid de duas colunas:\n  <div class="grid-2-cols">\n    <div class="card">\n      <h3>Título A</h3>\n      - Tópico 1\n      - Tópico 2\n    </div>\n    <div class="card">\n      <h3>Título B</h3>\n      - Tópico 1\n      - Tópico 2\n    </div>\n  </div>\n- Grid de três colunas:\n  <div class="grid-3-cols">\n    <div class="card">...</div>\n    <div class="card">...</div>\n    <div class="card">...</div>\n  </div>\n- Destacar números/métricas gigantes:\n  <div class="metric-highlight">\n    <div class="metric-val">94.2%</div>\n    <div class="metric-lbl">Taxa de Conversão</div>\n  </div>\n- Caixa de recomendação (Callout):\n  <div class="callout-box">Recomendação estratégica importante aqui...</div>\n- Tabelas: Use a sintaxe de tabelas markdown padrão.\n\nExemplo de saída esperada para um slide standard:\n<slide type="standard">\n# Desempenho Operacional Q2\n<div class="metric-highlight">\n  <div class="metric-val">83.5%</div>\n  <div class="metric-lbl">Sinistralidade Operacional</div>\n</div>\n<div class="grid-2-cols">\n  <div class="card">\n    <h3>Pontos de Destaque</h3>\n    - Redução de custos administrativos\n  </div>\n  <div class="card">\n    <h3>Gargalos</h3>\n    - Aumento na sinistralidade YoY\n  </div>\n</div>\n</slide>`;

      return generateCompletion(
        c.env,
        '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
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

app.post('/api/wizard/blueprint', async (c) => {
  const body = ((await c.req.json().catch(() => ({}))) || {}) as Record<string, unknown>;
  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  const audience = typeof body.audience === 'string' ? body.audience.trim() : '';
  const goal = typeof body.goal === 'string' ? body.goal.trim() : '';
  const targetSlides = typeof body.targetSlides === 'number' ? body.targetSlides : 6;

  if (!topic) {
    return c.json({ error: 'O tema da apresentação é obrigatório.' }, 400);
  }

  const prompt = `Você é um planejador estratégico sênior de apresentações corporativas no estilo McKinsey/BCG.
Análise as informações fornecidas para a apresentação:
- Tema: "${topic}"
- Público-Alvo: "${audience || 'Público corporativo geral'}"
- Objetivo Principal: "${goal || 'Apresentar com clareza e impacto'}"
- Número Planejado de Slides: ${targetSlides}

Sua tarefa é planejar a apresentação e retornar uma resposta em formato JSON válido contendo exatamente as chaves "blueprint" e "outline":
1. "blueprint": Um resumo estratégico em português (máximo de 2 parágrafos) cobrindo a mensagem-chave central, abordagem de storytelling recomendada e tom de voz ideal.
2. "outline": Um array de exatamente ${targetSlides} objetos. Cada objeto representa um slide e deve conter as seguintes chaves:
   - "title": Título sugerido para o slide (curto e executivo).
   - "type": "cover" para o primeiro slide, e "standard" para os slides seguintes.
   - "focus": Descrição resumida (foco de conteúdo) sobre qual informação deve ser abordada nesse slide específico.

Responda APENAS com o JSON válido. Não envie introduções, explicações ou notas fora do JSON.`;

  try {
    const aiContent = await generateCompletion(
      c.env,
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      '@cf/meta/llama-3.1-8b-instruct-fp8',
      [
        {
          role: 'system',
          content: 'Você é um planejador estratégico sênior especializado em estruturação de apresentações McKinsey. Você responde apenas com JSON válido.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      1500
    );

    const start = aiContent.indexOf('{');
    const end = aiContent.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      const jsonStr = aiContent.substring(start, end + 1);
      try {
        const parsed = JSON.parse(jsonStr);
        return c.json(parsed);
      } catch (e) {
        // Fallback below
      }
    }
    throw new Error('Falha ao parsear o JSON de planejamento retornado pela IA.');
  } catch (err: unknown) {
    console.error('Wizard blueprint generation failed', err);
    return c.json({ error: 'Erro ao gerar o planejamento dos slides. Por favor, tente novamente.' }, 502);
  }
});

app.post('/api/wizard/draft', async (c) => {
  const body = ((await c.req.json().catch(() => ({}))) || {}) as Record<string, unknown>;
  const outline = Array.isArray(body.outline) ? body.outline : [];
  const blueprint = typeof body.blueprint === 'string' ? body.blueprint : '';
  const topic = typeof body.topic === 'string' ? body.topic : '';
  const audience = typeof body.audience === 'string' ? body.audience : '';
  const goal = typeof body.goal === 'string' ? body.goal : '';

  if (outline.length === 0) {
    return c.json({ error: 'A estrutura de slides (outline) é necessária.' }, 400);
  }

  try {
    const draftTasks = outline.map(async (slide: any, index: number) => {
      const slidePrompt = `Aja como um redator de apresentações profissional de alto nível.
Você deve escrever o rascunho de conteúdo em tópicos (bullet points) para o slide de índice ${index + 1}.

Informações estratégicas:
- Tema: "${topic}"
- Público-Alvo: "${audience}"
- Objetivo Principal: "${goal}"
- Contexto do Planejamento: "${blueprint}"

Detalhes do Slide planejado:
- Título do Slide: "${slide.title || `Slide ${index + 1}`}"
- Tipo do Slide: "${slide.type || 'standard'}"
- Foco de Conteúdo planejado: "${slide.focus || ''}"

Sua tarefa é gerar o rascunho de texto e tópicos brutos para este slide.
Instruções:
- Se for a capa (type: "cover"), escreva apenas o Título principal e o Subtítulo complementar.
- Se for slide de conteúdo (type: "standard"), gere uma lista estruturada de 3 a 5 bullet points concisos e diretos com dados relevantes, métricas e análises executivas. Use tópicos marcados com hífen (-).
- NÃO gere tags HTML, tabelas formatadas ou layouts de design (como grids). Foque estritamente no conteúdo em texto cru (Markdown).
- Responda apenas com o texto cru do slide, sem introduções, títulos adicionais ou observações.`;

      const draftContent = await generateCompletion(
        c.env,
        '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        '@cf/meta/llama-3.1-8b-instruct-fp8',
        [
          {
            role: 'system',
            content: 'Você é um redator sênior especializado em apresentações de consultoria executiva. Você escreve apenas o conteúdo textual do slide solicitado.'
          },
          {
            role: 'user',
            content: slidePrompt
          }
        ],
        800
      );

      return {
        title: slide.title || `Slide ${index + 1}`,
        type: slide.type || 'standard',
        draft: draftContent || ''
      };
    });

    const drafts = await Promise.all(draftTasks);
    return c.json({ drafts });
  } catch (err: unknown) {
    console.error('Wizard draft generation failed', err);
    return c.json({ error: 'Erro ao gerar o rascunho dos slides. Por favor, tente novamente.' }, 502);
  }
});

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', time: new Date().toISOString() });
});

export default app;



