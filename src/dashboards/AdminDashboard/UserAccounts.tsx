import "./UserAccounts.css";

import { useEffect, useMemo, useState } from "react";

import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
} from "firebase/auth";

import {
  initializeApp,
  deleteApp,
} from "firebase/app";

import {
  db,
  firebaseConfig,
} from "../../../firebase";

type Account = {
  id: string;
  student_id?: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  firebaseUid?: string;

  college?: string;
  department?: string;
  program?: string;
  yearLevel?: string;
  section?: string;
  campus?: string;
  contactNumber?: string;
  graduationYear?: string;
  employeeId?: string;
  position?: string;
};

// ========================================
// COMPONENT
// ========================================

const collegePrograms: Record<string, string[]> = {
  "COLLEGE OF ARTS, SCIENCES AND LETTERS": [
    "Bachelor of Arts in English Language",
    "Bachelor of Arts in Economics",
    "Bachelor of Science in Biology",
    "Bachelor of Science in Nutrition and Dietetics",
    "Bachelor of Science in Social Work",
  ],

  "COLLEGE OF BUSINESS AND PUBLIC ADMINISTRATION": [
    "Bachelor of Public Administration",
    "Bachelor of Science in Business Administration - Major in Financial Management",
    "Bachelor of Science in Business Administration - Major in Operations Management",
  ],

  "COLLEGE OF COMPUTING SCIENCES": [
    "Bachelor of Science in Computer Science",
    "Bachelor of Science in Information Technology",
    "Bachelor of Science in Mathematics - Major in Pure Math",
    "Bachelor of Science in Mathematics - Major in Statistics",
    "Bachelor of Science in Mathematics - Major in CIT",
  ],

  "COLLEGE OF HOSPITALITY AND TOURISM MANAGEMENT": [
    "Bachelor of Science Hospitality Management",
  ],

  "COLLEGE OF TEACHER EDUCATION": [
    "Bachelor of Secondary Education",
    "Bachelor of Technical- Vocational Teacher Education",
    "Bachelor of Technology and Livelihood Education",
  ],

  "COLLEGE OF INDUSTRIAL TECHNOLOGY": [
    "Bachelor Industrial Technology - Major in Automotive Technology",
    "Bachelor Industrial Technology - Major in Ceramics Technology",
    "Bachelor Industrial Technology - Major in Civil Technology",
    "Bachelor Industrial Technology - Major in Drafting Technology",
    "Bachelor Industrial Technology - Major in Electrical Technology",
    "Bachelor Industrial Technology - Major in Electronics Technology",
    "Bachelor Industrial Technology - Major in Food Service Management",
    "Bachelor Industrial Technology - Major in Garments, Fashion and Design",
    "Bachelor Industrial Technology - Major in Mechanical Technology",
  ],
};

const collegeOptions = Object.keys(collegePrograms);

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

  const [createPassword, setCreatePassword] =
    useState("");

  const [createRole, setCreateRole] =
    useState("student");

  const [createStatus, setCreateStatus] =
    useState("active");

  const [createCollege, setCreateCollege] = 
  useState("");
const [createDepartment, setCreateDepartment] = useState("");
const [createProgram, setCreateProgram] = useState("");
const [createYearLevel, setCreateYearLevel] = useState("");
const [createSection, setCreateSection] = useState("");
const [createCampus, setCreateCampus] = useState("Lingayen Campus");
const [createContactNumber, setCreateContactNumber] = useState("");
const [createGraduationYear, setCreateGraduationYear] = useState("");
const [createEmployeeId, setCreateEmployeeId] = useState("");
const [createPosition, setCreatePosition] = useState("");

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

  const [editCollege, setEditCollege] = useState("");
