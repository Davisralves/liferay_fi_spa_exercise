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
- Browser-based tests with a lightweight custom `describe`, `test`, and `assert` runner.

### Remaining

- Skip SPA navigation for links that declare `data-no-spa`.
- Design and implement component state caching and restoration by component ID.
- Expand the test suite for the remaining features and edge cases.

## Project Structure

```text
index.html                 Initial page
details.html               Page loaded through SPA navigation
spaEngine.js               Reusable SPA engine
spaEngine.css              Loading bar styles
spaInit.js                 Site-specific engine initialization
tests/spaEngine.test.html  Browser test page
tests/spaEngine.test.js    Native browser test runner and tests
.gitignore                 Local-only file exclusions
```

## Usage

Each page that should support direct navigation loads the reusable engine and the site initialization script in its `<head>`:

```html
<script src="spaEngine.js" defer></script>
<script src="spaInit.js" defer></script>
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

## Tests

Tests run in a browser and use a small custom runner built from browser APIs. This was chosen because the engine depends on browser objects such as `document`, `window`, `DOMParser`, `fetch`, and `history`.

Current test coverage includes:

- Fetching and parsing HTML.
- Failed HTTP requests.
- Body replacement.
- Inline script execution.
- Route wildcard and exact matching.
- Query string and hash handling.
- Literal dot matching in routes.
- Title changes during navigation.
- History behavior during `popstate` navigation.
- Disabled-engine initialization.
- Loading-bar lifecycle during navigation.

The test runner groups tests by requirement and restores the test page after each test because rendering tests replace `document.body`.

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

## Next Steps

The next implementation items are `data-no-spa` support and a component state preservation API. The README will be updated when those requirements are implemented.
