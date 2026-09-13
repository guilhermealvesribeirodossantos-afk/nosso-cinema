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
let playerChannel = null;
let playerStarted = false;
let currentPlayerState = null;

const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatSendButton = document.getElementById("chatSendButton");
const messagesContainer = document.getElementById("messagesContainer");
const chatStatus = document.getElementById("chatStatus");

const ROOM_ID = 1;
const PRESENCE_TOPIC = "room:1:presence";
const PLAYER_TOPIC = "room:1:player";

const playerTitle = document.querySelector(".player-copy h3");
const playerDescription = document.querySelector(".player-copy p");
const playButton = document.getElementById("playButton");
const rewindButton = document.getElementById("rewindButton");
const forwardButton = document.getElementById("forwardButton");
const playerTime = document.getElementById("playerTime");
const playerSyncText = document.getElementById("playerSyncText");
const playerSyncBar = document.querySelector(".player-sync-bar");

const youtubeUrlInput = document.getElementById("youtubeUrlInput");
const loadYoutubeButton = document.getElementById("loadYoutubeButton");

const playerControlButtons = document.querySelectorAll(".player-controls button");

let playerClockInterval = null;
let lastRealtimePlayerStateAt = 0;
let driftCorrectionCooldownUntil = 0;

let youtubePlayer = null;
let youtubePlayerReady = false;
let youtubePendingVideoId = null;
let youtubeSyncGuardUntil = 0;
let youtubeLastBroadcastAt = 0;
let youtubeStatePollInterval = null;
let youtubeApiLoading = false;
let youtubeApiLoaded = false;
let youtubeApiLoadTimer = null;
let youtubeHeartbeatInterval = null;

const YOUTUBE_HEARTBEAT_MS = 1500;
const YOUTUBE_REMOTE_SEEK_TOLERANCE_SECONDS = 1.0;

const YOUTUBE_SYNC_TOLERANCE_SECONDS = 0.9;
const YOUTUBE_HARD_SEEK_SECONDS = 1.8;
const YOUTUBE_GUARD_MS = 1200;
const YOUTUBE_BROADCAST_THROTTLE_MS = 900;


const PLAYER_DRIFT_IGNORE_SECONDS = 0.6;
const PLAYER_DRIFT_SOFT_SECONDS = 1.2;
const PLAYER_DRIFT_HARD_SECONDS = 2.5;
const PLAYER_DRIFT_CHECK_INTERVAL_MS = 1000;
const PLAYER_DRIFT_COOLDOWN_MS = 1800;

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
        .channel(`room:${ROOM_ID}:chat`)
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



function clampPlayerPosition(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, number);
}

function getEffectivePlayerPosition(state = currentPlayerState) {
    if (!state) return 0;

    const savedPosition = clampPlayerPosition(state.posicao_segundos);

    if (state.status !== "playing") {
        return savedPosition;
    }

    const updatedAt = new Date(state.atualizado_em).getTime();
    if (!Number.isFinite(updatedAt)) {
        return savedPosition;
    }

    const elapsedSeconds = Math.max(0, (Date.now() - updatedAt) / 1000);
    return savedPosition + elapsedSeconds;
}

function formatPlayerPosition(totalSeconds) {
    const seconds = Math.floor(clampPlayerPosition(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
        return [
            String(hours).padStart(2, "0"),
            String(minutes).padStart(2, "0"),
            String(remainingSeconds).padStart(2, "0")
        ].join(":");
    }

    return [
        String(minutes).padStart(2, "0"),
        String(remainingSeconds).padStart(2, "0")
    ].join(":");
}

function updatePlayerClock() {
    if (!playerTime) return;

    const position = getEffectivePlayerPosition();
    playerTime.textContent = formatPlayerPosition(position);
}

function startPlayerClock() {
    if (playerClockInterval) {
        clearInterval(playerClockInterval);
    }

    updatePlayerClock();

    playerClockInterval = setInterval(() => {
        updatePlayerClock();
        correctPlayerDrift();
    }, PLAYER_DRIFT_CHECK_INTERVAL_MS);
}

function stopPlayerClock() {
    if (!playerClockInterval) return;
    clearInterval(playerClockInterval);
    playerClockInterval = null;
}



function extractYoutubeVideoId(value) {
    if (!value) return null;

    const raw = value.trim();

    if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) {
        return raw;
    }

    try {
        const url = new URL(raw);

        if (url.hostname.includes("youtu.be")) {
            const id = url.pathname.replace("/", "").split("/")[0];
            return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
        }

        if (url.hostname.includes("youtube.com")) {
            const watchId = url.searchParams.get("v");
            if (watchId && /^[a-zA-Z0-9_-]{11}$/.test(watchId)) {
                return watchId;
            }

            const parts = url.pathname.split("/").filter(Boolean);
            const markerIndex = parts.findIndex((part) =>
                ["embed", "shorts", "live"].includes(part)
            );

            if (markerIndex >= 0 && parts[markerIndex + 1]) {
                const id = parts[markerIndex + 1];
                return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
            }
        }
    } catch (error) {
        return null;
    }

    return null;
}

