// "HH:mm[:ss]" as minutes since midnight.
const toMinutes = (time) => {
    const [hours = 0, minutes = 0, seconds = 0] = String(time).split(':').map(Number);
    return hours * 60 + minutes + seconds / 60;
};

// Minutes from startTime to endTime, both "HH:mm[:ss]" on the same day.
function calculateDuration(startTime, endTime) {
    return toMinutes(endTime) - toMinutes(startTime);
};

module.exports = {
    calculateDuration,
};
