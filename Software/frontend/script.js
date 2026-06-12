// ==========================================================================
// SELEÇÃO DE ELEMENTOS DO DOM
// ==========================================================================
const menuBtn = document.getElementById('menuBtn');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const menuItems = document.querySelectorAll('.menu-item');
const sections = document.querySelectorAll('.content-section');

// Modais
const modalRemedio = document.getElementById('modal-remedio'); 
const modalLista = document.getElementById('modal-lista-dia'); 
const fecharModalCadastro = document.getElementById('fechar-modal');
const fecharModalLista = document.getElementById('fechar-lista-dia');

// Formulários
const remedioBtn = document.getElementById('remedioBtn'); 
const formRemedio = document.getElementById('form-remedio');
const containerHorarios = document.getElementById('container-horarios');

// Elementos do Calendário
const monthYear = document.getElementById('monthYear');
const daysContainer = document.getElementById('days');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');

// Configurações do Calendário
const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const diasSemanaNomes = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
let date = new Date();
let currentMonth = date.getMonth();
let currentYear = date.getFullYear();

// Configurações Globais e Endereços
const API_URL = 'https://cidraapp.onrender.com/api';
let remediosAgendados = [];
let historicoTomadas = [];
let notificacoesReestoqueFeitasHoje = [];
let notificouAoIniciar = false;

// Controle de alertas e reenvios de confirmação (Itens a.1 / a.2)
let temporizadorReenvioConfirmacao = null;
let dadosTomadaPendente = null;

// ==========================================================================
// CONFIGURAÇÃO SEGURA DO MQTT (COM PROTOCOLO DE RECONHECIMENTO DE ERRO E ESTOQUE)
// ==========================================================================
let mqttClient = null;

const TOPICO_COMANDO = 'cidra/caixa/comando';
const TOPICO_CONFIRMACAO = 'cidra/hardware/confirmacao';

function inicializarMQTT() {
    if (typeof mqtt === 'undefined') {
        console.error("❌ Erro: A biblioteca MQTT.js não foi carregada no index.html.");
        return;
    }

    const brokerUrl = 'ws://broker.hivemq.com:8000/mqtt';
    const clientId = 'cidra_web_' + Math.random().toString(16).substr(2, 8);

    try {
        mqttClient = mqtt.connect(brokerUrl, { 
            clientId: clientId,
            connectTimeout: 5000 
        });

        mqttClient.on('connect', () => {
            console.log('📡 Conectado ao Broker MQTT com sucesso via Web (Porta 8000)!');
            mqttClient.subscribe(TOPICO_CONFIRMACAO);
            sincronizarAgendaGeralComHardware();
        });

        mqttClient.on('message', async (topic, message) => {
            if (topic === TOPICO_CONFIRMACAO) {
                try {
                    const resposta = JSON.parse(message.toString());
                    console.log("🤖 Resposta JSON de Validação do ESP32:", resposta);
                    
                    if (resposta.status === "erro") {
                        console.warn(`⚠️ [BLOQUEIO LÓGICO]: O ESP32 rejeitou o comando. Motivo: ${resposta.motivo}`);
                    } 
                    else if (resposta.status === "sucesso_dispensado") {
                        console.log(`✅ [ENTREGA CONFIRMADA]: Medicamento liberado do slot ${resposta.slot}`);
                        
                        // Executa redução automática em estoque (Item g) baseado no retorno do hardware
                        await aplicarBaixaDeEstoquePorSlot(resposta.slot);
                        
                        // Abrir formulário de confirmação de ingestão na tela do site (Item a.1)
                        exibirFormularioConfirmacaoIngestao(resposta.remedioNome || "Medicamento", resposta.slot);
                    } 
                    else if (resposta.status === "falha_sensor_ir") {
                        console.error(`🚨 [ALERTA MECÂNICO]: Falha física detectada no slot ${resposta.slot}!`);
                        limparTemporizadoresConfirmacao();
                        exibirModalErroMecanico(resposta.slot);
                    }
                } catch(e) {
                    console.log("🤖 Notificação em Texto Puro do ESP32:", message.toString());
                }
            }
        });

        mqttClient.on('error', (err) => {
            console.error("⚠️ Erro no cliente MQTT:", err);
        });
    } catch (e) {
        console.error("❌ Falha crítica ao inicializar conexão MQTT:", e);
    }
}

// Envia toda a lista de medicamentos formatada em lote para o ESP32 recalcular a agenda local (Item a)
function sincronizarAgendaGeralComHardware() {
    if (!mqttClient || !mqttClient.connected || remediosAgendados.length === 0) return;

    let payloadCompleto = "";
    remediosAgendados.forEach(remedio => {
        if (!remedio.slot || !remedio.horarios) return;
        
        // Calcula os dias da semana em que este remédio roda baseado na data de início e duração
        const inicio = new Date(remedio.dataInicio + 'T00:00:00');
        const freq = remedio.frequenciaDias || 1;
        const duracao = remedio.duracaoTratamento || 1;

        // Mapeia os dias específicos da semana (1-7) dentro do intervalo do tratamento
        let diasDaSemanaAtivos = new Set();
        for (let i = 0; i < duracao; i++) {
            if (i % freq === 0) {
                const dataLoop = new Date(inicio);
                dataLoop.setDate(inicio.getDate() + i);
                diasDaSemanaAtivos.add(dataLoop.getDay() + 1); // JS: 0=Dom -> Hardware: 1=Dom
            }
        }

        // Adiciona cada horário com as respectivas doses (quantidade)
        remedio.horarios.forEach(hora => {
            const [hStr, mStr] = hora.split(':');
            diasDaSemanaAtivos.forEach(diaHardware => {
                const idFake = `${remedio._id.substr(-4)}${diaHardware}${hStr}${mStr}`;
                payloadCompleto += `${diaHardware},${parseInt(hStr)},${parseInt(mStr)},${parseInt(remedio.slot)},${idFake},${parseInt(remedio.quantidade)};`;
            });
        });
    });

    if (payloadCompleto.length > 0) {
        mqttClient.publish(TOPICO_COMANDO, payloadCompleto);
        console.log("📡 [Sincronização em Lote] Grade enviada para o ESP32:", payloadCompleto);
    }
}

