# 📊 Dashboard de Investimentos Premium

Este projeto é um dashboard interativo para acompanhamento de investimentos, otimizado para deploy em plataformas cloud (como Vercel) e com armazenamento persistente via navegador (LocalStorage).

## ✨ Principais Funcionalidades

- **💾 Persistência no Navegador**: Seus dados (configurações, listas, notas) são salvos no `localStorage`, garantindo privacidade e agilidade sem necessidade de banco de dados externo.
- **📁 Importar/Exportar Backup**: Facilidade para migrar seus dados entre navegadores ou dispositivos através de arquivos `.json`.
- **📊 Análise de Carteira**: Suporte para importação de arquivos `.xlsx` (padrão corretora XP Investimentos).
- **🔄 Dados em Tempo Real**: Integração com webscraping (Investidor10) para cotações e indicadores (DY, P/VP, P/L) atualizados.
- **🎯 Estratégia e Rebalanceamento**: Ferramentas para definir alvos de alocação, capturar snapshots e projetar evolução patrimonial com juros compostos.
- **🤖 Gerador de Prompts**: Gere insights para análise estratégica com ferramentas de IA externas (como ChatGPT ou Claude).

## 🚀 Como Executar

1.  **Clone o repositório**:
    ```bash
    git clone <seu-repositorio>
    cd dashboard-invest
    ```

2.  **Instale as dependências**:
    ```bash
    pip install -r requirements.txt
    ```

3.  **Execute o Dashboard**:
    ```bash
    streamlit run app.py
    ```

## ☁️ Deploy na Vercel

Este projeto já está configurado para deploy imediato na Vercel. Basta conectar seu repositório GitHub à plataforma Vercel e configurar o build command como padrão para Streamlit apps.

## 📄 Estrutura do Projeto
- `app.py`: Interface principal do dashboard.
- `utils/`: Módulos de lógica, scraping, parsing e persistência.
- `templates/`: Modelos de arquivos para importação.
- `requirements.txt`: Dependências necessárias.
