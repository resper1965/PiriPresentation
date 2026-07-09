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

const getAuthToken = (): string => {
  return localStorage.getItem('piripres_auth_token') || 'piri2026@!';
};

export async function callCritique(
  text: string,
  skills: string[],
  customInstructions: string
): Promise<CritiqueResponse> {
  const res = await fetch('/api/critique', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({ text, skills, customInstructions })
  });
  return readJsonResponse<CritiqueResponse>(res);
}

export async function callGenerateSlides(text: string, targetSlides: number): Promise<GenerateResponse> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({ text, targetSlides })
  });
  return readJsonResponse<GenerateResponse>(res);
}

export interface WizardBlueprintResponse {
  blueprint: string;
  outline: { title: string; type: 'cover' | 'standard'; focus: string }[];
}

export interface WizardDraftResponse {
  drafts: { title: string; type: 'cover' | 'standard'; draft: string }[];
}

export async function callWizardBlueprint(
  topic: string,
  audience: string,
  goal: string,
  targetSlides: number
): Promise<WizardBlueprintResponse> {
  const res = await fetch('/api/wizard/blueprint', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({ topic, audience, goal, targetSlides })
  });
  return readJsonResponse<WizardBlueprintResponse>(res);
}

export async function callWizardDraft(
  outline: { title: string; type: 'cover' | 'standard'; focus: string }[],
  blueprint: string,
  topic: string,
  audience: string,
  goal: string
): Promise<WizardDraftResponse> {
  const res = await fetch('/api/wizard/draft', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({ outline, blueprint, topic, audience, goal })
  });
  return readJsonResponse<WizardDraftResponse>(res);
}
