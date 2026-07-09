import { Hono } from 'hono';

type Bindings = {
  AI: {
    run: (model: string, input: unknown) => Promise<{ response?: string }>;
  };
  AI_GATEWAY_TOKEN?: string;
  AI_GATEWAY_URL?: string;
};

async function generateCompletion(
  env: Bindings,
  preferredModel: string,
  fallbackModel: string,
  messages: any[],
  maxTokens: number
): Promise<string> {
  if (env.AI_GATEWAY_URL && env.AI_GATEWAY_TOKEN) {
    try {
      const response = await fetch(env.AI_GATEWAY_URL, {
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
      });
      if (response.ok) {
        const data: any = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) return content;
      }
      console.warn(`AI Gateway preferred model (${preferredModel}) failed or returned empty. Retrying with fallback (${fallbackModel})...`);
    } catch (e) {
      console.error(`AI Gateway fetch failed for preferred model:`, e);
    }

    try {
      const response = await fetch(env.AI_GATEWAY_URL, {
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
      });
      if (response.ok) {
        const data: any = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) return content;
      }
    } catch (e) {
      console.error(`AI Gateway fetch failed for fallback model:`, e);
    }
  }

  const aiResponse = await env.AI.run(fallbackModel, {
    messages: messages,
    max_tokens: maxTokens
  });
  return aiResponse.response || '';
}

const app = new Hono<{ Bindings: Bindings }>();

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
  if (safeSkills.includes('concision')) {
    prompt += "- Torne o texto conciso, direto e profissional.\n";
  }
  if (safeSkills.includes('storytelling')) {
    prompt += "- Use narrativa envolvente e didática para reter a atenção do público.\n";
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
  
  const prompt = `Gere exatamente ${targetSlides} slides separados estritamente por "---" (horizontal rules) a partir do seguinte texto.\n\nTexto original:\n"""\n${safeText}\n"""`;
  const systemContent = `Você é um designer de apresentações sênior e consultor estratégico (estilo McKinsey/BCG). Sua missão é transformar o texto do usuário em slides executivos de altíssima fidelidade.

Regras de estruturação:
1. Você DEVE gerar exatamente ${targetSlides} slides separados estritamente pela marcação "---". Nem mais, nem menos. Planeje a distribuição do texto com precisão para atingir exatamente este total.
2. Slide 1 (Capa): Deve conter apenas o título principal em Markdown (# Título) e subtítulo ou data (## Subtítulo). Nunca coloque colunas ou tabelas na Capa.
3. Todos os outros slides devem começar com um título (# Título do Slide).
4. Cada slide de conteúdo (a partir do Slide 2) DEVE conter pelo menos uma estrutura visual do nosso HTML toolkit abaixo (nunca responda apenas com blocos de texto puro ou marcadores simples):
   - Grid de duas colunas:
     <div class="grid-2-cols">
       <div class="card">
         <h3>Título da Coluna A</h3>
         - Tópico 1
         - Tópico 2
       </div>
       <div class="card">
         <h3>Título da Coluna B</h3>
         - Tópico 1
         - Tópico 2
       </div>
     </div>
   - Grid de três colunas (ex: SWOT ou pilares estratégicos):
     <div class="grid-3-cols">
       <div class="card">...</div>
       <div class="card">...</div>
       <div class="card">...</div>
     </div>
5. Destaque métricas importantes com números gigantes:
   <div class="metric-highlight">
     <div class="metric-val">83.5%</div>
     <div class="metric-lbl">Sinistralidade Recente</div>
   </div>
6. Use caixas de Chamada (Callout) para conclusões ou conselhos importantes:
   <div class="callout-box">Recomendação estratégica aqui...</div>
7. Para tabelas e comparações tabulares clássicas, use a sintaxe de Tabela Markdown padrão.
8. NÃO escreva introduções, explicações ou notas adicionais fora dos slides. Comece a resposta direto com o primeiro slide.`;

  try {
    const content = await generateCompletion(
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
          content: prompt
        }
      ],
      2400
    );
    return c.json({ slidesMarkdown: content || '' });
  } catch (err: unknown) {
    console.error('AI slide generation failed', err);
    return c.json({ error: 'Erro ao gerar slides com IA. Por favor, tente novamente.' }, 502);
  }
});

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', time: new Date().toISOString() });
});

export default app;



