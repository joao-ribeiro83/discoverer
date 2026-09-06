# Porque foi uma folha recusada

Uma **recusa** não é uma falha. É o planeador de consultas a dizer que consegue
construir o SQL, mas não consegue garantir que o número estaria certo — por
isso não o executa.

O Discoverer recusava as mesmas formas. Um número errado que parece certo é
pior do que nenhum número.

Uma recusa aparece como um painel **âmbar** com um título, um motivo e um passo
seguinte. Um painel vermelho é um erro verdadeiro e significa outra coisa; veja
[Executar Mapas](../user-guide/executing-maps.md).

O planeador de consultas recusa ainda cinco formas de armadilha em leque
(`FAN_TRAP_R1` a `FAN_TRAP_R4` e `FAN_TRAP_REAGG`). Essas cinco estão descritas
por agora apenas na [página em inglês](../../troubleshooting/refusals.md); o
painel de recusa está traduzido.

---

## Estas pastas não estão ligadas, por isso a folha não foi executada

**Código:** `NO_JOIN_PATH`

### O que foi pedido

A folha usa colunas de duas ou mais pastas, e nenhuma cadeia de junções as liga
entre si.

### Porque não pode ser respondido

Sem uma junção, a base de dados não tem regra para emparelhar as linhas.
Combinaria cada linha de uma pasta com cada linha da outra — uma **junção
cruzada** — e devolveria um número de linhas igual ao produto das duas, sem
significado.

### O que mudar

- Remova as colunas da pasta não ligada. O painel indica as pastas envolvidas.
- Ou peça a um administrador para definir uma junção entre elas, em
  **Modelação de Dados → Junções**.

Um administrador pode verificar se a junção existe mas não foi migrada: algumas
junções do Discoverer não sobrevivem a uma importação do EUL se as suas pastas
não estavam ambas no âmbito.
