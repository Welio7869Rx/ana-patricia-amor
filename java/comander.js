let editingId = null;

const CONFIG_KEY = "agenda-config";

const configPadrao = {
    notificacoes: true,
    vibracao: true,
    somAlarme: true,
    temaEscuro: false
};

document.addEventListener("DOMContentLoaded", () => {
    atualizarHoraCabecalho();
    setInterval(atualizarHoraCabecalho, 1000);

    const form = document.getElementById("form-agenda");
    const listaCompromissos = document.getElementById("lista-compromissos");
    const tituloInput = document.getElementById("titulo");
    const dataInput = document.getElementById("data");
    const horaInput = document.getElementById("hora");
    const imagemInput = document.getElementById("imagem");
    const alarmeInput = document.getElementById("alarme");
    const btnSalvar = document.getElementById("btn-salvar");
    const btnCancelar = document.getElementById("btn-cancelar");
    const btnConfig = document.getElementById("btn-config");
    const btnFecharConfig = document.getElementById("btn-fechar-config");
    const settingsPanel = document.getElementById("settings-panel");
    const toggleNotificacoes = document.getElementById("toggle-notificacoes");
    const toggleVibracao = document.getElementById("toggle-vibracao");
    const toggleSomAlarme = document.getElementById("toggle-som-alarme");
    const toggleTemaEscuro = document.getElementById("toggle-tema-escuro");

    aplicarConfiguracoes();
    solicitarPermissaoNotificacao();

    if (btnConfig) {
        btnConfig.addEventListener("click", () => {
            if (settingsPanel) {
                settingsPanel.classList.toggle("hidden");
            }
        });
    }

    if (btnFecharConfig) {
        btnFecharConfig.addEventListener("click", () => {
            if (settingsPanel) {
                settingsPanel.classList.add("hidden");
            }
        });
    }

    if (toggleNotificacoes) {
        toggleNotificacoes.addEventListener("change", async () => {
            const ativado = toggleNotificacoes.checked;

            if (ativado) {
                const permissao = await solicitarPermissaoNotificacao();
                if (!permissao) {
                    toggleNotificacoes.checked = false;
                    atualizarConfiguracao("notificacoes", false);
                    mostrarNotificacao("Permita as notificações nas configurações do navegador ou do sistema.", "error");
                    return;
                }
            }

            atualizarConfiguracao("notificacoes", ativado);
        });
    }

    if (toggleVibracao) {
        toggleVibracao.addEventListener("change", () => {
            atualizarConfiguracao("vibracao", toggleVibracao.checked);
        });
    }

    if (toggleSomAlarme) {
        toggleSomAlarme.addEventListener("change", () => {
            atualizarConfiguracao("somAlarme", toggleSomAlarme.checked);
        });
    }

    if (toggleTemaEscuro) {
        toggleTemaEscuro.addEventListener("change", () => {
            atualizarConfiguracao("temaEscuro", toggleTemaEscuro.checked);
        });
    }

    if (imagemInput) {
        imagemInput.addEventListener("change", () => validarArquivoSelecionado(imagemInput, "imagem"));
    }

    if (alarmeInput) {
        alarmeInput.addEventListener("change", () => validarArquivoSelecionado(alarmeInput, "alarme"));
    }

    if (dataInput) {
        dataInput.addEventListener("input", () => {
            let valor = dataInput.value.replace(/\D/g, "");

            if (valor.length > 8) {
                valor = valor.slice(0, 8);
            }

            if (valor.length > 4) {
                valor = `${valor.slice(0, 4)}-${valor.slice(4)}`;
            }

            if (valor.length > 7) {
                valor = `${valor.slice(0, 7)}-${valor.slice(7)}`;
            }

            dataInput.value = valor;

            if (!valor) {
                dataInput.setCustomValidity("");
                return;
            }

            if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
                dataInput.setCustomValidity("Use o formato AAAA-MM-DD com ano de 4 dígitos.");
                return;
            }

            if (!validarFaixaData(valor)) {
                dataInput.setCustomValidity("Use ano entre 2026 e 2999, mês 1-12 e dia 1-31.");
                return;
            }

            if (!validarDataCalendario(valor)) {
                dataInput.setCustomValidity("Data inválida para o calendário.");
            } else {
                dataInput.setCustomValidity("");
            }
        });
    }

    if (form) {
        form.addEventListener("submit", async function (e) {
            e.preventDefault();

            if (!tituloInput || !dataInput || !horaInput) return;

            const titulo = tituloInput.value.trim();
            const data = dataInput.value;
            const hora = horaInput.value;

            if (!titulo || !data || !hora) {
                mostrarNotificacao("Preencha todos os campos antes de salvar.", "error");
                return;
            }

            const anoDaData = data.split("-")[0];
            if (!/^\d{4}$/.test(anoDaData)) {
                mostrarNotificacao("O ano da data deve ter 4 dígitos.", "error");
                return;
            }

            if (!validarFaixaData(data)) {
                mostrarNotificacao("Ano deve estar entre 2026 e 2999, mês entre 1 e 12 e dia entre 1 e 31.", "error");
                dataInput.focus();
                return;
            }

            if (!validarDataCalendario(data)) {
                mostrarNotificacao("Data inválida. Use uma data real do calendário.", "error");
                dataInput.focus();
                return;
            }

            const compromissoAtual = editingId !== null ? obterCompromissos().find((item) => item.id === editingId) : null;

            const imagemData = imagemInput && imagemInput.files && imagemInput.files[0]
                ? await converterArquivoParaBase64(imagemInput.files[0])
                : (compromissoAtual ? compromissoAtual.imagem : null);

            const alarmeData = alarmeInput && alarmeInput.files && alarmeInput.files[0]
                ? await converterArquivoParaBase64(alarmeInput.files[0])
                : (compromissoAtual ? compromissoAtual.alarme : null);

            const compromisso = {
                id: editingId ?? Date.now(),
                titulo,
                data,
                hora,
                imagem: imagemData,
                alarme: alarmeData,
                alarmPlayed: compromissoAtual ? compromissoAtual.alarmPlayed : false
            };

            const compromissos = obterCompromissos();

            if (editingId !== null) {
                const indice = compromissos.findIndex((item) => item.id === editingId);
                if (indice >= 0) {
                    compromissos[indice] = {
                        ...compromissos[indice],
                        ...compromisso,
                        id: editingId
                    };
                }
            } else {
                compromissos.push(compromisso);
            }

            salvarCompromissos(compromissos);
            renderListaCompromissos();
            mostrarNotificacao(
                editingId !== null ? "Compromisso atualizado com sucesso!" : "Compromisso salvo com sucesso!",
                "success"
            );

            if ("vibrate" in navigator && obterConfiguracoes().vibracao) {
                navigator.vibrate([80, 40, 80]);
            }

            resetForm();
        });
    }

    if (btnCancelar) {
        btnCancelar.addEventListener("click", () => {
            resetForm();
            mostrarNotificacao("Edição cancelada.", "success");
        });
    }

    renderListaCompromissos();
    verificarAlarmesPendentes();
});

