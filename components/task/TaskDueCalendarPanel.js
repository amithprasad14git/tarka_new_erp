"use client";

import { formatTaskDate } from "./taskUtils";

const EMPTY_CALENDAR = {
  monthLabel: "",
  today: "",
  weekdays: ["S", "M", "T", "W", "T", "F", "S"],
  cells: [],
  noDueDateCount: 0,
  summary: { dueInMonth: 0, overdueInMonth: 0 }
};

export default function TaskDueCalendarPanel({ calendar = EMPTY_CALENDAR, metrics = {} }) {
  const cal = calendar?.cells?.length ? calendar : EMPTY_CALENDAR;
  const overdue = Number(metrics.overdueTasks) || Number(cal.summary?.overdueInMonth) || 0;
  const dueToday = Number(metrics.dueToday) || 0;
  const dueThisWeek = Number(metrics.dueThisWeek) || 0;

  return (
    <div className="task-due-calendar" aria-label="Task due date calendar">
      <div className="task-due-calendar-main">
        {overdue > 0 ? (
          <div className="task-due-calendar-alert">
            <span className="task-due-calendar-alert-dot" aria-hidden="true" />
            {overdue} overdue
          </div>
        ) : null}

        <div className="task-due-calendar-weekdays">
          {cal.weekdays.map((w, i) => (
            <span key={`${w}-${i}`} className="task-due-calendar-weekday">
              {w}
            </span>
          ))}
        </div>

        <div className="task-due-calendar-grid">
          {cal.cells.map((cell) => (
            <div
              key={cell.date}
              className={`task-due-calendar-cell task-due-calendar-cell--${cell.tone}${cell.isToday ? " is-today" : ""}${cell.inMonth ? "" : " is-outside"}`}
              title={cell.count ? `${cell.count} due ${formatTaskDate(cell.date)}` : formatTaskDate(cell.date)}
            >
              <span className="task-due-calendar-day">{cell.day}</span>
              {cell.count > 0 ? <span className="task-due-calendar-badge">{cell.count}</span> : null}
            </div>
          ))}
        </div>
      </div>

      <div className="task-due-calendar-lower">
        <div className="task-due-calendar-footer">
          <div className="task-due-calendar-legend" aria-label="Calendar legend">
            <span className="task-due-calendar-legend-item">
              <span className="task-due-calendar-legend-swatch task-due-calendar-legend-swatch--overdue" />
              Overdue
            </span>
            <span className="task-due-calendar-legend-item">
              <span className="task-due-calendar-legend-swatch task-due-calendar-legend-swatch--today" />
              Today
            </span>
            <span className="task-due-calendar-legend-item">
              <span className="task-due-calendar-legend-swatch task-due-calendar-legend-swatch--upcoming" />
              Upcoming
            </span>
          </div>
          <p className="task-due-calendar-footer-note">
            {dueToday} today · {dueThisWeek} this week
            {cal.noDueDateCount > 0 ? ` · ${cal.noDueDateCount} no date` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
