import { collection, doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

const sizes = ["Small", "Medium", "Large", "XL", "XXL"];

const stockBySize = {
  Small: {
    totalStock: 234,
    onlineStock: 140,
    walkInStock: 94,
  },
  Medium: {
    totalStock: 233,
    onlineStock: 140,
    walkInStock: 93,
  },
  Large: {
    totalStock: 233,
    onlineStock: 140,
    walkInStock: 93,
  },
  XL: {
    totalStock: 150,
    onlineStock: 90,
    walkInStock: 60,
  },
  XXL: {
    totalStock: 150,
    onlineStock: 90,
    walkInStock: 60,
  },
};

const items = [
  {
    itemName: "Female RTW",
    prices: {
      Small: 870,
      Medium: 870,
      Large: 870,
      XL: 910,
      XXL: 910,
    },
  },
  {
    itemName: "Female TOP",
    prices: {
      Small: 440,
      Medium: 440,
      Large: 440,
      XL: 460,
      XXL: 460,
    },
  },
  {
    itemName: "Female SKIRT",
    prices: {
      Small: 440,
      Medium: 440,
      Large: 440,
      XL: 460,
      XXL: 460,
    },
  },
  {
    itemName: "Male RTW",
    prices: {
      Small: 840,
      Medium: 840,
      Large: 840,
      XL: 880,
      XXL: 880,
    },
  },
  {
    itemName: "Male TOP",
    prices: {
      Small: 430,
      Medium: 430,
      Large: 430,
      XL: 450,
      XXL: 450,
    },
  },
  {
    itemName: "Male SLACKS",
    prices: {
      Small: 430,
      Medium: 430,
      Large: 430,
      XL: 450,
      XXL: 450,
    },
  },
  {
    itemName: "Female Fabric",
    prices: {
      Small: 800,
      Medium: 800,
      Large: 800,
      XL: 820,
      XXL: 820,
    },
  },
  {
    itemName: "Male Fabric",
    prices: {
      Small: 800,
      Medium: 800,
      Large: 800,
      XL: 820,
      XXL: 820,
    },
  },
  {
    itemName: "PE SET",
    prices: {
      Small: 750,
      Medium: 750,
      Large: 750,
      XL: 750,
      XXL: 750,
    },
  },
  {
    itemName: "PE JOGGING",
    prices: {
      Small: 390,
      Medium: 390,
      Large: 390,
      XL: 390,
      XXL: 390,
    },
  },
  {
    itemName: "PE SHIRT",
    prices: {
      Small: 390,
      Medium: 390,
      Large: 390,
      XL: 390,
      XXL: 390,
    },
  },
  {
    itemName: "ROTC MALE",
    prices: {
      Small: 550,
      Medium: 550,
      Large: 550,
      XL: 550,
      XXL: 550,
    },
  },
  {
    itemName: "ROTC FEMALE",
    prices: {
      Small: 550,
      Medium: 550,
      Large: 550,
      XL: 550,
      XXL: 550,
    },
  },
];

async function seedInventory() {
  try {
    const inventoryRef = collection(db, "inventory");

    // Create the 13 regular items × 5 sizes
    for (const item of items) {
      for (const size of sizes) {
        const stock = stockBySize[size as keyof typeof stockBySize];
        const price = item.prices[size as keyof typeof item.prices];

        const documentId = `${item.itemName
          .toLowerCase()
          .replace(/\s+/g, "-")}-${size.toLowerCase()}`;

        await setDoc(doc(inventoryRef, documentId), {
          itemName: item.itemName,
          size: size,

          price: price,

          totalStock: stock.totalStock,
          onlineStock: stock.onlineStock,
          walkInStock: stock.walkInStock,

          availableOnline: stock.onlineStock,
          availableWalkIn: stock.walkInStock,

          reservedQuantity: 0,

          status: "Available",

          createdAt: new Date(),
        });
      }
    }

    // Create ID LACE
    await setDoc(doc(inventoryRef, "id-lace"), {
      itemName: "ID LACE",
      size: "N/A",

      price: 75,

      totalStock: 500,
      onlineStock: 300,
      walkInStock: 200,

      availableOnline: 300,
      availableWalkIn: 200,

      reservedQuantity: 0,

      status: "Available",

      createdAt: new Date(),
    });

    console.log("Inventory successfully seeded!");
    alert("Inventory successfully added to Firestore!");
  } catch (error) {
    console.error("Error seeding inventory:", error);
    alert("There was an error seeding the inventory. Check the console.");
  }
}

seedInventory();