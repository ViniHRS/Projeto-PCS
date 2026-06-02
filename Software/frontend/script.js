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
const API_URL = 'http://localhost:3000/api';
let remediosAgendados = [];
let historicoTomadas = [];

// ==========================================================================
// BACKEND
// ==========================================================================
async function carregarRemediosDoBackend() {
    try {
        // Procura os remédios ativos
        const respostaRemedios = await fetch(`${API_URL}/remedios`);
        remediosAgendados = await respostaRemedios.json();

        // Procura todo o histórico de tomadas
        const respostaHistorico = await fetch(`${API_URL}/historico`);
        historicoTomadas = await respostaHistorico.json();

        // Atualiza a parte visual dinâmica
        renderCalendar();
        atualizarProximoHorarioTela();
        
        // Se o utilizador estiver na tela de estoque ou lista geral, atualiza em background
        const telaEstoque = document.getElementById('tela-estoque');
        if (telaEstoque && telaEstoque.style.display === 'block') renderizarTelaEstoque();
        
        const telaMeusRemedios = document.getElementById('tela-remedios');
        if (telaMeusRemedios && telaMeusRemedios.style.display === 'block') renderizarMeusRemedios();

    } catch (erro) {
        console.error("Erro na sincronização com o servidor backend:", erro);
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

if (fecharModalCadastro) {
    fecharModalCadastro.onclick = function() {
        modalRemedio.style.display = "none";
        overlay.style.display = "none";
        
        // CORREÇÃO: Limpa o formulário e o ID oculto para não misturar Cadastro com Edição
        formRemedio.reset();
        document.getElementById('id-remedio').value = ""; 
        
        // Reseta o container de horários deixando apenas o campo inicial limpo
        containerHorarios.innerHTML = `
            <label class="label-estilizada">Horários</label>
            <div class="horario-item">
                <input type="time" class="input-horario" step="60" required>
            </div>
        `;
        // Reatribui o ouvinte ao primeiro campo gerado
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
        // Garante que o ID está vazio para o sistema saber que é um NOVO cadastro
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
let debounceTimeoutFormulario = null; // Controla o atraso para digitação no formulário
if (formRemedio) {
    formRemedio.onsubmit = async function(e) {
        e.preventDefault(); // Impede a página de recarregar e quebrar a aplicação

        // Coleta os horários preenchidos dinamicamente
        const inputsHorarios = containerHorarios.querySelectorAll('.input-horario');
        const horarios = [];
        inputsHorarios.forEach(input => {
            if (input.value) horarios.push(input.value);
        });

        if (horarios.length === 0) {
            alert("Por favor, adicione pelo menos um horário para o medicamento.");
            return;
        }

        // Captura o ID caso seja uma edição (campo hidden no HTML)
        const idRemedio = document.getElementById('id-remedio').value;

        // Monta o objeto com os dados estruturados idênticos ao Banco de Dados
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

            // Se existir um ID, significa que estamos EDITANDO um remédio existente
            if (idRemedio) {
                url = `${API_URL}/remedios/${idRemedio}`;
                metodo = 'PUT';
            } else {
                // Se for um novo remédio, definimos um estoque inicial padrão (ex: 10 pílulas)
                dadosRemedio.estoque = 10; 
            }

            console.log(`📡 Enviando dados do formulário (${metodo}):`, dadosRemedio);

            const resposta = await fetch(url, {
                method: metodo,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dadosRemedio)
            });

            if (resposta.ok) {
                console.log("✅ Agenda salva com sucesso no banco de dados!");
                
                // Limpa o formulário e reseta o campo de ID oculto
                formRemedio.reset();
                document.getElementById('id-remedio').value = "";
                
                fecharModalCadastro.click(); // Fecha o modal visualmente
                
                // Recarrega os dados imediatamente do backend para atualizar a tela
                await carregarRemediosDoBackend(); 
            } else {
                const erroServidor = await resposta.json();
                alert(`Erro ao salvar: ${erroServidor.message || 'Verifique os dados enviados.'}`);
            }

        } catch (erro) {
            console.error("❌ Erro de rede ao submeter o formulário:", erro);
            alert("Não foi possível conectar ao servidor backend.");
        }
    };
}

async function verificarSeRemedioJaExiste(nome) {
    try {
        // Faz uma busca simulada ou real no seu backend
        // Ex: const resposta = await fetch(`${API_URL}/remedios/verificar?nome=${encodeURIComponent(nome)}`);
        
        // No seu caso local, podemos validar diretamente contra o array que já está na memória:
        const existeNoArray = remediosAgendados.some(r => r.nome.toLowerCase() === nome.toLowerCase());

        const mensagemAviso = document.getElementById('aviso-nome-duplicado'); // Elemento HTML opcional para alertas

        if (existeNoArray) {
            console.warn("⚠️ Este medicamento já está cadastrado no seu sistema!");
            
            // Exemplo de feedback visual para o utilizador:
            if (mensagemAviso) {
                mensagemAviso.innerText = "⚠️ Já tem um medicamento agendado com este nome.";
                mensagemAviso.style.display = "block";
            }
        } else {
            if (mensagemAviso) {
                mensagemAviso.style.display = "none";
            }
        }
    } catch (erro) {
        console.error("Erro ao validar nome do remédio:", erro);
    }
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

    // PRIMEIRA RENDERIZAÇÃO OU MUDANÇA DE MÊS: Só Reconstrói se o número de elementos mudou
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
            dayDiv.setAttribute('data-dia', i); // Marcador para atualização rápida do Polling

            // Evento fixo atrelado uma única vez ao elemento
            dayDiv.addEventListener('click', () => verRemediosDoDia(i, currentMonth, currentYear));
            daysContainer.appendChild(dayDiv);
        }
    }

    // ATUALIZAÇÃO RÁPIDA (POLLING SEGURO): Apenas manipula classes nos elementos existentes
    for (let i = 1; i <= lastDay; i++) {
        const dayDiv = daysContainer.querySelector(`div[data-dia="${i}"]`);
        if (!dayDiv) continue;

        // Reset inicial de classes dinâmicas
        dayDiv.classList.remove("today", "dia-medicamento", "dia-reposicao");

        if (i === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()) {
            dayDiv.classList.add("today");
        }

        const dataLoop = new Date(currentYear, currentMonth, i);
        const dataFormatada = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

        // Verifica remédios agendados de forma otimizada
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

    atualizarProximoHorarioTela();
}

let emEsperaTrocaMes = false;
if (prevBtn) {
    prevBtn.onclick = () => {
        if (emEsperaTrocaMes) return; // Ignora o clique se clicou rápido demais

        emEsperaTrocaMes = true;
        currentMonth--; 
        if (currentMonth < 0) { currentMonth = 11; currentYear--; } 
        renderCalendar();

        // Libera o botão novamente após 300 milissegundos
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
                        <button class="btn-tomou ${classeTomado}" onclick="registrarTomada('${dataFormatada}', '${remedio._id}', '${hora}', 'tomado')">Tomar</button>
                        <button class="btn-nao-tomou ${classePular}" onclick="registrarTomada('${dataFormatada}', '${remedio._id}', '${hora}', 'esquecido')">Pular</button>
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

async function registrarTomada(dataFormatada, remedioId, horario, status) {
    try {
        // Envia o registo em tempo real para a base de dados centralizada
        const resposta = await fetch(`${API_URL}/historico`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dataFormatada,
                remedioId,
                horario,
                status
            })
        });

        if (resposta.ok) {
            // Recarrega os remédios (porque o stock diminui no banco) e atualiza o ecrã
            await carregarRemediosDoBackend();
            
            // Reabre ou atualiza a listagem do dia que o utilizador está a ver
            const dataPartes = dataFormatada.split('-');
            verRemediosDoDia(parseInt(dataPartes[2]), parseInt(dataPartes[1]) - 1, parseInt(dataPartes[0]));
        } else {
            console.error("Servidor recusou o registo da tomada.");
        }
    } catch (erro) {
        console.error("Erro ao registar tomada na API:", erro);
    }
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
                    // Mudado para ._id
                    const jaRespondido = historicoTomadas.some(h => 
                        h.dataFormatada === dataFormatadaHoje && 
                        h.remedioId === remedio._id && 
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
        
        // Mudado para r._id envolvido em aspas simples
        htmlGerado += `
            <div class="linha-remedio-proximo">
                <div>
                    <strong style="color: #0f172a;">${r.nome}</strong>
                    <span style="font-size: 0.8rem; color: #64748b; margin-left: 10px;">Dose: ${r.quantidade} pílula(s)</span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-tomou" onclick="registrarTomadaProximo('${dataFormatadaHoje}', '${r._id}', '${proximaHoraAlvo}', 'tomado')">Tomar</button>
                    <button class="btn-nao-tomou" onclick="registrarTomadaProximo('${dataFormatadaHoje}', '${r._id}', '${proximaHoraAlvo}', 'esquecido')">Pular</button>
                </div>
            </div>
        `;
    });

    container.innerHTML = htmlGerado;
}

