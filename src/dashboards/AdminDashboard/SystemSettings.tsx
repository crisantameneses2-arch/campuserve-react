import "./SystemSettings.css";

function SystemSettings() {
  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <h1>System Settings</h1>
          <p>
            Configure CampuServe system preferences and policies.
          </p>
        </div>

        <button className="settings-save-top">
          Save Changes
        </button>
      </div>

      <div className="settings-layout">
        <div className="settings-navigation">
          <button className="active">
            General
          </button>

          <button>
            Document Requests
          </button>

          <button>
            Item Reservations
          </button>

          <button>
            Notifications
          </button>

          <button>
            Claiming Schedule
          </button>
        </div>

        <div className="settings-content">
          <div className="settings-card">
            <h2>General Settings</h2>

            <p className="settings-description">
              Basic information about the CampuServe system.
            </p>

            <div className="settings-form">
              <div className="setting-field">
                <label>
                  System Name
                </label>

                <input
                  type="text"
                  defaultValue="CampuServe"
                />
              </div>

              <div className="setting-field">
                <label>
                  Institution
                </label>

                <input
                  type="text"
                  defaultValue="Pangasinan State University"
                />
              </div>

              <div className="setting-field">
                <label>
                  Campus
                </label>

                <input
                  type="text"
                  defaultValue="Lingayen Campus"
                />
              </div>

              <div className="setting-field">
                <label>
                  Support Email
                </label>

                <input
                  type="email"
                  defaultValue="support@campuserve.edu.ph"
                />
              </div>
            </div>
          </div>

          <div className="settings-card">
            <h2>System Preferences</h2>

            <p className="settings-description">
              Manage general application behavior.
            </p>

            <div className="setting-toggle">
              <div>
                <strong>
                  Enable Notifications
                </strong>

                <p>
                  Allow the system to send notifications to users.
                </p>
              </div>

              <label className="switch">
                <input
                  type="checkbox"
                  defaultChecked
                />

                <span />
              </label>
            </div>

            <div className="setting-toggle">
              <div>
                <strong>
                  Allow Item Reservations
                </strong>

                <p>
                  Allow users to reserve available items.
                </p>
              </div>

              <label className="switch">
                <input
                  type="checkbox"
                  defaultChecked
                />

                <span />
              </label>
            </div>

            <div className="setting-toggle">
              <div>
                <strong>
                  Allow Document Requests
                </strong>

                <p>
                  Allow users to submit document requests.
                </p>
              </div>

              <label className="switch">
                <input
                  type="checkbox"
                  defaultChecked
                />

                <span />
              </label>
            </div>
          </div>

          <div className="settings-card">
            <h2>Claiming Schedule</h2>

            <p className="settings-description">
              Configure the default schedule for claiming documents and reserved items.
            </p>

            <div className="schedule-row">
              <div>
                <label>
                  Start Time
                </label>

                <input
                  type="time"
                  defaultValue="08:00"
                />
              </div>

              <div>
                <label>
                  End Time
                </label>

                <input
                  type="time"
                  defaultValue="17:00"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SystemSettings;