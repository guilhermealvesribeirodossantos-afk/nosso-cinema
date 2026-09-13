const SUPABASE_URL = "https://alhlzltprkxigzuxfura.supabase.co";

/*
    COLE SUA PUBLISHABLE KEY ENTRE AS ASPAS ABAIXO.
    Ela começa com: sb_publishable_
*/
const SUPABASE_PUBLISHABLE_KEY = "COLE_SUA_PUBLISHABLE_KEY_AQUI";

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

async function loadParticipant(user) {
    const { data, error } = await supabaseClient
        .from("participantes")
        .select("id, sala_id, nome, status, user_id")
        .eq("user_id", user.id)
        .single();

    if (error) {
        console.error("Erro ao carregar participante:", error);
        return null;
    }

    return data;
}

async function startAuthenticatedExperience(user) {
    currentUser = user;
    currentParticipant = await loadParticipant(user);

    if (!currentParticipant) {
        await supabaseClient.auth.signOut();
        loginMessage.textContent = "Esta conta não está autorizada a entrar na sala Gui + Malu.";
        showLogin();
        return;
    }

    welcomeText.textContent = getGreeting(currentParticipant.nome);
    roomStatusText.textContent = `${currentParticipant.nome}, nossa sala está pronta 💜`;
    showHero();
}

async function checkSession() {
    if (!SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY === "COLE_SUA_PUBLISHABLE_KEY_AQUI") {
        loginMessage.textContent = "Falta configurar a Publishable Key no app.js.";
        showLogin();
        return;
    }

    const { data: { session }, error } = await supabaseClient.auth.getSession();

    if (error) {
        console.error(error);
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

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        console.error(error);
        loginMessage.textContent = "E-mail ou senha incorretos. Confira e tente novamente.";
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
        if (gallery) gallery.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
});

document.querySelectorAll(".service, .room-services button").forEach((button) => {
    button.addEventListener("click", () => {
        const service = button.dataset.service;
        if (!service) return;

        if (service === "YouTube") {
            window.open("https://www.youtube.com", "_blank", "noopener,noreferrer");
            return;
        }

        alert(`${service}: a interface está pronta. A integração real com o serviço será tratada em uma etapa separada.`);
    });
});

document.querySelectorAll(".bottom-nav button").forEach((button) => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".bottom-nav button").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        if (button.dataset.tab === "inicio") showHome();
        if (button.dataset.tab === "sala") showRoom();
    });
});

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" && !session) {
        currentUser = null;
        currentParticipant = null;
    }
});

checkSession();
