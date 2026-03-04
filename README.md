# Dashboard de Investimentos com Gemini

Este projeto é um dashboard interativo para acompanhamento de investimentos, integrado com a API do Gemini para insights automatizados.

## Tecnologias
- Python 3.10
- Streamlit
- Google Generative AI (Gemini)
- Plotly
- Pandas

## Como configurar

1.  **Ambiente Conda**:
    O ambiente `dash-gemini` já foi criado durante a inicialização.
    ```bash
    conda activate dash-gemini
    ```

2.  **API do Gemini**:
    - Crie um arquivo `.env` na raiz do projeto (use o `.env.example` como base).
    - Adicione sua chave de API do Gemini em `GEMINI_API_KEY`.

3.  **Executar o Dashboard**:
    ```bash
    streamlit run app.py
    ```

## Estrutura Atual
- `app.py`: Interface principal do dashboard.
- `requirements.txt`: Dependências do projeto.
- `.env.example`: Modelo para variáveis de ambiente.
