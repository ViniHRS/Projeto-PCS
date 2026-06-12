const Historico = require('../models/Historico');
const Remedio = require('../models/Remedio');

/**
 * 1. Listar histórico (Mantido para fins de consulta do front-end)
 */
const obterHistorico = async (req, res) => {
    try {
        const historico = await Historico.find().sort({ createdAt: -1 });
        res.json(historico);
    } catch (err) {
        res.status(500).json({ message: "Erro ao obter histórico: " + err.message });
    }
};

/**
 * 2. Registrar tomada vinda da CAIXA FÍSICA (Processa o sinal do ESP32)
 * Esta função deve ser chamada quando o seu server.js receber a mensagem MQTT
 */
const registrarTomadaDaCaixa = async (dadosDaCaixa) => {
    const { remedioId, dataFormatada, horario, status } = dadosDaCaixa;

    try {
        const remedio = await Remedio.findById(remedioId);
        if (!remedio) throw new Error("Medicamento não encontrado");

        // Procura se já existe um registro para evitar duplicidade
        let registo = await Historico.findOne({ dataFormatada, remedioId, horario });

        if (registo) {
            // Se já existe, atualiza o status (caso tenha sido corrigido ou reprocessado)
            registo.status = status;
            registo.origem = 'caixa_fisica';
            await registo.save();
        } else {
            // Cria novo registro vindo da caixa
            registo = new Historico({
                remedioId,
                dataFormatada,
                horario,
                status
            });
            await registo.save();
        }

        // Se o status foi 'tomado', atualiza o estoque
        if (status === 'tomado') {
            remedio.estoque = Math.max(0, remedio.estoque - (remedio.quantidade || 1));
            await remedio.save();
            console.log(`✅ Registro processado: ${remedio.nome} tomado (Caixa). Estoque atualizado.`);
        }

        return registo;
    } catch (err) {
        console.error("Erro ao registrar tomada da caixa:", err.message);
        throw err;
    }
};

module.exports = { obterHistorico, registrarTomadaDaCaixa };