function getYoutubePlayerStateName(state) {
    if (!window.YT?.PlayerState) return "unknown";
    if (state === YT.PlayerState.PLAYING) return "playing";
    if (state === YT.PlayerState.PAUSED) return "paused";
    if (state === YT.PlayerState.BUFFERING) return "buffering";
    if (state === YT.PlayerState.ENDED) return "ended";
    if (state === YT.PlayerState.CUED) return "cued";
    return "other";
}

function getYoutubeCurrentTimeSafe() {
    if (!youtubePlayerReady || !youtubePlayer?.getCurrentTime) {
        return getEffectivePlayerPosition();
    }

    const value = Number(youtubePlayer.getCurrentTime());
    return Number.isFinite(value) ? value : 0;
}

function shouldIgnoreYoutubeEvent() {
    return Date.now() < youtubeSyncGuardUntil;
}

function applySharedStateToYoutube(state) {
    if (!state || !youtubePlayerReady) return;

    const videoId = extractYoutubeVideoId(state.conteudo_url || "");
    const targetPosition = getEffectivePlayerPosition(state);

    if (videoId) {
        const currentVideoId = youtubePlayer?.getVideoData?.().video_id || "";

        if (currentVideoId !== videoId) {
            youtubeSyncGuardUntil = Date.now() + YOUTUBE_GUARD_MS;

            youtubePlayer.cueVideoById({
                videoId,
                startSeconds: targetPosition
            });

            youtubePendingVideoId = null;

            setTimeout(() => {
                applySharedStateToYoutube(state);
            }, 450);

            return;
        }
    }

    const localPosition = getYoutubeCurrentTimeSafe();
    const drift = Math.abs(localPosition - targetPosition);

    if (drift >= YOUTUBE_REMOTE_SEEK_TOLERANCE_SECONDS) {
        youtubeSyncGuardUntil = Date.now() + YOUTUBE_GUARD_MS;
        youtubePlayer.seekTo(targetPosition, true);
    }

    const forcePlaybackState = () => {
        if (!youtubePlayerReady || !window.YT?.PlayerState) return;

        const playerState = youtubePlayer.getPlayerState?.();

        if (state.status === "playing") {
            if (playerState !== YT.PlayerState.PLAYING) {
                youtubePlayer.playVideo();
            }
        } else {
            if (
                playerState === YT.PlayerState.PLAYING ||
                playerState === YT.PlayerState.BUFFERING
            ) {
                youtubePlayer.pauseVideo();
            }
        }
    };

    youtubeSyncGuardUntil = Date.now() + YOUTUBE_GUARD_MS;
    forcePlaybackState();

    // Retry because mobile/desktop iframe state transitions can arrive slightly late.
    setTimeout(forcePlaybackState, 300);
    setTimeout(forcePlaybackState, 800);
}
async function broadcastYoutubePlayback(status) {
    if (!youtubePlayerReady || shouldIgnoreYoutubeEvent()) return;

    const now = Date.now();
    if (now - youtubeLastBroadcastAt < YOUTUBE_BROADCAST_THROTTLE_MS) return;

    youtubeLastBroadcastAt = now;

    const videoId = youtubePlayer?.getVideoData?.().video_id || "";
    const position = getYoutubeCurrentTimeSafe();

    await saveAndBroadcastPlayerState({
        servico: "YouTube",
        conteudo_url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
        posicao_segundos: position,
        status
    });
}