function registrarTomadaProximo(dataFormatada, remedioId, horario, status) {
    registrarTomada(dataFormatada, remedioId, horario, status);
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

                    // CORRIGIDO: Agora compara corretamente usando o ._id do MongoDB Atlas
                    const jaRespondido = historicoTomadas.some(h => 
                        h.dataFormatada === dataFormatadaHoje && 
                        h.remedioId === remedio._id && 
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
                        // CASO B: O horário já passou há mais de 15 minutos -> MARCA COMO ESQUECIDO
                        else if (horarioRemedioMinutos + 15 < horaAtualMinutos) {
                            registrarTomada(dataFormatadaHoje, remedio._id, hora, 'esquecido');
                        }
                    }
                });
            }
        }
    });
}

// ==========================================================================
// TELA SECÇÃO: MEUS REMÉDIOS (ADICIONADO PARA CORRIGIR O DISPLAY)
// ==========================================================================
function renderizarMeusRemedios() {
    const container = document.getElementById('lista-remedios-geral'); // Certifique-se de que este ID existe no seu HTML
    if (!container) return;

    if (remediosAgendados.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #666; padding: 20px;">Nenhum medicamento cadastrado até o momento.</p>`;
        return;
    }

    // Mantém a estrutura base sem resetar de forma destrutiva (.innerHTML = '')
    if (container.children.length === 0 || container.querySelector('p')) {
        container.innerHTML = '';
    }

    remediosAgendados.forEach(remedio => {
        // Procura se o card deste remédio já está desenhado no ecrã
        let card = container.querySelector(`.card-meu-remedio[data-id="${remedio._id}"]`);

        const textoHorarios = remedio.horarios && remedio.horarios.length > 0 ? remedio.horarios.join(', ') : 'Não definidos';
        const dataFormatadaStr = remedio.dataInicio ? remedio.dataInicio.split('-').reverse().join('/') : '---';

        if (!card) {
            // Se o card não existe, cria-o pela primeira vez
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

            // Atribui as funções aos botões gerados
            card.querySelector('.btn-editar-remedio').addEventListener('click', () => prepararEdicaoRemedio(remedio));
            card.querySelector('.btn-deletar-remedio').addEventListener('click', () => deletarRemedioDoBackend(remedio._id));
        } else {
            // Se o card já existe, apenas atualiza o conteúdo de texto para evitar que a tela pisque com o Polling
            card.querySelector('.remedio-titulo-txt').innerText = remedio.nome;
            card.querySelector('.remedio-slot-txt').innerText = remedio.slot || 'Nenhum';
            card.querySelector('.remedio-data-txt').innerText = dataFormatadaStr;
            card.querySelector('.remedio-freq-txt').innerText = remedio.frequenciaDias;
            card.querySelector('.remedio-duracao-txt').innerText = remedio.duracaoTratamento;
            card.querySelector('.remedio-qtd-txt').innerText = remedio.quantidade;
            card.querySelector('.remedio-horas-txt').innerText = textoHorarios;
        }
    });

    // Remove do ecrã cards de remédios que possam ter sido deletados de outra aba/dispositivo
    const todosCardsMeusRemedios = container.querySelectorAll('.card-meu-remedio');
    todosCardsMeusRemedios.forEach(card => {
        const idCard = card.getAttribute('data-id');
        const existeAinda = remediosAgendados.some(r => r._id === idCard);
        if (!existeAinda) {
            card.remove();
        }
    });
}

