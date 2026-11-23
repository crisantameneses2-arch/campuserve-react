import "./MyProfile.css";

type MyProfileProps = {
  account: {
    name?: string;
    email?: string;
    student_id?: string;
  };
};

function DefaultProfilePicture({ size = 100 }: { size?: number }) {
  return (
    <div
      className="profile-placeholder"
      style={{ width: size, height: size }}
      aria-label="Default profile picture"
    >
      <svg
        viewBox="0 0 40 40"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="20" cy="20" r="20" fill="#E5E7EB" />
        <circle cx="20" cy="14" r="7" fill="#9CA3AF" />
        <path
          d="M7 35C7 27.82 12.82 22 20 22C27.18 22 33 27.82 33 35"
          fill="#9CA3AF"
        />
      </svg>
    </div>
  );
}

export default function MyProfile({ account }: MyProfileProps) {
  return (
    <div className="my-profile">
      <div className="my-profile-card">
        <DefaultProfilePicture />

        <h2>{account.name || "Student"}</h2>
        <p>{account.email || "No email provided"}</p>

        <div className="my-profile-details">
          <div>
            <span>Student ID</span>
            <strong>{account.student_id || "Not provided"}</strong>
          </div>

          <div>
            <span>Full Name</span>
            <strong>{account.name || "Not provided"}</strong>
          </div>

          <div>
            <span>Email Address</span>
            <strong>{account.email || "Not provided"}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}