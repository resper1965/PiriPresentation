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