const [editDepartment, setEditDepartment] = useState("");
const [editProgram, setEditProgram] = useState("");
const [editYearLevel, setEditYearLevel] = useState("");
const [editSection, setEditSection] = useState("");
const [editCampus, setEditCampus] = useState("");
const [editContactNumber, setEditContactNumber] = useState("");
const [editGraduationYear, setEditGraduationYear] = useState("");
const [editEmployeeId, setEditEmployeeId] = useState("");
const [editPosition, setEditPosition] = useState("");

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

    const normalizedPassword =
      createPassword;

    // Validate name
    if (!normalizedName) {
      setCreateMessage(
        "Please enter a name."
      );
      return;
    }

    // Validate email
    if (!normalizedEmail) {
      setCreateMessage(
        "Please enter an email."
      );
      return;
    }

    // Validate password
    if (!normalizedPassword) {
      setCreateMessage(
        "Please enter a password."
      );
      return;
    }

    if (normalizedPassword.length < 6) {
      setCreateMessage(
        "Password must be at least 6 characters."
      );
      return;
    }

    // Validate student ID
    if (
      createRole === "student" &&
      !normalizedStudentId
    ) {
      setCreateMessage(
        "Student accounts require a student ID."
      );
      return;
    }

    
    // Validate college
    if (!createCollege.trim()) {
      setCreateMessage("Please select a college.");
      return;
    }

    // Validate program
    if (!createProgram.trim()) {
      setCreateMessage("Please select a program.");
      return;
    }


    let secondaryApp;

    try {
      /*
       * Create a SECONDARY Firebase app.
       *
       * This prevents the Admin's current
       * Firebase Authentication session from
       * being replaced by the new user's account.
       */
      secondaryApp = initializeApp(
        firebaseConfig,
        `AccountCreationApp-${Date.now()}`
      );

      const secondaryAuth =
        getAuth(secondaryApp);

      /*
       * Create the user's Firebase
       * Authentication account.
       */
      const userCredential =
        await createUserWithEmailAndPassword(
          secondaryAuth,
          normalizedEmail,
          normalizedPassword
        );

      const firebaseUser =
        userCredential.user;

      /*
       * Create the matching Firestore
       * account document.
       */
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

  student_id: createStudentId.trim(),

  college: createCollege.trim(),
  department: createDepartment.trim(),
  program: createProgram.trim(),
  yearLevel: createYearLevel.trim(),
  section: createSection.trim(),
  campus: createCampus.trim(),
  contactNumber: createContactNumber.trim(),
  graduationYear: createGraduationYear.trim(),
  employeeId: createEmployeeId.trim(),
  position: createPosition.trim(),
});

      /*
       * Sign out the temporary authentication
       * session.
       */
      await signOut(secondaryAuth);

      setCreateMessage(
        "Account created successfully. The user can now log in using the email and password."
      );

      // Clear form
      setCreateStudentId("");
      setCreateName("");
      setCreateEmail("");
      setCreatePassword("");
      setCreateRole("student");
      setCreateStatus("active");

      setCreateCollege("");
setCreateDepartment("");
setCreateProgram("");
setCreateYearLevel("");
setCreateSection("");
setCreateCampus("Lingayen Campus");
setCreateContactNumber("");
setCreateGraduationYear("");
setCreateEmployeeId("");
setCreatePosition("");

      // Refresh account list
      await retrieveAccounts();
    } catch (error: any) {
      console.error(
        "Error creating account:",
        error
      );

      if (
        error?.code ===
        "auth/email-already-in-use"
      ) {
        setCreateMessage(
          "This email already has a Firebase Authentication account."
        );
      } else if (
        error?.code ===
        "auth/invalid-email"
      ) {
        setCreateMessage(
          "Please enter a valid email address."
        );
      } else if (
        error?.code ===
        "auth/weak-password"
      ) {
        setCreateMessage(
          "Password is too weak. Please use at least 6 characters."
        );
      } else {
        setCreateMessage(
          "Failed to create account."
        );
      }
    } finally {
      /*
       * Always clean up the temporary Firebase
       * application.
       */
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
        } catch (cleanupError) {
          console.error(
            "Error cleaning up secondary Firebase app:",
            cleanupError
          );
        }
      }
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

setEditCollege(account.college || "");
setEditDepartment(account.department || "");
setEditProgram(account.program || "");
setEditYearLevel(account.yearLevel || "");
setEditSection(account.section || "");
setEditCampus(account.campus || "");
setEditContactNumber(account.contactNumber || "");
setEditGraduationYear(account.graduationYear || "");
setEditEmployeeId(account.employeeId || "");
setEditPosition(account.position || "");

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
    setEditCollege("");
