const Historico = require('../models/Historico');
const Remedio = require('../models/Remedio');

// 1. Listar todo o histórico de tomadas
const obterHistorico = async (req, res) => {
    try {
        const historico = await Historico.find().populate('remedioId', 'nome slot');
        res.json(historico);
    } catch (err) {
        res.status(500).json({ message: "Erro ao obter histórico: " + err.message });
    }
};

// 2. Registar ou atualizar uma tomada (Tomado / Esquecido) vinda do site
const registrarTomada = async (req, res) => {
    const { dataFormatada, remedioId, horario, status } = req.body;

    try {
        // Valida se o remédio existe
        const remedio = await Remedio.findById(remedioId);
        if (!remedio) {
            return res.status(404).json({ message: "Medicamento não encontrado" });
        }

        // Procura se já existe um registo para este remédio no mesmo dia e hora
        let registo = await Historico.findOne({ dataFormatada, remedioId, horario });

        if (registo) {
            // Se o utilizador mudou de ideias no site (ex: de esquecido para tomado)
            registo.status = status;
            registo.origem = 'web';
            await registo.save();
        } else {
            // Cria um novo registo no histórico
            registo = new Historico({
                remedioId,
                dataFormatada,
                horario,
                status,
                origem: 'web'
            });
            await registo.save();
        }

        // Se o status foi marcado como 'tomado', deduz a quantidade do stock do remédio
        if (status === 'tomado') {
            remedio.estoque = Math.max(0, remedio.estoque - (remedio.quantidade || 1));
            await remedio.save();
        }

        res.json({ success: true, registo });
    } catch (err) {
        res.status(400).json({ message: "Erro ao registar tomada: " + err.message });
    }
};

module.exports = { obterHistorico, registrarTomada };