
import { useState } from "react";
import "./ContactSupport.css";

export default function ContactSupport() {
  const [category, setCategory] = useState("General Inquiry");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!subject.trim() || !message.trim()) return;

    // UI confirmation only. No message is saved or sent yet.
    setSubmitted(true);
    setSubject("");
    setMessage("");
    setCategory("General Inquiry");
  }

  return (
    <div className="contact-support-page">
      <div className="contact-support-content">
        <div className="contact-support-info">
          <h3>We're here to help.</h3>
          <p>
            Use the form to describe your concern about
            document requests, item reservations, or your account.
          </p>

          <div className="contact-support-info-item">
            <span>01</span>
            <div>
              <strong>Describe your concern</strong>
              <p>Choose a category and provide a clear subject.</p>
            </div>
          </div>

          <div className="contact-support-info-item">
            <span>02</span>
            <div>
              <strong>Provide details</strong>
              <p>Explain the issue so the support team can understand it.</p>
            </div>
          </div>

          <div className="contact-support-info-item">
            <span>03</span>
            <div>
              <strong>Submit your message</strong>
              <p>Send your concern through the support form.</p>
            </div>
          </div>
        </div>

        <div className="contact-support-form-card">
          <h3>Send us a message</h3>
          <p className="contact-support-form-description">
            Fill out the fields below.
          </p>

          {submitted && (
            <div className="contact-support-success">
              Message submitted in this demo. Actual sending and saving
              have not been connected yet.
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="contact-support-field">
              <label htmlFor="support-category">
                Concern Category
              </label>
              <select
                id="support-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option>General Inquiry</option>
                <option>Document Request</option>
                <option>Item Reservation</option>
                <option>Account Concern</option>
                <option>Technical Issue</option>
                <option>Other</option>
              </select>
            </div>

            <div className="contact-support-field">
              <label htmlFor="support-subject">Subject</label>
              <input
                id="support-subject"
                type="text"
                placeholder="Enter the subject of your concern"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            <div className="contact-support-field">
              <label htmlFor="support-message">Message</label>
              <textarea
                id="support-message"
                placeholder="Describe your concern or question..."
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="contact-support-submit"
            >
              Submit Message <span>→</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
