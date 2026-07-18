import { addDays, endOfMonth, format, nextFriday } from "date-fns";

const MONTHS: Record<string, number> = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7, september: 8, sep: 8,
  october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11,
};

const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8,
  ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14,
  fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19,
  twentieth: 20, twentyfirst: 21, "twenty-first": 21, thirtieth: 30, thirtyfirst: 31,
  "thirty-first": 31,
};

function nowLocal(): Date {
  return new Date();
}

export function parseSpokenDate(phrase: string, _timezone = "America/New_York"): string | null {
  const lower = phrase.toLowerCase().trim();
  const now = nowLocal();
  const year = now.getFullYear();

  if (lower === "tomorrow") {
    return format(addDays(now, 1), "yyyy-MM-dd");
  }
  if (lower === "today") {
    return format(now, "yyyy-MM-dd");
  }
  if (/next\s+friday/i.test(lower)) {
    return format(nextFriday(now), "yyyy-MM-dd");
  }
  if (/end\s+of\s+(the\s+)?month/i.test(lower)) {
    return format(endOfMonth(now), "yyyy-MM-dd");
  }

  const monthDay = lower.match(
    /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(.+)/i
  );
  if (monthDay) {
    const month = MONTHS[monthDay[1].toLowerCase()];
    const dayPart = monthDay[2].replace(/[^a-z0-9-]/gi, "").toLowerCase();
    let day = ORDINALS[dayPart] ?? parseInt(dayPart, 10);
    if (!Number.isFinite(day)) {
      const numMatch = dayPart.match(/\d+/);
      if (numMatch) day = parseInt(numMatch[0], 10);
    }
    if (month != null && day > 0) {
      const d = new Date(year, month, day);
      return format(d, "yyyy-MM-dd");
    }
  }

  const iso = lower.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];

  return null;
}

export function replaceSpokenDates(text: string, timezone = "America/New_York"): string {
  let result = text;

  const relative: Array<{
    pattern: RegExp;
    replace: (match: string, ...groups: string[]) => string;
  }> = [
    { pattern: /\buntil\s+tomorrow\b/gi, replace: () => `until ${parseSpokenDate("tomorrow", timezone)}` },
    {
      pattern: /\bdelayed\s+until\s+(.+?)(?:\.|$)/gi,
      replace: (_m: string, p: string) => {
        const d = parseSpokenDate(p.trim(), timezone);
        return d ? `delayed until ${d}` : _m;
      },
    },
    {
      pattern:
        /\buntil\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(.+?)(?:\.|$)/gi,
      replace: (_m: string, month: string, day: string) => {
        const d = parseSpokenDate(`${month} ${day}`, timezone);
        return d ? `until ${d}` : _m;
      },
    },
  ];

  for (const { pattern, replace } of relative) {
    result = result.replace(pattern, replace);
  }

  return result;
}
