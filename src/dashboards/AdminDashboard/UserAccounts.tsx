import "./UserAccounts.css";

import { useEffect, useMemo, useState } from "react";

import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "../../../firebase";

type Account = {
  id: string;
  student_id?: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  firebaseUid?: string;
};


// ========================================
// COMPONENT
// ========================================

function UserAccounts() {

  // ========================================
  // CREATE ACCOUNT STATE
  // ========================================

  const [createStudentId, setCreateStudentId] =
    useState("");

  const [createName, setCreateName] =
    useState("");

  const [createEmail, setCreateEmail] =
    useState("");

  const [createRole, setCreateRole] =
    useState("student");

  const [createStatus, setCreateStatus] =
    useState("active");

  const [createMessage, setCreateMessage] =
    useState("");

  const [showCreateForm, setShowCreateForm] =
  useState(false);

  // ========================================
  // ACCOUNT DATA STATE
  // ========================================

  const [accounts, setAccounts] =
    useState<Account[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");


  // ========================================
  // SEARCH STATE
  // ========================================

  const [searchTerm, setSearchTerm] =
    useState("");

  const [hasSearched, setHasSearched] =
    useState(false);

  const [showDeletedAccounts, setShowDeletedAccounts] =
    useState(false);


  // ========================================
  // EDIT ACCOUNT STATE
  // ========================================

  const [editingAccount, setEditingAccount] =
    useState<Account | null>(null);

  const [editStudentId, setEditStudentId] =
    useState("");

  const [editName, setEditName] =
    useState("");

  const [editEmail, setEditEmail] =
    useState("");

  const [editRole, setEditRole] =
    useState("student");

  const [editStatus, setEditStatus] =
    useState("active");

  const [editMessage, setEditMessage] =
    useState("");


  // ========================================
  // RETRIEVE ACCOUNTS
  // ========================================

  const retrieveAccounts = async () => {

    setLoading(true);
    setError("");

    try {

      const snapshot = await getDocs(
        collection(db, "accounts")
      );

      const accountData: Account[] =
        snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }));

      setAccounts(accountData);

    } catch (error) {

      console.error(
        "Error retrieving accounts:",
        error
      );

      setError(
        "Failed to retrieve accounts from Firestore."
      );

    } finally {

      setLoading(false);

    }
  };


  // ========================================
  // CREATE ACCOUNT
  // ========================================

  const handleCreateAccount = async () => {

    setCreateMessage("");
    setError("");

    const normalizedEmail =
      createEmail.trim().toLowerCase();

    const normalizedName =
      createName.trim();

    const normalizedStudentId =
      createStudentId.trim();


    if (!normalizedName) {

      setCreateMessage(
        "Please enter a name."
      );

      return;
    }


    if (!normalizedEmail) {

      setCreateMessage(
        "Please enter an email."
      );

      return;
    }


    if (
      createRole === "student" &&
      !normalizedStudentId
    ) {

      setCreateMessage(
        "Student accounts require a student ID."
      );

      return;
    }


    try {

      const accountRef = doc(
        db,
        "accounts",
        normalizedEmail
      );


      await setDoc(accountRef, {

        name: normalizedName,

        email: normalizedEmail,

        role: createRole,

        status: createStatus,

        ...(createRole === "student"
          ? {
              student_id:
                normalizedStudentId,
            }
          : {}),

      });


      setCreateMessage(
        "Account pre-registered successfully."
      );


      setCreateStudentId("");

      setCreateName("");

      setCreateEmail("");

      setCreateRole("student");

      setCreateStatus("active");


      await retrieveAccounts();

    } catch (error) {

      console.error(
        "Error creating account:",
        error
      );

      setCreateMessage(
        "Failed to create account."
      );
    }
  };


  // ========================================
  // START EDITING ACCOUNT
  // ========================================

  const handleEditAccount = (
    account: Account
  ) => {

    setEditingAccount(account);

    setEditStudentId(
      account.student_id || ""
    );

    setEditName(
      account.name || ""
    );

    setEditEmail(
      account.email || ""
    );

    setEditRole(
      account.role || "student"
    );

    setEditStatus(
      account.status || "active"
    );

    setEditMessage("");

  };


  // ========================================
  // CANCEL EDIT
  // ========================================

  const handleCancelEdit = () => {

    setEditingAccount(null);

    setEditStudentId("");

    setEditName("");

    setEditEmail("");

    setEditRole("student");

    setEditStatus("active");

    setEditMessage("");

  };


  // ========================================
  // UPDATE ACCOUNT
  // ========================================

  const handleUpdateAccount = async () => {

    if (!editingAccount) {
      return;
    }


    setEditMessage("");
    setError("");


    const normalizedName =
      editName.trim();

    const normalizedEmail =
      editEmail.trim().toLowerCase();

    const normalizedStudentId =
      editStudentId.trim();


    if (!normalizedName) {

      setEditMessage(
        "Please enter a name."
      );

      return;
    }


    if (!normalizedEmail) {

      setEditMessage(
        "Please enter an email."
      );

      return;
    }


    if (
      editRole === "student" &&
      !normalizedStudentId
    ) {

      setEditMessage(
        "Student accounts require a student ID."
      );

      return;
    }


    try {

      const oldDocumentId =
        editingAccount.id;


      // If the email has NOT changed,
      // simply update the existing document.

      if (
        normalizedEmail ===
        oldDocumentId
      ) {

        const accountRef = doc(
          db,
          "accounts",
          oldDocumentId
        );


        await updateDoc(
          accountRef,
          {

            name: normalizedName,

            email: normalizedEmail,

            role: editRole,

            status: editStatus,

            ...(editRole === "student"
              ? {
                  student_id:
                    normalizedStudentId,
                }
              : {
                  student_id: "",
                }),

          }
        );

      } else {

        // If the email changed, create the
        // new document first.

        const newAccountRef = doc(
          db,
          "accounts",
          normalizedEmail
        );


        await setDoc(
          newAccountRef,
          {

            name: normalizedName,

            email: normalizedEmail,

            role: editRole,

            status: editStatus,

            ...(editRole === "student"
              ? {
                  student_id:
                    normalizedStudentId,
                }
              : {}),

            ...(editingAccount.firebaseUid
              ? {
                  firebaseUid:
                    editingAccount.firebaseUid,
                }
              : {}),

          }
        );


        // Delete the old document by
        // marking it deleted.

        const oldAccountRef = doc(
          db,
          "accounts",
          oldDocumentId
        );


        await updateDoc(
          oldAccountRef,
          {
            status: "deleted",
          }
        );

      }


      setEditMessage(
        "Account updated successfully."
      );


      setEditingAccount(null);

      await retrieveAccounts();

    } catch (error) {

      console.error(
        "Error updating account:",
        error
      );

      setEditMessage(
        "Failed to update account."
      );

    }

  };


  // ========================================
  // DELETE ACCOUNT
  // ========================================

  const handleDeleteAccount = async (
    account: Account
  ) => {

    const confirmed =
      window.confirm(
        `Are you sure you want to delete the account for ${
          account.name || account.email
        }?`
      );


    if (!confirmed) {
      return;
    }


    try {

      const accountRef = doc(
        db,
        "accounts",
        account.id
      );


      await updateDoc(
        accountRef,
        {
          status: "deleted",
        }
      );


      await retrieveAccounts();

    } catch (error) {

      console.error(
        "Error deleting account:",
        error
      );

      setError(
        "Failed to delete account."
      );
    }
  };


  // ========================================
  // RESTORE ACCOUNT
  // ========================================

  const handleRestoreAccount = async (
    account: Account
  ) => {

    try {

      const accountRef = doc(
        db,
        "accounts",
        account.id
      );


      await updateDoc(
        accountRef,
        {
          status: "active",
        }
      );


      await retrieveAccounts();

    } catch (error) {

      console.error(
        "Error restoring account:",
        error
      );

      setError(
        "Failed to restore account."
      );
    }
  };


  // ========================================
  // LOAD ACCOUNTS WHEN PAGE OPENS
  // ========================================

  useEffect(() => {

    retrieveAccounts();

  }, []);


  // ========================================
  // FILTER ACCOUNTS
  // ========================================

  const displayedAccounts = useMemo(() => {

    let filteredAccounts = accounts;


    if (!showDeletedAccounts) {

      filteredAccounts =
        filteredAccounts.filter(
          (account) =>
            account.status !== "deleted"
        );
    }


    if (
      hasSearched &&
      searchTerm.trim() !== ""
    ) {

      const search =
        searchTerm
          .trim()
          .toLowerCase();


      filteredAccounts =
        filteredAccounts.filter(
          (account) =>

            (account.name || "")
              .toLowerCase()
              .includes(search) ||

            (account.email || "")
              .toLowerCase()
              .includes(search) ||

            (account.student_id || "")
              .toLowerCase()
              .includes(search) ||

            (account.role || "")
              .toLowerCase()
              .includes(search)
        );
    }


    return filteredAccounts;

  }, [
    accounts,
    searchTerm,
    hasSearched,
    showDeletedAccounts,
  ]);


  // ========================================
  // SUMMARY COUNTS
  // ========================================

  const totalAccounts = useMemo(() => {

    return accounts.filter(
      (account) =>
        account.status !== "deleted"
    ).length;

  }, [accounts]);


  const studentCount = useMemo(() => {

    return accounts.filter(
      (account) =>
        account.status !== "deleted" &&
        account.role === "student"
    ).length;

  }, [accounts]);


  const generalOfficeCount = useMemo(() => {

    return accounts.filter(
      (account) =>
        account.status !== "deleted" &&
        account.role === "general_office"
    ).length;

  }, [accounts]);


  const registrarCount = useMemo(() => {

    return accounts.filter(
      (account) =>
        account.status !== "deleted" &&
        account.role === "registrar"
    ).length;

  }, [accounts]);


  const adminCount = useMemo(() => {

    return accounts.filter(
      (account) =>
        account.status !== "deleted" &&
        account.role === "admin"
    ).length;

  }, [accounts]);


  // ========================================
  // SEARCH
  // ========================================

  const handleSearch = () => {

    setHasSearched(true);

  };


  // ========================================
  // SHOW ALL
  // ========================================

  const handleShowAll = () => {

    setSearchTerm("");

    setHasSearched(false);

  };


  // ========================================
  // PAGE
  // ========================================

  return (

    <div className="user-accounts-page">

      {/* ========================================
          HEADER
      ======================================== */}

      <div className="user-accounts-header">

        <div>

          <h2>
            User Accounts
          </h2>

          <p>
            Manage registered students,
            staff, and administrators.
          </p>

        </div>


        <button
          className="refresh-accounts-button"
          onClick={retrieveAccounts}
        >
          ↻ Refresh
        </button>

      </div>


      {/* ========================================
          SUMMARY
      ======================================== */}

      <div className="account-summary">

        <div className="account-summary-card">

          <span>
            Total Accounts
          </span>

          <strong>
            {totalAccounts}
          </strong>

        </div>


        <div className="account-summary-card">

          <span>
            Students
          </span>

          <strong>
            {studentCount}
          </strong>

        </div>


        <div className="account-summary-card">

          <span>
            General Office
          </span>

          <strong>
            {generalOfficeCount}
          </strong>

        </div>


        <div className="account-summary-card">

          <span>
            Registrar
          </span>

          <strong>
            {registrarCount}
          </strong>

        </div>


        <div className="account-summary-card">

          <span>
            Administrators
          </span>

          <strong>
            {adminCount}
          </strong>

        </div>

      </div>


      {/* ========================================
          CREATE ACCOUNT
      ======================================== */}

<div className="create-account-button-wrapper">

  <button
    className="show-create-account-button"
    onClick={() =>
      setShowCreateForm(true)
    }
  >
    + Create Account
  </button>

</div>


{showCreateForm && (
  <div className="create-account-section">

        <div className="create-account-header">

          <h3>
            Create Account
          </h3>

          <p>
            Pre-register a user before they
            sign in to CampuServe.
          </p>

        </div>


        <div className="create-account-form">

          {/* NAME */}

          <div className="create-account-field">

            <label>
              Name
            </label>

            <input
              type="text"
              placeholder="Enter full name"
              value={createName}
              onChange={(event) =>
                setCreateName(
                  event.target.value
                )
              }
            />

          </div>


          {/* EMAIL */}

          <div className="create-account-field">

            <label>
              Email
            </label>

            <input
              type="email"
              placeholder="Enter email address"
              value={createEmail}
              onChange={(event) =>
                setCreateEmail(
                  event.target.value
                )
              }
            />

          </div>


          {/* ROLE */}

          <div className="create-account-field">

            <label>
              Role
            </label>

            <select
              value={createRole}
              onChange={(event) =>
                setCreateRole(
                  event.target.value
                )
              }
            >

              <option value="student">
                Student
              </option>

              <option value="general_office">
                General Office
              </option>

              <option value="registrar">
                Registrar
              </option>

              <option value="admin">
                Administrator
              </option>

            </select>

          </div>


          {/* STUDENT ID */}

          <div className="create-account-field">

            <label>
              Student ID
            </label>

            <input
              type="text"
              placeholder={
                createRole === "student"
                  ? "Enter student ID"
                  : "Not required"
              }
              value={createStudentId}
              disabled={
                createRole !== "student"
              }
              onChange={(event) =>
                setCreateStudentId(
                  event.target.value
                )
              }
            />

          </div>


          {/* STATUS */}

          <div className="create-account-field">

            <label>
              Status
            </label>

            <select
              value={createStatus}
              onChange={(event) =>
                setCreateStatus(
                  event.target.value
                )
              }
            >

              <option value="active">
                Active
              </option>

              <option value="inactive">
                Inactive
              </option>

            </select>

          </div>


          {/* CREATE BUTTON */}

          <div className="create-account-button-container">

  <button
    className="create-account-button"
    onClick={
      handleCreateAccount
    }
  >
    + Create Account
  </button>

  

</div>

        </div>


        {createMessage && (

  <p className="create-account-message">
    {createMessage}
  </p>

)}

<button
  className="cancel-create-account-button"
  onClick={() =>
    setShowCreateForm(false)
  }
>
  Cancel
</button>

  </div>
)}


      {/* ========================================
          EDIT ACCOUNT
      ======================================== */}

      {editingAccount && (

        <div className="edit-account-section">

          <div className="edit-account-header">

            <div>

              <h3>
                Edit Account
              </h3>

              <p>
                Update the selected user's
                account information.
              </p>

            </div>

          </div>


          <div className="edit-account-form">

            {/* NAME */}

            <div className="edit-account-field">

              <label>
                Name
              </label>

              <input
                type="text"
                value={editName}
                onChange={(event) =>
                  setEditName(
                    event.target.value
                  )
                }
              />

            </div>


            {/* EMAIL */}

            <div className="edit-account-field">

              <label>
                Email
              </label>

              <input
                type="email"
                value={editEmail}
                onChange={(event) =>
                  setEditEmail(
                    event.target.value
                  )
                }
              />

            </div>


            {/* ROLE */}

            <div className="edit-account-field">

              <label>
                Role
              </label>

              <select
                value={editRole}
                onChange={(event) =>
                  setEditRole(
                    event.target.value
                  )
                }
              >

                <option value="student">
                  Student
                </option>

                <option value="general_office">
                  General Office
                </option>

                <option value="registrar">
                  Registrar
                </option>

                <option value="admin">
                  Administrator
                </option>

              </select>

            </div>


            {/* STUDENT ID */}

            <div className="edit-account-field">

              <label>
                Student ID
              </label>

              <input
                type="text"
                placeholder={
                  editRole === "student"
                    ? "Enter student ID"
                    : "Not required"
                }
                value={editStudentId}
                disabled={
                  editRole !== "student"
                }
                onChange={(event) =>
                  setEditStudentId(
                    event.target.value
                  )
                }
              />

            </div>


            {/* STATUS */}

            <div className="edit-account-field">

              <label>
                Status
              </label>

              <select
                value={editStatus}
                onChange={(event) =>
                  setEditStatus(
                    event.target.value
                  )
                }
              >

                <option value="active">
                  Active
                </option>

                <option value="inactive">
                  Inactive
                </option>

                <option value="deleted">
                  Deleted
                </option>

              </select>

            </div>


            {/* BUTTONS */}

            <div className="edit-account-buttons">

              <button
                className="save-account-button"
                onClick={
                  handleUpdateAccount
                }
              >
                Save Changes
              </button>


              <button
                className="cancel-edit-button"
                onClick={
                  handleCancelEdit
                }
              >
                Cancel
              </button>

            </div>

          </div>


          {editMessage && (

            <p className="edit-account-message">
              {editMessage}
            </p>

          )}

        </div>

      )}


      {/* ========================================
          SEARCH
      ======================================== */}

      <div className="user-accounts-search-section">

        <div className="user-accounts-search">

          <input
            type="text"
            placeholder="Search by name, email, student ID, or role..."
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(
                event.target.value
              )
            }
            onKeyDown={(event) => {

              if (event.key === "Enter") {
                handleSearch();
              }

            }}
          />


          <button
            onClick={handleSearch}
          >
            🔍 Search
          </button>

        </div>


        <div className="user-accounts-search-options">

          <label>

            <input
              type="checkbox"
              checked={
                showDeletedAccounts
              }
              onChange={(event) =>
                setShowDeletedAccounts(
                  event.target.checked
                )
              }
            />

            Show deleted accounts

          </label>


          <button
            onClick={handleShowAll}
          >
            Show All
          </button>

        </div>

      </div>


      {/* ========================================
          ERROR
      ======================================== */}

      {error && (

        <p className="user-accounts-error">
          {error}
        </p>

      )}


      {/* ========================================
          LOADING
      ======================================== */}

      {loading && (

        <p className="user-accounts-loading">
          Loading accounts...
        </p>

      )}


      {/* ========================================
          TABLE
      ======================================== */}

      {!loading && (

        <div className="user-accounts-table-container">

          <table className="user-accounts-table">

            <thead>

              <tr>

                <th>
                  Name
                </th>

                <th>
                  Email
                </th>

                <th>
                  Student ID
                </th>

                <th>
                  Role
                </th>

                <th>
                  Status
                </th>

                <th>
                  Actions
                </th>

              </tr>

            </thead>


            <tbody>

              {displayedAccounts.length === 0 ? (

                <tr>

                  <td
                    colSpan={6}
                    className="no-accounts-message"
                  >
                    No accounts to display.
                  </td>

                </tr>

              ) : (

                displayedAccounts.map(
                  (account) => (

                    <tr key={account.id}>

                      <td>
                        {account.name || "—"}
                      </td>

                      <td>
                        {account.email || "—"}
                      </td>

                      <td>
                        {account.student_id || "—"}
                      </td>

                      <td>
                        {account.role || "—"}
                      </td>

                      <td>

                        <span
                          className={`account-status ${
                            account.status ===
                            "deleted"
                              ? "deleted"
                              : account.status ===
                                "inactive"
                              ? "inactive"
                              : "active"
                          }`}
                        >
                          {account.status || "—"}
                        </span>

                      </td>


                      <td>

                        {account.status ===
                        "deleted" ? (

                          <button
                            className="account-action-button account-restore-button"
                            onClick={() =>
                              handleRestoreAccount(
                                account
                              )
                            }
                          >
                            Restore
                          </button>

                        ) : (

                          <>

                            <button
                              className="account-action-button account-edit-button"
                              onClick={() =>
                                handleEditAccount(
                                  account
                                )
                              }
                            >
                              Edit
                            </button>


                            <button
                              className="account-action-button account-delete-button"
                              onClick={() =>
                                handleDeleteAccount(
                                  account
                                )
                              }
                            >
                              Delete
                            </button>

                          </>

                        )}

                      </td>

                    </tr>

                  )
                )

              )}

            </tbody>

          </table>

        </div>

      )}

    </div>

  );
}

export default UserAccounts;