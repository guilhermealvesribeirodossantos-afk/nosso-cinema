const SUPABASE_URL = "https://alhlzltprkxigzuxfura.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_2iI7ahg95uaAhyZl7A9a9g_G4iA7S2U";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

const loginScreen = document.getElementById("loginScreen");
const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");

const hero = document.getElementById("hero");
const home = document.getElementById("home");
const room = document.getElementById("room");

const enterButton = document.getElementById("enterButton");
const storyButton = document.getElementById("storyButton");
const openRoomButton = document.getElementById("openRoomButton");
const backHomeButton = document.getElementById("backHomeButton");
const logoutButton = document.getElementById("logoutButton");

const welcomeText = document.getElementById("welcomeText");
const roomStatusText = document.getElementById("roomStatusText");

const guiStatus = document.getElementById("guiStatus");
const maluStatus = document.getElementById("maluStatus");
const connectedCount = document.getElementById("connectedCount");
const liveBadge = document.getElementById("liveBadge");

let currentUser = null;
let currentParticipant = null;
let presenceChannel = null;
let chatChannel = null;
let chatStarted = false;

const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatSendButton = document.getElementById("chatSendButton");
const messagesContainer = document.getElementById("messagesContainer");
const chatStatus = document.getElementById("chatStatus");

const ROOM_ID = 1;
const PRESENCE_TOPIC = "room:1:presence";

function hideAllScreens() {
    loginScreen.classList.add("hidden");
    hero.classList.add("hidden");
    home.classList.add("hidden");
    room.classList.add("hidden");
}

function showLogin() {
    hideAllScreens();
    loginScreen.classList.remove("hidden");
}

function showHero() {
    hideAllScreens();
    hero.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function showHome() {
    hideAllScreens();
    home.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function showRoom() {
    hideAllScreens();
    room.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function getGreeting(name) {
    const hour = new Date().getHours();

    if (hour < 12) return `Bom dia, ${name} 💜`;
    if (hour < 18) return `Boa tarde, ${name} 💜`;

    return `Boa noite, ${name} 💜`;
}

async function loadParticipant(user) {
    const { data, error } = await supabaseClient
        .from("participantes")
        .select("id, sala_id, nome, status, user_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (error) {
        console.error("Erro ao carregar participante:", error);
        return null;
    }

    return data;
}

function setPersonStatus(element, online) {
    if (!element) return;

    if (online) {
        element.textContent = "● online";
        element.style.color = "#7cff9f";
    } else {
        element.textContent = "● offline";
        element.style.color = "#8f7d9c";
    }
}

function updatePresenceUI(state) {
    const allPresences = Object.values(state || {}).flat();

    const namesOnline = new Set(
        allPresences
            .map((presence) => presence?.nome)
            .filter(Boolean)
    );

    const guiOnline = namesOnline.has("Gui");
    const maluOnline = namesOnline.has("Malu");

    setPersonStatus(guiStatus, guiOnline);
    setPersonStatus(maluStatus, maluOnline);

    const onlineCount = [guiOnline, maluOnline].filter(Boolean).length;

    if (connectedCount) {
        connectedCount.textContent =
            onlineCount === 1 ? "1 pessoa online" : `${onlineCount} pessoas online`;
    }

    if (liveBadge) {
        liveBadge.textContent =
            onlineCount === 2
                ? "● Gui e Malu online"
                : onlineCount === 1
                    ? "● 1 online"
                    : "● ninguém online";
    }

    if (roomStatusText) {
        if (guiOnline && maluOnline) {
            roomStatusText.textContent = "Vocês dois estão online 💜";
        } else if (currentParticipant) {
            const otherName = currentParticipant.nome === "Gui" ? "Malu" : "Gui";
            roomStatusText.textContent = `Você está online. ${otherName} ainda não entrou.`;
        }
    }
}

async function stopPresence() {
    if (!presenceChannel) return;

    try {
        await presenceChannel.untrack();
    } catch (error) {
        console.warn("Não foi possível remover o Presence:", error);
    }

    try {
        await supabaseClient.removeChannel(presenceChannel);
    } catch (error) {
        console.warn("Não foi possível remover o canal:", error);
    }

    presenceChannel = null;
}

async function startPresence() {
    if (!currentUser || !currentParticipant) return;

    await stopPresence();

    const {
        data: { session }
    } = await supabaseClient.auth.getSession();

    if (!session?.access_token) {
        console.error("Sessão sem access_token para o Realtime.");
        return;
    }

    supabaseClient.realtime.setAuth(session.access_token);

    presenceChannel = supabaseClient.channel(PRESENCE_TOPIC, {
        config: {
            private: true,
            presence: {
                key: currentUser.id
            }
        }
    });

    presenceChannel
        .on("presence", { event: "sync" }, () => {
            const state = presenceChannel.presenceState();
            console.log("Presence sync:", state);
            updatePresenceUI(state);
        })
        .on("presence", { event: "join" }, ({ key, newPresences }) => {
            console.log("Presence join:", key, newPresences);
        })
        .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
            console.log("Presence leave:", key, leftPresences);
        });

    presenceChannel.subscribe(async (status) => {
        console.log("Realtime status:", status);

        if (status === "SUBSCRIBED") {
            const trackStatus = await presenceChannel.track({
                user_id: currentUser.id,
                nome: currentParticipant.nome,
                sala_id: ROOM_ID,
                online_at: new Date().toISOString()
            });

            console.log("Presence track:", trackStatus);
        }

        if (status === "CHANNEL_ERROR") {
            console.error("Erro ao conectar no canal privado de Presence.");
            if (liveBadge) liveBadge.textContent = "● erro no realtime";
        }

        if (status === "TIMED_OUT") {
            console.error("Realtime expirou ao tentar conectar.");
            if (liveBadge) liveBadge.textContent = "● realtime indisponível";
        }
    });
}


function formatMessageTime(dateValue) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
}

