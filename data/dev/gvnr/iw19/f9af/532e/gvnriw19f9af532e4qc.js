// toast — transient status messages. Frame mounts one instance and passes its
// api ({show}) to every other control that needs to speak.

var me = this;
var ME = document.getElementById(me.UUID);

var toastEl = ME.querySelector(".nb-toast");
var toastTimer = null;

me.show = function (message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2600);
};
