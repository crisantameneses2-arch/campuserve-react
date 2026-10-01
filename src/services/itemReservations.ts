import {
  collection,
  doc,
  getDocs,
  runTransaction,
  Timestamp,
} from "firebase/firestore";

import { db } from "../../firebase";

export type InventoryItem = {
  id: string;
  itemName: string;
  size: string;
  totalStock: number;
  onlineStock: number;
  walkInStock: number;
  availableOnline: number;
  availableWalkIn: number;
  reservedQuantity: number;
  status: string;
};

export type ReservationCartItem = {
  inventoryId: string;
  itemName: string;
  size: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type ClaimingSchedule = {
  id: string;
  claimDate: string;
  timeSlot: string;
  slotCapacity: number;
  availableSlot: number;
};

export async function getInventory(): Promise<InventoryItem[]> {
  const snapshot = await getDocs(
    collection(db, "inventory")
  );

  return snapshot.docs.map((document) => ({
    id: document.id,
    ...(document.data() as Omit<InventoryItem, "id">),
  }));
}

export async function getClaimingSchedules(): Promise<
  ClaimingSchedule[]
> {
  const snapshot = await getDocs(
    collection(db, "claimingSchedules")
  );

  return snapshot.docs.map((document) => ({
    id: document.id,
    ...(document.data() as Omit<
      ClaimingSchedule,
      "id"
    >),
  }));
}

export async function createItemReservation(
  studentId: string,
  schedule: ClaimingSchedule,
  cartItems: ReservationCartItem[]
) {
  if (cartItems.length === 0) {
    throw new Error(
      "Your reservation has no items."
    );
  }

  const reservationRef = doc(
    collection(db, "itemReservations")
  );

  const reservationDetailCollection = collection(
    db,
    "itemReservationDetails"
  );

  const reservationId = `IR-${Date.now()}`;

  const totalAmount = cartItems.reduce(
    (total, item) => total + item.subtotal,
    0
  );

  await runTransaction(db, async (transaction) => {
    // ----------------------------------------
    // READ ALL INVENTORY FIRST
    // ----------------------------------------

    const inventoryReferences = cartItems.map(
      (item) =>
        doc(db, "inventory", item.inventoryId)
    );

    const inventorySnapshots = [];

    for (const inventoryRef of inventoryReferences) {
      const snapshot =
        await transaction.get(inventoryRef);

      if (!snapshot.exists()) {
        throw new Error(
          "One of the selected inventory items no longer exists."
        );
      }

      inventorySnapshots.push(snapshot);
    }

    // ----------------------------------------
    // READ CLAIMING SCHEDULE
    // ----------------------------------------

    const scheduleRef = doc(
      db,
      "claimingSchedules",
      schedule.id
    );

    const scheduleSnapshot =
      await transaction.get(scheduleRef);

    if (!scheduleSnapshot.exists()) {
      throw new Error(
        "The selected claiming schedule no longer exists."
      );
    }

    const currentSchedule =
      scheduleSnapshot.data();

    if (
      (currentSchedule.availableSlot ?? 0) <= 0
    ) {
      throw new Error(
        "The selected claiming schedule is already full."
      );
    }

    // ----------------------------------------
    // CHECK INVENTORY
    // ----------------------------------------

    for (
      let index = 0;
      index < cartItems.length;
      index++
    ) {
      const cartItem = cartItems[index];

      const inventoryData =
        inventorySnapshots[index].data();

      const available =
        inventoryData?.availableOnline ?? 0;

      if (available < cartItem.quantity) {
        throw new Error(
          `${cartItem.itemName} (${cartItem.size}) does not have enough online stock.`
        );
      }
    }

    // ----------------------------------------
    // CREATE RESERVATION
    // ----------------------------------------

    transaction.set(reservationRef, {
      reservationId,
      studentId,

      requestedDate: schedule.claimDate,
      requestedTime: schedule.timeSlot,

      scheduleId: schedule.id,

      status: "PENDING",

      totalAmount,

      createdAt: Timestamp.now(),
    });

    // ----------------------------------------
    // CREATE RESERVATION DETAILS
    // ----------------------------------------

    for (const cartItem of cartItems) {
      const detailRef = doc(
        reservationDetailCollection
      );

      transaction.set(detailRef, {
        reservationId,

        inventoryId: cartItem.inventoryId,

        itemName: cartItem.itemName,
        size: cartItem.size,

        quantity: cartItem.quantity,

        unitPrice: cartItem.unitPrice,
        subtotal: cartItem.subtotal,

        createdAt: Timestamp.now(),
      });
    }

    // ----------------------------------------
    // UPDATE INVENTORY
    // ----------------------------------------

    for (
      let index = 0;
      index < cartItems.length;
      index++
    ) {
      const cartItem = cartItems[index];

      const inventoryRef =
        inventoryReferences[index];

      const inventoryData =
        inventorySnapshots[index].data();

      const oldAvailable =
        inventoryData?.availableOnline ?? 0;

      const oldReserved =
        inventoryData?.reservedQuantity ?? 0;

      transaction.update(inventoryRef, {
        availableOnline:
          oldAvailable - cartItem.quantity,

        reservedQuantity:
          oldReserved + cartItem.quantity,

        status:
          oldAvailable -
            cartItem.quantity <=
          0
            ? "full"
            : "available",
      });
    }

    // ----------------------------------------
    // UPDATE CLAIMING SLOT
    // ----------------------------------------

    const oldAvailableSlots =
      currentSchedule.availableSlot ?? 0;

    transaction.update(scheduleRef, {
      availableSlot:
        oldAvailableSlots - 1,
    });
  });

  return reservationId;
}