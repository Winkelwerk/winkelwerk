function toggleMenu(){
  if (window.matchMedia("(hover: hover)").matches) {
    return;
  }

  document.getElementById("sideMenu").classList.toggle("open");
}