function obterConfiguracoes() {
    const salvo = localStorage.getItem(CONFIG_KEY);
    if (!salvo) return { ...configPadrao };

    try {
        return { ...configPadrao, ...JSON.parse(salvo) };
    } catch (error) {
        return { ...configPadrao };
    }
}

function salvarConfiguracoes(config) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

function atualizarConfiguracao(chave, valor) {
    const config = obterConfiguracoes();
    config[chave] = valor;
    salvarConfiguracoes(config);
    aplicarConfiguracoes();
}

function aplicarConfiguracoes() {
    const config = obterConfiguracoes();
    const body = document.body;
    const toggleNotificacoes = document.getElementById("toggle-notificacoes");
    const toggleVibracao = document.getElementById("toggle-vibracao");
    const toggleSomAlarme = document.getElementById("toggle-som-alarme");
    const toggleTemaEscuro = document.getElementById("toggle-tema-escuro");

    if (body) {
        body.classList.toggle("dark-mode", Boolean(config.temaEscuro));
    }

    if (toggleNotificacoes) toggleNotificacoes.checked = Boolean(config.notificacoes);
    if (toggleVibracao) toggleVibracao.checked = Boolean(config.vibracao);
    if (toggleSomAlarme) toggleSomAlarme.checked = Boolean(config.somAlarme);
    if (toggleTemaEscuro) toggleTemaEscuro.checked = Boolean(config.temaEscuro);
}

function validarArquivoSelecionado(input, tipo) {
    const arquivo = input && input.files && input.files[0];

    if (!arquivo) return true;

    const tiposPermitidos = tipo === "imagem"
        ? ["image/jpeg", "image/png", "image/jpg", "image/webp", "image/gif"]
        : ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/x-wav", "audio/aac", "audio/m4a"];

    if (!tiposPermitidos.includes(arquivo.type)) {
        input.value = "";
        mostrarNotificacao(`Selecione apenas arquivos de ${tipo === "imagem" ? "imagem" : "áudio"}.`, "error");
        return false;
    }

    return true;
}

