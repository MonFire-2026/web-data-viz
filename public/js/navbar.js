function mostrarMenu() {
    const menu = document.getElementById("menuLinksHeader");
    const botao = document.querySelector(".botaoMenu");

    if (!menu || !botao) {
        return;
    }

    const menuAberto = menu.classList.toggle("menu-aberto");
    botao.setAttribute("aria-expanded", String(menuAberto));
    botao.setAttribute("aria-label", menuAberto ? "Fechar menu de navegação" : "Abrir menu de navegação");
}
