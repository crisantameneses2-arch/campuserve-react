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

  function selectMethod(method: "OWN" | "WITH_OTHERS") {
    onRequestMethodChange(method);

    setSearchError("");
    setSearchedStudent(null);
  }

  return (
    <section className="rwx-screen">
      <div className="rwx-screen-heading">
        <div>
          <span className="rwx-eyebrow">
            STEP 01 · REQUEST METHOD
          </span>

          <h2>How would you like to request?</h2>

          <p>
            Choose whether this request is only for you or shared
            with other students.
          </p>
        </div>
      </div>

      {/* METHOD OPTIONS */}

      <div className="rwx-choice-grid">
        <button
          type="button"
          className="rwx-choice"
          aria-pressed={requestMethod === "OWN"}
          onClick={() => selectMethod("OWN")}
        >
          <span className="rwx-choice__art" aria-hidden="true">
            <svg viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="19" r="9" stroke="currentColor" strokeWidth="2.5" />
              <path d="M13 52c1.8-11 8.2-17 19-17s17.2 6 19 17H13Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
              <path d="M25 44h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </span>

          <span className="rwx-choice__copy">
            <strong>Solo request</strong>
            <small>Request documents only for yourself.</small>
          </span>

          <span className="rwx-radio" aria-hidden="true" />
        </button>

        <button
          type="button"
          className="rwx-choice"
          aria-pressed={requestMethod === "WITH_OTHERS"}
          onClick={() => selectMethod("WITH_OTHERS")}
        >
          <span className="rwx-choice__art" aria-hidden="true">
            <svg viewBox="0 0 64 64" fill="none">
              <circle cx="24" cy="21" r="8" stroke="currentColor" strokeWidth="2.5" />
              <circle cx="43" cy="24" r="7" stroke="currentColor" strokeWidth="2.5" />
              <path d="M7 52c1.5-10 7-15 17-15s15.5 5 17 15H7Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
              <path d="M39 39c9-1 15 4 17 13H43" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>

          <span className="rwx-choice__copy">
            <strong>Group request</strong>
            <small>Invite other students to join this request.</small>
          </span>

          <span className="rwx-radio" aria-hidden="true" />
        </button>
      </div>

      {requestMethod === "OWN" && (
        <p className="rwx-note">
          Click <strong>Next</strong> to choose your documents.
        </p>
      )}

      {/* GROUP REQUEST */}

      {requestMethod === "WITH_OTHERS" && (
        <div className="rwx-group">
          {!canEditMembers && (
            <div className="rwx-notice rwx-notice--warn">
              This group request has already been submitted. The
              participant list is now locked and cannot be changed.
            </div>
          )}

          <div className="rwx-group__head">
            <h3>Add students</h3>

            <p>
              {canEditMembers
                ? "Search for another student using their Student ID. Once you add them, an invitation will be sent to their dashboard."
                : "The students already included in this request are shown below."}
            </p>
          </div>

          {/* SEARCH AREA */}

          {canEditMembers && (
            <div className="rwx-search">
              <label
                className="rwx-visually-hidden"
                htmlFor="rwx-student-search"
              >
                Student ID
              </label>

              <input
                id="rwx-student-search"
                className="rwx-input"
                type="text"
                value={studentIdInput}
                onChange={(event) => {
                  setStudentIdInput(event.target.value);
                  setSearchError("");
                  setSearchedStudent(null);
                }}
                onKeyDown={handleStudentIdKeyDown}
                placeholder="Enter Student ID"
                disabled={isSearching || isAdding}
              />

              {!searchedStudent ? (
                <button
                  type="button"
                  className="rwx-btn rwx-btn--secondary"
                  onClick={() => void handleSearchStudent()}
                  disabled={
                    isSearching ||
                    isAdding ||
                    !studentIdInput.trim()
                  }
                >
                  {isSearching ? "Searching..." : "Search"}
                </button>
              ) : (
                <button
                  type="button"
                  className="rwx-btn rwx-btn--primary"
                  onClick={() => void handleEnterStudent()}
                  disabled={isAdding}
                >
                  {isAdding ? "Adding..." : "Add & invite"}
                </button>
              )}
            </div>
          )}

          {searchError && (
            <div className="rwx-notice rwx-notice--error" role="alert">
              {searchError}
            </div>
          )}

          {/* SEARCHED STUDENT */}

          {searchedStudent && canEditMembers && (
            <div className="rwx-found">
              <span className="rwx-avatar">
                {getInitials(searchedStudent.name || searchedStudent.studentId)}
              </span>

              <div className="rwx-found__copy">
                <span className="rwx-eyebrow">STUDENT FOUND</span>
                <strong>{searchedStudent.name}</strong>
                <small>
                  {searchedStudent.studentId}
                  {searchedStudent.email
                    ? ` · ${searchedStudent.email}`
                    : ""}
                </small>
              </div>

              <p>
                Click <strong>Add &amp; invite</strong> (or press
                Enter) to send the invitation.
              </p>
            </div>
          )}

          {/* INVITED STUDENTS */}

          {groupMembers.length > 0 && (
            <div className="rwx-members">
              <h3>Group members</h3>

              {groupMembers.map((member) => {
                const removing =
                  removingStudentId === member.student_id;

                return (
                  <div
                    className="rwx-member"
                    key={member.student_id}
                  >
                    <span className="rwx-avatar" aria-hidden="true">
                      <PersonIcon />
                    </span>

                    <div className="rwx-member__copy">
                      <strong>{member.student_id}</strong>
                      <small>
                        Invitation
                        {member.invitation_status === "PENDING"
                          ? " sent — waiting for response"
                          : " sent"}
                      </small>
                    </div>

                    <span
                      className={`rwx-status rwx-status--${getStatusClass(
                        member.invitation_status
                      )}`}
                    >
                      {getStatusLabel(member.invitation_status)}
                    </span>

                    {/* Only visible while the request is still DRAFT. */}
                    {canEditMembers && (
                      <button
                        type="button"
                        className="rwx-btn rwx-btn--danger rwx-btn--small"
                        onClick={() =>
                          void handleRemoveStudent(
                            member.student_id
                          )
                        }
                        disabled={removing || isAdding}
                      >
                        {removing ? "Removing..." : "Remove"}
                      </button>
                    )}
                  </div>
                );
              })}

              <div
                className={`rwx-notice ${canEditMembers ? "" : "rwx-notice--warn"}`}
              >
                {canEditMembers
                  ? "You can remove a student while the request is still being prepared. Students respond through their dashboard notification."
                  : "The group member list is locked because this request has already been submitted. Members can no longer be added or removed."}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function PersonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20v-1.3a7 7 0 0 1 14 0V20H5Z" />
    </svg>
  );
}

function getInitials(value: string) {
  const parts = value
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);

  if (parts.length === 0) return "?";

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