// Auxiliar para preencher o formulário automaticamente quando clicar em Editar
function prepararEdicaoRemedio(remedio) {
    abrirModalRemedio();
    
    document.getElementById('id-remedio').value = remedio._id;
    document.getElementById('nome-remedio').value = remedio.nome;
    document.getElementById('slot-remedio').value = remedio.slot || "";
    document.getElementById('data-inicio').value = remedio.dataInicio;
    document.getElementById('frequencia').value = remedio.frequenciaDias;
    document.getElementById('duracao').value = remedio.duracaoTratamento;
    document.getElementById('qtd-pilulas').value = remedio.quantidade;

    // Reconstrói os campos de horários dinamicamente no formulário
    containerHorarios.innerHTML = '<label class="label-estilizada">Horários</label>';
    remedio.horarios.forEach((hora, index) => {
        const div = document.createElement('div');
        div.classList.add('horario-item');
        div.innerHTML = `<input type="time" class="input-horario" value="${hora}" step="60">`;
        containerHorarios.appendChild(div);
    });

    // Adiciona o gatilho no último campo para manter a lógica de novos inputs dinâmicos
    const inputs = containerHorarios.querySelectorAll('.input-horario');
    if (inputs.length > 0) {
        inputs[inputs.length - 1].addEventListener('change', adicionarNovoCampoHorario);
    }
}

