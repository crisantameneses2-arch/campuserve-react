import {
  KeyboardEvent,
  useState,
} from "react";

import {
  lookupGroupStudent,
  type GroupStudent,
} from "../../services/groupRequests";

/* =========================================================
   TYPES
========================================================= */

type GroupMemberStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED";

type GroupMember = {
  student_id: string;
  invitation_status: GroupMemberStatus;
};

/* =========================================================
   PROPS
========================================================= */

interface StepMethodProps {
  requestMethod:
    | "OWN"
    | "WITH_OTHERS";

  onRequestMethodChange: (
    method:
      | "OWN"
      | "WITH_OTHERS"
  ) => void;

  groupMembers: GroupMember[];

  onAddMember: (
    studentId: string
  ) => void | Promise<void>;

  onRemoveMember: (
    studentId: string
  ) => void | Promise<void>;

  currentStudentId: string;

  /*
   * Members can only be added/removed while
   * the group request is still being prepared.
   *
   * DRAFT = true
   * PENDING/submitted = false
   */
  canEditMembers: boolean;
}

/* =========================================================
   COMPONENT
========================================================= */

export default function StepMethod({
  requestMethod,
  onRequestMethodChange,
  groupMembers,
  onAddMember,
  onRemoveMember,
  currentStudentId,
  canEditMembers,
}: StepMethodProps) {
  // ======================================================
  // SEARCH STATE
  // ======================================================

  const [studentIdInput, setStudentIdInput] =
    useState("");

  const [
    searchedStudent,
    setSearchedStudent,
  ] = useState<GroupStudent | null>(
    null
  );

  const [
    searchError,
    setSearchError,
  ] = useState("");

  const [
    isSearching,
    setIsSearching,
  ] = useState(false);

  const [
    isAdding,
    setIsAdding,
  ] = useState(false);

  const [
    removingStudentId,
    setRemovingStudentId,
  ] = useState<string | null>(
    null
  );

  // ======================================================
  // SEARCH STUDENT
  // ======================================================

  async function handleSearchStudent() {
    if (!canEditMembers) {
      setSearchError(
        "The group member list is locked because this request has already been submitted."
      );

      return;
    }

    const cleanedStudentId =
      studentIdInput.trim();

    setSearchError("");
    setSearchedStudent(null);

    if (!cleanedStudentId) {
      setSearchError(
        "Please enter a Student ID."
      );

      return;
    }

    // ----------------------------------------------------
    // PREVENT SELF
    // ----------------------------------------------------

    if (
      cleanedStudentId
        .toLowerCase() ===
      currentStudentId
        .trim()
        .toLowerCase()
    ) {
      setSearchError(
        "You cannot add yourself to the group request."
      );

      return;
    }

    // ----------------------------------------------------
    // PREVENT DUPLICATE
    // ----------------------------------------------------

    const alreadyAdded =
      groupMembers.some(
        (member) =>
          member.student_id
            .trim()
            .toLowerCase() ===
          cleanedStudentId.toLowerCase()
      );

    if (alreadyAdded) {
      setSearchError(
        "This student has already been invited."
      );

      return;
    }

    // ----------------------------------------------------
    // SEARCH
    // ----------------------------------------------------

    try {
      setIsSearching(true);

      const student =
        await lookupGroupStudent(
          cleanedStudentId
        );

      if (!student) {
        setSearchError(
          "Student ID not found."
        );

        return;
      }

      setSearchedStudent(
        student
      );
    } catch (error) {
      console.error(
        "Failed to search student:",
        error
      );

      setSearchError(
        "Unable to search for this student. Please try again."
      );
    } finally {
      setIsSearching(false);
    }
  }

  // ======================================================
  // ADD STUDENT
  // ======================================================

  async function handleEnterStudent() {
    if (!canEditMembers) {
      setSearchError(
        "The group member list is locked because this request has already been submitted."
      );

      return;
    }

    if (!searchedStudent) {
      return;
    }

    if (isAdding) {
      return;
    }

    const studentId =
      searchedStudent.studentId;

    // ----------------------------------------------------
    // FINAL DUPLICATE CHECK
    // ----------------------------------------------------

    const alreadyAdded =
      groupMembers.some(
        (member) =>
          member.student_id
            .trim()
            .toLowerCase() ===
          studentId
            .trim()
            .toLowerCase()
      );

    if (alreadyAdded) {
      setSearchError(
        "This student has already been invited."
      );

      return;
    }

    try {
      setIsAdding(true);
      setSearchError("");

      /*
       * DocumentRequestWizard's addGroupMember()
       * handles:
       *
       * 1. Creating the DRAFT request if needed
       * 2. Creating group_request_members
       * 3. Setting invitation_status to PENDING
       * 4. Sending the Gmail invitation
       */

      await onAddMember(
        studentId
      );

      // --------------------------------------------------
      // CLEAR SEARCH AFTER SUCCESS
      // --------------------------------------------------

      setStudentIdInput("");

      setSearchedStudent(
        null
      );

      setSearchError("");
    } catch (error) {
      console.error(
        "Failed to add student:",
        error
      );

      setSearchError(
        "Unable to add this student. Please try again."
      );
    } finally {
      setIsAdding(false);
    }
  }

  // ======================================================
  // REMOVE STUDENT
  // ======================================================

  async function handleRemoveStudent(
    studentId: string
  ) {
    if (!canEditMembers) {
      return;
    }

    if (removingStudentId) {
      return;
    }

    const confirmed =
      window.confirm(
        `Are you sure you want to remove ${studentId} from this group request?\n\nThis will remove their invitation from the request.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setRemovingStudentId(
        studentId
      );

      setSearchError("");

      await onRemoveMember(
        studentId
      );
    } catch (error) {
      console.error(
        "Failed to remove student:",
        error
      );

      setSearchError(
        "Unable to remove this student. Please try again."
      );
    } finally {
      setRemovingStudentId(
        null
      );
    }
  }

  // ======================================================
  // KEYBOARD HANDLING
  // ======================================================

  function handleStudentIdKeyDown(
    event: KeyboardEvent<HTMLInputElement>
  ) {
    if (
      event.key !== "Enter"
    ) {
      return;
    }

    event.preventDefault();

    if (!canEditMembers) {
      return;
    }

    /*
     * If a student has already been searched,
     * Enter adds that student.
     *
     * Otherwise Enter performs the search.
     */

    if (searchedStudent) {
      void handleEnterStudent();
    } else {
      void handleSearchStudent();
    }
  }

  // ======================================================
  // STATUS LABEL
  // ======================================================

  function getStatusLabel(
    status: GroupMemberStatus
  ) {
    if (
      status === "ACCEPTED"
    ) {
      return "Accepted";
    }

    if (
      status === "DECLINED"
    ) {
      return "Declined";
    }

    return "Pending";
  }

  // ======================================================
  // STATUS CLASS
  // ======================================================

  function getStatusClass(
    status: GroupMemberStatus
  ) {
    if (
      status === "ACCEPTED"
    ) {
      return "accepted";
    }

    if (
      status === "DECLINED"
    ) {
      return "declined";
    }

    return "pending";
  }

  // ======================================================
  // RENDER
  // ======================================================

  return (
    <section
      className="step-method"
      style={{
        width: "100%",
      }}
    >
      {/* ==================================================
          TITLE
      ================================================== */}

      <div
        style={{
          marginBottom:
            "24px",
        }}
      >
        <h2>
          Request Method
        </h2>

        <p
          style={{
            color:
              "#666",
            marginTop:
              "6px",
          }}
        >
          Choose whether this request is
          only for you or shared with
          other students.
        </p>
      </div>

      {/* ==================================================
          METHOD OPTIONS
      ================================================== */}

      <div
        style={{
          display:
            "grid",
          gridTemplateColumns:
            "repeat(2, minmax(0, 1fr))",
          gap:
            "16px",
          marginBottom:
            "28px",
        }}
      >
        {/* -----------------------------------------------
            OWN REQUEST
        ----------------------------------------------- */}

        <button
          type="button"
          onClick={() => {
            onRequestMethodChange(
              "OWN"
            );

            setSearchError("");
            setSearchedStudent(
              null
            );
          }}
          style={{
            textAlign:
              "left",
            padding:
              "20px",
            border:
              requestMethod ===
              "OWN"
                ? "2px solid #2563eb"
                : "1px solid #ddd",
            borderRadius:
              "12px",
            background:
              requestMethod ===
              "OWN"
                ? "#eff6ff"
                : "#fff",
            cursor:
              "pointer",
          }}
        >
          <strong
            style={{
              display:
                "block",
              marginBottom:
                "6px",
            }}
          >
            Own Request
          </strong>

          <span
            style={{
              color:
                "#666",
              fontSize:
                "14px",
            }}
          >
            Request documents only
            for yourself.
          </span>
        </button>

        {/* -----------------------------------------------
            WITH OTHERS
        ----------------------------------------------- */}

        <button
          type="button"
          onClick={() => {
            onRequestMethodChange(
              "WITH_OTHERS"
            );

            setSearchError("");
            setSearchedStudent(
              null
            );
          }}
          style={{
            textAlign:
              "left",
            padding:
              "20px",
            border:
              requestMethod ===
              "WITH_OTHERS"
                ? "2px solid #2563eb"
                : "1px solid #ddd",
            borderRadius:
              "12px",
            background:
              requestMethod ===
              "WITH_OTHERS"
                ? "#eff6ff"
                : "#fff",
            cursor:
              "pointer",
          }}
        >
          <strong
            style={{
              display:
                "block",
              marginBottom:
                "6px",
            }}
          >
            With Others
          </strong>

          <span
            style={{
              color:
                "#666",
              fontSize:
                "14px",
            }}
          >
            Invite other students
            to join this request.
          </span>
        </button>
      </div>

      {/* ==================================================
          GROUP REQUEST
      ================================================== */}

      {requestMethod ===
        "WITH_OTHERS" && (
        <div>
          {/* ---------------------------------------------
              LOCKED NOTICE
          --------------------------------------------- */}

          {!canEditMembers && (
            <div
              style={{
                marginBottom:
                  "20px",
                padding:
                  "12px 14px",
                background:
                  "#fff7ed",
                border:
                  "1px solid #fed7aa",
                borderRadius:
                  "8px",
                color:
                  "#9a3412",
                fontSize:
                  "13px",
                lineHeight:
                  "1.5",
              }}
            >
              This group request has already
              been submitted. The participant
              list is now locked and cannot be
              changed.
            </div>
          )}

          {/* ---------------------------------------------
              DESCRIPTION
          --------------------------------------------- */}

          <div
            style={{
              marginBottom:
                "20px",
            }}
          >
            <h3>
              Add Students
            </h3>

            <p
              style={{
                color:
                  "#666",
                fontSize:
                  "14px",
                lineHeight:
                  "1.5",
              }}
            >
              {canEditMembers
                ? "Search for another student using their Student ID. Once you add them, an invitation will be sent to their registered Gmail."
                : "The students already included in this request are shown below."}
            </p>
          </div>

          {/* ---------------------------------------------
              SEARCH AREA
          --------------------------------------------- */}

          {canEditMembers && (
            <div
              style={{
                display:
                  "flex",
                gap:
                  "10px",
                alignItems:
                  "stretch",
                marginBottom:
                  "12px",
              }}
            >
              <input
                type="text"
                value={
                  studentIdInput
                }
                onChange={(
                  event
                ) => {
                  setStudentIdInput(
                    event.target
                      .value
                  );

                  setSearchError(
                    ""
                  );

                  setSearchedStudent(
                    null
                  );
                }}
                onKeyDown={
                  handleStudentIdKeyDown
                }
                placeholder="Enter Student ID"
                disabled={
                  isSearching ||
                  isAdding
                }
                style={{
                  flex:
                    1,
                  minWidth:
                    0,
                  padding:
                    "12px 14px",
                  border:
                    "1px solid #ccc",
                  borderRadius:
                    "8px",
                  fontSize:
                    "14px",
                }}
              />

              {!searchedStudent ? (
                <button
                  type="button"
                  onClick={() =>
                    void handleSearchStudent()
                  }
                  disabled={
                    isSearching ||
                    isAdding ||
                    !studentIdInput.trim()
                  }
                  style={{
                    padding:
                      "0 20px",
                    border:
                      "none",
                    borderRadius:
                      "8px",
                    cursor:
                      isSearching ||
                      isAdding ||
                      !studentIdInput.trim()
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {isSearching
                    ? "Searching..."
                    : "Search"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    void handleEnterStudent()
                  }
                  disabled={
                    isAdding
                  }
                  style={{
                    padding:
                      "0 20px",
                    border:
                      "none",
                    borderRadius:
                      "8px",
                    cursor:
                      isAdding
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {isAdding
                    ? "Adding..."
                    : "Enter"}
                </button>
              )}
            </div>
          )}

          {/* ---------------------------------------------
              SEARCH ERROR
          --------------------------------------------- */}

          {searchError && (
            <div
              style={{
                color:
                  "#b91c1c",
                background:
                  "#fef2f2",
                border:
                  "1px solid #fecaca",
                borderRadius:
                  "8px",
                padding:
                  "10px 12px",
                marginBottom:
                  "16px",
                fontSize:
                  "14px",
              }}
            >
              {searchError}
            </div>
          )}

          {/* ---------------------------------------------
              SEARCHED STUDENT
          --------------------------------------------- */}

          {searchedStudent &&
            canEditMembers && (
              <div
                style={{
                  border:
                    "1px solid #dbeafe",
                  background:
                    "#eff6ff",
                  borderRadius:
                    "12px",
                  padding:
                    "16px",
                  marginBottom:
                    "24px",
                }}
              >
                <div
                  style={{
                    marginBottom:
                      "12px",
                  }}
                >
                  <strong>
                    Student Found
                  </strong>
                </div>

                <div
                  style={{
                    display:
                      "grid",
                    gap:
                      "6px",
                    fontSize:
                      "14px",
                  }}
                >
                  <div>
                    <strong>
                      Name:
                    </strong>{" "}
                    {
                      searchedStudent.name
                    }
                  </div>

                  <div>
                    <strong>
                      Student ID:
                    </strong>{" "}
                    {
                      searchedStudent.studentId
                    }
                  </div>

                  <div>
                    <strong>
                      Email:
                    </strong>{" "}
                    {
                      searchedStudent.email
                    }
                  </div>
                </div>

                <p
                  style={{
                    marginTop:
                      "12px",
                    marginBottom:
                      "0",
                    fontSize:
                      "13px",
                    color:
                      "#555",
                  }}
                >
                  Click{" "}
                  <strong>
                    Enter
                  </strong>{" "}
                  to add this student
                  and send the invitation.
                </p>
              </div>
            )}

          {/* ---------------------------------------------
              INVITED STUDENTS
          --------------------------------------------- */}

          {groupMembers.length >
            0 && (
            <div>
              <h3
                style={{
                  marginBottom:
                    "12px",
                }}
              >
                Group Members
              </h3>

              <div
                style={{
                  display:
                    "grid",
                  gap:
                    "10px",
                }}
              >
                {groupMembers.map(
                  (
                    member
                  ) => (
                    <div
                      key={
                        member.student_id
                      }
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "center",
                        gap:
                          "16px",
                        padding:
                          "14px 16px",
                        border:
                          "1px solid #ddd",
                        borderRadius:
                          "10px",
                        background:
                          "#fff",
                      }}
                    >
                      <div
                        style={{
                          minWidth:
                            0,
                          flex:
                            1,
                        }}
                      >
                        <strong
                          style={{
                            display:
                              "block",
                          }}
                        >
                          {
                            member.student_id
                          }
                        </strong>

                        <span
                          style={{
                            fontSize:
                              "13px",
                            color:
                              "#666",
                          }}
                        >
                          Gmail invitation
                          {member.invitation_status ===
                          "PENDING"
                            ? " sent — waiting for response"
                            : " sent"}
                        </span>
                      </div>

                      <div
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          gap:
                            "8px",
                          flexShrink:
                            0,
                        }}
                      >
                        <span
                          className={`group-member-status ${getStatusClass(
                            member.invitation_status
                          )}`}
                          style={{
                            padding:
                              "5px 10px",
                            borderRadius:
                              "999px",
                            fontSize:
                              "12px",
                            fontWeight:
                              600,
                            background:
                              member.invitation_status ===
                              "ACCEPTED"
                                ? "#dbeafe"
                                : member.invitation_status ===
                                  "DECLINED"
                                ? "#fee2e2"
                                : "#f3f4f6",
                            color:
                              member.invitation_status ===
                              "ACCEPTED"
                                ? "#1d4ed8"
                                : member.invitation_status ===
                                  "DECLINED"
                                ? "#b91c1c"
                                : "#4b5563",
                          }}
                        >
                          {getStatusLabel(
                            member.invitation_status
                          )}
                        </span>

                        {/* --------------------------------
                            REMOVE BUTTON

                            Only visible while the request
                            is still DRAFT.
                        --------------------------------- */}

                        {canEditMembers && (
                          <button
                            type="button"
                            onClick={() =>
                              void handleRemoveStudent(
                                member.student_id
                              )
                            }
                            disabled={
                              removingStudentId ===
                                member.student_id ||
                              isAdding
                            }
                            style={{
                              padding:
                                "6px 10px",
                              border:
                                "1px solid #fecaca",
                              borderRadius:
                                "7px",
                              background:
                                "#fff",
                              color:
                                "#b91c1c",
                              cursor:
                                removingStudentId ===
                                  member.student_id ||
                                isAdding
                                  ? "not-allowed"
                                  : "pointer",
                              fontSize:
                                "12px",
                              fontWeight:
                                600,
                              opacity:
                                removingStudentId ===
                                  member.student_id ||
                                isAdding
                                  ? 0.6
                                  : 1,
                            }}
                          >
                            {removingStudentId ===
                            member.student_id
                              ? "Removing..."
                              : "Remove"}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* -------------------------------------------
                  GROUP INVITATION NOTE
              ------------------------------------------- */}

              <div
                style={{
                  marginTop:
                    "16px",
                  padding:
                    "12px 14px",
                  background:
                    canEditMembers
                      ? "#f9fafb"
                      : "#fff7ed",
                  border:
                    canEditMembers
                      ? "1px solid #e5e7eb"
                      : "1px solid #fed7aa",
                  borderRadius:
                    "8px",
                  fontSize:
                    "13px",
                  color:
                    canEditMembers
                      ? "#666"
                      : "#9a3412",
                  lineHeight:
                    "1.5",
                }}
              >
                {canEditMembers
                  ? "You can remove a student while the request is still being prepared. Students must respond to their invitation through Gmail."
                  : "The group member list is locked because this request has already been submitted. Members can no longer be added or removed."}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}