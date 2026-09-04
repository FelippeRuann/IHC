/**
 * Motor de tutoriais passo a passo em realidade aumentada.
 *
 * Este arquivo nao sabe o que esta sendo ensinado. Ele conhece dois contratos:
 *
 *   - o modulo de conteudo, que descreve os proprios passos e sabe levar a
 *     cena de um passo ao seguinte;
 *   - a cena AR, que devolve o container onde o conteudo desenha e avisa
 *     quando a camera ou o marcador mudam de estado.
 *
 * Trocar o modulo de conteudo troca o tutorial inteiro sem editar nada aqui.
 * Se algum dia for preciso escrever `if (conteudo.id === ...)` neste arquivo,
 * o erro esta na abstracao, nao na falta do if.
 */

const CAMPOS_OBRIGATORIOS = ['id', 'titulo', 'passos', 'montarCena', 'aplicarPasso', 'resetar'];

/* ------------------------------------------------------------------ passos */

/**
 * Cria o motor de navegacao para um modulo de conteudo.
 *
 * O modulo precisa expor: id, titulo, descricao, passos (lista de
 * { instrucao, acao }), montarCena(container), aplicarPasso(indice, animado)
 * e resetar(). Ver js/conteudo/cubo-magico.js para uma implementacao.
 *
 * @param {object} conteudo modulo de conteudo do tutorial
 */
export function criarMotor(conteudo) {
  validarConteudo(conteudo);

  const total = conteudo.passos.length;
  const ouvintes = [];
  let indice = 0;
  let iniciado = false;
  let ocupado = false;

  function estado() {
    return {
      indice,
      total,
      passo: conteudo.passos[indice],
      titulo: conteudo.titulo,
      primeiro: indice === 0,
      ultimo: indice === total - 1,
      iniciado,
      ocupado
    };
  }

  function notificar() {
    const instantaneo = estado();
    ouvintes.forEach((ouvinte) => ouvinte(instantaneo));
  }

  /**
   * Executa uma transicao garantindo que so exista uma por vez. Sem esta
   * trava, dois cliques rapidos em "proximo" sobrepoem duas animacoes sobre
   * as mesmas pecas e a geometria se desmonta.
   */
  async function comTrava(tarefa) {
    if (ocupado) return false;
    ocupado = true;
    notificar();
    try {
      await tarefa();
      return true;
    } finally {
      ocupado = false;
      notificar();
    }
  }

  return {
    get conteudo() { return conteudo; },
    estado,

    /** Registra um ouvinte e ja o chama com o estado atual. */
    aoAtualizar(ouvinte) {
      ouvintes.push(ouvinte);
      ouvinte(estado());
      return () => {
        const posicao = ouvintes.indexOf(ouvinte);
        if (posicao >= 0) ouvintes.splice(posicao, 1);
      };
    },

    /** Monta a geometria dentro do container e para no primeiro passo. */
    async iniciar(container) {
      await comTrava(async () => {
        await conteudo.montarCena(container);
        await conteudo.aplicarPasso(0, false);
        indice = 0;
        iniciado = true;
      });
    },

    async irPara(alvo, animado = true) {
      if (!iniciado) return false;
      const destino = Math.min(Math.max(alvo, 0), total - 1);
      if (destino === indice) return false;
      return comTrava(async () => {
        await conteudo.aplicarPasso(destino, animado);
        indice = destino;
      });
    },

    proximo() { return this.irPara(indice + 1); },
    anterior() { return this.irPara(indice - 1); },

    async reiniciar() {
      if (!iniciado) return false;
      return comTrava(async () => {
        await conteudo.resetar();
        indice = 0;
      });
    }
  };
}

