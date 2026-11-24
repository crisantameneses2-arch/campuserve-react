import { useEffect, useRef, useState } from "react";
import { isRetiredItem } from "../../components/items/retiredItems";
import { useNotifications } from "../../hooks/useNotifications";
import {
    markNotificationRead,
    roleAudience,
} from "../../services/notifications";
import "./GeneralOfficeDashboard.css";

import {
    collection,
    getDocs,
    onSnapshot,
    doc,
    updateDoc,
    addDoc,
    serverTimestamp,
} from "firebase/firestore";

import { db } from "../../../firebase";
import MessagesPanel from "../../components/messaging/MessagesPanel";
import UnreadMessagesBadge from "../../components/messaging/UnreadMessagesBadge";


// =========================
// INVENTORY TYPE
// =========================

type InventoryItem = {
    id: string;
    itemName: string;
    size: string;
    price: number;
    totalStock: number;
    reservedQuantity: number;
    soldOnline: number;
    soldWalkIn: number;
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
    claimedAt: any;
    status: string;
    totalAmount: number;
    cancellationReason?: string;
    paymentCode?: string;
    payment_status?: "UNPAID" | "PAID";
    createdAt: any;
    items: ReservationItem[];
    payment_confirmed_at?: any;
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
    const [showNotifications, setShowNotifications] = useState(false);

    const notificationUserKey = account.email || "general-office";

    const {
        items: notifications,
        unread: unreadNotifications,
        loading: notificationsLoading,
    } = useNotifications(
        roleAudience("general_office"),
        notificationUserKey
    );

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
    // LIVE RESERVATION NOTIFICATIONS
    // =========================

    type LiveReservationNotification = {
        id: string;
        title: string;
        message: string;
        createdAt: number;
        destination: string;
    };

    const [liveReservationNotifications, setLiveReservationNotifications] =
        useState<LiveReservationNotification[]>([]);

    const [liveUnreadCount, setLiveUnreadCount] = useState(0);

    const previousReservationsRef = useRef<Map<string, any>>(new Map());

    const hasInitialReservationSnapshot = useRef(false);
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
        status: "Unpaid",
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
        reservedQuantity: 0,
    });

    const openEditStockModal = (item: InventoryItem) => {
        setSelectedInventoryItem(item);

        setEditStock({
            price: Number(item.price || 0),
            totalStock: Number(item.totalStock || 0),
            reservedQuantity: Number(item.reservedQuantity || 0),
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
            editStock.reservedQuantity < 0
        ) {
            alert("Stock values cannot be negative.");
            return;
        }

        if (editStock.reservedQuantity > editStock.totalStock) {
            alert("Reserved quantity cannot be greater than total stock.");
            return;
        }

        try {

            await updateDoc(
                doc(db, "inventory", selectedInventoryItem.id),
                {
                    price: Number(editStock.price),
                    totalStock: Number(editStock.totalStock),
                    reservedQuantity: Number(editStock.reservedQuantity),
                }
            );

            setShowEditStockModal(false);
            setSelectedInventoryItem(null);

            await loadInventory();

        } catch (error) {

            console.error("Error updating stock:", error);
            alert("Failed to update stock.");
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
                inventorySnapshot.docs.map((document) => {

                    const data = document.data() as any;

                    return {
                        id: document.id,
                        itemName: data.itemName || "",
                        size: data.size || "",
                        price: Number(data.price) || 0,
                        totalStock: Number(data.totalStock) || 0,
                        reservedQuantity: Number(data.reservedQuantity) || 0,
                        soldOnline: Number(data.soldOnline) || 0,
                        soldWalkIn: Number(data.soldWalkIn) || 0,
                        status: data.status || "In Stock",
                    };
                });

            // ROTC items are no longer offered.
            setInventory(
                inventoryData.filter((item) => !isRetiredItem(item.itemName))
            );

        } catch (error) {

            console.error("Error loading inventory:", error);

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

                        paymentCode:
                            data.paymentCode || "",

                        payment_status:
                            data.payment_status || "UNPAID",

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

                        claimedAt:
                            data.claimedAt || "",

                        pickupTime:
                            data.pickupTime || "",

                        status:
                            data.status || "Pending",

                        totalAmount:
                            Number(data.totalAmount) || 0,

                        createdAt:
                            data.createdAt || null,

                        cancellationReason:
                            data.cancellationReason || "",

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

            console.error("Error loading reservations:", error);

        } finally {

            setLoadingReservations(false);
        }
    };
    // =========================
    // REAL-TIME RESERVATION LISTENER
    // =========================

    useEffect(() => {
        const unsubscribe = onSnapshot(
            collection(db, "itemReservations"),
            (snapshot) => {
                // First snapshot: remember existing reservations.
                // Do not notify the user about old records.
                if (!hasInitialReservationSnapshot.current) {
                    const initialReservations = new Map<string, any>();

                    snapshot.docs.forEach((document) => {
                        initialReservations.set(
                            document.id,
                            document.data()
                        );
                    });

                    previousReservationsRef.current = initialReservations;
                    hasInitialReservationSnapshot.current = true;

                    return;
                }

                const newNotifications: LiveReservationNotification[] = [];

                snapshot.docChanges().forEach((change) => {
                    const reservationId = change.doc.id;
                    const newData = change.doc.data();
                    const oldData =
                        previousReservationsRef.current.get(reservationId);

                    let title = "";
                    let message = "";
                    let destination = "Reservations";

                    if (change.type === "added") {
                        title = "New Item Reservation";
                        message = `${newData.fullName || "A student"} submitted a new item reservation.`;
                        destination = "Requests";
                    }

                    if (change.type === "modified" && oldData) {
                        if (newData.status !== oldData.status) {
                            const status = String(newData.status || "");

                            title = status.toLowerCase().includes("cancel")
                                ? "Reservation Cancelled"
                                : "Reservation Status Updated";

                            message = `${newData.fullName || "A student"}'s reservation status is now ${status}.`;
                        } else if (
                            newData.pickupDate !== oldData.pickupDate ||
                            newData.pickupTime !== oldData.pickupTime
                        ) {
                            title = "Pickup Schedule Updated";
                            message = `${newData.fullName || "A student"}'s pickup schedule has changed.`;
                        } else if (
                            newData.payment_status !== oldData.payment_status
                        ) {
                            title = "Payment Status Updated";
                            message = `${newData.fullName || "A student"}'s payment status is now ${newData.payment_status || "updated"}.`;
                        } else if (
                            newData.cancellationReason !== oldData.cancellationReason
                        ) {
                            title = "Cancellation Details Updated";
                            message = `${newData.fullName || "A student"} updated their cancellation details.`;
                        }
                    }

                    if (change.type === "removed") {
                        title = "Reservation Removed";
                        message = `${oldData?.fullName || "A student's"} reservation was removed.`;
                    }

                    if (title && message) {
                        newNotifications.push({
                            id: `${reservationId}-${Date.now()}-${newNotifications.length}`,
                            title,
                            message,
                            createdAt: Date.now(),
                            destination,
                        });
                    }

                    // Remember the latest data for the next comparison.
                    if (change.type === "removed") {
                        previousReservationsRef.current.delete(reservationId);
                    } else {
                        previousReservationsRef.current.set(
                            reservationId,
                            newData
                        );
                    }
                });

                if (newNotifications.length > 0) {
                    setLiveReservationNotifications((previous) =>
                        [...newNotifications, ...previous].slice(0, 20)
                    );

                    setLiveUnreadCount((previous) =>
                        previous + newNotifications.length
                    );
                }
            },
            (error) => {
                console.error(
                    "Real-time reservation listener error:",
                    error
                );
            }
        );

        return () => unsubscribe();
    }, []);

    // =========================
    // UPDATE PICKUP DATE
    // =========================

    const updatePickupDate = async (
        reservationId: string,
        newPickupDate: string
    ) => {

        try {

            await updateDoc(
                doc(db, "itemReservations", reservationId),
                {
                    pickupDate: newPickupDate,
                }
            );

            await loadReservations();

        } catch (error) {

            console.error("Error updating pickup date:", error);
        }
    };

    // =========================
    // CANCEL RESERVATION
    // =========================

    const cancelReservation = async () => {

        if (!selectedReservationForCancel) {
            return;
        }

        if (!cancellationReason.trim()) {
            alert("Please enter a cancellation reason.");
            return;
        }

        try {

            const wasApproved =
                selectedReservationForCancel.status?.toLowerCase() ===
                "approved";

            // =========================
            // ROLLBACK STOCK IF IT WAS
            // ALREADY APPROVED (STOCK
            // WAS DEDUCTED AT APPROVE)
            // =========================

            if (wasApproved) {

                for (const item of selectedReservationForCancel.items) {

                    if (!item.inventoryId) {
                        continue;
                    }

                    const inventoryItem = inventory.find(
                        (inventoryEntry) =>
                            inventoryEntry.id === item.inventoryId
                    );

                    if (!inventoryItem) {
                        console.error(
                            `Inventory item not found: ${item.inventoryId}`
                        );
                        continue;
                    }

                    const quantity =
                        Number(item.quantity || 0);

                    if (quantity <= 0) {
                        continue;
                    }

                    /*  const purchaseType =
                         item.purchaseType === "Walk-in"
                             ? "Walk-in"
                             : "Online";
  */
                    await updateDoc(
                        doc(db, "inventory", item.inventoryId),
                        {
                            reservedQuantity: Math.max(
                                0,
                                Number(inventoryItem.reservedQuantity || 0) -
                                quantity
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
                    selectedReservationForCancel.id
                ),
                {
                    status: "Cancelled",
                    cancellationReason:
                        cancellationReason.trim(),
                }
            );

            alert(
                wasApproved
                    ? "Reservation cancelled successfully. Stock has been restored."
                    : "Reservation cancelled successfully."
            );

            setShowCancelModal(false);
            setSelectedReservationForCancel(null);
            setCancellationReason("");

            await loadReservations();
            await loadInventory();

        } catch (error) {

            console.error("Error cancelling reservation:", error);
            alert("Failed to cancel reservation.");
        }
    };

    // =========================
    // UPDATE STATUS TO PENDING
    // =========================

    const updateStatusToPending = async (
        reservationId: string
    ) => {

        try {

            await updateDoc(
                doc(db, "itemReservations", reservationId),
                {
                    status: "Pending",
                }
            );

            await loadReservations();

        } catch (error) {

            console.error("Error updating status:", error);
        }
    };

    // =========================
    // COMPLETE / APPROVE
    // RESERVATION
    // =========================
    //
    // THIS IS THE ONLY PLACE
    // STOCK GETS DEDUCTED.
    //
    // Semantics:
    //  totalStock       = physical units currently on hand
    //  reservedQuantity = units set aside for approved
    //                     reservations awaiting pickup
    //  soldOnline / soldWalkIn = cumulative approved sales
    //
    //  available for new reservations =
    //      totalStock - reservedQuantity
    //
    // =========================

    const completeReservation = async (
        reservationId: string
    ) => {

        try {

            const reservation =
                reservations.find(
                    (item) => item.id === reservationId
                );

            if (!reservation) {
                alert("Reservation not found.");
                return;
            }

            if (!reservation.claimStubId) {
                alert(
                    "No claiming code found. Please ask the Cashier to confirm payment."
                );
                return;
            }

            if (
                reservation.status?.toLowerCase() ===
                "approved"
            ) {
                alert("This reservation is already approved.");
                return;
            }

            // =========================
            // PRE-CHECK: MAKE SURE
            // EVERY ITEM HAS ENOUGH
            // STOCK BEFORE WRITING
            // ANYTHING (NO PARTIAL
            // DEDUCTIONS)
            // =========================

            for (const reservedItem of reservation.items) {

                if (!reservedItem.inventoryId) {
                    continue;
                }

                const inventoryItem =
                    inventory.find(
                        (item) =>
                            item.id === reservedItem.inventoryId
                    );

                if (!inventoryItem) {
                    alert(
                        `Inventory item not found: ${reservedItem.itemName}`
                    );
                    return;
                }

                const quantity =
                    Number(reservedItem.quantity || 0);

                if (quantity <= 0) {
                    continue;
                }

                const available =
                    Number(inventoryItem.totalStock || 0) -
                    Number(inventoryItem.reservedQuantity || 0);

                if (available < quantity) {
                    alert(
                        `Not enough stock for ${reservedItem.itemName}.\n\n` +
                        `Available: ${available}\n` +
                        `Requested: ${quantity}`
                    );
                    return;
                }
            }

            // =========================
            // CONFIRM RELEASE DATE
            // =========================

            const confirmCompletion = window.confirm(
                "Before completing this reservation, please confirm:\n\n" +
                "Has the claiming/release date already been set correctly?\n\n" +
                "Click OK to proceed or Cancel to review the date."
            );

            if (!confirmCompletion) {
                return;
            }

            // =========================
            // DEDUCT STOCK + ADD TO
            // RESERVED / SOLD COUNTERS
            // =========================

            for (const claimedItem of reservation.items) {

                if (!claimedItem.inventoryId) {
                    continue;
                }

                const inventoryItem =
                    inventory.find(
                        (item) =>
                            item.id === claimedItem.inventoryId
                    );

                if (!inventoryItem) {
                    continue;
                }

                const quantityBought =
                    Number(claimedItem.quantity || 0);

                if (quantityBought <= 0) {
                    continue;
                }

                /* const purchaseType =
                    claimedItem.purchaseType === "Walk-in"
                        ? "Walk-in"
                        : "Online";

                const currentTotalStock =
                    Number(inventoryItem.totalStock || 0);

               
                const currentSoldOnline =
                    Number(inventoryItem.soldOnline || 0);

                const currentSoldWalkIn =
                    Number(inventoryItem.soldWalkIn || 0);
 */
                const currentReservedQuantity =
                    Number(inventoryItem.reservedQuantity || 0);

                await updateDoc(
                    doc(db, "inventory", claimedItem.inventoryId),
                    {
                        // Do not deduct totalStock yet.
                        // Only set aside the requested quantity.
                        reservedQuantity:
                            currentReservedQuantity + quantityBought,
                    }

                );
            }

            // =========================
            // UPDATE RESERVATION
            // =========================

            await updateDoc(
                doc(db, "itemReservations", reservationId),
                {
                    status: "approved",
                }
            );

            await loadReservations();
            await loadInventory();
            alert(
                "Reservation approved. Stock has been reserved successfully."
            );
        } catch (error) {

            console.error(
                "Error completing reservation:",
                error
            );
            alert("Failed to approve reservation.");
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

        // =========================
        // CHECK AVAILABLE STOCK
        // =========================

        const inventoryItem = inventory.find(
            (item) => item.id === newRequestItem.inventoryId
        );

        if (inventoryItem) {

            const available =
                Number(inventoryItem.totalStock || 0) -
                Number(inventoryItem.reservedQuantity || 0);

            if (newRequestItem.quantity > available) {
                alert(
                    `Not enough stock for ${inventoryItem.itemName}.\n\n` +
                    `Available: ${available}`
                );
                return;
            }
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
            totalAmount: previous.totalAmount + subtotal,
        }));

        setNewRequestItem({
            inventoryId: "",
            itemName: "",
            price: 0,
            quantity: 1,
            size: "",
            subtotal: 0,
            purchaseType: "Walk-in",
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
                    Number(itemToRemove?.subtotal || 0),
            };
        });
    };

    // =========================
    // CLAIM RESERVATION
    // =========================
    //
    // STATUS and reserveditem deduction
    // STOCK WAS ALREADY
    // DEDUCTED AT APPROVE.
    //
    // =========================

    const claimReservation = async (
        reservationId: string
    ) => {
        try {
            const reservation = reservations.find(
                (item) => item.id === reservationId
            );

            if (!reservation) {
                alert("Reservation not found.");
                return;
            }

            if (
                reservation.status?.toLowerCase() !== "approved"
            ) {
                alert(
                    "Only approved reservations can be marked as claimed."
                );
                return;
            }

            // Remove claimed quantities from reservedQuantity
            for (const item of reservation.items) {
                if (!item.inventoryId) continue;

                const quantity = Number(item.quantity || 0);

                if (quantity <= 0) continue;

                const inventoryItem = inventory.find(
                    (inv) => inv.id === item.inventoryId
                );

                if (!inventoryItem) {
                    throw new Error(
                        `Inventory item not found: ${item.itemName}`
                    );
                }

                const currentReservedQuantity = Number(
                    inventoryItem.reservedQuantity || 0
                );

                if (currentReservedQuantity < quantity) {
                    throw new Error(
                        `Invalid reserved quantity for ${item.itemName}.`
                    );
                }

                await updateDoc(
                    doc(db, "inventory", item.inventoryId),
                    {
                        // Deduct the physical stock upon claiming.
                        totalStock:
                            Number(inventoryItem.totalStock || 0) - quantity,

                        // Release the reserved quantity.
                        reservedQuantity:
                            currentReservedQuantity - quantity,

                        // Record completed sales upon claiming.
                        soldOnline:
                            item.purchaseType === "Online"
                                ? Number(inventoryItem.soldOnline || 0) + quantity
                                : Number(inventoryItem.soldOnline || 0),

                        soldWalkIn:
                            item.purchaseType === "Walk-in"
                                ? Number(inventoryItem.soldWalkIn || 0) + quantity
                                : Number(inventoryItem.soldWalkIn || 0),
                    }
                );
            }

            // Update reservation status
            await updateDoc(
                doc(db, "itemReservations", reservationId),
                {
                    status: "claimed",
                    claimedAt: serverTimestamp(),
                }
            );

            await loadReservations();
            await loadInventory();

            alert(
                "Reservation successfully claimed! Reserved quantities have been updated."
            );

        } catch (error) {
            console.error("Error claiming reservation:", error);
            alert("Failed to update reservation.");
        }
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
                    reservationId: reservationId,

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
                        newRequest.status || "Unpaid",

                    totalAmount:
                        Number(newRequest.totalAmount || 0),

                    items:
                        newRequest.items.map((item) => ({
                            inventoryId: item.inventoryId,
                            itemName: item.itemName,
                            price: Number(item.price || 0),
                            quantity: Number(item.quantity || 0),
                            size: item.size,
                            subtotal: Number(item.subtotal || 0),
                            purchaseType:
                                item.purchaseType || "Online",
                        })),

                    createdAt: serverTimestamp(),
                }
            );

            alert("New request added successfully.");

            setShowAddRequestModal(false);

            setNewRequest({
                reservationId: "",
                claimStubId: "",
                fullName: "",
                studentId: "",
                mobileNumber: "",
                program: "",
                pickupDate: "",
                pickupTime: "8:00AM - 10:00AM",
                status: "Unpaid",
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
                purchaseType: "Walk-in",
            });

            await loadReservations();

        } catch (error) {

            console.error("Error adding new request:", error);
            alert("Failed to add request. Please try again.");
        }
    };

    // =========================
    // COUNT RESERVATIONS
    // =========================

    const pendingReservations =
        reservations.filter(
            (reservation) =>
                reservation.status.toLowerCase() === "unpaid"
        );

    const approvedReservations =
        reservations.filter(
            (reservation) =>
                reservation.status.toLowerCase() ===
                "pending" ||
                reservation.status.toLowerCase() === "paid" ||
                reservation.status.toLowerCase() === "approved"
        );

    const claimedReservations =
        reservations.filter(
            (reservation) =>
                reservation.status.toLowerCase() === "claimed"
        );

    const [showCancelModal, setShowCancelModal] = useState(false);
    const [selectedReservationForCancel, setSelectedReservationForCancel] =
        useState<ItemReservation | null>(null);
    const [cancellationReason, setCancellationReason] = useState("");

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
    //
    // AVAILABLE IS ALWAYS
    // DERIVED, NEVER STORED:
    //
    //  available = totalStock - reservedQuantity
    //
    // =========================

    const getAvailable = (item: InventoryItem) =>
        Math.max(
            0,
            Number(item.totalStock || 0) -
            Number(item.reservedQuantity || 0)
        );

    const totalStock = inventory.reduce(
        (total, item) =>
            total + Number(item.totalStock || 0),
        0
    );

    const totalAvailableStock = inventory.reduce(
        (total, item) => total + getAvailable(item),
        0
    );

    const totalReservedStock = inventory.reduce(
        (total, item) =>
            total + Number(item.reservedQuantity || 0),
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

                    <button
                        className={`go-nav-item ${activePage === "Dashboard" ? "active" : ""}`}
                        onClick={() => setActivePage("Dashboard")}
                    >
                        <span>📊</span>
                        Dashboard
                    </button>

                    <button
                        className={`go-nav-item ${activePage === "Inventory" ? "active" : ""}`}
                        onClick={() => setActivePage("Inventory")}
                    >
                        <span>📦</span>
                        Inventory
                    </button>

                    <button
                        className={`go-nav-item ${activePage === "Requests" ? "active" : ""}`}
                        onClick={() => setActivePage("Requests")}
                    >
                        <span>📋</span>
                        Requests
                    </button>

                    <button
                        className={`go-nav-item ${activePage === "Reservations" ? "active" : ""}`}
                        onClick={() => setActivePage("Reservations")}
                    >
                        <span>📝</span>
                        Reservations
                    </button>

                    <button
                        className={`go-nav-item ${activePage === "Claiming" ? "active" : ""}`}
                        onClick={() => setActivePage("Claiming")}
                    >
                        <span>📦</span>
                        Claimed Items
                    </button>

                    <button
                        className={`go-nav-item ${activePage === "Transactions" ? "active" : ""}`}
                        onClick={() => setActivePage("Transactions")}
                    >
                        <span>💳</span>
                        Transactions
                    </button>

                    <button
                        className={`go-nav-item ${activePage === "Reports" ? "active" : ""}`}
                        onClick={() => setActivePage("Reports")}
                    >
                        <span>📊</span>
                        Reports
                    </button>

                    <button
                        className={`go-nav-item ${activePage === "Messages" ? "active" : ""}`}
                        onClick={() => setActivePage("Messages")}
                    >
                        <span>💬</span>
                        Messages
                        <UnreadMessagesBadge office="general_office" />
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

                        <button
                            className="go-header-button"
                            onClick={() => {
                                const willOpen = !showNotifications;

                                setShowNotifications(willOpen);

                                if (willOpen) {
                                    setLiveUnreadCount(0);
                                }
                            }}
                        >🔔
                            {(unreadNotifications + liveUnreadCount) > 0 && (
                                <span className="go-notification-badge">
                                    {(unreadNotifications + liveUnreadCount) > 99
                                        ? "99+"
                                        : unreadNotifications + liveUnreadCount}
                                </span>
                            )}
                        </button>


                    </div>

                </header>
                {showNotifications && (
                    <div className="go-notification-popup">
                        <div className="go-notification-popup-header">
                            <h3>Notifications</h3>

                            <button
                                onClick={() => setShowNotifications(false)}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="go-notification-list">
                            {notificationsLoading ? (
                                <p className="go-notification-empty">
                                    Loading notifications...
                                </p>
                            ) : (
                                <>
                                    {liveReservationNotifications.map((notification) => (
                                        <div
                                            key={notification.id}
                                            className="go-notification-item unread"
                                            onClick={() => {
                                                setActivePage(notification.destination);
                                                setShowNotifications(false);
                                            }}
                                            role="button"
                                            tabIndex={0}
                                        >
                                            <div className="go-notification-item-content">
                                                <strong>{notification.title}</strong>
                                                <p>{notification.message}</p>
                                            </div>
                                            <span className="go-notification-unread-dot" />
                                        </div>
                                    ))}

                                    {notifications.map((notification) => {
                                        const isUnread = !notification.readBy.includes(
                                            notificationUserKey
                                        );

                                        return (
                                            <div
                                                key={notification.id}
                                                className={`go-notification-item ${isUnread ? "unread" : ""}`}
                                                onClick={async () => {
                                                    let destination = "Dashboard";

                                                    if (notification.type === "STOCK") {
                                                        destination = "Inventory";
                                                    } else if (notification.type === "SUBMITTED") {
                                                        destination = "Requests";
                                                    } else if (notification.kind === "ITEM") {
                                                        destination = "Reservations";
                                                    } else if (notification.kind === "DOCUMENT") {
                                                        destination = "Requests";
                                                    }

                                                    if (isUnread) {
                                                        await markNotificationRead(
                                                            notification.id,
                                                            notificationUserKey
                                                        );
                                                    }

                                                    setActivePage(destination);
                                                    setShowNotifications(false);
                                                }}
                                            >
                                                <div className="go-notification-item-content">
                                                    <strong>{notification.title}</strong>
                                                    <p>{notification.message}</p>
                                                </div>

                                                {isUnread && (
                                                    <span className="go-notification-unread-dot" />
                                                )}
                                            </div>
                                        );
                                    })}

                                    {liveReservationNotifications.length === 0 &&
                                        notifications.length === 0 && (
                                            <p className="go-notification-empty">
                                                No notifications yet.
                                            </p>
                                        )}
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* ========================= */}
                {/* DASHBOARD PAGE */}
                {/* ========================= */}

                {activePage === "Dashboard" && (

                    <section className="go-content">

                        <div className="go-summary">

                            <div
                                className="go-summary-card"
                                onClick={() => setActivePage("Requests")}
                                style={{ cursor: "pointer" }}
                            >

                                <div className="go-card-icon purple">
                                    📝
                                </div>

                                <div>
                                    <p>Pending Reservations</p>
                                    <h2>{pendingReservations.length}</h2>
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
                                    <h2>{approvedReservations.length}</h2>
                                    <span>Ready for processing</span>
                                </div>

                            </div>

                            <div
                                className="go-summary-card"
                                onClick={() => setActivePage("Claiming")}
                                style={{ cursor: "pointer" }}
                            >

                                <div className="go-card-icon blue">
                                    📦
                                </div>

                                <div>
                                    <p>Claimed Items</p>
                                    <h2>{claimedReservations.length}</h2>
                                    <span>Completed reservations</span>
                                </div>

                            </div>

                        </div>

                        <div className="go-dashboard-grid">

                            <section className="go-panel reservations-panel">

                                <button
                                    className="go-action-card"
                                    onClick={() => setActivePage("Reservations")}
                                >

                                    <span className="go-action-icon">
                                        📝
                                    </span>

                                    <div>
                                        <h3>Reservations</h3>
                                        <p>Review reservations</p>
                                    </div>

                                    <span className="go-arrow">→</span>

                                </button>

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
                                                key={reservation.id}
                                            >

                                                <div className="go-user-icon">
                                                    👤
                                                </div>

                                                <div className="go-reservation-info">

                                                    <h3>
                                                        {reservation.fullName}
                                                    </h3>

                                                    <p>
                                                        {reservation.items
                                                            .map(
                                                                (item) =>
                                                                    item.itemName
                                                            )
                                                            .join(", ")}
                                                    </p>

                                                </div>

                                                <span
                                                    className={`status ${reservation.status.toLowerCase()}`}
                                                >
                                                    {reservation.status}
                                                </span>

                                            </div>

                                        ))
                                )}

                            </section>

                            <section className="go-panel inventory-panel">

                                <button
                                    className="go-action-card"
                                    onClick={() => setActivePage("Inventory")}
                                >

                                    <span className="go-action-icon">
                                        📦
                                    </span>

                                    <div>
                                        <h3>Inventory</h3>
                                        <p>Manage item stock</p>
                                    </div>

                                    <span className="go-arrow">→</span>

                                </button>

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

                    </section>

                )}

                {/* ========================= */}
                {/* INVENTORY PAGE */}
                {/* ========================= */}

                {activePage === "Inventory" && (

                    <section className="go-content">

                        <section className="go-panel inventory-page">

                            <div className="inventory-page-header">

                                <div>
                                    <h2>Inventory</h2>
                                    <p>View and manage available items.</p>
                                </div>

                                <button
                                    className="inventory-refresh-button"
                                    onClick={loadInventory}
                                >
                                    ↻ Refresh
                                </button>

                            </div>

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

                                                <th>Item</th>
                                                <th>Size</th>
                                                <th>Price</th>
                                                <th>Total Stock</th>
                                                <th>Reserved</th>
                                                <th>Available</th>
                                                <th>Status</th>
                                                <th>Action</th>

                                            </tr>

                                        </thead>

                                        <tbody>

                                            {inventory.map((item) => {

                                                const available =
                                                    getAvailable(item);

                                                return (

                                                    <tr key={item.id}>

                                                        <td>

                                                            <strong>
                                                                {item.itemName}
                                                            </strong>

                                                        </td>

                                                        <td>
                                                            {item.size}
                                                        </td>

                                                        <td>
                                                            ₱
                                                            {item.price.toLocaleString()}
                                                        </td>

                                                        <td>
                                                            {item.totalStock}
                                                        </td>

                                                        <td>
                                                            {item.reservedQuantity}
                                                        </td>

                                                        <td>
                                                            <strong>
                                                                {available}
                                                            </strong>
                                                        </td>

                                                        <td>

                                                            <span
                                                                className={`inventory-status ${item.status
                                                                    .toLowerCase()
                                                                    .replace(
                                                                        /\s+/g,
                                                                        "-"
                                                                    )
                                                                    }`}
                                                            >

                                                                {item.status}

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
                                            })}

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
                                    <h2>Requests</h2>
                                    <p>Review pending item reservations.</p>
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
                                        placeholder="Search name, ID, item..."
                                        value={requestSearch}
                                        onChange={(e) => setRequestSearch(e.target.value)}
                                        style={{ padding: "8px" }}
                                    />

                                    <button
                                        className="inventory-refresh-button"
                                        onClick={() => setShowAddRequestModal(true)}
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

                                                <th>Reservation ID</th>
                                                <th>Student</th>
                                                <th>Program</th>
                                                <th>Mobile</th>
                                                <th>Items</th>
                                                <th>Total</th>
                                                <th>Purchase Type</th>
                                                <th>Status</th>
                                                <th>Action</th>

                                            </tr>

                                        </thead>

                                        <tbody>

                                            {filteredPending.map((reservation) => (

                                                <tr key={reservation.id}>

                                                    <td>

                                                        <strong>
                                                            {reservation.reservationId}
                                                        </strong>

                                                    </td>

                                                    <td>

                                                        <strong>
                                                            {reservation.fullName}
                                                        </strong>

                                                        <br />

                                                        <small>
                                                            {reservation.studentId}
                                                        </small>

                                                    </td>

                                                    <td>
                                                        {reservation.program.toUpperCase()}
                                                    </td>

                                                    <td>
                                                        {reservation.mobileNumber}
                                                    </td>

                                                    <td>

                                                        {reservation.items.map(
                                                            (item, index) => (

                                                                <div
                                                                    key={index}
                                                                    style={{
                                                                        marginBottom:
                                                                            "6px",
                                                                    }}
                                                                >

                                                                    <strong>
                                                                        {item.itemName}
                                                                    </strong>

                                                                    <br />

                                                                    <small>

                                                                        Size:{" "}
                                                                        {item.size}

                                                                        {" | "}

                                                                        Qty:{" "}
                                                                        {item.quantity}

                                                                    </small>

                                                                </div>

                                                            )
                                                        )}

                                                    </td>

                                                    <td>

                                                        <strong>
                                                            ₱
                                                            {reservation.totalAmount.toLocaleString()}
                                                        </strong>

                                                    </td>

                                                    <td>

                                                        {reservation.items.map(
                                                            (item, index) => (

                                                                <div
                                                                    key={index}
                                                                    style={{
                                                                        marginBottom:
                                                                            "6px",
                                                                    }}
                                                                >
                                                                    {item.purchaseType}
                                                                </div>

                                                            )
                                                        )}

                                                    </td>

                                                    <td>

                                                        <span
                                                            className={`status ${reservation.status.toLowerCase()}`}
                                                        >
                                                            {reservation.status}
                                                        </span>

                                                    </td>

                                                    <td>

                                                        <div
                                                            style={{
                                                                display: "flex",
                                                                gap: "8px",
                                                            }}
                                                        >

                                                            <button
                                                                onClick={() =>
                                                                    updateStatusToPending(
                                                                        reservation.id
                                                                    )
                                                                }
                                                            >
                                                                Accept
                                                            </button>

                                                            <button
                                                                onClick={() => {
                                                                    setSelectedReservationForCancel(
                                                                        reservation
                                                                    );
                                                                    setCancellationReason("");
                                                                    setShowCancelModal(true);
                                                                }}
                                                            >
                                                                Cancel
                                                            </button>

                                                        </div>

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
                {/* RESERVATIONS PAGE */}
                {/* ========================= */}

                {activePage === "Reservations" && (

                    <section className="go-content">

                        <section className="go-panel inventory-page">

                            <div className="inventory-page-header">

                                <div>
                                    <h2>Reservations</h2>
                                    <p>View and manage item reservations.</p>
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

                            {loadingReservations ? (

                                <p className="inventory-message">
                                    Loading reservations...
                                </p>

                            ) : filteredApproved.length === 0 ? (

                                <p className="inventory-message">
                                    No approved reservations found.
                                </p>

                            ) : (

                                <div className="inventory-table-container">

                                    <table className="inventory-table">

                                        <thead>

                                            <tr>

                                                <th>Reservation ID</th>
                                                <th>Student</th>
                                                <th>Mobile</th>
                                                <th>Program</th>
                                                <th>Items</th>
                                                <th>Pickup</th>
                                                <th>Claim Stub ID</th>
                                                <th>Total</th>
                                                <th>Purchase Type</th>
                                                <th>Status</th>
                                                <th>Action</th>

                                            </tr>

                                        </thead>

                                        <tbody>

                                            {filteredApproved.map((reservation) => (

                                                <tr key={reservation.id}>

                                                    <td>

                                                        <strong>
                                                            {reservation.reservationId}
                                                        </strong>

                                                    </td>

                                                    <td>

                                                        <strong>
                                                            {reservation.fullName}
                                                        </strong>

                                                        <br />

                                                        <small>
                                                            ID:{" "}
                                                            {reservation.studentId}
                                                        </small>

                                                    </td>

                                                    <td>
                                                        {reservation.mobileNumber}
                                                    </td>

                                                    <td>
                                                        {reservation.program.toUpperCase()}
                                                    </td>

                                                    <td>

                                                        {reservation.items.map(
                                                            (item, index) => (

                                                                <div
                                                                    key={index}
                                                                    style={{
                                                                        marginBottom:
                                                                            "8px",
                                                                    }}
                                                                >

                                                                    <strong>
                                                                        {item.itemName}
                                                                    </strong>

                                                                    <br />

                                                                    <small>

                                                                        Size:{" "}
                                                                        {item.size}

                                                                        {" | "}

                                                                        Qty:{" "}
                                                                        {item.quantity}

                                                                        {" | "}

                                                                        ₱
                                                                        {item.subtotal.toLocaleString()}

                                                                    </small>

                                                                </div>

                                                            )
                                                        )}

                                                    </td>

                                                    <td>

                                                        <input
                                                            type="date"
                                                            value={
                                                                reservation.pickupDate
                                                            }
                                                            disabled={
                                                                !reservation.claimStubId.trim()
                                                            }
                                                            onChange={(e) =>
                                                                updatePickupDate(
                                                                    reservation.id,
                                                                    e.target.value
                                                                )
                                                            }
                                                            style={{
                                                                opacity:
                                                                    reservation.claimStubId.trim()
                                                                        ? 1
                                                                        : 0.5,
                                                                cursor:
                                                                    reservation.claimStubId.trim()
                                                                        ? "pointer"
                                                                        : "not-allowed",
                                                            }}
                                                        />

                                                    </td>

                                                    <td>

                                                        <strong>
                                                            {reservation.claimStubId}
                                                        </strong>

                                                    </td>

                                                    <td>

                                                        <strong>
                                                            ₱
                                                            {reservation.totalAmount.toLocaleString()}
                                                        </strong>

                                                    </td>

                                                    <td>

                                                        {reservation.items.map(
                                                            (item, index) => (

                                                                <div
                                                                    key={index}
                                                                    style={{
                                                                        marginBottom:
                                                                            "6px",
                                                                    }}
                                                                >
                                                                    {item.purchaseType}
                                                                </div>

                                                            )
                                                        )}

                                                    </td>

                                                    <td>

                                                        <span
                                                            className={`status ${reservation.status.toLowerCase()}`}
                                                        >
                                                            {reservation.status}
                                                        </span>

                                                    </td>

                                                    <td>

                                                        <div
                                                            style={{
                                                                display: "flex",
                                                                gap: "8px",
                                                            }}
                                                        >

                                                            {reservation.status?.toLowerCase() ===
                                                                "approved" ? (

                                                                <button
                                                                    onClick={() =>
                                                                        claimReservation(
                                                                            reservation.id
                                                                        )
                                                                    }
                                                                >
                                                                    Complete
                                                                </button>

                                                            ) : reservation.status?.toLowerCase() ===
                                                                "claimed" ? (

                                                                <button disabled>
                                                                    Claimed
                                                                </button>

                                                            ) : (

                                                                <>

                                                                    <button
                                                                        onClick={() =>
                                                                            completeReservation(
                                                                                reservation.id
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            !reservation.claimStubId.trim()
                                                                        }
                                                                    >
                                                                        Approve
                                                                    </button>

                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedReservationForCancel(
                                                                                reservation
                                                                            );
                                                                            setCancellationReason("");
                                                                            setShowCancelModal(true);
                                                                        }}
                                                                        disabled={
                                                                            !reservation.claimStubId.trim()
                                                                        }
                                                                    >
                                                                        Cancel
                                                                    </button>

                                                                </>
                                                            )}

                                                        </div>

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
                {/* CLAIMED ITEMS PAGE */}
                {/* ========================= */}

                {activePage === "Claiming" && (

                    <section className="go-content">

                        <section className="go-panel inventory-page">

                            <div className="inventory-page-header">

                                <div>
                                    <h2>Claimed Items</h2>
                                    <p>View completed item reservations.</p>
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

                                                <th>Reservation ID</th>
                                                <th>Claim Stub ID</th>
                                                <th>Student</th>
                                                <th>Program</th>
                                                <th>Items</th>
                                                <th>Pickup Date</th>
                                                <th>Claiming Date</th>
                                                <th>Total</th>
                                                <th>Purchase Type</th>
                                                <th>Status</th>

                                            </tr>

                                        </thead>

                                        <tbody>

                                            {filteredClaimed.map((reservation) => (

                                                <tr key={reservation.id}>

                                                    <td>

                                                        <strong>
                                                            {reservation.reservationId}
                                                        </strong>

                                                    </td>

                                                    <td>

                                                        <strong>
                                                            {reservation.claimStubId}
                                                        </strong>

                                                    </td>

                                                    <td>

                                                        <strong>
                                                            {reservation.fullName}
                                                        </strong>

                                                        <br />

                                                        <small>
                                                            ID:{" "}
                                                            {reservation.studentId}
                                                        </small>

                                                    </td>

                                                    <td>
                                                        {reservation.program.toUpperCase()}
                                                    </td>

                                                    <td>

                                                        {reservation.items.map(
                                                            (item, index) => (

                                                                <div
                                                                    key={index}
                                                                    style={{
                                                                        marginBottom:
                                                                            "8px",
                                                                    }}
                                                                >

                                                                    <strong>
                                                                        {item.itemName}
                                                                    </strong>

                                                                    <br />

                                                                    <small>

                                                                        Size:{" "}
                                                                        {item.size}

                                                                        {" | "}

                                                                        Qty:{" "}
                                                                        {item.quantity}

                                                                    </small>

                                                                </div>

                                                            )
                                                        )}

                                                    </td>

                                                    <td>

                                                        <strong>
                                                            {reservation.pickupDate}
                                                        </strong>

                                                    </td>

                                                    <td>

                                                        <strong>

                                                            {reservation.claimedAt
                                                                ? reservation.claimedAt
                                                                    .toDate()
                                                                    .toLocaleString()
                                                                : "Not yet claimed"}

                                                        </strong>

                                                    </td>

                                                    <td>

                                                        <strong>
                                                            ₱
                                                            {reservation.totalAmount.toLocaleString()}
                                                        </strong>

                                                    </td>

                                                    <td>

                                                        {reservation.items.map(
                                                            (item, index) => (

                                                                <div
                                                                    key={index}
                                                                    style={{
                                                                        marginBottom:
                                                                            "6px",
                                                                    }}
                                                                >
                                                                    {item.purchaseType}
                                                                </div>

                                                            )
                                                        )}

                                                    </td>

                                                    <td>

                                                        <span
                                                            className={`status ${reservation.status.toLowerCase()}`}
                                                        >
                                                            {reservation.status}
                                                        </span>

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
                {/* REPORTS PAGE */}
                {/* ========================= */}

                {activePage === "Reports" && (

                    <section className="go-content">

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

                                <div
                                    style={{
                                        display: "flex",
                                        gap: "10px",
                                    }}
                                >

                                    {(["All", "Online", "Walk-in"] as const).map(
                                        (type) => (

                                            <button
                                                key={type}
                                                className="inventory-refresh-button"
                                                onClick={() => setReportType(type)}
                                                style={{
                                                    fontWeight:
                                                        reportType === type
                                                            ? 700
                                                            : 400,
                                                    outline:
                                                        reportType === type
                                                            ? "2px solid #4f46e5"
                                                            : "none",
                                                }}
                                            >
                                                {type === "All"
                                                    ? "Combined"
                                                    : type}
                                            </button>

                                        )
                                    )}

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

                                        {(["Online", "Walk-in", "All"] as const).map(
                                            (type) => {

                                                const stats = getTypeStats(type);

                                                return (

                                                    <tr key={type}>

                                                        <td>

                                                            <strong>
                                                                {type === "All"
                                                                    ? "Combined"
                                                                    : type}
                                                            </strong>

                                                        </td>

                                                        <td>
                                                            {stats.transactions}
                                                        </td>

                                                        <td>
                                                            {stats.quantity}
                                                        </td>

                                                        <td>

                                                            ₱
                                                            {stats.sales.toLocaleString(
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

                                                            ₱
                                                            {stats.average.toLocaleString(
                                                                undefined,
                                                                {
                                                                    minimumFractionDigits:
                                                                        2,
                                                                    maximumFractionDigits:
                                                                        2,
                                                                }
                                                            )}

                                                        </td>

                                                    </tr>

                                                );
                                            }
                                        )}

                                    </tbody>

                                </table>

                            </div>

                        </section>

                        <div className="go-summary">

                            <div className="go-summary-card">

                                <div className="go-card-icon green">
                                    ₱
                                </div>

                                <div>
                                    <p>Total Sales</p>
                                    <h2>
                                        ₱
                                        {totalSales.toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                    </h2>
                                    <span>From claimed reservations</span>
                                </div>

                            </div>

                            <div className="go-summary-card">

                                <div className="go-card-icon blue">
                                    📦
                                </div>

                                <div>
                                    <p>Items Sold</p>
                                    <h2>{totalItemsSold}</h2>
                                    <span>Successfully claimed</span>
                                </div>

                            </div>

                            <div className="go-summary-card">

                                <div className="go-card-icon purple">
                                    📝
                                </div>

                                <div>
                                    <p>Total Reservations</p>
                                    <h2>{reportAllReservations.length}</h2>
                                    <span>All reservations</span>
                                </div>

                            </div>

                            <div className="go-summary-card">

                                <div className="go-card-icon red">
                                    ⚠
                                </div>

                                <div>
                                    <p>Low Stock</p>
                                    <h2>{lowStockItems.length}</h2>
                                    <span>Needs attention</span>
                                </div>

                            </div>

                        </div>

                        <section className="go-panel">

                            <div className="inventory-page-header">

                                <div>
                                    <h2>Inventory Overview</h2>
                                    <p>
                                        Current stock condition and
                                        availability.
                                    </p>
                                </div>

                            </div>

                            <div className="go-summary">

                                <div className="go-summary-card">

                                    <div className="go-card-icon blue">
                                        📦
                                    </div>

                                    <div>
                                        <p>Total Stock</p>
                                        <h2>{totalStock}</h2>
                                        <span>All inventory</span>
                                    </div>

                                </div>

                                <div className="go-summary-card">

                                    <div className="go-card-icon green">
                                        ✓
                                    </div>

                                    <div>
                                        <p>Available Stock</p>
                                        <h2>{totalAvailableStock}</h2>
                                        <span>After reservations</span>
                                    </div>

                                </div>

                                <div className="go-summary-card">

                                    <div className="go-card-icon purple">
                                        📝
                                    </div>

                                    <div>
                                        <p>Reserved Stock</p>
                                        <h2>{totalReservedStock}</h2>
                                        <span>Currently reserved</span>
                                    </div>

                                </div>

                                <div className="go-summary-card">

                                    <div className="go-card-icon green">
                                        ₱
                                    </div>

                                    <div>
                                        <p>Average Transaction</p>
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
                                        <span>Per claimed reservation</span>
                                    </div>

                                </div>

                            </div>

                        </section>

                        <section className="go-panel">

                            <div className="inventory-page-header">

                                <div>
                                    <h2>Reservation Status</h2>
                                    <p>
                                        Overview of reservation processing.
                                    </p>
                                </div>

                            </div>

                            <div className="inventory-table-container">

                                <table className="inventory-table">

                                    <thead>
                                        <tr>
                                            <th>Status</th>
                                            <th>Number of Reservations</th>
                                        </tr>
                                    </thead>

                                    <tbody>

                                        <tr>
                                            <td>Pending</td>
                                            <td>{reportPending.length}</td>
                                        </tr>

                                        <tr>
                                            <td>Approved</td>
                                            <td>{reportApproved.length}</td>
                                        </tr>

                                        <tr>
                                            <td>Claimed</td>
                                            <td>{reportClaimed.length}</td>
                                        </tr>

                                        <tr>
                                            <td>Cancelled</td>
                                            <td>{reportCancelled.length}</td>
                                        </tr>

                                    </tbody>

                                </table>

                            </div>

                        </section>

                        <section className="go-panel">

                            <div className="inventory-page-header">

                                <div>
                                    <h2>Top Items</h2>
                                    <p>
                                        Most sold items based on completed
                                        reservations.
                                    </p>
                                </div>

                            </div>

                            <div className="inventory-table-container">

                                <table className="inventory-table">

                                    <thead>
                                        <tr>
                                            <th>Rank</th>
                                            <th>Item</th>
                                            <th>Quantity Sold</th>
                                            <th>Sales</th>
                                        </tr>
                                    </thead>

                                    <tbody>

                                        {topItems.length === 0 ? (

                                            <tr>

                                                <td
                                                    colSpan={4}
                                                    style={{
                                                        textAlign: "center",
                                                    }}
                                                >
                                                    No sales data yet.
                                                </td>

                                            </tr>

                                        ) : (

                                            topItems.map((item, index) => (

                                                <tr key={item.itemName}>

                                                    <td>{index + 1}</td>

                                                    <td>
                                                        <strong>
                                                            {item.itemName}
                                                        </strong>
                                                    </td>

                                                    <td>{item.quantity}</td>

                                                    <td>

                                                        ₱
                                                        {item.sales.toLocaleString(
                                                            undefined,
                                                            {
                                                                minimumFractionDigits:
                                                                    2,
                                                                maximumFractionDigits:
                                                                    2,
                                                            }
                                                        )}

                                                    </td>

                                                </tr>

                                            ))

                                        )}

                                    </tbody>

                                </table>

                            </div>

                        </section>

                        <section className="go-panel">

                            <div className="inventory-page-header">

                                <div>
                                    <h2>Low Stock Items</h2>
                                    <p>
                                        Items with 5 or fewer available
                                        units.
                                    </p>
                                </div>

                            </div>

                            <div className="inventory-table-container">

                                <table className="inventory-table">

                                    <thead>
                                        <tr>
                                            <th>Item</th>
                                            <th>Size</th>
                                            <th>Total Stock</th>
                                            <th>Reserved</th>
                                            <th>Available</th>
                                        </tr>
                                    </thead>

                                    <tbody>

                                        {lowStockItems.length === 0 ? (

                                            <tr>

                                                <td
                                                    colSpan={5}
                                                    style={{
                                                        textAlign: "center",
                                                    }}
                                                >
                                                    No low stock items.
                                                </td>

                                            </tr>

                                        ) : (

                                            lowStockItems.map((item) => (

                                                <tr key={item.id}>

                                                    <td>
                                                        <strong>
                                                            {item.itemName}
                                                        </strong>
                                                    </td>

                                                    <td>{item.size}</td>

                                                    <td>{item.totalStock}</td>

                                                    <td>
                                                        {item.reservedQuantity}
                                                    </td>

                                                    <td>

                                                        <strong>
                                                            {getAvailable(item)}
                                                        </strong>

                                                    </td>

                                                </tr>

                                            ))

                                        )}

                                    </tbody>

                                </table>

                            </div>

                        </section>

                        <section className="go-panel">

                            <div className="inventory-page-header">

                                <div>
                                    <h2>Recent Transactions</h2>
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
                                            <th>Reservation ID</th>
                                            <th>Student</th>
                                            <th>Items</th>
                                            <th>Amount</th>
                                            <th>Pickup Date</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>

                                    <tbody>

                                        {reportClaimed.length === 0 ? (

                                            <tr>

                                                <td
                                                    colSpan={6}
                                                    style={{
                                                        textAlign: "center",
                                                    }}
                                                >
                                                    No completed transactions
                                                    yet.
                                                </td>

                                            </tr>

                                        ) : (

                                            reportClaimed
                                                .slice(0, 10)
                                                .map((reservation) => (

                                                    <tr key={reservation.id}>

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

                                                            {getReportItems(
                                                                reservation
                                                            )
                                                                .map(
                                                                    (item) =>
                                                                        `${item.itemName} (${item.quantity})`
                                                                )
                                                                .join(", ")}

                                                        </td>

                                                        <td>

                                                            <strong>

                                                                ₱
                                                                {getReportAmount(
                                                                    reservation
                                                                ).toLocaleString(
                                                                    undefined,
                                                                    {
                                                                        minimumFractionDigits:
                                                                            2,
                                                                        maximumFractionDigits:
                                                                            2,
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

                                                ))

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
                                        <option value="Unpaid">Unpaid</option>
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

                                            {filteredTransactions.map(
                                                (reservation) => (

                                                    <tr key={reservation.id}>

                                                        <td>

                                                            <strong>
                                                                {
                                                                    reservation.reservationId
                                                                }
                                                            </strong>

                                                        </td>

                                                        <td>
                                                            {
                                                                reservation.claimStubId ||
                                                                "—"
                                                            }
                                                        </td>

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

                                                        <td>

                                                            {reservation.items.map(
                                                                (item, index) => (

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

                                                                            {" | "}

                                                                            {
                                                                                item.purchaseType
                                                                            }

                                                                        </small>

                                                                    </div>

                                                                )
                                                            )}

                                                        </td>

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

                                                        <td>

                                                            <strong>

                                                                ₱
                                                                {reservation.totalAmount.toLocaleString(
                                                                    undefined,
                                                                    {
                                                                        minimumFractionDigits:
                                                                            2,
                                                                        maximumFractionDigits:
                                                                            2,
                                                                    }
                                                                )}

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

                                                            {reservation.status.toLowerCase() ===
                                                                "cancelled"
                                                                ? reservation.cancellationReason ||
                                                                "—"
                                                                : "—"}

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
                {/* OTHER PAGES */}
                {/* ========================= */}

                {activePage !== "Dashboard" &&
                    activePage !== "Inventory" &&
                    activePage !== "Requests" &&
                    activePage !== "Reservations" &&
                    activePage !== "Claiming" &&
                    activePage !== "Reports" &&
                    activePage !== "Transactions" &&
                    activePage !== "Messages" && (

                        <section className="go-content">

                            <section className="go-panel">

                                <h2>{activePage}</h2>

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
                            backgroundColor: "rgba(0, 0, 0, 0.45)",
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
                                boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
                            }}
                        >

                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: "20px",
                                }}
                            >

                                <div>

                                    <h2 style={{ margin: 0 }}>
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
                                    onClick={() => setShowAddRequestModal(false)}
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

                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                        "repeat(2, minmax(0, 1fr))",
                                    gap: "16px",
                                }}
                            >

                                <div>

                                    <label>Reservation ID</label>

                                    <input
                                        type="text"
                                        value={newRequest.reservationId}
                                        placeholder="Leave blank to auto-generate"
                                        onChange={(e) =>
                                            setNewRequest((previous) => ({
                                                ...previous,
                                                reservationId:
                                                    e.target.value,
                                            }))
                                        }
                                        style={{
                                            width: "100%",
                                            padding: "10px",
                                            marginTop: "6px",
                                        }}
                                    />

                                </div>

                                <div>

                                    <label>Claim Stub ID</label>

                                    <input
                                        type="text"
                                        value={newRequest.claimStubId}
                                        placeholder="Leave blank for pending request"
                                        onChange={(e) =>
                                            setNewRequest((previous) => ({
                                                ...previous,
                                                claimStubId:
                                                    e.target.value,
                                            }))
                                        }
                                        style={{
                                            width: "100%",
                                            padding: "10px",
                                            marginTop: "6px",
                                        }}
                                    />

                                </div>

                                <div>

                                    <label>Full Name *</label>

                                    <input
                                        type="text"
                                        value={newRequest.fullName}
                                        onChange={(e) =>
                                            setNewRequest((previous) => ({
                                                ...previous,
                                                fullName: e.target.value,
                                            }))
                                        }
                                        style={{
                                            width: "100%",
                                            padding: "10px",
                                            marginTop: "6px",
                                        }}
                                    />

                                </div>

                                <div>

                                    <label>Student ID *</label>

                                    <input
                                        type="text"
                                        value={newRequest.studentId}
                                        onChange={(e) =>
                                            setNewRequest((previous) => ({
                                                ...previous,
                                                studentId: e.target.value,
                                            }))
                                        }
                                        style={{
                                            width: "100%",
                                            padding: "10px",
                                            marginTop: "6px",
                                        }}
                                    />

                                </div>

                                <div>

                                    <label>Mobile Number *</label>

                                    <input
                                        type="text"
                                        value={newRequest.mobileNumber}
                                        onChange={(e) =>
                                            setNewRequest((previous) => ({
                                                ...previous,
                                                mobileNumber:
                                                    e.target.value,
                                            }))
                                        }
                                        style={{
                                            width: "100%",
                                            padding: "10px",
                                            marginTop: "6px",
                                        }}
                                    />

                                </div>

                                <div>

                                    <label>Program *</label>

                                    <input
                                        type="text"
                                        value={newRequest.program}
                                        placeholder="e.g. BSIT"
                                        onChange={(e) =>
                                            setNewRequest((previous) => ({
                                                ...previous,
                                                program: e.target.value,
                                            }))
                                        }
                                        style={{
                                            width: "100%",
                                            padding: "10px",
                                            marginTop: "6px",
                                        }}
                                    />

                                </div>

                                <div>

                                    <label>Pickup Date *</label>

                                    <input
                                        type="date"
                                        value={newRequest.pickupDate}
                                        onChange={(e) =>
                                            setNewRequest((previous) => ({
                                                ...previous,
                                                pickupDate:
                                                    e.target.value,
                                            }))
                                        }
                                        style={{
                                            width: "100%",
                                            padding: "10px",
                                            marginTop: "6px",
                                        }}
                                    />

                                </div>

                                <div>

                                    <label>Pickup Time *</label>

                                    <select
                                        value={newRequest.pickupTime}
                                        onChange={(e) =>
                                            setNewRequest((previous) => ({
                                                ...previous,
                                                pickupTime:
                                                    e.target.value,
                                            }))
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

                                    <label>Status *</label>

                                    <select
                                        value={newRequest.status}
                                        onChange={(e) =>
                                            setNewRequest((previous) => ({
                                                ...previous,
                                                status: e.target.value,
                                            }))
                                        }
                                        style={{
                                            width: "100%",
                                            padding: "10px",
                                            marginTop: "6px",
                                        }}
                                    >
                                        <option value="Unpaid">Unpaid</option>
                                        <option value="Pending">Pending</option>
                                    </select>

                                </div>

                                <div>

                                    <label>Total Amount</label>

                                    <input
                                        type="number"
                                        value={newRequest.totalAmount}
                                        readOnly
                                        style={{
                                            width: "100%",
                                            padding: "10px",
                                            marginTop: "6px",
                                            background: "#f5f7fa",
                                        }}
                                    />

                                </div>

                            </div>

                            <div style={{ marginTop: "24px" }}>

                                <h3>Requested Items</h3>

                                <p style={{ color: "#71849a" }}>
                                    Add at least one item to the request.
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

                                        <label>Inventory Item *</label>

                                        <select
                                            value={newRequestItem.inventoryId}
                                            onChange={(e) => {
                                                const selectedItem =
                                                    inventory.find(
                                                        (item) =>
                                                            item.id ===
                                                            e.target.value
                                                    );

                                                setNewRequestItem({
                                                    inventoryId:
                                                        selectedItem?.id || "",
                                                    itemName:
                                                        selectedItem?.itemName ||
                                                        "",
                                                    price: Number(
                                                        selectedItem?.price || 0
                                                    ),
                                                    quantity: 1,
                                                    size:
                                                        selectedItem?.size || "",
                                                    subtotal: Number(
                                                        selectedItem?.price || 0
                                                    ),
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

                                            {inventory.map((item) => (

                                                <option
                                                    key={item.id}
                                                    value={item.id}
                                                >

                                                    {item.itemName} -
                                                    {item.size} - ₱
                                                    {Number(
                                                        item.price || 0
                                                    ).toLocaleString()}
                                                    {" | Avail: "}
                                                    {Math.max(
                                                        0,
                                                        Number(
                                                            item.totalStock || 0
                                                        ) -
                                                        Number(
                                                            item.reservedQuantity ||
                                                            0
                                                        )
                                                    )}

                                                </option>

                                            ))}

                                        </select>

                                    </div>

                                    <div>

                                        <label>Item Name *</label>

                                        <input
                                            type="text"
                                            value={newRequestItem.itemName}
                                            readOnly
                                            style={{
                                                width: "100%",
                                                padding: "10px",
                                                marginTop: "6px",
                                                background: "#f5f7fa",
                                            }}
                                        />

                                    </div>

                                    <div>

                                        <label>Size *</label>

                                        <input
                                            type="text"
                                            value={newRequestItem.size}
                                            readOnly
                                            style={{
                                                width: "100%",
                                                padding: "10px",
                                                marginTop: "6px",
                                                background: "#f5f7fa",
                                            }}
                                        />

                                    </div>

                                    <div>

                                        <label>Price</label>

                                        <input
                                            type="number"
                                            value={newRequestItem.price}
                                            readOnly
                                            style={{
                                                width: "100%",
                                                padding: "10px",
                                                marginTop: "6px",
                                                background: "#f5f7fa",
                                            }}
                                        />

                                    </div>

                                    <div>

                                        <label>Purchase Type *</label>

                                        <select
                                            value={newRequestItem.purchaseType}
                                            onChange={(e) =>
                                                setNewRequestItem(
                                                    (previous) => ({
                                                        ...previous,
                                                        purchaseType:
                                                            e.target
                                                                .value as
                                                            | "Online"
                                                            | "Walk-in",
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

                                        <label>Quantity *</label>

                                        <input
                                            type="number"
                                            min="1"
                                            value={newRequestItem.quantity}
                                            onChange={(e) => {

                                                const quantity =
                                                    Math.max(
                                                        1,
                                                        Number(
                                                            e.target.value || 1
                                                        )
                                                    );

                                                setNewRequestItem(
                                                    (previous) => ({
                                                        ...previous,
                                                        quantity: quantity,
                                                        subtotal:
                                                            Number(
                                                                previous.price ||
                                                                0
                                                            ) * quantity,
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
                                        onClick={addRequestItem}
                                        style={{
                                            padding: "10px 14px",
                                            cursor: "pointer",
                                            border: "none",
                                            borderRadius: "6px",
                                            background: "#4f46e5",
                                            color: "#ffffff",
                                        }}
                                    >
                                        + Add
                                    </button>

                                </div>

                                <div style={{ marginTop: "18px" }}>

                                    {newRequest.items.length === 0 ? (

                                        <p style={{ color: "#71849a" }}>
                                            No items added yet.
                                        </p>

                                    ) : (

                                        <div className="inventory-table-container">

                                            <table className="inventory-table">

                                                <thead>

                                                    <tr>

                                                        <th>Item</th>
                                                        <th>Size</th>
                                                        <th>Price</th>
                                                        <th>Quantity</th>
                                                        <th>Purchase Type</th>
                                                        <th>Subtotal</th>
                                                        <th>Action</th>

                                                    </tr>

                                                </thead>

                                                <tbody>

                                                    {newRequest.items.map(
                                                        (item, index) => (

                                                            <tr key={index}>

                                                                <td>
                                                                    {
                                                                        item.itemName
                                                                    }
                                                                </td>

                                                                <td>
                                                                    {item.size}
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

                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "flex-end",
                                    gap: "10px",
                                    marginTop: "24px",
                                }}
                            >

                                <button
                                    type="button"
                                    onClick={() => setShowAddRequestModal(false)}
                                    style={{
                                        padding: "10px 18px",
                                        cursor: "pointer",
                                    }}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    onClick={addNewRequest}
                                    style={{
                                        padding: "10px 18px",
                                        cursor: "pointer",
                                        border: "none",
                                        borderRadius: "6px",
                                        background: "#4f46e5",
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
                {/* CANCEL RESERVATION MODAL */}
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
                                Please provide a reason for cancelling
                                this reservation.
                            </p>

                            <p>

                                <strong>
                                    Reservation ID:
                                </strong>{" "}

                                {
                                    selectedReservationForCancel.reservationId
                                }

                            </p>

                            {selectedReservationForCancel.status?.toLowerCase() ===
                                "approved" && (

                                    <p
                                        style={{
                                            color: "#b91c1c",
                                            fontSize: "14px",
                                        }}
                                    >

                                        ⚠ This reservation is already
                                        approved. Cancelling it will
                                        restore the deducted stock.

                                    </p>

                                )}

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

                {/* ========================= */}
                {/* EDIT STOCK MODAL */}
                {/* ========================= */}

                {showEditStockModal && selectedInventoryItem && (

                    <div
                        style={{
                            position: "fixed",
                            inset: 0,
                            backgroundColor: "rgba(0, 0, 0, 0.45)",
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
                                boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                            }}
                        >

                            <h2>Edit Stock</h2>

                            <p
                                style={{
                                    color: "#666",
                                    marginBottom: "20px",
                                }}
                            >

                                Available is calculated automatically:
                                Total Stock − Reserved.

                            </p>

                            <div style={{ marginBottom: "15px" }}>

                                <label>Item</label>

                                <input
                                    type="text"
                                    value={`${selectedInventoryItem.itemName} - ${selectedInventoryItem.size}`}
                                    readOnly
                                    style={{
                                        width: "100%",
                                        padding: "10px",
                                        marginTop: "5px",
                                        boxSizing: "border-box",
                                    }}
                                />

                            </div>

                            <div style={{ marginBottom: "15px" }}>

                                <label>Price</label>

                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editStock.price}
                                    onChange={(e) =>
                                        setEditStock({
                                            ...editStock,
                                            price: Number(e.target.value),
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

                            <div style={{ marginBottom: "15px" }}>

                                <label>Total Stock</label>

                                <input
                                    type="number"
                                    min="0"
                                    value={editStock.totalStock}
                                    onChange={(e) =>
                                        setEditStock({
                                            ...editStock,
                                            totalStock: Number(
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

                            <div style={{ marginBottom: "15px" }}>

                                <label>Reserved Quantity</label>

                                <input
                                    type="number"
                                    min="0"
                                    value={editStock.reservedQuantity}
                                    onChange={(e) =>
                                        setEditStock({
                                            ...editStock,
                                            reservedQuantity: Number(
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

                                <small
                                    style={{
                                        color: "#71849a",
                                        display: "block",
                                        marginTop: "4px",
                                    }}
                                >

                                    Cannot be greater than Total Stock.

                                </small>

                            </div>

                            <div style={{ marginBottom: "20px" }}>

                                <label>Available (calculated)</label>

                                <input
                                    type="number"
                                    value={Math.max(
                                        0,
                                        editStock.totalStock -
                                        editStock.reservedQuantity
                                    )}
                                    readOnly
                                    style={{
                                        width: "100%",
                                        padding: "10px",
                                        marginTop: "5px",
                                        boxSizing: "border-box",
                                        background: "#f5f7fa",
                                    }}
                                />

                            </div>

                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "flex-end",
                                    gap: "10px",
                                }}
                            >

                                <button
                                    onClick={() => {
                                        setShowEditStockModal(false);
                                        setSelectedInventoryItem(null);
                                    }}
                                >
                                    Cancel
                                </button>

                                <button onClick={saveEditedStock}>
                                    Save Changes
                                </button>

                            </div>

                        </div>

                    </div>

                )}

                {/* ========================= */}
                {/* MESSAGES PAGE */}
                {/* ========================= */}

                {activePage === "Messages" && (
                    <section className="go-content">
                        <MessagesPanel
                            mode="staff"
                            office="general_office"
                            staffName={account.name || "Supply Office"}
                        />
                    </section>
                )}

            </main>

        </div>

    );
}

export default GeneralOfficeDashboard;