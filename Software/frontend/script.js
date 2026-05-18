// --- SELEÇÃO DE ELEMENTOS ---
const menuBtn = document.getElementById('menuBtn');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const menuItems = document.querySelectorAll('.menu-item');
const sections = document.querySelectorAll('.content-section');
sections.forEach(section => section.style.display = 'none');
const calendario = document.getElementById('tela-calendario');
if (calendario) calendario.style.display = 'block';
// Modais
const modalRemedio = document.getElementById('modal-remedio'); 
const modalLista = document.getElementById('modal-lista-dia'); 
const fecharModalCadastro = document.getElementById('fechar-modal');
const fecharModalLista = document.getElementById('fechar-lista-dia');

const remedioBtn = document.getElementById('remedioBtn'); 
const formRemedio = document.getElementById('form-remedio');
const containerHorarios = document.getElementById('container-horarios');

// Calendário
const monthYear = document.getElementById('monthYear');
const daysContainer = document.getElementById('days');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');

const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
let date = new Date();
let currentMonth = date.getMonth();
let currentYear = date.getFullYear();

// --- NOVO: ARRAY GLOBAL DE REMÉDIOS (CARREGADO DO LOCALSTORAGE) ---
let remediosAgendados = JSON.parse(localStorage.getItem('remedios')) || [];

// --- 1. VISUALIZAÇÃO (CLIQUE NO CALENDÁRIO) ---
function verRemediosDoDia(dia, mes, ano) {
    const tituloLista = document.getElementById('titulo-lista-dia');
    const containerLista = document.getElementById('lista-remedios-container');
    
    if (tituloLista) {
        tituloLista.innerText = `Remédios - ${dia}/${mes + 1}/${ano}`;
    }

    // Limpar lista anterior
    containerLista.innerHTML = "";

    // Criar data do dia clicado para comparação
    const dataClicada = new Date(ano, mes, dia);
    
    // Filtrar remédios que devem ser tomados neste dia
    const remediosDoDia = remediosAgendados.filter(remedio => {
        const inicio = new Date(remedio.dataInicio + 'T00:00:00');
        const fim = new Date(inicio);
        fim.setDate(inicio.getDate() + remedio.duracaoTratamento - 1);

        // Verifica se a data está dentro do intervalo do tratamento
        if (dataClicada >= inicio && dataClicada <= fim) {
            const diffTempo = Math.abs(dataClicada - inicio);
            const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24));
            // Verifica a frequência
            return diffDias % remedio.frequenciaDias === 0;
        }
        return false;
    });

    if (remediosDoDia.length > 0) {
        remediosDoDia.forEach(remedio => {
            const item = document.createElement('div');
            item.classList.add('card-remedio-dia');

            const horarioBadges = remedio.horarios
                .map(hora => `<span class="badge-slot">${hora}</span>`)
                .join('');

            item.innerHTML = `
                <div>
                    <span class="nome-medicamento">${remedio.nome}</span><br>
                    <span class="card-info">Dose: ${remedio.quantidade} pílula(s)</span>
                </div>
                <div class="horarios-container-lista">
                    ${horarioBadges}
                </div>
            `;
            containerLista.appendChild(item);
        });
    } else {
        containerLista.innerHTML = '<p style="color: #999; text-align: center;">Nenhum remédio para hoje.</p>';
    }
    
    if (modalLista) modalLista.style.display = "block";
}

// --- 2. CADASTRO ---
function abrirModalRemedio() {
    const inputDataInicio = document.getElementById('data-inicio');
    const hoje = new Date().toISOString().split('T')[0];
    if (inputDataInicio) inputDataInicio.value = hoje;
    modalRemedio.style.display = "block";
}

// --- 3. FECHAMENTO ---
if (fecharModalCadastro) fecharModalCadastro.onclick = () => { modalRemedio.style.display = "none"; resetarFormulario(); };
if (fecharModalLista) fecharModalLista.onclick = () => { modalLista.style.display = "none"; };

window.onclick = (event) => {
    if (event.target == modalRemedio) { modalRemedio.style.display = "none"; resetarFormulario(); }
    if (event.target == modalLista) modalLista.style.display = "none";
};

if (remedioBtn) remedioBtn.addEventListener('click', abrirModalRemedio);

