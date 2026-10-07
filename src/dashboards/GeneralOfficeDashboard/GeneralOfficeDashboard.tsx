import { useEffect, useState } from "react";
import "./GeneralOfficeDashboard.css";

import {
    collection,
    getDocs,
    doc,
    updateDoc,
    addDoc,
    serverTimestamp,
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
    purchaseType: "Walk-in" | "Online";
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
    cancellationReason?: string;
     createdAt: any;
    items: ReservationItem[];
};

type GeneralOfficeDashboardProps = {
    account: {
        name?: string;
        email?: string;
        role?: string;
    };
};

function GeneralOfficeDashboard({ account }: GeneralOfficeDashboardProps) {

    const [activePage, setActivePage] = useState("Dashboard");
 

const [requestSearch, setRequestSearch] = useState("");
const [reservationSearch, setReservationSearch] = useState("");
const [claimingSearch, setClaimingSearch] = useState("");

const [reportType, setReportType] =
    useState<"All" | "Online" | "Walk-in">("All");
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
    // ADD REQUEST MODAL STATE
    // =========================

    const [showAddRequestModal, setShowAddRequestModal] =
        useState(false);

    const [newRequest, setNewRequest] = useState({
        reservationId: "",
        claimStubId: "",
        fullName: "",
        studentId: "",
        mobileNumber: "",
        program: "",
        pickupDate: "",
        pickupTime: "8:00AM - 10:00AM",
        status: "Pending",
        totalAmount: 0,
        items: [] as ReservationItem[],
    });

    const [newRequestItem, setNewRequestItem] = useState<ReservationItem>({
        inventoryId: "",
        itemName: "",
        price: 0,
        quantity: 1,
        size: "",
        subtotal: 0,
        purchaseType: "Walk-in",
    });
    const [transactionFilter, setTransactionFilter] = useState("All");
const [transactionSearch, setTransactionSearch] = useState("");

    // =========================
    // EDIT STOCK MODAL
    // =========================

    const [showEditStockModal, setShowEditStockModal] =
        useState(false);

    const [selectedInventoryItem, setSelectedInventoryItem] =
        useState<InventoryItem | null>(null);

    const [editStock, setEditStock] = useState({
        price: 0,
        totalStock: 0,
        onlineStock: 0,
        walkInStock: 0,
        reservedQuantity: 0,
        availableOnline: 0,
        availableWalkIn: 0,
    });

    const openEditStockModal = (
        item: InventoryItem
    ) => {

        setSelectedInventoryItem(item);

        setEditStock({
            price:
                Number(item.price || 0),

            totalStock:
                Number(item.totalStock || 0),

            onlineStock:
                Number(item.onlineStock || 0),

            walkInStock:
                Number(item.walkInStock || 0),

            reservedQuantity:
                Number(item.reservedQuantity || 0),

            availableOnline:
                Number(item.availableOnline || 0),

            availableWalkIn:
                Number(item.availableWalkIn || 0),
        });

        setShowEditStockModal(true);
    };
    // =========================
    // SAVE EDITED STOCK
    // =========================

    const saveEditedStock = async () => {

        if (!selectedInventoryItem) {
            return;
        }


        if (
            editStock.price < 0 ||
            editStock.totalStock < 0 ||
            editStock.onlineStock < 0 ||
            editStock.walkInStock < 0 ||
            editStock.reservedQuantity < 0 ||
            editStock.availableOnline < 0 ||
            editStock.availableWalkIn < 0
        ) {
            alert(
                "Stock values cannot be negative."
            );
            return;
        }


        try {

            await updateDoc(
                doc(
                    db,
                    "inventory",
                    selectedInventoryItem.id
                ),
                {
                    price:
                        Number(editStock.price),

                    totalStock:
                        editStock.totalStock,

                    onlineStock:
                        editStock.onlineStock,

                    walkInStock:
                        editStock.walkInStock,

                    reservedQuantity:
                        editStock.reservedQuantity,

                    availableOnline:
                        editStock.availableOnline,

                    availableWalkIn:
                        editStock.availableWalkIn,
                }
            );


            setShowEditStockModal(false);

            setSelectedInventoryItem(null);


            await loadInventory();


        } catch (error) {

            console.error(
                "Error updating stock:",
                error
            );

            alert(
                "Failed to update stock."
            );
        }
    };


    // =========================
    // LOAD INVENTORY
    // =========================

    useEffect(() => {

        if (
            activePage === "Inventory" ||
            activePage === "Requests" ||
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
             activePage === "Transactions" ||
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

                                purchaseType:
                                    item.purchaseType === "Walk-in"
                                        ? "Walk-in"
                                        : "Online",

                            }))
                            : [];


                   return {
    id: document.id,

    reservationId:
        data.reservationId || document.id,

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

    createdAt:
        data.createdAt || null,

cancellationReason: data.cancellationReason || "",

    items: items,
};

                });


            reservationData.sort((a, b) => {

    const dateA =
        a.createdAt?.toMillis
            ? a.createdAt.toMillis()
            : 0;

    const dateB =
        b.createdAt?.toMillis
            ? b.createdAt.toMillis()
            : 0;

    return dateB - dateA;
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

        // Find the reservation
        const reservation =
            reservations.find(
                (item) =>
                    item.id === reservationId
            );

        if (!reservation) {
            console.error(
                "Reservation not found."
            );
            return;
        }


        // Prevent adding reserved quantity twice
        if (
            reservation.status.toLowerCase() !==
            "pending"
        ) {
            console.error(
                "This reservation has already been processed."
            );
            return;
        }


        // =========================
        // UPDATE INVENTORY RESERVED QUANTITY
        // =========================

        for (
            const reservedItem of
            reservation.items
        ) {

            if (!reservedItem.inventoryId) {
                continue;
            }


            const inventoryItem =
                inventory.find(
                    (item) =>
                        item.id ===
                        reservedItem.inventoryId
                );


            if (!inventoryItem) {
                console.error(
                    `Inventory item not found: ${reservedItem.inventoryId}`
                );
                continue;
            }


            const currentReserved =
                Number(
                    inventoryItem.reservedQuantity ||
                    0
                );


            const quantityToReserve =
                Number(
                    reservedItem.quantity ||
                    0
                );


            const newReservedQuantity =
                currentReserved +
                quantityToReserve;


            // Update the inventory document
            await updateDoc(
                doc(
                    db,
                    "inventory",
                    reservedItem.inventoryId
                ),
                {
                    reservedQuantity:
                        newReservedQuantity,
                }
            );

        }


        // =========================
        // CREATE CLAIM STUB
        // =========================

        const claimStubId =
            `CS-${Date.now()}`;


        // =========================
        // UPDATE RESERVATION
        // =========================

        await updateDoc(
            doc(
                db,
                "itemReservations",
                reservationId
            ),
            {
                status: "Approved",
                claimStubId:
                    claimStubId,
            }
        );


        // Reload both
        // reservation and inventory data
        await loadReservations();
        await loadInventory();


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


   const cancelReservation = async () => {
    if (!selectedReservationForCancel) {
        return;
    }

    if (!cancellationReason.trim()) {
        alert("Please enter a cancellation reason.");
        return;
    }

    try {
        await updateDoc(
            doc(
                db,
                "itemReservations",
                selectedReservationForCancel.id
            ),
            {
                status: "Cancelled",
                cancellationReason:
                    cancellationReason.trim(),
            }
        );

        alert("Reservation cancelled successfully.");

        setShowCancelModal(false);
        setSelectedReservationForCancel(null);
        setCancellationReason("");

        loadReservations();
    } catch (error) {
        console.error(
            "Error cancelling reservation:",
            error
        );

        alert("Failed to cancel reservation.");
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
    // COMPLETE / CLAIM RESERVATION
    // =========================

    const completeReservation = async (
        reservationId: string
    ) => {

        try {

            const reservation =
                reservations.find(
                    (item) =>
                        item.id === reservationId
                );

            if (!reservation) {
                console.error(
                    "Reservation not found."
                );
                return;
            }

            if (
                reservation.status.toLowerCase() !==
                "approved"
            ) {
                console.error(
                    "Only approved reservations can be claimed."
                );
                return;
            }

            // =========================
            // UPDATE INVENTORY BY PURCHASE TYPE
            // =========================

            for (const claimedItem of reservation.items) {

                if (!claimedItem.inventoryId) {
                    continue;
                }

                const inventoryItem =
                    inventory.find(
                        (item) =>
                            item.id ===
                            claimedItem.inventoryId
                    );

                if (!inventoryItem) {
                    console.error(
                        `Inventory item not found: ${claimedItem.inventoryId}`
                    );
                    continue;
                }

                const quantityBought =
                    Number(claimedItem.quantity || 0);

                if (quantityBought <= 0) {
                    continue;
                }

                const purchaseType =
                    claimedItem.purchaseType === "Walk-in"
                        ? "Walk-in"
                        : "Online";

                const currentTotalStock =
                    Number(inventoryItem.totalStock || 0);

                const currentReservedQuantity =
                    Number(inventoryItem.reservedQuantity || 0);

                if (currentReservedQuantity < quantityBought) {
                    console.error(
                        `Reserved quantity is not enough for ${claimedItem.itemName}.`
                    );
                    continue;
                }

                // Deduct from the stock source actually used.
                const currentOnlineStock =
                    Number(inventoryItem.onlineStock || 0);

                const currentWalkInStock =
                    Number(inventoryItem.walkInStock || 0);

                const currentAvailableOnline =
                    Number(inventoryItem.availableOnline || 0);

                const currentAvailableWalkIn =
                    Number(inventoryItem.availableWalkIn || 0);

                if (purchaseType === "Online") {

                    if (currentAvailableOnline < quantityBought) {
                        console.error(
                            `Not enough online stock for ${claimedItem.itemName}.`
                        );
                        continue;
                    }

                    await updateDoc(
                        doc(
                            db,
                            "inventory",
                            claimedItem.inventoryId
                        ),
                        {
                            totalStock:
                                Math.max(
                                    0,
                                    currentTotalStock -
                                        quantityBought
                                ),

                            onlineStock:
                                Math.max(
                                    0,
                                    currentOnlineStock -
                                        quantityBought
                                ),

                            availableOnline:
                                Math.max(
                                    0,
                                    currentAvailableOnline -
                                        quantityBought
                                ),

                            reservedQuantity:
                                Math.max(
                                    0,
                                    currentReservedQuantity -
                                        quantityBought
                                ),
                        }
                    );

                } else {

                    if (currentAvailableWalkIn < quantityBought) {
                        console.error(
                            `Not enough walk-in stock for ${claimedItem.itemName}.`
                        );
                        continue;
                    }

                    await updateDoc(
                        doc(
                            db,
                            "inventory",
                            claimedItem.inventoryId
                        ),
                        {
                            totalStock:
                                Math.max(
                                    0,
                                    currentTotalStock -
                                        quantityBought
                                ),

                            walkInStock:
                                Math.max(
                                    0,
                                    currentWalkInStock -
                                        quantityBought
                                ),

                            availableWalkIn:
                                Math.max(
                                    0,
                                    currentAvailableWalkIn -
                                        quantityBought
                                ),

                            reservedQuantity:
                                Math.max(
                                    0,
                                    currentReservedQuantity -
                                        quantityBought
                                ),
                        }
                    );
                }
            }

            // =========================
            // UPDATE RESERVATION
            // =========================

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
            await loadInventory();

        } catch (error) {

            console.error(
                "Error completing reservation:",
                error
            );
        }
    };


    // =========================
    // ADD REQUEST ITEM
    // =========================

    const addRequestItem = () => {

        if (
            !newRequestItem.inventoryId ||
            !newRequestItem.itemName ||
            !newRequestItem.size ||
            !newRequestItem.purchaseType ||
            newRequestItem.quantity <= 0
        ) {
            alert("Please complete the item details.");
            return;
        }

        const subtotal =
            Number(newRequestItem.price || 0) *
            Number(newRequestItem.quantity || 0);

        const itemToAdd: ReservationItem = {
            ...newRequestItem,
            price: Number(newRequestItem.price || 0),
            quantity: Number(newRequestItem.quantity || 0),
            subtotal: subtotal,
            purchaseType: newRequestItem.purchaseType,
        };

        setNewRequest((previous) => ({
            ...previous,
            items: [...previous.items, itemToAdd],
            totalAmount:
                previous.totalAmount + subtotal,
        }));

        setNewRequestItem({
            inventoryId: "",
            itemName: "",
            price: 0,
            quantity: 1,
            size: "",
            subtotal: 0,
            purchaseType: "Online",
        });
    };


    // =========================
    // REMOVE REQUEST ITEM
    // =========================

    const removeRequestItem = (index: number) => {

        setNewRequest((previous) => {

            const itemToRemove =
                previous.items[index];

            const updatedItems =
                previous.items.filter(
                    (_, itemIndex) =>
                        itemIndex !== index
                );

            return {
                ...previous,
                items: updatedItems,
                totalAmount:
                    previous.totalAmount -
                    Number(
                        itemToRemove?.subtotal || 0
                    ),
            };

        });
    };


    // =========================
    // CREATE NEW REQUEST
    // =========================

    const addNewRequest = async () => {

        if (
            !newRequest.fullName.trim() ||
            !newRequest.studentId.trim() ||
            !newRequest.mobileNumber.trim() ||
            !newRequest.program.trim() ||
            !newRequest.pickupDate ||
            !newRequest.pickupTime ||
            newRequest.items.length === 0
        ) {
            alert(
                "Please complete all required fields and add at least one item."
            );
            return;
        }

        try {

            const reservationId =
                newRequest.reservationId.trim() ||
                `IR-${Date.now()}`;

            await addDoc(
                collection(db, "itemReservations"),
                {
                    reservationId:
                        reservationId,

                    claimStubId:
                        newRequest.claimStubId.trim(),

                    fullName:
                        newRequest.fullName.trim(),

                    studentId:
                        newRequest.studentId.trim(),

                    mobileNumber:
                        newRequest.mobileNumber.trim(),

                    program:
                        newRequest.program.trim(),

                    pickupDate:
                        newRequest.pickupDate,

                    pickupTime:
                        newRequest.pickupTime,

                    status:
                        newRequest.status || "Pending",

                    totalAmount:
                        Number(
                            newRequest.totalAmount || 0
                        ),

                    items:
                        newRequest.items.map(
                            (item) => ({
                                inventoryId:
                                    item.inventoryId,

                                itemName:
                                    item.itemName,

                                price:
                                    Number(
                                        item.price || 0
                                    ),

                                quantity:
                                    Number(
                                        item.quantity || 0
                                    ),

                                size:
                                    item.size,

                                subtotal:
                                    Number(
                                        item.subtotal || 0
                                    ),

                                purchaseType:
                                    item.purchaseType || "Online",
                            })
                        ),

                    createdAt:
                        serverTimestamp(),
                }
            );

            alert(
                "New request added successfully."
            );

            setShowAddRequestModal(false);

            setNewRequest({
                reservationId: "",
                claimStubId: "",
                fullName: "",
                studentId: "",
                mobileNumber: "",
                program: "",
                pickupDate: "",
                pickupTime:
                    "8:00AM - 10:00AM",
                status: "Pending",
                totalAmount: 0,
                items: [],
            });

            setNewRequestItem({
                inventoryId: "",
                itemName: "",
                price: 0,
                quantity: 1,
                size: "",
                subtotal: 0,
                purchaseType: "Online",
            });

            await loadReservations();

        } catch (error) {

            console.error(
                "Error adding new request:",
                error
            );

            alert(
                "Failed to add request. Please try again."
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

    
        const [showCancelModal, setShowCancelModal] = useState(false);
const [selectedReservationForCancel, setSelectedReservationForCancel] =
    useState<ItemReservation | null>(null);
const [cancellationReason, setCancellationReason] = useState("");
    // =========================
    // REPORTS DATA
    // =========================

// =========================
// REPORT FILTER HELPERS
// =========================

const itemMatchesReport = (item: ReservationItem) =>
    reportType === "All" || item.purchaseType === reportType;

const reservationMatchesReport = (reservation: ItemReservation) =>
    reservation.items.some(itemMatchesReport);

const getReportItems = (reservation: ItemReservation) =>
    reservation.items.filter(itemMatchesReport);

const getReportAmount = (reservation: ItemReservation) =>
    getReportItems(reservation).reduce(
        (total, item) => total + Number(item.subtotal || 0),
        0
    );

const getTypeStats = (type: "All" | "Online" | "Walk-in") => {

    const matches = (item: ReservationItem) =>
        type === "All" || item.purchaseType === type;

    const matchingReservations = claimedReservations.filter(
        (reservation) => reservation.items.some(matches)
    );

    const sales = matchingReservations.reduce(
        (total, reservation) =>
            total +
            reservation.items
                .filter(matches)
                .reduce(
                    (sum, item) => sum + Number(item.subtotal || 0),
                    0
                ),
        0
    );

    const quantity = matchingReservations.reduce(
        (total, reservation) =>
            total +
            reservation.items
                .filter(matches)
                .reduce(
                    (sum, item) => sum + Number(item.quantity || 0),
                    0
                ),
        0
    );

    return {
        transactions: matchingReservations.length,
        sales,
        quantity,
        average:
            matchingReservations.length > 0
                ? sales / matchingReservations.length
                : 0,
    };
};

// =========================
// REPORT STATISTICS
// =========================

const currentStats = getTypeStats(reportType);

const totalSales = currentStats.sales;
const totalItemsSold = currentStats.quantity;
const averageTransaction = currentStats.average;

const reportAllReservations =
    reservations.filter(reservationMatchesReport);

const reportPending =
    pendingReservations.filter(reservationMatchesReport);

const reportApproved =
    approvedReservations.filter(reservationMatchesReport);

const reportClaimed =
    claimedReservations.filter(reservationMatchesReport);

const reportCancelled =
    reservations
        .filter(
            (reservation) =>
                reservation.status.toLowerCase() === "cancelled"
        )
        .filter(reservationMatchesReport);

// =========================
// REPORT INVENTORY
// =========================

const getAvailable = (item: InventoryItem) => {

    if (reportType === "Online") {
        return Number(item.availableOnline || 0);
    }

    if (reportType === "Walk-in") {
        return Number(item.availableWalkIn || 0);
    }

    return (
        Number(item.availableOnline || 0) +
        Number(item.availableWalkIn || 0)
    );
};

const totalStock = inventory.reduce((total, item) => {

    if (reportType === "Online") {
        return total + Number(item.onlineStock || 0);
    }

    if (reportType === "Walk-in") {
        return total + Number(item.walkInStock || 0);
    }

    return total + Number(item.totalStock || 0);

}, 0);

const totalAvailableStock = inventory.reduce(
    (total, item) => total + getAvailable(item),
    0
);

// Online / Walk-in reserved is worked out from approved
// reservations because inventory stores one combined number.
const totalReservedStock =
    reportType === "All"
        ? inventory.reduce(
              (total, item) =>
                  total + Number(item.reservedQuantity || 0),
              0
          )
        : approvedReservations.reduce(
              (total, reservation) =>
                  total +
                  getReportItems(reservation).reduce(
                      (sum, item) =>
                          sum + Number(item.quantity || 0),
                      0
                  ),
              0
          );

const lowStockItems = inventory.filter(
    (item) => getAvailable(item) <= 5
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

reportClaimed.forEach((reservation) => {

    getReportItems(reservation).forEach((item) => {

        if (!itemSales[item.itemName]) {
            itemSales[item.itemName] = {
                itemName: item.itemName,
                quantity: 0,
                sales: 0,
            };
        }

        itemSales[item.itemName].quantity +=
            Number(item.quantity || 0);

        itemSales[item.itemName].sales +=
            Number(item.subtotal || 0);
    });
});

const topItems =
    Object.values(itemSales)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

            const matchesReservationSearch = (
    reservation: ItemReservation,
    searchText: string
) => {

    const search = searchText.trim().toLowerCase();

    if (!search) {
        return true;
    }

    return (
        reservation.reservationId.toLowerCase().includes(search) ||
        reservation.claimStubId.toLowerCase().includes(search) ||
        reservation.fullName.toLowerCase().includes(search) ||
        reservation.studentId.toLowerCase().includes(search) ||
        reservation.mobileNumber.toLowerCase().includes(search) ||
        reservation.program.toLowerCase().includes(search) ||
        reservation.items.some((item) =>
            item.itemName.toLowerCase().includes(search)
        )
    );
};

const filteredPending = pendingReservations.filter((reservation) =>
    matchesReservationSearch(reservation, requestSearch)
);

const filteredApproved = approvedReservations.filter((reservation) =>
    matchesReservationSearch(reservation, reservationSearch)
);

const filteredClaimed = claimedReservations.filter((reservation) =>
    matchesReservationSearch(reservation, claimingSearch)
);
const filteredTransactions = reservations.filter((reservation) => {

    const matchesStatus =
        transactionFilter === "All" ||
        reservation.status.toLowerCase() ===
            transactionFilter.toLowerCase();

    const search = transactionSearch.trim().toLowerCase();

    const matchesSearch =
        !search ||
        reservation.reservationId.toLowerCase().includes(search) ||
        reservation.claimStubId.toLowerCase().includes(search) ||
        reservation.fullName.toLowerCase().includes(search) ||
        reservation.studentId.toLowerCase().includes(search);

    return matchesStatus && matchesSearch;
});

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

{/* TRANSACTIONS */}

<button
    className={`go-nav-item ${
        activePage === "Transactions" ? "active" : ""
    }`}
    onClick={() => setActivePage("Transactions")}
>
    <span>💳</span>
    Transactions
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
        ? `Welcome, ${account.name || "General Office"}.`
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
                                                
                                                <th>
                                                    Action
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
                                                            <td>
                                                                <button
    className="inventory-action-button"
    onClick={() =>
        openEditStockModal(item)
    }
>
    Edit Stock
</button>
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


                                <div
                                    style={{
                                        display: "flex",
                                        gap: "10px",
                                        alignItems: "center",
                                    }}
                                > <input
    type="text"
    placeholder="Search name, ID, item..."
    value={requestSearch}
    onChange={(e) => setRequestSearch(e.target.value)}
    style={{ padding: "8px" }}
/>

                                    <button
                                        className="inventory-refresh-button"
                                        onClick={() =>
                                            setShowAddRequestModal(true)
                                        }
                                    >
                                        + Add Request
                                    </button>

                                    <button
                                        className="inventory-refresh-button"
                                        onClick={loadReservations}
                                    >
                                        ↻ Refresh
                                    </button>

                                </div>

                            </div>


                            {loadingReservations ? (

                                <p className="inventory-message">
                                    Loading requests...
                                </p>

                            ) : filteredPending.length === 0 ? (

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

                                            {filteredPending.map(
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

                                                         <div style={{ display: "flex", gap: "8px" }}>
    <button
        onClick={() => approveReservation(reservation.id)}
    >
        Approve
    </button>

    <button
   
    onClick={() => {
        setSelectedReservationForCancel(reservation);
        setCancellationReason("");
        setShowCancelModal(true);
    }}
>

        Cancel
    </button>
</div>
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


                              <div
    style={{
        display: "flex",
        gap: "10px",
        alignItems: "center",
    }}
>
    <input
        type="text"
        placeholder="Search name, ID, stub, item..."
        value={reservationSearch}
        onChange={(e) => setReservationSearch(e.target.value)}
        style={{ padding: "8px" }}
    />

    <button
        className="inventory-refresh-button"
        onClick={loadReservations}
    >
        ↻ Refresh
    </button>
</div>

                            </div>


                            {/* LOADING */}

                            {loadingReservations ? (

                                <p className="inventory-message">
                                    Loading reservations...
                                </p>

                            )  : filteredApproved.length === 0 ? (

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


                                           {filteredApproved.map(
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
  <div style={{ display: "flex", gap: "8px" }}>
 
                                                            <button
                                                                onClick={() =>
                                                                    completeReservation(
                                                                        reservation.id
                                                                    )
                                                                }
                                                            >
                                                                Complete
                                                            </button>
                                                             <button
    onClick={() => {
        setSelectedReservationForCancel(reservation);
        setCancellationReason("");
        setShowCancelModal(true);
    }}
>
    Cancel
</button>
</div>

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


                            <div
    style={{
        display: "flex",
        gap: "10px",
        alignItems: "center",
    }}
>
    <input
        type="text"
        placeholder="Search name, ID, stub, item..."
        value={claimingSearch}
        onChange={(e) => setClaimingSearch(e.target.value)}
        style={{ padding: "8px" }}
    />

    <button
        className="inventory-refresh-button"
        onClick={loadReservations}
    >
        ↻ Refresh
    </button>
</div>

                            </div>


                            {/* LOADING */}

                            {loadingReservations ? (

                                <p className="inventory-message">
                                    Loading claimed items...
                                </p>

                           ) : filteredClaimed.length === 0 ? (

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

                                            {filteredClaimed.map(
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
{/* REPORT TYPE FILTER */}

<section className="go-panel">

    <div className="inventory-page-header">

        <div>
            <h2>Report Type</h2>
            <p>
                Showing:{" "}
                <strong>
                    {reportType === "All"
                        ? "Combined (Online + Walk-in)"
                        : reportType}
                </strong>
            </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
            {(["All", "Online", "Walk-in"] as const).map((type) => (
                <button
                    key={type}
                    className="inventory-refresh-button"
                    onClick={() => setReportType(type)}
                    style={{
                        fontWeight: reportType === type ? 700 : 400,
                        outline:
                            reportType === type
                                ? "2px solid #4f46e5"
                                : "none",
                    }}
                >
                    {type === "All" ? "Combined" : type}
                </button>
            ))}
        </div>

    </div>

    <div className="inventory-table-container">

        <table className="inventory-table">

            <thead>
                <tr>
                    <th>Type</th>
                    <th>Claimed Transactions</th>
                    <th>Items Sold</th>
                    <th>Total Sales</th>
                    <th>Average Transaction</th>
                </tr>
            </thead>

            <tbody>

                {(["Online", "Walk-in", "All"] as const).map((type) => {

                    const stats = getTypeStats(type);

                    return (
                        <tr key={type}>
                            <td>
                                <strong>
                                    {type === "All" ? "Combined" : type}
                                </strong>
                            </td>
                            <td>{stats.transactions}</td>
                            <td>{stats.quantity}</td>
                            <td>
                                ₱
                                {stats.sales.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </td>
                            <td>
                                ₱
                                {stats.average.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </td>
                        </tr>
                    );
                })}

            </tbody>

        </table>

    </div>

</section>

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
                                        {reportAllReservations.length}
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
                                               {reportPending.length}
                                            </td>

                                        </tr>


                                        <tr>

                                            <td>
                                                Approved
                                            </td>

                                            <td>
                                                {reportApproved.length}
                                            </td>

                                        </tr>


                                        <tr>

                                            <td>
                                                Claimed
                                            </td>

                                            <td>
                                                {reportClaimed.length}
                                            </td>

                                        </tr>


                                        <tr>

                                            <td>
                                                Cancelled
                                            </td>

                                            <td>
                                                {reportCancelled.length}
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

                                                   const available = getAvailable(item);
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

                                      {reportClaimed.length === 0 ? (
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

                                           reportClaimed
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

                                                              {getReportItems(reservation)
    .map((item) => `${item.itemName} (${item.quantity})`)
    .join(", ")}

                                                            </td>

                                                            <td>

                                                                <strong>

                                                                  ₱
{getReportAmount(reservation).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})}

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
{/* TRANSACTIONS PAGE */}
{/* ========================= */}

{activePage === "Transactions" && (

    <section className="go-content">

        <section className="go-panel inventory-page">

            <div className="inventory-page-header">

                <div>
                    <h2>Transactions</h2>
                    <p>View all reservation transactions.</p>
                </div>

                <div
                    style={{
                        display: "flex",
                        gap: "10px",
                        alignItems: "center",
                    }}
                >
                    <input
                        type="text"
                        placeholder="Search name, ID, stub..."
                        value={transactionSearch}
                        onChange={(e) =>
                            setTransactionSearch(e.target.value)
                        }
                        style={{ padding: "8px" }}
                    />

                    <select
                        value={transactionFilter}
                        onChange={(e) =>
                            setTransactionFilter(e.target.value)
                        }
                        style={{ padding: "8px" }}
                    >
                        <option value="All">All</option>
                        <option value="Pending">Pending</option>
                        <option value="Approved">Approved</option>
                        <option value="Claimed">Claimed</option>
                        <option value="Cancelled">Cancelled</option>
                    </select>

                    <button
                        className="inventory-refresh-button"
                        onClick={loadReservations}
                    >
                        ↻ Refresh
                    </button>
                </div>

            </div>

            {loadingReservations ? (

                <p className="inventory-message">
                    Loading transactions...
                </p>

            ) : filteredTransactions.length === 0 ? (

                <p className="inventory-message">
                    No transactions found.
                </p>

            ) : (

                <div className="inventory-table-container">

                    <table className="inventory-table">

                        <thead>
                            <tr>
                                <th>Reservation ID</th>
                                <th>Claim Stub ID</th>
                                <th>Student</th>
                                <th>Items</th>
                                <th>Pickup</th>
                                <th>Total</th>
                                <th>Status</th>
                                <th>Note</th>
                            </tr>
                        </thead>

                        <tbody>

                            {filteredTransactions.map((reservation) => (

                                <tr key={reservation.id}>

                                    <td>
                                        <strong>
                                            {reservation.reservationId}
                                        </strong>
                                    </td>

                                    <td>
                                        {reservation.claimStubId || "—"}
                                    </td>

                                    <td>
                                        <strong>
                                            {reservation.fullName}
                                        </strong>
                                        <br />
                                        <small>
                                            ID: {reservation.studentId}
                                        </small>
                                    </td>

                                    <td>
                                        {reservation.items.map(
                                            (item, index) => (
                                                <div
                                                    key={index}
                                                    style={{
                                                        marginBottom: "6px",
                                                    }}
                                                >
                                                    <strong>
                                                        {item.itemName}
                                                    </strong>
                                                    <br />
                                                    <small>
                                                        Size: {item.size}
                                                        {" | "}
                                                        Qty: {item.quantity}
                                                        {" | "}
                                                        {item.purchaseType}
                                                    </small>
                                                </div>
                                            )
                                        )}
                                    </td>

                                    <td>
                                        <strong>
                                            {reservation.pickupDate}
                                        </strong>
                                        <br />
                                        <small>
                                            {reservation.pickupTime}
                                        </small>
                                    </td>

                                    <td>
                                        <strong>
                                            ₱
                                            {reservation.totalAmount.toLocaleString(
                                                undefined,
                                                {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                }
                                            )}
                                        </strong>
                                    </td>

                                    <td>
                                        <span
                                            className={`status ${reservation.status.toLowerCase()}`}
                                        >
                                            {reservation.status}
                                        </span>
                                    </td>

                                    <td>
                                        {reservation.status.toLowerCase() ===
                                        "cancelled"
                                            ? reservation.cancellationReason ||
                                              "—"
                                            : "—"}
                                    </td>

                                </tr>

                            ))}

                        </tbody>

                    </table>

                </div>

            )}

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
                    activePage !== "Reports" && 
                    activePage !== "Transactions" && (

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

                {/* ========================= */}
                {/* ADD REQUEST MODAL */}
                {/* ========================= */}

                {showAddRequestModal && (

                    <div
                        style={{
                            position: "fixed",
                            inset: 0,
                            backgroundColor:
                                "rgba(0, 0, 0, 0.45)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 1000,
                            padding: "20px",
                        }}
                    >

                        <div
                            style={{
                                background: "#ffffff",
                                width: "100%",
                                maxWidth: "900px",
                                maxHeight: "90vh",
                                overflowY: "auto",
                                borderRadius: "12px",
                                padding: "24px",
                                boxShadow:
                                    "0 10px 40px rgba(0,0,0,0.2)",
                            }}
                        >

                            <div
                                style={{
                                    display: "flex",
                                    justifyContent:
                                        "space-between",
                                    alignItems: "center",
                                    marginBottom: "20px",
                                }}
                            >

                                <div>

                                    <h2
                                        style={{
                                            margin: 0,
                                        }}
                                    >
                                        Add New Request
                                    </h2>

                                    <p
                                        style={{
                                            marginTop: "6px",
                                            color: "#71849a",
                                        }}
                                    >
                                        Create a new item reservation
                                        request.
                                    </p>

                                </div>

                                <button
                                    onClick={() =>
                                        setShowAddRequestModal(false)
                                    }
                                    style={{
                                        border: "none",
                                        background: "transparent",
                                        fontSize: "24px",
                                        cursor: "pointer",
                                    }}
                                >
                                    ×
                                </button>

                            </div>


                            {/* REQUEST DETAILS */}

                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                        "repeat(2, minmax(0, 1fr))",
                                    gap: "16px",
                                }}
                            >

                                <div>

                                    <label>
                                        Reservation ID
                                    </label>

                                    <input
                                        type="text"
                                        value={
                                            newRequest.reservationId
                                        }
                                        placeholder="Leave blank to auto-generate"
                                        onChange={(e) =>
                                            setNewRequest(
                                                (previous) => ({
                                                    ...previous,
                                                    reservationId:
                                                        e.target.value,
                                                })
                                            )
                                        }
                                        style={{
                                            width: "100%",
                                            padding: "10px",
                                            marginTop: "6px",
                                        }}
                                    />

                                </div>


                                <div>

                                    <label>
                                        Claim Stub ID
                                    </label>

                                    <input
                                        type="text"
                                        value={
                                            newRequest.claimStubId
                                        }
                                        placeholder="Leave blank for pending request"
                                        onChange={(e) =>
                                            setNewRequest(
                                                (previous) => ({
                                                    ...previous,
                                                    claimStubId:
                                                        e.target.value,
                                                })
                                            )
                                        }
                                        style={{
                                            width: "100%",
                                            padding: "10px",
                                            marginTop: "6px",
                                        }}
                                    />

                                </div>


                                <div>

                                    <label>
                                        Full Name *
                                    </label>

                                    <input
                                        type="text"
                                        value={
                                            newRequest.fullName
                                        }
                                        onChange={(e) =>
                                            setNewRequest(
                                                (previous) => ({
                                                    ...previous,
                                                    fullName:
                                                        e.target.value,
                                                })
                                            )
                                        }
                                        style={{
                                            width: "100%",
                                            padding: "10px",
                                            marginTop: "6px",
                                        }}
                                    />

                                </div>


                                <div>

                                    <label>
                                        Student ID *
                                    </label>

                                    <input
                                        type="text"
                                        value={
                                            newRequest.studentId
                                        }
                                        onChange={(e) =>
                                            setNewRequest(
                                                (previous) => ({
                                                    ...previous,
                                                    studentId:
                                                        e.target.value,
                                                })
                                            )
                                        }
                                        style={{
                                            width: "100%",
                                            padding: "10px",
                                            marginTop: "6px",
                                        }}
                                    />

                                </div>


                                <div>

                                    <label>
                                        Mobile Number *
                                    </label>

                                    <input
                                        type="text"
                                        value={
                                            newRequest.mobileNumber
                                        }
                                        onChange={(e) =>
                                            setNewRequest(
                                                (previous) => ({
                                                    ...previous,
                                                    mobileNumber:
                                                        e.target.value,
                                                })
                                            )
                                        }
                                        style={{
                                            width: "100%",
                                            padding: "10px",
                                            marginTop: "6px",
                                        }}
                                    />

                                </div>


                                <div>

                                    <label>
                                        Program *
                                    </label>

                                    <input
                                        type="text"
                                        value={
                                            newRequest.program
                                        }
                                        placeholder="e.g. BSIT"
                                        onChange={(e) =>
                                            setNewRequest(
                                                (previous) => ({
                                                    ...previous,
                                                    program:
                                                        e.target.value,
                                                })
                                            )
                                        }
                                        style={{
                                            width: "100%",
                                            padding: "10px",
                                            marginTop: "6px",
                                        }}
                                    />

                                </div>


                                <div>

                                    <label>
                                        Pickup Date *
                                    </label>

                                    <input
                                        type="date"
                                        value={
                                            newRequest.pickupDate
                                        }
                                        onChange={(e) =>
                                            setNewRequest(
                                                (previous) => ({
                                                    ...previous,
                                                    pickupDate:
                                                        e.target.value,
                                                })
                                            )
                                        }
                                        style={{
                                            width: "100%",
                                            padding: "10px",
                                            marginTop: "6px",
                                        }}
                                    />

                                </div>


                                <div>

                                    <label>
                                        Pickup Time *
                                    </label>

                                    <select
                                        value={
                                            newRequest.pickupTime
                                        }
                                        onChange={(e) =>
                                            setNewRequest(
                                                (previous) => ({
                                                    ...previous,
                                                    pickupTime:
                                                        e.target.value,
                                                })
                                            )
                                        }
                                        style={{
                                            width: "100%",
                                            padding: "10px",
                                            marginTop: "6px",
                                        }}
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

                                </div>


                                <div>

                                    <label>
                                        Status *
                                    </label>

                                    <select
                                        value={
                                            newRequest.status
                                        }
                                        onChange={(e) =>
                                            setNewRequest(
                                                (previous) => ({
                                                    ...previous,
                                                    status:
                                                        e.target.value,
                                                })
                                            )
                                        }
                                        style={{
                                            width: "100%",
                                            padding: "10px",
                                            marginTop: "6px",
                                        }}
                                    >

                                        <option value="Pending">
                                            Pending
                                        </option>

                                        <option value="Approved">
                                            Approved
                                        </option>

                                        <option value="Claimed">
                                            Claimed
                                        </option>

                                        <option value="Cancelled">
                                            Cancelled
                                        </option>

                                    </select>

                                </div>


                                <div>

                                    <label>
                                        Total Amount
                                    </label>

                                    <input
                                        type="number"
                                        value={
                                            newRequest.totalAmount
                                        }
                                        readOnly
                                        style={{
                                            width: "100%",
                                            padding: "10px",
                                            marginTop: "6px",
                                            background:
                                                "#f5f7fa",
                                        }}
                                    />

                                </div>

                            </div>


                            {/* ITEMS */}

                            <div
                                style={{
                                    marginTop: "24px",
                                }}
                            >

                                <h3>
                                    Requested Items
                                </h3>

                                <p
                                    style={{
                                        color: "#71849a",
                                    }}
                                >
                                    Add at least one item to the
                                    request.
                                </p>


                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns:
                                            "1.5fr 1.5fr 1fr 1fr 0.8fr 1fr auto",
                                        gap: "10px",
                                        alignItems: "end",
                                    }}
                                >

                                    <div>

                                        <label>
                                            Inventory Item *
                                        </label>

                                       <select
    value={newRequestItem.inventoryId}
    onChange={(e) => {
        const selectedItem = inventory.find(
            (item) => item.id === e.target.value
        );

        setNewRequestItem({
            inventoryId: selectedItem?.id || "",
            itemName: selectedItem?.itemName || "",
            price: Number(selectedItem?.price || 0),
            quantity: 1,
            size: selectedItem?.size || "",
            subtotal: Number(selectedItem?.price || 0),
            purchaseType: "Online",
        });
    }}
    style={{
        width: "100%",
        padding: "10px",
        marginTop: "6px",
    }}
>

                                            <option value="">
                                                Select item
                                            </option>

                                            {inventory.map(
                                                (item) => (
                                                    <option
                                                        key={item.id}
                                                        value={item.id}
                                                    >
                                                        {item.itemName} -
                                                        {item.size} - ₱
                                                        {Number(
                                                            item.price || 0
                                                        ).toLocaleString()}
                                                    </option>
                                                )
                                            )}

                                        </select>

                                    </div>


                                    <div>

                                        <label>
                                            Item Name *
                                        </label>

                                        <input
                                            type="text"
                                            value={
                                                newRequestItem.itemName
                                            }
                                            readOnly
                                            style={{
                                                width: "100%",
                                                padding: "10px",
                                                marginTop: "6px",
                                                background:
                                                    "#f5f7fa",
                                            }}
                                        />

                                    </div>


                                    <div>

                                        <label>
                                            Size *
                                        </label>

                                        <input
                                            type="text"
                                            value={
                                                newRequestItem.size
                                            }
                                            readOnly
                                            style={{
                                                width: "100%",
                                                padding: "10px",
                                                marginTop: "6px",
                                                background:
                                                    "#f5f7fa",
                                            }}
                                        />

                                    </div>


                                    <div>

                                        <label>
                                            Price
                                        </label>

                                        <input
                                            type="number"
                                            value={
                                                newRequestItem.price
                                            }
                                            readOnly
                                            style={{
                                                width: "100%",
                                                padding: "10px",
                                                marginTop: "6px",
                                                background:
                                                    "#f5f7fa",
                                            }}
                                        />

                                    </div>


                                    <div>

                                        <label>
                                            Purchase Type *
                                        </label>

                                        <select
                                            value={
                                                newRequestItem.purchaseType
                                            }
                                            onChange={(e) =>
                                                setNewRequestItem(
                                                    (previous) => ({
                                                        ...previous,
                                                        purchaseType:
                                                            e.target.value as
                                                            "Online" |
                                                            "Walk-in",
                                                    })
                                                )
                                            }
                                            style={{
                                                width: "100%",
                                                padding: "10px",
                                                marginTop: "6px",
                                            }}
                                        >
                                            <option value="Online">
                                                Online
                                            </option>

                                            <option value="Walk-in">
                                                Walk-in
                                            </option>
                                        </select>

                                    </div>


                                    <div>

                                        <label>
                                            Quantity *
                                        </label>

                                        <input
                                            type="number"
                                            min="1"
                                            value={
                                                newRequestItem.quantity
                                            }
                                            onChange={(e) => {

                                                const quantity =
                                                    Math.max(
                                                        1,
                                                        Number(
                                                            e.target.value ||
                                                                1
                                                        )
                                                    );

                                                setNewRequestItem(
                                                    (previous) => ({
                                                        ...previous,
                                                        quantity:
                                                            quantity,
                                                        subtotal:
                                                            Number(
                                                                previous.price ||
                                                                    0
                                                            ) *
                                                            quantity,
                                                    })
                                                );

                                            }}
                                            style={{
                                                width: "100%",
                                                padding: "10px",
                                                marginTop: "6px",
                                            }}
                                        />

                                    </div>


                                    <button
                                        type="button"
                                        onClick={
                                            addRequestItem
                                        }
                                        style={{
                                            padding:
                                                "10px 14px",
                                            cursor: "pointer",
                                            border: "none",
                                            borderRadius:
                                                "6px",
                                            background:
                                                "#4f46e5",
                                            color: "#ffffff",
                                        }}
                                    >
                                        + Add
                                    </button>

                                </div>


                                {/* ADDED ITEMS */}

                                <div
                                    style={{
                                        marginTop: "18px",
                                    }}
                                >

                                    {newRequest.items.length ===
                                    0 ? (

                                        <p
                                            style={{
                                                color: "#71849a",
                                            }}
                                        >
                                            No items added yet.
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
                                                            Quantity
                                                        </th>

                                                        <th>
                                                            Purchase Type
                                                        </th>

                                                        <th>
                                                            Subtotal
                                                        </th>

                                                        <th>
                                                            Action
                                                        </th>

                                                    </tr>

                                                </thead>

                                                <tbody>

                                                    {newRequest.items.map(
                                                        (
                                                            item,
                                                            index
                                                        ) => (

                                                            <tr
                                                                key={
                                                                    index
                                                                }
                                                            >

                                                                <td>
                                                                    {
                                                                        item.itemName
                                                                    }
                                                                </td>

                                                                <td>
                                                                    {
                                                                        item.size
                                                                    }
                                                                </td>

                                                                <td>
                                                                    ₱
                                                                    {Number(
                                                                        item.price ||
                                                                            0
                                                                    ).toLocaleString()}
                                                                </td>

                                                                <td>
                                                                    {
                                                                        item.quantity
                                                                    }
                                                                </td>

                                                                <td>
                                                                    {
                                                                        item.purchaseType
                                                                    }
                                                                </td>

                                                                <td>
                                                                    ₱
                                                                    {Number(
                                                                        item.subtotal ||
                                                                            0
                                                                    ).toLocaleString(
                                                                        undefined,
                                                                        {
                                                                            minimumFractionDigits:
                                                                                2,
                                                                            maximumFractionDigits:
                                                                                2,
                                                                        }
                                                                    )}
                                                                </td>

                                                                <td>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            removeRequestItem(
                                                                                index
                                                                            )
                                                                        }
                                                                        style={{
                                                                            cursor:
                                                                                "pointer",
                                                                        }}
                                                                    >
                                                                        Remove
                                                                    </button>

                                                                </td>

                                                            </tr>

                                                        )
                                                    )}

                                                </tbody>

                                            </table>

                                        </div>

                                    )}

                                </div>

                            </div>


                            {/* MODAL ACTIONS */}

                            <div
                                style={{
                                    display: "flex",
                                    justifyContent:
                                        "flex-end",
                                    gap: "10px",
                                    marginTop: "24px",
                                }}
                            >

                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowAddRequestModal(
                                            false
                                        )
                                    }
                                    style={{
                                        padding:
                                            "10px 18px",
                                        cursor: "pointer",
                                    }}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    onClick={
                                        addNewRequest
                                    }
                                    style={{
                                        padding:
                                            "10px 18px",
                                        cursor: "pointer",
                                        border: "none",
                                        borderRadius:
                                            "6px",
                                        background:
                                            "#4f46e5",
                                        color: "#ffffff",
                                        fontWeight: 600,
                                    }}
                                >
                                    Save Request
                                </button>

                            </div>

                        </div>

                    </div>

                )}



{/* ========================= */}
{/* EDIT STOCK MODAL */}
{/* ========================= */}
{showCancelModal && selectedReservationForCancel && (
    <div
        style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
        }}
    >
        <div
            style={{
                backgroundColor: "white",
                padding: "25px",
                borderRadius: "10px",
                width: "450px",
                maxWidth: "90%",
            }}
        >
            <h2>Cancel Reservation</h2>

            <p>
                Please provide a reason for cancelling this
                reservation.
            </p>

            <p>
                <strong>
                    Reservation ID:
                </strong>{" "}
                {selectedReservationForCancel.reservationId}
            </p>

            <label>
                Note / Cancellation Reason
            </label>

            <textarea
                value={cancellationReason}
                onChange={(e) =>
                    setCancellationReason(e.target.value)
                }
                placeholder="Enter the reason for cancellation..."
                rows={5}
                style={{
                    width: "100%",
                    padding: "10px",
                    marginTop: "6px",
                    marginBottom: "15px",
                    resize: "vertical",
                    boxSizing: "border-box",
                }}
            />

            <div
                style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                }}
            >
                <button
                    onClick={() => {
                        setShowCancelModal(false);
                        setSelectedReservationForCancel(null);
                        setCancellationReason("");
                    }}
                >
                    Go Back
                </button>

                <button
                    onClick={cancelReservation}
                    disabled={!cancellationReason.trim()}
                >
                    Continue Cancellation
                </button>
            </div>
        </div>
    </div>
)}
{showEditStockModal &&
    selectedInventoryItem && (

        <div
            style={{
                position: "fixed",
                inset: 0,
                backgroundColor:
                    "rgba(0, 0, 0, 0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
            }}
        >

            <div
                style={{
                    backgroundColor: "#fff",
                    width: "500px",
                    maxWidth: "90%",
                    maxHeight: "90vh",
                    overflowY: "auto",
                    borderRadius: "12px",
                    padding: "25px",
                    boxShadow:
                        "0 10px 30px rgba(0,0,0,0.2)",
                }}
            >

                <h2>
                    Edit Stock
                </h2>

                <p
                    style={{
                        color: "#666",
                        marginBottom: "20px",
                    }}
                >
                    Edit the stock values for this
                    inventory item.
                </p>


                {/* ITEM NAME */}
                <div
                    style={{
                        marginBottom: "15px",
                    }}
                >

                    <label>
                        Item
                    </label>

                    <input
                        type="text"
                        value={
                            `${selectedInventoryItem.itemName} - ${selectedInventoryItem.size}`
                        }
                        readOnly
                        style={{
                            width: "100%",
                            padding: "10px",
                            marginTop: "5px",
                            boxSizing:
                                "border-box",
                        }}
                    />

                </div>


                {/* PRICE */}
                <div
                    style={{
                        marginBottom: "15px",
                    }}
                >

                    <label>
                        Price
                    </label>

                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editStock.price}
                        onChange={(e) =>
                            setEditStock({
                                ...editStock,
                                price: Number(
                                    e.target.value
                                ),
                            })
                        }
                        style={{
                            width: "100%",
                            padding: "10px",
                            marginTop: "5px",
                            boxSizing: "border-box",
                        }}
                    />

                </div>


                {/* TOTAL STOCK */}
                <div
                    style={{
                        marginBottom: "15px",
                    }}
                >

                    <label>
                        Total Stock
                    </label>

                    <input
                        type="number"
                        min="0"
                        value={
                            editStock.totalStock
                        }
                        onChange={(e) =>
                            setEditStock({
                                ...editStock,
                                totalStock:
                                    Number(
                                        e.target.value
                                    ),
                            })
                        }
                        style={{
                            width: "100%",
                            padding: "10px",
                            marginTop: "5px",
                            boxSizing:
                                "border-box",
                        }}
                    />

                </div>


                {/* ONLINE STOCK */}
                <div
                    style={{
                        marginBottom: "15px",
                    }}
                >

                    <label>
                        Online Stock
                    </label>

                    <input
                        type="number"
                        min="0"
                        value={
                            editStock.onlineStock
                        }
                        onChange={(e) =>
                            setEditStock({
                                ...editStock,
                                onlineStock:
                                    Number(
                                        e.target.value
                                    ),
                            })
                        }
                        style={{
                            width: "100%",
                            padding: "10px",
                            marginTop: "5px",
                            boxSizing:
                                "border-box",
                        }}
                    />

                </div>


                {/* WALK-IN STOCK */}
                <div
                    style={{
                        marginBottom: "15px",
                    }}
                >

                    <label>
                        Walk-in Stock
                    </label>

                    <input
                        type="number"
                        min="0"
                        value={
                            editStock.walkInStock
                        }
                        onChange={(e) =>
                            setEditStock({
                                ...editStock,
                                walkInStock:
                                    Number(
                                        e.target.value
                                    ),
                            })
                        }
                        style={{
                            width: "100%",
                            padding: "10px",
                            marginTop: "5px",
                            boxSizing:
                                "border-box",
                        }}
                    />

                </div>


                {/* RESERVED QUANTITY */}
                <div
                    style={{
                        marginBottom: "15px",
                    }}
                >

                    <label>
                        Reserved Quantity
                    </label>

                    <input
                        type="number"
                        min="0"
                        value={
                            editStock.reservedQuantity
                        }
                        onChange={(e) =>
                            setEditStock({
                                ...editStock,
                                reservedQuantity:
                                    Number(
                                        e.target.value
                                    ),
                            })
                        }
                        style={{
                            width: "100%",
                            padding: "10px",
                            marginTop: "5px",
                            boxSizing:
                                "border-box",
                        }}
                    />

                </div>


                {/* AVAILABLE ONLINE */}
                <div
                    style={{
                        marginBottom: "15px",
                    }}
                >

                    <label>
                        Available Online
                    </label>

                    <input
                        type="number"
                        min="0"
                        value={
                            editStock.availableOnline
                        }
                        onChange={(e) =>
                            setEditStock({
                                ...editStock,
                                availableOnline:
                                    Number(
                                        e.target.value
                                    ),
                            })
                        }
                        style={{
                            width: "100%",
                            padding: "10px",
                            marginTop: "5px",
                            boxSizing:
                                "border-box",
                        }}
                    />

                </div>


                {/* AVAILABLE WALK-IN */}
                <div
                    style={{
                        marginBottom: "20px",
                    }}
                >

                    <label>
                        Available Walk-in
                    </label>

                    <input
                        type="number"
                        min="0"
                        value={
                            editStock.availableWalkIn
                        }
                        onChange={(e) =>
                            setEditStock({
                                ...editStock,
                                availableWalkIn:
                                    Number(
                                        e.target.value
                                    ),
                            })
                        }
                        style={{
                            width: "100%",
                            padding: "10px",
                            marginTop: "5px",
                            boxSizing:
                                "border-box",
                        }}
                    />

                </div>


                {/* BUTTONS */}
                <div
                    style={{
                        display: "flex",
                        justifyContent:
                            "flex-end",
                        gap: "10px",
                    }}
                >

                    <button
                        onClick={() => {
                            setShowEditStockModal(
                                false
                            );

                            setSelectedInventoryItem(
                                null
                            );
                        }}
                    >
                        Cancel
                    </button>


                    <button
                        onClick={saveEditedStock}
                    >
                        Save Changes
                    </button>

                </div>

            </div>

        </div>
    )}
            </main>

        </div>

    );
}


export default GeneralOfficeDashboard;
