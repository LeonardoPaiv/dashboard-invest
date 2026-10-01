# Assistente (OpenRouter)

A página principal é dividida em dois painéis: o **Assistente** (chat) e a **carteira** (composição e ativos).

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

Toda alteração aparece primeiro como **prévia**. Nada é salvo até você clicar em **Confirmar**.

## Categorias

`Ações`, `FIIs`, `Renda Fixa` e `Tesouro Direto` são embutidas e não podem ser renomeadas ou excluídas. Qualquer outra categoria é livre.

## Limites

- Arquivos são lidos no navegador e enviados como texto ao modelo: até 300 linhas por aba e 60 000 caracteres no total. Acima disso o arquivo é truncado e o Assistente avisa.
- PDF não é suportado.
- A conversa não é salva: recarregar a página começa uma nova.
- Com a visão "Todas as carteiras" ativa, as alterações são gravadas na primeira carteira; o cartão de prévia mostra o destino.

## Código

| Arquivo | Papel |
| --- | --- |
| `src/lib/openrouter/client.ts` | Chamadas HTTP ao OpenRouter |
| `src/chat/tools.ts` | Ferramentas `get_portfolio` e `propose_changes` |
| `src/chat/agent.ts` | Loop de tool calling |
| `src/chat/attachments.ts` | Leitura de planilhas |
| `src/domain/operations.ts` | Validação e aplicação das operações |
| `src/store/useChatStore.ts` | Estado do chat, confirmar e descartar |