function createMessageElement(message) {
    const wrapper = document.createElement("div");
    const senderClass = message.remetente === "Gui" ? "gui" : "malu";
    wrapper.className = `message ${senderClass}`;
    wrapper.dataset.messageId = String(message.id);

    const sender = document.createElement("span");
    sender.textContent = message.remetente;

    const text = document.createElement("p");
    text.textContent = message.mensagem;

    const time = document.createElement("time");
    time.dateTime = message.enviado_em || "";
    time.textContent = formatMessageTime(message.enviado_em);

    wrapper.append(sender, text, time);
    return wrapper;
}

function scrollChatToBottom() {
    if (!messagesContainer) return;

    requestAnimationFrame(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}

function renderMessages(messages) {
    if (!messagesContainer) return;

    messagesContainer.innerHTML = "";

    if (!messages || messages.length === 0) {
        const empty = document.createElement("div");
        empty.className = "chat-empty";
        empty.textContent = "Ainda não tem mensagem. Manda um oi 💜";
        messagesContainer.appendChild(empty);
        return;
    }

    messages.forEach((message) => {
        messagesContainer.appendChild(createMessageElement(message));
    });

    scrollChatToBottom();
}

function appendMessage(message) {
    if (!messagesContainer || !message) return;

    if (messagesContainer.querySelector(`[data-message-id="${message.id}"]`)) {
        return;
    }

    const empty = messagesContainer.querySelector(".chat-empty");
    if (empty) empty.remove();

    messagesContainer.appendChild(createMessageElement(message));
    scrollChatToBottom();
}

async function loadMessages() {
    if (!currentParticipant) return;

    if (chatStatus) chatStatus.textContent = "carregando...";

    const { data, error } = await supabaseClient
        .from("mensagens")
        .select("id, sala_id, remetente, mensagem, enviado_em")
        .eq("sala_id", ROOM_ID)
        .order("enviado_em", { ascending: true })
        .limit(200);

    if (error) {
        console.error("Erro ao carregar mensagens:", error);
        if (chatStatus) chatStatus.textContent = "erro ao carregar";
        return;
    }

    renderMessages(data || []);
    if (chatStatus) chatStatus.textContent = "tempo real 💜";
}

async function stopChatRealtime() {
    if (!chatChannel) return;

    try {
        await supabaseClient.removeChannel(chatChannel);
    } catch (error) {
        console.warn("Não foi possível remover o canal do chat:", error);
    }

    chatChannel = null;
    chatStarted = false;
}

async function startChatRealtime() {
    if (!currentUser || !currentParticipant || chatStarted) return;

    await stopChatRealtime();
    await loadMessages();

    const {
        data: { session }
    } = await supabaseClient.auth.getSession();

    if (!session?.access_token) {
        if (chatStatus) chatStatus.textContent = "sem conexão";
        return;
    }

    supabaseClient.realtime.setAuth(session.access_token);

    chatChannel = supabaseClient
        .channel(`room:${ROOM_ID}:chat`, {
            config: {
                private: true
            }
        })
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "mensagens",
                filter: `sala_id=eq.${ROOM_ID}`
            },
            (payload) => {
                appendMessage(payload.new);
            }
        )
        .subscribe((status) => {
            console.log("Chat realtime status:", status);

            if (status === "SUBSCRIBED") {
                chatStarted = true;
                if (chatStatus) chatStatus.textContent = "tempo real 💜";
            }

            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                if (chatStatus) chatStatus.textContent = "reconectando...";
            }
        });
}

