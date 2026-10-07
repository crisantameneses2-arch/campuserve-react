import "./RolesPermissions.css";

function RolesPermissions() {
  const roles = [
    {
      name: "Student",
      description: "Regular student account",
      users: 128,
      status: "Active",
    },
    {
      name: "Alumni",
      description: "Former students with approved access",
      users: 24,
      status: "Active",
    },
    {
      name: "General Office",
      description: "Handles general office transactions",
      users: 6,
      status: "Active",
    },
    {
      name: "Registrar",
      description: "Manages academic document requests",
      users: 4,
      status: "Active",
    },
    {
      name: "Administrator",
      description: "Full system management access",
      users: 2,
      status: "Active",
    },
  ];

  const permissions = [
    "Dashboard",
    "User Accounts",
    "Document Requests",
    "Item Reservations",
    "Reports & Analytics",
    "Activity Logs",
    "System Settings",
  ];

  return (
    <div className="roles-page">
      <div className="roles-header">
        <div>
          <h1>Roles & Permissions</h1>
          <p>
            Manage system roles and access permissions.
          </p>
        </div>

        <button className="roles-primary-button">
          + Create Role
        </button>
      </div>

      <div className="roles-summary">
        <div className="roles-summary-card">
          <span>Total Roles</span>
          <strong>5</strong>
        </div>

        <div className="roles-summary-card">
          <span>Total Users</span>
          <strong>164</strong>
        </div>

        <div className="roles-summary-card">
          <span>Active Roles</span>
          <strong>5</strong>
        </div>
      </div>

      <div className="roles-content">
        <div className="roles-list-card">
          <div className="roles-card-header">
            <div>
              <h2>System Roles</h2>
              <p>
                Select a role to view its permissions.
              </p>
            </div>
          </div>

          <div className="roles-list">
            {roles.map((role) => (
              <div
                className="role-item"
                key={role.name}
              >
                <div className="role-info">
                  <div className="role-icon">
                    {role.name.charAt(0)}
                  </div>

                  <div>
                    <h3>{role.name}</h3>
                    <p>{role.description}</p>
                  </div>
                </div>

                <div className="role-users">
                  <strong>{role.users}</strong>
                  <span>users</span>
                </div>

                <span className="role-status">
                  {role.status}
                </span>

                <button className="role-edit-button">
                  Edit
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="permissions-card">
          <div className="roles-card-header">
            <div>
              <h2>Administrator Permissions</h2>
              <p>
                Permissions assigned to this role.
              </p>
            </div>
          </div>

          <div className="permissions-list">
            {permissions.map((permission) => (
              <label
                className="permission-item"
                key={permission}
              >
                <input
                  type="checkbox"
                  defaultChecked
                />

                <span>{permission}</span>
              </label>
            ))}
          </div>

          <button className="roles-save-button">
            Save Permissions
          </button>
        </div>
      </div>
    </div>
  );
}

export default RolesPermissions;