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
  
  const prompt = `Converta o seguinte texto em um conjunto de slides estruturados separados estritamente por "---" (horizontal rules).\n\nCada slide deve conter:\n- Um título claro em Markdown\n- Tópicos ou tabelas apropriadas\n- Se houver comparação, formate como tabela ou em cartões separados.\n\nSiga a estrutura original de conteúdo, convertendo tudo em slides de apresentação elegantes.\n\nTexto original:\n"""\n${safeText}\n"""`;

  try {
    const aiResponse = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
      messages: [
        {
          role: 'system',
          content: 'Você é um designer de apresentações profissional. Converta o texto fornecido pelo usuário em slides separados estritamente por "---" (horizontal rules). Cada slide deve ter um título em Markdown e tópicos ou tabelas.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1800
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
