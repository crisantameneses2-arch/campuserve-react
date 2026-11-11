import "./UserAccounts.css";

import { useEffect, useMemo, useState } from "react";

import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteField,
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
  firebaseUid?: string;
  role?: string;
  name?: string;
  lastName?: string;
  firstName?: string;
  middleName?: string;
  suffix?: string;
  email?: string;
  contactNumber?: string;
  campus?: string;
  status?: string;

  // Student and alumni information
  student_id?: string;
  college?: string;
  program?: string;
  yearLevel?: string;
  section?: string;
  semester?: string;

  // Alumni-only information
  yearGraduated?: string;

  // Employee information
  employeeId?: string;
  department?: string;
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
const campusOptions = [
  "Alaminos City Campus",
  "Asingan Campus",
  "Bayambang Campus",
  "Binmaley Campus",
  "Infanta Campus",
  "Lingayen Campus",
  "San Carlos City Campus",
  "Sta. Maria Campus",
  "Urdaneta City Campus",
];

const formatFullName = (
  firstName: string,
  middleName: string,
  lastName: string,
  suffix: string
) => {
  return [
    firstName.trim(),
    middleName.trim(),
    lastName.trim(),
    suffix.trim(),
  ]
    .filter(Boolean)
    .join(" ");
};

const getAccountDisplayName = (account: Account) => {
  // Preserve the old name for existing accounts
  // that do not have separated name fields.
  if (!account.firstName && !account.lastName) {
    return account.name || "—";
  }

  return formatFullName(
    account.firstName || "",
    account.middleName || "",
    account.lastName || "",
    account.suffix || ""
  );
};

