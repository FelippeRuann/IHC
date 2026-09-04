/**
 * Conteudo: algoritmo Sune (R U R' U R U2 R') do cubo magico.
 *
 * Todo o conhecimento de dominio do projeto vive neste arquivo: a lista de
 * passos, a geometria e a animacao entre um passo e o seguinte. O motor nao
 * importa nada daqui alem do objeto exportado no fim.
 */

const PASSO_GRADE = 0.30;    // distancia entre os centros de duas pecas vizinhas
const TAMANHO_PECA = 0.275;  // aresta da caixa; menor que o passo, para haver fresta
const DURACAO_GIRO = 420;    // ms por quarto de volta

/** Cor de cada face externa. As faces internas ficam escuras. */
const CORES = {
  R: '#c62828', // direita  (+x) vermelho
  L: '#ef6c00', // esquerda (-x) laranja
  U: '#f9d423', // cima     (+y) amarelo
  D: '#f7f7f7', // baixo    (-y) branco
  F: '#1b9e4b', // frente   (+z) verde
  B: '#1565c0'  // tras     (-z) azul
};
const COR_INTERNA = '#15171d';

/**
 * Eixo e camada de cada face. O angulo de um giro horario, visto de fora da
 * face, e sempre -90 * sentido * camada em torno do eixo positivo — a camada
 * negativa inverte o sinal porque e observada do outro lado.
 */
const FACES = {
  R: { eixo: 'x', camada:  1 },
  L: { eixo: 'x', camada: -1 },
  U: { eixo: 'y', camada:  1 },
  D: { eixo: 'y', camada: -1 },
  F: { eixo: 'z', camada:  1 },
  B: { eixo: 'z', camada: -1 }
};

/** Sune: sete movimentos, um por passo, mais o passo inicial de posicionamento. */
const PASSOS = [
  { instrucao: 'Segure o cubo com a face amarela para cima e a verde voltada para você.', acao: null },
  { instrucao: 'R — gire a face direita 90° no sentido horário.', acao: { face: 'R', sentido: 1 } },
  { instrucao: 'U — gire a face de cima 90° no sentido horário.', acao: { face: 'U', sentido: 1 } },
  { instrucao: "R' — gire a face direita 90° no sentido anti-horário.", acao: { face: 'R', sentido: -1 } },
  { instrucao: 'U — gire a face de cima 90° no sentido horário.', acao: { face: 'U', sentido: 1 } },
  { instrucao: 'R — gire a face direita 90° no sentido horário.', acao: { face: 'R', sentido: 1 } },
  { instrucao: 'U2 — gire a face de cima 180°, meia volta.', acao: { face: 'U', sentido: 2 } },
  { instrucao: "R' — gire a face direita 90° no sentido anti-horário. Sune concluído.", acao: { face: 'R', sentido: -1 } }
];

let grupoRaiz = null;
let pecas = [];               // as 27 entidades a-box
let posicoesIniciais = [];    // posicao de cada peca no passo 0
let indiceAtual = 0;

/* ---------------------------------------------------------------- geometria */

function montarCena(container) {
  grupoRaiz = document.createElement('a-entity');
  grupoRaiz.setAttribute('position', '0 0.5 0');
  // Leve giro no eixo vertical para que a face de cima, a frontal e a direita
  // aparecam ao mesmo tempo. Como o giro e do grupo inteiro, as coordenadas
  // locais das pecas continuam alinhadas aos eixos.
  grupoRaiz.setAttribute('rotation', '0 -22 0');
  container.appendChild(grupoRaiz);

  pecas = [];
  posicoesIniciais = [];
  const pendentes = [];

  for (const x of [-1, 0, 1]) {
    for (const y of [-1, 0, 1]) {
      for (const z of [-1, 0, 1]) {
        const peca = document.createElement('a-box');
        peca.setAttribute('width', TAMANHO_PECA);
        peca.setAttribute('height', TAMANHO_PECA);
        peca.setAttribute('depth', TAMANHO_PECA);
        peca.setAttribute('position', {
          x: x * PASSO_GRADE,
          y: y * PASSO_GRADE,
          z: z * PASSO_GRADE
        });
        grupoRaiz.appendChild(peca);

        pecas.push(peca);
        posicoesIniciais.push(new THREE.Vector3(
          x * PASSO_GRADE, y * PASSO_GRADE, z * PASSO_GRADE
        ));

        pendentes.push(aoCarregar(peca).then(() => pintar(peca, x, y, z)));
      }
    }
  }

  return Promise.all([aoCarregar(grupoRaiz), ...pendentes]).then(() => {
    indiceAtual = 0;
  });
}

