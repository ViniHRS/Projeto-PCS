// --- SELEÇÃO DE ELEMENTOS ---
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

// --- 5. SALVAMENTO (LOCAL STORAGE) ---
formRemedio.addEventListener('submit', (e) => {
    e.preventDefault();

    const novoRemedio = {
        id: Date.now(), // ID único para cada agendamento
        nome: document.getElementById('nome-remedio').value,
        slot: document.getElementById('slot-remedio').value,
        dataInicio: document.getElementById('data-inicio').value,
        frequenciaDias: parseInt(document.getElementById('frequencia').value),
        duracaoTratamento: parseInt(document.getElementById('duracao').value),
        quantidade: document.getElementById('qtd-pilulas').value,
        horarios: Array.from(document.querySelectorAll('.input-horario'))
                       .map(input => input.value)
                       .filter(v => v !== "")
    };

    // Adicionar ao array e salvar no LocalStorage
    remediosAgendados.push(novoRemedio);
    localStorage.setItem('remedios', JSON.stringify(remediosAgendados));

    alert(`Sucesso! ${novoRemedio.nome} foi guardado.`);
    modalRemedio.style.display = "none";
    resetarFormulario();
});

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
        document.getElementById(targetId).style.display = 'block';
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
