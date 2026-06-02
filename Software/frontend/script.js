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
let date = new Date();
let currentMonth = date.getMonth();
let currentYear = date.getFullYear();

// Array Global carregado do LocalStorage
let remediosAgendados = JSON.parse(localStorage.getItem('remedios')) || [];
let historicoTomadas = JSON.parse(localStorage.getItem('historicoTomadas')) || [];

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

// Forçar exibição inicial do calendário
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

if (fecharModalCadastro) fecharModalCadastro.onclick = () => { modalRemedio.style.display = "none"; resetarFormulario(); };
if (fecharModalLista) fecharModalLista.onclick = () => { modalLista.style.display = "none"; };

window.onclick = (event) => {
    if (event.target == modalRemedio) { modalRemedio.style.display = "none"; resetarFormulario(); }
    if (event.target == modalLista) modalLista.style.display = "none";
};

if (remedioBtn) remedioBtn.addEventListener('click', abrirModalRemedio);

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
formRemedio.addEventListener('submit', (e) => {
    e.preventDefault();

    const idExistente = document.getElementById('id-remedio').value;
    const dadosForm = {
        nome: document.getElementById('nome-remedio').value,
        slot: document.getElementById('slot-remedio').value || "",
        dataInicio: document.getElementById('data-inicio').value,
        frequenciaDias: parseInt(document.getElementById('frequencia').value),
        duracaoTratamento: parseInt(document.getElementById('duracao').value),
        quantidade: parseInt(document.getElementById('qtd-pilulas').value),
        horarios: Array.from(document.querySelectorAll('.input-horario'))
                       .map(input => input.value)
                       .filter(v => v !== "")
    };

    if (idExistente) {
        const index = remediosAgendados.findIndex(r => r.id == idExistente);
        if (index !== -1) {
            const stockExistente = remediosAgendados[index].estoque !== undefined ? remediosAgendados[index].estoque : 10;
            remediosAgendados[index] = { id: parseInt(idExistente), estoque: stockExistente, diasReposicao: [], ...dadosForm };
            calcularAutomaticoReposicao(parseInt(idExistente));
        }
    } else {
        const novoId = Date.now();
        const novoRemedio = { id: novoId, estoque: 30, diasReposicao: [], ...dadosForm };
        remediosAgendados.push(novoRemedio);
        calcularAutomaticoReposicao(novoId);
    }

    localStorage.setItem('remedios', JSON.stringify(remediosAgendados));
    modalRemedio.style.display = "none";
    resetarFormulario();
    renderCalendar();
    renderizarMeusRemedios();
});

// ==========================================================================
// RENDERIZAÇÃO E CLIQUE DO CALENDÁRIO
// ==========================================================================
function renderCalendar() {
    if (!daysContainer) return;
    daysContainer.innerHTML = "";
    monthYear.innerText = `${months[currentMonth]} ${currentYear}`;
    
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
    const today = new Date();

    for (let i = 0; i < firstDayIndex; i++) {
        const emptyDiv = document.createElement("div");
        emptyDiv.classList.add("empty");
        daysContainer.appendChild(emptyDiv);
    }

    for (let i = 1; i <= lastDay; i++) {
        const dayDiv = document.createElement("div");
        dayDiv.innerText = i;

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

        dayDiv.addEventListener('click', () => verRemediosDoDia(i, currentMonth, currentYear));
        daysContainer.appendChild(dayDiv);
    }

    atualizarProximoHorarioTela();
}

// Ouvintes do calendário unificados (removidas as duplicatas do fim do arquivo)
if (prevBtn) prevBtn.onclick = () => { currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; } renderCalendar(); };
if (nextBtn) nextBtn.onclick = () => { currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; } renderCalendar(); };

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

                const registroValido = historicoTomadas.find(h => h.dataFormatada === dataFormatada && h.remedioId === remedio.id && h.horario === hora);

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
                        <button class="btn-tomou ${classeTomado}" onclick="registrarTomada('${dataFormatada}', ${remedio.id}, '${hora}', 'tomado')">Tomar</button>
                        <button class="btn-nao-tomou ${classePular}" onclick="registrarTomada('${dataFormatada}', ${remedio.id}, '${hora}', 'esquecido')">Pular</button>
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

