const express = require('express');
const router = express.Router();
const Historico = require('../models/Historico');
const historicoController = require('../controllers/historicoController');

// POST: Regista que um remédio foi tomado (chamado quando o utilizador clica na notificação)
router.post('/', async (req, res) => {
    try {
        const novoEvento = new Historico(req.body);
        await novoEvento.save();
        res.status(201).json(novoEvento);
    } catch (erro) {
        res.status(400).json({ error: erro.message });
    }
});

// GET: Busca os últimos registos para mostrar na tela de Histórico
router.get('/', async (req, res) => {
    try {
        const logs = await Historico.find().sort({ createdAt: -1 }).limit(50);
        res.json(logs);
    } catch (erro) {
        res.status(500).json({ error: erro.message });
    }
});

module.exports = router;
