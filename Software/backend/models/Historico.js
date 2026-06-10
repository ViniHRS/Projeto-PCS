const mongoose = require('mongoose');

const HistoricoSchema = new mongoose.Schema({
    remedioId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Remedio', // Conecta este registo à tabela/coleção de Remédios
        required: true 
    },
    dataFormatada: { 
        type: String, 
        required: true // Data do evento: "AAAA-MM-DD"
    },
    horario: { 
        type: String, 
        required: true // Horário do evento: "08:00"
    },
    status: { 
        type: String, 
        enum: ['tomado', 'esquecido'], // Só aceita um destes dois valores
        required: true 
    }
}, { timestamps: true });

module.exports = mongoose.model('Historico', HistoricoSchema);