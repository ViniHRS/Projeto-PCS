const express = require('express');
const router = express.Router();

// Importa o modelo do Mongoose (ajuste o caminho se necessário)
const Remedio = require('../models/Remedio');

// ==========================================================================
// FUNÇÃO AUXILIAR: CALCULA A REPOSIÇÃO NO SERVIDOR (PROTEÇÃO TOTAL)
// ==========================================================================
function calcularReposicaoBackend(remedio) {
    if (!remedio.dataInicio || !remedio.horarios || remedio.horarios.length === 0) {
        return [];
    }

    // Calcula a dose diária (Quantidade de pílulas * vezes ao dia)
    const doseDiaria = (parseInt(remedio.quantidade) || 1) * remedio.horarios.length;
    if (doseDiaria === 0) return [];

    const estoqueAtual = parseInt(remedio.estoque) || 0;
    
    // Divide o estoque pela dose diária para saber quantos dias dura
    const diasRestantes = Math.floor(estoqueAtual / doseDiaria);

    // Quebra a string YYYY-MM-DD para evitar fuso horário quebrado (UTC)
    const partesData = remedio.dataInicio.split('-');
    if (partesData.length !== 3) return [];

    // O JavaScript conta os meses de 0 a 11 (Janeiro = 0)
    const dataInicioTratamento = new Date(partesData[0], partesData[1] - 1, partesData[2]);
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Se o tratamento não começou, conta a partir do início. Se já começou, a partir de hoje.
    let dataPartida = dataInicioTratamento > hoje ? dataInicioTratamento : hoje;

    const dataEsgotamento = new Date(dataPartida);
    dataEsgotamento.setDate(dataPartida.getDate() + diasRestantes);

    // Formata de volta para o padrão YYYY-MM-DD
    const dataFinalFormatada = `${dataEsgotamento.getFullYear()}-${String(dataEsgotamento.getMonth() + 1).padStart(2, '0')}-${String(dataEsgotamento.getDate()).padStart(2, '0')}`;
    
    return [dataFinalFormatada];
}

// ==========================================================================
// ROTA GET: LISTAR TODOS OS MEDICAMENTOS
// ==========================================================================
router.get('/', async (req, res) => {
    try {
        const remedios = await Remedio.find();
        res.json(remedios);
    } catch (erro) {
        res.status(500).json({ error: erro.message });
    }
});

// ==========================================================================
// ROTA POST: CADASTRO DE NOVO MEDICAMENTO
// ==========================================================================
router.post('/', async (req, res) => {
    try {
        const novoRemedio = new Remedio(req.body);
        
        // Define estoque padrão se o formulário não enviar
        if (novoRemedio.estoque === undefined) novoRemedio.estoque = 10;

        // Calcula e preenche a reposição antes de salvar pela primeira vez
        novoRemedio.diasReposicao = calcularReposicaoBackend(novoRemedio);

        await novoRemedio.save();
        res.status(201).json(novoRemedio);
    } catch (erro) {
        res.status(400).json({ error: erro.message });
    }
});

// ==========================================================================
// ROTA PUT: ATUALIZAR ESTOQUE OU DADOS COMPLETOS DO FORMULÁRIO
// ==========================================================================
router.put('/:id', async (req, res) => {
    try {
        // 1. Busca o registro atual como ele está guardado hoje no MongoDB
        const remedioExistente = await Remedio.findById(req.params.id);
        if (!remedioExistente) {
            return res.status(404).json({ message: "Medicamento não encontrado." });
        }

        // 2. Combina os dados originais com a alteração parcial recebida (ex: apenas o estoque)
        const dadosMesclados = Object.assign({}, remedioExistente.toObject(), req.body);

        // 3. Força o recálculo do array usando as informações completas combinadas
        req.body.diasReposicao = calcularReposicaoBackend(dadosMesclados);

        // 4. Aplica a atualização de forma definitiva no banco
        const remedioAtualizado = await Remedio.findByIdAndUpdate(
            req.params.id,
            { $set: req.body }, 
            { new: true, runValidators: false }
        );

        return res.status(200).json(remedioAtualizado);
    } catch (erro) {
        console.error("Erro ao atualizar no banco:", erro);
        return res.status(500).json({ error: erro.message });
    }
});

// ==========================================================================
// ROTA DELETE: REMOVER MEDICAMENTO PERMANENTEMENTE
// ==========================================================================
router.delete('/:id', async (req, res) => {
    try {
        const remedioDeletado = await Remedio.findByIdAndDelete(req.params.id);
        if (!remedioDeletado) {
            return res.status(404).json({ message: "Medicamento não encontrado." });
        }
        res.status(200).json({ message: "Medicamento removido com sucesso." });
    } catch (erro) {
        res.status(500).json({ error: erro.message });
    }
});

// Exporta o router estruturado para ser lido pelo server.js
module.exports = router;