// Auxiliar para enviar o comando de remoção para a sua API Node/Express
async function deletarRemedioDoBackend(id) {
    if (!confirm("Tem certeza que deseja excluir este medicamento permanentemente?")) return;

    try {
        const resposta = await fetch(`${API_URL}/remedios/${id}`, {
            method: 'DELETE'
        });

        if (resposta.ok) {
            console.log("✅ Medicamento removido com sucesso.");
            await carregarRemediosDoBackend();
        } else {
            alert("Não foi possível excluir o medicamento do servidor.");
        }
    } catch (erro) {
        console.error("Erro na requisição DELETE:", erro);
    }
}

// ==========================================================================
// TELA SECÇÃO: ESTOQUE INTERATIVO E REPOSIÇÃO AUTOMÁTICA (CORRIGIDO)
// ==========================================================================
let remediomSendoEditadoId = null;
let debounceTimeoutEstoque = null; // Controla o atraso para evitar flood na API

function renderizarTelaEstoque() {
    const container = document.getElementById('lista-estoque-remedios');
    if (!container) return;

    if (remediosAgendados.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #666; padding: 20px;">Nenhum remédio agendado para controlo de estoque.</p>`;
        return;
    }

    // REMOVIDO o container.innerHTML = '' daqui para os cards não sumirem no Polling

    remediosAgendados.forEach(remedio => {
        if (remedio.estoque === undefined) remedio.estoque = 10;
        if (!remedio.diasReposicao) remedio.diasReposicao = [];

        const doseDiaria = (parseInt(remedio.quantidade) || 1) * remedio.horarios.length;
        const textoData = remedio.diasReposicao.length > 0 ? remedio.diasReposicao[0].split('-').reverse().join('/') : 'A calcular...';

        // Procura se o card já existe na tela
        let card = container.querySelector(`.card-estoque[data-id="${remedio._id}"]`);
        
        if (!card) {
            // Se não existe (ex: primeiro carregamento), cria o card do zero
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
            
            inputElement.addEventListener('focus', () => { 
                remediomSendoEditadoId = remedio._id; 
            });

            inputElement.addEventListener('input', (e) => { 
                remediomSendoEditadoId = remedio._id; 
                atualizarEstoqueDigitado(remedio._id, e.target.value); 
            });

            inputElement.addEventListener('blur', () => {
                setTimeout(() => {
                    if (remediomSendoEditadoId === remedio._id) {
                        remediomSendoEditadoId = null;
                    }
                }, 2000); // Aumentado para 2 segundos para dar tempo do Debounce terminar de salvar no Atlas
            });
        } else {
            // SE O CARD JÁ EXISTE: Atualiza os textos de previsão e consumo normalmente (O CARD NÃO SUMIRÁ)
            const previsaoTxt = card.querySelector('.previsao-reposicao-txt');
            if (previsaoTxt) {
                previsaoTxt.innerHTML = `📅 <strong>Reposição prevista:</strong> ${textoData}`;
            }

            const doseTxt = card.querySelector('.dose-diaria-txt');
            if (doseTxt) {
                doseTxt.innerText = `${doseDiaria} pílula(s)`;
            }

            // CRUCIAL: Só atualiza o número escrito se o usuário NÃO estiver mexendo nele agora
            const inputElement = card.querySelector('.numero-estoque');
            if (inputElement && remediomSendoEditadoId !== remedio._id) {
                inputElement.value = remedio.estoque;
            }
        }

        // Atualiza a cor de alerta crítico sem reconstruir o card
        if (remedio.estoque <= 5) {
            card.classList.add('estoque-baixo');
        } else {
            card.classList.remove('estoque-baixo');
        }
    });

    // Remove cards da tela que porventura tenham sido deletados do banco
    const todosCardsNaTela = container.querySelectorAll('.card-estoque');
    todosCardsNaTela.forEach(card => {
        const idCard = card.getAttribute('data-id');
        const aindaExiste = remediosAgendados.some(r => r._id === idCard);
        if (!aindaExiste) {
            card.remove();
        }
    });
}

