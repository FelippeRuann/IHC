/**
 * Ponto de entrada: escolhe o conteudo e liga motor, cena AR e overlay.
 *
 * Esta e a unica linha do projeto que nomeia um tutorial especifico. Trocar o
 * import abaixo por outro modulo com o mesmo contrato troca o tutorial inteiro.
 */

import { criarMotor, iniciarCenaAr, criarControleDeVisao } from './motor.js';
import { criarInterface } from './interface.js';
import conteudo from './conteudo/cubo-magico.js';

const ui = criarInterface();
const motor = criarMotor(conteudo);

// So existe depois que a cena AR sobe, porque gira a raiz que ela devolve.
let visao = null;

ui.apresentar(conteudo);
motor.aoAtualizar((estado) => ui.atualizar(estado));

ui.aoNavegar({
  anterior: () => motor.anterior(),
  proximo: () => motor.proximo(),
  // Reiniciar devolve tudo ao inicio, inclusive o angulo de onde se olha.
  reiniciar: () => { visao?.centralizar(); return motor.reiniciar(); },
  centralizarVisao: () => visao?.centralizar()
});

ui.aoEscolherDispositivo(async (dispositivo) => {
  try {
    const container = await iniciarCenaAr({
      dispositivo,
      aoStatus: (tipo) => ui.definirStatus(tipo)
    });

    visao = criarControleDeVisao(container);

    ui.trocarParaTutorial();
    await motor.iniciar(container);
  } catch (erro) {
    console.error(erro);
    ui.mostrarFalha(
      'Não foi possível iniciar a realidade aumentada. ' +
      'Confira se a página está em HTTPS, se a permissão de câmera foi concedida ' +
      'e se nenhum outro aplicativo está usando a câmera.'
    );
  }
});
