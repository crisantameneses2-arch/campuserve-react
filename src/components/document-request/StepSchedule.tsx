interface StepScheduleProps {
  requestedDate: string;
  requestedTime: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
}

export default function StepSchedule({
  requestedDate,
  requestedTime,
  onDateChange,
  onTimeChange,
}: StepScheduleProps) {
  return (
    <div>
      <h2>Set Schedule</h2>

      <p>
        Select a claiming date and time.
      </p>

      <div style={{ marginBottom: "16px" }}>
        <label>
          Claiming Date
          <br />

          <input
            type="date"
            value={requestedDate}
            onChange={(event) =>
              onDateChange(event.target.value)
            }
          />
        </label>
      </div>

      <div>
        <label>
          Claiming Time
          <br />

          <input
            type="time"
            value={requestedTime}
            onChange={(event) =>
              onTimeChange(event.target.value)
            }
          />
        </label>
      </div>

      <p>
        Available hours: 8:00 AM–12:00 PM and 1:00 PM–5:00 PM.
        12:00 PM–1:00 PM is unavailable.
      </p>
    </div>
  );
}