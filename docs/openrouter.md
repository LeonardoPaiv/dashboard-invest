# Assistente (OpenRouter)

No **Dashboard** o **Assistente** (chat) fica ancorado ao lado da **carteira** (composição e ativos). Nas demais páginas ele vira um botão flutuante no canto inferior direito, que abre o mesmo chat em um painel flutuante. Só uma instância do chat fica montada por vez.

## Chave da API

- Crie uma chave em https://openrouter.ai/keys e cole no formulário do Assistente.
- A chave é validada em `GET https://openrouter.ai/api/v1/key` e salva apenas no `localStorage` do navegador (item `ai-settings`). Ela não entra no backup JSON.
- Se o OpenRouter recusar a chave (HTTP 401), o formulário volta a aparecer e a mensagem que você estava enviando é preservada.
- Para trocar a chave: menu do modelo → **Trocar chave da API**.

## Modelo

O padrão é `stealth/space-bunny-alpha`. O menu do modelo lista alguns predefinidos e aceita qualquer ID do OpenRouter que suporte *tool calling*.

## O que o Assistente faz

| Pedido | Exemplo |
| --- | --- |
| Importar planilha | Anexe um `.xlsx`, `.xls` ou `.csv` de qualquer corretora |
| Registrar compra | "Comprei 100 BBSE3 a 33,10" |
| Corrigir ou remover ativo | "Remove o MXRF11", "O preço médio de ITUB4 é 28,40" |
| Reclassificar | "TAEE11 é ação, não FII" |
| Gerenciar categorias | "Cria a categoria ETFs e move IVVB11 para ela" |
| Analisar | "Como está minha alocação?", "Como rebalancear para minha meta?" |
| Consultar o app | "Quanto falta para minha meta?", "Como está meu financiamento?" |
| Configurar o app | "Muda a meta de FIIs para 30%", "Adiciona um aporte extra no financiamento" |
| Ir para uma página | "Me leva para o plano mensal" |
| Consultar o mercado (busca na web) | "Qual o CDI hoje?", "Quanto rendeu BBSE3 nos últimos 12 meses?" |

Toda alteração aparece primeiro como **prévia**. Nada é salvo até você clicar em **Confirmar**. Confirmar aplica a alteração sem sair da página em que você está; o botão **Visualizar página** do cartão leva à página afetada (e mantém o painel flutuante aberto, se não for o Dashboard).

## Busca na web

- Com a busca ligada, o modelo pode pesquisar cotações, índices (CDI, Selic, IPCA), rentabilidade de ativos e notícias. Usa a server tool `openrouter:web_search`: a busca roda no OpenRouter e o próprio modelo decide quando pesquisar, até 3 buscas de 5 resultados por resposta.
- Liga e desliga em menu do modelo → **Busca na web**. Vem ligada; a escolha fica no `localStorage` (item `ai-settings`). Um globo ao lado do nome do modelo indica que está ligada.
- É cobrada à parte pelo OpenRouter, inclusive em modelos grátis: busca nativa do provedor (OpenAI, Anthropic, Google, xAI, Perplexity) ou Exa nos demais (cerca de US$ 0,007 por busca).
- As fontes citadas aparecem abaixo da resposta, em **Fontes**, e ficam salvas com a conversa.
- As posições e o preço médio continuam vindo da carteira (`get_portfolio`); a busca serve para dados de mercado que o app não tem.

## Ferramentas

| Ferramenta | O que faz |
| --- | --- |
| `get_portfolio` | Lê a carteira em exibição (ativos, categorias, totais) |
| `propose_changes` | Propõe alterações em ativos e categorias, com prévia |
| `navigate` | Leva o usuário a outra página do app |
| `get_app_data` | Lê dados do app: metas, estratégia, plano mensal, financiamento, projeção, histórico |
| `propose_settings` | Propõe mudanças de configuração, com prévia |

## O que o Assistente configura

Carteiras (criar, renomear, excluir), metas de alocação, texto da estratégia, aporte, itens e categorias do plano mensal, parâmetros, presets, amortização extra e aportes únicos do financiamento, e parâmetros da projeção.

Continuam fora: listas personalizadas, ativos do exterior do Imposto de Renda e a chave/modelo da API.

## Conversas salvas

- As conversas ficam no `localStorage` (item `chat-conversations`), até 30; anexos longos são encurtados.
- Não entram no backup JSON e são apagadas por "apagar tudo" no Menu de Dados.
- O botão **Conversas** no cabeçalho lista, abre e apaga conversas. Ao abrir o chat, a conversa mais relevante para a página atual é retomada.

## Categorias

`Ações`, `FIIs`, `Renda Fixa` e `Tesouro Direto` são embutidas e não podem ser renomeadas ou excluídas. Qualquer outra categoria é livre.

## Limites

- Arquivos são lidos no navegador e enviados como texto ao modelo: até 300 linhas por aba e 60 000 caracteres no total. Acima disso o arquivo é truncado e o Assistente avisa.
- PDF não é suportado.
- Com a visão "Todas as carteiras" ativa, as alterações são gravadas na primeira carteira; o cartão de prévia mostra o destino.

## Código

| Arquivo | Papel |
| --- | --- |
| `src/lib/openrouter/client.ts` | Chamadas HTTP ao OpenRouter, busca na web e citações |
| `src/chat/tools.ts` | Ferramentas `get_portfolio`, `propose_changes`, `navigate`, `get_app_data` e `propose_settings` |
| `src/chat/agent.ts` | Loop de tool calling |
| `src/chat/attachments.ts` | Leitura de planilhas |
| `src/domain/operations.ts` | Validação e aplicação das operações |
| `src/store/useChatStore.ts` | Estado do chat, confirmar e descartar |
| `src/components/home/FloatingChat.tsx` | Botão e painel flutuantes fora do Dashboard |
| `src/components/home/ConversationMenu.tsx` | Menu de conversas salvas |
