require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const aedes = require('aedes')(); // Broker MQTT leve
const net = require('net');       // Necessário para o servidor TCP do MQTT

const app = express();

// Middlewares
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Certifique-se de permitir PUT!
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// ==========================================================================
// CONEXÃO COM BANCO DE DADOS (MongoDB Atlas)
// ==========================================================================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Conectado ao MongoDB Atlas (ClusterCIDRA)!'))
    .catch((err) => console.error('❌ Erro na conexão ao MongoDB:', err));

// ==========================================================================
// CONFIGURAÇÃO DO BROKER MQTT (Porta 1883)
// ==========================================================================
const mqttServer = net.createServer(aedes.handle);
const MQTT_PORT = 1883;

mqttServer.listen(MQTT_PORT, () => {
    console.log(`🚀 Broker MQTT ativo na porta ${MQTT_PORT}`);
});

// Lógica de recebimento: O ESP32 publica no tópico 'cidra/caixa/status'
aedes.on('publish', async (packet, client) => {
    if (client && packet.topic === 'cidra/caixa/status') {
        const payload = packet.payload.toString();
        console.log(`📡 Status recebido do ESP32: ${payload}`);
        
        // Aqui você pode converter o JSON e chamar seu caixaController
        // Exemplo: const data = JSON.parse(payload);
        // await registrarTomadaNoBanco(data);
        // Importe o controller
        const historicoController = require('./controllers/historicoController');
        // Agora o await funcionará porque a função é async
        await historicoController.registrarTomadaDaCaixa(payload);
    }
});

// ==========================================================================
// ROTAS DA API
// ==========================================================================
app.use('/api/remedios', require('./routes/remedioRoutes'));
app.use('/api/historico', require('./routes/historicoRoutes'));
app.use('/api/caixa', require('./routes/caixaRoutes'));

app.get('/', (req, res) => {
    res.json({ message: "API CIDRA App + Broker MQTT online!" });
});

// Inicialização
const PORT = process.env.PORT || 3000;
const  { realizarManutencaoHistorico } = require('./services/historicoService.js')
realizarManutencaoHistorico();
app.listen(PORT, () => {
    console.log(`🌍 Servidor Web rodando em http://localhost:${PORT}`);
});

