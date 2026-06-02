const mongoose = require('mongoose');

const RemedioSchema = new mongoose.Schema({
    nome: { 
        type: String, 
        required: true, 
        trim: true 
    },
    slot: { 
        type: Number, 
        required: true, 
        default: 0 // Representa o compartimento físico na caixa (Gaveta 1, 2, 3...)
    },
    dataInicio: { 
        type: String, 
        required: true // Guarda no formato "AAAA-MM-DD"
    },
    frequenciaDias: { 
        type: Number, 
        required: true, 
        min: 1 
    },
    duracaoTratamento: { 
        type: Number, 
        required: true, 
        min: 1 
    },
    quantidade: { 
        type: Number, 
        required: true, 
        min: 1 // Quantidade de pílulas por dose
    },
    estoque: { 
        type: Number, 
        required: true, 
        default: 30 // Quantidade total disponível
    },
    horarios: { 
        type: [String], 
        required: true // Ex: ["08:00", "20:00"]
    },
    diasReposicao: { 
        type: [String], 
        default: [] // Datas calculadas de esgotamento
    }
}, { timestamps: true }); // Cria automaticamente campos de data de criação/atualização

module.exports = mongoose.model('Remedio', RemedioSchema);