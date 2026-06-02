const express = require('express');
const router = express.Router();
const { obterHistorico, registrarTomada } = require('../controllers/historicoController');

// Caminhos que o script.js vai chamar para o histórico
router.get('/', obterHistorico);
router.post('/', registrarTomada);

module.exports = router;