// --- 4. HORÁRIOS ---
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
    document.getElementById('frequencia').value = "1"; 
    containerHorarios.innerHTML = `
        <label class="label-estilizada">Horários</label>
        <div class="horario-item">
            <input type="time" class="input-horario" step="60" required>
        </div>
    `;
    containerHorarios.querySelector('.input-horario').addEventListener('change', adicionarNovoCampoHorario);
}

// --- 5. SALVAMENTO UNIFICADO (CADASTRO E EDIÇÃO) ---
formRemedio.addEventListener('submit', (e) => {
    e.preventDefault();

    // Captura o ID oculto para saber se estamos editando ou cadastrando
    const idExistente = document.getElementById('id-remedio').value;
    
    // Captura os dados inseridos em formato de objeto estruturado
    const dadosForm = {
        nome: document.getElementById('nome-remedio').value,
        slot: document.getElementById('slot-remedio').value || "",
        dataInicio: document.getElementById('data-inicio').value,
        frequenciaDias: parseInt(document.getElementById('frequencia').value),
        duracaoTratamento: parseInt(document.getElementById('duracao').value),
        quantidade: document.getElementById('qtd-pilulas').value,
        horarios: Array.from(document.querySelectorAll('.input-horario'))
                       .map(input => input.value)
                       .filter(v => v !== "")
    };

    if (idExistente) {
        // MODO EDIÇÃO: Encontra o remédio no array pelo ID e o substitui
        const index = remediosAgendados.findIndex(r => r.id == idExistente);
        if (index !== -1) {
            remediosAgendados[index] = { id: parseInt(idExistente), ...dadosForm };
            alert(`Alterações salvas com sucesso!`);
        }
    } else {
        // MODO CADASTRO NOVO: Cria um identificador único usando o timestamp atual
        const novoRemedio = { id: Date.now(), ...dadosForm };
        remediosAgendados.push(novoRemedio);
        alert(`Sucesso! ${novoRemedio.nome} foi guardado.`);
    }

    // Grava as alterações no LocalStorage do usuário
    localStorage.setItem('remedios', JSON.stringify(remediosAgendados));
    
    // Fecha o modal e limpa os campos
    modalRemedio.style.display = "none";
    resetarFormulario();
    
    // Recarrega visualmente ambas as telas para exibir as mudanças imediatamente
    if (typeof renderCalendar === "function") renderCalendar();
    if (typeof renderizarMeusRemedios === "function") renderizarMeusRemedios();
});

// Função para resetar/limpar o formulário de cadastro totalmente
function resetarFormulario() {
    formRemedio.reset();
    
    // Limpa o ID oculto para evitar que um novo cadastro herde o ID de uma edição anterior
    const inputId = document.getElementById('id-remedio');
    if (inputId) inputId.value = "";

    // Restaura o container de horários deixando apenas o primeiro campo padrão vazio
    containerHorarios.innerHTML = `
        <label class="label-estilizada">Horários</label>
        <div class="horario-item">
            <input type="time" class="input-horario" step="60" required>
        </div>
    `;
    
    // Reatribui o listener dinâmico de novos campos de horários ao primeiro input
    const primeiroInput = containerHorarios.querySelector('.input-horario');
    if (primeiroInput) {
        primeiroInput.addEventListener('change', adicionarNovoCampoHorario);
    }
}

// Vincula o botão clássico de fechar "X" do modal para também resetar o form limpo
if (fecharModalCadastro) {
    fecharModalCadastro.addEventListener('click', () => {
        modalRemedio.style.display = "none";
        resetarFormulario();
    });
}


// --- 6. CALENDÁRIO ---
function renderCalendar() {
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
        dayDiv.addEventListener('click', () => verRemediosDoDia(i, currentMonth, currentYear));
        daysContainer.appendChild(dayDiv);
    }
}

prevBtn.addEventListener("click", () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
});

nextBtn.addEventListener("click", () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
});

