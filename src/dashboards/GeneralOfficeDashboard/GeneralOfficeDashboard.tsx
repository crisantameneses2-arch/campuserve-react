import { useState } from "react";
import "./GeneralOfficeDashboard.css";

function GeneralOfficeDashboard() {
    const [activePage, setActivePage] = useState("Dashboard");

    return (
        <div className="general-office-dashboard">

            {/* SIDEBAR */}
            <aside className="go-sidebar">

                <div className="go-menu-icon">
                    ☰
                </div>

                <nav className="go-navigation">

                    <button
                        className={`go-nav-item ${
                            activePage === "Dashboard" ? "active" : ""
                        }`}
                        onClick={() => setActivePage("Dashboard")}
                    >
                        <span>📊</span>
                        Dashboard
                    </button>

                    <button
                        className={`go-nav-item ${
                            activePage === "Inventory" ? "active" : ""
                        }`}
                        onClick={() => setActivePage("Inventory")}
                    >
                        <span>📦</span>
                        Inventory
                    </button>

                    <button
                        className={`go-nav-item ${
                            activePage === "Reservations" ? "active" : ""
                        }`}
                        onClick={() => setActivePage("Reservations")}
                    >
                        <span>📝</span>
                        Reservations
                    </button>

                    <button
                        className={`go-nav-item ${
                            activePage === "Requests" ? "active" : ""
                        }`}
                        onClick={() => setActivePage("Requests")}
                    >
                        <span>📋</span>
                        Requests
                    </button>

                    <button
                        className={`go-nav-item ${
                            activePage === "Claiming" ? "active" : ""
                        }`}
                        onClick={() => setActivePage("Claiming")}
                    >
                        <span>📦</span>
                        Claiming
                    </button>

                    <button
                        className={`go-nav-item ${
                            activePage === "Messages" ? "active" : ""
                        }`}
                        onClick={() => setActivePage("Messages")}
                    >
                        <span>💬</span>
                        Messages
                    </button>

                    <button
                        className={`go-nav-item ${
                            activePage === "Reports" ? "active" : ""
                        }`}
                        onClick={() => setActivePage("Reports")}
                    >
                        <span>📊</span>
                        Reports
                    </button>

                </nav>

            </aside>


            {/* MAIN CONTENT */}
            <main className="go-main">

                {/* HEADER */}
                <header className="go-header">

                    <div className="go-header-title">

                        <h1>
                            {activePage === "Dashboard"
                                ? "General Office Dashboard"
                                : activePage}
                        </h1>

                        <p>
                            {activePage === "Dashboard"
                                ? "Manage items, reservations, and inventory."
                                : `Manage ${activePage.toLowerCase()}.`}
                        </p>

                    </div>


                    <div className="go-header-actions">

                        <button className="go-header-button">
                            🔔
                        </button>

                        <button className="go-header-button">
                            ⚙️
                        </button>

                        <button className="go-header-button">
                            💬
                        </button>

                    </div>

                </header>


                {/* DASHBOARD */}
                {activePage === "Dashboard" && (

                    <section className="go-content">

                        {/* SUMMARY CARDS */}
                        <div className="go-summary">

                            <div
                                className="go-summary-card"
                                onClick={() => setActivePage("Inventory")}
                                style={{ cursor: "pointer" }}
                            >

                                <div className="go-card-icon blue">
                                    📦
                                </div>

                                <div>
                                    <p>Total Items</p>
                                    <h2>4</h2>
                                    <span>Item categories</span>
                                </div>

                            </div>


                            <div
                                className="go-summary-card"
                                onClick={() => setActivePage("Reservations")}
                                style={{ cursor: "pointer" }}
                            >

                                <div className="go-card-icon purple">
                                    📝
                                </div>

                                <div>
                                    <p>Pending Reservations</p>
                                    <h2>12</h2>
                                    <span>Needs review</span>
                                </div>

                            </div>


                            <div
                                className="go-summary-card"
                                onClick={() => setActivePage("Reservations")}
                                style={{ cursor: "pointer" }}
                            >

                                <div className="go-card-icon green">
                                    ✓
                                </div>

                                <div>
                                    <p>Approved Reservations</p>
                                    <h2>36</h2>
                                    <span>Ready for processing</span>
                                </div>

                            </div>

                        </div>


                        {/* MAIN GRID */}
                        <div className="go-dashboard-grid">

                            {/* RECENT RESERVATIONS */}
                            <section className="go-panel reservations-panel">

                                <div className="go-panel-header">

                                    <h2>Recent Reservations</h2>

                                    <button
                                        onClick={() =>
                                            setActivePage("Reservations")
                                        }
                                    >
                                        View All
                                    </button>

                                </div>


                                <div className="go-reservation">

                                    <div className="go-user-icon">
                                        👤
                                    </div>

                                    <div className="go-reservation-info">
                                        <h3>Maria Santos</h3>
                                        <p>PE Uniform</p>
                                    </div>

                                    <span className="status pending">
                                        Pending
                                    </span>

                                </div>


                                <div className="go-reservation">

                                    <div className="go-user-icon">
                                        👤
                                    </div>

                                    <div className="go-reservation-info">
                                        <h3>John Reyes</h3>
                                        <p>School Uniform</p>
                                    </div>

                                    <span className="status approved">
                                        Approved
                                    </span>

                                </div>


                                <div className="go-reservation">

                                    <div className="go-user-icon">
                                        👤
                                    </div>

                                    <div className="go-reservation-info">
                                        <h3>Alyssa Garcia</h3>
                                        <p>ROTC Uniform</p>
                                    </div>

                                    <span className="status processing">
                                        Processing
                                    </span>

                                </div>


                                <div className="go-reservation">

                                    <div className="go-user-icon">
                                        👤
                                    </div>

                                    <div className="go-reservation-info">
                                        <h3>Ian Dela Cruz</h3>
                                        <p>ID Lace</p>
                                    </div>

                                    <span className="status approved">
                                        Approved
                                    </span>

                                </div>

                            </section>


                            {/* INVENTORY STATUS */}
                            <section className="go-panel inventory-panel">

                                <div className="go-panel-header">

                                    <h2>Inventory Status</h2>

                                    <button
                                        onClick={() =>
                                            setActivePage("Inventory")
                                        }
                                    >
                                        View Inventory
                                    </button>

                                </div>


                                <div className="inventory-item">

                                    <div className="inventory-info">
                                        <h3>PE Uniform</h3>
                                        <p>870 total stock</p>
                                    </div>

                                    <div className="stock-bar">

                                        <div
                                            className="stock-progress"
                                            style={{ width: "78%" }}
                                        ></div>

                                    </div>

                                    <span>78%</span>

                                </div>


                                <div className="inventory-item">

                                    <div className="inventory-info">
                                        <h3>School Uniform</h3>
                                        <p>2,300 total stock</p>
                                    </div>

                                    <div className="stock-bar">

                                        <div
                                            className="stock-progress"
                                            style={{ width: "84%" }}
                                        ></div>

                                    </div>

                                    <span>84%</span>

                                </div>


                                <div className="inventory-item">

                                    <div className="inventory-info">
                                        <h3>ROTC Uniform</h3>
                                        <p>1,250 total stock</p>
                                    </div>

                                    <div className="stock-bar">

                                        <div
                                            className="stock-progress"
                                            style={{ width: "70%" }}
                                        ></div>

                                    </div>

                                    <span>70%</span>

                                </div>


                                <div className="inventory-item">

                                    <div className="inventory-info">
                                        <h3>ID Lace</h3>
                                        <p>600 total stock</p>
                                    </div>

                                    <div className="stock-bar">

                                        <div
                                            className="stock-progress"
                                            style={{ width: "60%" }}
                                        ></div>

                                    </div>

                                    <span>60%</span>

                                </div>

                            </section>

                        </div>


                        {/* QUICK ACTIONS */}
                        <section className="go-quick-actions">

                            <h2>Quick Actions</h2>

                            <div className="go-action-grid">

                                <button
                                    className="go-action-card"
                                    onClick={() =>
                                        setActivePage("Inventory")
                                    }
                                >

                                    <span className="go-action-icon">
                                        📦
                                    </span>

                                    <div>
                                        <h3>Inventory</h3>
                                        <p>Manage item stock</p>
                                    </div>

                                    <span className="go-arrow">
                                        →
                                    </span>

                                </button>


                                <button
                                    className="go-action-card"
                                    onClick={() =>
                                        setActivePage("Reservations")
                                    }
                                >

                                    <span className="go-action-icon">
                                        📝
                                    </span>

                                    <div>
                                        <h3>Reservations</h3>
                                        <p>Review reservations</p>
                                    </div>

                                    <span className="go-arrow">
                                        →
                                    </span>

                                </button>


                                <button
                                    className="go-action-card"
                                    onClick={() =>
                                        setActivePage("Inventory")
                                    }
                                >

                                    <span className="go-action-icon">
                                        ➕
                                    </span>

                                    <div>
                                        <h3>Add Stock</h3>
                                        <p>Update inventory</p>
                                    </div>

                                    <span className="go-arrow">
                                        →
                                    </span>

                                </button>

                            </div>

                        </section>

                    </section>

                )}


                {/* OTHER PAGES TEMPORARY */}
                {activePage !== "Dashboard" && (

                    <section className="go-content">

                        <section className="go-panel">

                            <h2>{activePage}</h2>

                            <p
                                style={{
                                    marginTop: "10px",
                                    color: "#71849a"
                                }}
                            >
                                This section will be built next.
                            </p>

                        </section>

                    </section>

                )}

            </main>

        </div>
    );
}

export default GeneralOfficeDashboard;