function converterArquivoParaBase64(arquivo) {
    return new Promise((resolve, reject) => {
        const leitor = new FileReader();
        leitor.onload = () => resolve(leitor.result);
        leitor.onerror = () => reject(new Error("Não foi possível processar o arquivo."));
        leitor.readAsDataURL(arquivo);
    });
}

function validarFaixaData(dataString) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataString)) {
        return false;
    }

    const [ano, mes, dia] = dataString.split("-").map(Number);

    if (!Number.isInteger(ano) || !Number.isInteger(mes) || !Number.isInteger(dia)) {
        return false;
    }

    if (ano < 2026 || ano > 2999) {
        return false;
    }

    if (mes < 1 || mes > 12) {
        return false;
    }

    if (dia < 1 || dia > 31) {
        return false;
    }

    if (ano === 2026) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const dataSelecionada = new Date(ano, mes - 1, dia);
        return dataSelecionada >= hoje;
    }

    return true;
}

function validarDataCalendario(dataString) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataString)) {
        return false;
    }

    const [ano, mes, dia] = dataString.split("-").map(Number);
    if (!Number.isInteger(ano) || !Number.isInteger(mes) || !Number.isInteger(dia)) {
        return false;
    }

    if (ano < 2026 || ano > 2999) {
        return false;
    }

    if (mes < 1 || mes > 12) {
        return false;
    }

    if (dia < 1 || dia > 31) {
        return false;
    }

    const data = new Date(ano, mes - 1, dia);
    const valido = data.getFullYear() === ano &&
        data.getMonth() === mes - 1 &&
        data.getDate() === dia;

    if (!valido) {
        return false;
    }

    if (ano === 2026) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        return data >= hoje;
    }

    return true;
}

async function solicitarPermissaoNotificacao() {
    if (!("Notification" in window)) {
        return false;
    }

    if (Notification.permission === "granted") {
        return true;
    }

    if (Notification.permission === "denied") {
        return false;
    }

    try {
        const resposta = await Notification.requestPermission();
        return resposta === "granted";
    } catch (error) {
        return false;
    }
}

function abrirConfiguracaoNotificacoes() {
    const settingsPanel = document.getElementById("settings-panel");
    const toggleNotificacoes = document.getElementById("toggle-notificacoes");

    if (settingsPanel) {
        settingsPanel.classList.remove("hidden");
    }

    if (toggleNotificacoes) {
        toggleNotificacoes.scrollIntoView({ behavior: "smooth", block: "center" });
        toggleNotificacoes.focus();
    }

    solicitarPermissaoNotificacao().then((permitida) => {
        if (permitida && toggleNotificacoes) {
            toggleNotificacoes.checked = true;
            atualizarConfiguracao("notificacoes", true);
        }
    });
}