setEditDepartment("");
setEditProgram("");
setEditYearLevel("");
setEditSection("");
setEditCampus("");
setEditContactNumber("");
setEditGraduationYear("");
setEditEmployeeId("");
setEditPosition("");
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

      /*
       * If the email has NOT changed,
       * simply update the existing document.
       */
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
            college: editCollege.trim(),
department: editDepartment.trim(),
program: editProgram.trim(),
yearLevel: editYearLevel.trim(),
section: editSection.trim(),
campus: editCampus.trim(),
contactNumber: editContactNumber.trim(),
graduationYear: editGraduationYear.trim(),
employeeId: editEmployeeId.trim(),
position: editPosition.trim(),

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
        /*
         * If the email changed, create the
         * new Firestore document first.
         *
         * NOTE:
         * This does NOT change the Firebase
         * Authentication email.
         */
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
            college: editCollege.trim(),
department: editDepartment.trim(),
program: editProgram.trim(),
yearLevel: editYearLevel.trim(),
section: editSection.trim(),
campus: editCampus.trim(),
contactNumber: editContactNumber.trim(),
graduationYear: editGraduationYear.trim(),
employeeId: editEmployeeId.trim(),
position: editPosition.trim(),

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

        /*
         * Mark the old Firestore document
         * as deleted instead of permanently
         * removing it.
         */
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
              Create a Firebase Authentication
              account and register the user
              in CampuServe.
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

            {/* PASSWORD */}

            <div className="create-account-field">

              <label>
                Password
              </label>

              <input
                type="password"
                placeholder="Enter initial password"
                value={createPassword}
                onChange={(event) =>
                  setCreatePassword(
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

<option value="alumni">
  Alumni
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

{/* COLLEGE */}

<div className="create-account-field">
  <label>College</label>
  <select
    value={createCollege}
    onChange={(event) => {
      const selectedCollege = event.target.value;
      setCreateCollege(selectedCollege);
      setCreateDepartment(selectedCollege);
      setCreateProgram("");
    }}
  >
    <option value="">Select college</option>
    {collegeOptions.map((college) => (
      <option key={college} value={college}>
        {college}
      </option>
    ))}
  </select>
</div>


{/* DEPARTMENT */}
<div className="create-account-field">
  <label>Department</label>
  <select
    value={createDepartment}
    onChange={(event) => setCreateDepartment(event.target.value)}
    disabled={!createCollege}
  >
    <option value="">Select department</option>
    {createCollege && (
      <option value={createCollege}>{createCollege}</option>
    )}
  </select>
</div>

{/* PROGRAM */}
<div className="create-account-field">
  <label>Program</label>
  <select
    value={createProgram}
    onChange={(event) => setCreateProgram(event.target.value)}
    disabled={!createCollege}
  >
    <option value="">Select program</option>
    {(collegePrograms[createCollege] || []).map((program) => (
      <option key={program} value={program}>
        {program}
      </option>
    ))}
  </select>
</div>


{/* YEAR LEVEL */}
<div className="create-account-field">
  <label>Year Level</label>
  <select
    value={createYearLevel}
    onChange={(event) => setCreateYearLevel(event.target.value)}
  >
    <option value="">Select year level</option>
    <option value="1st Year">1st Year</option>
    <option value="2nd Year">2nd Year</option>
    <option value="3rd Year">3rd Year</option>
    <option value="4th Year">4th Year</option>
    <option value="5th Year">5th Year</option>
    <option value="Graduate">Graduate</option>
    <option value="N/A">Not applicable</option>
  </select>
</div>

{/* SECTION */}
<div className="create-account-field">
  <label>Section</label>
  <input
    type="text"
    placeholder="Enter section"
    value={createSection}
    onChange={(event) => setCreateSection(event.target.value)}
  />
</div>

{/* CAMPUS */}
<div className="create-account-field">
  <label>Campus</label>
  <input
    type="text"
    placeholder="Enter campus"
    value={createCampus}
    onChange={(event) => setCreateCampus(event.target.value)}
  />
</div>

{/* CONTACT NUMBER */}
<div className="create-account-field">
  <label>Contact Number</label>
  <input
    type="tel"
    placeholder="Enter contact number"
    value={createContactNumber}
    onChange={(event) => setCreateContactNumber(event.target.value)}
  />
</div>

{/* GRADUATION YEAR */}
<div className="create-account-field">
  <label>Graduation Year</label>
  <input
    type="number"
    placeholder="Enter graduation year"
    value={createGraduationYear}
    onChange={(event) => setCreateGraduationYear(event.target.value)}
  />
</div>

{/* EMPLOYEE ID */}
<div className="create-account-field">
  <label>Employee / Staff ID</label>
  <input
    type="text"
    placeholder="Enter employee or staff ID"
    value={createEmployeeId}
    onChange={(event) => setCreateEmployeeId(event.target.value)}
  />
</div>

{/* POSITION */}
<div className="create-account-field">
  <label>Position / Job Title</label>
  <input
    type="text"
    placeholder="Enter position or job title"
    value={createPosition}
    onChange={(event) => setCreatePosition(event.target.value)}
  />
</div>

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


                <option value="alumni">
  Alumni
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


{/* COLLEGE */}
<div className="edit-account-field">
  <label>College</label>
  <select
    value={editCollege}
    onChange={(event) => {
      const selectedCollege = event.target.value;
      setEditCollege(selectedCollege);
      setEditDepartment(selectedCollege);
      setEditProgram("");
    }}
  >
    <option value="">Select college</option>
    {collegeOptions.map((college) => (
      <option key={college} value={college}>
        {college}
      </option>
    ))}
  </select>
</div>

{/* DEPARTMENT */}
<div className="edit-account-field">
  <label>Department</label>
  <select
    value={editDepartment}
    onChange={(event) => setEditDepartment(event.target.value)}
    disabled={!editCollege}
  >
    <option value="">Select department</option>
    {editCollege && (
      <option value={editCollege}>{editCollege}</option>
    )}
  </select>
</div>

{/* PROGRAM */}
<div className="edit-account-field">
  <label>Program</label>
  <select
    value={editProgram}
    onChange={(event) => setEditProgram(event.target.value)}
    disabled={!editCollege}
  >
    <option value="">Select program</option>
    {(collegePrograms[editCollege] || []).map((program) => (
      <option key={program} value={program}>
        {program}
      </option>
    ))}
  </select>
</div>


{/* YEAR LEVEL */}
<div className="edit-account-field">
  <label>Year Level</label>
  <select
    value={editYearLevel}
    onChange={(event) => setEditYearLevel(event.target.value)}
  >
    <option value="">Select year level</option>
    <option value="1st Year">1st Year</option>
    <option value="2nd Year">2nd Year</option>
    <option value="3rd Year">3rd Year</option>
    <option value="4th Year">4th Year</option>
    <option value="5th Year">5th Year</option>
    <option value="Graduate">Graduate</option>
    <option value="N/A">Not applicable</option>
  </select>
</div>

{/* SECTION */}
<div className="edit-account-field">
  <label>Section</label>
  <input
    type="text"
    placeholder="Enter section"
    value={editSection}
    onChange={(event) => setEditSection(event.target.value)}
  />
</div>

{/* CAMPUS */}
<div className="edit-account-field">
  <label>Campus</label>
  <input
    type="text"
    placeholder="Enter campus"
    value={editCampus}
    onChange={(event) => setEditCampus(event.target.value)}
  />
</div>

{/* CONTACT NUMBER */}
<div className="edit-account-field">
  <label>Contact Number</label>
  <input
    type="tel"
    placeholder="Enter contact number"
    value={editContactNumber}
    onChange={(event) => setEditContactNumber(event.target.value)}
  />
</div>

{/* GRADUATION YEAR */}
<div className="edit-account-field">
  <label>Graduation Year</label>
  <input
    type="number"
    placeholder="Enter graduation year"
    value={editGraduationYear}
    onChange={(event) => setEditGraduationYear(event.target.value)}
  />
</div>

{/* EMPLOYEE ID */}
<div className="edit-account-field">
  <label>Employee / Staff ID</label>
  <input
    type="text"
    placeholder="Enter employee or staff ID"
    value={editEmployeeId}
    onChange={(event) => setEditEmployeeId(event.target.value)}
  />
</div>

{/* POSITION */}
<div className="edit-account-field">
  <label>Position / Job Title</label>
  <input
    type="text"
    placeholder="Enter position or job title"
    value={editPosition}
    onChange={(event) => setEditPosition(event.target.value)}
  />
</div>

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