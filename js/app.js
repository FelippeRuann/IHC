/**
 * Ponto de entrada: escolhe o conteudo e liga motor, cena AR e overlay.
 *
 * Esta e a unica linha do projeto que nomeia um tutorial especifico. Trocar o
 * import abaixo por outro modulo com o mesmo contrato troca o tutorial inteiro.
 */

import { criarMotor, iniciarCenaAr } from './motor.js';
import { criarInterface } from './interface.js';
import conteudo from './conteudo/cubo-magico.js';

const ui = criarInterface();
const motor = criarMotor(conteudo);

ui.apresentar(conteudo);
motor.aoAtualizar((estado) => ui.atualizar(estado));

ui.aoNavegar({
  anterior: () => motor.anterior(),
  proximo: () => motor.proximo(),
  reiniciar: () => motor.reiniciar()
});

ui.aoEscolherDispositivo(async (dispositivo) => {
  try {
    const container = await iniciarCenaAr({
      dispositivo,
      aoStatus: (tipo) => ui.definirStatus(tipo)
    });

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
