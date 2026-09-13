const SUPABASE_URL = "https://alhlzltprkxigzuxfura.supabase.co";

/*
    COLE SUA PUBLISHABLE KEY ENTRE AS ASPAS ABAIXO.
    Ela começa com: sb_publishable_
*/
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

let currentUser = null;
let currentParticipant = null;

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

function shortId(id) {
    if (!id) return "sem-id";
    return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

async function loadParticipant(user) {
    /*
        DEBUG:
        Em vez de .single(), buscamos uma lista.
        Assim conseguimos distinguir:
        - erro de RLS/permissão
        - 0 registros
        - mais de 1 registro
        - usuário correto
    */
    const { data, error, status, statusText } = await supabaseClient
        .from("participantes")
        .select("id, sala_id, nome, status, user_id")
        .eq("user_id", user.id);

    if (error) {
        console.error("ERRO SUPABASE PARTICIPANTES:", {
            error,
            status,
            statusText,
            userId: user.id
        });

        return {
            ok: false,
            type: "query_error",
            message: error.message || "Erro desconhecido ao consultar participantes.",
            code: error.code || "sem-codigo",
            details: error.details || "",
            hint: error.hint || "",
            status,
            statusText
        };
    }

    if (!Array.isArray(data)) {
        return {
            ok: false,
            type: "invalid_response",
            message: "O Supabase respondeu em um formato inesperado."
        };
    }

    if (data.length === 0) {
        return {
            ok: false,
            type: "not_found",
            message:
                `Login aceito, mas não existe participante com este usuário. UID: ${shortId(user.id)}`
        };
    }

    if (data.length > 1) {
        return {
            ok: false,
            type: "multiple_rows",
            message:
                `Foram encontrados ${data.length} participantes para o mesmo usuário.`
        };
    }

    return {
        ok: true,
        participant: data[0]
    };
}

async function startAuthenticatedExperience(user) {
    currentUser = user;

    loginMessage.textContent = "Login aceito. Verificando acesso à sala...";

    const result = await loadParticipant(user);

    if (!result.ok) {
        console.error("FALHA AO VALIDAR PARTICIPANTE:", result);

        /*
            NÃO fazemos signOut automaticamente nesta versão de diagnóstico.
            Isso permite que a sessão autenticada continue ativa enquanto
            mostramos o erro real retornado pelo banco.
        */
        loginMessage.textContent =
            `DIAGNÓSTICO: ${result.type} | ${result.message}` +
            (result.code ? ` | código: ${result.code}` : "") +
            (result.details ? ` | detalhes: ${result.details}` : "") +
            (result.hint ? ` | dica: ${result.hint}` : "");

        showLogin();
        return;
    }

    currentParticipant = result.participant;

    welcomeText.textContent = getGreeting(currentParticipant.nome);

    roomStatusText.textContent =
        `${currentParticipant.nome}, nossa sala está pronta 💜`;

    loginMessage.textContent = "";

    showHero();
}

async function checkSession() {
    if (
        !SUPABASE_PUBLISHABLE_KEY ||
        SUPABASE_PUBLISHABLE_KEY === "COLE_SUA_PUBLISHABLE_KEY_AQUI"
    ) {
        loginMessage.textContent =
            "Falta configurar a Publishable Key no app.js.";
        showLogin();
        return;
    }

    const {
        data: { session },
        error
    } = await supabaseClient.auth.getSession();

    if (error) {
        console.error("ERRO AO LER SESSÃO:", error);

        loginMessage.textContent =
            `DIAGNÓSTICO sessão: ${error.message || "erro desconhecido"}`;

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
        console.error("ERRO LOGIN:", error);

        loginMessage.textContent =
            `Erro no login: ${error.message}`;

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
    });
});

supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log("AUTH EVENT:", event, session?.user?.id || null);

    if (event === "SIGNED_OUT" && !session) {
        currentUser = null;
        currentParticipant = null;
    }
});

checkSession();
