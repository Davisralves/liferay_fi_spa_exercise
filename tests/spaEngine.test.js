const defaultBody = document.body.cloneNode(true);
const defaultTitle = document.title;
const defaultUrl = window.location.href;

async function describe(name, callback) {
  console.group(name);

  try {
    await callback();
  } finally {
    console.groupEnd();
  }
}

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
  await describe('HTML rendering and script execution', async () => {
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
      'replaces the current body',
      async () => {
        const nextBody = document.implementation.createHTMLDocument('').body;

        nextBody.innerHTML = `
                        <h1 id="new-content">
                            New content
                        </h1>
                    `;
        const loadingBar = window.spaEngine.insertLoadingBar();
        window.spaEngine.replaceBody(nextBody, loadingBar);

        assert(document.querySelector('#new-content') !== null, 'new body content should be rendered');
      },
      restoreDefaultPage,
    );

    await test(
      'executes inline scripts after body replacement',
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

        const loadingBar = window.spaEngine.insertLoadingBar();
        window.spaEngine.replaceBody(nextBody, loadingBar);

        assert(document.querySelector('#script-result').textContent === 'executed', 'inline script should be executed');
      },
      restoreDefaultPage,
    );
  });

  await describe('Route matching', async () => {
    await test(
      'matches an HTML route',
      async () => {
        const isNotAnSpaRoute = window.spaEngine.isNotAnSpaRoute('../details.html');

        assert(isNotAnSpaRoute === false, 'details.html should match *.html');
      },
      restoreDefaultPage,
    );

    await test(
      'matches a prefix wildcard route',
      async () => {
        const isNotAnSpaRoute = window.spaEngine.isNotAnSpaRoute('/site/about');

        assert(isNotAnSpaRoute === false, '/site/about should match /site/*');
      },
      restoreDefaultPage,
    );

    await test(
      'rejects a path outside the configured prefix',
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

        assert(matches, 'exact route should match');
      },
      restoreDefaultPage,
    );

    await test(
      'rejects a different exact route',
      async () => {
        const matches = window.spaEngine.matchesRoute('/contact.html', '/about.html');

        assert(matches === false, 'different route should not match');
      },
      restoreDefaultPage,
    );

    await test(
      'ignores query parameters and hashes',
      async () => {
        const matches = window.spaEngine.matchesRoute('../details.html?tab=info#top', '*.html');

        assert(matches, 'route matching should use pathname');
      },
      restoreDefaultPage,
    );

    await test(
      'treats dots as literal characters',
      async () => {
        const matches = window.spaEngine.matchesRoute('/detailsXhtml', '/details.html');

        assert(matches === false, '. should not be a regex wildcard');
      },
      restoreDefaultPage,
    );
  });

  await describe('Navigation and browser history', async () => {
    await test(
      'updates the document title during navigation',
      async () => {
        const originalFetch = window.fetch;

        window.fetch = async () => ({
          ok: true,
          text: async () => `
                            <html>
                                <head>
                                    <title>New Page</title>
                                </head>
                                <body>
                                    <h1 id="new-page">
                                        New Page
                                    </h1>
                                </body>
                            </html>
                        `,
        });

        try {
          await window.spaEngine.navigate('../details.html', false);

          assert(document.title === 'New Page', 'title should be updated');

          assert(document.querySelector('#new-page') !== null, 'new body should be rendered');
        } finally {
          window.fetch = originalFetch;
        }
      },
      restoreDefaultPage,
    );

    await test(
      'does not push history during popstate navigation',
      async () => {
        const originalFetch = window.fetch;
        const originalPushState = window.history.pushState;

        let pushStateCalled = false;

        window.fetch = async () => ({
          ok: true,
          text: async () => `
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

          assert(pushStateCalled === false, 'popstate should not call pushState');
        } finally {
          window.fetch = originalFetch;
          window.history.pushState = originalPushState;
        }
      },
      restoreDefaultPage,
    );
  });

  await describe('Error handling', async () => {
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

          assert(error.message.includes('404'), 'error should contain 404');
        } finally {
          window.fetch = originalFetch;
        }

        assert(requestFailed, 'failed requests should reject');
      },
      restoreDefaultPage,
    );
  });

  await describe('Enabled option', async () => {
    await test('does not initialize when the engine is disabled', () => {
      const originalAddEventListener = document.addEventListener;

      let listenerCount = 0;

      document.addEventListener = () => {
        listenerCount += 1;
      };
      try {
        new SpaEngine([], false);

        assert(listenerCount === 0, 'disabled engine should not register document listeners');
      } finally {
        document.addEventListener = originalAddEventListener;
      }
    });
  });

  await describe('Loading bar', async () => {
    await test(
      'starts loading when navigation begins and removes the bar when navigation finishes',
      async () => {
        const originalGetNextDocument = window.spaEngine.getNextDocument;

        let resolveDocument;

        const pendingDocument = new Promise((resolve) => {
          resolveDocument = resolve;
        });

        window.spaEngine.getNextDocument = () => {
          return pendingDocument;
        };

        const navigation = window.spaEngine.navigate('../details.html', false);

        await new Promise((resolve) => {
          window.setTimeout(resolve, 550);
        });

        const loadingBar = document.getElementById('loading-bar');

        assert(loadingBar !== null, 'loading bar should exist while navigation is pending');

        assert(loadingBar.getAttribute('is-loading') === 'true', 'loading bar should be in the loading state');

        const nextDocument = new DOMParser().parseFromString(
          `
                        <!DOCTYPE html>
                        <html>
                            <head>
                                <title>Loaded Page</title>
                            </head>
                            <body>
                                <h1 id="loaded-page">
                                    Loaded Page
                                </h1>
                            </body>
                        </html>
                    `,
          'text/html',
        );

        resolveDocument(nextDocument);

        await navigation;

        assert(document.querySelector('#loaded-page') !== null, 'new page should be rendered');

        assert(
          document.getElementById('loading-bar') === null,
          'loading bar should be removed after navigation finishes',
        );

        window.spaEngine.getNextDocument = originalGetNextDocument;
      },
      restoreDefaultPage,
    );
  });

  await describe('data-no-spa links', async () => {
    await test(
      'does not intercept links marked with data-no-spa',
      () => {
        const link = document.createElement('a');
        const originalNavigate = window.spaEngine.navigate;
        const originalPreventDefault = MouseEvent.prototype.preventDefault;

        let navigateCalled = false;
        let preventDefaultCalled = false;

        link.href = '../details.html';
        link.dataset.noSpa = 'true';

        const preventBrowserNavigation = (event) => {
          originalPreventDefault.call(event);
        };

        window.addEventListener('click', preventBrowserNavigation);

        document.body.append(link);

        window.spaEngine.navigate = () => {
          navigateCalled = true;
        };

        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        });

        clickEvent.preventDefault = () => {
          preventDefaultCalled = true;
          originalPreventDefault.call(clickEvent);
        };

        try {
          link.dispatchEvent(clickEvent);

          assert(!preventDefaultCalled, 'data-no-spa links should not call preventDefault');

          assert(!navigateCalled, 'data-no-spa links should not trigger SPA navigation');
        } finally {
          window.removeEventListener('click', preventBrowserNavigation);
          window.spaEngine.navigate = originalNavigate;
        }
      },
      restoreDefaultPage,
    );
  });

  await describe('Component state preservation', async () => {
    // Tests for saving and restoring state by component ID.
  });
}

runTests();
