(function () {
  "use strict";

  var LETTERS = ["O", "K", "R", "E", "L", "A", "X"];
  var SPEEDS = [0.08, 0.22, 0.35, 0.48, -0.1, 0.28, 0.42, 0.15, 0.55, 0.32, -0.08, 0.38];

  function buildMosaic() {
    var grid = document.getElementById("plx-mosaic");
    if (!grid) return;
    grid.textContent = "";
    var count = 18;
    var i;
    for (i = 0; i < count; i++) {
      var cell = document.createElement("span");
      cell.className = "plx-mosaic-cell";
      cell.textContent = LETTERS[i % LETTERS.length];
      cell.setAttribute("data-parallax", String(SPEEDS[i % SPEEDS.length]));
      cell.style.left = ((i * 17 + 5) % 82) + "%";
      cell.style.top = ((i * 23 + 8) % 78) + "%";
      cell.style.fontSize = (1.4 + (i % 5) * 0.55) + "rem";
      grid.appendChild(cell);
    }
  }

  function setupParallax() {
    var mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mqReduce.matches) return;

    var nodes = document.querySelectorAll("[data-parallax]");
    var ticking = false;

    function update() {
      var scrollY = window.scrollY || window.pageYOffset || 0;
      var i;
      for (i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        var speed = parseFloat(el.getAttribute("data-parallax")) || 0;
        var y = scrollY * speed;
        var base = el.getAttribute("data-parallax-base");
        var shift = "translate3d(0," + y.toFixed(2) + "px,0)";
        el.style.transform = base ? base + " " + shift : shift;
      }
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();
  }

  document.addEventListener("DOMContentLoaded", function () {
    buildMosaic();
    setupParallax();
  });
})();
