"use client";

import { formatReminderDate } from "./reminderUtils";

const EMPTY_CALENDAR = {
  monthLabel: "",
  today: "",
  weekdays: ["S", "M", "T", "W", "T", "F", "S"],
  cells: [],
  noDueDateCount: 0,
  summary: { dueInMonth: 0, overdueInMonth: 0 }
};

export default function ReminderDueCalendarPanel({
  calendar = EMPTY_CALENDAR,
  metrics = {},
  selectedDate = null,
  onDateClick
}) {
  const cal = calendar?.cells?.length ? calendar : EMPTY_CALENDAR;
  const overdue = Number(metrics.overdueReminders) || Number(cal.summary?.overdueInMonth) || 0;
  const dueToday = Number(metrics.dueToday) || 0;
  const dueThisWeek = Number(metrics.dueThisWeek) || 0;

  return (
    <div className="reminder-due-calendar" aria-label="Reminder due date calendar">
      <div className="reminder-due-calendar-main">
        {overdue > 0 ? (
          <div className="reminder-due-calendar-alert">
            <span className="reminder-due-calendar-alert-dot" aria-hidden="true" />
            {overdue} overdue
          </div>
        ) : null}

        <div className="reminder-due-calendar-weekdays">
          {cal.weekdays.map((w, i) => (
            <span key={`${w}-${i}`} className="reminder-due-calendar-weekday">
              {w}
            </span>
          ))}
        </div>

        <div className="reminder-due-calendar-grid">
          {cal.cells.map((cell) => {
            const isSelected = selectedDate && cell.date === selectedDate;
            return (
              <button
                key={cell.date}
                type="button"
                className={`reminder-due-calendar-cell reminder-due-calendar-cell--${cell.tone}${cell.isToday ? " is-today" : ""}${cell.inMonth ? "" : " is-outside"}${isSelected ? " is-selected" : ""}`}
                title={cell.count ? `${cell.count} due ${formatReminderDate(cell.date)}` : formatReminderDate(cell.date)}
                onClick={() => onDateClick?.(cell.date)}
              >
                <span className="reminder-due-calendar-day">{cell.day}</span>
                {cell.count > 0 ? <span className="reminder-due-calendar-badge">{cell.count}</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="reminder-due-calendar-lower">
        <div className="reminder-due-calendar-footer">
          <div className="reminder-due-calendar-legend" aria-label="Calendar legend">
            <span className="reminder-due-calendar-legend-item">
              <span className="reminder-due-calendar-legend-swatch reminder-due-calendar-legend-swatch--overdue" />
              Overdue
            </span>
            <span className="reminder-due-calendar-legend-item">
              <span className="reminder-due-calendar-legend-swatch reminder-due-calendar-legend-swatch--today" />
              Today
            </span>
            <span className="reminder-due-calendar-legend-item">
              <span className="reminder-due-calendar-legend-swatch reminder-due-calendar-legend-swatch--upcoming" />
              Upcoming
            </span>
          </div>
          <p className="reminder-due-calendar-footer-note">
            {dueToday} today · {dueThisWeek} this week
            {cal.noDueDateCount > 0 ? ` · ${cal.noDueDateCount} no date` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
