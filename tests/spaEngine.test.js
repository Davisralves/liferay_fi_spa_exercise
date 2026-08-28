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

async function waitFor(condition, timeout = 2000) {
  const startedAt = Date.now();

  while (!condition()) {
    if (Date.now() - startedAt >= timeout) {
      throw new Error('Timed out waiting for condition');
    }

    await new Promise((resolve) => window.setTimeout(resolve, 25));
  }
}

function restoreDefaultPage() {
  document.body.replaceWith(defaultBody.cloneNode(true));
  document.title = defaultTitle;
  window.history.replaceState({}, '', defaultUrl);
  window.spaEngine.resetComponentState();
}

async function test(name, callback, finallyCallback) {
  try {
    await callback();
    console.log(`%cPASS: ${name}`, 'color: green; font-weight: bold;');
  } catch (error) {
    console.error(`FAIL: ${name}`, error);
  } finally {
    finallyCallback?.();
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
      () => {
        const nextBody = document.implementation.createHTMLDocument('').body;
        nextBody.innerHTML = '<h1 id="new-content">New content</h1>';

        const loadingBar = window.spaEngine.insertLoadingBar();
        window.spaEngine.replaceBody(nextBody, loadingBar);

        assert(document.querySelector('#new-content') !== null, 'new body content should be rendered');
      },
      restoreDefaultPage,
    );

    await test(
      'executes inline scripts after body replacement',
      () => {
        const nextBody = document.implementation.createHTMLDocument('').body;
        nextBody.innerHTML = `
          <div id="script-result"></div>
          <script>
            document.querySelector('#script-result').textContent = 'executed';
          </script>
        `;

        const loadingBar = window.spaEngine.insertLoadingBar();
        window.spaEngine.replaceBody(nextBody, loadingBar);

        assert(document.querySelector('#script-result').textContent === 'executed', 'inline script should execute');
      },
      restoreDefaultPage,
    );
  });

  await describe('Route matching', async () => {
    await test(
      'matches configured routes',
      () => {
        assert(!window.spaEngine.isNotAnSpaRoute('../details.html'), 'HTML route should match');
        assert(!window.spaEngine.isNotAnSpaRoute('/site/about'), 'prefix route should match');
        assert(window.spaEngine.isNotAnSpaRoute('/admin/about'), 'outside route should not match');
        assert(window.spaEngine.matchesRoute('/about.html', '/about.html'), 'exact route should match');
        assert(!window.spaEngine.matchesRoute('/contact.html', '/about.html'), 'different route should not match');
        assert(
          window.spaEngine.matchesRoute('../details.html?tab=info#top', '*.html'),
          'query and hash should be ignored',
        );
        assert(!window.spaEngine.matchesRoute('/detailsXhtml', '/details.html'), 'dots should be literal');
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
          text: async () =>
            '<html><head><title>New Page</title></head><body><h1 id="new-page">New Page</h1></body></html>',
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
          text: async () => '<html><head><title>Previous Page</title></head><body><h1>Previous Page</h1></body></html>',
        });
        window.history.pushState = () => {
          pushStateCalled = true;
        };

        try {
          await window.spaEngine.navigate('../index.html', false);
          assert(!pushStateCalled, 'popstate should not call pushState');
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
        window.fetch = async () => ({ ok: false, status: 404, statusText: 'Not Found' });

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
      'starts and removes the loading bar during navigation',
      async () => {
        const originalGetNextDocument = window.spaEngine.getNextDocument;
        let resolveDocument;
        const pendingDocument = new Promise((resolve) => {
          resolveDocument = resolve;
        });
        window.spaEngine.getNextDocument = () => pendingDocument;

        const navigation = window.spaEngine.navigate('../details.html', false);
        await new Promise((resolve) => window.setTimeout(resolve, 550));

        const loadingBar = document.getElementById('loading-bar');
        assert(loadingBar !== null, 'loading bar should exist while navigation is pending');
        assert(loadingBar.getAttribute('is-loading') === 'true', 'loading bar should be active');

        resolveDocument(
          new DOMParser().parseFromString(
            '<html><head><title>Loaded</title></head><body><h1>Loaded</h1></body></html>',
            'text/html',
          ),
        );
        await navigation;

        assert(document.getElementById('loading-bar') === null, 'loading bar should be removed');
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

        const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
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

  await describe('Barber booking component state', async () => {
    await test(
      'contains matching marked components on all booking pages',
      async () => {
        const pages = await Promise.all([
          window.spaEngine.getNextDocument('../tests/component-page-a.html'),
          window.spaEngine.getNextDocument('../tests/component-page-b.html'),
          window.spaEngine.getNextDocument('../tests/component-page-c.html'),
        ]);

        for (const page of pages.slice(0, 2)) {
          assert(
            page.querySelector('#booking-controls[data-spa-component]') !== null,
            'Pages A and B should contain booking controls',
          );
        }
        assert(
          pages[0].querySelector('#barber-selection[data-spa-component]') !== null,
          'Page A should contain barber selection',
        );
        assert(
          pages[1].querySelector('#barber-selection[data-spa-component]') === null,
          'Page B should not contain barber selection',
        );
        assert(
          pages[1].querySelector('#service-selection[data-spa-component]') !== null,
          'Page B should contain service selection',
        );
        assert(
          pages[2].querySelector('#service-selection[data-spa-component]') !== null,
          'Page C should contain service selection',
        );
        assert(
          pages[2].querySelector('#booking-controls[data-spa-component]') === null,
          'Page C should not contain booking controls',
        );
      },
      restoreDefaultPage,
    );

    await test(
      'preserves booking state from barber selection through checkout',
      async () => {
        const pageA = await window.spaEngine.getNextDocument('../tests/component-page-a.html');
        const loadingBar = window.spaEngine.insertLoadingBar();
        window.spaEngine.replaceBody(pageA.body, loadingBar);

        document.querySelector('#booking-search-a').value = 'bruno';
        document.querySelector('#booking-search-a').dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('#booking-order').checked = false;
        document.querySelector('#booking-order').dispatchEvent(new Event('change', { bubbles: true }));
        document.querySelector('#barber-bruno').checked = true;

        document.querySelector('a[href="component-page-b.html"]').click();

        await waitFor(() => document.querySelector('#service-selection') !== null);

        assert(document.querySelector('#booking-search-b').value === '', 'search should start empty on Page B');
        assert(
          document.querySelector('#booking-order').checked === false,
          'descending order should be preserved on Page B',
        );

        document.querySelector('#service-haircut').checked = true;
        document.querySelector('#service-shave').checked = true;

        document.querySelector('a[href="component-page-c.html"]').click();

        await waitFor(() => document.querySelector('#confirm-booking') !== null);

        assert(document.querySelector('#barber-bruno').checked, 'barber should be preserved on checkout');
        assert(document.querySelector('#service-haircut').checked, 'haircut should be preserved on checkout');
        assert(document.querySelector('#service-shave').checked, 'shave should be preserved on checkout');
      },
      restoreDefaultPage,
    );

    await test(
      'filters barbers by name',
      async () => {
        const pageA = await window.spaEngine.getNextDocument('../tests/component-page-a.html');
        const loadingBar = window.spaEngine.insertLoadingBar();
        window.spaEngine.replaceBody(pageA.body, loadingBar);

        const search = document.querySelector('#booking-search-a');
        const barberItems = [...document.querySelectorAll('#barber-selection [data-filter-item]')];

        search.value = 'brun';
        search.dispatchEvent(new Event('input', { bubbles: true }));

        assert(
          barberItems.find((item) => item.dataset.name === 'Bruno').hidden === false,
          'matching barber should remain visible',
        );
        assert(
          barberItems.filter((item) => item.dataset.name !== 'Bruno').every((item) => item.hidden),
          'non-matching barbers should be hidden',
        );
      },
      restoreDefaultPage,
    );

    await test(
      'orders services descending without losing selection',
      async () => {
        const pageB = await window.spaEngine.getNextDocument('../tests/component-page-b.html');
        const loadingBar = window.spaEngine.insertLoadingBar();
        window.spaEngine.replaceBody(pageB.body, loadingBar);

        const selectedService = document.querySelector('#service-haircut');
        const order = document.querySelector('#booking-order');
        selectedService.checked = true;
        order.checked = false;
        order.dispatchEvent(new Event('change', { bubbles: true }));

        const serviceNames = [...document.querySelectorAll('#service-selection [data-filter-item]')].map(
          (item) => item.dataset.name,
        );

        assert(
          JSON.stringify(serviceNames) === JSON.stringify(['Styling', 'Shave', 'Haircut', 'Beard trim']),
          'services should be ordered descending by name',
        );
        assert(selectedService.checked, 'sorting should preserve the selected service');
      },
      restoreDefaultPage,
    );

    await test(
      'shows the scheduled state after confirmation',
      async () => {
        const pageC = await window.spaEngine.getNextDocument('../tests/component-page-c.html');
        const loadingBar = window.spaEngine.insertLoadingBar();
        window.spaEngine.replaceBody(pageC.body, loadingBar);

        const confirmation = document.querySelector('#booking-confirmation');
        assert(confirmation.hidden, 'confirmation should start hidden');
        document.querySelector('#confirm-booking').click();
        assert(!confirmation.hidden, 'confirmation should be visible after confirmation');
      },
      restoreDefaultPage,
    );

    await test(
      'provides a checkout button to return to services',
      async () => {
        const pageC = await window.spaEngine.getNextDocument('../tests/component-page-c.html');
        assert(
          pageC.querySelector('#back-to-services[type="button"]') !== null,
          'checkout should contain a back button',
        );
      },
      restoreDefaultPage,
    );
    await test(
      'applies the restored order to the service list',
      async () => {
        const pageA = await window.spaEngine.getNextDocument('../tests/component-page-a.html');

        const loadingBar = window.spaEngine.insertLoadingBar();
        window.spaEngine.replaceBody(pageA.body, loadingBar);

        document.querySelector('#booking-order').checked = false;

        await window.spaEngine.navigate('../tests/component-page-b.html', false);

        const serviceNames = [...document.querySelectorAll('#service-selection [data-filter-item]')].map(
          (item) => item.dataset.name,
        );

        assert(
          JSON.stringify(serviceNames) === JSON.stringify(['Styling', 'Shave', 'Haircut', 'Beard trim']),
          'services should be ordered descending after restoring the order state',
        );
      },
      restoreDefaultPage,
    );

    await test(
      'restores a shared search value and applies the filter',
      async () => {
        const pageA = await window.spaEngine.getNextDocument('../tests/component-page-a.html');

        const loadingBar = window.spaEngine.insertLoadingBar();
        window.spaEngine.replaceBody(pageA.body, loadingBar);

        const search = document.querySelector('#booking-search-a');

        search.value = 'shav';

        window.spaEngine.captureComponentState();

        const pageB = await window.spaEngine.getNextDocument('../tests/component-page-b.html');

        pageB.body.innerHTML = pageB.body.innerHTML.replaceAll('booking-search-b', 'booking-search-a');

        window.spaEngine.restoreComponentState(pageB);
        window.spaEngine.replaceBody(pageB.body, loadingBar);

        const matchingService = document.querySelector('[data-filter-item][data-name="Shave"]');

        const nonMatchingServices = [...document.querySelectorAll('#service-selection [data-filter-item]')].filter(
          (item) => item.dataset.name !== 'Shave',
        );

        assert(
          document.querySelector('#booking-search-a').value === 'shav',
          'the shared search value should be restored',
        );

        assert(matchingService.hidden === false, 'the matching service should remain visible');

        assert(
          nonMatchingServices.every((item) => item.hidden),
          'non-matching services should be hidden',
        );
      },
      restoreDefaultPage,
    );

    await test(
      'restores appointment state in the existing service component',
      async () => {
        const pageB = await window.spaEngine.getNextDocument('../tests/component-page-b.html');
        const loadingBar = window.spaEngine.insertLoadingBar();
        window.spaEngine.replaceBody(pageB.body, loadingBar);

        document.querySelector('#service-haircut').checked = true;
        document.querySelector('#service-shave').checked = true;
        document.querySelector('#appointment-afternoon').checked = true;

        document.querySelector('#service-haircut').dispatchEvent(new Event('change', {bubbles: true}));
        document.querySelector('#appointment-afternoon').dispatchEvent(new Event('change', {bubbles: true}));

        assert(
          document.querySelector('#service-summary').textContent === '2 services selected',
          'service summary should update after selecting services',
        );
        assert(
          document.querySelector('#appointment-summary').textContent === 'Appointment: afternoon',
          'appointment summary should update after selecting a time',
        );

        document.querySelector('a[href="component-page-c.html"]').click();

        await waitFor(() => document.querySelector('#confirm-booking') !== null);

        assert(document.querySelector('#service-haircut').checked, 'haircut should remain selected on checkout');
        assert(document.querySelector('#service-shave').checked, 'shave should remain selected on checkout');
        assert(
          document.querySelector('#appointment-afternoon').checked,
          'appointment time should remain selected on checkout',
        );
        assert(
          document.querySelector('#service-summary').textContent === '2 services selected',
          'custom state should update the service summary',
        );
        assert(
          document.querySelector('#appointment-summary').textContent === 'Appointment: afternoon',
          'custom state should update the appointment summary',
        );
      },
      restoreDefaultPage,
    );
  });
}

runTests();
