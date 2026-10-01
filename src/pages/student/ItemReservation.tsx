import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../../firebase";

import "./ItemReservation.css";

type InventoryItem = {
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

  price?: number;
};

type CartItem = {
  inventoryId: string;
  itemName: string;
  size: string;
  quantity: number;
  price: number;
};

type ItemReservationProps = {
  studentId: string;
  onBack: () => void;
};

const categories = [
  "All",
  "ID Lace",
  "PE Uniform",
  "University Uniform",
  "Others",
];

const timeWindows = [
  "8:00AM - 10:00AM",
  "10:00AM - 12:00PM",
  "1:00PM - 3:00PM",
  "3:00PM - 5:00PM",
];

function getCategory(itemName: string) {
  const name = itemName.toLowerCase();

  if (name.includes("id lace")) {
    return "ID Lace";
  }

  if (name.includes("pe ")) {
    return "PE Uniform";
  }

  if (name.includes("female") || name.includes("male")) {
    return "University Uniform";
  }

  return "Others";
}

export default function ItemReservation({
  studentId,
  onBack,
}: ItemReservationProps) {
  // =========================
  // STATE
  // =========================

  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  const [selectedCategory, setSelectedCategory] =
    useState("All");

  const [selectedItem, setSelectedItem] =
    useState<string | null>(null);

  const [selectedSize, setSelectedSize] =
    useState<string | null>(null);

  const [quantity, setQuantity] = useState(1);

  const [cart, setCart] = useState<CartItem[]>([]);

  const [showCheckout, setShowCheckout] =
    useState(false);

  const [loading, setLoading] = useState(true);

  const [reserving, setReserving] = useState(false);

  // Student information
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [program, setProgram] = useState("");

  // Pickup information
  const [pickupDate, setPickupDate] = useState("");
  const [selectedTime, setSelectedTime] =
    useState<string | null>(null);

  // =========================
  // LOAD INVENTORY
  // =========================

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "inventory"),
      (snapshot) => {
        const items: InventoryItem[] =
          snapshot.docs.map((inventoryDoc) => ({
            id: inventoryDoc.id,
            ...(inventoryDoc.data() as Omit<
              InventoryItem,
              "id"
            >),
          }));

        setInventory(items);
        setLoading(false);
      },
      (error) => {
        console.error(
          "Error loading inventory:",
          error
        );

        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // =========================
  // FILTER INVENTORY
  // =========================

  const filteredInventory = useMemo(() => {
    if (selectedCategory === "All") {
      return inventory;
    }

    return inventory.filter(
      (item) =>
        getCategory(item.itemName) ===
        selectedCategory
    );
  }, [inventory, selectedCategory]);

  // =========================
  // UNIQUE ITEMS
  // =========================

  const reservationItems = useMemo(() => {
    const seen = new Set<string>();

    return filteredInventory.filter((item) => {
      if (seen.has(item.itemName)) {
        return false;
      }

      seen.add(item.itemName);

      return true;
    });
  }, [filteredInventory]);

  // =========================
  // SELECTED ITEM SIZES
  // =========================

  const selectedItemSizes = useMemo(() => {
    if (!selectedItem) {
      return [];
    }

    return inventory.filter(
      (item) => item.itemName === selectedItem
    );
  }, [inventory, selectedItem]);

  // =========================
  // SELECTED INVENTORY
  // =========================

  const selectedInventory = useMemo(() => {
    if (!selectedItem || !selectedSize) {
      return null;
    }

    return (
      inventory.find(
        (item) =>
          item.itemName === selectedItem &&
          item.size === selectedSize
      ) || null
    );
  }, [
    inventory,
    selectedItem,
    selectedSize,
  ]);

  // =========================
  // CART TOTAL
  // =========================

  const cartTotal = useMemo(() => {
    return cart.reduce(
      (total, item) =>
        total + item.price * item.quantity,
      0
    );
  }, [cart]);

  // =========================
  // DATE LIMITS
  // =========================

  const today = new Date();

  const maxDate = new Date();
  maxDate.setDate(today.getDate() + 14);

  const formatDate = (date: Date) => {
    return date.toISOString().split("T")[0];
  };

  // =========================
  // RESERVE
  // =========================

  const handleReserve = async () => {
    if (reserving) {
      return;
    }

    // Validate student information
    if (!fullName.trim()) {
      window.alert("Please enter your full name.");
      return;
    }

    if (!mobileNumber.trim()) {
      window.alert("Please enter your mobile number.");
      return;
    }

    if (!program.trim()) {
      window.alert("Please enter your program.");
      return;
    }

    // Validate pickup information
    if (!pickupDate) {
      window.alert("Please select a pickup date.");
      return;
    }

    if (!selectedTime) {
      window.alert("Please select a time window.");
      return;
    }

    // Validate cart
    if (cart.length === 0) {
      window.alert("Your reservation is empty.");
      return;
    }

    try {
      setReserving(true);

      // Create reservation document
      const reservationRef = doc(
        collection(db, "itemReservations")
      );

      const reservationId = reservationRef.id;

      await runTransaction(
        db,
        async (transaction) => {
          // ========================================
          // GET ALL INVENTORY REFERENCES
          // ========================================

          const inventoryRefs = cart.map((item) =>
            doc(
              db,
              "inventory",
              item.inventoryId
            )
          );

          // ========================================
          // READ ALL INVENTORY DOCUMENTS
          // ========================================

          const inventorySnapshots =
            await Promise.all(
              inventoryRefs.map(
                (inventoryRef) =>
                  transaction.get(inventoryRef)
              )
            );

          // ========================================
          // CHECK STOCK
          // ========================================

          for (
            let i = 0;
            i < cart.length;
            i++
          ) {
            const cartItem = cart[i];

            const inventorySnapshot =
              inventorySnapshots[i];

            if (!inventorySnapshot.exists()) {
              throw new Error(
                `${cartItem.itemName} (${cartItem.size}) is no longer available.`
              );
            }

            const inventoryData =
              inventorySnapshot.data();

            const availableOnline = Number(
              inventoryData.availableOnline ?? 0
            );

            if (
              availableOnline <
              cartItem.quantity
            ) {
              throw new Error(
                `Not enough online stock for ${cartItem.itemName} (${cartItem.size}). Available: ${availableOnline}.`
              );
            }
          }

          // ========================================
          // UPDATE INVENTORY
          // ========================================

          for (
            let i = 0;
            i < cart.length;
            i++
          ) {
            const cartItem = cart[i];

            const inventorySnapshot =
              inventorySnapshots[i];

            if (!inventorySnapshot.exists()) {
              throw new Error(
                `${cartItem.itemName} (${cartItem.size}) no longer exists in inventory.`
              );
            }

            const inventoryData =
              inventorySnapshot.data();

            const availableOnline = Number(
              inventoryData.availableOnline ?? 0
            );

            const reservedQuantity = Number(
              inventoryData.reservedQuantity ?? 0
            );

            const newAvailableOnline =
              availableOnline -
              cartItem.quantity;

            const newReservedQuantity =
              reservedQuantity +
              cartItem.quantity;

            transaction.update(
              inventoryRefs[i],
              {
                availableOnline:
                  newAvailableOnline,

                reservedQuantity:
                  newReservedQuantity,

                status:
                  newAvailableOnline <= 0
                    ? "Out of Stock"
                    : "Available",
              }
            );
          }

          // ========================================
          // CREATE RESERVATION
          // ========================================

          transaction.set(
            reservationRef,
            {
              reservationId,

              studentId,

              fullName:
                fullName.trim(),

              mobileNumber:
                mobileNumber.trim(),

              program:
                program.trim(),

              items: cart.map(
                (item) => ({
                  inventoryId:
                    item.inventoryId,

                  itemName:
                    item.itemName,

                  size:
                    item.size,

                  quantity:
                    item.quantity,

                  price:
                    item.price,

                  subtotal:
                    item.price *
                    item.quantity,
                })
              ),

              totalAmount:
                cart.reduce(
                  (total, item) =>
                    total +
                    item.price *
                      item.quantity,
                  0
                ),

              pickupDate,

              pickupTime:
                selectedTime,

              status: "Pending",

              createdAt:
                serverTimestamp(),
            }
          );
        }
      );

      // ========================================
      // SUCCESS
      // ========================================

      window.alert(
        `Reservation successful!\n\nReservation ID: ${reservationId}`
      );

      // Clear reservation data
      setCart([]);

      setFullName("");
      setMobileNumber("");
      setProgram("");

      setPickupDate("");
      setSelectedTime(null);

      setSelectedItem(null);
      setSelectedSize(null);
      setQuantity(1);

      setShowCheckout(false);

      // Return to dashboard
      onBack();
    } catch (error) {
      console.error(
        "Reservation failed:",
        error
      );

      if (error instanceof Error) {
        window.alert(error.message);
      } else {
        window.alert(
          "Something went wrong while creating your reservation."
        );
      }
    } finally {
      setReserving(false);
    }
  };

  // =========================
  // LOADING
  // =========================

  if (loading) {
    return (
      <div className="reservation-page">
        <p>
          Loading available items...
        </p>
      </div>
    );
  }

  // =========================
  // CHECKOUT PAGE
  // =========================

  if (showCheckout) {
    return (
      <div className="reservation-page">
        <div className="reservation-checkout">

          {/* HEADER */}

          <div className="checkout-header">
            <button
              type="button"
              className="back-button"
              onClick={() =>
                setShowCheckout(false)
              }
            >
              ← Back
            </button>

            <h1>
              Reservation
            </h1>
          </div>

          {/* ITEMS */}

          <div className="checkout-items">

            <div className="checkout-items-header">
              <span>
                Reservation
              </span>

              <button
                type="button"
                onClick={() => {
                  setShowCheckout(false);
                  setSelectedItem(null);
                  setSelectedSize(null);
                  setQuantity(1);
                }}
              >
                Edit
              </button>
            </div>

            {cart.map(
              (item, index) => (
                <div
                  className="checkout-item"
                  key={`${item.inventoryId}-${index}`}
                >
                  <div>
                    <strong>
                      {item.size !== "N/A"
                        ? `(${item.size}) `
                        : ""}

                      {item.itemName}

                      {" x "}

                      {item.quantity}
                    </strong>
                  </div>

                  <span>
                    ₱
                    {(
                      item.price *
                      item.quantity
                    ).toLocaleString(
                      "en-PH",
                      {
                        minimumFractionDigits: 0,
                      }
                    )}
                  </span>
                </div>
              )
            )}

            <div className="checkout-total">
              <span>
                Php{" "}
                {cartTotal.toLocaleString(
                  "en-PH",
                  {
                    minimumFractionDigits: 0,
                  }
                )}
              </span>
            </div>
          </div>

          {/* STUDENT */}

          <div className="checkout-section">
            <h3>
              STUDENT
            </h3>

            <div className="student-field">
              <label>
                Full Name
              </label>

              <input
                type="text"
                value={fullName}
                onChange={(event) =>
                  setFullName(
                    event.target.value
                  )
                }
                placeholder="Enter your full name"
              />
            </div>

            <div className="student-field">
              <label>
                Student ID
              </label>

              <input
                type="text"
                value={studentId}
                readOnly
              />
            </div>

            <div className="student-field">
              <label>
                Mobile Number
              </label>

              <input
                type="tel"
                value={mobileNumber}
                onChange={(event) =>
                  setMobileNumber(
                    event.target.value
                  )
                }
                placeholder="Enter mobile number"
              />
            </div>

            <div className="student-field">
              <label>
                Program
              </label>

              <input
                type="text"
                value={program}
                onChange={(event) =>
                  setProgram(
                    event.target.value
                  )
                }
                placeholder="Enter your program"
              />
            </div>
          </div>

          {/* PICKUP */}

          <div className="checkout-section">
            <h3>
              PICK UP SCHEDULE
            </h3>

            <div className="pickup-field">
              <label>
                Preferred Date
              </label>

              <div className="date-input-wrapper">
                <input
                  type="date"
                  value={pickupDate}
                  min={formatDate(today)}
                  max={formatDate(maxDate)}
                  onChange={(event) =>
                    setPickupDate(
                      event.target.value
                    )
                  }
                />
              </div>

              <small>
                Can only be up to 14 days
              </small>
            </div>

            <div className="pickup-field">
              <label>
                Time Window
              </label>

              <div className="time-window-grid">
                {timeWindows.map(
                  (time) => (
                    <button
                      type="button"
                      key={time}
                      className={
                        selectedTime ===
                        time
                          ? "time-window selected"
                          : "time-window"
                      }
                      onClick={() =>
                        setSelectedTime(
                          time
                        )
                      }
                    >
                      {time}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          {/* RESERVE */}

          <button
            type="button"
            className="reserve-final-button"
            onClick={handleReserve}
            disabled={reserving}
          >
            {reserving
              ? "Reserving..."
              : "Reserve"}
          </button>
        </div>
      </div>
    );
  }

  // =========================
  // SIZE SELECTION PAGE
  // =========================

  if (selectedItem) {
    return (
      <div className="reservation-page">
        <div className="item-selection-page">

          <button
            type="button"
            className="back-button"
            onClick={() => {
              setSelectedItem(null);
              setSelectedSize(null);
              setQuantity(1);
            }}
          >
            ← Back
          </button>

          <div className="item-selection-header">
            <span>
              {getCategory(
                selectedItem
              )}
            </span>

            <h1>
              {selectedItem}
            </h1>

            <p>
              Size — price and online
              stock vary
            </p>
          </div>

          {/* SIZES */}

          <div className="size-list">
            {selectedItemSizes.map(
              (item) => (
                <button
                  type="button"
                  key={item.id}
                  className={
                    selectedSize ===
                    item.size
                      ? "size-option selected"
                      : "size-option"
                  }
                  disabled={
                    item.availableOnline <=
                    0
                  }
                  onClick={() => {
                    setSelectedSize(
                      item.size
                    );

                    setQuantity(1);
                  }}
                >
                  <div className="size-name">
                    {item.size === "N/A"
                      ? "One Size"
                      : item.size}
                  </div>

                  <div className="size-price">
                    ₱
                    {(
                      item.price ?? 0
                    ).toLocaleString(
                      "en-PH",
                      {
                        minimumFractionDigits: 2,
                      }
                    )}
                  </div>

                  <div className="size-stock">
                    {item.availableOnline >
                    0
                      ? `${item.availableOnline} left`
                      : "Out of stock"}
                  </div>
                </button>
              )
            )}
          </div>

          {/* QUANTITY */}

          {selectedSize &&
            selectedInventory && (
              <div className="quantity-section">

                <h3>
                  Quantity
                </h3>

                <div className="quantity-controls">

                  <button
                    type="button"
                    disabled={
                      quantity <= 1
                    }
                    onClick={() =>
                      setQuantity(
                        Math.max(
                          1,
                          quantity - 1
                        )
                      )
                    }
                  >
                    −
                  </button>

                  <span>
                    {quantity}
                  </span>

                  <button
                    type="button"
                    disabled={
                      quantity >=
                      Math.min(
                        5,
                        selectedInventory.availableOnline
                      )
                    }
                    onClick={() =>
                      setQuantity(
                        Math.min(
                          5,
                          selectedInventory.availableOnline,
                          quantity + 1
                        )
                      )
                    }
                  >
                    +
                  </button>

                </div>

                <p>
                  Maximum quantity:{" "}
                  {Math.min(
                    5,
                    selectedInventory.availableOnline
                  )}
                </p>

                {/* ADD TO RESERVATION */}

                <button
                  type="button"
                  className="add-reservation-button"
                  onClick={() => {
                    if (
                      !selectedItem ||
                      !selectedSize ||
                      !selectedInventory
                    ) {
                      return;
                    }

                    const price =
                      selectedInventory.price ??
                      0;

                    const inventoryId =
                      selectedInventory.id;

                    setCart(
                      (currentCart) => {
                        const existingIndex =
                          currentCart.findIndex(
                            (item) =>
                              item.inventoryId ===
                              inventoryId
                          );

                        // If item already exists,
                        // increase quantity
                        if (
                          existingIndex !==
                          -1
                        ) {
                          return currentCart.map(
                            (
                              item,
                              index
                            ) => {
                              if (
                                index !==
                                existingIndex
                              ) {
                                return item;
                              }

                              return {
                                ...item,

                                quantity:
                                  Math.min(
                                    5,
                                    item.quantity +
                                      quantity
                                  ),
                              };
                            }
                          );
                        }

                        // Add new item
                        return [
                          ...currentCart,

                          {
                            inventoryId,

                            itemName:
                              selectedItem,

                            size:
                              selectedSize,

                            quantity,

                            price,
                          },
                        ];
                      }
                    );

                    setSelectedItem(null);
                    setSelectedSize(null);
                    setQuantity(1);

                    setShowCheckout(true);
                  }}
                >
                  Add to Reservation
                </button>
              </div>
            )}
        </div>
      </div>
    );
  }

  // =========================
  // MAIN RESERVATION PAGE
  // =========================

  return (
    <div className="reservation-page">

      {/* HEADER */}

      <div className="reservation-header">
        <button
          type="button"
          className="back-button"
          onClick={onBack}
        >
          ← Back
        </button>

        <h1>
          Item Reservation
        </h1>
      </div>

      {/* REMINDER */}

      <div className="reservation-reminder">
        <h2>
          Reserve your items,
          claim them at the counter.
        </h2>

        <p>
          Reserved items must be
          claimed within three (3)
          days. Failure to claim
          within this period will
          automatically cancel the
          reservation.
        </p>
      </div>

      {/* FILTERS */}

      <div className="reservation-filters">
        {categories.map(
          (category) => (
            <button
              key={category}
              type="button"
              className={
                selectedCategory ===
                category
                  ? "reservation-filter active"
                  : "reservation-filter"
              }
              onClick={() =>
                setSelectedCategory(
                  category
                )
              }
            >
              {category}
            </button>
          )
        )}
      </div>

      {/* ITEMS */}

      <div className="reservation-items">

        {reservationItems.length ===
        0 ? (
          <p>
            No items are available
            in this category.
          </p>
        ) : (
          reservationItems.map(
            (item) => {

              const category =
                getCategory(
                  item.itemName
                );

              const totalAvailableOnline =
                filteredInventory
                  .filter(
                    (stock) =>
                      stock.itemName ===
                      item.itemName
                  )
                  .reduce(
                    (
                      total,
                      stock
                    ) =>
                      total +
                      Number(
                        stock.availableOnline ??
                        0
                      ),
                    0
                  );

              return (
                <div
                  key={item.id}
                  className="reservation-item-card"
                >

                  <div className="reservation-item-info">

                    <span className="item-category">
                      {category}
                    </span>

                    <h2>
                      {item.itemName}
                    </h2>

                    <p>
                      Available Online:{" "}
                      <strong>
                        {
                          totalAvailableOnline
                        }
                      </strong>
                    </p>

                  </div>

                  <button
                    type="button"
                    className="go-reservation-button"
                    onClick={() => {
                      setSelectedItem(
                        item.itemName
                      );

                      setSelectedSize(
                        null
                      );

                      setQuantity(1);
                    }}
                  >
                    Choose Item
                  </button>

                </div>
              );
            }
          )
        )}

      </div>
    </div>
  );
}