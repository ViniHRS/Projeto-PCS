const express = require('express');
const router = express.Router(); // <-- ISTO RESOLVE O SEU ERRO DO CRASH

// Importe o seu modelo do Mongoose (ajuste o caminho se o seu arquivo Remedio.js estiver em outro lugar)
const Remedio = require('../models/Remedio'); 

// Rota GET para listar os remédios (é esta que você tenta acessar no navegador)
router.get('/', async (req, res) => {
    try {
        const remedios = await Remedio.find();
        res.json(remedios);
    } catch (erro) {
        res.status(500).json({ error: erro.message });
    }
});

// Rota PUT para atualizar o estoque parcial ou o formulário inteiro
router.put('/:id', async (req, res) => {
    try {
        const remedioAtualizado = await Remedio.findByIdAndUpdate(
            req.params.id,
            { $set: req.body }, 
            { new: true, runValidators: false }
        );

        if (!remedioAtualizado) {
            return res.status(404).json({ message: "Medicamento não encontrado." });
        }

        return res.status(200).json(remedioAtualizado);
    } catch (erro) {
        console.error("Erro ao atualizar no banco:", erro);
        return res.status(500).json({ error: erro.message });
    }
});

// Garante que o router seja exportado para o seu server.js
module.exports = router;