function registrarTomada(dataFormatada, remedioId, horario, status) {
    if (remediosAgendados.length === 0) return;
    
    const indiceExistente = historicoTomadas.findIndex(h => h.dataFormatada === dataFormatada && h.remedioId === remedioId && h.horario === horario);
    const remedio = remediosAgendados.find(r => r.id === remedioId);
    const dose = parseInt(remedio?.quantidade) || 1;

    if (remedio) {
        if (remedio.estoque === undefined) remedio.estoque = 10;

        if (indiceExistente !== -1) {
            const statusAntigo = historicoTomadas[indiceExistente].status;

            if (statusAntigo === 'tomado' && status === 'esquecido') {
                remedio.estoque += dose;
            }
            else if (statusAntigo === 'esquecido' && status === 'tomado') {
                remedio.estoque = Math.max(0, remedio.estoque - dose);
            }
            historicoTomadas[indiceExistente].status = status;
        } else {
            historicoTomadas.push({ dataFormatada, remedioId, horario, status });
            if (status === 'tomado') {
                remedio.estoque = Math.max(0, remedio.estoque - dose);
            }
        }

        localStorage.setItem('historicoTomadas', JSON.stringify(historicoTomadas));
        localStorage.setItem('remedios', JSON.stringify(remediosAgendados));
        calcularAutomaticoReposicao(remedioId);
    }

    renderCalendar();
    
    const dataPartes = dataFormatada.split('-');
    verRemediosDoDia(parseInt(dataPartes[2]), parseInt(dataPartes[1]) - 1, parseInt(dataPartes[0]));
}

function atualizarProximoHorarioTela() {
    const container = document.getElementById('conteudo-proximo-horario');
    if (!container) return;

    const agora = new Date();
    const hojeAno = agora.getFullYear();
    const hojeMes = String(agora.getMonth() + 1).padStart(2, '0');
    const hojeDia = String(agora.getDate()).padStart(2, '0');
    const dataFormatadaHoje = `${hojeAno}-${hojeMes}-${hojeDia}`;

    let todosHorariosDeHoje = [];

    remediosAgendados.forEach(remedio => {
        const inicio = new Date(remedio.dataInicio + 'T00:00:00');
        const fim = new Date(inicio);
        fim.setDate(inicio.getDate() + remedio.duracaoTratamento - 1);
        
        const hojeSemHora = new Date();
        hojeSemHora.setHours(0,0,0,0);

        if (hojeSemHora >= inicio && hojeSemHora <= fim) {
            const diffTempo = Math.abs(hojeSemHora - inicio);
            const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24));
            
            if (diffDias % remedio.frequenciaDias === 0) {
                remedio.horarios.forEach(hora => {
                    const jaRespondido = historicoTomadas.some(h => 
                        h.dataFormatada === dataFormatadaHoje && 
                        h.remedioId === remedio.id && 
                        h.horario === hora
                    );

                    if (!jaRespondido) {
                        const [h, m] = hora.split(':').map(Number);
                        const totalMinutos = (h * 60) + m;
                        todosHorariosDeHoje.push({ hora, totalMinutos, remedio });
                    }
                });
            }
        }
    });

    if (todosHorariosDeHoje.length === 0) {
        container.innerHTML = `<p style="color: #666; font-size: 0.9rem; margin: 0;">Não há mais nenhum medicamento pendente para o dia de hoje.</p>`;
        return;
    }

    todosHorariosDeHoje.sort((a, b) => a.totalMinutos - b.totalMinutos);

    const proximaHoraAlvo = todosHorariosDeHoje[0].hora;
    const remediosDesteHorario = todosHorariosDeHoje.filter(item => item.hora === proximaHoraAlvo);

    let htmlGerado = `<div class="hora-destaque">⏰ ${proximaHoraAlvo}</div>`;

    remediosDesteHorario.forEach(item => {
        const r = item.remedio;
        
        htmlGerado += `
            <div class="linha-remedio-proximo">
                <div>
                    <strong style="color: #0f172a;">${r.nome}</strong>
                    <span style="font-size: 0.8rem; color: #64748b; margin-left: 10px;">Dose: ${r.quantidade} pílula(s)</span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-tomou" onclick="registrarTomadaProximo('${dataFormatadaHoje}', ${r.id}, '${proximaHoraAlvo}', 'tomado')">Tomar</button>
                    <button class="btn-nao-tomou" onclick="registrarTomadaProximo('${dataFormatadaHoje}', ${r.id}, '${proximaHoraAlvo}', 'esquecido')">Pular</button>
                </div>
            </div>
        `;
    });

    container.innerHTML = htmlGerado;
}

