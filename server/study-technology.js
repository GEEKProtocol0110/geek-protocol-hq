const mdn = 'https://developer.mozilla.org/en-US/docs/';
export const technologyTopics = [
  { id: 'web-status', name: 'Reading web responses', bank: 'technology', category: 'Web Status & Requests',
    lesson: 'Web responses describe a request, not every later outcome. Learn to distinguish queued work, unavailable data, rate limits and an interrupted connection.',
    sources: [mdn + 'Web/HTTP/Reference/Status/202', mdn + 'Web/HTTP/Reference/Status/503', mdn + 'Web/HTTP/Reference/Status/429', mdn + 'Web/API/AbortController/abort', mdn + 'Web/HTTP/Reference/Methods/GET'], next: 'browser-privacy' },
  { id: 'browser-privacy', name: 'Browser privacy & saved progress', bank: 'technology', category: 'Browser Privacy & Storage',
    lesson: 'Browser records have different lifetimes. Learn what a tab receipt, saved preference, protected cookie and blocked Copy action can tell you.',
    sources: [mdn + 'Web/API/Window/localStorage', mdn + 'Web/API/Window/sessionStorage', mdn + 'Web/API/Clipboard_API', mdn + 'Web/HTTP/Guides/Cookies'], next: 'exact-values' },
  { id: 'exact-values', name: 'Exact values & trustworthy data', bank: 'technology', category: 'Exact Values & Data',
    lesson: 'An app must preserve values before it formats them. Distinguish text from numbers, check integer precision and handle malformed data explicitly.',
    sources: [mdn + 'Web/JavaScript/Reference/Global_Objects/BigInt', mdn + 'Web/JavaScript/Reference/Global_Objects/Number/isSafeInteger', mdn + 'Web/JavaScript/Reference/Global_Objects/JSON/parse', mdn + 'Web/JavaScript/Reference/Global_Objects/String', mdn + 'Web/JavaScript/Reference/Operators/Strict_equality'], next: 'origins' }
];
export const technologyLessons = {
  'web-status': {
    objective: 'Separate a request status from a completed application outcome.',
    steps: [
      { title: 'Accepted is a stage', text: 'HTTP 202 says work was accepted for processing. It does not say the work finished. Read a later result or status receipt before describing the outcome as complete.' },
      { title: 'Unavailable is not zero', text: 'A 503 response says a service cannot currently handle the request. A 429 response reports too many requests. Neither response tells you that an unread value is zero.' },
      { title: 'A timeout leaves a question', text: 'Aborting a browser fetch stops that client operation. If a write may have reached the server, check its saved state before trying again; client cancellation alone does not establish a rollback.' }
    ],
    example: 'A task first says “queued” and later supplies a completed receipt. Keep those stages separate rather than announcing completion at the first response.',
    reflection: 'What evidence would you ask for after a request timed out?'
  },
  'browser-privacy': {
    objective: 'Explain where browser records live and handle unavailable features honestly.',
    steps: [
      { title: 'Know the storage lifetime', text: 'localStorage is tied to an origin and can persist across browser sessions. sessionStorage is also separated by tab session. Neither is an automatic backup across all your devices.' },
      { title: 'Handle a blocked feature', text: 'Storage access can fail when a browser disallows persistence. Clipboard access also has browser restrictions. Explain a failed save and provide selectable text when automatic copying is unavailable.' },
      { title: 'Understand one protection', text: 'An HttpOnly cookie cannot be read through ordinary document.cookie access in page JavaScript. That attribute is one protection, not a replacement for server authorization or request-origin checks.' }
    ],
    example: 'A result can work for the current visit even when browser storage fails. Tell the learner whether it was saved rather than promising it will appear on another phone.',
    reflection: 'Which records would you need to recover after closing a private browsing session?'
  },
  'exact-values': {
    objective: 'Preserve integer values and recognize the difference between data types.',
    steps: [
      { title: 'Check the integer range', text: 'JavaScript Number cannot represent every large integer exactly. Number.isSafeInteger tests a Number value against the safe-integer rules. BigInt can represent integers beyond that range.' },
      { title: 'Text is still text', text: 'The string "120" contains decimal-looking characters, but it is not initially a Number or BigInt. Validate the expected format before converting it. Strict equality does not turn a string into a number.' },
      { title: 'Treat broken data as broken', text: 'JSON.parse throws a SyntaxError when the text is not valid JSON. Catch that error and mark the reading unavailable. A display label should never invent a numeric result from a failed parse.' }
    ],
    example: 'Keep a large counter in an exact representation, then produce a shorter label for display. The label is a view of the counter, not the original value.',
    reflection: 'Why would rounding a counter before subtracting two readings produce misleading results?'
  }
};
