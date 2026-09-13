const enterButton = document.getElementById("enterButton");

const hero = document.querySelector(".hero");
const home = document.getElementById("home");

enterButton.addEventListener("click", () => {

    hero.style.display = "none";

    home.classList.remove("hidden");

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

});