function registrarTomadaProximo(dataFormatada, remedioId, horario, status) {
    registrarTomada(dataFormatada, remedioId, horario, status);
    atualizarProximoHorarioTela();
}

function verificarEGerenciarHorarios() {
    const agora = new Date();
    const hojeAno = agora.getFullYear();
    const hojeMes = String(agora.getMonth() + 1).padStart(2, '0');
    const hojeDia = String(agora.getDate()).padStart(2, '0');
    const dataFormatadaHoje = `${hojeAno}-${hojeMes}-${hojeDia}`;
    
    // Pegamos os minutos totais do dia para comparar atrasos
    const horaAtualMinutos = (agora.getHours() * 60) + agora.getMinutes();
    
    // Pegamos a string exata "HH:MM" para a notificação em tempo real
    const horaMinutoAtualStr = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
    
    let houveAlteracaoNoHistorico = false;

    remediosAgendados.forEach(remedio => {
        const inicio = new Date(remedio.dataInicio + 'T00:00:00');
        const fim = new Date(inicio);
        fim.setDate(inicio.getDate() + remedio.duracaoTratamento - 1);
        
        const hojeSemHora = new Date(agora);
        hojeSemHora.setHours(0,0,0,0);

        // 1. Verifica se o tratamento está dentro do prazo de validade
        if (hojeSemHora >= inicio && hojeSemHora <= fim) {
            const diffTempo = Math.abs(hojeSemHora - inicio);
            const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24));
            
            // 2. Verifica se hoje é o dia correto de acordo com a frequência (ex: a cada 2 dias)
            if (diffDias % remedio.frequenciaDias === 0) {
                remedio.horarios.forEach(hora => {
                    const [h, m] = hora.split(':').map(Number);
                    const horarioRemedioMinutos = (h * 60) + m;

                    // Verifica se este horário específico já foi manipulado pelo utilizador hoje
                    const jaRespondido = historicoTomadas.some(h => 
                        h.dataFormatada === dataFormatadaHoje && 
                        h.remedioId === remedio.id && 
                        h.horario === hora
                    );

                    if (!jaRespondido) {
                        // CASO A: O minuto é EXATAMENTE o agora -> DISPARA NOTIFICAÇÃO
                        if (hora === horaMinutoAtualStr) {
                            dispararNotificacaoMedicamento(
                                remedio.nome, 
                                hora, 
                                remedio.quantidade, 
                                remedio.slot
                            );
                        }
                        // CASO B: O horário já passou -> MARCA COMO ESQUECIDO/ATRASADO
                        else if (horarioRemedioMinutos + 15 < horaAtualMinutos) {
                            historicoTomadas.push({
                                dataFormatada: dataFormatadaHoje,
                                remedioId: remedio.id,
                                horario: hora,
                                status: 'esquecido'
                            });
                            houveAlteracaoNoHistorico = true;
                        }
                    }
                });
            }
        }
    });

    // Se algum remédio antigo passou do limite e virou "esquecido", atualiza o ecrã
    if (houveAlteracaoNoHistorico) {
        localStorage.setItem('historicoTomadas', JSON.stringify(historicoTomadas));
        renderCalendar();
    }
}

