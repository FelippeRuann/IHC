/**
 * Overlay do motor: instrucao do passo, progresso, controles e status da
 * camera. Como o motor, e generico — recebe estados e os desenha, sem saber
 * de que tutorial vieram.
 */

/** Texto e cor de cada estado da camera, na ordem em que costumam acontecer. */
const STATUS = {
  iniciando: { texto: 'Iniciando a câmera…', classe: 'status--neutro' },
  ativa:     { texto: 'Câmera ativa — procurando o marcador', classe: 'status--alerta' },
  detectado: { texto: 'Marcador detectado', classe: 'status--ok' },
  perdido:   { texto: 'Marcador fora de quadro — progresso mantido', classe: 'status--alerta' },
  erro:      { texto: 'Câmera indisponível', classe: 'status--erro' }
};

const AJUDA_ERRO_CAMERA =
  'Não foi possível usar a câmera. Verifique se a permissão foi concedida ' +
  'e se nenhum outro aplicativo está usando a câmera, e recarregue a página.';

export function criarInterface() {
  const el = {
    inicio: document.getElementById('tela-inicio'),
    inicioTitulo: document.getElementById('inicio-titulo'),
    inicioDescricao: document.getElementById('inicio-descricao'),
    aviso: document.getElementById('inicio-aviso'),
    overlay: document.getElementById('overlay'),
    titulo: document.getElementById('titulo-tutorial'),
    status: document.getElementById('status-camera'),
    progresso: document.getElementById('progresso'),
    barra: document.getElementById('progresso-preenchido'),
    contador: document.getElementById('contador-passo'),
    instrucao: document.getElementById('instrucao'),
    anterior: document.getElementById('btn-anterior'),
    proximo: document.getElementById('btn-proximo'),
    reiniciar: document.getElementById('btn-reiniciar')
  };

  let cameraComErro = false;

  return {
    /** Preenche a abertura com os dados que o proprio conteudo declara. */
    apresentar(conteudo) {
      el.inicioTitulo.textContent = conteudo.titulo;
      el.inicioDescricao.textContent = conteudo.descricao || '';
      el.titulo.textContent = conteudo.titulo;
      document.title = `${conteudo.titulo} — ar-tutor`;
    },

    aoEscolherDispositivo(callback) {
      el.inicio.querySelectorAll('[data-dispositivo]').forEach((botao) => {
        botao.addEventListener('click', () => {
          el.inicio.querySelectorAll('[data-dispositivo]').forEach((b) => { b.disabled = true; });
          callback(botao.dataset.dispositivo);
        });
      });
    },

    /** Liga os controles do overlay as acoes do motor. */
    aoNavegar({ anterior, proximo, reiniciar }) {
      el.anterior.addEventListener('click', anterior);
      el.proximo.addEventListener('click', proximo);
      el.reiniciar.addEventListener('click', reiniciar);

      // Com o celular na mao um teclado nao ajuda, mas no desktop o tutorial
      // e usado com as duas maos ocupadas pelo objeto real.
      window.addEventListener('keydown', (evento) => {
        if (evento.target.matches('input, textarea, select')) return;
        if (evento.key === 'ArrowRight') { evento.preventDefault(); proximo(); }
        if (evento.key === 'ArrowLeft') { evento.preventDefault(); anterior(); }
      });
    },

    trocarParaTutorial() {
      el.inicio.hidden = true;
      el.overlay.hidden = false;
    },

    /** Redesenha o overlay a partir de um estado do motor. */
    atualizar(estado) {
      const numero = estado.indice + 1;
      const porcento = estado.total > 1 ? (estado.indice / (estado.total - 1)) * 100 : 100;

      el.contador.textContent = `Passo ${numero} de ${estado.total}`;
      el.barra.style.width = `${porcento}%`;
      el.progresso.setAttribute('aria-valuenow', Math.round(porcento));

      if (!cameraComErro) {
        el.instrucao.textContent = estado.passo.instrucao;
      }

      el.anterior.disabled = estado.primeiro || estado.ocupado || !estado.iniciado;
      el.proximo.disabled = estado.ultimo || estado.ocupado || !estado.iniciado;
      el.reiniciar.disabled = estado.ocupado || !estado.iniciado;
      el.proximo.textContent = estado.ultimo ? 'Concluído' : 'Próximo ›';
    },

    definirStatus(tipo) {
      const info = STATUS[tipo] || STATUS.iniciando;
      el.status.textContent = info.texto;
      el.status.className = `status ${info.classe}`;

      cameraComErro = tipo === 'erro';
      if (cameraComErro) el.instrucao.textContent = AJUDA_ERRO_CAMERA;
    },

    /** Falha antes de o tutorial comecar: a mensagem fica na abertura. */
    mostrarFalha(mensagem) {
      el.aviso.textContent = mensagem;
      el.aviso.hidden = false;
      el.inicio.hidden = false;
      el.overlay.hidden = true;
      el.inicio.querySelectorAll('[data-dispositivo]').forEach((b) => { b.disabled = false; });
    }
  };
}
