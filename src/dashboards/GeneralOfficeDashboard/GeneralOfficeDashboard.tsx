import { useEffect, useState } from "react";
import "./GeneralOfficeDashboard.css";

import {
    collection,
    getDocs,
    doc,
    updateDoc,
} from "firebase/firestore";

import { db } from "../../../firebase";


// =========================
// INVENTORY TYPE
// =========================

type InventoryItem = {
    id: string;
    itemName: string;
    size: string;
    price: number;
    totalStock: number;
    onlineStock: number;
    walkInStock: number;
    availableOnline: number;
    availableWalkIn: number;
    reservedQuantity: number;
    status: string;
};


// =========================
// RESERVATION ITEM TYPE
// =========================

type ReservationItem = {
    inventoryId: string;
    itemName: string;
    price: number;
    quantity: number;
    size: string;
    subtotal: number;
};


// =========================
// RESERVATION TYPE
// =========================

type ItemReservation = {
    id: string;
    reservationId: string;
    claimStubId: string;
    fullName: string;
    studentId: string;
    mobileNumber: string;
    program: string;
    pickupDate: string;
    pickupTime: string;
    status: string;
    totalAmount: number;
    items: ReservationItem[];
};


function GeneralOfficeDashboard() {

    const [activePage, setActivePage] = useState("Dashboard");


    // =========================
    // INVENTORY STATE
    // =========================

    const [inventory, setInventory] =
        useState<InventoryItem[]>([]);

    const [loadingInventory, setLoadingInventory] =
        useState(false);


    // =========================
    // RESERVATION STATE
    // =========================

    const [reservations, setReservations] =
        useState<ItemReservation[]>([]);

    const [loadingReservations, setLoadingReservations] =
        useState(false);


    // =========================
    // LOAD INVENTORY
    // =========================

    useEffect(() => {

        if (
            activePage === "Inventory" ||
            activePage === "Reports"
        ) {
            loadInventory();
        }

    }, [activePage]);


    const loadInventory = async () => {

        setLoadingInventory(true);

        try {

            const inventorySnapshot = await getDocs(
                collection(db, "inventory")
            );

            const inventoryData: InventoryItem[] =
                inventorySnapshot.docs.map((document) => ({
                    id: document.id,

                    ...(document.data() as Omit<
                        InventoryItem,
                        "id"
                    >),
                }));

            setInventory(inventoryData);

        } catch (error) {

            console.error(
                "Error loading inventory:",
                error
            );

        } finally {

            setLoadingInventory(false);

        }
    };


    // =========================
    // LOAD RESERVATIONS
    // =========================

    useEffect(() => {

        if (
            activePage === "Reservations" ||
            activePage === "Requests" ||
            activePage === "Claiming" ||
            activePage === "Dashboard" ||
            activePage === "Reports"
        ) {
            loadReservations();
        }

    }, [activePage]);


    const loadReservations = async () => {

        setLoadingReservations(true);

        try {

            const reservationSnapshot = await getDocs(
                collection(db, "itemReservations")
            );


            const reservationData: ItemReservation[] =
                reservationSnapshot.docs.map((document) => {

                    const data = document.data();


                    const items: ReservationItem[] =
                        Array.isArray(data.items)
                            ? data.items.map((item: any) => ({

                                inventoryId:
                                    item.inventoryId || "",

                                itemName:
                                    item.itemName || "",

                                price:
                                    Number(item.price) || 0,

                                quantity:
                                    Number(item.quantity) || 0,

                                size:
                                    item.size || "",

                                subtotal:
                                    Number(item.subtotal) || 0,

                            }))
                            : [];


                    return {

                        id: document.id,

                        reservationId:
                            data.reservationId ||
                            document.id,

                        claimStubId:
                            data.claimStubId || "",

                        fullName:
                            data.fullName || "",

                        studentId:
                            data.studentId || "",

                        mobileNumber:
                            data.mobileNumber || "",

                        program:
                            data.program || "",

                        pickupDate:
                            data.pickupDate || "",

                        pickupTime:
                            data.pickupTime || "",

                        status:
                            data.status || "Pending",

                        totalAmount:
                            Number(data.totalAmount) || 0,

                        items: items,

                    };

                });


            setReservations(reservationData);

        } catch (error) {

            console.error(
                "Error loading reservations:",
                error
            );

        } finally {

            setLoadingReservations(false);

        }
    };


    // =========================
    // APPROVE RESERVATION
    // =========================

    const approveReservation = async (
        reservationId: string
    ) => {

        try {

            const claimStubId =
                `CS-${Date.now()}`;


            await updateDoc(
                doc(
                    db,
                    "itemReservations",
                    reservationId
                ),
                {
                    status: "Approved",
                    claimStubId: claimStubId,
                }
            );


            await loadReservations();

        } catch (error) {

            console.error(
                "Error approving reservation:",
                error
            );

        }
    };


    // =========================
    // UPDATE PICKUP DATE
    // =========================

    const updatePickupDate = async (
        reservationId: string,
        newPickupDate: string
    ) => {

        try {

            await updateDoc(
                doc(
                    db,
                    "itemReservations",
                    reservationId
                ),
                {
                    pickupDate: newPickupDate,
                }
            );


            await loadReservations();

        } catch (error) {

            console.error(
                "Error updating pickup date:",
                error
            );

        }
    };


    // =========================
    // UPDATE PICKUP TIME
    // =========================

    const updatePickupTime = async (
        reservationId: string,
        newPickupTime: string
    ) => {

        try {

            await updateDoc(
                doc(
                    db,
                    "itemReservations",
                    reservationId
                ),
                {
                    pickupTime: newPickupTime,
                }
            );


            await loadReservations();

        } catch (error) {

            console.error(
                "Error updating pickup time:",
                error
            );

        }
    };


    // =========================
    // COMPLETE RESERVATION
    // =========================

    const completeReservation = async (
        reservationId: string
    ) => {

        try {

            await updateDoc(
                doc(
                    db,
                    "itemReservations",
                    reservationId
                ),
                {
                    status: "Claimed",
                }
            );


            await loadReservations();

        } catch (error) {

            console.error(
                "Error completing reservation:",
                error
            );

        }
    };


    // =========================
    // COUNT RESERVATIONS
    // =========================

    const pendingReservations =
        reservations.filter(
            (reservation) =>
                reservation.status.toLowerCase() ===
                "pending"
        );


    const approvedReservations =
        reservations.filter(
            (reservation) =>
                reservation.status.toLowerCase() ===
                "approved"
        );


    const claimedReservations =
        reservations.filter(
            (reservation) =>
                reservation.status.toLowerCase() ===
                "claimed"
        );


    // =========================
    // REPORTS DATA
    // =========================


    // CANCELLED RESERVATIONS

    const cancelledReservations =
        reservations.filter(
            (reservation) =>
                reservation.status.toLowerCase() ===
                "cancelled"
        );


    // =========================
    // TOTAL SALES
    // =========================

    const totalSales =
        claimedReservations.reduce(
            (total, reservation) =>
                total +
                Number(
                    reservation.totalAmount || 0
                ),
            0
        );


    // =========================
    // TOTAL ITEMS SOLD
    // =========================

    const totalItemsSold =
        claimedReservations.reduce(
            (total, reservation) =>
                total +
                reservation.items.reduce(
                    (itemTotal, item) =>
                        itemTotal +
                        Number(
                            item.quantity || 0
                        ),
                    0
                ),
            0
        );


    // =========================
    // AVERAGE TRANSACTION
    // =========================

    const averageTransaction =
        claimedReservations.length > 0
            ? totalSales /
              claimedReservations.length
            : 0;


    // =========================
    // TOTAL STOCK
    // =========================

    const totalStock =
        inventory.reduce(
            (total, item) =>
                total +
                Number(
                    item.totalStock || 0
                ),
            0
        );


    // =========================
    // AVAILABLE STOCK
    // =========================

    const totalAvailableStock =
        inventory.reduce(
            (total, item) =>
                total +
                Number(
                    item.availableOnline || 0
                ) +
                Number(
                    item.availableWalkIn || 0
                ),
            0
        );


    // =========================
    // RESERVED STOCK
    // =========================

    const totalReservedStock =
        inventory.reduce(
            (total, item) =>
                total +
                Number(
                    item.reservedQuantity || 0
                ),
            0
        );


    // =========================
    // LOW STOCK
    // =========================

    const lowStockItems =
        inventory.filter(
            (item) =>
                Number(
                    item.availableOnline || 0
                ) +
                Number(
                    item.availableWalkIn || 0
                ) <= 5
        );


    // =========================
    // TOP ITEMS
    // =========================

    const itemSales: {
        [key: string]: {
            itemName: string;
            quantity: number;
            sales: number;
        };
    } = {};


    claimedReservations.forEach(
        (reservation) => {

            reservation.items.forEach(
                (item) => {

                    if (
                        !itemSales[
                            item.itemName
                        ]
                    ) {

                        itemSales[
                            item.itemName
                        ] = {

                            itemName:
                                item.itemName,

                            quantity: 0,

                            sales: 0,

                        };

                    }


                    itemSales[
                        item.itemName
                    ].quantity +=
                        Number(
                            item.quantity || 0
                        );


                    itemSales[
                        item.itemName
                    ].sales +=
                        Number(
                            item.subtotal || 0
                        );

                }
            );

        }
    );


    const topItems =
        Object.values(itemSales)
            .sort(
                (a, b) =>
                    b.quantity -
                    a.quantity
            )
            .slice(0, 5);


    return (

        <div className="general-office-dashboard">


            {/* ========================= */}
            {/* SIDEBAR */}
            {/* ========================= */}

            <aside className="go-sidebar">

                <div className="go-menu-icon">
                    ☰
                </div>


                <nav className="go-navigation">


                    {/* DASHBOARD */}

                    <button
                        className={`go-nav-item ${
                            activePage === "Dashboard"
                                ? "active"
                                : ""
                        }`}
                        onClick={() =>
                            setActivePage("Dashboard")
                        }
                    >
                        <span>📊</span>
                        Dashboard
                    </button>


                    {/* INVENTORY */}

                    <button
                        className={`go-nav-item ${
                            activePage === "Inventory"
                                ? "active"
                                : ""
                        }`}
                        onClick={() =>
                            setActivePage("Inventory")
                        }
                    >
                        <span>📦</span>
                        Inventory
                    </button>


                    {/* REQUESTS */}

                    <button
                        className={`go-nav-item ${
                            activePage === "Requests"
                                ? "active"
                                : ""
                        }`}
                        onClick={() =>
                            setActivePage("Requests")
                        }
                    >
                        <span>📋</span>
                        Requests
                    </button>


                    {/* RESERVATIONS */}

                    <button
                        className={`go-nav-item ${
                            activePage === "Reservations"
                                ? "active"
                                : ""
                        }`}
                        onClick={() =>
                            setActivePage("Reservations")
                        }
                    >
                        <span>📝</span>
                        Reservations
                    </button>


                    {/* CLAIMING */}

                    <button
                        className={`go-nav-item ${
                            activePage === "Claiming"
                                ? "active"
                                : ""
                        }`}
                        onClick={() =>
                            setActivePage("Claiming")
                        }
                    >
                        <span>📦</span>
                        Claimed Items
                    </button>


                    {/* REPORTS */}

                    <button
                        className={`go-nav-item ${
                            activePage === "Reports"
                                ? "active"
                                : ""
                        }`}
                        onClick={() =>
                            setActivePage("Reports")
                        }
                    >
                        <span>📊</span>
                        Reports
                    </button>

                </nav>

            </aside>


            {/* ========================= */}
            {/* MAIN CONTENT */}
            {/* ========================= */}

            <main className="go-main">


                {/* ========================= */}
                {/* HEADER */}
                {/* ========================= */}

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
                            💬
                        </button>

                        <button className="go-header-button">
                            ⚙️
                        </button>

                    </div>

                </header>


                {/* ========================= */}
                {/* DASHBOARD PAGE */}
                {/* ========================= */}

                {activePage === "Dashboard" && (

                    <section className="go-content">


                        {/* SUMMARY CARDS */}

                        <div className="go-summary">


                            {/* PENDING RESERVATIONS */}

                            <div
                                className="go-summary-card"
                                onClick={() =>
                                    setActivePage("Requests")
                                }
                                style={{
                                    cursor: "pointer",
                                }}
                            >

                                <div className="go-card-icon purple">
                                    📝
                                </div>

                                <div>

                                    <p>
                                        Pending Reservations
                                    </p>

                                    <h2>
                                        {pendingReservations.length}
                                    </h2>

                                    <span>
                                        Needs review
                                    </span>

                                </div>

                            </div>


                            {/* APPROVED RESERVATIONS */}

                            <div
                                className="go-summary-card"
                                onClick={() =>
                                    setActivePage(
                                        "Reservations"
                                    )
                                }
                                style={{
                                    cursor: "pointer",
                                }}
                            >

                                <div className="go-card-icon green">
                                    ✓
                                </div>

                                <div>

                                    <p>
                                        Approved Reservations
                                    </p>

                                    <h2>
                                        {approvedReservations.length}
                                    </h2>

                                    <span>
                                        Ready for processing
                                    </span>

                                </div>

                            </div>


                            {/* CLAIMED ITEMS */}

                            <div
                                className="go-summary-card"
                                onClick={() =>
                                    setActivePage("Claiming")
                                }
                                style={{
                                    cursor: "pointer",
                                }}
                            >

                                <div className="go-card-icon blue">
                                    📦
                                </div>

                                <div>

                                    <p>
                                        Claimed Items
                                    </p>

                                    <h2>
                                        {claimedReservations.length}
                                    </h2>

                                    <span>
                                        Completed reservations
                                    </span>

                                </div>

                            </div>

                        </div>


                        {/* MAIN GRID */}

                        <div className="go-dashboard-grid">


                            {/* RECENT RESERVATIONS */}

                            <section className="go-panel reservations-panel">


                                <button
                                    className="go-action-card"
                                    onClick={() =>
                                        setActivePage(
                                            "Reservations"
                                        )
                                    }
                                >

                                    <span className="go-action-icon">
                                        📝
                                    </span>

                                    <div>

                                        <h3>
                                            Reservations
                                        </h3>

                                        <p>
                                            Review reservations
                                        </p>

                                    </div>

                                    <span className="go-arrow">
                                        →
                                    </span>

                                </button>


                                {/* SHOW REAL RESERVATIONS */}

                                {loadingReservations ? (

                                    <p className="inventory-message">
                                        Loading reservations...
                                    </p>

                                ) : reservations.length === 0 ? (

                                    <p className="inventory-message">
                                        No reservations found.
                                    </p>

                                ) : (

                                    reservations
                                        .slice(0, 4)
                                        .map((reservation) => (

                                            <div
                                                className="go-reservation"
                                                key={
                                                    reservation.id
                                                }
                                            >

                                                <div className="go-user-icon">
                                                    👤
                                                </div>


                                                <div className="go-reservation-info">

                                                    <h3>
                                                        {
                                                            reservation.fullName
                                                        }
                                                    </h3>

                                                    <p>

                                                        {
                                                            reservation.items
                                                                .map(
                                                                    (
                                                                        item
                                                                    ) =>
                                                                        item.itemName
                                                                )
                                                                .join(
                                                                    ", "
                                                                )
                                                        }

                                                    </p>

                                                </div>


                                                <span
                                                    className={`status ${reservation.status.toLowerCase()}`}
                                                >
                                                    {
                                                        reservation.status
                                                    }
                                                </span>

                                            </div>

                                        ))

                                )}

                            </section>


                            {/* INVENTORY STATUS */}

                            <section className="go-panel inventory-panel">


                                <button
                                    className="go-action-card"
                                    onClick={() =>
                                        setActivePage(
                                            "Inventory"
                                        )
                                    }
                                >

                                    <span className="go-action-icon">
                                        📦
                                    </span>

                                    <div>

                                        <h3>
                                            Inventory
                                        </h3>

                                        <p>
                                            Manage item stock
                                        </p>

                                    </div>

                                    <span className="go-arrow">
                                        →
                                    </span>

                                </button>


                                <div className="inventory-item">

                                    <div className="inventory-info">

                                        <h3>
                                            PE Uniform
                                        </h3>

                                        <p>
                                            870 total stock
                                        </p>

                                    </div>


                                    <div className="stock-bar">

                                        <div
                                            className="stock-progress"
                                            style={{
                                                width: "78%",
                                            }}
                                        ></div>

                                    </div>

                                    <span>
                                        78%
                                    </span>

                                </div>


                                <div className="inventory-item">

                                    <div className="inventory-info">

                                        <h3>
                                            School Uniform
                                        </h3>

                                        <p>
                                            2,300 total stock
                                        </p>

                                    </div>


                                    <div className="stock-bar">

                                        <div
                                            className="stock-progress"
                                            style={{
                                                width: "84%",
                                            }}
                                        ></div>

                                    </div>

                                    <span>
                                        84%
                                    </span>

                                </div>


                                <div className="inventory-item">

                                    <div className="inventory-info">

                                        <h3>
                                            ROTC Uniform
                                        </h3>

                                        <p>
                                            1,250 total stock
                                        </p>

                                    </div>


                                    <div className="stock-bar">

                                        <div
                                            className="stock-progress"
                                            style={{
                                                width: "70%",
                                            }}
                                        ></div>

                                    </div>

                                    <span>
                                        70%
                                    </span>

                                </div>


                                <div className="inventory-item">

                                    <div className="inventory-info">

                                        <h3>
                                            ID Lace
                                        </h3>

                                        <p>
                                            600 total stock
                                        </p>

                                    </div>


                                    <div className="stock-bar">

                                        <div
                                            className="stock-progress"
                                            style={{
                                                width: "60%",
                                            }}
                                        ></div>

                                    </div>

                                    <span>
                                        60%
                                    </span>

                                </div>

                            </section>

                        </div>

                    </section>

                )}


                {/* ========================= */}
                {/* INVENTORY PAGE */}
                {/* ========================= */}

                {activePage === "Inventory" && (

                    <section className="go-content">

                        <section className="go-panel inventory-page">


                            {/* INVENTORY HEADER */}

                            <div className="inventory-page-header">

                                <div>

                                    <h2>
                                        Inventory
                                    </h2>

                                    <p>
                                        View and manage available items.
                                    </p>

                                </div>


                                <button
                                    className="inventory-refresh-button"
                                    onClick={loadInventory}
                                >
                                    ↻ Refresh
                                </button>

                            </div>


                            {/* LOADING */}

                            {loadingInventory ? (

                                <p className="inventory-message">
                                    Loading inventory...
                                </p>

                            ) : inventory.length === 0 ? (

                                <p className="inventory-message">
                                    No inventory items found.
                                </p>

                            ) : (

                                <div className="inventory-table-container">

                                    <table className="inventory-table">

                                        <thead>

                                            <tr>

                                                <th>
                                                    Item
                                                </th>

                                                <th>
                                                    Size
                                                </th>

                                                <th>
                                                    Price
                                                </th>

                                                <th>
                                                    Total Stock
                                                </th>

                                                <th>
                                                    Online
                                                </th>

                                                <th>
                                                    Walk-in
                                                </th>

                                                <th>
                                                    Reserved
                                                </th>

                                                <th>
                                                    Available
                                                </th>

                                                <th>
                                                    Status
                                                </th>

                                            </tr>

                                        </thead>


                                        <tbody>

                                            {inventory.map(
                                                (item) => {

                                                    const totalAvailable =
                                                        item.availableOnline +
                                                        item.availableWalkIn;

                                                    return (

                                                        <tr
                                                            key={
                                                                item.id
                                                            }
                                                        >

                                                            <td>

                                                                <strong>
                                                                    {
                                                                        item.itemName
                                                                    }
                                                                </strong>

                                                            </td>


                                                            <td>
                                                                {
                                                                    item.size
                                                                }
                                                            </td>


                                                            <td>
                                                                ₱
                                                                {item.price.toLocaleString()}
                                                            </td>


                                                            <td>
                                                                {
                                                                    item.totalStock
                                                                }
                                                            </td>


                                                            <td>
                                                                {
                                                                    item.availableOnline
                                                                }
                                                            </td>


                                                            <td>
                                                                {
                                                                    item.availableWalkIn
                                                                }
                                                            </td>


                                                            <td>
                                                                {
                                                                    item.reservedQuantity
                                                                }
                                                            </td>


                                                            <td>
                                                                {
                                                                    totalAvailable
                                                                }
                                                            </td>


                                                            <td>

                                                                <span
                                                                    className={`inventory-status ${
                                                                        item.status
                                                                            .toLowerCase()
                                                                            .replace(
                                                                                /\s+/g,
                                                                                "-"
                                                                            )
                                                                    }`}
                                                                >

                                                                    {
                                                                        item.status
                                                                    }

                                                                </span>

                                                            </td>

                                                        </tr>

                                                    );

                                                }
                                            )}

                                        </tbody>

                                    </table>

                                </div>

                            )}

                        </section>

                    </section>

                )}


                {/* ========================= */}
                {/* REQUESTS PAGE */}
                {/* ========================= */}

                {activePage === "Requests" && (

                    <section className="go-content">

                        <section className="go-panel inventory-page">


                            <div className="inventory-page-header">

                                <div>

                                    <h2>
                                        Requests
                                    </h2>

                                    <p>
                                        Review pending item reservations.
                                    </p>

                                </div>


                                <button
                                    className="inventory-refresh-button"
                                    onClick={loadReservations}
                                >
                                    ↻ Refresh
                                </button>

                            </div>


                            {loadingReservations ? (

                                <p className="inventory-message">
                                    Loading requests...
                                </p>

                            ) : pendingReservations.length === 0 ? (

                                <p className="inventory-message">
                                    No pending requests found.
                                </p>

                            ) : (

                                <div className="inventory-table-container">

                                    <table className="inventory-table">

                                        <thead>

                                            <tr>

                                                <th>
                                                    Reservation ID
                                                </th>

                                                <th>
                                                    Student
                                                </th>

                                                <th>
                                                    Program
                                                </th>

                                                <th>
                                                    Items
                                                </th>

                                                <th>
                                                    Pickup Date
                                                </th>

                                                <th>
                                                    Pickup Time
                                                </th>

                                                <th>
                                                    Total
                                                </th>

                                                <th>
                                                    Status
                                                </th>

                                                <th>
                                                    Action
                                                </th>

                                            </tr>

                                        </thead>


                                        <tbody>

                                            {pendingReservations.map(
                                                (reservation) => (

                                                    <tr
                                                        key={
                                                            reservation.id
                                                        }
                                                    >

                                                        <td>

                                                            <strong>
                                                                {
                                                                    reservation.reservationId
                                                                }
                                                            </strong>

                                                        </td>


                                                        <td>

                                                            <strong>
                                                                {
                                                                    reservation.fullName
                                                                }
                                                            </strong>

                                                            <br />

                                                            <small>
                                                                {
                                                                    reservation.studentId
                                                                }
                                                            </small>

                                                        </td>


                                                        <td>

                                                            {
                                                                reservation.program.toUpperCase()
                                                            }

                                                        </td>


                                                        <td>

                                                            {reservation.items.map(
                                                                (
                                                                    item,
                                                                    index
                                                                ) => (

                                                                    <div
                                                                        key={
                                                                            index
                                                                        }
                                                                        style={{
                                                                            marginBottom:
                                                                                "6px",
                                                                        }}
                                                                    >

                                                                        <strong>
                                                                            {
                                                                                item.itemName
                                                                            }
                                                                        </strong>

                                                                        <br />

                                                                        <small>

                                                                            Size:{" "}
                                                                            {
                                                                                item.size
                                                                            }

                                                                            {" | "}

                                                                            Qty:{" "}
                                                                            {
                                                                                item.quantity
                                                                            }

                                                                        </small>

                                                                    </div>

                                                                )
                                                            )}

                                                        </td>


                                                        <td>
                                                            {
                                                                reservation.pickupDate
                                                            }
                                                        </td>


                                                        <td>
                                                            {
                                                                reservation.pickupTime
                                                            }
                                                        </td>


                                                        <td>

                                                            <strong>
                                                                ₱
                                                                {reservation.totalAmount.toLocaleString()}
                                                            </strong>

                                                        </td>


                                                        <td>

                                                            <span
                                                                className={`status ${reservation.status.toLowerCase()}`}
                                                            >
                                                                {
                                                                    reservation.status
                                                                }
                                                            </span>

                                                        </td>


                                                        <td>

                                                            <button
                                                                onClick={() =>
                                                                    approveReservation(
                                                                        reservation.id
                                                                    )
                                                                }
                                                            >
                                                                Approve
                                                            </button>

                                                        </td>

                                                    </tr>

                                                )
                                            )}

                                        </tbody>

                                    </table>

                                </div>

                            )}

                        </section>

                    </section>

                )}


                {/* ========================= */}
                {/* RESERVATIONS PAGE */}
                {/* ========================= */}

                {activePage === "Reservations" && (

                    <section className="go-content">

                        <section className="go-panel inventory-page">


                            {/* HEADER */}

                            <div className="inventory-page-header">

                                <div>

                                    <h2>
                                        Reservations
                                    </h2>

                                    <p>
                                        View and manage item reservations.
                                    </p>

                                </div>


                                <button
                                    className="inventory-refresh-button"
                                    onClick={loadReservations}
                                >
                                    ↻ Refresh
                                </button>

                            </div>


                            {/* LOADING */}

                            {loadingReservations ? (

                                <p className="inventory-message">
                                    Loading reservations...
                                </p>

                            ) : approvedReservations.length === 0 ? (

                                <p className="inventory-message">
                                    No approved reservations found.
                                </p>

                            ) : (

                                <div className="inventory-table-container">

                                    <table className="inventory-table">

                                        <thead>

                                            <tr>

                                                <th>
                                                    Reservation ID
                                                </th>

                                                <th>
                                                    Student
                                                </th>

                                                <th>
                                                    Mobile
                                                </th>

                                                <th>
                                                    Program
                                                </th>

                                                <th>
                                                    Items
                                                </th>

                                                <th>
                                                    Pickup
                                                </th>

                                                <th>
                                                    Claim Stub ID
                                                </th>

                                                <th>
                                                    Total
                                                </th>

                                                <th>
                                                    Status
                                                </th>

                                                <th>
                                                    Action
                                                </th>

                                            </tr>

                                        </thead>


                                        <tbody>


                                            {approvedReservations.map(
                                                (reservation) => (

                                                    <tr
                                                        key={
                                                            reservation.id
                                                        }
                                                    >

                                                        {/* RESERVATION ID */}

                                                        <td>

                                                            <strong>
                                                                {
                                                                    reservation.reservationId
                                                                }
                                                            </strong>

                                                        </td>


                                                        {/* STUDENT */}

                                                        <td>

                                                            <strong>
                                                                {
                                                                    reservation.fullName
                                                                }
                                                            </strong>

                                                            <br />

                                                            <small>
                                                                ID:{" "}
                                                                {
                                                                    reservation.studentId
                                                                }
                                                            </small>

                                                        </td>


                                                        {/* MOBILE */}

                                                        <td>
                                                            {
                                                                reservation.mobileNumber
                                                            }
                                                        </td>


                                                        {/* PROGRAM */}

                                                        <td>

                                                            {
                                                                reservation.program.toUpperCase()
                                                            }

                                                        </td>


                                                        {/* ITEMS */}

                                                        <td>

                                                            {reservation.items.map(
                                                                (
                                                                    item,
                                                                    index
                                                                ) => (

                                                                    <div
                                                                        key={
                                                                            index
                                                                        }
                                                                        style={{
                                                                            marginBottom:
                                                                                "8px",
                                                                        }}
                                                                    >

                                                                        <strong>
                                                                            {
                                                                                item.itemName
                                                                            }
                                                                        </strong>

                                                                        <br />

                                                                        <small>

                                                                            Size:{" "}
                                                                            {
                                                                                item.size
                                                                            }

                                                                            {" | "}

                                                                            Qty:{" "}
                                                                            {
                                                                                item.quantity
                                                                            }

                                                                            {" | "}

                                                                            ₱
                                                                            {item.subtotal.toLocaleString()}

                                                                        </small>

                                                                    </div>

                                                                )
                                                            )}

                                                        </td>


                                                        {/* PICKUP */}

                                                        <td>

                                                            {/* PICKUP DATE */}

                                                            <input
                                                                type="date"
                                                                value={
                                                                    reservation.pickupDate
                                                                }
                                                                onChange={(e) =>
                                                                    updatePickupDate(
                                                                        reservation.id,
                                                                        e.target.value
                                                                    )
                                                                }
                                                            />

                                                            <br />


                                                            {/* PICKUP TIME */}

                                                            <select
                                                                value={
                                                                    reservation.pickupTime
                                                                }
                                                                onChange={(e) =>
                                                                    updatePickupTime(
                                                                        reservation.id,
                                                                        e.target.value
                                                                    )
                                                                }
                                                            >

                                                                <option value="8:00AM - 10:00AM">
                                                                    8:00AM - 10:00AM
                                                                </option>

                                                                <option value="10:00AM - 12:00PM">
                                                                    10:00AM - 12:00PM
                                                                </option>

                                                                <option value="1:00PM - 3:00PM">
                                                                    1:00PM - 3:00PM
                                                                </option>

                                                                <option value="3:00PM - 5:00PM">
                                                                    3:00PM - 5:00PM
                                                                </option>

                                                            </select>

                                                        </td>


                                                        {/* CLAIM STUB ID */}

                                                        <td>

                                                            <strong>
                                                                {
                                                                    reservation.claimStubId
                                                                }
                                                            </strong>

                                                        </td>


                                                        {/* TOTAL */}

                                                        <td>

                                                            <strong>
                                                                ₱
                                                                {reservation.totalAmount.toLocaleString()}
                                                            </strong>

                                                        </td>


                                                        {/* STATUS */}

                                                        <td>

                                                            <span
                                                                className={`status ${reservation.status.toLowerCase()}`}
                                                            >
                                                                {
                                                                    reservation.status
                                                                }
                                                            </span>

                                                        </td>


                                                        {/* ACTION */}

                                                        <td>

                                                            <button
                                                                onClick={() =>
                                                                    completeReservation(
                                                                        reservation.id
                                                                    )
                                                                }
                                                            >
                                                                Complete
                                                            </button>

                                                        </td>

                                                    </tr>

                                                )
                                            )}

                                        </tbody>

                                    </table>

                                </div>

                            )}

                        </section>

                    </section>

                )}


                {/* ========================= */}
                {/* CLAIMED ITEMS PAGE */}
                {/* ========================= */}

                {activePage === "Claiming" && (

                    <section className="go-content">

                        <section className="go-panel inventory-page">


                            {/* HEADER */}

                            <div className="inventory-page-header">

                                <div>

                                    <h2>
                                        Claimed Items
                                    </h2>

                                    <p>
                                        View completed item reservations.
                                    </p>

                                </div>


                                <button
                                    className="inventory-refresh-button"
                                    onClick={loadReservations}
                                >
                                    ↻ Refresh
                                </button>

                            </div>


                            {/* LOADING */}

                            {loadingReservations ? (

                                <p className="inventory-message">
                                    Loading claimed items...
                                </p>

                            ) : claimedReservations.length === 0 ? (

                                <p className="inventory-message">
                                    No claimed items found.
                                </p>

                            ) : (

                                <div className="inventory-table-container">

                                    <table className="inventory-table">

                                        <thead>

                                            <tr>

                                                <th>
                                                    Reservation ID
                                                </th>

                                                <th>
                                                    Claim Stub ID
                                                </th>

                                                <th>
                                                    Student
                                                </th>

                                                <th>
                                                    Program
                                                </th>

                                                <th>
                                                    Items
                                                </th>

                                                <th>
                                                    Pickup Date
                                                </th>

                                                <th>
                                                    Total
                                                </th>

                                                <th>
                                                    Status
                                                </th>

                                            </tr>

                                        </thead>


                                        <tbody>

                                            {claimedReservations.map(
                                                (reservation) => (

                                                    <tr
                                                        key={
                                                            reservation.id
                                                        }
                                                    >

                                                        {/* RESERVATION ID */}

                                                        <td>

                                                            <strong>
                                                                {
                                                                    reservation.reservationId
                                                                }
                                                            </strong>

                                                        </td>


                                                        {/* CLAIM STUB ID */}

                                                        <td>

                                                            <strong>
                                                                {
                                                                    reservation.claimStubId
                                                                }
                                                            </strong>

                                                        </td>


                                                        {/* STUDENT */}

                                                        <td>

                                                            <strong>
                                                                {
                                                                    reservation.fullName
                                                                }
                                                            </strong>

                                                            <br />

                                                            <small>
                                                                ID:{" "}
                                                                {
                                                                    reservation.studentId
                                                                }
                                                            </small>

                                                        </td>


                                                        {/* PROGRAM */}

                                                        <td>
                                                            {
                                                                reservation.program.toUpperCase()
                                                            }
                                                        </td>


                                                        {/* ITEMS */}

                                                        <td>

                                                            {reservation.items.map(
                                                                (
                                                                    item,
                                                                    index
                                                                ) => (

                                                                    <div
                                                                        key={
                                                                            index
                                                                        }
                                                                        style={{
                                                                            marginBottom:
                                                                                "8px",
                                                                        }}
                                                                    >

                                                                        <strong>
                                                                            {
                                                                                item.itemName
                                                                            }
                                                                        </strong>

                                                                        <br />

                                                                        <small>

                                                                            Size:{" "}
                                                                            {
                                                                                item.size
                                                                            }

                                                                            {" | "}

                                                                            Qty:{" "}
                                                                            {
                                                                                item.quantity
                                                                            }

                                                                        </small>

                                                                    </div>

                                                                )
                                                            )}

                                                        </td>


                                                        {/* PICKUP DATE */}

                                                        <td>

                                                            <strong>
                                                                {
                                                                    reservation.pickupDate
                                                                }
                                                            </strong>

                                                            <br />

                                                            <small>
                                                                {
                                                                    reservation.pickupTime
                                                                }
                                                            </small>

                                                        </td>


                                                        {/* TOTAL */}

                                                        <td>

                                                            <strong>
                                                                ₱
                                                                {reservation.totalAmount.toLocaleString()}
                                                            </strong>

                                                        </td>


                                                        {/* STATUS */}

                                                        <td>

                                                            <span
                                                                className={`status ${reservation.status.toLowerCase()}`}
                                                            >
                                                                {
                                                                    reservation.status
                                                                }
                                                            </span>

                                                        </td>

                                                    </tr>

                                                )
                                            )}

                                        </tbody>

                                    </table>

                                </div>

                            )}

                        </section>

                    </section>

                )}


                {/* ========================= */}
                {/* REPORTS PAGE */}
                {/* ========================= */}

                {activePage === "Reports" && (

                    <section className="go-content">


                        {/* REPORT SUMMARY */}

                        <div className="go-summary">


                            {/* TOTAL SALES */}

                            <div className="go-summary-card">

                                <div className="go-card-icon green">
                                    ₱
                                </div>

                                <div>

                                    <p>
                                        Total Sales
                                    </p>

                                    <h2>
                                        ₱
                                        {totalSales.toLocaleString(
                                            undefined,
                                            {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            }
                                        )}
                                    </h2>

                                    <span>
                                        From claimed reservations
                                    </span>

                                </div>

                            </div>


                            {/* ITEMS SOLD */}

                            <div className="go-summary-card">

                                <div className="go-card-icon blue">
                                    📦
                                </div>

                                <div>

                                    <p>
                                        Items Sold
                                    </p>

                                    <h2>
                                        {totalItemsSold}
                                    </h2>

                                    <span>
                                        Successfully claimed
                                    </span>

                                </div>

                            </div>


                            {/* TOTAL RESERVATIONS */}

                            <div className="go-summary-card">

                                <div className="go-card-icon purple">
                                    📝
                                </div>

                                <div>

                                    <p>
                                        Total Reservations
                                    </p>

                                    <h2>
                                        {reservations.length}
                                    </h2>

                                    <span>
                                        All reservations
                                    </span>

                                </div>

                            </div>


                            {/* LOW STOCK */}

                            <div className="go-summary-card">

                                <div className="go-card-icon red">
                                    ⚠
                                </div>

                                <div>

                                    <p>
                                        Low Stock
                                    </p>

                                    <h2>
                                        {lowStockItems.length}
                                    </h2>

                                    <span>
                                        Needs attention
                                    </span>

                                </div>

                            </div>

                        </div>


                        {/* ========================= */}
                        {/* INVENTORY OVERVIEW */}
                        {/* ========================= */}

                        <section className="go-panel">

                            <div className="inventory-page-header">

                                <div>

                                    <h2>
                                        Inventory Overview
                                    </h2>

                                    <p>
                                        Current stock condition
                                        and availability.
                                    </p>

                                </div>

                            </div>


                            <div className="go-summary">


                                <div className="go-summary-card">

                                    <div className="go-card-icon blue">
                                        📦
                                    </div>

                                    <div>

                                        <p>
                                            Total Stock
                                        </p>

                                        <h2>
                                            {totalStock}
                                        </h2>

                                        <span>
                                            All inventory
                                        </span>

                                    </div>

                                </div>


                                <div className="go-summary-card">

                                    <div className="go-card-icon green">
                                        ✓
                                    </div>

                                    <div>

                                        <p>
                                            Available Stock
                                        </p>

                                        <h2>
                                            {totalAvailableStock}
                                        </h2>

                                        <span>
                                            Online + Walk-in
                                        </span>

                                    </div>

                                </div>


                                <div className="go-summary-card">

                                    <div className="go-card-icon purple">
                                        📝
                                    </div>

                                    <div>

                                        <p>
                                            Reserved Stock
                                        </p>

                                        <h2>
                                            {totalReservedStock}
                                        </h2>

                                        <span>
                                            Currently reserved
                                        </span>

                                    </div>

                                </div>


                                <div className="go-summary-card">

                                    <div className="go-card-icon green">
                                        ₱
                                    </div>

                                    <div>

                                        <p>
                                            Average Transaction
                                        </p>

                                        <h2>
                                            ₱
                                            {averageTransaction.toLocaleString(
                                                undefined,
                                                {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                }
                                            )}
                                        </h2>

                                        <span>
                                            Per claimed reservation
                                        </span>

                                    </div>

                                </div>

                            </div>

                        </section>


                        {/* ========================= */}
                        {/* RESERVATION STATUS */}
                        {/* ========================= */}

                        <section className="go-panel">

                            <div className="inventory-page-header">

                                <div>

                                    <h2>
                                        Reservation Status
                                    </h2>

                                    <p>
                                        Overview of reservation
                                        processing.
                                    </p>

                                </div>

                            </div>


                            <div className="inventory-table-container">

                                <table className="inventory-table">

                                    <thead>

                                        <tr>

                                            <th>
                                                Status
                                            </th>

                                            <th>
                                                Number of Reservations
                                            </th>

                                        </tr>

                                    </thead>


                                    <tbody>

                                        <tr>

                                            <td>
                                                Pending
                                            </td>

                                            <td>
                                                {pendingReservations.length}
                                            </td>

                                        </tr>


                                        <tr>

                                            <td>
                                                Approved
                                            </td>

                                            <td>
                                                {approvedReservations.length}
                                            </td>

                                        </tr>


                                        <tr>

                                            <td>
                                                Claimed
                                            </td>

                                            <td>
                                                {claimedReservations.length}
                                            </td>

                                        </tr>


                                        <tr>

                                            <td>
                                                Cancelled
                                            </td>

                                            <td>
                                                {cancelledReservations.length}
                                            </td>

                                        </tr>

                                    </tbody>

                                </table>

                            </div>

                        </section>


                        {/* ========================= */}
                        {/* TOP ITEMS */}
                        {/* ========================= */}

                        <section className="go-panel">

                            <div className="inventory-page-header">

                                <div>

                                    <h2>
                                        Top Items
                                    </h2>

                                    <p>
                                        Most sold items based
                                        on completed reservations.
                                    </p>

                                </div>

                            </div>


                            <div className="inventory-table-container">

                                <table className="inventory-table">

                                    <thead>

                                        <tr>

                                            <th>
                                                Rank
                                            </th>

                                            <th>
                                                Item
                                            </th>

                                            <th>
                                                Quantity Sold
                                            </th>

                                            <th>
                                                Sales
                                            </th>

                                        </tr>

                                    </thead>


                                    <tbody>

                                        {topItems.length === 0 ? (

                                            <tr>

                                                <td
                                                    colSpan={4}
                                                    style={{
                                                        textAlign:
                                                            "center",
                                                    }}
                                                >
                                                    No sales data yet.
                                                </td>

                                            </tr>

                                        ) : (

                                            topItems.map(
                                                (
                                                    item,
                                                    index
                                                ) => (

                                                    <tr
                                                        key={
                                                            item.itemName
                                                        }
                                                    >

                                                        <td>
                                                            {index + 1}
                                                        </td>

                                                        <td>

                                                            <strong>
                                                                {
                                                                    item.itemName
                                                                }
                                                            </strong>

                                                        </td>

                                                        <td>
                                                            {
                                                                item.quantity
                                                            }
                                                        </td>

                                                        <td>

                                                            ₱
                                                            {item.sales.toLocaleString(
                                                                undefined,
                                                                {
                                                                    minimumFractionDigits: 2,
                                                                    maximumFractionDigits: 2,
                                                                }
                                                            )}

                                                        </td>

                                                    </tr>

                                                )
                                            )

                                        )}

                                    </tbody>

                                </table>

                            </div>

                        </section>


                        {/* ========================= */}
                        {/* LOW STOCK ITEMS */}
                        {/* ========================= */}

                        <section className="go-panel">

                            <div className="inventory-page-header">

                                <div>

                                    <h2>
                                        Low Stock Items
                                    </h2>

                                    <p>
                                        Items with 5 or fewer
                                        available units.
                                    </p>

                                </div>

                            </div>


                            <div className="inventory-table-container">

                                <table className="inventory-table">

                                    <thead>

                                        <tr>

                                            <th>
                                                Item
                                            </th>

                                            <th>
                                                Size
                                            </th>

                                            <th>
                                                Total Stock
                                            </th>

                                            <th>
                                                Available
                                            </th>

                                            <th>
                                                Status
                                            </th>

                                        </tr>

                                    </thead>


                                    <tbody>

                                        {lowStockItems.length === 0 ? (

                                            <tr>

                                                <td
                                                    colSpan={5}
                                                    style={{
                                                        textAlign:
                                                            "center",
                                                    }}
                                                >
                                                    No low stock items.
                                                </td>

                                            </tr>

                                        ) : (

                                            lowStockItems.map(
                                                (item) => {

                                                    const available =
                                                        Number(
                                                            item.availableOnline ||
                                                            0
                                                        ) +
                                                        Number(
                                                            item.availableWalkIn ||
                                                            0
                                                        );

                                                    return (

                                                        <tr
                                                            key={
                                                                item.id
                                                            }
                                                        >

                                                            <td>

                                                                <strong>
                                                                    {
                                                                        item.itemName
                                                                    }
                                                                </strong>

                                                            </td>

                                                            <td>
                                                                {
                                                                    item.size
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    item.totalStock
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    available
                                                                }
                                                            </td>

                                                            <td>

                                                                <span className="inventory-status low-stock">
                                                                    Low Stock
                                                                </span>

                                                            </td>

                                                        </tr>

                                                    );

                                                }
                                            )

                                        )}

                                    </tbody>

                                </table>

                            </div>

                        </section>


                        {/* ========================= */}
                        {/* RECENT TRANSACTIONS */}
                        {/* ========================= */}

                        <section className="go-panel">

                            <div className="inventory-page-header">

                                <div>

                                    <h2>
                                        Recent Transactions
                                    </h2>

                                    <p>
                                        Recently completed item
                                        reservations.
                                    </p>

                                </div>

                            </div>


                            <div className="inventory-table-container">

                                <table className="inventory-table">

                                    <thead>

                                        <tr>

                                            <th>
                                                Reservation ID
                                            </th>

                                            <th>
                                                Student
                                            </th>

                                            <th>
                                                Items
                                            </th>

                                            <th>
                                                Amount
                                            </th>

                                            <th>
                                                Pickup Date
                                            </th>

                                            <th>
                                                Status
                                            </th>

                                        </tr>

                                    </thead>


                                    <tbody>

                                        {claimedReservations.length === 0 ? (

                                            <tr>

                                                <td
                                                    colSpan={6}
                                                    style={{
                                                        textAlign:
                                                            "center",
                                                    }}
                                                >
                                                    No completed
                                                    transactions yet.
                                                </td>

                                            </tr>

                                        ) : (

                                            claimedReservations
                                                .slice(0, 10)
                                                .map(
                                                    (
                                                        reservation
                                                    ) => (

                                                        <tr
                                                            key={
                                                                reservation.id
                                                            }
                                                        >

                                                            <td>

                                                                <strong>
                                                                    {
                                                                        reservation.reservationId
                                                                    }
                                                                </strong>

                                                            </td>

                                                            <td>
                                                                {
                                                                    reservation.fullName
                                                                }
                                                            </td>

                                                            <td>

                                                                {reservation.items
                                                                    .map(
                                                                        (
                                                                            item
                                                                        ) =>
                                                                            `${item.itemName} (${item.quantity})`
                                                                    )
                                                                    .join(
                                                                        ", "
                                                                    )}

                                                            </td>

                                                            <td>

                                                                <strong>

                                                                    ₱
                                                                    {Number(
                                                                        reservation.totalAmount ||
                                                                        0
                                                                    ).toLocaleString(
                                                                        undefined,
                                                                        {
                                                                            minimumFractionDigits: 2,
                                                                            maximumFractionDigits: 2,
                                                                        }
                                                                    )}

                                                                </strong>

                                                            </td>

                                                            <td>
                                                                {
                                                                    reservation.pickupDate
                                                                }
                                                            </td>

                                                            <td>

                                                                <span
                                                                    className={`status ${reservation.status.toLowerCase()}`}
                                                                >
                                                                    {
                                                                        reservation.status
                                                                    }
                                                                </span>

                                                            </td>

                                                        </tr>

                                                    )
                                                )

                                        )}

                                    </tbody>

                                </table>

                            </div>

                        </section>

                    </section>

                )}


                {/* ========================= */}
                {/* OTHER PAGES */}
                {/* ========================= */}

                {activePage !== "Dashboard" &&
                    activePage !== "Inventory" &&
                    activePage !== "Requests" &&
                    activePage !== "Reservations" &&
                    activePage !== "Claiming" &&
                    activePage !== "Reports" && (

                    <section className="go-content">

                        <section className="go-panel">

                            <h2>
                                {activePage}
                            </h2>

                            <p
                                style={{
                                    marginTop: "10px",
                                    color: "#71849a",
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