function validarConteudo(conteudo) {
  if (!conteudo || typeof conteudo !== 'object') {
    throw new TypeError('motor: o conteudo do tutorial nao foi fornecido.');
  }
  const faltando = CAMPOS_OBRIGATORIOS.filter((campo) => conteudo[campo] === undefined);
  if (faltando.length) {
    throw new TypeError(`motor: o conteudo nao cumpre o contrato, faltam: ${faltando.join(', ')}.`);
  }
  if (!Array.isArray(conteudo.passos) || conteudo.passos.length === 0) {
    throw new TypeError('motor: o conteudo precisa de pelo menos um passo.');
  }
}

/* ------------------------------------------------------- ciclo da camera AR */

/** Resolucao pedida a camera em cada tipo de dispositivo. */
const PERFIS = {
  desktop: { sourceWidth: 1280, sourceHeight: 720 },
  celular: { sourceWidth: 640, sourceHeight: 480 }
};

/** Se a camera nao responder nesse prazo, o problema deixa de ser silencioso. */
const LIMITE_CAMERA = 12000;

/**
 * Clona a cena do template, aplica os parametros do dispositivo escolhido e
 * devolve o container onde o conteudo deve desenhar.
 *
 * @param {object} opcoes
 * @param {'desktop'|'celular'} opcoes.dispositivo
 * @param {(tipo: 'iniciando'|'ativa'|'detectado'|'perdido'|'erro') => void} opcoes.aoStatus
 * @returns {Promise<Element>} a entidade #raiz-tutorial, ja carregada
 */
export function iniciarCenaAr({ dispositivo, aoStatus }) {
  const perfil = PERFIS[dispositivo] || PERFIS.desktop;
  const palco = document.getElementById('palco');
  const cena = document.getElementById('modelo-cena').content.firstElementChild.cloneNode(true);

  cena.setAttribute('arjs', [
    'sourceType: webcam',
    'debugUIEnabled: false',
    'detectionMode: mono',
    'maxDetectionRate: 30',
    `sourceWidth: ${perfil.sourceWidth}`,
    `sourceHeight: ${perfil.sourceHeight}`,
    `displayWidth: ${window.innerWidth}`,
    `displayHeight: ${window.innerHeight}`
  ].join('; '));

  aoStatus('iniciando');

  return new Promise((resolver) => {
    // A cena do A-Frame fica pronta antes de a camera responder, entao os dois
    // sao vigiados em separado: a promessa acompanha a cena, o relogio abaixo
    // acompanha a camera. Sem isso, uma permissao negada no celular deixaria a
    // tela preta e sem explicacao.
    let videoPronto = false;

    const relogio = setTimeout(() => {
      if (!videoPronto) aoStatus('erro');
    }, LIMITE_CAMERA);

    // O AR.js despacha estes eventos em window, nao na cena.
    window.addEventListener('camera-error', () => {
      clearTimeout(relogio);
      aoStatus('erro');
    }, { once: true });

    window.addEventListener('arjs-video-loaded', () => {
      videoPronto = true;
      clearTimeout(relogio);
      aoStatus('ativa');
    }, { once: true });

    palco.appendChild(cena);

    const pronto = () => {
      const marcador = cena.querySelector('#marcador');
      // Perder o marcador so muda o aviso na tela. O progresso vive no motor,
      // fora da cena, e por isso sobrevive a saida de quadro.
      marcador.addEventListener('markerFound', () => aoStatus('detectado'));
      marcador.addEventListener('markerLost', () => aoStatus('perdido'));

      resolver(cena.querySelector('#raiz-tutorial'));
    };

    if (cena.hasLoaded) pronto();
    else cena.addEventListener('loaded', pronto, { once: true });
  });
}

/* ------------------------------------------------------ controle de visao */

const INCLINACAO_MAXIMA = 55;  // graus; alem disso a cena vira de cabeca para baixo
const GRAUS_POR_PIXEL = 0.4;   // sensibilidade do arrasto
const PASSO_TECLADO = 12;      // graus por seta com Shift, no desktop