// ==========================================================================
// TELA SECÇÃO: MEUS REMÉDIOS (RENDERIZAÇÃO, EDIÇÃO E REMOÇÃO)
// ==========================================================================
function renderizarMeusRemedios() {
    const container = document.getElementById('lista-geral-remedios');
    if (!container) return;
    
    container.innerHTML = "";

    if (remediosAgendados.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #666; padding: 20px;">Nenhum medicamento agendado atualmente.</p>`;
        return;
    }

    remediosAgendados.forEach(remedio => {
        const card = document.createElement('div');
        card.classList.add('card-meu-remedio');

        const listaHorarios = remedio.horarios.map(h => `<span class="badge-slot">${h}</span>`).join(' ');

        card.innerHTML = `
            <div>
                <h3>${remedio.nome}</h3>
                ${remedio.slot ? `<span class="slot-tag">${remedio.slot}</span>` : ''}
                <div class="detalhes-remedio-lista">
                    <div>📅 <strong>Início:</strong> ${remedio.dataInicio.split('-').reverse().join('/')}</div>
                    <div>⏳ <strong>Duração:</strong> ${remedio.duracaoTratamento} dia(s)</div>
                    <div>🔄 <strong>Frequência:</strong> A cada ${remedio.frequenciaDias} dia(s)</div>
                    <div>💊 <strong>Dose:</strong> ${remedio.quantidade} pílula(s)</div>
                    <div style="margin-top: 8px;">⏰ <strong>Horários:</strong> ${listaHorarios}</div>
                </div>
            </div>
            <div class="acoes-remedio-card">
                <button class="btn-editar-remedio" onclick="editarRemedio(${remedio.id})">Editar</button>
                <button class="btn-excluir-remedio" onclick="eliminarRemedio(${remedio.id})">Eliminar</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function editarRemedio(id) {
    const remedio = remediosAgendados.find(r => r.id === id);
    if (!remedio) return;

    document.getElementById('id-remedio').value = remedio.id;
    document.getElementById('nome-remedio').value = remedio.nome;
    document.getElementById('slot-remedio').value = remedio.slot || "";
    document.getElementById('data-inicio').value = remedio.dataInicio;
    document.getElementById('duracao').value = remedio.duracaoTratamento;
    document.getElementById('frequencia').value = remedio.frequenciaDias;
    document.getElementById('qtd-pilulas').value = remedio.quantidade;

    containerHorarios.innerHTML = `<label class="label-estilizada">Horários</label>`;
    
    remedio.horarios.forEach((hora, index) => {
        const novoDiv = document.createElement('div');
        novoDiv.classList.add('horario-item');
        novoDiv.innerHTML = `<input type="time" class="input-horario" value="${hora}" step="60" ${index === 0 ? 'required' : ''}>`;
        containerHorarios.appendChild(novoDiv);
    });

    const divAdicional = document.createElement('div');
    divAdicional.classList.add('horario-item');
    divAdicional.innerHTML = `<input type="time" class="input-horario" step="60">`;
    containerHorarios.appendChild(divAdicional);

    const inputs = containerHorarios.querySelectorAll('.input-horario');
    if (inputs.length > 0) {
        inputs[inputs.length - 1].addEventListener('change', adicionarNovoCampoHorario);
    }

    modalRemedio.style.display = "block";
}

function eliminarRemedio(id) {
    if (confirm("Tem a certeza que deseja apagar este agendamento?")) {
        remediosAgendados = remediosAgendados.filter(r => r.id !== id);
        localStorage.setItem('remedios', JSON.stringify(remediosAgendados));
        renderizarMeusRemedios();
        renderCalendar();
    }
}

// ==========================================================================
// TELA SECÇÃO: ESTOQUE INTERATIVO E REPOSIÇÃO AUTOMÁTICA
// ==========================================================================
function renderizarTelaEstoque() {
    const container = document.getElementById('lista-estoque-remedios');
    if (!container) return;
    container.innerHTML = "";

    if (remediosAgendados.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #666; padding: 20px;">Nenhum remédio agendado para controlo de estoque.</p>`;
        return;
    }

    remediosAgendados.forEach(remedio => {
        if (remedio.estoque === undefined) remedio.estoque = 10;
        if (!remedio.diasReposicao) remedio.diasReposicao = [];

        const card = document.createElement('div');
        card.classList.add('card-estoque');
        if (remedio.estoque <= 5) card.classList.add('estoque-baixo');

        const doseDiaria = (parseInt(remedio.quantidade) || 1) * remedio.horarios.length;

        card.innerHTML = `
            <h3>${remedio.nome}</h3>
            <p style="font-size: 0.85rem; color: #666;">Consumo diário: <strong>${doseDiaria} pílula(s)</strong></p>
            <div class="contador-container">
                <input type="number" 
                class="numero-estoque" 
                id="qtd-estoque-${remedio.id}" 
                value="${remedio.estoque}" 
                min="0" 
                onchange="atualizarEstoqueDigitado(${remedio.id}, this.value)" 
                style="width: 70px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px; text-align: center;">
            </div>
            <div style="font-size: 0.85rem; color: #444; border-top: 1px dashed #ddd; padding-top: 8px;" id="lista-datas-${remedio.id}">
                📅 <strong>Reposição prevista:</strong> ${remedio.diasReposicao.length > 0 ? remedio.diasReposicao[0].split('-').reverse().join('/') : 'A calcular...'}
            </div>
        `;
        container.appendChild(card);
    });
}

function atualizarEstoqueDigitado(id, valor) {
    const remedio = remediosAgendados.find(r => r.id === Number(id));
    if (remedio) {
        let novoEstoque = parseInt(valor);
        if (isNaN(novoEstoque) || novoEstoque < 0) novoEstoque = 0;
        
        remedio.estoque = novoEstoque;
        localStorage.setItem('remedios', JSON.stringify(remediosAgendados));

        const inputEstoque = document.getElementById(`qtd-estoque-${id}`);
        if (inputEstoque) {
            const cardElement = inputEstoque.closest('.card-estoque');
            if (cardElement) {
                if (remedio.estoque <= 5) {
                    cardElement.classList.add('estoque-baixo');
                } else {
                    cardElement.classList.remove('estoque-baixo');
                }
            }
        }
        calcularAutomaticoReposicao(Number(id));
    }
}

function calcularAutomaticoReposicao(id) {
    const remedio = remediosAgendados.find(r => r.id === Number(id));
    if (!remedio) return;

    const doseDiaria = (parseInt(remedio.quantidade) || 1) * remedio.horarios.length;
    if (doseDiaria === 0) return;

    const diasRestantes = Math.floor(remedio.estoque / doseDiaria);
    const dataInicioTratamento = new Date(remedio.dataInicio + 'T00:00:00');
    const hoje = new Date();
    hoje.setHours(0,0,0,0);

    let dataPartina = dataInicioTratamento > hoje ? dataInicioTratamento : hoje;
    const dataEsgotamento = new Date(dataPartina);
    dataEsgotamento.setDate(dataPartina.getDate() + diasRestantes);

    const dataFinalFormatada = `${dataEsgotamento.getFullYear()}-${String(dataEsgotamento.getMonth() + 1).padStart(2, '0')}-${String(dataEsgotamento.getDate()).padStart(2, '0')}`;
    
    remedio.diasReposicao = [dataFinalFormatada];
    localStorage.setItem('remedios', JSON.stringify(remediosAgendados));

    const lbl = document.getElementById(`lista-datas-${id}`);
    if (lbl) {
        lbl.innerHTML = `📅 <strong>Reposição prevista:</strong> ${dataFinalFormatada.split('-').reverse().join('/')}`;
    }
}

// ==========================================================================
// NOTIFICAÇÃO
// ==========================================================================
function dispararNotificacaoMedicamento(nome, hora, quantidade, slot) {
    if ("Notification" in window && Notification.permission === "granted") {
        const titulo = `⏰ Hora do Medicamento: ${nome}`;
        const opcoes = {
            body: `Horário: ${hora}\nDose: ${quantidade} pílula(s)${slot ? `\nCompartimento: ${slot}` : ''}`,
            icon: 'favicon.ico', // Se tiver um ícone no projeto, coloque o caminho aqui
            tag: `${nome}-${hora}`, // Evita notificações duplicadas para o mesmo remédio no mesmo minuto
            requireInteraction: true // A notificação fica visível até o utilizador fechar ou clicar
        };

        const notificacao = new Notification(titulo, opcoes);

        // Opcional: Se o utilizador clicar na notificação, foca/abre a aba do app
        notificacao.onclick = function() {
            window.focus();
            this.close();
        };
    }
}

// Solicitar permissão para notificações do sistema
function solicitarPermissaoNotificacao() {
    if ("Notification" in window) {
        if (Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    }
}

// ==========================================================================
// GATILHOS DE INICIALIZAÇÃO DA APLICAÇÃO
// ==========================================================================

// 1. Pede permissão para as notificações se ainda não tiver pedido
if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
    Notification.requestPermission();
}

// 2. Renderiza o visual inicial do calendário
renderCalendar();

// 3. Executa a primeira verificação logo após abrir o app (com um ligeiro delay seguro)
setTimeout(() => {
    verificarEGerenciarHorarios();
}, 300);

// 4. Executa a verificação unificada a cada 60 segundos
setInterval(verificarEGerenciarHorarios, 60000);