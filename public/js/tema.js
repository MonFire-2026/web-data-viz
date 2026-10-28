(function () {
    "use strict";

    var itens = document.querySelectorAll(".tm-reveal");

    function mostrar(e1) {
        e1.classList.add("tm-visivel");
    }

    if("IntersectionObserver" in window) {
        var observador = new IntersectionObserver(function (entradas) {
            entradas.forEach(function (entrada) {
                if(!entrada.isIntersecting) return;

                var e1 = entrada.target;
                var posicao = Array.prototype.indexOf.call(e1.parentNode.children, e1);
                e1.style.transitionDelay = Math.min(posicao, 5) * 90 + "ms";
                mostrar(e1);

                setTimeout(function () {
                    e1.style.transitionDelay = "";
                }, 1000);

                observador.unobserve(e1);
            });
        }, { threshold: 0.15 });

        itens.forEach(function (e1) { observador.observe(e1); });
    } else {
        itens.forEach(mostrar);
    }

     var cartoes = document.querySelectorAll(".tm-flip");
 
    function virar(cartao) {
        var virado = cartao.classList.toggle("tm-virado");
        cartao.setAttribute("aria-pressed", virado ? "true" : "false");
    }
 
    cartoes.forEach(function (cartao) {
        cartao.addEventListener("click", function () { virar(cartao); });
        cartao.addEventListener("keydown", function (ev) {
            if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                virar(cartao);
            }
        });
    });
 
    var comparativo = document.querySelector(".tm-comparativo");
 
    if (comparativo) {
        var botoesModo = comparativo.querySelectorAll(".tm-botaoModo");
 
        botoesModo.forEach(function (botao) {
            botao.addEventListener("click", function () {
                comparativo.setAttribute("data-modo", botao.getAttribute("data-modo"));
                botoesModo.forEach(function (outro) {
                    outro.setAttribute("aria-pressed", outro === botao ? "true" : "false");
                });
            });
        });
    }
})();