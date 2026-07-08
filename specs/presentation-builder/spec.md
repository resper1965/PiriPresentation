# Feature Specification: SabrinaStyle AI Presentation Builder

**Feature Branch**: `feature/sabrinastyle-builder`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User request: "quero escrever um app que ao subir um md, a aplicacao le, melhora a escrita com prompts e skills que definermos, e depois aplicará o design, gerará um html que pode virar um ppt pdf. Incluir exportação para PPTX nativo."

---

## 👥 User Scenarios & Testing

### User Story 1 - Submissão de Texto e Crítica de IA (Priority: P1)
Como usuária (Sabrina), desejo colar um texto rascunhado no aplicativo, selecionar regras específicas de "skills" (ex: Concisão, Storytelling) e ver uma crítica e sugestão de texto aprimorado lado a lado.
*   **Why this priority**: É a base do fluxo de entrada de dados e garantia de qualidade do conteúdo antes da geração visual.
*   **Independent Test**: Pode ser testado colando qualquer texto bruto, escolhendo uma skill, clicando em "Analisar Texto" e verificando as sugestões exibidas na tela da direita.
*   **Acceptance Scenarios**:
    1.  **Given** que a tela principal está vazia, **When** colo meu texto, seleciono "Concisão" e clico em "Analisar", **Then** o app envia a requisição para a API do Hono no Cloudflare Worker, que faz a chamada ao Workers AI Gateway e retorna a análise e o texto melhorado.
    2.  **Given** que recebi a sugestão de texto aprimorado, **When** clico em "Aplicar Melhorias", **Then** o texto na caixa de edição da esquerda é atualizado com o texto sugerido pela IA.

---

### User Story 2 - Geração e Visualização do Slideshow SabrinaStyle (Priority: P1)
Como usuária, desejo gerar e visualizar uma apresentação interativa de slides estruturada com `---` a partir do texto consolidado, seguindo a identidade visual SabrinaStyle.
*   **Why this priority**: É a entrega do produto final visual que o aplicativo se propõe a criar.
*   **Independent Test**: Pode ser testado clicando em "Gerar Slides" e verificando a renderização na tela de cada slide com cores, fontes e componentes corretos.
*   **Acceptance Scenarios**:
    1.  **Given** que o texto da esquerda está consolidado, **When** clico em "Gerar Slides", **Then** o texto é estruturado em slides e renderizado em um slideshow interativo com fundo Warm Cream, títulos em *Playfair Display* e textos em *Inter*.
    2.  **Given** que o texto contém dados tabelados ou listas de cenários, **When** os slides correspondentes são gerados, **Then** o parser renderiza tabelas limpas de 1px ou cards flutuantes (*Soft Cards*) de forma automática.

---

### User Story 3 - Exportação para PDF por Impressão e Download HTML (Priority: P2)
Como usuária, desejo exportar a apresentação gerada para um arquivo PDF de alta fidelidade via impressão do navegador ou baixar um arquivo HTML estático independente.
*   **Why this priority**: Permite compartilhar a apresentação de forma universal mantendo a integridade visual exata.
*   **Independent Test**: Pode ser testado clicando em "Salvar PDF", abrindo a caixa de impressão e verificando se os slides estão em formato paisagem (16:9) com uma folha por slide.
*   **Acceptance Scenarios**:
    1.  **Given** que a apresentação está renderizada na tela, **When** clico em "Salvar PDF", **Then** o app ativa o `window.print()` e a folha de estilo CSS `@media print` formata os slides para que cada um caiba em uma folha inteira horizontal.
    2.  **Given** que desejo salvar localmente, **When** clico em "Exportar HTML", **Then** o navegador faz o download de um único arquivo `.html` autônomo contendo toda a estrutura de código, CSS e conteúdo da apresentação.

---

