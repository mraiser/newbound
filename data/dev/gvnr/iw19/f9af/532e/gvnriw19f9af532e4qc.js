// toast — transient status messages. Frame mounts one instance and passes its
// api ({show}) to every other control that needs to speak.

export function init(host) {
  const el = host.querySelector(".nb-toast");
  let timer = null;

  return {
    show(message) {
      el.textContent = message;
      el.classList.add("show");
      clearTimeout(timer);
      timer = setTimeout(() => el.classList.remove("show"), 2600);
    },
  };
}
