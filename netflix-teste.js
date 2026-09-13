const NETFLIX_URL = "https://www.netflix.com/browse";

const openInsideBtn = document.getElementById("openInsideBtn");
const openExternalBtn = document.getElementById("openExternalBtn");
const reloadBtn = document.getElementById("reloadBtn");

const netflixFrame = document.getElementById("netflixFrame");
const framePlaceholder = document.getElementById("framePlaceholder");

const statusDot = document.getElementById("statusDot");
const statusTitle = document.getElementById("statusTitle");
const statusText = document.getElementById("statusText");

let loadTimer = null;

function setStatus(mode, title, text) {
    statusDot.className = `status-dot ${mode}`;
    statusTitle.textContent = title;
    statusText.textContent = text;
}

function startNetflixInsideTest() {
    clearTimeout(loadTimer);

    setStatus(
        "loading",
        "Tentando abrir dentro do Nosso Cinema",
        "Aguarde alguns segundos e observe a área abaixo."
    );

    framePlaceholder.hidden = true;
    netflixFrame.hidden = false;

    netflixFrame.src = "about:blank";

    setTimeout(() => {
        netflixFrame.src = `${NETFLIX_URL}?nc_test=${Date.now()}`;
    }, 120);

    loadTimer = setTimeout(() => {
        setStatus(
            "sent",
            "Tentativa enviada",
            "Veja a área da Netflix. Se houver bloqueio, tela branca, tela preta ou mensagem de erro, tire uma foto."
        );
    }, 2500);
}

openInsideBtn.addEventListener(
    "click",
    startNetflixInsideTest
);

reloadBtn.addEventListener(
    "click",
    startNetflixInsideTest
);

openExternalBtn.addEventListener(
    "click",
    () => {
        window.open(
            NETFLIX_URL,
            "_blank",
            "noopener,noreferrer"
        );
    }
);

netflixFrame.addEventListener(
    "load",
    () => {
        console.log(
            "Iframe Netflix disparou evento load."
        );
    }
);