function aoCarregar(entidade) {
  if (entidade.hasLoaded) return Promise.resolve(entidade);
  return new Promise((resolver) => {
    entidade.addEventListener('loaded', () => resolver(entidade), { once: true });
  });
}

/**
 * Da a cada peca seis materiais proprios, um por face da caixa, na ordem em
 * que a BoxGeometry os agrupa: +x, -x, +y, -y, +z, -z. Materiais por peca (e
 * nao compartilhados) permitem destacar so a camada que vai girar.
 */
function pintar(peca, x, y, z) {
  const visiveis = [
    x ===  1 ? CORES.R : COR_INTERNA,
    x === -1 ? CORES.L : COR_INTERNA,
    y ===  1 ? CORES.U : COR_INTERNA,
    y === -1 ? CORES.D : COR_INTERNA,
    z ===  1 ? CORES.F : COR_INTERNA,
    z === -1 ? CORES.B : COR_INTERNA
  ];

  const malha = peca.getObject3D('mesh');
  if (!malha) return;

  if (malha.material && !Array.isArray(malha.material)) malha.material.dispose();
  malha.material = visiveis.map((cor) => new THREE.MeshStandardMaterial({
    color: new THREE.Color(cor),
    roughness: 0.55,
    metalness: 0.0
  }));
  peca.object3D.userData.materiais = malha.material;
}

/* ------------------------------------------------------------------- giros */

function camadaDe(eixo, camada) {
  return pecas.filter(
    (peca) => Math.round(peca.object3D.position[eixo] / PASSO_GRADE) === camada
  );
}

function anguloDaFace(face, sentido) {
  return -90 * sentido * FACES[face].camada;
}

function vetorDoEixo(eixo) {
  return new THREE.Vector3(eixo === 'x' ? 1 : 0, eixo === 'y' ? 1 : 0, eixo === 'z' ? 1 : 0);
}

/**
 * Devolve a peca a grade exata.
 *
 * Este e o ponto mais delicado do projeto: cada giro deixa um residuo de ponto
 * flutuante na posicao e na orientacao, e sem o arredondamento o erro se
 * acumula ate a filtragem por camada escolher as pecas erradas — momento em
 * que o cubo se desmonta. A rotacao e arredondada pela matriz, e nao pelos
 * angulos de Euler, que sao ambiguos perto de 90°.
 */
function encaixarNaGrade(objeto) {
  objeto.position.set(
    Math.round(objeto.position.x / PASSO_GRADE) * PASSO_GRADE,
    Math.round(objeto.position.y / PASSO_GRADE) * PASSO_GRADE,
    Math.round(objeto.position.z / PASSO_GRADE) * PASSO_GRADE
  );

  const matriz = new THREE.Matrix4().makeRotationFromQuaternion(objeto.quaternion);
  for (let i = 0; i < 16; i++) {
    matriz.elements[i] = Math.round(matriz.elements[i]);
  }
  objeto.quaternion.setFromRotationMatrix(matriz);
}

/** Giro sem animacao: usado para reconstruir um estado de uma vez so. */
function girarDireto(face, sentido) {
  const { eixo, camada } = FACES[face];
  const vetor = vetorDoEixo(eixo);
  const radianos = THREE.MathUtils.degToRad(anguloDaFace(face, sentido));
  const giro = new THREE.Quaternion().setFromAxisAngle(vetor, radianos);

  camadaDe(eixo, camada).forEach(({ object3D }) => {
    object3D.position.applyAxisAngle(vetor, radianos);
    object3D.quaternion.premultiply(giro);
    encaixarNaGrade(object3D);
  });
}

