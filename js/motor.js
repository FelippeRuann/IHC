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
