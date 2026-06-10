const Remedio = require('../models/Remedio');
const Historico = require('../models/Historico');

const verificarHistoricoPendentes = async () => {
    console.log("🕒 Iniciando varredura completa de histórico pendente...");
    const hoje = new Date();
    const hojeStr = hoje.toISOString().split('T')[0];

    try {
        const remedios = await Remedio.find();

        for (let remedio of remedios) {
            // Define a data de início (data de criação do remédio)
            let dataInicio = new Date(remedio.createdAt);
            let dataIteracao = new Date(dataInicio);

            // Percorre de cada dia desde a criação até hoje
            while (dataIteracao <= hoje) {
                let dataStr = dataIteracao.toISOString().split('T')[0];
                
                // Ignora o dia de hoje se ainda não acabou (opcional)
                if (dataStr === hojeStr && dataIteracao.getHours() < new Date().getHours()) {
                    // Continua verificando
                }

                for (let horario of remedio.horarios) {
                    // Verifica se esse horário específico já passou (evita registrar o futuro)
                    const dataHorario = new Date(`${dataStr}T${horario}:00`);
                    if (dataHorario < new Date()) {
                        
                        const existe = await Historico.findOne({ 
                            remedioId: remedio._id, 
                            dataFormatada: dataStr, 
                            horario: horario 
                        });

                        if (!existe) {
                            await Historico.create({
                                remedioId: remedio._id,
                                dataFormatada: dataStr,
                                horario: horario,
                                status: 'esquecido'
                            });
                            console.log(`✅ Preenchido: ${remedio.nome} em ${dataStr} às ${horario}`);
                        }
                    }
                }
                // Avança para o próximo dia
                dataIteracao.setDate(dataIteracao.getDate() + 1);
            }
        }
        console.log("✅ Varredura completa concluída com sucesso.");
    } catch (err) {
        console.error("Erro na varredura histórica:", err);
    }
};

const limparDuplicatas = async () => {
    console.log("🧹 Iniciando limpeza de duplicatas...");
    const duplicatas = await Historico.aggregate([
        {
            $group: {
                _id: { remedioId: "$remedioId", dataFormatada: "$dataFormatada", horario: "$horario" },
                ids: { $push: "$_id" },
                count: { $sum: 1 }
            }
        },
        { $match: { count: { $gt: 1 } } }
    ]);

    for (let grupo of duplicatas) {
        // Mantém o primeiro ID da lista e deleta todos os outros do mesmo grupo
        const idsParaDeletar = grupo.ids.slice(1);
        await Historico.deleteMany({ _id: { $in: idsParaDeletar } });
    }
    console.log(`✅ Limpeza de duplicatas concluída.`);
};

const limparHorariosFantasma = async () => {
    console.log("🧹 Iniciando limpeza de registros fantasmas...");

    try {
        const historicos = await Historico.find();

        for (let h of historicos) {
            // Busca o remédio correspondente no banco
            const remedio = await Remedio.findById(h.remedioId);

            let deveDeletar = false;

            if (!remedio) {
                // 1. Caso: Remédio foi deletado
                deveDeletar = true;
            } else {
                // 2. Caso: Horário não existe mais no array de horários do remédio
                if (!remedio.horarios.includes(h.horario)) {
                    deveDeletar = true;
                }
                
                // 3. Caso: A data do histórico é anterior à nova data de início do remédio
                // Supondo que você tenha um campo 'dataInicio' no seu model Remedio
                if (remedio.dataInicio && new Date(h.dataFormatada) < new Date(remedio.dataInicio)) {
                    deveDeletar = true;
                }
            }

            if (deveDeletar) {
                await Historico.deleteOne({ _id: h._id });
                console.log(`🗑️ Deletado registro fantasma: ${h.remedioId} - ${h.dataFormatada} às ${h.horario}`);
            }
        }
        console.log("✅ Limpeza de fantasmas concluída.");
    } catch (err) {
        console.error("Erro na limpeza:", err);
    }
};

const realizarManutencaoHistorico = async () => {
    await verificarHistoricoPendentes();
    await limparDuplicatas();
    await limparHorariosFantasma();
};


module.exports = { realizarManutencaoHistorico };