const emRadianos = (graus) => (graus * Math.PI) / 180;
const limitar = (valor, minimo, maximo) => Math.min(Math.max(valor, minimo), maximo);

/**
 * Permite girar a visao do tutorial arrastando a tela.
 *
 * Isto pertence ao motor, e nao ao conteudo: gira a entidade raiz inteira sem
 * saber o que foi desenhado dentro dela. O rastreamento por marcador so mostra
 * o objeto pelo lado de onde a camera esta, e rodear o marcador nem sempre e
 * possivel — com as duas maos ocupadas pelo objeto real, girar a visao e a
 * unica forma de olhar as outras faces.
 *
 * A rotacao e local a raiz, entao nao interfere na pose que o marcador impoe
 * nem nas coordenadas com que o conteudo faz as proprias contas.
 *
 * @param {Element} raiz a entidade devolvida por iniciarCenaAr
 * @returns {{ centralizar: () => void, encerrar: () => void }}
 */
export function criarControleDeVisao(raiz) {
  const alvo = raiz.object3D;
  const palco = document.getElementById('palco');

  // YXZ aplica o giro horizontal antes da inclinacao, que e o que torna o
  // arrasto previsivel: a linha do horizonte nao tomba de lado.
  alvo.rotation.order = 'YXZ';

  let giro = 0;
  let inclinacao = 0;
  let ponteiro = null;
  let anterior = null;

  function aplicar() {
    alvo.rotation.set(emRadianos(inclinacao), emRadianos(giro), 0);
  }

  function girarPor(deltaX, deltaY) {
    giro += deltaX;
    inclinacao = limitar(inclinacao + deltaY, -INCLINACAO_MAXIMA, INCLINACAO_MAXIMA);
    aplicar();
  }

  function aoPressionar(evento) {
    if (ponteiro !== null) return;  // um dedo por vez; o segundo seria ruido
    ponteiro = evento.pointerId;
    anterior = { x: evento.clientX, y: evento.clientY };
    palco.setPointerCapture?.(ponteiro);
  }

  function aoMover(evento) {
    if (evento.pointerId !== ponteiro) return;
    girarPor(
      (evento.clientX - anterior.x) * GRAUS_POR_PIXEL,
      (evento.clientY - anterior.y) * GRAUS_POR_PIXEL
    );
    anterior = { x: evento.clientX, y: evento.clientY };
  }

  function aoSoltar(evento) {
    if (evento.pointerId !== ponteiro) return;
    palco.releasePointerCapture?.(ponteiro);
    ponteiro = null;
  }

  // Shift + setas gira a visao no desktop. As setas sozinhas continuam sendo
  // navegacao de passos, tratada pela interface.
  function aoTeclar(evento) {
    if (!evento.shiftKey) return;
    const giros = {
      ArrowLeft:  [-PASSO_TECLADO, 0],
      ArrowRight: [PASSO_TECLADO, 0],
      ArrowUp:    [0, -PASSO_TECLADO],
      ArrowDown:  [0, PASSO_TECLADO]
    };
    const passo = giros[evento.key];
    if (!passo) return;
    evento.preventDefault();
    girarPor(passo[0], passo[1]);
  }

  palco.addEventListener('pointerdown', aoPressionar);
  palco.addEventListener('pointermove', aoMover);
  palco.addEventListener('pointerup', aoSoltar);
  palco.addEventListener('pointercancel', aoSoltar);
  window.addEventListener('keydown', aoTeclar);

  return {
    /** Devolve a visao ao angulo em que o tutorial comecou. */
    centralizar() {
      giro = 0;
      inclinacao = 0;
      aplicar();
    },

    encerrar() {
      palco.removeEventListener('pointerdown', aoPressionar);
      palco.removeEventListener('pointermove', aoMover);
      palco.removeEventListener('pointerup', aoSoltar);
      palco.removeEventListener('pointercancel', aoSoltar);
      window.removeEventListener('keydown', aoTeclar);
    }
  };
}
