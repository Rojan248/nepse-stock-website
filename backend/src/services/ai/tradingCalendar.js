const { isNepseHoliday } = require('../utils/nepseHolidays');

const NEPAL_TIMEZONE = 'Asia/Kathmandu';

function toNepalDateString(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: NEPAL_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
}

function getNepalWeekday(date = new Date()) {
    const weekday = new Intl.DateTimeFormat('en-US', {
        timeZone: NEPAL_TIMEZONE,
        weekday: 'short'
    }).format(date);

    return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[weekday] ?? 0;
}

function getWeekdayFromDateString(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function isTradingDateString(dateString) {
    const weekday = getWeekdayFromDateString(dateString);
    if (weekday === 5 || weekday === 6) return false;
    return !isNepseHoliday(dateString);
}

function startOfNepalDate(date = new Date()) {
    const [year, month, day] = toNepalDateString(date).split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
}

function isTradingDay(date = new Date()) {
    return isTradingDateString(toNepalDateString(date));
}

function getHourlyPeriod(date = new Date()) {
    const period = new Date(date);
    period.setMinutes(0, 0, 0);
    return period;
}

function getDayPeriod(date = new Date()) {
    const start = startOfNepalDate(date);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end };
}

module.exports = {
    NEPAL_TIMEZONE,
    toNepalDateString,
    isTradingDateString,
    startOfNepalDate,
    isTradingDay,
    getHourlyPeriod,
    getDayPeriod
};