// --- 7. MENU ---
function toggleMenu() {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

menuBtn.addEventListener('click', toggleMenu);
overlay.addEventListener('click', toggleMenu);

menuItems.forEach(item => {
    item.addEventListener('click', () => {
        const targetId = item.getAttribute('data-target');
        sections.forEach(section => section.style.display = 'none');

        const targetSection = document.getElementById(targetId);
        if (targetSection) targetSection.style.display = 'block';

        if (targetId === 'tela-remedios') {
            renderizarMeusRemedios();
        }
        toggleMenu();
    });
});

// --- 8. CLIQUE NA LOGO DIRECIONA PARA O CALENDÁRIO ---
const logoLink = document.getElementById('logo-link');

if (logoLink) {
    logoLink.addEventListener('click', () => {
        window.location.href = window.location.origin + window.location.pathname;
    });
}

renderCalendar();

// --- 9. TELA MEUS REMÉDIOS: RENDERIZAR, EDITAR E ELIMINAR ---

// Função responsável por desenhar a lista completa de medicamentos na tela "Meus Remédios"
function renderizarMeusRemedios() {
    const containerGrid = document.getElementById('lista-geral-remedios');
    if (!containerGrid) return;

    containerGrid.innerHTML = "";

    if (remediosAgendados.length === 0) {
        containerGrid.innerHTML = `<p style="grid-column: 1/-1; color: #666; text-align: center; padding: 40px;">Você ainda não tem nenhum remédio agendado.</p>`;
        return;
    }

    remediosAgendados.forEach(remedio => {
        const card = document.createElement('div');
        card.classList.add('card-remedio-geral');

        // Formata a exibição dos horários cadastrados
        const listaHorarios = remedio.horarios.join(', ');

        card.innerHTML = `
            <div class="card-remedio-corpo">
                <h3>${remedio.nome}</h3>
                ${remedio.slot ? `<p><strong>Slot CIDRA:</strong> ${remedio.slot}</p>` : ''}
                <p><strong>Início:</strong> ${remedio.dataInicio.split('-').reverse().join('/')}</p>
                <p><strong>Duração:</strong> ${remedio.duracaoTratamento} dia(s)</p>
                <p><strong>Frequência:</strong> A cada ${remedio.frequenciaDias} dia(s)</p>
                <p><strong>Dose:</strong> ${remedio.quantidade} pílula(s)</p>
                <p><strong>Horários:</strong> ${listaHorarios}</p>
            </div>
            <div class="card-remedio-acoes">
                <button class="btn-acao btn-editar" onclick="prepararEdicao(${remedio.id})">Editar</button>
                <button class="btn-acao btn-eliminar" onclick="eliminarRemedio(${remedio.id})">Eliminar</button>
            </div>
        `;
        containerGrid.appendChild(card);
    });
}

// Função que puxa os dados do remédio do array e joga de volta no formulário do modal
function prepararEdicao(id) {
    const remedio = remediosAgendados.find(r => r.id === id);
    if (!remedio) return;

    // Preenche o campo oculto identificador e os visíveis
    document.getElementById('id-remedio').value = remedio.id;
    document.getElementById('nome-remedio').value = remedio.nome;
    document.getElementById('slot-remedio').value = remedio.slot;
    document.getElementById('data-inicio').value = remedio.dataInicio;
    document.getElementById('duracao').value = remedio.duracaoTratamento;
    document.getElementById('frequencia').value = remedio.frequenciaDias;
    document.getElementById('qtd-pilulas').value = remedio.quantidade;

    // Limpa e reconstrói os campos dinâmicos de horários baseando-se no remédio salvo
    containerHorarios.innerHTML = `<label class="label-estilizada">Horários</label>`;
    
    remedio.horarios.forEach((hora, index) => {
        const novoDiv = document.createElement('div');
        novoDiv.classList.add('horario-item');
        novoDiv.innerHTML = `<input type="time" class="input-horario" value="${hora}" step="60" ${index === 0 ? 'required' : ''}>`;
        containerHorarios.appendChild(novoDiv);
    });

    // Reatribui o ouvinte para criar novos campos dinâmicos caso mude o último horário
    const inputs = containerHorarios.querySelectorAll('.input-horario');
    inputs[inputs.length - 1].addEventListener('change', adicionarNovoCampoHorario);

    // Abre o modal de cadastro (que agora atua como edição)
    modalRemedio.style.display = "block";
}

// Função para apagar permanentemente um agendamento
function eliminarRemedio(id) {
    if (confirm("Tem certeza que deseja apagar este agendamento de remédio?")) {
        remediosAgendados = remediosAgendados.filter(r => r.id !== id);
        localStorage.setItem('remedios', JSON.stringify(remediosAgendados));
        renderizarMeusRemedios(); // Atualiza a tela imediatamente
        renderCalendar();         // Atualiza as marcações do calendário em background
    }
}
