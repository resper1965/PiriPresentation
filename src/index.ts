import { Hono } from 'hono';

type Bindings = {
  AI: any;
  CF_AI_GATEWAY_TOKEN?: string; // Optional custom gateway token
};

const app = new Hono<{ Bindings: Bindings }>();

function safeJsonParse(text: string): any {
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
  const body = (await c.req.json().catch(() => ({}))) || {};
  const { text = '', skills = [], customInstructions = '' } = body;
  const safeText = typeof text === 'string' ? text : '';
  const safeSkills = Array.isArray(skills) ? skills : [];
  const safeInstructions = typeof customInstructions === 'string' ? customInstructions : '';
  
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

  let aiResponse: any = null;
  try {
    // Using Llama 3.1 8B Instruct FP8 on Cloudflare Workers AI with system instruction and token override
    aiResponse = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
      messages: [
        {
          role: 'system',
          content: 'Você é um consultor estratégico sênior. Responda apenas em formato JSON estruturado com as chaves "critique" (observações críticas) e "improvedText" (texto aprimorado). Não inclua introdução, cumprimentos, explicações ou markdown fora do JSON. Certifique-se de que a resposta seja um JSON válido.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1500
    });
    // Parse the inner JSON string from response using safe parsing
    const parsed = safeJsonParse(aiResponse.response || '{}');
    return c.json({
      critique: typeof parsed.critique === 'string' ? parsed.critique : '',
      improvedText: typeof parsed.improvedText === 'string' ? parsed.improvedText : ''
    });
  } catch (err: any) {
    // Fallback response if AI binding fails
    return c.json({
      critique: "Erro na chamada da IA de produção. Por favor, tente novamente.",
      improvedText: safeText + "\n\n(Texto aprimorado localmente - versão mock)"
    });
  }
});

app.post('/api/generate', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) || {};
  const { text = '' } = body;
  const safeText = typeof text === 'string' ? text : '';
  
  const prompt = `Converta o seguinte texto em um conjunto de slides estruturados separados estritamente por "---" (horizontal rules).\n\nTexto original:\n"""\n${safeText}\n"""`;

  try {
    const aiResponse = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
      messages: [
        {
          role: 'system',
          content: 'Você é um designer de apresentações sênior e consultor estratégico (estilo McKinsey/BCG). Sua missão é transformar o texto do usuário em slides executivos de altíssima fidelidade separados estritamente por "---" (horizontal rules).\n\nDiretrizes de Layout (UTILIZE ESTAS TAGS HTML PARA CRIAR LAYOUTS INCRÍVEIS E PROFISSIONAIS):\n1. Slide 1 (Capa): Deve conter apenas o título principal em Markdown (# Título) e subtítulo ou data (## Subtítulo). Nunca coloque colunas ou tabelas na Capa.\n2. Todos os outros slides devem começar com um título (# Título do Slide).\n3. Use estruturas de Colunas para organizar informações lado a lado:\n   - Grid de duas colunas:\n     <div class="grid-2-cols">\n       <div class="card">\n         <h3>Título da Coluna A</h3>\n         - Tópico 1\n         - Tópico 2\n       </div>\n       <div class="card">\n         <h3>Título da Coluna B</h3>\n         - Tópico 1\n         - Tópico 2\n       </div>\n     </div>\n   - Grid de três colunas (ex: SWOT ou pilares estratégicos):\n     <div class="grid-3-cols">\n       <div class="card">...</div>\n       <div class="card">...</div>\n       <div class="card">...</div>\n     </div>\n4. Exiba métricas e estatísticas importantes em destaque gigante:\n   <div class="metric-highlight">\n     <div class="metric-val">83.5%</div>\n     <div class="metric-lbl">Sinistralidade Recente</div>\n   </div>\n5. Use caixas de Chamada (Callout) para conclusões importantes ou recomendações críticas:\n   <div class="callout-box">Recomendação: Avaliar a migração para autogestão se a sinistralidade persistir acima de 80%.</div>\n6. Para tabelas e comparações tabulares clássicas, use a sintaxe de Tabela Markdown padrão.\n7. NÃO escreva introduções, explicações ou notas adicionais fora dos slides. Comece a resposta direto com o primeiro slide.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 2400
    });
    return c.json({ slidesMarkdown: aiResponse.response });
  } catch (err: any) {
    return c.json({
      slidesMarkdown: `# Slide 1: Introdução\n\n${safeText.slice(0, 100)}...\n\n---\n\n# Slide 2: Análise\n\n${safeText.slice(100, 300) || "Sem dados adicionais"}`
    });
  }
});

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', time: new Date().toISOString() });
});

export default app;
