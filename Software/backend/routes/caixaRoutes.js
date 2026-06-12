const express = require('express');
const router = express.Router();
const { obterAgendaCaixa, botaoFisicoPressionado } = require('../controllers/caixaController');

// Caminhos que o microcontrolador ESP32 vai chamar
router.get('/agenda-hoje', obterAgendaCaixa);
router.post('/botao-pressionado', botaoFisicoPressionado);

module.exports = router;