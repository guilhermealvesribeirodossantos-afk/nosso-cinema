const enterButton = document.getElementById("enterButton");
const storyButton = document.getElementById("storyButton");
const hero = document.getElementById("hero");
const home = document.getElementById("home");
const room = document.getElementById("room");
const openRoomButton = document.getElementById("openRoomButton");
const backHomeButton = document.getElementById("backHomeButton");

function showHome() {
    hero.classList.add("hidden");
    room.classList.add("hidden");
    home.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function showRoom() {
    hero.classList.add("hidden");
    home.classList.add("hidden");
    room.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

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
            window.open("https://www.youtube.com", "_blank", "noopener,noreferrer");
            return;
        }

        alert(
            `${service}: a interface já está pronta. A integração real com streaming será adicionada na próxima etapa.`
        );
    });
});

document.querySelectorAll(".bottom-nav button").forEach((button) => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".bottom-nav button").forEach((item) => {
            item.classList.remove("active");
        });

        button.classList.add("active");

        if (button.dataset.tab === "sala") {
            showRoom();
        }
    });
});
