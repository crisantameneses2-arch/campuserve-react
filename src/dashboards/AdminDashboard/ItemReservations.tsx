import "./ItemReservations.css";

function ItemReservations() {
  const reservations = [
    {
      id: "RES-00421",
      student: "Maria Santos",
      item: "Projector",
      date: "Oct 8, 2026",
      time: "9:00 AM - 12:00 PM",
      status: "Approved",
    },
    {
      id: "RES-00420",
      student: "John Dela Cruz",
      item: "Conference Room",
      date: "Oct 8, 2026",
      time: "1:00 PM - 3:00 PM",
      status: "Pending",
    },
    {
      id: "RES-00419",
      student: "Angela Reyes",
      item: "Laptop",
      date: "Oct 7, 2026",
      time: "8:00 AM - 5:00 PM",
      status: "Active",
    },
    {
      id: "RES-00418",
      student: "Kevin Garcia",
      item: "Projector",
      date: "Oct 7, 2026",
      time: "10:00 AM - 12:00 PM",
      status: "Completed",
    },
    {
      id: "RES-00417",
      student: "Sofia Mendoza",
      item: "Speaker",
      date: "Oct 6, 2026",
      time: "2:00 PM - 4:00 PM",
      status: "Cancelled",
    },
  ];

  return (
    <div className="reservations-page">
      <div className="reservations-header">
        <div>
          <h1>Item Reservations</h1>
          <p>
            Monitor equipment, facilities, and item reservations.
          </p>
        </div>

        <button className="reservation-refresh-button">
          ↻ Refresh
        </button>
      </div>

      <div className="reservation-summary">
        <div className="reservation-stat">
          <span>Total Reservations</span>
          <strong>86</strong>
        </div>

        <div className="reservation-stat pending">
          <span>Pending</span>
          <strong>9</strong>
        </div>

        <div className="reservation-stat active">
          <span>Active</span>
          <strong>12</strong>
        </div>

        <div className="reservation-stat completed">
          <span>Completed</span>
          <strong>59</strong>
        </div>

        <div className="reservation-stat cancelled">
          <span>Cancelled</span>
          <strong>6</strong>
        </div>
      </div>

      <div className="reservation-table-card">
        <div className="reservation-toolbar">
          <div className="reservation-search">
            <input
              type="text"
              placeholder="Search reservations..."
            />

            <button>Search</button>
          </div>

          <select defaultValue="All Status">
            <option>All Status</option>
            <option>Pending</option>
            <option>Approved</option>
            <option>Active</option>
            <option>Completed</option>
            <option>Cancelled</option>
          </select>
        </div>

        <div className="reservation-table-wrapper">
          <table className="reservation-table">
            <thead>
              <tr>
                <th>Reservation ID</th>
                <th>Student</th>
                <th>Item</th>
                <th>Date</th>
                <th>Schedule</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {reservations.map((reservation) => (
                <tr key={reservation.id}>
                  <td>
                    <strong>
                      {reservation.id}
                    </strong>
                  </td>

                  <td>
                    {reservation.student}
                  </td>

                  <td>
                    {reservation.item}
                  </td>

                  <td>
                    {reservation.date}
                  </td>

                  <td>
                    {reservation.time}
                  </td>

                  <td>
                    <span
                      className={`reservation-status ${reservation.status.toLowerCase()}`}
                    >
                      {reservation.status}
                    </span>
                  </td>

                  <td>
                    <button className="reservation-view-button">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ItemReservations;