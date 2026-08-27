const defaultBody = document.body.cloneNode(true);
const defaultTitle = document.title;
const defaultUrl = window.location.href;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function restoreDefaultPage() {
  document.body.replaceWith(defaultBody.cloneNode(true));

  document.title = defaultTitle;

  window.history.replaceState({}, '', defaultUrl);
}

async function test(name, callback, finallyCallback) {
  try {
    await callback();

    console.log(`%cPASS: ${name}`, 'color: green; font-weight: bold;');
  } catch (error) {
    console.error(`FAIL: ${name}`, error);
  } finally {
    if (finallyCallback) {
      finallyCallback();
    }
  }
}

async function runTests() {
  await test(
    'fetches and parses the next document',
    async () => {
      const nextDocument = await window.spaEngine.getNextDocument('../details.html');

      assert(nextDocument instanceof Document, 'result should be a Document');

      assert(nextDocument.querySelector('#time') !== null, 'details.html should contain #time');

      assert(nextDocument.title === 'SPA Exercise', 'document title should be SPA Exercise');
    },
    restoreDefaultPage,
  );

  await test(
    'rejects when the request fails',
    async () => {
      const originalFetch = window.fetch;
      let requestFailed = false;

      window.fetch = async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      try {
        await window.spaEngine.getNextDocument('../missing.html');
      } catch (error) {
        requestFailed = true;

        assert(error.message.includes('404'), 'error should contain the 404 status');
      } finally {
        window.fetch = originalFetch;
      }

      assert(requestFailed, 'getNextDocument should reject failed requests');
    },
    restoreDefaultPage,
  );

  await test(
    'replaces the current body',
    async () => {
      const nextBody = document.implementation.createHTMLDocument('').body;

      nextBody.innerHTML = `
                <h1 id="new-content">New content</h1>
            `;

      window.spaEngine.replaceBody(nextBody);

      assert(document.querySelector('#new-content') !== null, 'new body content should be rendered');
    },
    restoreDefaultPage,
  );

  await test(
    'executes inline scripts after replacing the body',
    async () => {
      const nextBody = document.implementation.createHTMLDocument('').body;

      nextBody.innerHTML = `
                <div id="script-result"></div>

                <script>
                    document.querySelector(
                        '#script-result'
                    ).textContent = 'executed';
                </script>
            `;

      window.spaEngine.replaceBody(nextBody);

      assert(document.querySelector('#script-result').textContent === 'executed', 'inline script should be executed');
    },
    restoreDefaultPage,
  );

  await test(
    'updates the document title during navigation',
    async () => {
      const originalFetch = window.fetch;

      window.fetch = async () => ({
        ok: true,
        text: async () => `
                    <!DOCTYPE html>
                    <html>
                        <head>
                            <title>New Page</title>
                        </head>
                        <body>
                            <h1 id="new-page">New Page</h1>
                        </body>
                    </html>
                `,
      });

      try {
        await window.spaEngine.navigate('../details.html', false);

        assert(document.title === 'New Page', 'navigation should update the title');

        assert(document.querySelector('#new-page') !== null, 'navigation should render the new body');
      } finally {
        window.fetch = originalFetch;
      }
    },
    restoreDefaultPage,
  );

  await test(
    'updates browser history during navigation',
    async () => {
      const originalFetch = window.fetch;
      const originalPushState = window.history.pushState;

      let pushedUrl = null;

      window.fetch = async () => ({
        ok: true,
        text: async () => `
                    <!DOCTYPE html>
                    <html>
                        <head>
                            <title>History Page</title>
                        </head>
                        <body>
                            <h1>History Page</h1>
                        </body>
                    </html>
                `,
      });

      window.history.pushState = (state, title, url) => {
        pushedUrl = url;
      };

      try {
        await window.spaEngine.navigate('../details.html');

        assert(pushedUrl !== null, 'navigation should call pushState');
      } finally {
        window.fetch = originalFetch;
        window.history.pushState = originalPushState;
      }
    },
    restoreDefaultPage,
  );

  await test(
    'does not update history during popstate navigation',
    async () => {
      const originalFetch = window.fetch;
      const originalPushState = window.history.pushState;

      let pushStateCalled = false;

      window.fetch = async () => ({
        ok: true,
        text: async () => `
                    <!DOCTYPE html>
                    <html>
                        <head>
                            <title>Previous Page</title>
                        </head>
                        <body>
                            <h1>Previous Page</h1>
                        </body>
                    </html>
                `,
      });

      window.history.pushState = () => {
        pushStateCalled = true;
      };

      try {
        await window.spaEngine.navigate('../index.html', false);

        assert(pushStateCalled === false, 'popstate navigation should not call pushState');
      } finally {
        window.fetch = originalFetch;
        window.history.pushState = originalPushState;
      }
    },
    restoreDefaultPage,
  );

  await test(
    'matches an HTML route',
    async () => {
      const isNotAnSpaRoute = window.spaEngine.isNotAnSpaRoute('../details.html');

      assert(isNotAnSpaRoute === false, 'details.html should match *.html');
    },
    restoreDefaultPage,
  );

  await test(
    'matches a route with a prefix wildcard',
    async () => {
      const isNotAnSpaRoute = window.spaEngine.isNotAnSpaRoute('/site/about');

      assert(isNotAnSpaRoute === false, '/site/about should match /site/*');
    },
    restoreDefaultPage,
  );

  await test(
    'rejects a URL outside the configured prefix',
    async () => {
      const isNotAnSpaRoute = window.spaEngine.isNotAnSpaRoute('/admin/about');

      assert(isNotAnSpaRoute === true, '/admin/about should not match /site/*');
    },
    restoreDefaultPage,
  );

  await test(
    'matches an exact route',
    async () => {
      const matches = window.spaEngine.matchesRoute('/about.html', '/about.html');

      assert(matches, '/about.html should match the exact route');
    },
    restoreDefaultPage,
  );

  await test(
    'rejects a different exact route',
    async () => {
      const matches = window.spaEngine.matchesRoute('/contact.html', '/about.html');

      assert(matches === false, '/contact.html should not match /about.html');
    },
    restoreDefaultPage,
  );

  await test(
    'matches routes using only the pathname',
    async () => {
      const matches = window.spaEngine.matchesRoute('../details.html?tab=info#top', '*.html');

      assert(matches, 'query parameters and hashes should not break route matching');
    },
    restoreDefaultPage,
  );

  await test(
    'does not treat the dot as a regex wildcard',
    async () => {
      const matches = window.spaEngine.matchesRoute('/detailsXhtml', '/details.html');

      assert(matches === false, '/details.html should not match /detailsXhtml');
    },
    restoreDefaultPage,
  );
}

runTests();
