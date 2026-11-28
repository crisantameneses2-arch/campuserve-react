
import { useState } from "react";
import OwlHelper from "../../components/owl/OwlHelper";
import "./HelpCenter.css";

const faqs = [
    {
        question: "How can I request a school document?",
        answer:
            "Go to the Request Document section, select your desired document, fill out the required information, and submit your request for processing.",
    },
    {
        question: "Can I request documents together with other students?",
        answer:
            "Yes. Select the Group Request option, invite other students, and wait for them to respond before proceeding with the group request.",
    },
    {
        question: "How can I check the status of my request?",
        answer:
            "You can monitor your request through the Live Tracking widget on your dashboard, which displays its current status, latest updates, and claiming schedule when available.",
    },
    {
        question: "How do I respond to a group request invitation?",
        answer:
            "Go to Group Request Invitations in the Messages section, review the invitation details, and select Accept or Decline.",
    },
    {
        question: "How do I reserve university items?",
        answer:
            "Navigate to the Item Reservation section, browse available items, select your preferred size and quantity if applicable, and submit your reservation.",
    },
    {
        question: "How will I know when my request is ready for claiming?",
        answer:
            "You will receive a notification once your request is marked Ready for Claiming. You can also check the claiming details and schedule through Live Tracking.",
    },
    {
        question: "Where can I view my previous transactions?",
        answer:
            "Go to the Transaction History section to view your previous document requests and item reservations, including completed transactions.",
    },
    {
        question: "What should I do if I forget my password?",
        answer:
            "Click Forgot Password on the login page, enter your registered email address, and follow the password reset instructions sent to your email.",
    },
    {
        question: "Can I cancel a document request or item reservation?",
        answer:
            "You may cancel a request or reservation if the cancellation option is still available. Once processing has started, cancellation may be restricted.",
    },
    {
        question: "What should I do if my document request is declined?",
        answer:
            "Check the request details or notifications for the reason for its rejection. You may submit a new request after addressing the identified issue.",
    },
    {
        question: "Can I request multiple documents at the same time?",
        answer:
            "Yes. You can select multiple available documents in a single request, depending on the options provided by the system.",
    },
    {
        question: "What should I do if I encounter a problem while using CampuServe?",
        answer:
            "Check your internet connection and refresh the page. If the issue continues, contact the designated university office or system administrator for assistance.",
    },
];


export default function HelpCenter() {
    /* bumps each time a question is opened, so the owl goes "hmm" */
    const [ponder, setPonder] = useState(0);
    /* one answer open at a time; null = all closed */
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const toggle = (index: number) => {
        if (openIndex === index) {
            setOpenIndex(null);
        } else {
            setOpenIndex(index);
            setPonder((n) => n + 1);
        }
    };

    return (
        <div className="help-center-page">
            <section className="help-center-section">
                <header className="help-center-hero">
                    <div className="help-center-hero-text">
                        <h2>Frequently Asked Questions</h2>
                        <p className="help-center-subtitle">
                            Select a question to view its answer.
                        </p>
                    </div>
                    <div className="help-center-owl">
                        <OwlHelper pose="thinking" nudge={ponder} />
                    </div>
                </header>

                <div className="help-center-faq-list">
                    {faqs.map((faq, index) => {
                        const isOpen = openIndex === index;
                        const buttonId = `help-faq-q-${index}`;
                        const panelId = `help-faq-a-${index}`;

                        return (
                            <div
                                className={`help-center-faq${isOpen ? " is-open" : ""}`}
                                key={faq.question}
                                style={{ animationDelay: `${0.2 + index * 0.04}s` }}
                            >
                                <h3 className="help-center-faq-heading">
                                    <button
                                        type="button"
                                        id={buttonId}
                                        className="help-center-faq-question"
                                        aria-expanded={isOpen}
                                        aria-controls={panelId}
                                        onClick={() => toggle(index)}
                                    >
                                        <span className="help-center-faq-number">
                                            {String(index + 1).padStart(2, "0")}
                                        </span>
                                        <span className="help-center-faq-text">
                                            {faq.question}
                                        </span>
                                        <span className="help-center-faq-icon" aria-hidden="true">
                                            <svg viewBox="0 0 20 20" width="14" height="14">
                                                <path
                                                    d="M5 7.5l5 5 5-5"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        </span>
                                    </button>
                                </h3>

                                <div
                                    id={panelId}
                                    role="region"
                                    aria-labelledby={buttonId}
                                    className="help-center-faq-panel"
                                >
                                    <div className="help-center-faq-panel-inner">
                                        <p>{faq.answer}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            <div className="help-center-contact">
                <div>
                    <h3>Still need help?</h3>
                    <p>
                        If you cannot find the answer you need, contact support.
                    </p>
                </div>
            </div>
        </div>
    );
}
