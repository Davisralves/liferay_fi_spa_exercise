class SpaEngine {
  #routes;
  #enable;

  constructor(routes = [], enable = true) {
    this.#routes = routes;
    this.#enable = enable;
    this.loadStyles();
    this.init();
  }

  init() {
    if (!this.#enable) return;

    document.addEventListener('click', (event) => {
      const link = event.target.closest('a');

      if (
        !link ||
        link?.origin !== window.location.origin ||
        this.isNotAnSpaRoute(link.href) ||
        link.dataset.noSpa !== undefined
      )
        return;

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
    const loadingBar = this.insertLoadingBar();
    try {
      await this.delay(500); // Simulate a delay for demonstration purposes

      const nextDocument = await this.getNextDocument(url);

      this.replaceBody(nextDocument.body, loadingBar);
      document.title = nextDocument.title;

      if (updateHistory) {
        window.history.pushState({}, '', url);
      }
    } finally {
      await this.removeLoadingBar(loadingBar);
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

  replaceBody(nextBody, loadingBar) {
    document.body.replaceChildren(loadingBar, ...nextBody.childNodes);

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

  insertLoadingBar() {
    const loadingBar = document.createElement('div');

    loadingBar.id = 'loading-bar';

    document.body.prepend(loadingBar);

    // Force the browser to render the initial width before changing it.
    loadingBar.offsetWidth;

    loadingBar.setAttribute('is-loading', 'true');

    return loadingBar;
  }

  removeLoadingBar(loadingBar) {
    return new Promise((resolve) => {
      loadingBar.setAttribute('is-loading', 'false');
      this.delay(300).then(() => {
        loadingBar.remove();
        resolve();
      });
    });
  }

  loadStyles() {
    if (document.querySelector('#spa-engine-stylesheet')) {
      return;
    }

    const stylesheet = document.createElement('link');

    stylesheet.id = 'spa-engine-stylesheet';
    stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('spaEngine.css', document.currentScript.src);

    document.head.appendChild(stylesheet);
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

window.SpaEngine = SpaEngine;
