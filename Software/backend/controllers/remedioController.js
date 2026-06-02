const Remedio = require('../models/Remedio');

// Buscar todos os remédios do banco
const obterRemedios = async (req, res) => {
    try {
        const remedios = await Remedio.find();
        res.json(remedios);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Criar um novo remédio vindo do site
const criarRemedio = async (req, res) => {
    const novoRemedio = new Remedio(req.body);
    try {
        const remedioSalvo = await novoRemedio.save();
        res.status(201).json(remedioSalvo);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

module.exports = { obterRemedios, criarRemedio };