function startYoutubeStatePoll() {
    if (youtubeStatePollInterval) {
        clearInterval(youtubeStatePollInterval);
    }

    youtubeStatePollInterval = setInterval(async () => {
        if (!youtubePlayerReady || !currentPlayerState || !currentParticipant) return;

        const videoId = extractYoutubeVideoId(currentPlayerState.conteudo_url || "");
        if (!videoId) return;

        const expected = getEffectivePlayerPosition(currentPlayerState);
        const local = getYoutubeCurrentTimeSafe();
        const drift = Math.abs(expected - local);

        if (shouldIgnoreYoutubeEvent()) return;

        const iAmController =
            currentPlayerState.atualizado_por === currentParticipant.nome;

        // If this device is controlling the session and its real player moved
        // substantially (e.g. user dragged the YouTube timeline), publish that seek.
        if (iAmController && drift >= 2.0) {
            await saveAndBroadcastPlayerState({
                posicao_segundos: local,
                status:
                    youtubePlayer.getPlayerState?.() === YT.PlayerState.PLAYING
                        ? "playing"
                        : "paused"
            });
            return;
        }

        // If the other device is controlling the session, this device follows it.
        if (!iAmController && drift >= YOUTUBE_REMOTE_SEEK_TOLERANCE_SECONDS) {
            youtubeSyncGuardUntil = Date.now() + YOUTUBE_GUARD_MS;
            youtubePlayer.seekTo(expected, true);
            setPlayerSyncVisual("resyncing", `corrigindo ${drift.toFixed(1)}s`);
        }
    }, 1000);
}
function stopYoutubeStatePoll() {
    if (youtubeStatePollInterval) {
        clearInterval(youtubeStatePollInterval);
        youtubeStatePollInterval = null;
    }
}


function startYoutubeHeartbeat() {
    if (youtubeHeartbeatInterval) {
        clearInterval(youtubeHeartbeatInterval);
    }

    youtubeHeartbeatInterval = setInterval(async () => {
        if (
            !youtubePlayerReady ||
            !currentPlayerState ||
            !currentParticipant ||
            !playerChannel
        ) {
            return;
        }

        const videoId = extractYoutubeVideoId(currentPlayerState.conteudo_url || "");
        if (!videoId) return;

        const iAmController =
            currentPlayerState.atualizado_por === currentParticipant.nome;

        if (!iAmController || currentPlayerState.status !== "playing") return;

        const payload = {
            ...currentPlayerState,
            posicao_segundos: getYoutubeCurrentTimeSafe(),
            status: "playing",
            atualizado_por: currentParticipant.nome,
            atualizado_em: new Date().toISOString()
        };

        try {
            await playerChannel.send({
                type: "broadcast",
                event: "player_state",
                payload
            });

            currentPlayerState = payload;
            updatePlayerClock();
        } catch (error) {
            console.warn("Heartbeat do player não enviado:", error);
        }
    }, YOUTUBE_HEARTBEAT_MS);
}

function stopYoutubeHeartbeat() {
    if (youtubeHeartbeatInterval) {
        clearInterval(youtubeHeartbeatInterval);
        youtubeHeartbeatInterval = null;
    }
}

function createYoutubePlayer() {
    if (youtubePlayer || !window.YT?.Player) return;

    youtubePlayer = new YT.Player("youtubePlayer", {
        width: "100%",
        height: "100%",
        playerVars: {
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            controls: 1
        },
        events: {
            onReady: () => {
                youtubePlayerReady = true;

                if (youtubePendingVideoId) {
                    youtubePlayer.cueVideoById(youtubePendingVideoId);
                    youtubePendingVideoId = null;
                }

                if (currentPlayerState) {
                    applySharedStateToYoutube(currentPlayerState);
                }

                startYoutubeStatePoll();
                startYoutubeHeartbeat();
            },
            onError: (event) => {
                console.error("Erro do YouTube Player:", event.data);

                const messages = {
                    2: "Link ou ID do vídeo inválido.",
                    5: "O vídeo não pode ser reproduzido neste player.",
                    100: "Vídeo removido ou privado.",
                    101: "O dono do vídeo bloqueou reprodução fora do YouTube.",
                    150: "O dono do vídeo bloqueou reprodução fora do YouTube."
                };

                setPlayerSyncVisual(
                    "resyncing",
                    messages[event.data] || `erro do YouTube (${event.data})`
                );
            },
            onStateChange: async (event) => {
                if (shouldIgnoreYoutubeEvent()) return;

                const stateName = getYoutubePlayerStateName(event.data);

                if (stateName === "playing") {
                    await broadcastYoutubePlayback("playing");
                }

                if (stateName === "paused") {
                    await broadcastYoutubePlayback("paused");
                }

                if (stateName === "ended") {
                    await saveAndBroadcastPlayerState({
                        posicao_segundos: getYoutubeCurrentTimeSafe(),
                        status: "paused"
                    });
                }
            }
        }
    });
}

