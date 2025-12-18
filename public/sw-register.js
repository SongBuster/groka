/* Register Service Worker */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[SW] Registration successful:', registration)
      })
      .catch((error) => {
        console.log('[SW] Registration failed:', error)
      })
  })
}

// Check for updates
if ('serviceWorker' in navigator) {
  setInterval(() => {
    navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration) {
        registration.update()
      }
    })
  }, 60000) // Check every 60 seconds
}
