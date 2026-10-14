// Counts wrong OTP guesses per email so a 4-6 digit code can't be brute-forced.
// In-memory: fine for the single pm2 instance this app runs as; OTPs are replaced by email links later.
const MAX_ATTEMPTS = 5;
const attempts = new Map();

const otpAttemptKey = (...parts) => parts.map((p) => String(p ?? '').toLowerCase()).join('|');

// Returns true once the limit is reached; the caller must then invalidate the code.
const recordOtpFailure = (key) => {
    const count = (attempts.get(key) || 0) + 1;
    attempts.set(key, count);
    return count >= MAX_ATTEMPTS;
};

const resetOtpAttempts = (key) => attempts.delete(key);

module.exports = { otpAttemptKey, recordOtpFailure, resetOtpAttempts };