function loadYoutubeIframeApi() {
    if (window.YT?.Player) {
        youtubeApiLoaded = true;
        youtubeApiLoading = false;
        createYoutubePlayer();
        return;
    }

    if (youtubeApiLoading) return;

    youtubeApiLoading = true;
    setPlayerSyncVisual("syncing", "carregando YouTube...");

    // Remove uma tentativa antiga incompleta, se existir.
    const oldScript = document.getElementById("youtube-iframe-api-script");
    if (oldScript) oldScript.remove();

    const script = document.createElement("script");
    script.id = "youtube-iframe-api-script";
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;

    script.onload = () => {
        console.log("YouTube iframe_api: script carregado");
        youtubeApiLoaded = true;
        youtubeApiLoading = false;

        // A API ainda pode terminar de preparar window.YT após o onload.
        setTimeout(() => {
            if (window.YT?.Player) {
                createYoutubePlayer();
            }
        }, 100);
    };

    script.onerror = () => {
        youtubeApiLoaded = false;
        youtubeApiLoading = false;
        setPlayerSyncVisual("resyncing", "não foi possível carregar o YouTube");
        console.error("Falha ao carregar https://www.youtube.com/iframe_api");
    };

    document.head.appendChild(script);

    clearTimeout(youtubeApiLoadTimer);
    youtubeApiLoadTimer = setTimeout(() => {
        if (!window.YT?.Player) {
            youtubeApiLoading = false;
            setPlayerSyncVisual("resyncing", "YouTube demorou para carregar");
            console.warn("A API do YouTube não ficou disponível após 8 segundos.");
        }
    }, 8000);
}

window.onYouTubeIframeAPIReady = function () {
    youtubeApiLoaded = true;
    youtubeApiLoading = false;
    clearTimeout(youtubeApiLoadTimer);
    createYoutubePlayer();
};

function ensureYoutubePlayerInitialized() {
    if (window.YT?.Player) {
        youtubeApiLoaded = true;
        youtubeApiLoading = false;
        createYoutubePlayer();
        return;
    }

    loadYoutubeIframeApi();
}

async function loadYoutubeFromInput() {
    const raw = youtubeUrlInput?.value || "";
    const videoId = extractYoutubeVideoId(raw);

    if (!videoId) {
        alert("Cole um link válido do YouTube.");
        return;
    }

    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

    setPlayerSyncVisual("syncing", "carregando vídeo...");

    await saveAndBroadcastPlayerState({
        servico: "YouTube",
        titulo: "Vídeo do YouTube",
        conteudo_url: youtubeUrl,
        posicao_segundos: 0,
        status: "paused"
    });

    if (youtubePlayerReady) {
        youtubeSyncGuardUntil = Date.now() + YOUTUBE_GUARD_MS;
        youtubePlayer.cueVideoById(videoId);
        setPlayerSyncVisual("good", "vídeo carregado");
    } else {
        youtubePendingVideoId = videoId;
        setPlayerSyncVisual("syncing", "iniciando player do YouTube...");
        loadYoutubeIframeApi();
    }
}

function setPlayerSyncVisual(mode, text) {
    if (playerSyncBar) {
        playerSyncBar.classList.remove("is-good", "is-syncing", "is-resyncing");

        if (mode === "good") playerSyncBar.classList.add("is-good");
        if (mode === "syncing") playerSyncBar.classList.add("is-syncing");
        if (mode === "resyncing") playerSyncBar.classList.add("is-resyncing");
    }

    if (playerSyncText && text) {
        playerSyncText.textContent = text;
    }
}

function getExpectedRemotePosition(state = currentPlayerState) {
    if (!state) return 0;
    return getEffectivePlayerPosition(state);
}

function getLocalDisplayedPosition() {
    if (!currentPlayerState) return 0;

    const videoId = extractYoutubeVideoId(currentPlayerState.conteudo_url || "");

    if (videoId && youtubePlayerReady) {
        return getYoutubeCurrentTimeSafe();
    }

    return getEffectivePlayerPosition(currentPlayerState);
}

