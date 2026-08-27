class SpaEngine {
  constructor() {
    this.init();
  }

  init() {
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a');

      if (!link || link.origin !== window.location.origin) return;

      event.preventDefault();

      this.navigate(link.href);
    });

    window.addEventListener('popstate', () => {
      this.navigate(window.location.href, false);
    });
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

window.spaEngine = new SpaEngine();
