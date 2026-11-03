// The U.S. states, DC and Puerto Rico by their two-letter code (Nov 3). Places are written either way ("NV", "Nevada"):
// the directory's filters group pages by state, and a state is asked for by its code or its name.
const STATES = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
    DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
    IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
    MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska',
    NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
    ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', PR: 'Puerto Rico', RI: 'Rhode Island',
    SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
    WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

// Text as it is matched: trimmed, without case or accents ("Nevadá" is Nevada), as the database compares text.
const fold = (text) => String(text ?? '').normalize('NFKD').replace(/\p{M}/gu, '').trim().toLowerCase();

const CODES = new Map(Object.entries(STATES).flatMap(([code, name]) => [[fold(code), code], [fold(name), code]]));

// "NV" from "nv", "NV", "Nevada" or " nevada "; null when the text is not a U.S. state.
const stateCode = (text) => CODES.get(fold(text)) ?? null;

// "Nevada" from "NV" (in any case); null for anything else.
const stateName = (code) => {
    const key = String(code ?? '').trim().toUpperCase();
    return Object.hasOwn(STATES, key) ? STATES[key] : null;
};

module.exports = { STATES, stateCode, stateName };
