
import { useEffect, useMemo, useState } from "react";
import { isRetiredItem } from "../../components/items/retiredItems";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "../../../firebase";
import {
  assertFeatureEnabled,
  assertReservationSizeAllowed,
} from "../../services/settings";
import { logActivity } from "../../services/activityLog";

import ItemImage from "../../components/items/ItemImage";
import { getItemCardTone } from "../../components/items/itemArtKind";

// Kept for compatibility: other screens share a few of its class names.
import "./ItemReservation.css";
import "./ItemReservationTheme.css";

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

  /** Optional photo URL (e.g. served from Aiven). */
  imageUrl?: string;
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

  const [selectedCategory, setSelectedCategory] = useState("All");

  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const [quantity, setQuantity] = useState(1);

  const [cart, setCart] = useState<CartItem[]>([]);

  const [showCheckout, setShowCheckout] = useState(false);

  const [loading, setLoading] = useState(true);

  const [reserving, setReserving] = useState(false);

  // Shown after a reservation is made (like the document request success).
  const [success, setSuccess] = useState<{
    reservationId: string;
    itemCount: number;
    total: number;
  } | null>(null);

  // Opening an item, the checkout or the success screen starts at the top
  // of the page, not wherever the item list was scrolled to.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [selectedItem, showCheckout, success]);

  // Search + "available only" filter (display only)
  const [search, setSearch] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);

  // Saved (hearted) items, remembered on this browser for this student
  const favoritesKey = `campuserve:savedItems:${studentId}`;

  const [favorites, setFavorites] = useState<string[]>(() =>
    readSavedItems(favoritesKey)
  );

  useEffect(() => {
    setFavorites(readSavedItems(favoritesKey));
  }, [favoritesKey]);

  function toggleFavorite(itemName: string) {
    setFavorites((current) => {
      const next = current.includes(itemName)
        ? current.filter((name) => name !== itemName)
        : [...current, itemName];

      try {
        window.localStorage.setItem(favoritesKey, JSON.stringify(next));
      } catch {
        // Storage can be unavailable (private mode); saving is optional.
      }

      return next;
    });
  }

  // Student information
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [program, setProgram] = useState("");

  // =========================
  // LOAD STUDENT INFORMATION
  // =========================

  useEffect(() => {
    const fetchStudentDetails = async () => {
      try {
        const studentQuery = query(
          collection(db, "accounts"),
          where("student_id", "==", studentId),
          where("role", "==", "student")
        );

        const snapshot = await getDocs(studentQuery);

        if (!snapshot.empty) {
          const studentData = snapshot.docs[0].data();

          setFullName(studentData.name || "");
          setMobileNumber(studentData.contactNumber || "");
          setProgram(studentData.program || "");
        } else {
          console.error("Student account not found:", studentId);
        }
      } catch (error) {
        console.error("Error fetching student information:", error);
      }
    };

    if (studentId) {
      fetchStudentDetails();
    }
  }, [studentId]);

  // =========================
  // LOAD INVENTORY
  // =========================

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "inventory"),
      (snapshot) => {
        const items: InventoryItem[] = snapshot.docs.map(
          (inventoryDoc) => {
            const data = inventoryDoc.data();

            const totalStock = Number(data.totalStock ?? 0);
            const walkInStock = Number(data.walkInStock ?? 0);

            // Calculate online availability.
            // Do not use the stored availableOnline field.
            const reservedQuantity = Number(data.reservedQuantity ?? 0);

            const availableOnline = Math.max(
              0,
              totalStock - walkInStock - reservedQuantity
            );
            return {
              id: inventoryDoc.id,
              itemName: String(data.itemName ?? ""),
              size: String(data.size ?? "N/A"),

              totalStock,
              onlineStock: availableOnline,
              walkInStock,

              availableOnline,
              availableWalkIn: walkInStock,

              reservedQuantity,

              status: String(data.status ?? "Unavailable"),

              price: Number(data.price ?? 0),

              imageUrl: String(
                data.imageUrl ??
                  data.imageURL ??
                  data.image ??
                  data.photoUrl ??
                  ""
              ).trim() || undefined,
            };
          }
        );

        // ROTC items are no longer offered.
        setInventory(items.filter((item) => !isRetiredItem(item.itemName)));
        setLoading(false);
      },
      (error) => {
        console.error("Error loading inventory:", error);
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

    if (selectedCategory === "Saved") {
      return inventory.filter((item) =>
        favorites.includes(item.itemName)
      );
    }

    return inventory.filter(
      (item) => getCategory(item.itemName) === selectedCategory
    );
  }, [inventory, selectedCategory, favorites]);

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
  }, [inventory, selectedItem, selectedSize]);

  // =========================
  // CART TOTAL
  // =========================

  const cartTotal = useMemo(() => {
    return cart.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );
  }, [cart]);

  // =========================
  // PRODUCT CARDS (one per item name)
  // =========================

  const products = useMemo(() => {
    const term = search.trim().toLowerCase();

    return reservationItems
      .map((item) => {
        const sizes = filteredInventory.filter(
          (stock) => stock.itemName === item.itemName
        );

        const prices = sizes
          .map((stock) => Number(stock.price ?? 0))
          .filter((price) => price > 0);

        return {
          id: item.id,
          itemName: item.itemName,
          category: getCategory(item.itemName),
          sizeCount: sizes.filter((stock) => stock.size !== "N/A").length,
          minPrice: prices.length ? Math.min(...prices) : 0,
          maxPrice: prices.length ? Math.max(...prices) : 0,
          totalAvailableOnline: sizes.reduce(
            (total, stock) => total + stock.availableOnline,
            0
          ),
          imageUrl: sizes.find((stock) => stock.imageUrl)?.imageUrl,
        };
      })
      .filter((product) =>
        term
          ? `${product.itemName} ${product.category}`
              .toLowerCase()
              .includes(term)
          : true
      )
      .filter((product) =>
        availableOnly ? product.totalAvailableOnline > 0 : true
      );
  }, [reservationItems, filteredInventory, search, availableOnly]);

  const sortedSelectedSizes = useMemo(
    () =>
      [...selectedItemSizes].sort(
        (a, b) => sizeRank(a.size) - sizeRank(b.size)
      ),
    [selectedItemSizes]
  );

  const cartCount = cart.reduce(
    (total, item) => total + item.quantity,
    0
  );

  function openItem(itemName: string) {
    const sizes = inventory.filter(
      (stock) => stock.itemName === itemName
    );

    setSelectedItem(itemName);
    setQuantity(1);

    // Items with a single size are pre-selected.
    setSelectedSize(
      sizes.length === 1 && sizes[0].availableOnline > 0
        ? sizes[0].size
        : null
    );
  }

  function removeFromCart(inventoryId: string) {
    setCart((currentCart) =>
      currentCart.filter((item) => item.inventoryId !== inventoryId)
    );
  }

  function imageFor(itemName: string) {
    return inventory.find(
      (stock) => stock.itemName === itemName && stock.imageUrl
    )?.imageUrl;
  }

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

    // Validate cart
    if (cart.length === 0) {
      window.alert("Your reservation is empty.");
      return;
    }

    try {
      setReserving(true);
      
      // Stop here if the administrator turned reservations off.
      await assertFeatureEnabled("itemReservations");
      await assertReservationSizeAllowed(
        cart.reduce((total, item) => total + item.quantity, 0)
      );

      // Generate reservation ID
      const reservationId = `IR-${Date.now()}`;

      // Create reservation document reference
      const reservationRef = doc(
        db,
        "itemReservations",
        reservationId
      );

      await runTransaction(
        db,
        async (transaction) => {
          // ========================================
          // GET INVENTORY REFERENCES
          // ========================================

          const inventoryRefs = cart.map((item) =>
            doc(db, "inventory", item.inventoryId)
          );

          // ========================================
          // READ INVENTORY DOCUMENTS
          // ========================================

          const inventorySnapshots = await Promise.all(
            inventoryRefs.map((inventoryRef) =>
              transaction.get(inventoryRef)
            )
          );

          // ========================================
          // CHECK STOCK ONLY
          // ========================================

          for (let i = 0; i < cart.length; i++) {
            const cartItem = cart[i];
            const inventorySnapshot = inventorySnapshots[i];

            if (!inventorySnapshot.exists()) {
              throw new Error(
                `${cartItem.itemName} (${cartItem.size}) is no longer available.`
              );
            }

            const inventoryData = inventorySnapshot.data();

            const availableOnline = Math.max(
              0,
              Number(inventoryData.totalStock ?? 0) -
              Number(inventoryData.walkInStock ?? 0) -
              Number(inventoryData.reservedQuantity ?? 0)
            );

            if (availableOnline < cartItem.quantity) {
              throw new Error(
                `Not enough online stock for ${cartItem.itemName} (${cartItem.size}). Available: ${availableOnline}.`
              );
            }
          }

          // ========================================
          // CREATE RESERVATION ONLY
          // ========================================
          // IMPORTANT:
          // No inventory deduction happens here.
          // General Office will deduct stock upon approval.

          transaction.set(reservationRef, {
            reservationId,

            studentId,

            fullName: fullName.trim(),

            mobileNumber: mobileNumber.trim(),

            program: program.trim(),

            items: cart.map((item) => ({
              inventoryId: item.inventoryId,

              itemName: item.itemName,

              size: item.size,

              quantity: item.quantity,

              price: item.price,

              subtotal: item.price * item.quantity,
            })),

            totalAmount: cart.reduce(
              (total, item) =>
                total + item.price * item.quantity,
              0
            ),

            status: "Unpaid",

            createdAt: serverTimestamp(),
          });
        }
      );

      // ========================================
      // SUCCESS
      // ========================================

      // ========================================
      // SUCCESS
      // ========================================

      setSuccess({
        reservationId,
        itemCount: cart.reduce(
          (count, item) => count + item.quantity,
          0
        ),
        total: cart.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        ),
      });

      // Record the reservation in the activity logs.
      // Logging errors should not undo or misreport a successful reservation.
      try {
        await logActivity(
          {
            id: studentId,
            name: fullName.trim() || studentId,
            role: "student",
          },
          "RESERVATION_CREATED",
          `Reserved ${cart.length} item${
            cart.length === 1 ? "" : "s"
          } (${reservationId}).`,
          {
            totalAmount: cart.reduce(
              (total, item) => total + item.price * item.quantity,
              0
            ),
          }
        );
      } catch (logError) {
        console.error(
          "Reservation was created, but activity logging failed:",
          logError
        );
      }


      // Clear reservation data
      setCart([]);

      setFullName("");
      setMobileNumber("");
      setProgram("");

      setSelectedItem(null);
      setSelectedSize(null);
      setQuantity(1);

      setShowCheckout(false);
    } catch (error) {
      console.error("Reservation failed:", error);

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
  // SUCCESS
  // =========================

  if (success) {
    return (
      <div className="irx">
        <section className="irx-success">
          <span className="irx-success__mark" aria-hidden="true">
            <svg viewBox="0 0 76 76" fill="none">
              <circle cx="38" cy="38" r="35" fill="currentColor" opacity=".12" />
              <circle cx="38" cy="38" r="26" fill="currentColor" />
              <path
                d="m27 38.5 7.5 7.5L50 30.5"
                stroke="#fff"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>

          <span className="irx-success__eyebrow">RESERVATION SUBMITTED</span>

          <h2>Successfully reserved!</h2>

          <p>
            Your reservation has been sent to the General Office. Pay at the
            Cashier; once the General Office approves it, claim your items
            within seven (7) days, or it will be cancelled. You can follow
            its progress from your dashboard.
          </p>

          <div className="irx-success__ref">
            <span>RESERVATION ID</span>
            <strong>{success.reservationId}</strong>
          </div>

          <dl className="irx-success__details">
            <div>
              <dt>Student ID</dt>
              <dd>{studentId}</dd>
            </div>
            <div>
              <dt>Items</dt>
              <dd>
                {success.itemCount} item{success.itemCount === 1 ? "" : "s"}
              </dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{formatPrice(success.total)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <span className="irx-success__status">Unpaid</span>
              </dd>
            </div>
          </dl>

          <div className="irx-success__actions">
            <button
              type="button"
              className="irx-btn irx-btn--primary"
              onClick={() => setSuccess(null)}
            >
              Reserve more items
            </button>
            <button type="button" className="irx-link-btn" onClick={onBack}>
              Go to dashboard
            </button>
          </div>
        </section>
      </div>
    );
  }

  // =========================
  // LOADING
  // =========================

  if (loading) {
    return (
      <div className="irx">
        <div className="irx-loading" role="status">
          <span className="irx-spinner" />
          Loading available items...
        </div>
      </div>
    );
  }

  // =========================
  // CHECKOUT PAGE
  // =========================

  if (showCheckout) {
    return (
      <div className="irx">
        <div className="irx-topline">
          <button
            type="button"
            className="irx-back"
            onClick={() => setShowCheckout(false)}
          >
            <span aria-hidden="true">←</span> Continue browsing
          </button>
        </div>

        <div className="irx-checkout">
          {/* ITEMS */}

          <section className="irx-panel" aria-label="Reserved items">
            <div className="irx-panel__head">
              <h2>Your items</h2>

              <button
                type="button"
                className="irx-link-btn"
                onClick={() => {
                  setShowCheckout(false);
                  setSelectedItem(null);
                  setSelectedSize(null);
                  setQuantity(1);
                }}
              >
                + Add more items
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="irx-empty">
                <strong>Your reservation is empty</strong>
                <p>Add an item to continue.</p>
              </div>
            ) : (
              <div className="irx-lines">
                {cart.map((item, index) => (
                  <div
                    className="irx-line"
                    key={`${item.inventoryId}-${index}`}
                  >
                    <span
                      className={`irx-thumb irx-tone--${getItemCardTone(item.itemName)}`}
                    >
                      <ItemImage
                        itemName={item.itemName}
                        imageUrl={imageFor(item.itemName)}
                      />
                    </span>

                    <div className="irx-line__copy">
                      <strong>{item.itemName}</strong>
                      <small>
                        {item.size !== "N/A"
                          ? `Size ${sizeLabel(item.size)} · `
                          : ""}
                        {item.quantity} ×{" "}
                        {formatPrice(item.price)}
                      </small>
                    </div>

                    <span className="irx-line__price">
                      {formatPrice(item.price * item.quantity)}
                    </span>

                    <button
                      type="button"
                      className="irx-icon-btn"
                      onClick={() => removeFromCart(item.inventoryId)}
                      aria-label={`Remove ${item.itemName}`}
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="irx-total">
              <span>
                Total
                {cartCount > 0 && (
                  <small>
                    {" "}
                    · {cartCount} item{cartCount === 1 ? "" : "s"}
                  </small>
                )}
              </span>
              <strong>{formatPrice(cartTotal)}</strong>
            </div>
          </section>

          {/* STUDENT */}

          <section className="irx-panel" aria-label="Student details">
            <div className="irx-panel__head">
              <h2>Your details</h2>
            </div>

            <div className="irx-form">
              <div className="irx-field">
                <label htmlFor="irx-name">Full name</label>
                <input
                  id="irx-name"
                  type="text"
                  value={fullName}
                  onChange={(event) =>
                    setFullName(event.target.value)
                  }
                  placeholder="Enter your full name"
                />
              </div>

              <div className="irx-field">
                <label htmlFor="irx-student-id">Student ID</label>
                <input
                  id="irx-student-id"
                  type="text"
                  value={studentId}
                  readOnly
                />
              </div>

              <div className="irx-field">
                <label htmlFor="irx-mobile">Mobile number</label>
                <input
                  id="irx-mobile"
                  type="tel"
                  value={mobileNumber}
                  onChange={(event) =>
                    setMobileNumber(event.target.value)
                  }
                  placeholder="Enter mobile number"
                />
              </div>

              <div className="irx-field">
                <label htmlFor="irx-program">Program</label>
                <input
                  id="irx-program"
                  type="text"
                  value={program}
                  onChange={(event) =>
                    setProgram(event.target.value)
                  }
                  placeholder="e.g. BSIT"
                />
              </div>
            </div>

            <p className="irx-note">
              Once approved, your items must be claimed within seven (7)
              days, or the reservation is cancelled and the items go back
              to stock.
            </p>

            <button
              type="button"
              className="irx-btn irx-btn--primary irx-btn--block"
              onClick={handleReserve}
              disabled={reserving || cart.length === 0}
            >
              {reserving ? "Reserving..." : "Reserve items"}
            </button>
          </section>
        </div>
      </div>
    );
  }

  // =========================
  // ITEM DETAIL (SIZE SELECTION)
  // =========================

  if (selectedItem) {
    const category = getCategory(selectedItem);
    const tone = getItemCardTone(selectedItem);
    const hasRealSizes = sortedSelectedSizes.some(
      (item) => item.size !== "N/A"
    );

    const prices = sortedSelectedSizes
      .map((item) => Number(item.price ?? 0))
      .filter((price) => price > 0);

    const displayPrice = selectedInventory
      ? formatPrice(selectedInventory.price ?? 0)
      : prices.length === 0
        ? formatPrice(0)
        : Math.min(...prices) === Math.max(...prices)
          ? formatPrice(prices[0])
          : `from ${formatPrice(Math.min(...prices))}`;

    const maxQuantity = selectedInventory
      ? Math.min(5, selectedInventory.availableOnline)
      : 0;

    const totalOnline = sortedSelectedSizes.reduce(
      (total, item) => total + item.availableOnline,
      0
    );

    return (
      <div className="irx irx--item-view">
        <div className="irx-topline">
          <button
            type="button"
            className="irx-back"
            onClick={() => {
              setSelectedItem(null);
              setSelectedSize(null);
              setQuantity(1);
            }}
          >
            <span aria-hidden="true">←</span> All items
          </button>
        </div>

        <div className="irx-detail">
          {/* IMAGE */}

          <div className={`irx-hero irx-tone--${tone}`}>
            {totalOnline > 0 && totalOnline <= 5 && (
              <span className="irx-ribbon irx-ribbon--tall">Few left</span>
            )}

            {totalOnline === 0 && (
              <span className="irx-ribbon irx-ribbon--tall irx-ribbon--muted">
                Sold out
              </span>
            )}

            <ItemImage
              className="irx-hero__image"
              itemName={selectedItem}
              imageUrl={imageFor(selectedItem)}
            />
          </div>

          {/* INFO */}

          <div className="irx-info">
            <div className="irx-info__title">
              <div>
                <h1>{selectedItem}</h1>
                <span>{category}</span>
              </div>

              <strong className="irx-price">{displayPrice}</strong>
            </div>

            <div className="irx-block">
              <h3>{hasRealSizes ? "Size" : "Availability"}</h3>

              {hasRealSizes ? (
                <div
                  className="irx-sizes"
                  role="radiogroup"
                  aria-label="Choose a size"
                >
                  {sortedSelectedSizes.map((item) => {
                    const soldOut = item.availableOnline <= 0;
                    const active = selectedSize === item.size;

                    return (
                      <button
                        type="button"
                        key={item.id}
                        role="radio"
                        aria-checked={active}
                        className={`irx-size ${active ? "is-active" : ""}`}
                        disabled={soldOut}
                        onClick={() => {
                          setSelectedSize(item.size);
                          setQuantity(1);
                        }}
                        title={
                          soldOut
                            ? "Out of stock"
                            : `${item.availableOnline} left · ${formatPrice(item.price ?? 0)}`
                        }
                      >
                        {item.size === "N/A" ? "One" : sizeLabel(item.size)}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <p className="irx-stock">
                {selectedInventory
                  ? selectedInventory.availableOnline > 0
                    ? `${selectedInventory.availableOnline} left for online reservation`
                    : "Out of stock"
                  : totalOnline > 0
                    ? "Choose a size to see how many are left."
                    : "This item is currently out of stock."}
              </p>
            </div>

            {selectedInventory && maxQuantity > 0 && (
              <div className="irx-block">
                <h3>Quantity</h3>

                <div className="irx-qty-row">
                  <div className="irx-qty">
                    <button
                      type="button"
                      disabled={quantity <= 1}
                      onClick={() =>
                        setQuantity(Math.max(1, quantity - 1))
                      }
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>

                    <span aria-live="polite">{quantity}</span>

                    <button
                      type="button"
                      disabled={quantity >= maxQuantity}
                      onClick={() =>
                        setQuantity(
                          Math.min(maxQuantity, quantity + 1)
                        )
                      }
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  <small>Max {maxQuantity} per item</small>
                </div>
              </div>
            )}

            <div className="irx-actions">
              <button
                type="button"
                className="irx-cart-btn"
                onClick={() => setShowCheckout(true)}
                disabled={cart.length === 0}
                aria-label={
                  cart.length
                    ? `View reservation (${cartCount} items)`
                    : "Reservation is empty"
                }
                title="View reservation"
              >
                <CartIcon />
                {cartCount > 0 && (
                  <span className="irx-cart-btn__count">
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                className="irx-btn irx-btn--primary irx-btn--grow"
                disabled={!selectedInventory || maxQuantity <= 0}
                onClick={() => {
                  if (
                    !selectedItem ||
                    !selectedSize ||
                    !selectedInventory
                  ) {
                    return;
                  }

                  const price = selectedInventory.price ?? 0;
                  const inventoryId = selectedInventory.id;

                  setCart((currentCart) => {
                    const existingIndex = currentCart.findIndex(
                      (item) => item.inventoryId === inventoryId
                    );

                    // If item already exists, increase quantity
                    if (existingIndex !== -1) {
                      return currentCart.map((item, index) => {
                        if (index !== existingIndex) {
                          return item;
                        }

                        return {
                          ...item,
                          quantity: Math.min(
                            5,
                            item.quantity + quantity
                          ),
                        };
                      });
                    }

                    // Add new item
                    return [
                      ...currentCart,
                      {
                        inventoryId,
                        itemName: selectedItem,
                        size: selectedSize,
                        quantity,
                        price,
                      },
                    ];
                  });

                  setSelectedItem(null);
                  setSelectedSize(null);
                  setQuantity(1);

                  setShowCheckout(true);
                }}
              >
                {!selectedInventory && hasRealSizes
                  ? "Choose a size"
                  : "Add to reservation"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================
  // MAIN RESERVATION PAGE
  // =========================

  return (
    <div className="irx">
      {/* SEARCH */}

      <div className="irx-search-row">
        <label className="irx-search">
          <span className="irx-visually-hidden">Search items</span>
          <SearchIcon />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search items"
          />
        </label>

        <button
          type="button"
          className={`irx-filter-btn ${availableOnly ? "is-on" : ""}`}
          onClick={() => setAvailableOnly(!availableOnly)}
          aria-pressed={availableOnly}
          title={
            availableOnly
              ? "Showing available items only"
              : "Show available items only"
          }
        >
          <FilterIcon />
          <span className="irx-visually-hidden">
            Show available items only
          </span>
        </button>

        {/* How reserving works (shown once here instead of on every item). */}
        <div className="irx-search-note" role="note">
          <span className="irx-search-note__mark" aria-hidden="true">
            !
          </span>
          <p>
            <strong>Claim Period: 7 Days After Approval</strong>
            Once the General Office approves your reservation, pick up your
            items within 7 days, or it's cancelled and the items go back to
            stock.
          </p>
        </div>
      </div>

      {/* FILTERS */}

      <div className="irx-chips" role="tablist" aria-label="Categories">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            role="tab"
            aria-selected={selectedCategory === category}
            className={`irx-chip ${selectedCategory === category ? "is-active" : ""}`}
            onClick={() => setSelectedCategory(category)}
          >
            {selectedCategory === category && (
              <span aria-hidden="true">✓</span>
            )}
            {category}
          </button>
        ))}

        {(favorites.length > 0 || selectedCategory === "Saved") && (
          <button
            type="button"
            role="tab"
            aria-selected={selectedCategory === "Saved"}
            className={`irx-chip irx-chip--saved ${selectedCategory === "Saved" ? "is-active" : ""}`}
            onClick={() => setSelectedCategory("Saved")}
          >
            <HeartIcon filled size={14} />
            Saved ({favorites.length})
          </button>
        )}

        {availableOnly && (
          <span className="irx-chip irx-chip--note">Available only</span>
        )}
      </div>

      {/* ITEMS */}

      {products.length === 0 ? (
        <div className="irx-empty irx-empty--page">
          <strong>No items found</strong>
          <p>
            {selectedCategory === "Saved" && !search
              ? "Tap the heart on an item to save it here."
              : search || availableOnly
                ? "Try another search or turn off the available-only filter."
                : "No items are available in this category."}
          </p>
        </div>
      ) : (
        <div className="irx-grid">
          {products.map((product) => {
            const tone = getItemCardTone(product.itemName);
            const saved = favorites.includes(product.itemName);

            return (
              <article
                key={product.id}
                className={`irx-card irx-tone--${tone}`}
              >
                <button
                  type="button"
                  className={`irx-heart ${saved ? "is-on" : ""}`}
                  onClick={() => toggleFavorite(product.itemName)}
                  aria-pressed={saved}
                  aria-label={
                    saved
                      ? `Remove ${product.itemName} from saved items`
                      : `Save ${product.itemName}`
                  }
                >
                  <HeartIcon filled={saved} />
                </button>

                <span className="irx-card__media" aria-hidden="true">
                  <ItemImage
                    className="irx-card__image"
                    itemName={product.itemName}
                    imageUrl={product.imageUrl}
                  />
                </span>

                <span className="irx-card__body">
                  {product.totalAvailableOnline === 0 ? (
                    <span className="irx-badge irx-badge--muted">
                      Sold out
                    </span>
                  ) : product.totalAvailableOnline <= 5 ? (
                    <span className="irx-badge">Few left</span>
                  ) : null}

                  {/* This button covers the whole card (see CSS). */}
                  <button
                    type="button"
                    className="irx-card__open"
                    onClick={() => openItem(product.itemName)}
                    title={product.itemName}
                    aria-label={product.itemName}
                  >
                    {getCardTitle(product.itemName).title}
                  </button>

                  <small>
                    {getCardTitle(product.itemName).detail ??
                      product.category}
                    {" · "}
                    {product.sizeCount > 1
                      ? `${product.sizeCount} sizes`
                      : product.sizeCount === 1
                        ? "1 size"
                        : "One size"}
                  </small>

                  <span className="irx-card__price">
                    {product.minPrice !== product.maxPrice
                      ? `from ${formatPrice(product.minPrice)}`
                      : formatPrice(product.minPrice)}
                  </span>
                </span>

                <span className="irx-card__plus" aria-hidden="true">
                  +
                </span>
              </article>
            );
          })}
        </div>
      )}

      {/* RESERVATION BAR */}

      {cart.length > 0 && (
        <div className="irx-cartbar" role="region" aria-label="Your reservation">
          <span className="irx-cartbar__icon" aria-hidden="true">
            <CartIcon />
          </span>

          <span className="irx-cartbar__copy">
            <strong>
              {cartCount} item{cartCount === 1 ? "" : "s"} reserved
            </strong>
            <small>{formatPrice(cartTotal)}</small>
          </span>

          <button
            type="button"
            className="irx-btn irx-btn--light"
            onClick={() => setShowCheckout(true)}
          >
            Review <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* =========================
   HELPERS
========================= */

function formatPrice(amount: number) {
  return `₱${Number(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

const SIZE_ORDER = [
  "XXS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "2XL",
  "XXXL",
  "3XL",
  "4XL",
  "5XL",
];

/** "Small" / "medium" / "Extra Large" / "2XL" … → S, M, L, XL, XXL … */
const SIZE_NAMES: Record<string, string> = {
  "EXTRA SMALL": "XS",
  SMALL: "S",
  MEDIUM: "M",
  LARGE: "L",
  "EXTRA LARGE": "XL",
  "X-LARGE": "XL",
  "XX-LARGE": "XXL",
  "EXTRA EXTRA LARGE": "XXL",
  "2XL": "XXL",
  "3XL": "XXXL",
};

function sizeLabel(size: string) {
  const upper = size.trim().toUpperCase().replace(/\s+/g, " ");
  return SIZE_NAMES[upper] ?? upper;
}

function sizeRank(size: string) {
  const upper = sizeLabel(size);
  const index = SIZE_ORDER.indexOf(upper);

  if (index !== -1) return index;

  const number = parseFloat(upper);

  if (!Number.isNaN(number)) return 100 + number;

  return 1000;
}

/**
 * Shorter card titles for long catalog names, e.g.
 *   "University Uniform - Female (Ready to Wear) (skirt only)"
 *     → title "Female · Skirt only", detail "University Uniform · Ready to wear"
 *   "PE Uniform (jogging pants only)"
 *     → title "Jogging pants only", detail "PE Uniform"
 * The full name is still shown on the item page.
 */
function getCardTitle(itemName: string): {
  title: string;
  detail?: string;
} {
  const capitalize = (text: string) =>
    text.charAt(0).toUpperCase() + text.slice(1);

  const uniform = itemName.match(/^\s*university uniform\s*-\s*(.+)$/i);

  if (uniform) {
    let rest = uniform[1];
    const readyToWear = /\(\s*ready to wear\s*\)/i.test(rest);

    rest = rest.replace(/\(\s*ready to wear\s*\)/i, " ");

    const parts = rest
      .split(/[()]/)
      .map((part) => part.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .map(capitalize);

    return {
      title: parts.join(" · "),
      detail: `University Uniform${readyToWear ? " · Ready to wear" : ""}`,
    };
  }

  const pe = itemName.match(/^\s*(pe uniform)\s*\((.+)\)\s*$/i);

  if (pe) {
    return { title: capitalize(pe[2].trim()), detail: "PE Uniform" };
  }

  return { title: itemName };
}

function readSavedItems(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function HeartIcon({
  filled = false,
  size = 18,
}: {
  filled?: boolean;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10Z" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 4h2.2l2.1 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L20.5 8H6.1" />
      <circle cx="10" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="19"
      height="19"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </svg>
  );
}
