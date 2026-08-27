class SpaEngine {
  #routes;
  #enable;

  constructor(routes = [], enable = true) {
    this.#routes = routes;
    this.#enable = enable;
    this.init();
  }

  init() {
    if (!this.#enable) return;

    document.addEventListener('click', (event) => {
      const link = event.target.closest('a');

      if (!link || link?.origin !== window.location.origin || this.isNotAnSpaRoute(link.href)) return;

      event.preventDefault();

      this.navigate(link.href);
    });

    window.addEventListener('popstate', () => {
      this.navigate(window.location.href, false);
    });
  }

  isNotAnSpaRoute(url) {
    return !this.#routes.some((route) => this.matchesRoute(url, route));
  }

  matchesRoute(url, route) {
    const parsedUrl = new URL(url, window.location.href);
    const pathValue = parsedUrl.pathname;
    const escapedRoute = route.replace(/[.+?^${}()|[\]\\]/g, String.raw`\$&`);
    const regex = new RegExp(`^${escapedRoute.replaceAll('*', '.*')}$`);
    return regex.test(pathValue);
  }

  async navigate(url, updateHistory = true) {
    const nextDocument = await this.getNextDocument(url);

    this.replaceBody(nextDocument.body);
    document.title = nextDocument.title;

    if (updateHistory) {
      window.history.pushState({}, '', url);
    }
  }

  async getNextDocument(url) {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    return new DOMParser().parseFromString(html, 'text/html');
  }

  replaceBody(nextBody) {
    document.body.replaceChildren(...nextBody.childNodes);

    this.executeScripts();
  }

  executeScripts() {
    const scripts = document.body.querySelectorAll('script');

    for (const script of scripts) {
      const reloadedScript = document.createElement('script');

      for (const attribute of script.attributes) {
        reloadedScript.setAttribute(attribute.name, attribute.value);
      }

      reloadedScript.textContent = script.textContent;

      script.replaceWith(reloadedScript);
    }
  }
}

window.SpaEngine = SpaEngine;