function correctPlayerDrift() {
    if (!currentPlayerState) return;

    const expected = getExpectedRemotePosition(currentPlayerState);
    const local = getLocalDisplayedPosition();
    const drift = Math.abs(expected - local);

    if (Date.now() < driftCorrectionCooldownUntil) {
        return;
    }

    if (drift <= PLAYER_DRIFT_IGNORE_SECONDS) {
        setPlayerSyncVisual("good", "sincronizado");
        return;
    }

    if (drift < PLAYER_DRIFT_HARD_SECONDS) {
        setPlayerSyncVisual("syncing", `ajustando ${drift.toFixed(1)}s`);
        driftCorrectionCooldownUntil = Date.now() + PLAYER_DRIFT_COOLDOWN_MS;
        updatePlayerClock();
        return;
    }

    setPlayerSyncVisual("resyncing", `ressincronizando ${drift.toFixed(1)}s`);
    driftCorrectionCooldownUntil = Date.now() + PLAYER_DRIFT_COOLDOWN_MS;
    updatePlayerClock();

    setTimeout(() => {
        if (currentPlayerState) {
            setPlayerSyncVisual("good", "sincronizado");
        }
    }, 500);
}

function updatePlayerUI(state) {
    if (!state) return;

    currentPlayerState = state;
    lastRealtimePlayerStateAt = Date.now();

    if (playerTitle) {
        playerTitle.textContent = state.servico
            ? `${state.servico} selecionado`
            : "Prontos para assistir juntos";
    }

    if (playerDescription) {
        if (state.servico) {
            const action =
                state.status === "playing" ? "assistindo" : "pausado";

            playerDescription.textContent =
                `${action} • última alteração por ${state.atualizado_por || "Gui + Malu"}`;
        } else {
            playerDescription.textContent =
                "Escolha um serviço e sincronizem a sessão.";
        }
    }

    
if (loadYoutubeButton) {
    loadYoutubeButton.addEventListener("click", loadYoutubeFromInput);
}

if (youtubeUrlInput) {
    youtubeUrlInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            loadYoutubeFromInput();
        }
    });
}

if (playButton) {
        playButton.textContent =
            state.status === "playing" ? "❚❚" : "▶";
        playButton.title =
            state.status === "playing" ? "Pausar para os dois" : "Reproduzir para os dois";
    }

    document
        .querySelectorAll(".service, .room-services button")
        .forEach((button) => {
            button.classList.toggle(
                "selected-service",
                Boolean(state.servico) && button.dataset.service === state.servico
            );
        });

    const action = state.status === "playing" ? "reproduzindo" : "pausado";
    setPlayerSyncVisual(
        "good",
        `${action} • sincronizado por ${state.atualizado_por || "Gui + Malu"}`
    );

    updatePlayerClock();

    const youtubeVideoId = extractYoutubeVideoId(state.conteudo_url || "");
    if (youtubeVideoId) {
        if (youtubeUrlInput && !youtubeUrlInput.matches(":focus")) {
            youtubeUrlInput.value = state.conteudo_url || "";
        }

        if (youtubePlayerReady) {
            applySharedStateToYoutube(state);
        } else {
            youtubePendingVideoId = youtubeVideoId;
        }
    }
}

async function loadPlayerState() {
    const { data, error } = await supabaseClient
        .from("estado_player")
        .select(
            "id, sala_id, servico, titulo, conteudo_url, posicao_segundos, status, atualizado_por, atualizado_em"
        )
        .eq("sala_id", ROOM_ID)
        .maybeSingle();

    if (error) {
        console.error("Erro ao carregar estado do player:", error);
        return;
    }

    if (data) updatePlayerUI(data);
}

async function stopPlayerRealtime() {
    if (!playerChannel) return;

    try {
        await supabaseClient.removeChannel(playerChannel);
    } catch (error) {
        console.warn("Não foi possível remover o canal do player:", error);
    }

    playerChannel = null;
    playerStarted = false;
}

async function startPlayerRealtime() {
    if (!currentUser || !currentParticipant || playerStarted) return;

    await stopPlayerRealtime();
    await loadPlayerState();

    const {
        data: { session }
    } = await supabaseClient.auth.getSession();

    if (!session?.access_token) return;

    supabaseClient.realtime.setAuth(session.access_token);

    playerChannel = supabaseClient.channel(PLAYER_TOPIC, {
        config: {
            private: true,
            broadcast: {
                self: false,
                ack: true
            }
        }
    });

    playerChannel
        .on(
            "broadcast",
            { event: "player_state" },
            ({ payload }) => {
                if (!payload) return;

                // The sender timestamp lets this device compensate for network transit.
                // getEffectivePlayerPosition() will add the elapsed time since atualizado_em.
                updatePlayerUI(payload);
                updatePlayerClock();
                correctPlayerDrift();
            }
        )
        .subscribe((status, error) => {
            console.log("Player realtime status:", status, error || "");

            if (status === "SUBSCRIBED") {
                playerStarted = true;
                setPlayerSyncVisual("good", "tempo real ativo");
            }

            if (status === "CHANNEL_ERROR") {
                setPlayerSyncVisual("resyncing", "erro de sincronização");
                console.error("Erro no canal privado do player:", error);
            }

            if (status === "TIMED_OUT") {
                setPlayerSyncVisual("resyncing", "reconectando...");
            }
        });
}

