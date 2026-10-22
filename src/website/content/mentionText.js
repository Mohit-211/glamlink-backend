// The @handles in an article's HTML, as the website links them: in its text (not in code, scripts or styles), after
// a space or "(" (so emails are not handles), 2 to 50 letters, digits, "_", "." or "-". Lower-cased, trailing
// punctuation off, without repeats.
const HANDLE = /(^|[\s(])@([a-zA-Z0-9_.-]{2,50})/g;

const textOf = (html) =>
    String(html || '')
        .replace(/<(script|style|code|pre)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;|&#160;/gi, ' ')
        .replace(/&amp;/gi, '&');

const handlesIn = (html) => {
    const found = new Set();
    for (const match of textOf(html).matchAll(HANDLE)) {
        const handle = match[2].replace(/[._-]+$/, '').toLowerCase();
        if (handle.length >= 2) found.add(handle);
    }
    return [...found];
};

module.exports = { handlesIn };
