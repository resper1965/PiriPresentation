import React, { useState } from 'react';
import { callCritique, callGenerateSlides } from './services/aiService.ts';

export default function App() {
  const [text, setText] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>(['concision']);
  const [customInstructions, setCustomInstructions] = useState('');
  const [critique, setCritique] = useState('');
  const [improvedText, setImprovedText] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const res = await callCritique(text, selectedSkills, customInstructions);
      setCritique(res.critique);
      setImprovedText(res.improvedText);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyImprovements = () => {
    if (improvedText) {
      setText(improvedText);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>SabrinaStyle Builder</h1>
      </header>
      <main className="workspace">
        <section className="panel panel-left">
          <textarea
            placeholder="Digite seu rascunho de apresentação..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="controls">
            <div className="skills-list">
              <label className="skill-item">
                <input
                  type="checkbox"
                  checked={selectedSkills.includes('concision')}
                  onChange={() => toggleSkill('concision')}
                />
                Concisão
              </label>
              <label className="skill-item">
                <input
                  type="checkbox"
                  checked={selectedSkills.includes('storytelling')}
                  onChange={() => toggleSkill('storytelling')}
                />
                Storytelling
              </label>
              <label className="skill-item">
                <input
                  type="checkbox"
                  checked={selectedSkills.includes('critical')}
                  onChange={() => toggleSkill('critical')}
                />
                Análise Crítica
              </label>
            </div>
            <input
              type="text"
              placeholder="Instruções personalizadas adicionais..."
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #CBD5E1' }}
            />
            <button className="btn" onClick={handleAnalyze} disabled={loading}>
              {loading ? 'Analisando...' : 'Analisar Texto'}
            </button>
          </div>
        </section>

        <section className="panel panel-right">
          {critique && (
            <div className="critique-card">
              <h3>Observações Críticas</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{critique}</p>
            </div>
          )}
          {improvedText && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <h3>Texto Aprimorado</h3>
              <textarea readOnly value={improvedText} style={{ backgroundColor: '#F8FAFC' }} />
              <button
                className="btn btn-accent"
                onClick={handleApplyImprovements}
                style={{ marginTop: '1rem' }}
              >
                Aplicar Melhorias
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