async function saveAndBroadcastPlayerState(changes) {
    if (!currentParticipant) return;

    const payload = {
        ...changes,
        atualizado_por: currentParticipant.nome,
        atualizado_em: new Date().toISOString()
    };

    const { data, error } = await supabaseClient
        .from("estado_player")
        .update(payload)
        .eq("sala_id", ROOM_ID)
        .select(
            "id, sala_id, servico, titulo, conteudo_url, posicao_segundos, status, atualizado_por, atualizado_em"
        )
        .single();

    if (error) {
        console.error("Erro ao atualizar estado do player:", error);
        alert("Não foi possível sincronizar a sala agora.");
        return;
    }

    updatePlayerUI(data);

    if (playerChannel) {
        try {
            await playerChannel.send({
                type: "broadcast",
                event: "player_state",
                payload: data
            });
        } catch (broadcastError) {
            console.error("Erro ao transmitir estado do player:", broadcastError);
        }
    }
}

async function selectStreamingService(service) {
    if (!service) return;

    await saveAndBroadcastPlayerState({
        servico: service,
        titulo: null,
        conteudo_url: null,
        posicao_segundos: 0,
        status: "paused"
    });
}

async function toggleSharedPlayback() {
    const nextStatus =
        currentPlayerState?.status === "playing" ? "paused" : "playing";

    const hasYoutubeVideo =
        extractYoutubeVideoId(currentPlayerState?.conteudo_url || "") &&
        youtubePlayerReady;

    const effectivePosition = hasYoutubeVideo
        ? getYoutubeCurrentTimeSafe()
        : getEffectivePlayerPosition();

    setPlayerSyncVisual("syncing", "sincronizando reprodução...");

    if (hasYoutubeVideo) {
        youtubeSyncGuardUntil = Date.now() + YOUTUBE_GUARD_MS;

        if (nextStatus === "playing") {
            youtubePlayer.playVideo();
        } else {
            youtubePlayer.pauseVideo();
        }
    }

    await saveAndBroadcastPlayerState({
        posicao_segundos: effectivePosition,
        status: nextStatus
    });
}

async function seekSharedPlayback(offsetSeconds) {
    const hasYoutubeVideo =
        extractYoutubeVideoId(currentPlayerState?.conteudo_url || "") &&
        youtubePlayerReady;

    const currentPosition = hasYoutubeVideo
        ? getYoutubeCurrentTimeSafe()
        : getEffectivePlayerPosition();

    const nextPosition = Math.max(0, currentPosition + offsetSeconds);

    setPlayerSyncVisual("syncing", "sincronizando posição...");

    if (hasYoutubeVideo) {
        youtubeSyncGuardUntil = Date.now() + YOUTUBE_GUARD_MS;
        youtubePlayer.seekTo(nextPosition, true);
    }

    await saveAndBroadcastPlayerState({
        posicao_segundos: nextPosition
    });
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
    await startPlayerRealtime();
    startPlayerClock();
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
    stopPlayerClock();
    await stopPlayerRealtime();
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
    button.addEventListener("click", async () => {
        const service = button.dataset.service;
        if (!service) return;

        await selectStreamingService(service);
        showRoom();
    });
});



if (rewindButton) {
    rewindButton.addEventListener("click", async () => {
        await seekSharedPlayback(-10);
    });
}

if (playButton) {
    playButton.addEventListener("click", async () => {
        await toggleSharedPlayback();
    });
}

if (forwardButton) {
    forwardButton.addEventListener("click", async () => {
        await seekSharedPlayback(10);
    });
}

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
    stopYoutubeHeartbeat();
    stopYoutubeStatePoll();
    stopPlayerClock();

    if (presenceChannel) {
        presenceChannel.untrack();
    }

    if (chatChannel) {
        supabaseClient.removeChannel(chatChannel);
    }

    if (playerChannel) {
        supabaseClient.removeChannel(playerChannel);
    }
});

loadYoutubeIframeApi();
checkSession();
