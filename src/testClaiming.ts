console.log("TEST CLAIMING FILE LOADED");

import { createClaimStub } from "./services/claiming";

console.log("ABOUT TO CREATE CLAIM STUB");

createClaimStub({
  studentId: "24-LN-0888",
  studentName: "Test Student",
  claimType: "ITEM",
  referenceId: "RES-TEST-001",
  scheduleId: "SCH-TEST-001",
  claimDate: "2026-10-05",
  timeSlot: "10:00 AM - 12:00 PM",
  office: "GENERAL_OFFICE",
  totalAmount: 870,
})
  .then((result) => {
    console.log("CLAIM STUB CREATED:");
console.log(result);
console.log("Check Firebase Firestore now.");
  })
  .catch((error) => {
    console.error("CLAIM STUB ERROR:");
    console.error(error);
  });

