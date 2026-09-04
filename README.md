# ar-tutor

Tutoriais passo a passo em realidade aumentada, direto no navegador. A câmera
reconhece um marcador impresso e projeta sobre ele um modelo 3D que avança a cada
passo, com a instrução na tela. Sem instalar aplicativo.

A primeira versão ensina um algoritmo de cubo mágico.

**[▶ Abrir a demonstração](https://felipperuann.github.io/ar-tutor/)** — funciona
no celular e no desktop.

<!-- GIF de 5 a 10 segundos: apontar a câmera, o cubo aparecer, avançar dois
     passos e a face girar. É o que convence alguém em três segundos. -->

## Como testar

1. Abra o [marcador Hiro](assets/marcador-hiro.png) e imprima, ou deixe aberto
   em outra tela.
2. Abra a demonstração e escolha *Desktop* ou *Celular*.
3. Autorize o acesso à câmera.
4. Aponte para o marcador a uns 20–40 cm.

Ambiente bem iluminado melhora bastante a detecção. O reconhecimento leva de 2 a
3 segundos.

## O que tem de interessante tecnicamente

**O motor não sabe o que está ensinando.** Navegação entre passos, estado,
rastreamento e overlay ficam separados do conteúdo. Um tutorial é um módulo que
descreve seus passos e sabe animar a transição entre eles:

```js
{
  titulo: 'Última camada: algoritmo Sune',
  passos: [ { instrucao: '...', acao: { face: 'R', sentido: 1 } }, ... ],
  montarCena, aplicarPasso, resetar
}
```

Trocar esse módulo troca o tutorial inteiro sem tocar no núcleo — na prática,
trocar uma linha de `import` em [js/app.js](js/app.js), o único arquivo que
nomeia um tutorial específico. A separação veio antes do código, e não depois — o
cubo é o primeiro conteúdo, não o único previsto.

**O cubo é construído por código.** Vinte e sete caixas numa grade 3×3×3, sem
arquivo de modelo externo. Cada rotação de face agrupa nove peças, anima 90° e
devolve as peças ao grupo raiz com as coordenadas arredondadas — sem esse
arredondamento o erro de ponto flutuante se acumula e o cubo se desmonta depois
de alguns movimentos. A orientação é arredondada pela matriz de rotação, não
pelos ângulos de Euler, que são ambíguos justamente perto de 90°.

Duas defesas complementares protegem a mesma coisa: o motor só permite uma
transição por vez, para que dois cliques rápidos não sobreponham duas animações
sobre as mesmas peças; e qualquer salto que não seja de um passo é reconstruído
a partir do estado inicial, o que impede que resíduo numérico atravesse a sessão.

**Sem etapa de build.** HTML, CSS e módulos ES nativos. A demonstração precisa
abrir de uma URL em qualquer celular, e qualquer bundler entre o código e o
usuário atrapalharia isso.

## Decisões de interface

**Escolher o dispositivo antes de iniciar.** Desktop e celular têm câmeras e
resoluções diferentes, e a inicialização precisa de parâmetros distintos.
Perguntar antes evita a tela preta que aparece quando a configuração errada é
aplicada — falha comum em demos de AR na web.

**Status da câmera sempre visível.** Rastreamento por marcador falha em silêncio.
Se nada aparece, o usuário precisa conseguir distinguir "câmera não iniciou" de
"marcador não detectado" — sem isso, a única reação possível é desistir. Se a
câmera não responde em 12 segundos, o aviso deixa de ser silencioso e explica o
que fazer.

**O progresso sobrevive à perda do marcador.** Sair de quadro no passo 5 e voltar
continua no passo 5. Quem está com as mãos ocupadas tira a câmera do marcador o
tempo todo. O progresso vive no motor, fora da cena 3D, e por isso não depende do
rastreamento.

**A próxima face fica realçada.** Antes de girar, a camada que o próximo passo
vai mover recebe um brilho leve — ler "gire a face direita" e ver qual é levam
tempos diferentes.

## Tecnologias

- [A-Frame](https://aframe.io/) 1.5.0 — cenas 3D declarativas na web
- [AR.js](https://ar-js-org.github.io/AR.js-Docs/) 3.4.5 — rastreamento de marcador por visão computacional
- WebGL e `getUserMedia`, nativos do navegador

Ambos vêm da jsDelivr com a versão fixada: uma URL apontando para `master`
quebraria a demonstração sozinha alguns meses depois.

## Limitações conhecidas

- Requer HTTPS: o acesso à câmera é bloqueado fora de contexto seguro, por isso a
  publicação é no GitHub Pages.
- Rastreamento por marcador apenas — sem detecção de superfícies.
- Um único tutorial disponível até agora.

---

Desenvolvido por [Felippe Ruann](https://github.com/FelippeRuann).
