import { useState } from "react";

interface GroupMember {
  student_id: string;
  invitation_status: "PENDING" | "ACCEPTED" | "DECLINED";
}

interface StepMethodProps {
  requestMethod: "OWN" | "WITH_OTHERS";
  onRequestMethodChange: (
    method: "OWN" | "WITH_OTHERS"
  ) => void;
  groupMembers: GroupMember[];
  onAddMember: (studentId: string) => void;
  onRemoveMember: (studentId: string) => void;
  currentStudentId: string;
}

export default function StepMethod({
  requestMethod,
  onRequestMethodChange,
  groupMembers,
  onAddMember,
  onRemoveMember,
  currentStudentId,
}: StepMethodProps) {
  const [studentIdInput, setStudentIdInput] = useState("");

  function handleAddMember() {
    const studentId = studentIdInput.trim();

    if (!studentId) {
      return;
    }

    if (studentId === currentStudentId) {
      return;
    }

    if (
      groupMembers.some(
        (member) => member.student_id === studentId
      )
    ) {
      return;
    }

    onAddMember(studentId);
    setStudentIdInput("");
  }

  return (
    <div>
      <h2>Method of Retrieval</h2>

      <p>How will you request your documents?</p>

      <div style={{ display: "flex", gap: "16px" }}>
        <label>
          <input
            type="radio"
            name="requestMethod"
            value="OWN"
            checked={requestMethod === "OWN"}
            onChange={() =>
              onRequestMethodChange("OWN")
            }
          />
          {" "}My Own
        </label>

        <label>
          <input
            type="radio"
            name="requestMethod"
            value="WITH_OTHERS"
            checked={requestMethod === "WITH_OTHERS"}
            onChange={() =>
              onRequestMethodChange("WITH_OTHERS")
            }
          />
          {" "}With Others
        </label>
      </div>

      {requestMethod === "WITH_OTHERS" && (
        <div style={{ marginTop: "24px" }}>
          <h3>Add Other Students</h3>

          <div
            style={{
              display: "flex",
              gap: "8px",
            }}
          >
            <input
              type="text"
              value={studentIdInput}
              onChange={(event) =>
                setStudentIdInput(event.target.value)
              }
              placeholder="Enter Student ID"
            />

            <button
              type="button"
              onClick={handleAddMember}
            >
              Add
            </button>
          </div>

          {groupMembers.length === 0 ? (
            <p>No students added yet.</p>
          ) : (
            <div style={{ marginTop: "16px" }}>
              {groupMembers.map((member) => (
                <div
                  key={member.student_id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    marginBottom: "8px",
                  }}
                >
                  <div>
                    <strong>{member.student_id}</strong>
                    <div>
                      Status: {member.invitation_status}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onRemoveMember(member.student_id)
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <small>
            Email/OTP verification is not implemented yet.
          </small>
        </div>
      )}
    </div>
  );
}