# Liferay Frontend SPA Exercise

This project implements a small Single Page Application (SPA) engine with vanilla JavaScript only. It progressively enhances a website made of regular HTML pages: links that match configured routes are fetched in the background and rendered without a full browser refresh.

## Requirements

The exercise requires an SPA engine that:

- Uses no third-party libraries.
- Can be added to an existing website with minimal changes.
- Recognizes SPA links through a `routes` configuration.
- Can be disabled so links use normal browser navigation.
- Replaces the current `<body>` with the fetched page body.
- Executes inline and external scripts contained in fetched content.
- Includes unit tests.
- Displays a loading bar while content is being loaded.
- Manages browser history.
- Does not use SPA navigation for links with `data-no-spa`.
- Provides an API for preserving component state between pages when components share an ID.

## Current Status

### Completed

- Vanilla JavaScript SPA engine with no dependencies.
- HTML fetching and parsing with `fetch()` and `DOMParser`.
- Body replacement using `document.body.replaceChildren()`.
- Script recreation after rendering so page scripts execute.
- Browser history updates with `history.pushState()` and `popstate`.
- Configurable wildcard route matching.
- Configurable enabled/disabled engine behavior.
- Loading bar that starts during navigation, completes when navigation finishes, and is removed afterward.
- SPA navigation is skipped for links with the `data-no-spa` attribute.
- Form state is captured and restored for marked components with matching IDs.
- Component state can be cleared with `resetComponentState()`.
- Restored form controls are applied before the next body is rendered.
- Restored controls dispatch `input` or `change` events so dependent page behavior is updated.
- Barber selection, service selection, filtering, ordering, and checkout behavior are covered by browser tests.
- Browser-based tests with a lightweight custom `describe`, `test`, and `assert` runner.

## Project Structure

```text
index.html                 Initial page
details.html               Page loaded through SPA navigation
scripts/spaEngine.js       Reusable SPA engine
spaEngine.css              Loading bar styles
scripts/spaInit.js         Site-specific engine initialization
scripts/spaReady.js        Page initialization readiness helper
tests/component-page-a.html Component state test page A
tests/component-page-b.html Component state test page B
tests/component-page-c.html Checkout and confirmation test page
tests/external-script-page.html External script test page
tests/external-script.js      External script test fixture
tests/spaEngine.test.html  Browser test page
tests/spaEngine.test.js    Native browser test runner and tests
.gitignore                 Local-only file exclusions
```

## Usage

Each page that should support direct navigation loads the reusable engine and the site initialization script in its `<head>`:

```html
<script src="scripts/spaReady.js"></script>
<script src="scripts/spaEngine.js" defer></script>
<script src="scripts/spaInit.js" defer></script>
```

The engine script exposes the class without creating an instance:

```js
window.SpaEngine = SpaEngine;
```

The site decides its routes and creates the instance in `spaInit.js`:

```js
window.spaEngine = new SpaEngine(['*.html', '/site/*']);
```

This separation keeps the engine reusable and makes site configuration explicit.

## Navigation Flow

```text
User clicks an internal matching link
  -> Prevent normal browser navigation
  -> Insert the loading bar
  -> Fetch the requested page
  -> Parse its HTML into a Document
  -> Replace the current body content
  -> Recreate scripts in the new body
  -> Update the page title
  -> Add a browser history entry
  -> Complete and remove the loading bar
```

The Back and Forward buttons follow a separate path:

```text
Browser history changes
  -> popstate fires
  -> Fetch and render the current URL
  -> Do not call pushState again
```

## Design Decisions

### Fetch and parse complete HTML pages

`fetch()` returns the response body as text. The engine uses `DOMParser` to turn that text into a document, allowing it to read the fetched document's `<body>` and `<title>` separately.

```js
const html = await response.text();
const nextDocument = new DOMParser().parseFromString(html, 'text/html');
```

This avoids inserting a complete HTML document directly into the current body.

### Replace only the body content

The engine script lives in the document `<head>`, which is not replaced during SPA navigation. This means the existing engine instance and its event listeners remain active after a new page is rendered.

### Recreate scripts after rendering

Scripts inserted as part of dynamically rendered HTML do not execute as they would during a normal navigation. The engine creates replacement `<script>` elements, copies their attributes and content, and replaces the parsed scripts. This activates inline page scripts such as the clock in `details.html`.

### Use the browser History API

The engine relies on `window.history` rather than storing its own object state:

```js
window.history.pushState({}, '', url);
```

The `popstate` event handles Back and Forward navigation without creating duplicate history entries.

