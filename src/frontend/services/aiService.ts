export interface CritiqueResponse {
  critique: string;
  improvedText: string;
}

export interface GenerateResponse {
  slidesMarkdown: string;
}

type ApiErrorResponse = {
  error?: string;
};

async function readJsonResponse<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as ApiErrorResponse | T;
  if (!res.ok) {
    throw new Error((data as ApiErrorResponse).error || 'Erro na comunicação com a API.');
  }
  return data as T;
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
  return readJsonResponse<CritiqueResponse>(res);
}

export async function callGenerateSlides(text: string): Promise<GenerateResponse> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  return readJsonResponse<GenerateResponse>(res);
}
