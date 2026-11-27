import { GUIDE_TOPICS, type GuideTopic } from "./guideSteps";
import "./StudentGuide.css";

/*
 * User Guide page: "How do I…?" topics. Each one starts a short
 * spotlight guide that opens the right page and points at where to tap.
 */

export default function UserGuidePage({
  onStart,
}: {
  onStart: (topic: GuideTopic) => void;
}) {
  const [tour, ...topics] = GUIDE_TOPICS;

  return (
    <div className="ugx">
      <section className="ugx-hero">
        <div className="ugx-hero__copy">
          <span className="ugx-eyebrow">USER GUIDE</span>
          <h2>What would you like to do?</h2>
          <p>
            Pick a topic and we'll show you exactly where to tap, step by
            step, on your own dashboard.
          </p>
        </div>

        <button type="button" className="ugx-tour" onClick={() => onStart(tour)}>
          <span className="ugx-tour__icon" aria-hidden="true">
            <TopicIcon name="tour" />
          </span>
          <span>
            <strong>{tour.title}</strong>
            <small>{tour.hint}</small>
          </span>
          <span className="ugx-arrow" aria-hidden="true">→</span>
        </button>
      </section>

      <h3 className="ugx-heading">How do I…</h3>

      <div className="ugx-grid">
        {topics.map((topic) => (
          <button
            key={topic.key}
            type="button"
            className={`ugx-topic ugx-topic--${topic.icon}`}
            onClick={() => onStart(topic)}
          >
            <span className="ugx-topic__icon" aria-hidden="true">
              <TopicIcon name={topic.icon} />
            </span>
            <span className="ugx-topic__copy">
              <strong>{topic.title}</strong>
              <small>{topic.hint}</small>
            </span>
            <span className="ugx-topic__go">Show me</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TopicIcon({ name }: { name: GuideTopic["icon"] }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "tour":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m15.5 8.5-2 5-5 2 2-5z" />
        </svg>
      );
    case "file":
      return (
        <svg {...common}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5M9 13h6M9 17h4" />
        </svg>
      );
    case "bag":
      return (
        <svg {...common}>
          <path d="M5 8h14l-1 12H6z" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </svg>
      );
    case "ticket":
      return (
        <svg {...common}>
          <path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z" />
          <path d="M10 7v10" strokeDasharray="2 2" />
        </svg>
      );
    case "status":
      return (
        <svg {...common}>
          <path d="M3 12h4l3-7 4 14 3-7h4" />
        </svg>
      );
    case "receipt":
      return (
        <svg {...common}>
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
          <path d="M9 8h6M9 12h6" />
        </svg>
      );
    case "chat":
      return (
        <svg {...common}>
          <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      );
  }
}