### User Story 4 - Geração e Download de PPTX Nativo Editável (Priority: P2)
Como usuária, desejo exportar a apresentação diretamente para um arquivo do PowerPoint (`.pptx`) contendo elementos de textos e tabelas totalmente editáveis.
*   **Why this priority**: Permite que a apresentação seja customizada e apresentada no Microsoft PowerPoint ou ferramentas compatíveis offline.
*   **Independent Test**: Pode ser testado clicando em "Baixar PPTX", abrindo o arquivo baixado no PowerPoint e editando as caixas de texto e tabelas nativas.
*   **Acceptance Scenarios**:
    1.  **Given** que a apresentação está gerada, **When** clico em "Baixar PPTX", **Then** a biblioteca `PptxGenJS` compila as formas, cores, textos e tabelas correspondentes a cada slide e inicia o download de um arquivo `.pptx`.

---

## ⚡ Edge Cases
-   **Texto Extremamente Longo:** Se o texto colado exceder o limite de tokens da LLM, o backend deve retornar um erro amigável orientando a redução ou processar em partes.
-   **Erro de Conexão com Workers AI:** Se a API da Cloudflare falhar ou estiver sem internet, o frontend deve exibir um alerta toast e oferecer a opção de tentar novamente.
-   **Slides sem Conteúdo:** Se o parser encontrar divisões vazias (`---` sem texto), ele deve ignorar esses slides para evitar renderização de páginas em branco.

---

## 📋 Requirements

### Functional Requirements
*   **FR-001**: O sistema DEVE rodar em uma arquitetura monorepo fullstack servida por um único Cloudflare Worker (API em Hono + Frontend React estático).
*   **FR-002**: O backend DEVE fazer chamadas seguras para a API de LLM do Cloudflare Workers AI utilizando a rota do Cloudflare AI Gateway.
*   **FR-003**: O frontend DEVE permitir a seleção de múltiplas skills de crítica (Concisão, Storytelling, Crítica de Negócios) via checkboxes.
*   **FR-004**: O frontend DEVE exibir o fluxo de texto e críticas em uma tela dividida (Split Screen).
*   **FR-005**: O frontend DEVE renderizar os slides interpretando o caractere de divisão `---`.
*   **FR-006**: Os slides gerados DEVEM seguir a paleta de cores original (Azul Escuro `#003B70`, Teal `#00A3A6`, Cinza Claro `#F8F9FA`) e tipografia premium (*Playfair Display* para títulos, *Inter* para textos).
*   **FR-007**: O sistema DEVE garantir acessibilidade textual, utilizando as regras sanitizadas de contraste (ex: não usar texto em Teal sobre fundo claro).
*   **FR-008**: O frontend DEVE integrar a biblioteca `PptxGenJS` para permitir a exportação e download direto de arquivos do PowerPoint `.pptx` de forma 100% editável.
*   **FR-009**: O frontend DEVE usar uma folha de estilo CSS `@media print` otimizada para formato 16:9 nas exportações para PDF do navegador.

### Key Entities
*   **Slide**: Representa a unidade básica de apresentação, contendo tipo de layout (Capa, Padrão, Cenários/Cards, Tabela), título (serifa), corpo de texto (sem serifa) e dados estruturados.
*   **CritiqueSkill**: Representa o filtro/regra de aprimoramento textual (ex: prompt interno que instrui a IA sobre como analisar e criticar o rascunho).

---

## 🎯 Success Criteria
*   **SC-001**: O tempo de resposta para a análise crítica do texto pela IA não deve exceder 6 segundos sob condições de rede estáveis.
*   **SC-002**: O arquivo `.pptx` baixado deve abrir sem erros de corrupção no Microsoft PowerPoint, Google Slides e Apple Keynote.
*   **SC-003**: Todo o texto corrido nos slides deve ter uma razão de contraste mínima de 4.5:1 contra seus respectivos fundos em ambos os modos de cor de slide (claro/escuro).

---

## 🔮 Assumptions
*   A aplicação assume que a usuária possui acesso à internet para realizar as chamadas da API do Workers AI.
*   A exportação para PDF depende das capacidades do navegador de renderizar e imprimir layouts CSS de impressão.
*   O token e configurações de rotas da Cloudflare serão declarados de forma privada nas variáveis de ambiente do worker.