async function sendChatMessage() {
    if (!currentParticipant || !chatInput) return;

    const message = chatInput.value.trim();
    if (!message) return;

    chatInput.disabled = true;
    chatSendButton.disabled = true;

    const { data, error } = await supabaseClient
        .from("mensagens")
        .insert({
            sala_id: ROOM_ID,
            remetente: currentParticipant.nome,
            mensagem: message
        })
        .select("id, sala_id, remetente, mensagem, enviado_em")
        .single();

    chatInput.disabled = false;
    chatSendButton.disabled = false;

    if (error) {
        console.error("Erro ao enviar mensagem:", error);
        if (chatStatus) chatStatus.textContent = "erro ao enviar";
        chatInput.focus();
        return;
    }

    chatInput.value = "";
    appendMessage(data);
    if (chatStatus) chatStatus.textContent = "tempo real 💜";
    chatInput.focus();
}

async function startAuthenticatedExperience(user) {
    currentUser = user;
    currentParticipant = await loadParticipant(user);

    if (!currentParticipant) {
        loginMessage.textContent =
            "Esta conta não está autorizada a entrar na sala Gui + Malu.";

        showLogin();
        return;
    }

    welcomeText.textContent = getGreeting(currentParticipant.nome);
    roomStatusText.textContent =
        `${currentParticipant.nome}, nossa sala está pronta 💜`;

    loginMessage.textContent = "";

    await startPresence();
    await startChatRealtime();
    showHero();
}

async function checkSession() {
    const {
        data: { session },
        error
    } = await supabaseClient.auth.getSession();

    if (error) {
        console.error("Erro ao ler sessão:", error);
        showLogin();
        return;
    }

    if (session?.user) {
        await startAuthenticatedExperience(session.user);
        return;
    }

    showLogin();
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    loginButton.disabled = true;
    loginButton.textContent = "Entrando...";
    loginMessage.textContent = "";

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        console.error("Erro no login:", error);

        loginMessage.textContent =
            "E-mail ou senha incorretos. Confira e tente novamente.";

        loginButton.disabled = false;
        loginButton.textContent = "Entrar no Nosso Cinema";
        return;
    }

    loginForm.reset();
    loginButton.disabled = false;
    loginButton.textContent = "Entrar no Nosso Cinema";

    await startAuthenticatedExperience(data.user);
});

logoutButton.addEventListener("click", async () => {
    await stopChatRealtime();
    await stopPresence();
    await supabaseClient.auth.signOut();

    currentUser = null;
    currentParticipant = null;

    loginMessage.textContent = "";
    showLogin();
});

enterButton.addEventListener("click", showHome);
openRoomButton.addEventListener("click", showRoom);
backHomeButton.addEventListener("click", showHome);

storyButton.addEventListener("click", () => {
    showHome();

    setTimeout(() => {
        const gallery = document.querySelector(".gallery-card");

        if (gallery) {
            gallery.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }
    }, 250);
});

document.querySelectorAll(".service, .room-services button").forEach((button) => {
    button.addEventListener("click", () => {
        const service = button.dataset.service;

        if (!service) return;

        if (service === "YouTube") {
            window.open(
                "https://www.youtube.com",
                "_blank",
                "noopener,noreferrer"
            );
            return;
        }

        alert(
            `${service}: a interface está pronta. A integração real com o serviço será tratada em uma etapa separada.`
        );
    });
});


if (chatForm) {
    chatForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        await sendChatMessage();
    });
}

document.querySelectorAll(".bottom-nav button").forEach((button) => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".bottom-nav button").forEach((item) => {
            item.classList.remove("active");
        });

        button.classList.add("active");

        if (button.dataset.tab === "inicio") {
            showHome();
        }

        if (button.dataset.tab === "sala") {
            showRoom();
        }

        if (button.dataset.tab === "chat") {
            showRoom();

            setTimeout(() => {
                const chatPanel = document.querySelector(".chat-preview");
                if (chatPanel) {
                    chatPanel.scrollIntoView({
                        behavior: "smooth",
                        block: "center"
                    });
                }

                if (chatInput) chatInput.focus();
            }, 200);
        }
    });
});

supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log("Auth event:", event);

    if (event === "SIGNED_OUT" && !session) {
        currentUser = null;
        currentParticipant = null;
    }
});

window.addEventListener("beforeunload", () => {
    if (presenceChannel) {
        presenceChannel.untrack();
    }

    if (chatChannel) {
        supabaseClient.removeChannel(chatChannel);
    }
});

checkSession();