function mostrarNotificacao(mensagem, tipo = "success") {
    const config = obterConfiguracoes();
    if (!config.notificacoes) return;

    if ("Notification" in window && Notification.permission === "granted") {
        const notification = new Notification("Minha Agenda", {
            body: mensagem,
            tag: "agenda-notificacao",
            silent: false
        });

        if (notification) {
            notification.onclick = () => {
                window.focus();
                abrirConfiguracaoNotificacoes();
            };
            setTimeout(() => notification.close(), 2600);
        }
    }

    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${tipo}`;
    toast.textContent = mensagem;
    toast.title = "Clique para ativar as notificações";
    toast.style.cursor = "pointer";
    toast.addEventListener("click", () => {
        abrirConfiguracaoNotificacoes();
    });

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 2600);
}

window.abrirConfiguracaoNotificacoes = abrirConfiguracaoNotificacoes;
window.solicitarPermissaoNotificacao = solicitarPermissaoNotificacao;
window.mostrarNotificacao = mostrarNotificacao;

function resetForm() {
    const form = document.getElementById("form-agenda");
    const btnSalvar = document.getElementById("btn-salvar");
    const btnCancelar = document.getElementById("btn-cancelar");
    const imagemInput = document.getElementById("imagem");
    const alarmeInput = document.getElementById("alarme");

    if (form) form.reset();
    editingId = null;

    if (btnSalvar) btnSalvar.textContent = "Adicionar à Agenda";
    if (btnCancelar) btnCancelar.classList.add("hidden");
    if (imagemInput) imagemInput.value = "";
    if (alarmeInput) alarmeInput.value = "";
}

function prepararEdicao(id) {
    const compromisso = obterCompromissos().find((item) => item.id === id);
    if (!compromisso) return;

    const tituloInput = document.getElementById("titulo");
    const dataInput = document.getElementById("data");
    const horaInput = document.getElementById("hora");
    const btnSalvar = document.getElementById("btn-salvar");
    const btnCancelar = document.getElementById("btn-cancelar");

    if (!tituloInput || !dataInput || !horaInput) return;

    editingId = id;
    tituloInput.value = compromisso.titulo || "";
    dataInput.value = compromisso.data || "";
    horaInput.value = compromisso.hora || "";

    if (btnSalvar) btnSalvar.textContent = "Salvar Alterações";
    if (btnCancelar) btnCancelar.classList.remove("hidden");

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderListaCompromissos() {
    const listaCompromissos = document.getElementById("lista-compromissos");
    if (!listaCompromissos) return;

    const compromissos = obterCompromissos().sort((a, b) => {
        const dataA = new Date(`${a.data}T${a.hora || "00:00"}`);
        const dataB = new Date(`${b.data}T${b.hora || "00:00"}`);
        return dataA - dataB;
    });

    listaCompromissos.innerHTML = "";

    compromissos.forEach((compromisso) => {
        const tr = document.createElement("tr");
        tr.dataset.id = String(compromisso.id);

        const dataFormatada = compromisso.data ? compromisso.data.split("-").reverse().join("/") : "";
        const tituloFormatado = compromisso.titulo ? compromisso.titulo : "Sem título";
        const imagemHtml = compromisso.imagem ? `<img src="${compromisso.imagem}" alt="Imagem do compromisso" class="imagem-compromisso">` : "";
        const alarmeHtml = compromisso.alarme ? `<span class="alarme-tag">🔊 Alarme</span>` : "";

        tr.innerHTML = `
            <td>
                <div class="conteudo-compromisso">
                    <strong>${tituloFormatado}</strong>
                    ${imagemHtml}
                    ${alarmeHtml}
                </div>
            </td>
            <td>${dataFormatada}</td>
            <td>${compromisso.hora || "--:--"}</td>
            <td>
                <div class="botoes-acoes">
                    <button class="btn-editar" onclick="prepararEdicao(${compromisso.id})">Editar</button>
                    <button class="btn-excluir" onclick="removerCompromisso(${compromisso.id})">Excluir</button>
                </div>
            </td>
        `;

        listaCompromissos.appendChild(tr);
    });
}

function salvarCompromissos(compromissos) {
    localStorage.setItem("agenda", JSON.stringify(compromissos));
}

function obterCompromissos() {
    const dados = localStorage.getItem("agenda");
    if (!dados) return [];

    try {
        return JSON.parse(dados);
    } catch (error) {
        return [];
    }
}

function removerCompromisso(id) {
    const compromissos = obterCompromissos();
    const atualizados = compromissos.filter((c) => c.id !== id);
    salvarCompromissos(atualizados);
    renderListaCompromissos();

    mostrarNotificacao("Compromisso removido.", "success");

    if ("vibrate" in navigator && obterConfiguracoes().vibracao) {
        navigator.vibrate(60);
    }
}

function atualizarHoraCabecalho() {
    const horaHeader = document.getElementById("system-time-header");
    if (!horaHeader) return;

    const agora = new Date();
    horaHeader.textContent = agora.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    });
}

function montarDataHoraLocal(data, hora) {
    if (!data) return new Date();

    const [ano, mes, dia] = data.split("-").map(Number);
    const [horas, minutos] = (hora || "00:00").split(":").map(Number);
    return new Date(ano, (mes || 1) - 1, dia || 1, horas || 0, minutos || 0, 0, 0);
}

function verificarAlarmesPendentes() {
    const agora = new Date();
    const compromissos = obterCompromissos();

    compromissos.forEach((compromisso) => {
        if (!compromisso.alarme || compromisso.alarmPlayed) return;

        const dataHoraCompromisso = montarDataHoraLocal(compromisso.data, compromisso.hora);
        const diferencaEmMinutos = Math.abs((agora - dataHoraCompromisso) / 60000);

        if (diferencaEmMinutos <= 1) {
            tocarAlarme(compromisso.alarme);
            compromisso.alarmPlayed = true;
            salvarCompromissos(compromissos);
            mostrarNotificacao(`Hora do compromisso: ${compromisso.titulo}`, "success");
        }
    });
}

function tocarAlarme(alarmeBase64) {
    if (!alarmeBase64) return;
    const config = obterConfiguracoes();

    if (!config.somAlarme) return;

    const audio = new Audio(alarmeBase64);
    audio.volume = 0.8;
    audio.play().catch(() => {
        // Silencia falhas de autoplay em navegador;
    });
}

window.prepararEdicao = prepararEdicao;
window.removerCompromisso = removerCompromisso;
window.tocarAlarme = tocarAlarme;
