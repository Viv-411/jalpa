// Live captions from the browser's built-in speech recognition, where it
// exists (Chrome, Edge, Safari). They are shown to both debaters during a
// speech and kept as a backup transcript. Everything here is best-effort:
// if the browser can't do it, the debate carries on without captions.

const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

export function createCaptioner(onUpdate) {
  // Test hook: automated tests (emulator builds only) can supply the words.
  if (import.meta.env.VITE_USE_EMULATORS === '1' && typeof window.__jalpaTestSpeech === 'function') {
    let timer = null
    return {
      start() {
        onUpdate(window.__jalpaTestSpeech())
        timer = setInterval(() => onUpdate(window.__jalpaTestSpeech()), 700)
      },
      stop() {
        clearInterval(timer)
        return window.__jalpaTestSpeech()
      },
    }
  }

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
  let recognition = null
  let listening = false
  let finalText = ''

  return {
    start() {
      // On phones the recognizer competes with the call for the microphone.
      if (!Recognition || isMobile()) return
      try {
        recognition = new Recognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'
        recognition.onresult = (event) => {
          let interim = ''
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const result = event.results[i]
            if (result.isFinal) finalText += `${result[0].transcript.trim()} `
            else interim += result[0].transcript
          }
          onUpdate(`${finalText}${interim}`.trim().slice(-260))
        }
        recognition.onerror = (event) => {
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            listening = false
          }
        }
        // The recognizer stops itself after a pause; keep it going for the whole speech.
        recognition.onend = () => {
          if (!listening) return
          try {
            recognition.start()
          } catch {
            listening = false
          }
        }
        listening = true
        recognition.start()
      } catch {
        listening = false
      }
    },
    stop() {
      listening = false
      try {
        recognition?.stop()
      } catch {
        // Already stopped.
      }
      return finalText.trim()
    },
  }
}
