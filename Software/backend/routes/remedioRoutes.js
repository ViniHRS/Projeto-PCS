const express = require('express');
const router = express.Router();
const { obterRemedios, criarRemedio } = require('../controllers/remedioController');

// Define as rotas que o teu script.js vai chamar via fetch
router.get('/', obterRemedios);
router.post('/', criarRemedio);

module.exports = router;