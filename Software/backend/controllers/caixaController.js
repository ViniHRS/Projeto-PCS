const Remedio = require('../models/Remedio');
const Historico = require('../models/Historico');

// 1. A caixa física chama esta rota para saber quais remédios e gavetas (slots) acender HOJE
const obterAgendaCaixa = async (req, res) => {
    try {
        const agora = new Date();
        const hojeAno = agora.getFullYear();
        const hojeMes = String(agora.getMonth() + 1).padStart(2, '0');
        const hojeDia = String(agora.getDate()).padStart(2, '0');
        const dataFormatadaHoje = `${hojeAno}-${hojeMes}-${hojeDia}`;

        const todosRemedios = await Remedio.find();
        let agendaFisica = [];

        todosRemedios.forEach(remedio => {
            const inicio = new Date(remedio.dataInicio + 'T00:00:00');
            const fim = new Date(inicio);
            fim.setDate(inicio.getDate() + remedio.duracaoTratamento - 1);
            
            const hojeSemHora = new Date(agora);
            hojeSemHora.setHours(0,0,0,0);

            // Verifica se o tratamento está ativo para hoje
            if (hojeSemHora >= inicio && hojeSemHora <= fim) {
                const diffTempo = Math.abs(hojeSemHora - inicio);
                const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24));
                
                // Verifica a frequência de dias (ex: de 2 em 2 dias)
                if (diffDias % remedio.frequenciaDias === 0) {
                    remedio.horarios.forEach(hora => {
                        agendaFisica.push({
                            remedioId: remedio._id,
                            nome: remedio.nome,
                            slot: remedio.slot, // Número do LED/Gaveta física
                            horario: hora       // Ex: "08:00"
                        });
                    });
                }
            }
        });

        res.json(agendaFisica);
    } catch (err) {
        res.status(500).json({ message: "Erro na agenda da caixa: " + err.message });
    }
};

// 2. A caixa física avisa o servidor que o BOTÃO FÍSICO foi pressionado
const botaoFisicoPressionado = async (req, res) => {
    const { remedioId, horario } = req.body;
    
    const agora = new Date();
    const hojeAno = agora.getFullYear();
    const hojeMes = String(agora.getMonth() + 1).padStart(2, '0');
    const hojeDia = String(agora.getDate()).padStart(2, '0');
    const dataFormatadaHoje = `${hojeAno}-${hojeMes}-${hojeDia}`;

    try {
        const remedio = await Remedio.findById(remedioId);
        if (!remedio) {
            return res.status(404).json({ message: "Medicamento não encontrado" });
        }

        // Verifica se já foi registada a toma para este minuto (evita cliques duplicados no botão físico)
        const jaExiste = await Historico.findOne({ dataFormatada: dataFormatadaHoje, remedioId, horario });
        if (jaExiste && jaExiste.status === 'tomado') {
            return res.json({ success: true, message: "Já registado anteriormente." });
        }

        // Salva no histórico marcando a origem como 'caixa_fisica'
        const novoRegisto = new Historico({
            remedioId,
            dataFormatada: dataFormatadaHoje,
            horario,
            status: 'tomado',
            origem: 'caixa_fisica'
        });
        await novoRegisto.save();

        // Deduz a quantidade do stock físico/virtual
        remedio.estoque = Math.max(0, remedio.estoque - (remedio.quantidade || 1));
        await remedio.save();

        res.json({ success: true, message: "Status atualizado com sucesso via Hardware!" });
    } catch (err) {
        res.status(400).json({ message: "Erro no evento de hardware: " + err.message });
    }
};

module.exports = { obterAgendaCaixa, botaoFisicoPressionado };