// Remove o estoque direto no banco do backend após confirmação de ejeção física bem-sucedida (Item g)
async function aplicarBaixaDeEstoquePorSlot(slot) {
    const remedio = remediosAgendados.find(r => r.slot === parseInt(slot));
    if (!remedio) return;

    const doseReducao = parseInt(remedio.quantidade) || 1;
    let novoEstoque = (parseInt(remedio.estoque) || 0) - doseReducao;
    if (novoEstoque < 0) novoEstoque = 0;

    remedio.estoque = novoEstoque;
    calcularAutomaticoReposicao(remedio._id);

    try {
        await fetch(`${API_URL}/remedios/${remedio._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estoque: novoEstoque })
        });
        console.log(`📦 Estoque reduzido para ${remedio.nome}. Atual: ${novoEstoque}`);
        renderizarTelaEstoque();
    } catch (err) {
        console.error("❌ Erro ao atualizar estoque baixado no servidor:", err);
    }
}

// ==========================================================================
// FORMULÁRIOS DE INGESTÃO E ALERTAS DE REENVIO (Itens a.1 / a.2 / f)
// ==========================================================================
function exibirFormularioConfirmacaoIngestao(nomeRemedio, slot) {
    limparTemporizadoresConfirmacao();
    dadosTomadaPendente = { nome: nomeRemedio, slot: slot, timestamp: Date.now() };

    let containerPopups = document.getElementById('container-popups-cidra');
    if (!containerPopups) {
        containerPopups = document.createElement('div');
        containerPopups.id = 'container-popups-cidra';
        containerPopups.style = "position: fixed; top: 20px; right: 20px; z-index: 9999; width: 320px;";
        document.body.appendChild(containerPopups);
    }

    const popupHTML = document.createElement('div');
    popupHTML.id = `alerta-tomada-${slot}`;
    popupHTML.style = "background: white; border-left: 5px solid #22c55e; box-shadow: 0 4px 12px rgba(0,0,0,0.15); padding: 16px; margin-bottom: 12px; border-radius: 6px; font-family: sans-serif;";
    popupHTML.innerHTML = `
        <h4 style="margin: 0 0 8px 0; color: #1e293b;">Confirmar Ingestão</h4>
        <p style="margin: 0 0 12px 0; font-size: 0.9rem; color: #475569;">Você tomou o remédio <strong>${nomeRemedio}</strong> liberado no slot ${slot}?</p>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
             <button id="btn-confirma-sim-${slot}" style="background: #22c55e; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;">Sim, tomei</button>
        </div>
    `;
    containerPopups.appendChild(popupHTML);

    document.getElementById(`btn-confirma-sim-${slot}`).onclick = () => {
        popupHTML.remove();
        limparTemporizadoresConfirmacao();
        alert("Obrigado por confirmar sua ingestão!");
    };

    // Configura reenvio cíclico automático a cada 30 minutos caso seja ignorado (Item a.2)
    temporizadorReenvioConfirmacao = setTimeout(() => {
        console.log("⏰ 30 minutos sem resposta. Reenviando formulário...");
        popupHTML.remove();
        exibirFormularioConfirmacaoIngestao(nomeRemedio, slot);
    }, 30 * 60 * 1000); 
}

function limparTemporizadoresConfirmacao() {
    if (temporizadorReenvioConfirmacao) {
        clearTimeout(temporizadorReenvioConfirmacao);
        temporizadorReenvioConfirmacao = null;
    }
    dadosTomadaPendente = null;
}

function exibirModalErroMecanico(slot) {
    let modalErro = document.getElementById('modal-erro-mecanico');
    if (!modalErro) {
        modalErro = document.createElement('div');
        modalErro.id = 'modal-erro-mecanico';
        modalErro.style = "position: fixed; top:0; left:0; width:100vw; height:100vh; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000; font-family: sans-serif;";
        modalErro.innerHTML = `
            <div style="background: white; padding: 24px; border-radius: 8px; max-width: 400px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                <div style="font-size: 3rem; margin-bottom: 12px;">🚨</div>
                <h3 style="margin: 0 0 12px 0; color: #ef4444;">Erro Mecânico Detectado!</h3>
                <p style="color: #475569; margin-bottom: 20px; font-size: 0.95rem;">O compartimento <strong>${slot}</strong> tentou dispensar a medicação, mas o sensor não detectou a queda da pílula. Verifique se o slot está obstruído ou vazio.</p>
                <button id="btn-resolver-erro" style="background: #ef4444; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 1rem; font-weight: bold; width: 100%;">Já consertei o problema</button>
            </div>
        `;
        document.body.appendChild(modalErro);
    } else {
        modalErro.style.display = "flex";
    }

    document.getElementById('btn-resolver-erro').onclick = () => {
        modalErro.remove();
        alert("Sistema liberado para operação regular.");
    };
}

// ==========================================================================
// SINCRONIZAÇÃO E CARREGAMENTO BACKEND
// ==========================================================================
async function carregarRemediosDoBackend() {
    try {
        const resposta = await fetch(`${API_URL}/remedios`);
        if (resposta.ok) {
            remediosAgendados = await resposta.json();
            console.log("🔄 Dados sincronizados do backend:", remediosAgendados);
            
            remediosAgendados.forEach(remedio => {
                calcularAutomaticoReposicao(remedio._id);
            });

            if (!notificouAoIniciar) {
                const agora = new Date();
                const hojeAno = agora.getFullYear();
                const hojeMes = String(agora.getMonth() + 1).padStart(2, '0');
                const hojeDia = String(agora.getDate()).padStart(2, '0');
                const dataFormatadaHoje = `${hojeAno}-${hojeMes}-${hojeDia}`;

                remediosAgendados.forEach(remedio => {
                    if (remedio.diasReposicao && remedio.diasReposicao.length > 0) {
                        const dataReposicaoPrevista = remedio.diasReposicao[0];
                        
                        if (dataFormatadaHoje === dataReposicaoPrevista) {
                            enviarNotificacaoReestoque(remedio.nome, remedio.slot);
                        }
                    }
                });
                notificouAoIniciar = true; 
            }

            const telaCalendario = document.getElementById('tela-calendario');
            if (telaCalendario && telaCalendario.style.display !== 'none') renderCalendar();

            const telaEstoque = document.getElementById('tela-estoque');
            if (telaEstoque && telaEstoque.style.display === 'block') renderGridEstoqueCompartimentos();

            const telaMeusRemedios = document.getElementById('tela-remedios');
            if (telaMeusRemedios && telaMeusRemedios.style.display === 'block') renderizarMeusRemedios();
            
            atualizarProximoHorarioTela();
        }
    } catch (erro) {
        console.error("❌ Erro ao carregar remédios do backend:", erro);
    }
}

// ==========================================================================
// NAVEGAÇÃO E INICIALIZAÇÃO DA SIDEBAR
// ==========================================================================
function alternarSidebar() {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

if (menuBtn) menuBtn.addEventListener('click', alternarSidebar);
if (overlay) overlay.addEventListener('click', alternarSidebar);

menuItems.forEach(item => {
    item.addEventListener('click', () => {
        const targetSectionId = item.getAttribute('data-target');
        
        sections.forEach(section => {
            section.style.display = 'none';
        });

        const targetSection = document.getElementById(targetSectionId);
        if (targetSection) targetSection.style.display = 'block';

        if (targetSectionId === 'tela-remedios') {
            renderizarMeusRemedios();
        } else if (targetSectionId === 'tela-estoque') {
            renderizarTelaEstoque();
        } else if (targetSectionId === 'tela-calendario') {
            renderCalendar();
        }

        alternarSidebar();
    });
});

sections.forEach(section => section.style.display = 'none');
const calendarioInicial = document.getElementById('tela-calendario');
if (calendarioInicial) calendarioInicial.style.display = 'block';

// ==========================================================================
// CONTROLADORES DOS MODAIS E HORÁRIOS DINÂMICOS
// ==========================================================================
function abrirModalRemedio() {
    const inputDataInicio = document.getElementById('data-inicio');
    const hoje = new Date().toISOString().split('T')[0];
    if (inputDataInicio) inputDataInicio.value = hoje;
    modalRemedio.style.display = "block";
}

if (fecharModalCadastro) {
    fecharModalCadastro.onclick = function() {
        modalRemedio.style.display = "none";
        overlay.style.display = "none";
        formRemedio.reset();
        document.getElementById('id-remedio').value = ""; 
        
        containerHorarios.innerHTML = `
            <label class="label-estilizada">Horários</label>
            <div class="horario-item">
                <input type="time" class="input-horario" step="60" required>
            </div>
        `;
        const primeiroInput = containerHorarios.querySelector('.input-horario');
        if (primeiroInput) primeiroInput.onchange = adicionarNovoCampoHorario;
    };
}

if (fecharModalLista) fecharModalLista.onclick = () => { modalLista.style.display = "none"; };

window.onclick = (event) => {
    if (event.target == modalRemedio) { modalRemedio.style.display = "none"; resetarFormulario(); }
    if (event.target == modalLista) modalLista.style.display = "none";
};

if (remedioBtn) {
    remedioBtn.onclick = function() {
        abrirModalRemedio();
        document.getElementById('id-remedio').value = ""; 
        formRemedio.reset();
    };
}

function adicionarNovoCampoHorario() {
    const todosInputs = containerHorarios.querySelectorAll('.input-horario');
    const ultimoInput = todosInputs[todosInputs.length - 1];

    if (ultimoInput && ultimoInput.value !== "") {
        const novoDiv = document.createElement('div');
        novoDiv.classList.add('horario-item');
        novoDiv.innerHTML = `<input type="time" class="input-horario" step="60">`;
        containerHorarios.appendChild(novoDiv);
        novoDiv.querySelector('input').addEventListener('change', adicionarNovoCampoHorario);
    }
}

const primeiroInputHora = document.querySelector('.input-horario');
if (primeiroInputHora) primeiroInputHora.addEventListener('change', adicionarNovoCampoHorario);

function resetarFormulario() {
    formRemedio.reset();
    const inputId = document.getElementById('id-remedio');
    if (inputId) inputId.value = "";
    document.getElementById('frequencia').value = "1"; 
    containerHorarios.innerHTML = `
        <label class="label-estilizada">Horários</label>
        <div class="horario-item">
            <input type="time" class="input-horario" step="60" required>
        </div>
    `;
    containerHorarios.querySelector('.input-horario').addEventListener('change', adicionarNovoCampoHorario);
}

// ==========================================================================
// SALVAMENTO DE MEDICAMENTOS (CADASTRO / EDIÇÃO)
// ==========================================================================
if (formRemedio) {
    formRemedio.onsubmit = async function(e) {
        e.preventDefault();

        const inputsHorarios = containerHorarios.querySelectorAll('.input-horario');
        const horarios = [];
        inputsHorarios.forEach(input => {
            if (input.value) horarios.push(input.value);
        });

        if (horarios.length === 0) {
            alert("Por favor, adicione pelo menos um horário para o medicamento.");
            return;
        }

        const idRemedio = document.getElementById('id-remedio').value;

        const dadosRemedio = {
            nome: document.getElementById('nome-remedio').value.trim(),
            slot: parseInt(document.getElementById('slot-remedio').value) || null,
            dataInicio: document.getElementById('data-inicio').value,
            frequenciaDias: parseInt(document.getElementById('frequencia').value) || 1,
            duracaoTratamento: parseInt(document.getElementById('duracao').value) || 1,
            quantidade: parseInt(document.getElementById('qtd-pilulas').value) || 1,
            horarios: horarios
        };

        try {
            let url = `${API_URL}/remedios`;
            let metodo = 'POST';

            if (idRemedio) {
                url = `${API_URL}/remedios/${idRemedio}`;
                metodo = 'PUT';
            } else {
                dadosRemedio.estoque = 10; 
            }

            const resposta = await fetch(url, {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dadosRemedio)
            });

            if (resposta.ok) {
                console.log("✅ Agenda salva com sucesso!");
                formRemedio.reset();
                document.getElementById('id-remedio').value = "";
                fecharModalCadastro.click(); 
                await carregarRemediosDoBackend();
                sincronizarAgendaGeralComHardware(); // Atualiza automaticamente o hardware ao salvar (Item a)
            } else {
                const erroServidor = await resposta.json();
                alert(`Erro ao salvar: ${erroServidor.message || 'Verifique os dados enviados.'}`);
            }
        } catch (erro) {
            console.error("❌ Erro de rede ao submeter o formulário:", erro);
        }
    };
}

// ==========================================================================
// RENDERIZAÇÃO E CLIQUE DO CALENDÁRIO
// ==========================================================================
function renderCalendar() {
    if (!daysContainer) return;
    monthYear.innerText = `${months[currentMonth]} ${currentYear}`;
    
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
    const today = new Date();

    const totalElementosNecessarios = firstDayIndex + lastDay;
    if (daysContainer.children.length !== totalElementosNecessarios) {
        daysContainer.innerHTML = "";

        for (let i = 0; i < firstDayIndex; i++) {
            const emptyDiv = document.createElement("div");
            emptyDiv.classList.add("empty");
            daysContainer.appendChild(emptyDiv);
        }

        for (let i = 1; i <= lastDay; i++) {
            const dayDiv = document.createElement("div");
            dayDiv.innerText = i;
            dayDiv.setAttribute('data-dia', i);
            dayDiv.addEventListener('click', () => verRemediosDoDia(i, currentMonth, currentYear));
            daysContainer.appendChild(dayDiv);
        }
    }

    for (let i = 1; i <= lastDay; i++) {
        const dayDiv = daysContainer.querySelector(`div[data-dia="${i}"]`);
        if (!dayDiv) continue;

        dayDiv.classList.remove("today", "dia-medicamento", "dia-reposicao");

        if (i === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()) {
            dayDiv.classList.add("today");
        }

        const dataLoop = new Date(currentYear, currentMonth, i);
        const dataFormatada = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

        const temRemedioParaTomar = remediosAgendados.some(remedio => {
            const inicio = new Date(remedio.dataInicio + 'T00:00:00');
            const fim = new Date(inicio);
            fim.setDate(inicio.getDate() + remedio.duracaoTratamento - 1);

            if (dataLoop >= inicio && dataLoop <= fim) {
                const diffTempo = Math.abs(dataLoop - inicio);
                const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24));
                return diffDias % remedio.frequenciaDias === 0;
            }
            return false;
        });

        if (temRemedioParaTomar) {
            dayDiv.classList.add("dia-medicamento");
        }

        const temReposicao = remediosAgendados.some(r => r.diasReposicao && r.diasReposicao.includes(dataFormatada));
        if (temReposicao) {
            dayDiv.classList.add("dia-reposicao");
        }
    }
}

let emEsperaTrocaMes = false;
if (prevBtn) {
    prevBtn.onclick = () => {
        if (emEsperaTrocaMes) return;
        emEsperaTrocaMes = true;
        currentMonth--; 
        if (currentMonth < 0) { currentMonth = 11; currentYear--; } 
        renderCalendar();
        setTimeout(() => { emEsperaTrocaMes = false; }, 300);
    };
}

if (nextBtn) {
    nextBtn.onclick = () => {
        if (emEsperaTrocaMes) return;
        emEsperaTrocaMes = true;
        currentMonth++; 
        if (currentMonth > 11) { currentMonth = 0; currentYear++; } 
        renderCalendar();
        setTimeout(() => { emEsperaTrocaMes = false; }, 300);
    };
}

function verRemediosDoDia(dia, mes, ano) {
    const tituloLista = document.getElementById('titulo-lista-dia');
    const containerLista = document.getElementById('lista-remedios-container');
    
    if (tituloLista) {
        tituloLista.innerText = `Agenda - ${String(dia).padStart(2, '0')}/${String(mes + 1).padStart(2, '0')}/${ano}`;
    }

    containerLista.innerHTML = "";

    const dataClicada = new Date(ano, mes, dia);
    const dataFormatada = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    
    const remediosDoDia = remediosAgendados.filter(remedio => {
        const inicio = new Date(remedio.dataInicio + 'T00:00:00');
        const fim = new Date(inicio);
        fim.setDate(inicio.getDate() + remedio.duracaoTratamento - 1);

        if (dataClicada >= inicio && dataClicada <= fim) {
            const diffTempo = Math.abs(dataClicada - inicio);
            const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24));
            return diffDias % remedio.frequenciaDias === 0;
        }
        return false;
    });

    const reposicoesDoDia = remediosAgendados.filter(r => r.diasReposicao && r.diasReposicao.includes(dataFormatada));

    if (reposicoesDoDia.length > 0) {
        reposicoesDoDia.forEach(remedio => {
            const alertaEstoque = document.createElement('div');
            alertaEstoque.classList.add('alerta-reposicao-modal');
            alertaEstoque.innerHTML = `
                <div class="alerta-reposicao-conteudo">
                    <span class="icone-alerta">📅</span>
                    <div><strong>Dia de Reposição!</strong><br>O estoque de <span>${remedio.nome}</span> atingiu o limite crítico.</div>
                </div>
            `;
            containerLista.appendChild(alertaEstoque);
        });
    }

    if (remediosDoDia.length > 0) {
        remediosDoDia.forEach(remedio => {
            remedio.horarios.forEach(hora => {
                const item = document.createElement('div');
                item.classList.add('card-remedio-dia');

                const registroValido = historicoTomadas.find(h => h.dataFormatada === dataFormatada && h.remedioId === remedio._id && h.horario === hora);

                const classeTomado = (registroValido && registroValido.status === 'tomado') ? 'ativo-verde' : '';
                const classePular = (registroValido && registroValido.status === 'esquecido') ? 'ativo-vermelho' : '';

                let textoStatus = '<span style="color: #64748b; font-size: 0.8rem;">Status: Pendente</span>';
                if (registroValido) {
                    textoStatus = registroValido.status === 'tomado' 
                        ? '<span style="color: #22c55e; font-weight: bold; font-size: 0.8rem;">Status: Tomado ✓</span>' 
                        : '<span style="color: #ef4444; font-weight: bold; font-size: 0.8rem;">Status: Não Tomado ✗</span>';
                }

                item.innerHTML = `
                    <div>
                        <span class="nome-medicamento">${remedio.nome}</span> <span class="badge-slot">${hora}</span><br>
                        <span class="card-info">Dose: ${remedio.quantidade} pílula(s)</span><br>
                        <div class="status-texto-container" style="margin-top: 4px;">${textoStatus}</div>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button class="btn-tomou ${classeTomado}" onclick="gatilhoBotaoTomar('${remedio._id}', '${hora}')">Tomar</button>
                        <button class="btn-nao-tomou ${classePular}" onclick="gatilhoBotaoPular('${remedio._id}', '${hora}')">Pular</button>
                    </div>
                `;
                containerLista.appendChild(item);
            });
        });
    }

    if (remediosDoDia.length === 0 && reposicoesDoDia.length === 0) {
        containerLista.innerHTML = '<p style="color: #999; text-align: center; padding: 15px;">Nenhum evento agendado para hoje.</p>';
    }
    
    if (modalLista) modalLista.style.display = "block";
}

// ==========================================================================
// INTERAÇÕES DE BOTÕES COM FORMULÁRIOS DE CONFIRMAÇÃO (Itens c / d / e)
// ==========================================================================
function gatilhoBotaoTomar(remedioId, hora) {
    // Adiciona o formulário de confirmação obrigatório antes de prosseguir (Item c)
    if (!confirm("Confirmar dispensação manual imediata deste medicamento?")) return;
    executarAcaoTomarRemedio(remedioId, hora);
}

function gatilhoBotaoPular(remedioId, hora) {
    // Adiciona o formulário de confirmação obrigatório antes de prosseguir (Item c)
    if (!confirm("Deseja realmente pular a tomada deste medicamento?")) return;
    executarAcaoPularRemedio(remedioId, hora);
}

// Executa ação de dispensar imediatamente de forma forçada pelo botão "Tomar" (Item d)
async function executarAcaoTomarRemedio(remedioId, hora) {
    try {
        const remedio = remediosAgendados.find(r => r._id === remedioId);
        const slotDestino = (remedio && remedio.slot) ? remedio.slot : 1;

        if (mqttClient && mqttClient.connected) {
            const idTransacaoUnica = Date.now(); 
            const diaSemanaHoje = new Date().getDay() + 1; 
            const [hStr, mStr] = hora.split(':');
            
            // Força a mensagem com o formato de dose para o motor executar na hora
            const payloadIdempotente = `${diaSemanaHoje},${parseInt(hStr)},${parseInt(mStr)},${parseInt(slotDestino)},${idTransacaoUnica},${parseInt(remedio.quantidade)};`;
            
            mqttClient.publish(TOPICO_COMANDO, payloadIdempotente);
            console.log(`📡 [MQTT IMEDIATO] Botão Tomar acionado: ${payloadIdempotente}`);
        } else {
            console.warn("⚠️ Sem conexão MQTT ativa.");
        }

        await fetch(`${API_URL}/api/historico`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ remedioId, data: new Date(), horario: hora, status: 'tomado' })
        });

        await carregarRemediosDoBackend();
    } catch (error) {
        console.error("Erro ao processar ação tomar:", error);
    }
}

// Executa apenas o salto do remédio sem interagir com o motor físico (Item e)
async function executarAcaoPularRemedio(remedioId, hora) {
    try {
        await fetch(`${API_URL}/api/historico`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ remedioId, status: 'esquecido', horario: hora, data: new Date() })
        });

        console.log("⏭️ Medicamento pulado pelo usuário.");
        await carregarRemediosDoBackend(); // Recarrega e atualiza o próximo horário de tomada em seguida
    } catch (error) {
        console.error("Erro ao processar ação pular:", error);
    }
}

// ==========================================================================
// CÁLCULO E EXIBIÇÃO DINÂMICA DO PRÓXIMO HORÁRIO COM DIA DA SEMANA (Item b)
// ==========================================================================
function atualizarProximoHorarioTela() {
    const container = document.getElementById('conteudo-proximo-horario');
    if (!container) return;

    const agora = new Date();
    let listaFilaGeral = [];

    // Vasculha os próximos 7 dias em busca do agendamento mais próximo na linha do tempo
    for (let deslocamentoDia = 0; deslocamentoDia < 7; deslocamentoDia++) {
        const dataAnalise = new Date(agora);
        dataAnalise.setDate(agora.getDate() + deslocamentoDia);
        dataAnalise.setHours(0, 0, 0, 0);

        const diaSemanaIndex = dataAnalise.getDay(); // 0-6
        const diaNomeStr = deslocamentoDia === 0 ? "Hoje" : (deslocamentoDia === 1 ? "Amanhã" : diasSemanaNomes[diaSemanaIndex]);

        const anoStr = dataAnalise.getFullYear();
        const mesStr = String(dataAnalise.getMonth() + 1).padStart(2, '0');
        const diaStr = String(dataAnalise.getDate()).padStart(2, '0');
        const dataFormatadaLoop = `${anoStr}-${mesStr}-${diaStr}`;

        remediosAgendados.forEach(remedio => {
            const inicio = new Date(remedio.dataInicio + 'T00:00:00');
            const fim = new Date(inicio);
            fim.setDate(inicio.getDate() + remedio.duracaoTratamento - 1);

            if (dataAnalise >= inicio && dataAnalise <= fim) {
                const diffTempo = Math.abs(dataAnalise - inicio);
                const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24));
                
                if (diffDias % remedio.frequenciaDias === 0) {
                    remedio.horarios.forEach(hora => {
                        const [h, m] = hora.split(':').map(Number);
                        const dataCompletaEvento = new Date(dataAnalise);
                        dataCompletaEvento.setHours(h, m, 0, 0);

                        // Só adiciona se o horário do evento analisado ainda for no futuro
                        if (dataCompletaEvento > agora) {
                            listaFilaGeral.push({
                                dataExibicaoStr: `${diaNomeStr} (${diaStr}/${mesStr})`,
                                horaStr: hora,
                                timestamp: dataCompletaEvento.getTime(),
                                remedio: remedio
                            });
                        }
                    });
                }
            }
        });
    }

    if (listaFilaGeral.length === 0) {
        container.innerHTML = `<p style="color: #666; font-size: 0.9rem; margin: 0;">Nenhum medicamento pendente para os próximos dias.</p>`;
        return;
    }

    // Ordena pelo evento mais próximo cronologicamente
    listaFilaGeral.sort((a, b) => a.timestamp - b.timestamp);

    const proximoEvento = listaFilaGeral[0];
    const alvosDesteMesmoInstante = listaFilaGeral.filter(item => item.timestamp === proximoEvento.timestamp);

    let htmlGerado = `<div class="hora-destaque">⏰ ${proximoEvento.dataExibicaoStr} às ${proximoEvento.horaStr}</div>`;

    alvosDesteMesmoInstante.forEach(item => {
        const r = item.remedio;
        htmlGerado += `
            <div class="linha-remedio-proximo" style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 10px; margin-top: 6px; border-radius: 6px; border: 1px solid #e2e8f0;">
                <div>
                    <strong style="color: #0f172a;">${r.nome}</strong>
                    <span style="font-size: 0.8rem; color: #64748b; margin-left: 10px;">Dose: ${r.quantidade} pílula(s) (Slot ${r.slot || '---'})</span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-tomou" style="background:#22c55e; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;" onclick="gatilhoBotaoTomar('${r._id}', '${proximoEvento.horaStr}')">Tomar</button>
                    <button class="btn-nao-tomou" style="background:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;" onclick="gatilhoBotaoPular('${r._id}', '${proximoEvento.horaStr}')">Pular</button>
                </div>
            </div>
        `;
    });

    container.innerHTML = htmlGerado;
}

function verificarEGerenciarHorarios() {
    const agora = new Date();
    const horaAtual = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
    
    const hojeAno = agora.getFullYear();
    const hojeMes = String(agora.getMonth() + 1).padStart(2, '0');
    const hojeDia = String(agora.getDate()).padStart(2, '0');
    const dataFormatadaHoje = `${hojeAno}-${hojeMes}-${hojeDia}`;

    if (horaAtual === "00:00") {
        notificacoesReestoqueFeitasHoje = [];
        notificouAoIniciar = false; 
    }

    if (horaAtual === "12:00") {
        remediosAgendados.forEach(remedio => {
            if (remedio.diasReposicao && remedio.diasReposicao.length > 0) {
                const dataReposicaoPrevista = remedio.diasReposicao[0];

                if (dataFormatadaHoje === dataReposicaoPrevista) {
                    const chaveIdentificadora = `${remedio._id}-${dataFormatadaHoje}`;

                    if (!notificacoesReestoqueFeitasHoje.includes(chaveIdentificadora)) {
                        enviarNotificacaoReestoque(remedio.nome, remedio.slot);
                        notificacoesReestoqueFeitasHoje.push(chaveIdentificadora);
                    }
                }
            }
        });
    }

    const hojeSemHora = new Date();
    hojeSemHora.setHours(0, 0, 0, 0); 

    remediosAgendados.forEach(remedio => {
        if (!remedio.dataInicio || !remedio.horarios) return;

        const partes = remedio.dataInicio.split('-');
        const inicio = new Date(partes[0], partes[1] - 1, partes[2]);
        inicio.setHours(0, 0, 0, 0);

        const fim = new Date(inicio);
        fim.setDate(inicio.getDate() + (parseInt(remedio.duracaoTratamento) || 1) - 1);

        if (hojeSemHora >= inicio && hojeSemHora <= fim) {
            const diffTempo = hojeSemHora.getTime() - inicio.getTime();
            const diffDias = Math.floor(diffTempo / (1000 * 60 * 60 * 24));
            const frequencia = parseInt(remedio.frequenciaDias) || 1;

            if (diffDias % frequencia === 0) {
                if (remedio.horarios.includes(horaAtual)) {
                    enviarNotificacaoNavegador(remedio.nome, horaAtual, remedio.quantidade, remedio.slot);
                }
            }
        }
    });
}

// ==========================================================================
// TELA SECÇÃO: MEUS REMÉDIOS
// ==========================================================================
function renderizarMeusRemedios() {
    const container = document.getElementById('lista-remedios-geral'); 
    if (!container) return;

    if (remediosAgendados.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #666; padding: 20px;">Nenhum medicamento cadastrado até o momento.</p>`;
        return;
    }

    if (container.children.length === 0 || container.querySelector('p')) {
        container.innerHTML = '';
    }

    remediosAgendados.forEach(remedio => {
        let card = container.querySelector(`.card-meu-remedio[data-id="${remedio._id}"]`);

        const textoHorarios = remedio.horarios && remedio.horarios.length > 0 ? remedio.horarios.join(', ') : 'Não definidos';
        const dataFormatadaStr = remedio.dataInicio ? remedio.dataInicio.split('-').reverse().join('/') : '---';

        if (!card) {
            card = document.createElement('div');
            card.classList.add('card-meu-remedio');
            card.setAttribute('data-id', remedio._id);
            container.appendChild(card);

            card.innerHTML = `
                <div class="info-remedio-corpo">
                    <h3 class="remedio-titulo-txt">${remedio.nome}</h3>
                    <p><strong>Compartimento (Slot):</strong> <span class="remedio-slot-txt">${remedio.slot || 'Nenhum'}</span></p>
                    <p><strong>Início:</strong> <span class="remedio-data-txt">${dataFormatadaStr}</span></p>
                    <p><strong>Frequência:</strong> A cada <span class="remedio-freq-txt">${remedio.frequenciaDias}</span> dia(s)</p>
                    <p><strong>Duração:</strong> <span class="remedio-duracao-txt">${remedio.duracaoTratamento}</span> dias</p>
                    <p><strong>Dose por horário:</strong> <span class="remedio-qtd-txt">${remedio.quantidade}</span> pílula(s)</p>
                    <p><strong>Horários Agendados:</strong> <span class="remedio-horas-txt" style="color: #0284c7; font-weight: 500;">${textoHorarios}</span></p>
                </div>
                <div class="acoes-remedio-container" style="display: flex; gap: 8px; margin-top: 12px; border-top: 1px dashed #eee; padding-top: 8px;">
                    <button class="btn-editar-remedio" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">Editar</button>
                    <button class="btn-deletar-remedio" style="background: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">Excluir</button>
                </div>
            `;

            card.querySelector('.btn-editar-remedio').addEventListener('click', () => prepararEdicaoRemedio(remedio));
            card.querySelector('.btn-deletar-remedio').addEventListener('click', () => deletarRemedioDoBackend(remedio._id));
        } else {
            card.querySelector('.remedio-titulo-txt').innerText = remedio.nome;
            card.querySelector('.remedio-slot-txt').innerText = remedio.slot || 'Nenhum';
            card.querySelector('.remedio-data-txt').innerText = dataFormatadaStr;
            card.querySelector('.remedio-freq-txt').innerText = remedio.frequenciaDias;
            card.querySelector('.remedio-duracao-txt').innerText = remedio.duracaoTratamento;
            card.querySelector('.remedio-qtd-txt').innerText = remedio.quantidade;
            card.querySelector('.remedio-horas-txt').innerText = textoHorarios;
        }
    });

    const todosCardsMeusRemedios = container.querySelectorAll('.card-meu-remedio');
    todosCardsMeusRemedios.forEach(card => {
        const idCard = card.getAttribute('data-id');
        const existeAinda = remediosAgendados.some(r => r._id === idCard);
        if (!existeAinda) card.remove();
    });
}

function prepararEdicaoRemedio(remedio) {
    abrirModalRemedio();
    
    document.getElementById('id-remedio').value = remedio._id;
    document.getElementById('nome-remedio').value = remedio.nome;
    document.getElementById('slot-remedio').value = remedio.slot || "";
    document.getElementById('data-inicio').value = remedio.dataInicio;
    document.getElementById('frequencia').value = remedio.frequenciaDias;
    document.getElementById('duracao').value = remedio.duracaoTratamento;
    document.getElementById('qtd-pilulas').value = remedio.quantidade;

    containerHorarios.innerHTML = '<label class="label-estilizada">Horários</label>';
    remedio.horarios.forEach((hora) => {
        const div = document.createElement('div');
        div.classList.add('horario-item');
        div.innerHTML = `<input type="time" class="input-horario" value="${hora}" step="60">`;
        containerHorarios.appendChild(div);
    });

    const inputs = containerHorarios.querySelectorAll('.input-horario');
    if (inputs.length > 0) {
        inputs[inputs.length - 1].addEventListener('change', adicionarNovoCampoHorario);
    }
}

async function deletarRemedioDoBackend(id) {
    if (!confirm("Tem certeza que deseja excluir este medicamento permanentemente?")) return;

    try {
        const resposta = await fetch(`${API_URL}/remedios/${id}`, { method: 'DELETE' });
        if (resposta.ok) {
            await carregarRemediosDoBackend();
            sincronizarAgendaGeralComHardware();
        } else {
            alert("Não foi possível excluir o medicamento do servidor.");
        }
    } catch (erro) {
        console.error("Erro na requisição DELETE:", erro);
    }
}

// ==========================================================================
// TELA SECÇÃO: ESTOQUE INTERATIVO E REPOSIÇÃO AUTOMÁTICA
// ==========================================================================
let remediomSendoEditadoId = null;
let debounceTimeoutEstoque = null; 

function renderizarTelaEstoque() {
    const container = document.getElementById('lista-estoque-remedios');
    if (!container) return;

    if (remediosAgendados.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #666; padding: 20px;">Nenhum remédio agendado para controle de estoque.</p>`;
        return;
    }

    remediosAgendados.forEach(remedio => {
        if (remedio.estoque === undefined) remedio.estoque = 10;
        if (!remedio.diasReposicao) remedio.diasReposicao = [];

        const doseDiaria = (parseInt(remedio.quantidade) || 1) * remedio.horarios.length;
        const textoData = remedio.diasReposicao.length > 0 ? remedio.diasReposicao[0].split('-').reverse().join('/') : 'A calcular...';

        let card = container.querySelector(`.card-estoque[data-id="${remedio._id}"]`);
        
        if (!card) {
            card = document.createElement('div');
            card.classList.add('card-estoque');
            card.setAttribute('data-id', remedio._id);
            container.appendChild(card);
            
            card.innerHTML = `
                <h3>${remedio.nome}</h3>
                <p style="font-size: 0.85rem; color: #666;">Consumo diário: <strong class="dose-diaria-txt">${doseDiaria} pílula(s)</strong></p>
                <div class="contador-container">
                    <input type="number" 
                    class="numero-estoque" 
                    id="qtd-estoque-${remedio._id}" 
                    value="${remedio.estoque}" 
                    min="0" 
                    style="width: 70px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px; text-align: center;">
                </div>
                <div style="font-size: 0.85rem; color: #444; border-top: 1px dashed #ddd; padding-top: 8px;" class="previsao-reposicao-txt">
                    📅 <strong>Reposição prevista:</strong> ${textoData}
                </div>
            `;

            const inputElement = card.querySelector('.numero-estoque');
            
            inputElement.addEventListener('focus', () => { remediomSendoEditadoId = remedio._id; });
            inputElement.addEventListener('input', (e) => { 
                remediomSendoEditadoId = remedio._id; 
                atualizarEstoqueDigitado(remedio._id, e.target.value); 
            });
            inputElement.addEventListener('blur', () => {
                setTimeout(() => { if (remediomSendoEditadoId === remedio._id) remediomSendoEditadoId = null; }, 2000);
            });
        } else {
            const previsaoTxt = card.querySelector('.previsao-reposicao-txt');
            if (previsaoTxt) previsaoTxt.innerHTML = `📅 <strong>Reposição prevista:</strong> ${textoData}`;

            const doseTxt = card.querySelector('.dose-diaria-txt');
            if (doseTxt) doseTxt.innerText = `${doseDiaria} pílula(s)`;

            const inputElement = card.querySelector('.numero-estoque');
            if (inputElement && remediomSendoEditadoId !== remedio._id) {
                inputElement.value = remedio.estoque;
            }
        }

        if (remedio.estoque <= 5) card.classList.add('estoque-baixo');
        else card.classList.remove('estoque-baixo');
    });
}

function calcularAutomaticoReposicao(id) {
    const remedio = remediosAgendados.find(r => r._id === id);
    if (!remedio || !remedio.dataInicio) return;

    const doseDiaria = (parseInt(remedio.quantidade) || 1) * (remedio.horarios ? remedio.horarios.length : 1);
    if (doseDiaria === 0) {
        remedio.diasReposicao = [];
        return;
    }

    const diasRestantes = Math.floor((parseInt(remedio.estoque) || 0) / doseDiaria);
    const partesData = remedio.dataInicio.split('-'); 
    if (partesData.length !== 3) return;

    const dataInicioTratamento = new Date(partesData[0], partesData[1] - 1, partesData[2]);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let dataPartida = dataInicioTratamento > hoje ? dataInicioTratamento : hoje;
    const dataEsgotamento = new Date(dataPartida);
    dataEsgotamento.setDate(dataPartida.getDate() + diasRestantes);

    const dataFinalFormatada = `${dataEsgotamento.getFullYear()}-${String(dataEsgotamento.getMonth() + 1).padStart(2, '0')}-${String(dataEsgotamento.getDate()).padStart(2, '0')}`;
    remedio.diasReposicao = [dataFinalFormatada];

    const card = document.querySelector(`.card-estoque[data-id="${id}"]`);
    if (card) {
        const previsaoTxt = card.querySelector('.previsao-reposicao-txt');
        if (previsaoTxt) previsaoTxt.innerHTML = `📅 <strong>Reposição prevista:</strong> ${dataFinalFormatada.split('-').reverse().join('/')}`;
    }
}

function atualizarEstoqueDigitado(id, valor) {
    remediomSendoEditadoId = id;

    let novoEstoque = parseInt(valor);
    if (isNaN(novoEstoque) || novoEstoque < 0) novoEstoque = 0;

    const remedioLocal = remediosAgendados.find(r => r._id === id);
    if (remedioLocal) remedioLocal.estoque = novoEstoque;

    const card = document.querySelector(`.card-estoque[data-id="${id}"]`);
    if (card) {
        if (novoEstoque <= 5) card.classList.add('estoque-baixo');
        else card.classList.remove('estoque-baixo');
    }
    calcularAutomaticoReposicao(id);

    if (debounceTimeoutEstoque) clearTimeout(debounceTimeoutEstoque);

    debounceTimeoutEstoque = setTimeout(async () => {
        try {
            await fetch(`${API_URL}/remedios/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estoque: novoEstoque })
            });
        } catch (erro) {
            console.error("❌ Erro ao salvar estoque:", erro);
        }
    }, 600);
}

// ==========================================================================
// NOTIFICAÇÕES DO NAVEGADOR
// ==========================================================================
function enviarNotificacaoNavegador(nome, hora, quantidade, slot) {
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
        const titulo = `💊 Hora do Medicamento!`;
        const opcoes = {
            body: `Está na hora de tomar ${quantidade} pílula(s) de "${nome}".\n${slot ? `Retire do Compartimento: ${slot}` : ''}`,
            tag: `tomar-${nome}-${hora}`, 
            icon: 'https://cdn-icons-png.flaticon.com/512/883/883360.png',
            requireInteraction: true
        };

        const notificacao = new Notification(titulo, opcoes);
        notificacao.onclick = function() { window.focus(); this.close(); };
    }
}

function enviarNotificacaoReestoque(nomeMedicamento, slot) {
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
        const titulo = `📦 Reestoque Necessário!`;
        const opcoes = {
            body: `O estoque de "${nomeMedicamento}" está previsto para acabar hoje.\n${slot ? `Abasteça o Compartimento: ${slot}` : ''}`,
            tag: `reestoque-${nomeMedicamento}`,
            requireInteraction: true
        };

        const notificacao = new Notification(titulo, opcoes);
        notificacao.onclick = function() {
            window.focus();
            const itemMenuEstoque = document.querySelector('[data-target="tela-estoque"]');
            if (itemMenuEstoque) itemMenuEstoque.click();
            this.close();
        };
    }
}

// ==========================================================================
// GATILHOS DE INICIALIZAÇÃO DA APLICAÇÃO
// ==========================================================================
if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
    Notification.requestPermission();
}

inicializarMQTT();
carregarRemediosDoBackend();

setInterval(verificarEGerenciarHorarios, 60000);
setInterval(carregarRemediosDoBackend, 5000);

let debounceTimeoutResize = null;
window.addEventListener('resize', () => {
    if (debounceTimeoutResize) clearTimeout(debounceTimeoutResize);
    debounceTimeoutResize = setTimeout(() => { renderCalendar(); }, 250);
});
