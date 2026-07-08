import { Hono } from 'hono';

type Bindings = {
  AI: any;
  CF_AI_GATEWAY_TOKEN?: string; // Optional custom gateway token
};

const app = new Hono<{ Bindings: Bindings }>();

app.post('/api/critique', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) || {};
  const { text = '', skills = [], customInstructions = '' } = body;
  const safeText = typeof text === 'string' ? text : '';
  const safeSkills = Array.isArray(skills) ? skills : [];
  const safeInstructions = typeof customInstructions === 'string' ? customInstructions : '';
  
  // Default prompt building based on selected skills
  let prompt = "Você é um consultor estratégico sênior. Analise criticamente o texto abaixo e forneça críticas construtivas mais uma versão melhorada.\n\n";
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
  
  prompt += `\nTexto original:\n"""\n${safeText}\n"""\n\nResponda estritamente em formato JSON com duas chaves:\n{\n  "critique": "lista de observações críticas aqui",\n  "improvedText": "texto completamente aprimorado aqui"\n}`;

  try {
    // Using Llama-3-8b-instruct or similar available on Cloudflare Workers AI
    const aiResponse = await c.env.AI.run('@cf/meta/llama-3-8b-instruct', {
      prompt: prompt,
      response_format: { type: "json_object" }
    });
    // Parse the inner JSON string from response, sanitizing markdown code blocks
    let rawResponse = aiResponse.response || '{}';
    rawResponse = rawResponse.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(rawResponse);
    return c.json({
      critique: typeof parsed.critique === 'string' ? parsed.critique : '',
      improvedText: typeof parsed.improvedText === 'string' ? parsed.improvedText : ''
    });
  } catch (err: any) {
    // Fallback response if AI binding fails (for local testing without AI local bindings)
    return c.json({
      critique: "Simulando críticas locais. Ative o binding do Workers AI para chamadas reais.",
      improvedText: safeText + "\n\n(Texto aprimorado localmente - versão mock)"
    });
  }
});

app.post('/api/generate', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) || {};
  const { text = '' } = body;
  const safeText = typeof text === 'string' ? text : '';
  
  const prompt = `Você é um designer de apresentações profissional. Converta o seguinte texto em um conjunto de slides estruturados separados estritamente por "---" (horizontal rules).\n\nCada slide deve conter:\n- Um título claro em Markdown\n- Tópicos ou tabelas apropriadas\n- Se houver comparação, formate como tabela ou em cartões separados.\n\nSiga a estrutura original de conteúdo, convertendo tudo em slides de apresentação elegantes.\n\nTexto original:\n"""\n${safeText}\n"""`;

  try {
    const aiResponse = await c.env.AI.run('@cf/meta/llama-3-8b-instruct', {
      prompt: prompt
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