function UserAccounts() {
  // ========================================
  // CREATE ACCOUNT STATE
  // ========================================

const departmentOptions = [
  "COLLEGE OF ARTS, SCIENCES AND LETTERS / COLLEGE OF COMPUTING SCIENCES",
  "COLLEGE OF INDUSTRIAL TECHNOLOGY / COLLEGE OF HOSPITALITY AND TOURISM MANAGEMENT",
  "COLLEGE OF BUSINESS AND PUBLIC ADMINISTRATION",
  "COLLEGE OF TEACHER EDUCATION",
];

  const [createStudentId, setCreateStudentId] =
    useState("");

  const [createLastName, setCreateLastName] = useState("");
const [createFirstName, setCreateFirstName] = useState("");
const [createMiddleName, setCreateMiddleName] = useState("");
const [createSuffix, setCreateSuffix] = useState("");

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

  const [createSemester, setCreateSemester] = useState("");
const [createYearGraduated, setCreateYearGraduated] = useState("");
const [createDepartment, setCreateDepartment] = useState("");
const [createProgram, setCreateProgram] = useState("");
const [createYearLevel, setCreateYearLevel] = useState("");
const [createSection, setCreateSection] = useState("");
const [createCampus, setCreateCampus] = useState("Lingayen Campus");
const [createContactNumber, setCreateContactNumber] = useState("");
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

  const [editLastName, setEditLastName] = useState("");
const [editFirstName, setEditFirstName] = useState("");
const [editMiddleName, setEditMiddleName] = useState("");
const [editSuffix, setEditSuffix] = useState("");

  const [editEmail, setEditEmail] =
    useState("");

  const [editRole, setEditRole] =
    useState("student");

  const [editStatus, setEditStatus] =
    useState("active");

  const [editSemester, setEditSemester] = useState("");
const [editYearGraduated, setEditYearGraduated] = useState("");
  const [editCollege, setEditCollege] = useState("");
const [editDepartment, setEditDepartment] = useState("");
const [editProgram, setEditProgram] = useState("");
const [editYearLevel, setEditYearLevel] = useState("");
const [editSection, setEditSection] = useState("");
const [editCampus, setEditCampus] = useState("");
const [editContactNumber, setEditContactNumber] = useState(""); 
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

    const normalizedLastName = createLastName.trim();
const normalizedFirstName = createFirstName.trim();
const normalizedMiddleName = createMiddleName.trim();
const normalizedSuffix = createSuffix.trim();

const normalizedName = formatFullName(
  normalizedFirstName,
  normalizedMiddleName,
  normalizedLastName,
  normalizedSuffix
);

    const normalizedStudentId =
      createStudentId.trim();

    const normalizedPassword =
      createPassword;

    // Validate name
    if (!normalizedLastName || !normalizedFirstName) {
  setCreateMessage("Please enter both first name and last name.");
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

    const isStudentAccount =
  createRole === "student" ||
  createRole === "alumni";

const isEmployeeAccount =
  createRole === "general_office" ||
  createRole === "registrar" ||
  createRole === "cashier" ||
  createRole === "admin";

// Validate student information
if (isStudentAccount && !normalizedStudentId) {
  setCreateMessage("Student and alumni accounts require a student ID.");
  return;
}

if (isStudentAccount && !createCollege.trim()) {
  setCreateMessage("Please select a college.");
  return;
}

if (isStudentAccount && !createProgram.trim()) {
  setCreateMessage("Please select a program.");
  return;
}

// Validate alumni information
if (
  createRole === "alumni" &&
  !createYearGraduated.trim()
) {
  setCreateMessage("Please enter the year graduated.");
  return;
}

// Validate employee information
if (isEmployeeAccount && !createEmployeeId.trim()) {
  setCreateMessage("Please enter an employee or staff ID.");
  return;
}

if (isEmployeeAccount && !createDepartment.trim()) {
  setCreateMessage("Please enter a department or office.");
  return;
}

if (isEmployeeAccount && !createPosition.trim()) {
  setCreateMessage("Please enter a position or job title.");
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
  // Common information
  firebaseUid: firebaseUser.uid,
    role: createRole,

  // Separated name information
  lastName: normalizedLastName,
  firstName: normalizedFirstName,
  middleName: normalizedMiddleName,
  suffix: normalizedSuffix,

  // Formatted name for compatibility
  name: normalizedName,

  email: normalizedEmail,
  contactNumber: createContactNumber.trim(),
  campus: createCampus.trim(),
  status: createStatus,

  // Student and alumni information
  ...(isStudentAccount
    ? {
        student_id: normalizedStudentId,
        college: createCollege.trim(),
        program: createProgram.trim(),
        yearLevel: createYearLevel.trim(),
        section: createSection.trim(),
        semester: createSemester.trim(),
      }
    : {}),

  // Alumni-only information
  ...(createRole === "alumni"
    ? {
        yearGraduated: createYearGraduated.trim(),
      }
    : {}),

  // Employee information
  ...(isEmployeeAccount
    ? {
        employeeId: createEmployeeId.trim(),
        department: createDepartment.trim(),
        position: createPosition.trim(),
      }
    : {}),
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
      setCreateLastName("");
setCreateFirstName("");
setCreateMiddleName("");
setCreateSuffix("");
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
setCreateEmployeeId("");
setCreatePosition("");
setCreateSemester("");
setCreateYearGraduated("");

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

    setEditLastName(account.lastName || "");
setEditFirstName(account.firstName || "");
setEditMiddleName(account.middleName || "");
setEditSuffix(account.suffix || "");

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
setEditEmployeeId(account.employeeId || "");
setEditPosition(account.position || "");
setEditSemester(account.semester || "");
setEditYearGraduated(account.yearGraduated || "");

    setEditMessage("");
  };

  // ========================================
  // CANCEL EDIT
  // ========================================

  const handleCancelEdit = () => {
    setEditingAccount(null);

    setEditStudentId("");
    setEditLastName("");
setEditFirstName("");
setEditMiddleName("");
setEditSuffix("");
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
setEditEmployeeId("");
setEditPosition("");
    setEditMessage("");
    setEditSemester("");
setEditYearGraduated("");
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

  const normalizedLastName = editLastName.trim();
const normalizedFirstName = editFirstName.trim();
const normalizedMiddleName = editMiddleName.trim();
const normalizedSuffix = editSuffix.trim();

const normalizedName = formatFullName(
  normalizedFirstName,
  normalizedMiddleName,
  normalizedLastName,
  normalizedSuffix
);
  const normalizedEmail = editEmail.trim().toLowerCase();
  const normalizedStudentId = editStudentId.trim();

  const isStudentAccount =
    editRole === "student" ||
    editRole === "alumni";

  const isEmployeeAccount =
  editRole === "general_office" ||
  editRole === "registrar" ||
  editRole === "cashier" ||
  editRole === "admin";

  // Validate common information
  if (!normalizedLastName || !normalizedFirstName) {
  setEditMessage("Please enter both first name and last name.");
  return;
}

  if (!normalizedEmail) {
    setEditMessage("Please enter an email.");
    return;
  }

  // Validate student and alumni information
  if (isStudentAccount && !normalizedStudentId) {
    setEditMessage("Student and alumni accounts require a student ID.");
    return;
  }

  if (isStudentAccount && !editCollege.trim()) {
    setEditMessage("Please enter a college.");
    return;
  }

  if (isStudentAccount && !editProgram.trim()) {
    setEditMessage("Please enter a program.");
    return;
  }

  // Validate alumni-only information
  if (
    editRole === "alumni" &&
    !editYearGraduated.trim()
  ) {
    setEditMessage("Please enter the year graduated.");
    return;
  }

  // Validate employee information
  if (isEmployeeAccount && !editEmployeeId.trim()) {
    setEditMessage("Please enter an employee or staff ID.");
    return;
  }

  if (isEmployeeAccount && !editDepartment.trim()) {
    setEditMessage("Please enter a department or office.");
    return;
  }

  if (isEmployeeAccount && !editPosition.trim()) {
    setEditMessage("Please enter a position or job title.");
    return;
  }

  try {
    const oldDocumentId = editingAccount.id;

    const accountData = {
      // Common information
      firebaseUid: editingAccount.firebaseUid || "",
      role: editRole,
      name: normalizedName,
      email: normalizedEmail,
      contactNumber: editContactNumber.trim(),
      campus: editCampus.trim(),
      status: editStatus,

      // Remove old fields before applying the new role's data
      graduationYear: deleteField(),
      student_id: deleteField(),
      college: deleteField(),
      program: deleteField(),
      yearLevel: deleteField(),
      section: deleteField(),
      semester: deleteField(),
      yearGraduated: deleteField(),
      employeeId: deleteField(),
      department: deleteField(),
      position: deleteField(),

      // Student and alumni information
      ...(isStudentAccount
        ? {
            student_id: normalizedStudentId,
            college: editCollege.trim(),
            program: editProgram.trim(),
            yearLevel: editYearLevel.trim(),
            section: editSection.trim(),
            semester: editSemester.trim(),
          }
        : {}),

      // Alumni-only information
      ...(editRole === "alumni"
        ? {
            yearGraduated: editYearGraduated.trim(),
          }
        : {}),

      // Employee information
      ...(isEmployeeAccount
        ? {
            employeeId: editEmployeeId.trim(),
            department: editDepartment.trim(),
            position: editPosition.trim(),
          }
        : {}),
    };

    if (normalizedEmail === oldDocumentId) {
      // Email has not changed
      const accountRef = doc(
        db,
        "accounts",
        oldDocumentId
      );

      await updateDoc(accountRef, accountData);
    } else {
      // Email has changed
      const newAccountRef = doc(
        db,
        "accounts",
        normalizedEmail
      );

      await setDoc(newAccountRef, accountData);

      // Mark the old document as deleted
      const oldAccountRef = doc(
        db,
        "accounts",
        oldDocumentId
      );

      await updateDoc(oldAccountRef, {
        status: "deleted",
      });
    }

    setEditMessage("Account updated successfully.");
    setEditingAccount(null);

    await retrieveAccounts();
  } catch (error) {
    console.error("Error updating account:", error);

    setEditMessage("Failed to update account.");
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
          getAccountDisplayName(account) || account.email
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
            getAccountDisplayName(account)
  .toLowerCase()
  .includes(search) ||

(account.lastName || "")
  .toLowerCase()
  .includes(search) ||

(account.firstName || "")
  .toLowerCase()
  .includes(search) ||

(account.middleName || "")
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

  const alumniCount = useMemo(() => {
  return accounts.filter(
    (account) =>
      account.status !== "deleted" &&
      account.role === "alumni"
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

  const cashierCount = useMemo(() => {
  return accounts.filter(
    (account) =>
      account.status !== "deleted" &&
      account.role === "cashier"
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
  <span>Alumni</span>
  <strong>{alumniCount}</strong>
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
  <span>Cashiers</span>
  <strong>{cashierCount}</strong>
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

            {/* LAST NAME */}

<div className="create-account-field">
  <label>Last Name *</label>
  <input
    type="text"
    placeholder="Enter last name"
    value={createLastName}
    onChange={(event) =>
      setCreateLastName(event.target.value)
    }
  />
</div>

{/* FIRST NAME */}

<div className="create-account-field">
  <label>First Name *</label>
  <input
    type="text"
    placeholder="Enter first name"
    value={createFirstName}
    onChange={(event) =>
      setCreateFirstName(event.target.value)
    }
  />
</div>

{/* MIDDLE NAME */}

<div className="create-account-field">
  <label>Middle Name</label>
  <input
    type="text"
    placeholder="Enter middle name (optional)"
    value={createMiddleName}
    onChange={(event) =>
      setCreateMiddleName(event.target.value)
    }
  />
</div>

{/* SUFFIX */}

<div className="create-account-field">
  <label>Suffix</label>
  <input
    type="text"
    placeholder="e.g. Jr., Sr., III (optional)"
    value={createSuffix}
    onChange={(event) =>
      setCreateSuffix(event.target.value)
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

                <option value="cashier">
  Cashier
</option>

                <option value="admin">
                  Administrator
                </option>

              </select>

            </div>

            {/* STUDENT AND ALUMNI FIELDS */}

{(createRole === "student" || createRole === "alumni") && (
  <>
    <div className="create-account-field">
      <label>Student ID</label>
      <input
        type="text"
        placeholder="Enter student ID"
        value={createStudentId}
        onChange={(event) =>
          setCreateStudentId(event.target.value)
        }
      />
    </div>

    <div className="create-account-field">
      <label>College</label>
      <select
        value={createCollege}
        onChange={(event) => {
          setCreateCollege(event.target.value);
          setCreateDepartment(event.target.value);
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

    <div className="create-account-field">
      <label>Program</label>
      <select
        value={createProgram}
        onChange={(event) =>
          setCreateProgram(event.target.value)
        }
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

    <div className="create-account-field">
      <label>Year Level</label>
      <select
        value={createYearLevel}
        onChange={(event) =>
          setCreateYearLevel(event.target.value)
        }
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

    <div className="create-account-field">
      <label>Section</label>
      <input
        type="text"
        placeholder="Enter section"
        value={createSection}
        onChange={(event) =>
          setCreateSection(event.target.value)
        }
      />
    </div>

    <div className="create-account-field">
      <label>Semester</label>
      <select
        value={createSemester}
        onChange={(event) =>
          setCreateSemester(event.target.value)
        }
      >
        <option value="">Select semester</option>
        <option value="1st Semester">1st Semester</option>
        <option value="2nd Semester">2nd Semester</option>
        <option value="Summer">Summer</option>
      </select>
    </div>
  </>
)}

{/* ALUMNI-ONLY FIELD */}

{createRole === "alumni" && (
  <div className="create-account-field">
    <label>Year Graduated</label>
    <input
      type="number"
      placeholder="Enter year graduated"
      value={createYearGraduated}
      onChange={(event) =>
        setCreateYearGraduated(event.target.value)
      }
    />
  </div>
)}

{/* EMPLOYEE FIELDS */}

{["general_office", "registrar", "cashier", "admin"].includes(createRole) && (
  <>
    <div className="create-account-field">
      <label>Employee / Staff ID</label>
      <input
        type="text"
        placeholder="Enter employee or staff ID"
        value={createEmployeeId}
        onChange={(event) =>
          setCreateEmployeeId(event.target.value)
        }
      />
    </div>

    <div className="create-account-field">
  <label>Department / Office</label>
  <select
    value={createDepartment}
    onChange={(event) =>
      setCreateDepartment(event.target.value)
    }
  >
    <option value="">Select department / office</option>

    {departmentOptions.map((department) => (
      <option key={department} value={department}>
        {department}
      </option>
    ))}
  </select>
</div>

    <div className="create-account-field">
      <label>Position / Job Title</label>
      <input
        type="text"
        placeholder="Enter position or job title"
        value={createPosition}
        onChange={(event) =>
          setCreatePosition(event.target.value)
        }
      />
    </div>
  </>
)}

{/* COMMON FIELDS */}

<div className="create-account-field">
  <label>Campus</label>

  <select
    value={createCampus}
    onChange={(event) =>
      setCreateCampus(event.target.value)
    }
  >
    <option value="">Select campus</option>

    {campusOptions.map((campus) => (
      <option
        key={campus}
        value={campus}
        disabled={campus !== "Lingayen Campus"}
        style={{
          color:
            campus === "Lingayen Campus"
              ? "inherit"
              : "rgba(0, 0, 0, 0.18)",
        }}
      >
        {campus}
      </option>
    ))}
  </select>
</div>

<div className="create-account-field">
  <label>Contact Number</label>
  <input
    type="tel"
    placeholder="Enter contact number"
    value={createContactNumber}
    onChange={(event) =>
      setCreateContactNumber(event.target.value)
    }
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

            {/* LAST NAME */}

<div className="edit-account-field">
  <label>Last Name *</label>
  <input
    type="text"
    placeholder="Enter last name"
    value={editLastName}
    onChange={(event) =>
      setEditLastName(event.target.value)
    }
  />
</div>

{/* FIRST NAME */}

<div className="edit-account-field">
  <label>First Name *</label>
  <input
    type="text"
    placeholder="Enter first name"
    value={editFirstName}
    onChange={(event) =>
      setEditFirstName(event.target.value)
    }
  />
</div>

{/* MIDDLE NAME */}

<div className="edit-account-field">
  <label>Middle Name</label>
  <input
    type="text"
    placeholder="Enter middle name (optional)"
    value={editMiddleName}
    onChange={(event) =>
      setEditMiddleName(event.target.value)
    }
  />
</div>

{/* SUFFIX */}

<div className="edit-account-field">
  <label>Suffix</label>
  <input
    type="text"
    placeholder="e.g. Jr., Sr., III (optional)"
    value={editSuffix}
    onChange={(event) =>
      setEditSuffix(event.target.value)
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

                <option value="cashier">
  Cashier
</option>

                <option value="admin">
                  Administrator
                </option>

              </select>

            </div>

            {/* STUDENT AND ALUMNI FIELDS */}

{(editRole === "student" || editRole === "alumni") && (
  <>
    <div className="edit-account-field">
      <label>Student ID</label>
      <input
        type="text"
        placeholder="Enter student ID"
        value={editStudentId}
        onChange={(event) =>
          setEditStudentId(event.target.value)
        }
      />
    </div>

    <div className="edit-account-field">
  <label>College</label>
  <select
    value={editCollege}
    onChange={(event) => {
      setEditCollege(event.target.value);
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

    <div className="edit-account-field">
      <label>Year Level</label>
      <select
        value={editYearLevel}
        onChange={(event) =>
          setEditYearLevel(event.target.value)
        }
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

    <div className="edit-account-field">
      <label>Section</label>
      <input
        type="text"
        placeholder="Enter section"
        value={editSection}
        onChange={(event) =>
          setEditSection(event.target.value)
        }
      />
    </div>

    <div className="edit-account-field">
      <label>Semester</label>
      <select
        value={editSemester}
        onChange={(event) =>
          setEditSemester(event.target.value)
        }
      >
        <option value="">Select semester</option>
        <option value="1st Semester">1st Semester</option>
        <option value="2nd Semester">2nd Semester</option>
        <option value="Summer">Summer</option>
      </select>
    </div>
  </>
)}

{/* ALUMNI-ONLY FIELD */}

{editRole === "alumni" && (
  <div className="edit-account-field">
    <label>Year Graduated</label>
    <input
      type="number"
      placeholder="Enter year graduated"
      value={editYearGraduated}
      onChange={(event) =>
        setEditYearGraduated(event.target.value)
      }
    />
  </div>
)}

{/* EMPLOYEE FIELDS */}

{["general_office", "registrar", "cashier", "admin"].includes(editRole) && (
  <>
    <div className="edit-account-field">
      <label>Employee / Staff ID</label>
      <input
        type="text"
        placeholder="Enter employee or staff ID"
        value={editEmployeeId}
        onChange={(event) =>
          setEditEmployeeId(event.target.value)
        }
      />
    </div>

    <div className="edit-account-field">
  <label>Department / Office</label>
  <select
    value={editDepartment}
    onChange={(event) =>
      setEditDepartment(event.target.value)
    }
  >
    <option value="">Select department / office</option>

    {departmentOptions.map((department) => (
      <option key={department} value={department}>
        {department}
      </option>
    ))}
  </select>
</div>

    <div className="edit-account-field">
      <label>Position / Job Title</label>
      <input
        type="text"
        placeholder="Enter position or job title"
        value={editPosition}
        onChange={(event) =>
          setEditPosition(event.target.value)
        }
      />
    </div>
  </>
)}

{/* COMMON FIELDS */}

<div className="edit-account-field">
  <label>Campus</label>

  <select
    value={editCampus}
    onChange={(event) =>
      setEditCampus(event.target.value)
    }
  >
    <option value="">Select campus</option>

    {campusOptions.map((campus) => (
      <option
        key={campus}
        value={campus}
        disabled={campus !== "Lingayen Campus"}
        style={{
          color:
            campus === "Lingayen Campus"
              ? "inherit"
              : "rgba(0, 0, 0, 0.18)",
        }}
      >
        {campus}
      </option>
    ))}
  </select>
</div>

<div className="edit-account-field">
  <label>Contact Number</label>
  <input
    type="tel"
    placeholder="Enter contact number"
    value={editContactNumber}
    onChange={(event) =>
      setEditContactNumber(event.target.value)
    }
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
  {getAccountDisplayName(account)}
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