/**
 * Giro animado: as nove pecas da camada passam para uma entidade temporaria,
 * que gira 90°, e voltam ao grupo raiz com as coordenadas encaixadas. O attach
 * do three.js preserva a transformacao em coordenadas de mundo, entao as pecas
 * nao saltam ao trocar de pai.
 */
function girarAnimado(face, sentido) {
  const { eixo, camada } = FACES[face];

  return new Promise((resolver) => {
    const grupo = document.createElement('a-entity');
    grupoRaiz.appendChild(grupo);

    aoCarregar(grupo).then(() => {
      grupoRaiz.object3D.updateMatrixWorld(true);
      const movidas = camadaDe(eixo, camada);
      movidas.forEach(({ object3D }) => grupo.object3D.attach(object3D));

      const destino = { x: 0, y: 0, z: 0 };
      destino[eixo] = anguloDaFace(face, sentido);

      grupo.setAttribute('animation', {
        property: 'rotation',
        to: `${destino.x} ${destino.y} ${destino.z}`,
        dur: DURACAO_GIRO * Math.abs(sentido),
        easing: 'easeInOutQuad'
      });

      grupo.addEventListener('animationcomplete', () => {
        grupoRaiz.object3D.updateMatrixWorld(true);
        movidas.forEach(({ object3D }) => {
          grupoRaiz.object3D.attach(object3D);
          encaixarNaGrade(object3D);
        });
        grupo.remove();
        resolver();
      }, { once: true });
    });
  });
}

/* -------------------------------------------------------------- navegacao */

/** Volta ao estado inicial e refaz, sem animacao, os movimentos ate o passo. */
function reconstruirAte(indice) {
  pecas.forEach((peca, i) => {
    peca.object3D.position.copy(posicoesIniciais[i]);
    peca.object3D.quaternion.identity();
  });
  for (let i = 1; i <= indice; i++) {
    const { acao } = PASSOS[i];
    if (acao) girarDireto(acao.face, acao.sentido);
  }
}

function materiaisDe(peca) {
  return peca.object3D.userData.materiais || [];
}

/** Realca a camada que o proximo movimento vai girar. */
function destacarProximo(indice) {
  pecas.forEach((peca) => {
    materiaisDe(peca).forEach((material) => {
      material.emissive.setRGB(0, 0, 0);
    });
  });

  const seguinte = PASSOS[indice + 1];
  if (!seguinte || !seguinte.acao) return;

  const { eixo, camada } = FACES[seguinte.acao.face];
  camadaDe(eixo, camada).forEach((peca) => {
    materiaisDe(peca).forEach((material) => {
      material.emissive.set('#ffcf3f');
      material.emissiveIntensity = 0.22;
    });
  });
}

/**
 * Leva a cena ao estado do passo pedido.
 *
 * Um passo para frente ou para tras e animado a partir do estado atual.
 * Qualquer outro salto e reconstruido do zero: alem de cobrir o caso geral,
 * isso impede que erro numerico atravesse a sessao inteira.
 */
async function aplicarPasso(indice, animado = true) {
  if (animado && indice === indiceAtual + 1 && PASSOS[indice].acao) {
    const { face, sentido } = PASSOS[indice].acao;
    await girarAnimado(face, sentido);
  } else if (animado && indice === indiceAtual - 1 && PASSOS[indiceAtual].acao) {
    // Voltar um passo e desfazer o movimento que trouxe ate o passo atual.
    const { face, sentido } = PASSOS[indiceAtual].acao;
    await girarAnimado(face, -sentido);
  } else {
    reconstruirAte(indice);
  }

  indiceAtual = indice;
  destacarProximo(indice);
}

function resetar() {
  reconstruirAte(0);
  indiceAtual = 0;
  destacarProximo(0);
}

export default {
  id: 'cubo-magico',
  titulo: 'Última camada: algoritmo Sune',
  descricao: 'Orienta os cantos da última camada do cubo mágico em sete movimentos.',
  passos: PASSOS,
  montarCena,
  aplicarPasso,
  resetar
};
