window.runAfterPageRendered = (callback) => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, {
      once: true,
    });
  } else {
    callback();
  }
};