function calcularAutomaticoReposicao(id) {
    const remedio = remediosAgendados.find(r => r._id === id);
    if (!remedio) return;

    const doseDiaria = (parseInt(remedio.quantidade) || 1) * remedio.horarios.length;
    if (doseDiaria === 0) return;

    const diasRestantes = Math.floor(remedio.estoque / doseDiaria);
    const dataInicioTratamento = new Date(remedio.dataInicio + 'T00:00:00');
    const hoje = new Date();
    hoje.setHours(0,0,0,0);

    let dataPartida = dataInicioTratamento > hoje ? dataInicioTratamento : hoje;
    const dataEsgotamento = new Date(dataPartida);
    dataEsgotamento.setDate(dataPartida.getDate() + diasRestantes);

    const dataFinalFormatada = `${dataEsgotamento.getFullYear()}-${String(dataEsgotamento.getMonth() + 1).padStart(2, '0')}-${String(dataEsgotamento.getDate()).padStart(2, '0')}`;
    
    remedio.diasReposicao = [dataFinalFormatada];

    const card = document.querySelector(`.card-estoque[data-id="${id}"]`);
    if (card) {
        const previsaoTxt = card.querySelector('.previsao-reposicao-txt');
        if (previsaoTxt) {
            previsaoTxt.innerHTML = `📅 <strong>Reposição prevista:</strong> ${dataFinalFormatada.split('-').reverse().join('/')}`;
        }
    }
}

function atualizarEstoqueDigitado(id, valor) {
    remediomSendoEditadoId = id; // Trava o Polling para o card não piscar

    let novoEstoque = parseInt(valor);
    if (isNaN(novoEstoque) || novoEstoque < 0) {
        novoEstoque = 0;
    }

    // 1. ATUALIZAÇÃO LOCAL IMEDIATA: Garante que os cálculos visuais fiquem certos na hora
    const remedioLocal = remediosAgendados.find(r => r._id === id);
    if (remedioLocal) {
        remedioLocal.estoque = novoEstoque;
    }

    const card = document.querySelector(`.card-estoque[data-id="${id}"]`);
    if (card) {
        if (novoEstoque <= 5) card.classList.add('estoque-baixo');
        else card.classList.remove('estoque-baixo');
    }
    calcularAutomaticoReposicao(id);

    // 2. ANTI-FLOOD (DEBOUNCE): Cancela o envio anterior se o utilizador ainda estiver a clicar
    if (debounceTimeoutEstoque) {
        clearTimeout(debounceTimeoutEstoque);
    }

    // Define um atraso de 600ms após o ÚLTIMO clique para finalmente enviar ao servidor
    debounceTimeoutEstoque = setTimeout(async () => {
        try {
            console.log(`📡 [Debounce] Enviando atualização consolidada para o banco:`, { estoque: novoEstoque });
            
            const resposta = await fetch(`${API_URL}/remedios/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estoque: novoEstoque })
            });

            if (!resposta.ok) {
                console.error("❌ O servidor rejeitou a sincronização do estoque.");
            }
        } catch (erro) {
            console.error("❌ Erro de rede ao conectar com a API:", erro);
        }
    }, 600); // 600 milissegundos de espera de segurança
}


// ==========================================================================
// NOTIFICAÇÃO
// ==========================================================================
function dispararNotificacaoMedicamento(nome, hora, quantidade, slot) {
    if ("Notification" in window && Notification.permission === "granted") {
        const titulo = `⏰ Hora do Medicamento: ${nome}`;
        const opcoes = {
            body: `Horário: ${hora}\nDose: ${quantidade} pílula(s)${slot ? `\nCompartimento: ${slot}` : ''}`,
            //icon: 'favicon.ico', // Se tiver um ícone no projeto, coloque o caminho aqui
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

// ==========================================================================
// GATILHOS DE INICIALIZAÇÃO DA APLICAÇÃO
// ==========================================================================

// 1. Pede permissão para as notificações se ainda não tiver pedido
if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
    Notification.requestPermission();
}

// 2. Executa imediatamente quando o site abre
carregarRemediosDoBackend();

// 3. Ciclo de Verificação de Horários (roda a cada minuto para as notificações do navegador)
setInterval(verificarEGerenciarHorarios, 60000);

// 4. Polling de Sincronização do Banco de Dados (roda a cada 5 segundos)
// Isso garante que se o utilizador clicar no botão da CAIXA FÍSICA, o site atualiza a cor sozinho!
setInterval(carregarRemediosDoBackend, 5000);

// 5. Debounce de resize de tela
let debounceTimeoutResize = null;
window.addEventListener('resize', () => {
    if (debounceTimeoutResize) clearTimeout(debounceTimeoutResize);

    debounceTimeoutResize = setTimeout(() => {
        console.log("📐 [Debounce] Tela reajustada. Recalculando componentes necessários...");
        // Se o seu calendário precisar redesenhar para se ajustar ao layout mobile/desktop:
        renderCalendar(); 
    }, 250); // 250ms é o tempo padrão perfeito para resize
});