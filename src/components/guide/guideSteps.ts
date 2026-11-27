/*
 * What the student guide shows.
 *
 * Each step points at a real element on the student dashboard, found with a
 * CSS selector (most use data-tour="…" attributes added for the guide).
 *   page  → open this dashboard page first
 *   nav   → the element is in the sidebar (on phones the menu is opened)
 *   tap   → show "Tap here" (the step is about something to press)
 * A step without a target is shown as a centred card.
 */

export type GuidePage =
  | "dashboard"
  | "request"
  | "itemReservation"
  | "claimStub"
  | "transactions"
  | "notifications"
  | "messages"
  | "help"
  | "guide"
  | "profile";

export type GuideStep = {
  target?: string;
  title: string;
  text: string;
  page?: GuidePage;
  nav?: boolean;
  tap?: boolean;
};

export type GuideTopic = {
  key: string;
  title: string;
  hint: string;
  icon: "tour" | "file" | "bag" | "ticket" | "status" | "receipt" | "chat" | "bell" | "user";
  steps: GuideStep[];
};

/** Full first-time walkthrough of the student dashboard. */
export const DASHBOARD_TOUR: GuideStep[] = [
  {
    title: "Welcome to CampuServe! 👋",
    text: "This quick tour shows you where everything is on your dashboard. It takes about a minute. You can leave any time.",
    page: "dashboard",
  },
  {
    target: '[data-tour="nav-dashboard"]',
    nav: true,
    title: "Your menu",
    text: "Every page lives here: document requests, item reservations, your claim stubs, transaction history, messages and more.",
  },
  {
    target: '[data-tour="tracking"]',
    page: "dashboard",
    title: "Live tracking",
    text: "See exactly where your requests and reservations are, and when each was last updated. Swipe a card sideways to see the next one, or tap it for all the details.",
  },
  {
    target: '[data-tour="services"]',
    page: "dashboard",
    title: "Start something new",
    text: "Request a document, reserve an item, or open your claim stub when something is ready for pickup.",
    tap: true,
  },
  {
    target: '[data-tour="bell"]',
    title: "Notifications",
    text: "Updates from the Registrar, Cashier and General Office land here. Tap one to jump straight to what it's about.",
    tap: true,
  },
  {
    target: '[data-tour="chat"]',
    title: "Messages",
    text: "Have a question? Message the Registrar Office or the General Office directly, and answer group request invites.",
    tap: true,
  },
  {
    target: '[data-tour="nav-transactions"]',
    nav: true,
    title: "Transaction history",
    text: "All your past requests and reservations, with filters. Open a paid one to see or download its receipt.",
    tap: true,
  },
  {
    target: '[data-tour="account"]',
    title: "Your profile",
    text: "Your student details, a summary of your activity, and Log out.",
    tap: true,
  },
  {
    target: '[data-tour="nav-guide"]',
    nav: true,
    title: "Need help later?",
    text: "Open the User Guide any time. Pick what you want to do and it will show you exactly where to tap.",
  },
];

/** "How do I…?" topics on the User Guide page. */
export const GUIDE_TOPICS: GuideTopic[] = [
  {
    key: "tour",
    title: "Take the full tour",
    hint: "A one-minute walk around your dashboard.",
    icon: "tour",
    steps: DASHBOARD_TOUR,
  },
  {
    key: "request",
    title: "Request a document",
    hint: "TOR, certificates, diplomas and more.",
    icon: "file",
    steps: [
      {
        target: '[data-tour="service-document"]',
        page: "dashboard",
        title: "Start here",
        text: "Tap “Request a document” on your dashboard…",
        tap: true,
      },
      {
        target: '[data-tour="nav-request"]',
        nav: true,
        title: "…or from the menu",
        text: "“Document Requests” in the menu opens the same form. Choose Solo or Group, pick your documents, add the purpose, then submit.",
        tap: true,
      },
    ],
  },
  {
    key: "reserve",
    title: "Reserve an item",
    hint: "Uniforms, PE sets, ID lace.",
    icon: "bag",
    steps: [
      {
        target: '[data-tour="service-bag"]',
        page: "dashboard",
        title: "Open the catalog",
        text: "Tap “Reserve an item”. Pick an item, choose a size, add it to your reservation, then reserve.",
        tap: true,
      },
      {
        target: '[data-tour="nav-itemReservation"]',
        nav: true,
        title: "Also in the menu",
        text: "“Item Reservations” in the menu takes you to the same catalog.",
        tap: true,
      },
    ],
  },
  {
    key: "status",
    title: "Check my request's status",
    hint: "Where is it now? When did it change?",
    icon: "status",
    steps: [
      {
        target: '[data-tour="tracking"]',
        page: "dashboard",
        title: "Live tracking",
        text: "The big moving picture is the current step. Underneath you'll see when it was last updated.",
      },
      {
        target: '[data-tour="tracking-card"]',
        page: "dashboard",
        title: "See every detail",
        text: "Tap the card for the full details. Swipe it sideways to switch to your other requests.",
        tap: true,
      },
    ],
  },
  {
    key: "receipt",
    title: "Find or download my receipt",
    hint: "Proof of payment from the Cashier.",
    icon: "receipt",
    steps: [
      {
        target: '[data-tour="nav-transactions"]',
        nav: true,
        title: "Open Transaction History",
        text: "Your receipts are kept with each paid transaction.",
        tap: true,
      },
      {
        target: '[data-tour="tx-list"]',
        page: "transactions",
        title: "Pick a paid transaction",
        text: "Tap the transaction, then “View receipt”. On the receipt, tap “Download” to save it as an image.",
        tap: true,
      },
    ],
  },
  {
    key: "claim",
    title: "Claim my document or item",
    hint: "What to show at the counter.",
    icon: "ticket",
    steps: [
      {
        target: '[data-tour="service-ticket"]',
        page: "dashboard",
        title: "Your claim stub",
        text: "When something is ready for pickup, tap “Claim & release” to see your claim stub and code. Show it at the counter with your PSU ID.",
        tap: true,
      },
    ],
  },
  {
    key: "message",
    title: "Message an office",
    hint: "Ask the Registrar or General Office.",
    icon: "chat",
    steps: [
      {
        target: '[data-tour="chat"]',
        title: "Messages",
        text: "Tap the chat icon, then choose Registrar Office or General Office. You can also send a photo.",
        tap: true,
      },
    ],
  },
  {
    key: "notifications",
    title: "See my notifications",
    hint: "Updates about your requests.",
    icon: "bell",
    steps: [
      {
        target: '[data-tour="bell"]',
        title: "Notifications",
        text: "The bell shows a number when something new arrives. Tap a notification to open what it's about.",
        tap: true,
      },
    ],
  },
  {
    key: "profile",
    title: "View my profile or log out",
    hint: "Your details and account.",
    icon: "user",
    steps: [
      {
        target: '[data-tour="account"]',
        title: "Your profile",
        text: "Tap your initials to open My Profile. Log out is at the bottom of that page.",
        tap: true,
      },
    ],
  },
];