### Match routes against pathnames

The engine parses each link with `new URL()` and matches configured wildcard patterns against `pathname`, not the full URL. This means query strings and hashes do not affect matching.

Examples:

```text
*.html  matches /details.html
/site/* matches /site/about
```

Regular expression characters in routes are escaped before `*` is converted to the wildcard expression `.*`. This ensures the dot in `*.html` means a literal dot rather than any character.

### Preserve the loading bar through body replacement

The loading bar is inserted before navigation. When new content is rendered, the bar is passed to the body replacement method so it remains present while the page finishes rendering. It transitions to its completion state before being removed.

The stylesheet is loaded dynamically by the engine, keeping the host-page integration limited to the two JavaScript files.

### Manage component state

Stateful components are marked with `data-spa-component` and must have an `id`:

```html
<section id="service-selection" data-spa-component>
  <input id="service-haircut" name="services" type="checkbox" value="haircut" />
  <p id="service-summary">0 services selected</p>
</section>
```

The component ID identifies the corresponding component on another page. The engine only captures marked components:

```javascript
document.querySelectorAll('[data-spa-component][id]');
```

#### Automatic form state

By default, the engine automatically captures `input`, `textarea`, and `select` elements inside marked components. It stores text values for regular controls and `checked` values for checkboxes and radio buttons.

For automatic restoration, the destination page must contain the same component ID and matching control IDs. Controls that are not present on the destination page are skipped.

The captured state has this general structure:

```javascript
{
  'booking-controls': {
    form: {
      'booking-order': {
        checked: false,
      },
    },
  },
}
```

The state is restored in the detached document before its body is rendered. This allows page scripts to initialize from restored values without first displaying the component's default state.

#### Custom state API

Automatic form state is not enough for derived or application-owned state, such as a selected service count, a table page, a collection of selected item IDs, or a summary generated from several controls. A component can register custom state handlers with `save()` and `restore()`:

```javascript
window.spaEngine.registerComponent('service-selection', {
  save(component) {
    return {
      selectedServiceCount: component.querySelectorAll('input[name="services"]:checked').length,
      appointmentTime: component.querySelector('input[name="appointment-time"]:checked')?.value ?? null,
    };
  },

  restore(component, state) {
    component.querySelector('#service-summary').textContent = `${state.selectedServiceCount} services selected`;
    component.querySelector('#appointment-summary').textContent = state.appointmentTime
      ? `Appointment: ${state.appointmentTime}`
      : 'No appointment time selected';
  },
});
```

The registration ID must match the component's HTML ID. `save(component)` receives the current component and returns any serializable state object. `restore(component, state)` receives the matching component from the fetched page and the state returned by `save()`.

The engine stores automatic form state and custom state together:

```javascript
{
  'service-selection': {
    form: {
      'service-haircut': {
        checked: true,
      },
    },
    custom: {
      selectedServiceCount: 1,
      appointmentTime: 'afternoon',
    },
  },
}
```

The navigation lifecycle is:

```text
Capture automatic form state and registered custom state
  -> Fetch the next document
  -> Restore both state types in the detached document
  -> Replace the current body
  -> Execute the new page scripts
```

Page scripts can call `captureComponentState()` after a user changes application-owned state. This keeps the custom cache current before the next navigation:

```javascript
window.spaEngine.captureComponentState();
```

The booking fixtures demonstrate this behavior with barber selection, multiple service selection, appointment time, filtering, ordering, and checkout summaries.

The state cache can be reset completely:

```javascript
window.spaEngine.resetComponentState();
```

Or a single component can be cleared by passing its ID:

```javascript
window.spaEngine.resetComponentState('service-selection');
```

## Tests

Tests run in a browser and use a small custom runner built from browser APIs. This was chosen because the engine depends on browser objects such as `document`, `window`, `DOMParser`, `fetch`, and `history`.

The test runner groups tests by requirement, restores the test page after each test because rendering tests replace `document.body`, and clears the SPA engine state cache to keep tests isolated. Each test logs `PASS` or `FAIL`, and the runner prints `ALL TESTS PASSED` when the suite succeeds. When one or more tests fail, it throws an aggregate error after logging the individual failures.

## Run Locally

Serve the project through a local HTTP server. Opening the files with a `file://` URL may prevent `fetch()` from working correctly.

```powershell
python -m http.server 8000
```

Open the demo:

```text
http://localhost:8000/index.html
```

Open the browser tests and inspect the DevTools console:

```text
http://localhost:8000/tests/spaEngine.test.html
```

The tests use green `PASS` console messages and error output for failures.
