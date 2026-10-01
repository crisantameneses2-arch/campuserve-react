import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";

import { db } from "../../../firebase";

import "./ItemStocks.css";

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

  if (
    name.includes("female") ||
    name.includes("male")
  ) {
    return "University Uniform";
  }

  return "Others";
}

export default function ItemStocks() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const inventoryQuery = query(
      collection(db, "inventory"),
      orderBy("itemName")
    );

    const unsubscribe = onSnapshot(
      inventoryQuery,
      (snapshot) => {
        const items: InventoryItem[] = snapshot.docs.map(
          (doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as InventoryItem[];

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

  const filteredInventory = useMemo(() => {
    if (selectedCategory === "All") {
      return inventory;
    }

    return inventory.filter(
      (item) =>
        getCategory(item.itemName) === selectedCategory
    );
  }, [inventory, selectedCategory]);

  if (loading) {
    return (
      <div className="item-stocks">
        <p>Loading live stocks...</p>
      </div>
    );
  }

  return (
    <section className="item-stocks">

      <div className="item-stocks-header">
        <div>
          <h2>Item Stocks</h2>
          <p>
            Check the latest available stocks
            before making a reservation.
          </p>
        </div>
      </div>

      <div className="stock-filters">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={
              selectedCategory === category
                ? "stock-filter active"
                : "stock-filter"
            }
            onClick={() =>
              setSelectedCategory(category)
            }
          >
            {category}
          </button>
        ))}
      </div>

      <div className="stock-list">

        {filteredInventory.length === 0 ? (
          <p>No stocks available.</p>
        ) : (
          filteredInventory.map((item) => (
            <div
              className="stock-card"
              key={item.id}
            >

              <div className="stock-card-main">

                <div>
                  <h3>{item.itemName}</h3>

                  <p className="stock-size">
                    Size: {item.size}
                  </p>
                </div>

                <div className="online-stock">
                  <span>
                    Available Online
                  </span>

                  <strong>
                    {item.availableOnline}
                  </strong>
                </div>

              </div>

              <div className="stock-details">

                <div>
                  <span>Total</span>
                  <strong>
                    {item.totalStock}
                  </strong>
                </div>

                <div>
                  <span>Online</span>
                  <strong>
                    {item.onlineStock}
                  </strong>
                </div>

                <div>
                  <span>Reserved</span>
                  <strong>
                    {item.reservedQuantity}
                  </strong>
                </div>

                <div>
                  <span>Walk-in</span>
                  <strong>
                    {item.availableWalkIn}
                  </strong>
                </div>

              </div>

              <div className="stock-status">
                {item.availableOnline > 0
                  ? `${item.availableOnline} available online`
                  : "Currently unavailable"}
              </div>

            </div>
          ))
        )}

      </div>

    </section>
  );
}