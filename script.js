function toggleMenu() {
  const sideMenu = document.getElementById("sideMenu");

  if (!sideMenu) {
    return;
  }

  const isOpen = sideMenu.classList.toggle("open");
  const menuButton = document.querySelector(".menu-icon");

  if (menuButton) {
    menuButton.setAttribute("aria-expanded", String(isOpen));
  }
}

window.toggleMenu = toggleMenu;
