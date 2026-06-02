require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middlewares Globais
app.use(cors());
app.use(express.json());

// Conexão ao MongoDB Atlas utilizando o seu ClusterCIDRA
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Conectado com sucesso ao MongoDB Atlas (ClusterCIDRA)!'))
    .catch((err) => console.error('❌ Erro crítico de conexão à Base de Dados:', err));

// ==========================================================================
// IMPORTAÇÃO DAS ROTAS DA API
// ==========================================================================
const remedioRoutes = require('./routes/remedioRoutes');
const historicoRoutes = require('./routes/historicoRoutes');
const caixaRoutes = require('./routes/caixaRoutes');

// ==========================================================================
// MAPEAMENTO DOS ENDPOINTS (VINCULAÇÃO)
// ==========================================================================
app.use('/api/remedios', remedioRoutes);   // Endpoints do site para medicamentos
app.use('/api/historico', historicoRoutes); // Endpoints do site para o histórico
app.use('/api/caixa', caixaRoutes);         // Endpoints exclusivos da caixa física IoT

// Rota padrão para teste no navegador
app.get('/', (req, res) => {
    res.json({ message: "API CIDRA App online e pronta para operar!" });
});

// Inicialização do Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor backend a rodar em http://localhost:${PORT}`);
});