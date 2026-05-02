const MANILA_TIME_ZONE = 'Asia/Manila';
const PHT_STORAGE_PATTERN = 'YYYY-MM-DD HH:mm:ss PHT';

const longDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
});

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TIME_ZONE,
    month: 'short',
    day: 'numeric',
});

const storageFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
});

export function parseManilaTimestamp(value: string | undefined): Date {
    if (!value) {
        return new Date(NaN);
    }

    const raw = String(value).trim();
    if (!raw) {
        return new Date(NaN);
    }

    const phtMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s+PHT$/i);
    if (phtMatch) {
        const [, year, month, day, hour, minute, second = '00'] = phtMatch;
        return new Date(Date.UTC(
            Number(year),
            Number(month) - 1,
            Number(day),
            Number(hour) - 8,
            Number(minute),
            Number(second),
        ));
    }

    const localePhtMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s+(AM|PM)(?:\s+PHT)?$/i);
    if (localePhtMatch) {
        const [, month, day, year, hour12, minute, second = '00', meridiem] = localePhtMatch;
        let hour = Number(hour12) % 12;
        if (meridiem.toUpperCase() === 'PM') {
            hour += 12;
        }

        return new Date(Date.UTC(
            Number(year),
            Number(month) - 1,
            Number(day),
            hour - 8,
            Number(minute),
            Number(second),
        ));
    }

    return new Date(raw);
}

export function formatManilaDateTime(value: string | undefined): string {
    const date = parseManilaTimestamp(value);
    if (Number.isNaN(date.getTime())) {
        return 'Date unavailable';
    }

    const parts = longDateTimeFormatter.formatToParts(date);
    const byType = (type: Intl.DateTimeFormatPartTypes): string =>
        parts.find((part) => part.type === type)?.value || '';

    const month = byType('month');
    const day = byType('day');
    const year = byType('year');
    const hour = byType('hour');
    const minute = byType('minute');
    const dayPeriod = byType('dayPeriod').toUpperCase();

    return `${month} ${day}, ${year} at ${hour}:${minute} ${dayPeriod}`;
}

export function formatManilaShortDate(value: string | undefined): string {
    const date = parseManilaTimestamp(value);
    if (Number.isNaN(date.getTime())) {
        return 'N/A';
    }

    return shortDateFormatter.format(date);
}

export function formatPhtStorageTimestamp(value: string | Date): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const parts = storageFormatter.formatToParts(date);
    const byType = (type: Intl.DateTimeFormatPartTypes): string =>
        parts.find((part) => part.type === type)?.value || '';

    return `${byType('year')}-${byType('month')}-${byType('day')} ${byType('hour')}:${byType('minute')}:${byType('second')} PHT`;
}

export { MANILA_TIME_ZONE, PHT_STORAGE_PATTERN };
